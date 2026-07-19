(() => {
  const BRIDGE_KEY = '__AIMD_CHATGPT_CONVERSATION_BRIDGE__';
  const BRIDGE_VERSION = 2;
  const existingBridge = window[BRIDGE_KEY];
  if (existingBridge?.version === BRIDGE_VERSION) return;
  existingBridge?.dispose?.();

  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const CAPTURE_EVENT = 'aimd:chatgpt-conversation-bridge:capture';
  const MAX_CAPTURED_CONVERSATIONS = 3;
  const bridgeState = {
    graphsByConversation: new Map(),
    captureSequence: 0,
  };

  function decodeBridgeDetail(detail) {
    if (typeof detail === 'string') {
      try {
        const parsed = JSON.parse(detail);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return detail && typeof detail === 'object' ? detail : null;
  }

  function encodeBridgeResponse(payload, requestWasString) {
    return requestWasString ? JSON.stringify(payload) : payload;
  }

  function nowTs() {
    return Date.now();
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
    return typeof message.id === 'string' && message.id.trim() ? message.id.trim() : null;
  }

  function getMessageContent(message) {
    if (!message || typeof message !== 'object') return '';
    return extractTextFromValue(message.content);
  }

  function getDeepResearchReportMessage(message) {
    const metadata = readRecord(message?.metadata);
    const sdk = readRecord(metadata?.chatgpt_sdk);
    const invokedResource = readRecord(metadata?.invoked_resource);
    const resourceName = readString(sdk, 'resource_name');
    const resourceUri = readString(invokedResource, 'resource_uri');
    const isDeepResearch = resourceName === 'Deep Research App_start'
      || resourceUri === '/connector_openai_deep_research/start';
    if (!isDeepResearch) return null;

    const rawWidgetState = sdk?.widget_state;
    let widgetState = readRecord(rawWidgetState);
    if (!widgetState && typeof rawWidgetState === 'string') {
      try {
        widgetState = readRecord(JSON.parse(rawWidgetState));
      } catch {
        return null;
      }
    }
    if (!widgetState) return null;

    const reportMessage = readRecord(widgetState.report_message);
    if (!reportMessage || readAuthorRole(reportMessage) !== 'assistant') return null;
    const reportMetadata = readRecord(reportMessage.metadata);
    const isComplete = readString(widgetState, 'status') === 'completed'
      || reportMetadata?.is_complete === true
      || readString(reportMessage, 'status') === 'finished_successfully';
    if (!isComplete || !getMessageContent(reportMessage)) return null;
    return reportMessage;
  }

  function getDisplayableMessageContent(message, expectedRole) {
    if (!isDisplayableMessage(message, expectedRole)) return '';
    return getMessageContent(message);
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

  function getPayloadConversationId(payload) {
    return readString(payload, 'conversation_id')
      || readString(payload, 'conversationId')
      || readString(payload, 'id');
  }

  function buildBranchNodesFromMapping(mapping, currentNodeId) {
    if (!mapping || typeof mapping !== 'object' || !currentNodeId) return null;
    const branch = [];
    const seen = new Set();
    let cursor = currentNodeId;

    while (cursor) {
      if (seen.has(cursor)) return null;
      seen.add(cursor);
      const node = mapping[cursor];
      if (!node || typeof node !== 'object') return null;
      branch.push(node);
      // A complete ChatGPT graph terminates at its structural root. A visible
      // message rebased to parent=null is a hydrated window, not full history.
      if (node.parent === null) {
        return getNodeMessage(node) === null ? branch.reverse() : null;
      }
      if (typeof node.parent !== 'string' || !node.parent) return null;
      cursor = node.parent;
    }

    return null;
  }

  function buildRoundsFromMessages(nodes) {
    const rounds = [];
    let pendingRound = null;
    let pendingDeepResearchReport = false;

    for (const node of Array.isArray(nodes) ? nodes : []) {
      const message = getNodeMessage(node);
      if (!message) continue;
      const role = readAuthorRole(message);

      const deepResearchReport = getDeepResearchReportMessage(message);
      if (deepResearchReport && pendingRound) {
        const reportContent = getMessageContent(deepResearchReport);
        const reportMessageId = getMessageId(deepResearchReport);
        pendingRound.assistantContent = reportContent;
        pendingRound.assistantMessageId = reportMessageId;
        pendingRound.messageId = reportMessageId || pendingRound.messageId || pendingRound.userMessageId;
        pendingDeepResearchReport = true;
        pendingRound.preview = truncatePreview(
          pendingRound.userPrompt || reportContent || `Message ${pendingRound.position}`
        );
        continue;
      }

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
        pendingDeepResearchReport = false;
        continue;
      }

      if (role !== 'assistant') continue;
      if (!pendingRound) continue;
      if (!isDisplayableMessage(message, 'assistant')) continue;

      const assistantContent = getDisplayableMessageContent(message, 'assistant');
      if (assistantContent && !pendingDeepResearchReport) {
        pendingRound.assistantContent = pendingRound.assistantContent
          ? `${pendingRound.assistantContent}\n\n${assistantContent}`
          : assistantContent;
      }
      pendingRound.assistantMessageId = getMessageId(message) || pendingRound.assistantMessageId;
      pendingRound.messageId = pendingRound.assistantMessageId || pendingRound.messageId || pendingRound.userMessageId;
      pendingRound.preview = truncatePreview(
        pendingRound.userPrompt || pendingRound.assistantContent || `Message ${pendingRound.position}`
      );
    }

    return rounds.filter((round) => round.userPrompt || round.assistantContent);
  }

  function buildRoundsFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const mapping = readRecord(payload.mapping);
    const currentNodeId = getPayloadCurrentNodeId(payload);
    const branchNodes = buildBranchNodesFromMapping(mapping, currentNodeId);
    if (!branchNodes) return null;
    const rounds = buildRoundsFromMessages(branchNodes);
    return rounds.length > 0 ? rounds : null;
  }

  function getObservedConversationId(value) {
    if (typeof value !== 'string' || !value) return null;
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return null;
      const match = url.pathname.match(/^\/backend-api\/conversation\/([^/]+)\/?$/);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  }

  function getObservedRequestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return typeof input?.url === 'string' ? input.url : '';
  }

  function getObservedRequestMethod(input, init) {
    const method = typeof init?.method === 'string'
      ? init.method
      : typeof input?.method === 'string'
        ? input.method
        : 'GET';
    return method.toUpperCase();
  }

  function mergeObservedMapping(previousMapping, incomingMapping, preferPrevious = false) {
    const merged = Object.assign(Object.create(null), previousMapping || {});
    for (const [nodeId, rawIncomingNode] of Object.entries(incomingMapping)) {
      const incomingNode = readRecord(rawIncomingNode);
      if (!incomingNode) continue;
      const previousNode = readRecord(merged[nodeId]);
      if (preferPrevious && previousNode) {
        const recoveredParent = previousNode.parent === null
          && getNodeMessage(previousNode) !== null
          && typeof incomingNode.parent === 'string'
          && incomingNode.parent
          ? incomingNode.parent
          : previousNode.parent;
        merged[nodeId] = { ...incomingNode, ...previousNode, parent: recoveredParent };
        continue;
      }
      if (
        previousNode
        && typeof previousNode.parent === 'string'
        && previousNode.parent
        && incomingNode.parent === null
        && getNodeMessage(incomingNode) !== null
      ) {
        merged[nodeId] = { ...previousNode, ...incomingNode, parent: previousNode.parent };
      } else {
        merged[nodeId] = previousNode ? { ...previousNode, ...incomingNode } : incomingNode;
      }
    }
    return merged;
  }

  function isNodeAncestor(mapping, ancestorNodeId, nodeId) {
    if (!mapping || !ancestorNodeId || !nodeId || ancestorNodeId === nodeId) return ancestorNodeId === nodeId;
    const seen = new Set();
    let cursor = nodeId;
    while (cursor) {
      if (seen.has(cursor)) return false;
      seen.add(cursor);
      const node = readRecord(mapping[cursor]);
      if (!node || typeof node.parent !== 'string' || !node.parent) return false;
      if (node.parent === ancestorNodeId) return true;
      cursor = node.parent;
    }
    return false;
  }

  function rememberObservedPayload(expectedConversationId, payload, captureSequence) {
    if (!payload || typeof payload !== 'object') return false;
    const conversationId = getPayloadConversationId(payload);
    const currentNodeId = getPayloadCurrentNodeId(payload);
    const mapping = readRecord(payload.mapping);
    if (conversationId !== expectedConversationId || !currentNodeId || !mapping) return false;

    const previous = bridgeState.graphsByConversation.get(conversationId);
    const isCompletePayload = buildBranchNodesFromMapping(mapping, currentNodeId) !== null;
    const isNewestCapture = !previous || captureSequence >= previous.captureSequence;
    const mergedMapping = isCompletePayload && isNewestCapture
      ? mapping
      : mergeObservedMapping(previous?.mapping, mapping, !isNewestCapture);
    const nextCurrentNodeId = !previous
      ? currentNodeId
      : !isNewestCapture
        ? previous.currentNodeId
        : !isCompletePayload && isNodeAncestor(mergedMapping, currentNodeId, previous.currentNodeId)
          ? previous.currentNodeId
          : currentNodeId;
    bridgeState.graphsByConversation.delete(conversationId);
    bridgeState.graphsByConversation.set(conversationId, {
      mapping: mergedMapping,
      currentNodeId: nextCurrentNodeId,
      capturedAt: nowTs(),
      captureSequence: Math.max(captureSequence, previous?.captureSequence || 0),
    });
    while (bridgeState.graphsByConversation.size > MAX_CAPTURED_CONVERSATIONS) {
      const oldestConversationId = bridgeState.graphsByConversation.keys().next().value;
      if (!oldestConversationId) break;
      bridgeState.graphsByConversation.delete(oldestConversationId);
    }

    window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, {
      detail: JSON.stringify({ conversationId }),
    }));
    return true;
  }

  async function captureObservedResponse(response, requestUrl, expectedConversationId, captureSequence) {
    if (!response?.ok) return;
    const conversationId = getObservedConversationId(response.url || requestUrl);
    if (!conversationId || conversationId !== expectedConversationId) return;
    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) return;
    try {
      const payload = await response.clone().json();
      rememberObservedPayload(conversationId, payload, captureSequence);
    } catch {
      // The host response remains untouched; an unreadable clone simply yields no observation.
    }
  }

  function installFetchObserver() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch !== 'function') return () => {};

    const observedFetch = function observedFetch(input, ...init) {
      const requestUrl = getObservedRequestUrl(input);
      const conversationId = getObservedConversationId(requestUrl);
      const result = nativeFetch.call(this, input, ...init);
      if (!conversationId || getObservedRequestMethod(input, init[0]) !== 'GET') return result;
      const captureSequence = ++bridgeState.captureSequence;
      Promise.resolve(result)
        .then((response) => captureObservedResponse(response, requestUrl, conversationId, captureSequence))
        .catch(() => {});
      return result;
    };
    window.fetch = observedFetch;
    return () => {
      if (window.fetch === observedFetch) window.fetch = nativeFetch;
    };
  }

  function getSnapshot(conversationId) {
    const observed = bridgeState.graphsByConversation.get(conversationId);
    if (!observed) return null;
    const payload = {
      conversation_id: conversationId,
      current_node: observed.currentNodeId,
      mapping: observed.mapping,
    };
    const rounds = buildRoundsFromPayload(payload);
    if (!rounds) return null;

    return {
      conversationId,
      buildFingerprint: null,
      rounds,
      source: 'runtime-bridge',
      origin: 'conversation-graph',
      coverage: 'complete',
      branchKey: observed.currentNodeId,
      capturedAt: observed.capturedAt,
    };
  }

  const handleSnapshotRequest = (event) => {
    const rawDetail = event instanceof CustomEvent ? event.detail : null;
    const detail = decodeBridgeDetail(rawDetail);
    if (!detail || detail.type !== 'snapshot') return;
    const requestWasString = typeof rawDetail === 'string';
    const respond = (payload) => {
      window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
        detail: encodeBridgeResponse(payload, requestWasString),
      }));
    };

    Promise.resolve()
      .then(() => getSnapshot(detail.conversationId))
      .then((snapshot) => {
        respond({
          requestId: detail.requestId,
          ok: Boolean(snapshot),
          snapshot: snapshot || undefined,
          error: snapshot ? undefined : { code: 'BRIDGE_UNAVAILABLE', message: 'ChatGPT runtime bridge unavailable.' },
        });
      })
      .catch((error) => {
        respond({
          requestId: detail.requestId,
          ok: false,
          error: {
            code: 'BRIDGE_ERROR',
            message: error?.message || String(error),
          },
        });
      });
  };

  const restoreFetch = installFetchObserver();
  window.addEventListener(REQUEST_EVENT, handleSnapshotRequest);
  window[BRIDGE_KEY] = {
    version: BRIDGE_VERSION,
    dispose() {
      window.removeEventListener(REQUEST_EVENT, handleSnapshotRequest);
      restoreFetch();
      bridgeState.graphsByConversation.clear();
    },
  };
})();
