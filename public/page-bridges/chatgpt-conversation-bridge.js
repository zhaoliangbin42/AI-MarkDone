(() => {
  const BRIDGE_KEY = '__AIMD_CHATGPT_CONVERSATION_BRIDGE__';
  if (window[BRIDGE_KEY]) return;

  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const CACHE_KEY = 'aimd:chatgpt-conversation-bridge-cache:v1';
  const JS_ASSET_RE = /\/cdn\/assets\/[^"' )]+\.js(?:\?[^"' )]+)?$/i;
  const SYMBOLS = ['nS', 'eS', 'Yx', 'Lx', 'Rx', 'Y3', 'X3', 'qx'];
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
    const map = {};
    const exportMatch = text.match(/export\s*\{([\s\S]{0,200000})\}\s*;?\s*(?:\/\/# sourceMappingURL=|$)/m);
    if (!exportMatch) return map;
    const block = exportMatch[1];

    for (const symbol of SYMBOLS) {
      const match = block.match(new RegExp(`\\b${symbol}\\s+as\\s+([A-Za-z0-9_$]+)\\b`));
      if (match?.[1]) map[symbol] = match[1];
    }

    return map;
  }

  function scoreAsset(url, text, aliasMap) {
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

    if (aliasMap.Lx && aliasMap.Yx) score += 120;
    if (aliasMap.nS && aliasMap.eS) score += 70;
    return score;
  }

  async function scanAssets(urls) {
    const results = [];
    for (const url of urls.slice(0, MAX_SCAN)) {
      try {
        const response = await fetch(url, { credentials: 'include' });
        const text = await response.text();
        const aliasMap = parseExportAliases(text);
        results.push({
          url,
          score: scoreAsset(url, text, aliasMap),
          aliasMap,
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

    if (Array.isArray(value.parts)) {
      const joined = value.parts
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
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

  function buildRoundsFromTurns(turns) {
    const rounds = [];
    let pendingRound = null;

    for (const turn of Array.isArray(turns) ? turns : []) {
      const role = typeof turn?.role === 'string' ? turn.role : null;
      if (role === 'user') {
        const messages = Array.isArray(turn.messages) ? turn.messages : [];
        const userMessage = messages.find((message) => getMessageId(message) || getMessageContent(message));
        const userPrompt = getMessageContent(userMessage);
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
        .map((message) => getMessageContent(message))
        .filter(Boolean)
        .join('\n\n')
        .trim();
      const assistantMessage = messages.find((message) => getMessageId(message) || getMessageContent(message)) || null;

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

  async function importBridgeCandidate(candidate, conversationId) {
    if (!candidate?.aliasMap?.Lx || !candidate?.aliasMap?.Yx) return null;
    const mod = await import(candidate.url);
    const threadGetter = mod[candidate.aliasMap.Lx];
    const turnsApi = mod[candidate.aliasMap.Yx];
    if (typeof threadGetter !== 'function' || !turnsApi || typeof turnsApi.getConversationTurns !== 'function') return null;

    const thread = threadGetter(conversationId);
    if (!thread) return null;

    const turns = turnsApi.getConversationTurns(thread);
    const rounds = buildRoundsFromTurns(turns);
    if (!Array.isArray(rounds) || rounds.length === 0) return null;

    return {
      candidateUrl: candidate.url,
      aliasMap: candidate.aliasMap,
      rounds,
    };
  }

  async function discoverBridge(conversationId) {
    const assets = collectJsAssets();
    const buildFingerprint = makeBuildFingerprint(assets);

    if (
      bridgeState.buildFingerprint === buildFingerprint
      && bridgeState.candidate
      && bridgeState.aliasMap
    ) {
      return {
        buildFingerprint,
        candidateUrl: bridgeState.candidate,
        aliasMap: bridgeState.aliasMap,
      };
    }

    if (bridgeState.discoveryPromise) return bridgeState.discoveryPromise;

    bridgeState.discoveryPromise = (async () => {
      const cached = readBridgeCache();
      if (
        cached
        && cached.buildFingerprint === buildFingerprint
        && typeof cached.candidateUrl === 'string'
        && cached.aliasMap
        && assets.includes(cached.candidateUrl)
      ) {
        try {
          const bridged = await importBridgeCandidate({
            url: cached.candidateUrl,
            aliasMap: cached.aliasMap,
          }, conversationId);
          if (bridged) {
            bridgeState.buildFingerprint = buildFingerprint;
            bridgeState.candidate = bridged.candidateUrl;
            bridgeState.aliasMap = bridged.aliasMap;
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
          writeBridgeCache({
            buildFingerprint,
            candidateUrl: bridged.candidateUrl,
            aliasMap: bridged.aliasMap,
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
    if (!bridge?.candidateUrl || !bridge.aliasMap) return null;

    const bridged = await importBridgeCandidate({
      url: bridge.candidateUrl,
      aliasMap: bridge.aliasMap,
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
