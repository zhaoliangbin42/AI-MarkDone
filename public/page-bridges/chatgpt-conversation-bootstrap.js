(() => {
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
  if (!runtime?.getURL) return;

  const script = document.createElement('script');
  script.src = runtime.getURL('page-bridges/chatgpt-conversation-bridge.js');
  script.async = false;
  script.addEventListener('load', () => script.remove(), { once: true });
  script.addEventListener('error', () => {
    script.remove();
    try {
      window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:bootstrap-error'));
    } catch {
      // Best-effort signal; the content runtime treats a missing signal as an unknown bridge.
    }
  }, { once: true });
  (document.head || document.documentElement).appendChild(script);
})();
