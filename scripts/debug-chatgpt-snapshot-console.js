(() => {
  const REQUEST_EVENT = 'aimd:chatgpt-conversation-bridge:request';
  const RESPONSE_EVENT = 'aimd:chatgpt-conversation-bridge:response';
  const conversationId = location.pathname.match(/\/c\/([^/?#]+)/)?.[1] ?? null;

  if (!conversationId) {
    console.warn('[AI-MarkDone] This script must run on a ChatGPT conversation page.');
    return;
  }

  const requestId = `aimd-debug-snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const startedAt = Date.now();

  const summarizeRound = (round) => {
    const assistantContent = String(round?.assistantContent ?? '');
    const tokens = assistantContent.match(/[A-Za-z][\w-]*[\s\S]*?/g) ?? [];
    return {
      position: round?.position ?? null,
      assistantLength: assistantContent.length,
      tokenCount: tokens.length,
      tokenKinds: Array.from(new Set(tokens.map((token) => token.match(/^([A-Za-z][\w-]*)/)?.[1]).filter(Boolean))),
      tokenSamples: tokens.slice(0, 8),
    };
  };

  const downloadJson = (payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `aimd-chatgpt-snapshot-${conversationId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const cleanup = () => {
    window.removeEventListener(RESPONSE_EVENT, onResponse);
    window.clearTimeout(timeoutId);
  };

  function onResponse(event) {
    if (!event.detail || event.detail.requestId !== requestId) return;
    cleanup();

    const snapshot = event.detail.snapshot ?? null;
    const report = {
      ok: Boolean(event.detail.ok && snapshot),
      conversationId,
      source: snapshot?.source ?? null,
      capturedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      bridgePresent: Boolean(window.__AIMD_CHATGPT_CONVERSATION_BRIDGE__),
      rounds: Array.isArray(snapshot?.rounds) ? snapshot.rounds.map(summarizeRound) : [],
      snapshot,
    };

    downloadJson(report);
    console.info('[AI-MarkDone] Snapshot debug JSON downloaded.', {
      ok: report.ok,
      source: report.source,
      rounds: report.rounds.length,
    });
  }

  const timeoutId = window.setTimeout(() => {
    cleanup();
    console.warn('[AI-MarkDone] Snapshot bridge did not respond. Open Reader once, then run this script again.');
  }, 8000);

  window.addEventListener(RESPONSE_EVENT, onResponse);
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
    detail: {
      requestId,
      type: 'snapshot',
      conversationId,
      force: true,
    },
  }));
})();
