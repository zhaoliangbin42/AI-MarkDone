(() => {
  const BRIDGE_KEY = '__AIMD_CHATGPT_CONVERSATION_BRIDGE__';
  if (window[BRIDGE_KEY]) return;

  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const CACHE_KEY = 'aimd:chatgpt-conversation-bridge-cache:v3';
  const JS_ASSET_RE = /\/cdn\/assets\/[^"' )]+\.js(?:\?[^"' )]+)?$/i;
  const MAX_SCAN = 18;
  const MAX_BRIDGE_ATTEMPTS = 5;
  const BACKEND_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
  const KEYWORDS = [
    { pattern: /updateThreadFromServer/g, score: 90 },
    { pattern: /getConversationTurns|getConversationTurnAtIndex|lastUserMessage/g, score: 70 },
    { pattern: /\/conversation\/\{conversation_id\}|\/backend-api\/conversation\//g, score: 60 },
    { pattern: /\brootId\b|\bcurrentLeafId\b|\bmessageIdToNodeId\b|\bgetBranchFromLeaf\b/g, score: 45 },
    { pattern: /\bmapping\b|\bcurrent_node\b|\balder_turns\b/g, score: 35 },
  ];

  const bridgeState = {
    buildFingerprint: null,
    candidate: null,
    aliasMap: null,
    descriptor: null,
    module: null,
    snapshotCache: new Map(),
    backendFailureCache: new Map(),
    discoveryPromise: null,
  };

  function nowTs() {
    return Date.now();
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function truncatePreview(value, maxLen = 180) {
    const text = cleanText(value);
    if (!text) return '';
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  }

  function readRecord(value) {
    return value && typeof value === 'object' ? value : null;
  }

  function readString(record, key) {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function readAuthorRole(message) {
    const author = readRecord(message?.author);
    return readString(author || message, 'role');
  }

  function isHiddenMessage(message) {
    const metadata = readRecord(message?.metadata);
    if (!metadata) return false;
    return metadata.is_visually_hidden_from_conversation === true
      || metadata.is_hidden === true
      || metadata.hidden === true;
  }

  function isDisplayableMessage(message, expectedRole) {
    if (!readRecord(message)) return false;
    if (isHiddenMessage(message)) return false;

    const role = readAuthorRole(message);
    if (role && role !== expectedRole) return false;

    const recipient = readString(message, 'recipient');
    if (recipient && recipient !== 'all') return false;

    const channel = readString(message, 'channel');
    if (channel && channel !== 'final') return false;

    return true;
  }

  function isTextContentRecord(record) {
    const contentType = readString(record, 'content_type');
    return !contentType || contentType === 'text' || contentType === 'multimodal_text';
  }

  function isTextPartRecord(record) {
    const contentType = readString(record, 'content_type') || readString(record, 'type');
    return !contentType || contentType === 'text' || contentType === 'output_text';
  }

  function normalizeUrl(value) {
    try {
      return new URL(value, location.href).href;
    } catch {
      return null;
    }
  }

  function collectJsAssets() {
    const urls = [];

    for (const node of document.querySelectorAll('script[src], link[href]')) {
      const url = normalizeUrl(node.getAttribute('src') || node.getAttribute('href'));
      if (url && JS_ASSET_RE.test(url)) urls.push(url);
    }

    for (const entry of performance.getEntriesByType('resource')) {
      const url = normalizeUrl(entry?.name);
      if (url && JS_ASSET_RE.test(url)) urls.push(url);
    }

    return unique(urls);
  }

  function readBridgeCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeBridgeCache(value) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
    } catch {
      // ignore storage failures
    }
  }

  function makeBuildFingerprint(urls) {
    return urls
      .map((url) => url.replace(location.origin, ''))
      .sort()
      .join('|');
  }

  function parseExportAliases(text) {
    const exportToLocal = {};
    const localToExport = {};
    const exportMatch = text.match(/export\s*\{([\s\S]{0,200000})\}\s*;?\s*(?:\/\/# sourceMappingURL=|$)/m);
    if (!exportMatch) return { exportToLocal, localToExport };
    const block = exportMatch[1];
    const pairRe = /\b([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)\b/g;
    let match = null;

    while ((match = pairRe.exec(block))) {
      const localName = match[1];
      const exportName = match[2];
      exportToLocal[exportName] = localName;
      localToExport[localName] = exportName;
    }

    return { exportToLocal, localToExport };
  }

  function extractDescriptor(text, aliasMaps) {
    const anchorNeedle = 'threads:{},clientNewThreadIdToServerIdMapping:{},threadRetainCounts:{}';
    const anchorIndex = text.indexOf(anchorNeedle);
    if (anchorIndex < 0) return null;

    const anchorWindow = text.slice(Math.max(0, anchorIndex - 2400), Math.min(text.length, anchorIndex + 2400));
    const stateGetterMatch = anchorWindow.match(/\b([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.getState\b/);
    if (!stateGetterMatch) return null;

    const [, stateGetterLocal, storeLocal] = stateGetterMatch;
    const descriptor = {
      storeLocal,
      stateGetterLocal,
    };

    const storeExport = aliasMaps.localToExport[storeLocal] || null;
    const stateGetterExport = aliasMaps.localToExport[stateGetterLocal] || null;

    if (storeExport) descriptor.storeExport = storeExport;
    if (stateGetterExport) descriptor.stateGetterExport = stateGetterExport;

    return descriptor.storeExport || descriptor.stateGetterExport ? descriptor : null;
  }

  function scoreAsset(url, text, descriptor) {
    let score = 0;
    if (/_conversation/i.test(url)) score += 20;

    for (const rule of KEYWORDS) {
      rule.pattern.lastIndex = 0;
      let count = 0;
      while (rule.pattern.exec(text)) {
        count += 1;
        if (count >= 6) break;
      }
      if (count > 0) score += rule.score + Math.min(count, 4) * 5;
    }

    if (descriptor?.storeExport) score += 140;
    if (descriptor?.stateGetterExport) score += 80;
    return score;
  }

  async function scanAssets(urls) {
    const results = [];
    for (const url of urls.slice(0, MAX_SCAN)) {
      try {
        const response = await fetch(url, { credentials: 'include' });
        const text = await response.text();
        const aliasMaps = parseExportAliases(text);
        const descriptor = extractDescriptor(text, aliasMaps);
        results.push({
          url,
          score: scoreAsset(url, text, descriptor),
          aliasMap: aliasMaps.exportToLocal,
          descriptor,
        });
      } catch {
        // ignore candidate
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }

  function extractTextFromValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((item) => extractTextFromValue(item))
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }
    if (!value || typeof value !== 'object') return '';

    if (!isTextContentRecord(value)) return '';

    if (Array.isArray(value.parts)) {
      const joined = value.parts
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            if (!isTextPartRecord(part)) return '';
            if (typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
            if (typeof part.markdown === 'string') return part.markdown;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (joined) return joined;
    }

    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.content === 'string') return value.content.trim();
    if (typeof value.markdown === 'string') return value.markdown.trim();
    return '';
  }

  function getMessageId(message) {
    if (!message || typeof message !== 'object') return null;
    return typeof message.id === 'string' ? message.id : null;
  }

  function getMessageContent(message) {
    if (!message || typeof message !== 'object') return '';
    return extractTextFromValue(message.content);
  }

  function getDisplayableMessageContent(message, expectedRole) {
    if (!isDisplayableMessage(message, expectedRole)) return '';
    return getMessageContent(message);
  }

  function getTurnRole(turn) {
    const role = readString(readRecord(turn?.author) || turn, 'role');
    if (role === 'user' || role === 'assistant') return role;
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const messageRole = readAuthorRole(messages[index]);
      if (messageRole === 'user' || messageRole === 'assistant') return messageRole;
    }
    return null;
  }

  function getTurnId(turn) {
    return typeof turn?.id === 'string' && turn.id.trim() ? turn.id.trim() : null;
  }

  function getLastDisplayableMessage(turn, expectedRole) {
    const messages = Array.isArray(turn?.messages) ? turn.messages : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = readRecord(messages[index]);
      if (!message || !isDisplayableMessage(message, expectedRole)) continue;
      if (getMessageId(message) || getDisplayableMessageContent(message, expectedRole)) return message;
    }
    return null;
  }

  function getReactRootCandidate(element) {
    for (const key of Object.keys(element)) {
      if (!key.startsWith('__reactFiber$') && !key.startsWith('__reactProps$')) continue;
      if (element[key]) return element[key];
    }
    return null;
  }

  function findStructuredTurnData(element) {
    let fiber = getReactRootCandidate(element);
    let depth = 0;

    while (fiber && depth < 12) {
      const candidates = [
        fiber.pendingProps,
        fiber.memoizedProps,
        fiber.pendingProps?.value,
        fiber.memoizedProps?.value,
      ].filter(Boolean);

      for (const candidate of candidates) {
        const turn = candidate.turn || candidate.currentTurn || candidate.prevTurn || null;
        const parentPromptMessage = candidate.parentPromptMessage || candidate.lastUserMessage || null;
        if (turn && getTurnRole(turn)) return { turn, parentPromptMessage };
      }

      fiber = fiber.return || null;
      depth += 1;
    }

    return { turn: null, parentPromptMessage: null };
  }

  function collectStructuredTurnRefs() {
    const refs = [];
    const seen = new Set();
    const push = (element) => {
      if (!(element instanceof HTMLElement)) return;
      const { turn, parentPromptMessage } = findStructuredTurnData(element);
      const role = getTurnRole(turn);
      if (!turn || !role) return;
      const id = getTurnId(turn) || `${role}-${refs.length + 1}`;
      const key = `${role}:${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ element, turn, parentPromptMessage });
    };

    document.querySelectorAll('main [data-turn-id-container]').forEach(push);
    if (refs.length > 0) return refs;
    document.querySelectorAll('[data-message-author-role="assistant"][data-message-id]').forEach(push);
    return refs;
  }

  function buildRoundsFromReactTurnContainers() {
    const refs = collectStructuredTurnRefs();
    if (refs.length === 0) return null;

    const rounds = [];
    let pendingUser = null;

    for (const ref of refs) {
      const role = getTurnRole(ref.turn);
      if (role === 'user') {
        const userMessage = getLastDisplayableMessage(ref.turn, 'user');
        const userPrompt = getDisplayableMessageContent(userMessage, 'user');
        pendingUser = {
          turnId: getTurnId(ref.turn),
          userPrompt: userPrompt || `Message ${rounds.length + 1}`,
          userMessageId: getMessageId(userMessage),
        };
        continue;
      }

      if (role !== 'assistant') continue;
      const assistantMessage = getLastDisplayableMessage(ref.turn, 'assistant');
      const assistantContent = getDisplayableMessageContent(assistantMessage, 'assistant');
      const fallbackPrompt = getDisplayableMessageContent(ref.parentPromptMessage, 'user');
      const userPrompt = pendingUser?.userPrompt || fallbackPrompt || `Message ${rounds.length + 1}`;
      rounds.push({
        id: getTurnId(ref.turn) || pendingUser?.turnId || `react-turn-${rounds.length + 1}`,
        position: rounds.length + 1,
        userPrompt,
        assistantContent,
        preview: truncatePreview(userPrompt || assistantContent),
        messageId: getMessageId(assistantMessage),
        userMessageId: pendingUser?.userMessageId || getMessageId(ref.parentPromptMessage),
        assistantMessageId: getMessageId(assistantMessage),
      });
      pendingUser = null;
    }

    return rounds.length > 0 ? rounds : null;
  }

  function getNodeMessage(node) {
    if (!node || typeof node !== 'object') return null;
    return readRecord(node.message);
  }

  function getPayloadCurrentNodeId(payload) {
    return readString(payload, 'current_node')
      || readString(payload, 'currentNode')
      || readString(payload, 'currentLeafId')
      || readString(payload, 'current_leaf_id');
  }

  function buildBranchNodesFromMapping(mapping, currentNodeId) {
    if (!mapping || typeof mapping !== 'object' || !currentNodeId) return [];
    const branch = [];
    const seen = new Set();
    let cursor = currentNodeId;

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const node = mapping[cursor];
      if (!node || typeof node !== 'object') break;
      branch.push(node);
      cursor = typeof node.parent === 'string' && node.parent ? node.parent : null;
    }

    return branch.reverse();
  }

  function buildRoundsFromMessages(nodes) {
    const rounds = [];
    let pendingRound = null;

    for (const node of Array.isArray(nodes) ? nodes : []) {
      const message = getNodeMessage(node);
      if (!message) continue;
      const role = readAuthorRole(message);

      if (role === 'user') {
        if (!isDisplayableMessage(message, 'user')) continue;
        const userPrompt = getDisplayableMessageContent(message, 'user');
        if (!userPrompt && !getMessageId(message)) continue;
        pendingRound = {
          id: typeof node.id === 'string' ? node.id : getMessageId(message) || `user-${rounds.length + 1}`,
          position: rounds.length + 1,
          userPrompt: userPrompt || `Message ${rounds.length + 1}`,
          assistantContent: '',
          preview: truncatePreview(userPrompt),
          messageId: null,
          userMessageId: getMessageId(message),
          assistantMessageId: null,
        };
        rounds.push(pendingRound);
        continue;
      }

      if (role !== 'assistant') continue;
      if (!pendingRound) continue;
      if (!isDisplayableMessage(message, 'assistant')) continue;

      const assistantContent = getDisplayableMessageContent(message, 'assistant');
      if (assistantContent) {
        pendingRound.assistantContent = pendingRound.assistantContent
          ? `${pendingRound.assistantContent}\n\n${assistantContent}`
          : assistantContent;
      }
      pendingRound.assistantMessageId = getMessageId(message);
      pendingRound.messageId = pendingRound.assistantMessageId || pendingRound.messageId || pendingRound.userMessageId;
      pendingRound.preview = truncatePreview(
        pendingRound.userPrompt || pendingRound.assistantContent || `Message ${pendingRound.position}`
      );
    }

    return rounds.filter((round) => round.userPrompt || round.assistantContent);
  }

  function buildRoundsFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    if (Array.isArray(payload.turns)) {
      const rounds = buildRoundsFromTurns(payload.turns);
      return rounds.length > 0 ? rounds : null;
    }

    const mapping = readRecord(payload.mapping);
    const currentNodeId = getPayloadCurrentNodeId(payload);
    const branchNodes = buildBranchNodesFromMapping(mapping, currentNodeId);
    const rounds = buildRoundsFromMessages(branchNodes);
    return rounds.length > 0 ? rounds : null;
  }

  async function fetchConversationPayloadSnapshot(conversationId) {
    const failedAt = bridgeState.backendFailureCache.get(conversationId);
    if (failedAt && nowTs() - failedAt < BACKEND_NEGATIVE_CACHE_TTL_MS) return null;

    try {
      const response = await fetch(`/backend-api/conversation/${encodeURIComponent(conversationId)}`, {
        credentials: 'include',
      });
      if (!response?.ok) {
        if (response?.status === 404 || response?.status === 401 || response?.status === 403) {
          bridgeState.backendFailureCache.set(conversationId, nowTs());
        }
        return null;
      }
      bridgeState.backendFailureCache.delete(conversationId);
      const payload = await response.json();
      const rounds = buildRoundsFromPayload(payload);
      if (!rounds) return null;
      return {
        conversationId,
        buildFingerprint: bridgeState.buildFingerprint,
        rounds,
        source: 'runtime-bridge',
        capturedAt: nowTs(),
      };
    } catch {
      return null;
    }
  }

  function buildRoundsFromTurns(turns) {
    const rounds = [];
    let pendingRound = null;

    for (const turn of Array.isArray(turns) ? turns : []) {
      const role = typeof turn?.role === 'string' ? turn.role : null;
      if (role === 'user') {
        const messages = Array.isArray(turn.messages) ? turn.messages : [];
        const userMessage = messages.find((message) => (
          isDisplayableMessage(message, 'user')
          && (getMessageId(message) || getMessageContent(message))
        ));
        const userPrompt = getDisplayableMessageContent(userMessage, 'user');
        pendingRound = {
          id: typeof turn.id === 'string' ? turn.id : `user-${rounds.length + 1}`,
          position: rounds.length + 1,
          userPrompt: userPrompt || `Message ${rounds.length + 1}`,
          assistantContent: '',
          preview: truncatePreview(userPrompt),
          messageId: null,
          userMessageId: getMessageId(userMessage),
          assistantMessageId: null,
        };
        rounds.push(pendingRound);
        continue;
      }

      if (role !== 'assistant') continue;
      if (!pendingRound) continue;

      const messages = Array.isArray(turn.messages) ? turn.messages : [];
      const assistantContent = messages
        .map((message) => getDisplayableMessageContent(message, 'assistant'))
        .filter(Boolean)
        .join('\n\n')
        .trim();
      const assistantMessage = messages.find((message) => (
        isDisplayableMessage(message, 'assistant')
        && (getMessageId(message) || getMessageContent(message))
      )) || null;

      if (assistantContent) {
        pendingRound.assistantContent = pendingRound.assistantContent
          ? `${pendingRound.assistantContent}\n\n${assistantContent}`
          : assistantContent;
      }
      pendingRound.assistantMessageId = getMessageId(assistantMessage);
      pendingRound.messageId = pendingRound.assistantMessageId || pendingRound.messageId || pendingRound.userMessageId;
      pendingRound.preview = truncatePreview(
        pendingRound.userPrompt || pendingRound.assistantContent || `Message ${pendingRound.position}`
      );
    }

    return rounds.filter((round) => round.userPrompt || round.assistantContent);
  }

  function findTurnsApiExport(mod) {
    for (const [name, value] of Object.entries(mod)) {
      if (isTurnsApi(value)) return name;
    }
    return null;
  }

  function isTurnsApi(value) {
    return Boolean(
      value
      && typeof value === 'object'
      && typeof value.getConversationTurns === 'function'
      && typeof value.getTree === 'function'
      && typeof value.getCurrentLeafId === 'function'
    );
  }

  function isThreadLike(value) {
    if (!value || typeof value !== 'object') return false;
    const tree = value.tree;
    return Boolean(
      tree
      && typeof tree === 'object'
      && (
        typeof tree.getDisplayTurns === 'function'
        || typeof tree.getBranchFromLeaf === 'function'
        || typeof tree.getNodeByIdOrMessageId === 'function'
        || Array.isArray(tree.nodes)
      )
    );
  }

  function getStateThread(state, conversationId) {
    if (!state || typeof state !== 'object' || !state.threads || typeof state.threads !== 'object') return null;
    const normalizedId = state.clientNewThreadIdToServerIdMapping?.[conversationId] || conversationId;
    return state.threads[normalizedId] || state.threads[conversationId] || null;
  }

  function buildRoundsFromDescriptor(mod, descriptor, conversationId) {
    const turnsApiExport = descriptor?.turnsApiExport || findTurnsApiExport(mod);
    if (!turnsApiExport) return null;
    const turnsApi = mod[turnsApiExport];
    if (!isTurnsApi(turnsApi)) return null;

    let state = null;
    if (descriptor?.stateGetterExport && typeof mod[descriptor.stateGetterExport] === 'function') {
      state = mod[descriptor.stateGetterExport]();
    } else if (
      descriptor?.storeExport
      && mod[descriptor.storeExport]
      && typeof mod[descriptor.storeExport].getState === 'function'
    ) {
      state = mod[descriptor.storeExport].getState();
    }

    if (!state) return null;
    const thread = getStateThread(state, conversationId);
    if (!isThreadLike(thread)) return null;

    const turns = turnsApi.getConversationTurns(thread);
    const rounds = buildRoundsFromTurns(turns);
    if (!Array.isArray(rounds) || rounds.length === 0) return null;
    return rounds;
  }

  async function importBridgeCandidate(candidate, conversationId) {
    const mod = await import(candidate.url);
    if (!candidate.descriptor) return null;
    const rounds = buildRoundsFromDescriptor(mod, candidate.descriptor, conversationId);
    if (!rounds) return null;

    return {
      candidateUrl: candidate.url,
      aliasMap: candidate.aliasMap,
      descriptor: candidate.descriptor,
      rounds,
    };
  }

  async function discoverBridge(conversationId) {
    const assets = collectJsAssets();
    const buildFingerprint = makeBuildFingerprint(assets);

    if (
      bridgeState.buildFingerprint === buildFingerprint
      && bridgeState.candidate
      && (bridgeState.aliasMap || bridgeState.descriptor)
    ) {
      return {
        buildFingerprint,
        candidateUrl: bridgeState.candidate,
        aliasMap: bridgeState.aliasMap,
        descriptor: bridgeState.descriptor,
      };
    }

    if (bridgeState.discoveryPromise) return bridgeState.discoveryPromise;

    bridgeState.discoveryPromise = (async () => {
      const cached = readBridgeCache();
      if (
        cached
        && cached.buildFingerprint === buildFingerprint
        && typeof cached.candidateUrl === 'string'
        && (cached.aliasMap || cached.descriptor)
        && assets.includes(cached.candidateUrl)
      ) {
        try {
          const bridged = await importBridgeCandidate({
            url: cached.candidateUrl,
            aliasMap: cached.aliasMap,
            descriptor: cached.descriptor,
          }, conversationId);
          if (bridged) {
            bridgeState.buildFingerprint = buildFingerprint;
            bridgeState.candidate = bridged.candidateUrl;
            bridgeState.aliasMap = bridged.aliasMap;
            bridgeState.descriptor = bridged.descriptor;
            bridgeState.snapshotCache.set(conversationId, {
              conversationId,
              buildFingerprint,
              rounds: bridged.rounds,
              source: 'runtime-bridge',
              capturedAt: nowTs(),
            });
            return {
              buildFingerprint,
              candidateUrl: bridged.candidateUrl,
              aliasMap: bridged.aliasMap,
              descriptor: bridged.descriptor,
            };
          }
        } catch {
          // fall through to live scan
        }
      }

      const scanned = await scanAssets(assets);
      for (const candidate of scanned.slice(0, MAX_BRIDGE_ATTEMPTS)) {
        try {
          const bridged = await importBridgeCandidate(candidate, conversationId);
          if (!bridged) continue;
          bridgeState.buildFingerprint = buildFingerprint;
          bridgeState.candidate = bridged.candidateUrl;
          bridgeState.aliasMap = bridged.aliasMap;
          bridgeState.descriptor = bridged.descriptor;
          writeBridgeCache({
            buildFingerprint,
            candidateUrl: bridged.candidateUrl,
            aliasMap: bridged.aliasMap,
            descriptor: bridged.descriptor,
          });
          bridgeState.snapshotCache.set(conversationId, {
            conversationId,
            buildFingerprint,
            rounds: bridged.rounds,
            source: 'runtime-bridge',
            capturedAt: nowTs(),
          });
          return {
            buildFingerprint,
            candidateUrl: bridged.candidateUrl,
            aliasMap: bridged.aliasMap,
            descriptor: bridged.descriptor,
          };
        } catch {
          // try next candidate
        }
      }
      return null;
    })();

    try {
      return await bridgeState.discoveryPromise;
    } finally {
      bridgeState.discoveryPromise = null;
    }
  }

  async function getSnapshot(conversationId, options = {}) {
    const force = options?.force === true;
    if (!force && bridgeState.snapshotCache.has(conversationId)) {
      return bridgeState.snapshotCache.get(conversationId);
    }

    const payloadSnapshot = await fetchConversationPayloadSnapshot(conversationId);
    if (payloadSnapshot?.rounds?.length) {
      bridgeState.snapshotCache.set(conversationId, payloadSnapshot);
      return payloadSnapshot;
    }

    const reactRounds = buildRoundsFromReactTurnContainers();
    if (reactRounds?.length) {
      const snapshot = {
        conversationId,
        buildFingerprint: bridgeState.buildFingerprint,
        rounds: reactRounds,
        source: 'runtime-bridge',
        capturedAt: nowTs(),
      };
      bridgeState.snapshotCache.set(conversationId, snapshot);
      return snapshot;
    }

    const bridge = await discoverBridge(conversationId);
    if (!bridge?.candidateUrl || (!bridge.aliasMap && !bridge.descriptor)) return null;

    const bridged = await importBridgeCandidate({
      url: bridge.candidateUrl,
      aliasMap: bridge.aliasMap,
      descriptor: bridge.descriptor,
    }, conversationId);
    if (!bridged) return null;

    const snapshot = {
      conversationId,
      buildFingerprint: bridge.buildFingerprint,
      rounds: bridged.rounds,
      source: 'runtime-bridge',
      capturedAt: nowTs(),
    };
    bridgeState.snapshotCache.set(conversationId, snapshot);
    return snapshot;
  }

  window.addEventListener(REQUEST_EVENT, (event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!detail || detail.type !== 'snapshot') return;

    Promise.resolve()
      .then(() => getSnapshot(detail.conversationId, { force: detail.force === true }))
      .then((snapshot) => {
        window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId: detail.requestId,
            ok: Boolean(snapshot),
            snapshot: snapshot || undefined,
            error: snapshot ? undefined : { code: 'BRIDGE_UNAVAILABLE', message: 'ChatGPT runtime bridge unavailable.' },
          },
        }));
      })
      .catch((error) => {
        window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId: detail.requestId,
            ok: false,
            error: {
              code: 'BRIDGE_ERROR',
              message: error?.message || String(error),
            },
          },
        }));
      });
  });

  window[BRIDGE_KEY] = true;
})();
