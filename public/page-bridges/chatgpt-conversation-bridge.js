(() => {
  const BRIDGE_KEY = '__AIMD_CHATGPT_CONVERSATION_BRIDGE__';
  if (window[BRIDGE_KEY]) return;

  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const CACHE_KEY = 'aimd:chatgpt-conversation-bridge-cache:v3';
  const JS_ASSET_RE = /\/cdn\/assets\/[^"' )]+\.js(?:\?[^"' )]+)?$/i;
  const MAX_SCAN = 18;
  const MAX_BRIDGE_ATTEMPTS = 5;
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
