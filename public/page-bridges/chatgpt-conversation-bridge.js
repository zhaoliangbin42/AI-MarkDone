(() => {
  const BRIDGE_KEY = '__AIMD_CHATGPT_CONVERSATION_BRIDGE__';
  const BRIDGE_VERSION = 7;
  const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
  const MAX_GRAPH_OBJECTS = 256;
  const MAX_GRAPH_DEPTH = 4;
  const MAX_CAPTURED_CONVERSATIONS = 3;
  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';

  const existingBridge = window[BRIDGE_KEY];
  if (existingBridge?.version === BRIDGE_VERSION) return;
  existingBridge?.dispose?.();

  const graphsByConversation = new Map();
  let requestSequence = 0;
  let captureSequence = 0;

  function readRecord(value) {
    return value && typeof value === 'object' ? value : null;
  }

  function readString(record, key) {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function decodeDetail(value) {
    if (typeof value !== 'string') return readRecord(value);
    try {
      return readRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  function encodeDetail(value, asString) {
    return asString ? JSON.stringify(value) : value;
  }

  function getConversationIdFromUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return null;
      const segments = url.pathname.split('/').filter(Boolean);
      for (let index = 0; index < segments.length - 1; index += 1) {
        const marker = segments[index]?.toLowerCase();
        if (marker !== 'c' && marker !== 'conversation') continue;
        let candidate = segments[index + 1] || '';
        try { candidate = decodeURIComponent(candidate); } catch { return null; }
        if (candidate.length >= 8 && candidate.length <= 160 && /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(candidate)) {
          return candidate;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  function getCurrentConversationId() {
    return getConversationIdFromUrl(window.location.href);
  }

  function getPayloadCurrentNodeId(payload) {
    return readString(payload, 'current_node')
      || readString(payload, 'currentNode')
      || readString(payload, 'currentLeafId')
      || readString(payload, 'current_leaf_id');
  }

  function getPayloadConversationId(payload) {
    return readString(payload, 'conversation_id')
      || readString(payload, 'conversationId')
      || readString(payload, 'id');
  }

  function readAuthorRole(message) {
    const author = readRecord(message?.author);
    return readString(author || message, 'role');
  }

  function isHiddenMessage(message) {
    const metadata = readRecord(message?.metadata);
    return Boolean(metadata && (
      metadata.is_visually_hidden_from_conversation === true
      || metadata.is_hidden === true
      || metadata.hidden === true
    ));
  }

  function isDisplayableMessage(message, expectedRole) {
    if (!readRecord(message) || isHiddenMessage(message)) return false;
    const role = readAuthorRole(message);
    if (role && role !== expectedRole) return false;
    const recipient = readString(message, 'recipient');
    if (recipient && recipient !== 'all') return false;
    const channel = readString(message, 'channel');
    if (channel && channel !== 'final') return false;
    return true;
  }

  function extractText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n\n').trim();
    if (!readRecord(value)) return '';
    const contentType = readString(value, 'content_type') || readString(value, 'type');
    if (contentType && !['text', 'multimodal_text', 'output_text'].includes(contentType)) return '';
    if (Array.isArray(value.parts)) {
      const parts = value.parts.map((part) => {
        if (typeof part === 'string') return part;
        if (!readRecord(part)) return '';
        return part.text || part.content || part.markdown || '';
      }).filter(Boolean).join('\n\n').trim();
      if (parts) return parts;
    }
    return String(value.text || value.content || value.markdown || '').trim();
  }

  function messageId(message) {
    return readString(message, 'id');
  }

  function messageText(message) {
    return extractText(message?.content);
  }

  function incompleteAssistant(message) {
    const metadata = readRecord(message?.metadata);
    const status = (readString(message, 'status') || '').toLowerCase();
    return message?.end_turn === false
      || metadata?.is_complete === false
      || ['in_progress', 'pending', 'queued', 'streaming'].includes(status);
  }

  function nodeMessage(node) {
    return readRecord(node?.message);
  }

  function buildBranchNodes(mapping, currentNodeId) {
    if (!readRecord(mapping) || !currentNodeId) return null;
    const branch = [];
    const seen = new Set();
    let cursor = currentNodeId;
    while (cursor) {
      if (seen.has(cursor)) return null;
      seen.add(cursor);
      const node = readRecord(mapping[cursor]);
      if (!node) return null;
      branch.push(node);
      if (node.parent === null) return nodeMessage(node) === null ? branch.reverse() : null;
      if (typeof node.parent !== 'string' || !node.parent) return null;
      cursor = node.parent;
    }
    return null;
  }

  function buildRounds(mapping, currentNodeId) {
    const nodes = buildBranchNodes(mapping, currentNodeId);
    if (!nodes) return null;
    const rounds = [];
    let pending = null;
    for (const node of nodes) {
      const message = nodeMessage(node);
      if (!message) continue;
      const role = readAuthorRole(message);
      if (role === 'user') {
        if (!isDisplayableMessage(message, 'user')) continue;
        const userMessageId = messageId(message);
        const prompt = messageText(message);
        if (!prompt && !userMessageId) continue;
        pending = {
          turnId: readString(node, 'id') || userMessageId || `user-${rounds.length + 1}`,
          userText: prompt || `Message ${rounds.length + 1}`,
          assistantMarkdown: '',
          userMessageId,
          assistantMessageId: null,
          incomplete: false,
        };
        rounds.push(pending);
        continue;
      }
      if (role !== 'assistant' || !pending || !isDisplayableMessage(message, 'assistant')) continue;
      const assistantMessageId = messageId(message) || pending.assistantMessageId;
      pending.assistantMessageId = assistantMessageId;
      if (incompleteAssistant(message)) {
        pending.incomplete = true;
        pending.assistantMarkdown = '';
        continue;
      }
      const content = messageText(message);
      if (content) {
        pending.incomplete = false;
        pending.assistantMarkdown = pending.assistantMarkdown
          ? `${pending.assistantMarkdown}\n\n${content}`
          : content;
      }
    }

    const complete = rounds.filter((round) => (
      round.userText.trim()
      && round.assistantMarkdown.trim()
      && round.assistantMessageId
      && !round.incomplete
    ));
    return complete.map((round, index) => ({
      key: `${round.turnId}:${round.assistantMessageId}`,
      ordinal: index + 1,
      identity: {
        turnId: round.turnId,
        userMessageId: round.userMessageId,
        assistantMessageId: round.assistantMessageId,
      },
      userText: round.userText,
      assistantMarkdown: round.assistantMarkdown,
      assistantProvenance: {
        authority: 'verified-derived',
        fidelity: 'normalized',
        producer: 'chatgpt-markdown-source-adapter',
      },
    }));
  }

  function findGraphPayloads(root) {
    const queue = [{ value: root, depth: 0 }];
    const seen = new Set();
    const matches = [];
    let inspected = 0;
    while (queue.length && inspected < MAX_GRAPH_OBJECTS) {
      const entry = queue.shift();
      const candidate = readRecord(entry?.value);
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      inspected += 1;
      const mapping = readRecord(candidate.mapping);
      const currentNodeId = getPayloadCurrentNodeId(candidate);
      if (mapping && currentNodeId && readRecord(mapping[currentNodeId])) {
        matches.push(candidate);
        continue;
      }
      if ((entry?.depth || 0) >= MAX_GRAPH_DEPTH) continue;
      for (const value of Object.values(candidate)) {
        if (readRecord(value)) queue.push({ value, depth: (entry?.depth || 0) + 1 });
      }
    }
    return matches;
  }

  function mergeMappings(previous, incoming) {
    const merged = Object.assign(Object.create(null), previous || {});
    for (const [nodeId, rawNode] of Object.entries(incoming || {})) {
      const node = readRecord(rawNode);
      if (!node) continue;
      const oldNode = readRecord(merged[nodeId]);
      if (oldNode && oldNode.parent && node.parent === null && node.message) {
        merged[nodeId] = { ...oldNode, ...node, parent: oldNode.parent };
      } else {
        merged[nodeId] = oldNode ? { ...oldNode, ...node } : node;
      }
    }
    return merged;
  }

  function rememberPayload(expectedConversationId, payload, requestId) {
    const declaredId = getPayloadConversationId(payload);
    if (declaredId && declaredId !== expectedConversationId) return false;
    const currentNodeId = getPayloadCurrentNodeId(payload);
    const mapping = readRecord(payload?.mapping);
    if (!currentNodeId || !mapping) return false;

    const previous = graphsByConversation.get(expectedConversationId);
    const completeBranch = buildBranchNodes(mapping, currentNodeId) !== null;
    const newest = !previous || requestId >= previous.requestSequence;
    const mergedMapping = completeBranch && newest
      ? mapping
      : mergeMappings(previous?.mapping, mapping);
    const nextCurrentNodeId = !previous || newest ? currentNodeId : previous.currentNodeId;
    const rounds = buildRounds(mergedMapping, nextCurrentNodeId);
    if (!rounds || rounds.length === 0) return false;

    const captureSequence = ++captureSequenceValue;
    graphsByConversation.set(expectedConversationId, {
      mapping: mergedMapping,
      currentNodeId: nextCurrentNodeId,
      capturedAt: Date.now(),
      captureSequence,
      requestSequence: Math.max(requestId, previous?.requestSequence || 0),
      rounds,
    });
    while (graphsByConversation.size > MAX_CAPTURED_CONVERSATIONS) {
      const oldest = graphsByConversation.keys().next().value;
      if (!oldest) break;
      graphsByConversation.delete(oldest);
    }
    window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
      detail: JSON.stringify({ kind: 'graph', conversationId: expectedConversationId, captureSequence }),
    }));
    return true;
  }

  let captureSequenceValue = 0;

  async function captureResponse(response, requestUrl, expectedConversationId, requestId) {
    if (!response?.ok) return;
    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) return;
    const contentLength = Number(response.headers?.get?.('content-length') || '');
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return;
    try {
      const payloads = findGraphPayloads(await response.clone().json());
      for (const payload of payloads) {
        const declaredId = getPayloadConversationId(payload);
        const urlId = getConversationIdFromUrl(response.url || requestUrl);
        if (!urlId && declaredId !== expectedConversationId) continue;
        if (rememberPayload(expectedConversationId, payload, requestId)) break;
      }
    } catch {
      // The host response remains untouched; unreadable source data is ignored.
    }
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return typeof input?.url === 'string' ? input.url : '';
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  const nativeFetch = window.fetch;
  const observedFetch = typeof nativeFetch === 'function'
    ? function observedFetch(input, ...init) {
      const url = requestUrl(input);
      const method = requestMethod(input, init[0]);
      const result = nativeFetch.call(this, input, ...init);
      const currentId = getCurrentConversationId();
      const urlId = getConversationIdFromUrl(url);
      let sameOrigin = false;
      try { sameOrigin = new URL(url, window.location.href).origin === window.location.origin; } catch {}
      if (method === 'GET' && currentId && sameOrigin && (!urlId || urlId === currentId)) {
        const expectedId = urlId || currentId;
        const requestId = ++requestSequence;
        Promise.resolve(result)
          .then((response) => captureResponse(response, url, expectedId, requestId))
          .catch(() => undefined);
      }
      return result;
    }
    : null;

  function snapshotFor(conversationId) {
    const graph = graphsByConversation.get(conversationId);
    if (!graph) return null;
    return {
      conversationId,
      rounds: graph.rounds,
      coverage: 'complete',
      branchKey: graph.currentNodeId,
      capturedAt: graph.capturedAt,
      captureSequence: graph.captureSequence,
    };
  }

  function dispatchResponse(detail, asString) {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: encodeDetail(detail, asString) }));
  }

  function handleRequest(event) {
    const asString = typeof event.detail === 'string';
    const detail = decodeDetail(event.detail);
    if (!detail?.requestId || !detail?.conversationId) return;
    if (detail.type !== 'peek') {
      dispatchResponse({ requestId: detail.requestId, ok: false, error: { code: 'BRIDGE_UNAVAILABLE', retryable: true } }, asString);
      return;
    }
    const snapshot = snapshotFor(detail.conversationId);
    dispatchResponse(snapshot
      ? { requestId: detail.requestId, ok: true, snapshot }
      : { requestId: detail.requestId, ok: false, error: { code: 'BRIDGE_UNAVAILABLE', retryable: true } }, asString);
  }

  if (observedFetch) {
    window.fetch = observedFetch;
    try {
      Object.defineProperty(observedFetch, 'toString', {
        value: () => nativeFetch.toString(),
        configurable: true,
      });
    } catch {}
  }
  window.addEventListener(REQUEST_EVENT, handleRequest);
  window[BRIDGE_KEY] = {
    version: BRIDGE_VERSION,
    dispose() {
      if (observedFetch && window.fetch === observedFetch) window.fetch = nativeFetch;
      window.removeEventListener(REQUEST_EVENT, handleRequest);
      graphsByConversation.clear();
    },
  };
})();
