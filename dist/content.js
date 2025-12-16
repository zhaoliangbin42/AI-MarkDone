const scriptRel = 'modulepreload';const assetsURL = function(dep) { return "/"+dep };const seen = {};const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (true && deps && deps.length > 0) {
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};

class SiteAdapter {
}

var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
  return LogLevel2;
})(LogLevel || {});
class Logger {
  level = 1 /* INFO */;
  prefix = "[AICopyEnhance]";
  setLevel(level) {
    this.level = level;
  }
  debug(...args) {
    if (this.level <= 0 /* DEBUG */) {
      console.debug(this.prefix, ...args);
    }
  }
  info(...args) {
    if (this.level <= 1 /* INFO */) {
      console.info(this.prefix, ...args);
    }
  }
  warn(...args) {
    if (this.level <= 2 /* WARN */) {
      console.warn(this.prefix, ...args);
    }
  }
  error(...args) {
    if (this.level <= 3 /* ERROR */) {
      console.error(this.prefix, ...args);
    }
  }
}
const logger$1 = new Logger();

class ChatGPTAdapter extends SiteAdapter {
  matches(url) {
    return url.includes("chatgpt.com") || url.includes("chat.openai.com");
  }
  getMessageSelector() {
    return 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
  }
  getMessageContentSelector() {
    return ".markdown.prose, .markdown.prose.dark\\:prose-invert";
  }
  getActionBarSelector() {
    return "div.z-0.flex.min-h-\\[46px\\].justify-start";
  }
  extractMessageHTML(element) {
    if (element.tagName.toLowerCase() === "article") {
      return element.innerHTML;
    }
    const contentElement = element.querySelector(this.getMessageContentSelector());
    if (!contentElement) {
      return element.innerHTML;
    }
    return contentElement.innerHTML;
  }
  isStreamingMessage(_element) {
    const stopButton = document.querySelector('button[aria-label*="Stop"]');
    if (!stopButton) {
      return false;
    }
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messages.length === 0) {
      return false;
    }
    const lastMessage = messages[messages.length - 1];
    const isArticle = lastMessage.tagName.toLowerCase() === "article";
    if (isArticle) {
      const hasActionBar = lastMessage.querySelector("div.z-0") !== null;
      return !hasActionBar;
    } else {
      const hasStreamingCursor = lastMessage.querySelector(".result-streaming") !== null || lastMessage.querySelector('[data-streaming="true"]') !== null;
      const textLength = lastMessage.textContent?.trim().length || 0;
      const isVeryShort = textLength < 10;
      return hasStreamingCursor || isVeryShort;
    }
  }
  getMessageId(element) {
    return element.getAttribute("data-message-id");
  }
  getObserverContainer() {
    const selectors = [
      "main",
      'main [role="presentation"]',
      "main > div",
      "#__next",
      "body"
    ];
    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container instanceof HTMLElement) {
        logger$1.debug(`Observer container found: ${selector}`);
        return container;
      }
    }
    logger$1.warn("No suitable observer container found");
    return null;
  }
  /**
   * Check if message is a Deep Research result
   */
  isDeepResearchMessage(element) {
    return element.querySelector(".deep-research-result") !== null || element.querySelector('[data-testid="conversation-turn"] article') !== null;
  }
  /**
   * Get all math elements in the message
   */
  getMathElements(element) {
    return element.querySelectorAll(".katex.formula-interactive, .katex-display .katex");
  }
  /**
   * Get all code blocks in the message
   */
  getCodeBlocks(element) {
    return element.querySelectorAll("pre code");
  }
  /**
   * Get all tables in the message
   */
  getTables(element) {
    return element.querySelectorAll("table");
  }
}

class GeminiAdapter extends SiteAdapter {
  matches(url) {
    return url.includes("gemini.google.com");
  }
  getMessageSelector() {
    return "model-response";
  }
  getMessageContentSelector() {
    return ".model-response-text";
  }
  getActionBarSelector() {
    return ".response-container-footer";
  }
  extractMessageHTML(element) {
    const contentElement = element.querySelector(this.getMessageContentSelector());
    if (contentElement) {
      return contentElement.innerHTML;
    }
    return element.innerHTML;
  }
  isStreamingMessage(element) {
    const footer = element.querySelector(".response-footer");
    if (!footer) {
      return true;
    }
    return !footer.classList.contains("complete");
  }
  getMessageId(element) {
    const draftElement = element.querySelector("[data-test-draft-id]");
    if (draftElement) {
      return draftElement.getAttribute("data-test-draft-id");
    }
    const allMessages = document.querySelectorAll(this.getMessageSelector());
    const index = Array.from(allMessages).indexOf(element);
    return index >= 0 ? `gemini-message-${index}` : null;
  }
  getObserverContainer() {
    const selectors = [
      "main",
      '[data-test-id="chat-history-container"]',
      ".chat-history",
      "body"
    ];
    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container instanceof HTMLElement) {
        logger$1.debug(`Observer container found: ${selector}`);
        return container;
      }
    }
    logger$1.warn("No observer container found for Gemini, falling back to body");
    return document.body;
  }
  /**
   * Get all math elements in the message
   * Gemini uses KaTeX just like ChatGPT
   */
  getMathElements(element) {
    return element.querySelectorAll(".katex");
  }
  /**
   * Get all code blocks in the message
   * Gemini uses custom <code-block> element
   */
  getCodeBlocks(element) {
    return element.querySelectorAll("code-block code, pre code");
  }
  /**
   * Get all tables in the message
   */
  getTables(element) {
    return element.querySelectorAll("table");
  }
  /**
   * Gemini-specific: Check if this is a Gemini page
   * Used to apply platform-specific styling
   */
  isGemini() {
    return true;
  }
}

class AdapterRegistry {
  adapters = [];
  currentAdapter = null;
  constructor() {
    this.register(new ChatGPTAdapter());
    this.register(new GeminiAdapter());
  }
  /**
   * Register a new adapter
   */
  register(adapter) {
    this.adapters.push(adapter);
  }
  /**
   * Get the appropriate adapter for current URL
   */
  getAdapter(url = window.location.href) {
    if (this.currentAdapter && this.currentAdapter.matches(url)) {
      return this.currentAdapter;
    }
    for (const adapter of this.adapters) {
      if (adapter.matches(url)) {
        this.currentAdapter = adapter;
        return adapter;
      }
    }
    return null;
  }
  /**
   * Check if current page is supported
   */
  isSupported(url = window.location.href) {
    return this.getAdapter(url) !== null;
  }
}
const adapterRegistry = new AdapterRegistry();

function debounce(func, wait) {
  let timeout = null;
  return function(...args) {
    const context = this;
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackError) {
      console.error("Fallback copy failed:", fallbackError);
      return false;
    }
  }
}
function safeQuerySelector(parent, selector) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.error("Invalid selector:", selector, error);
    return null;
  }
}

const DEBOUNCE_DELAYS = {
  MUTATION: 200};
class MessageObserver {
  observer = null;
  copyButtonObserver = null;
  intersectionObserver = null;
  adapter;
  processedMessages = /* @__PURE__ */ new Set();
  onMessageDetected;
  periodicCheckInterval = null;
  lastCopyButtonCount = 0;
  constructor(adapter, onMessageDetected) {
    this.adapter = adapter;
    this.onMessageDetected = onMessageDetected;
    this.handleMutations = debounce(this.handleMutations.bind(this), DEBOUNCE_DELAYS.MUTATION);
  }
  /**
   * Start observing the DOM
   */
  start() {
    this.startWithRetry(0);
  }
  /**
   * Start with retry mechanism for delayed container loading
   */
  startWithRetry(attempt) {
    const container = this.adapter.getObserverContainer();
    if (!container) {
      if (attempt < 10) {
        logger$1.debug(`Observer container not found, retrying (${attempt + 1}/10)...`);
        setTimeout(() => this.startWithRetry(attempt + 1), 500);
        return;
      } else {
        logger$1.warn("Observer container not found after 10 attempts");
        return;
      }
    }
    logger$1.info("Starting message observer (dual strategy: MutationObserver + Copy Button monitoring)");
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: false
      // Performance optimization
    });
    this.setupCopyButtonMonitoring();
    this.processExistingMessages();
    setTimeout(() => {
      logger$1.debug("Re-processing messages after delay");
      this.processExistingMessages();
    }, 1e3);
    setTimeout(() => {
      logger$1.debug("Re-processing messages after extended delay");
      this.processExistingMessages();
    }, 3e3);
    this.setupIntersectionObserver();
    this.periodicCheckInterval = window.setInterval(() => {
      this.processExistingMessages();
    }, 2e3);
    logger$1.debug("Setup complete: MutationObserver + Copy Button Monitor + IntersectionObserver + Periodic check");
  }
  /**
   * Setup copy button monitoring for streaming completion detection
   * This is more reliable than waiting for action bars
   */
  setupCopyButtonMonitoring() {
    this.lastCopyButtonCount = document.querySelectorAll('button[aria-label="Copy"]').length;
    logger$1.debug(`Initial copy button count: ${this.lastCopyButtonCount}`);
    const handleCopyButtonChange = debounce(() => {
      const currentCount = document.querySelectorAll('button[aria-label="Copy"]').length;
      if (currentCount > this.lastCopyButtonCount) {
        logger$1.debug(`Copy button added: ${this.lastCopyButtonCount} → ${currentCount}`);
        this.lastCopyButtonCount = currentCount;
        this.processLatestMessage();
      }
    }, 300);
    this.copyButtonObserver = new MutationObserver((mutations) => {
      let foundNewButton = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches('button[aria-label="Copy"]')) {
              foundNewButton = true;
              break;
            }
            if (node.querySelector('button[aria-label="Copy"]')) {
              foundNewButton = true;
              break;
            }
          }
        }
        if (foundNewButton) break;
      }
      if (foundNewButton) {
        handleCopyButtonChange();
      }
    });
    this.copyButtonObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
    logger$1.debug("Copy button monitoring active");
  }
  /**
   * Process only the latest message (for streaming completion)
   */
  processLatestMessage() {
    const articles = document.querySelectorAll("article");
    if (articles.length === 0) return;
    const lastArticle = articles[articles.length - 1];
    const messageId = this.adapter.getMessageId(lastArticle);
    if (!messageId) {
      logger$1.debug("Latest article has no ID, processing anyway");
      this.onMessageDetected(lastArticle);
      return;
    }
    if (this.processedMessages.has(messageId)) {
      const hasToolbar = lastArticle.querySelector(".aicopy-toolbar-container");
      if (!hasToolbar) {
        logger$1.debug("Latest message processed but toolbar missing, retrying:", messageId);
        this.onMessageDetected(lastArticle);
      }
      return;
    }
    this.processedMessages.add(messageId);
    logger$1.debug("New streaming message completed:", messageId);
    this.onMessageDetected(lastArticle);
  }
  /**
   * Setup IntersectionObserver to detect messages entering viewport
   */
  setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          const messageId = this.adapter.getMessageId(entry.target);
          if (messageId && !this.processedMessages.has(messageId)) {
            logger$1.debug("Message entered viewport:", messageId);
            this.processedMessages.add(messageId);
            this.onMessageDetected(entry.target);
          }
        }
      });
    }, {
      root: null,
      rootMargin: "50px",
      threshold: 0.1
    });
    const messages = document.querySelectorAll(this.adapter.getMessageSelector());
    messages.forEach((msg) => {
      if (msg instanceof HTMLElement) {
        this.intersectionObserver?.observe(msg);
      }
    });
  }
  /**
   * Stop observing
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.copyButtonObserver) {
      this.copyButtonObserver.disconnect();
      this.copyButtonObserver = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.periodicCheckInterval) {
      window.clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }
    logger$1.info("Message observer stopped");
  }
  /**
   * Handle DOM mutations
   */
  handleMutations(mutations) {
    logger$1.debug("Processing mutations:", mutations.length);
    const isStreaming = this.adapter.isStreamingMessage(document.body);
    if (isStreaming) {
      logger$1.debug("Streaming in progress, delaying processing");
      return;
    }
    this.processExistingMessages();
  }
  /**
   * Process all existing messages in the DOM
   */
  processExistingMessages() {
    const messages = document.querySelectorAll(this.adapter.getMessageSelector());
    logger$1.debug(`Found ${messages.length} messages (${this.processedMessages.size} already processed)`);
    let newMessages = 0;
    messages.forEach((message) => {
      if (!(message instanceof HTMLElement)) return;
      const messageId = this.adapter.getMessageId(message);
      if (!messageId) {
        const fallbackId = `msg-${Array.from(messages).indexOf(message)}`;
        logger$1.debug("Message has no ID, using fallback:", fallbackId);
        if (this.processedMessages.has(fallbackId)) {
          return;
        }
        this.processedMessages.add(fallbackId);
        newMessages++;
        this.onMessageDetected(message);
        return;
      }
      const isArticle = message.tagName.toLowerCase() === "article";
      if (isArticle) {
        const hasActionBar = message.querySelector("div.z-0") !== null;
        if (!hasActionBar) {
          logger$1.debug("Message still streaming (no action bar), skipping:", messageId);
          return;
        }
      }
      if (this.processedMessages.has(messageId)) {
        const hasToolbar = message.querySelector(".aicopy-toolbar-container");
        if (!hasToolbar) {
          logger$1.debug("Message processed but toolbar missing, retrying injection:", messageId);
          this.onMessageDetected(message);
        }
        return;
      }
      this.processedMessages.add(messageId);
      newMessages++;
      logger$1.debug("New message detected:", messageId);
      this.onMessageDetected(message);
      if (this.intersectionObserver) {
        this.intersectionObserver.observe(message);
      }
    });
    if (newMessages > 0) {
      logger$1.info(`Processed ${newMessages} new message(s)`);
    }
  }
  /**
   * Reset processed messages (useful for testing)
   */
  reset() {
    this.processedMessages.clear();
    this.lastCopyButtonCount = 0;
    logger$1.info("Observer reset");
  }
}

class ToolbarInjector {
  adapter;
  injectedElements = /* @__PURE__ */ new WeakSet();
  pendingObservers = /* @__PURE__ */ new WeakMap();
  constructor(adapter) {
    this.adapter = adapter;
  }
  /**
   * Inject toolbar into a message element
   */
  inject(messageElement, toolbar) {
    if (this.injectedElements.has(messageElement)) {
      logger$1.debug("Toolbar already injected for this message");
      return false;
    }
    if (messageElement.querySelector(".aicopy-toolbar-container")) {
      logger$1.debug("Toolbar container already exists");
      return false;
    }
    const isArticle = messageElement.tagName.toLowerCase() === "article";
    const isModelResponse = messageElement.tagName.toLowerCase() === "model-response";
    const selector = this.adapter.getActionBarSelector();
    if (isArticle) {
      return this.injectArticle(messageElement, toolbar, selector);
    } else if (isModelResponse) {
      return this.injectGemini(messageElement, toolbar, selector);
    } else {
      return this.injectNonArticle(messageElement, toolbar, selector);
    }
  }
  /**
   * Inject for article messages with smart waiting
   */
  injectArticle(article, toolbar, selector) {
    const actionBar = safeQuerySelector(article, selector);
    if (actionBar) {
      logger$1.debug("Action bar found, injecting toolbar");
      return this.doInject(article, actionBar, toolbar);
    } else {
      logger$1.debug("Action bar not found, waiting for it to appear...");
      this.waitForActionBar(article, toolbar, selector);
      return false;
    }
  }
  /**
   * Inject for Gemini model-response elements
   * Gemini's structure: action bar is INSIDE model-response
   */
  injectGemini(modelResponse, toolbar, selector) {
    const actionBar = safeQuerySelector(modelResponse, selector);
    if (actionBar) {
      logger$1.debug("Gemini action bar found, injecting toolbar");
      return this.doInject(modelResponse, actionBar, toolbar, true);
    } else {
      logger$1.debug("Gemini action bar not found, waiting for it to appear...");
      this.waitForActionBar(modelResponse, toolbar, selector, true);
      return false;
    }
  }
  /**
   * Wait for action bar to appear using interval checking
   */
  waitForActionBar(article, toolbar, selector, isGemini = false) {
    const existingTimer = this.pendingObservers.get(article);
    if (existingTimer) {
      window.clearInterval(existingTimer);
    }
    let attempts = 0;
    const maxAttempts = 15;
    const checkInterval = window.setInterval(() => {
      attempts++;
      const actionBar = safeQuerySelector(article, selector);
      if (actionBar) {
        window.clearInterval(checkInterval);
        this.pendingObservers.delete(article);
        logger$1.debug(`Action bar appeared after ${attempts} seconds`);
        this.doInject(article, actionBar, toolbar, isGemini);
      } else if (attempts >= maxAttempts) {
        window.clearInterval(checkInterval);
        this.pendingObservers.delete(article);
        logger$1.warn("Action bar did not appear after 15 seconds");
      }
    }, 1e3);
    this.pendingObservers.set(article, checkInterval);
  }
  /**
   * Inject for non-article messages
   */
  injectNonArticle(messageElement, toolbar, selector) {
    const parent = messageElement.parentElement;
    if (!parent) {
      logger$1.warn("Message element has no parent");
      return false;
    }
    const actionBarContainer = parent.nextElementSibling;
    if (!actionBarContainer) {
      logger$1.warn("No next sibling found after message parent");
      return false;
    }
    const actionBar = actionBarContainer.matches(selector) ? actionBarContainer : safeQuerySelector(actionBarContainer, selector);
    if (!actionBar) {
      logger$1.warn("Action bar not found in expected location");
      return false;
    }
    return this.doInject(messageElement, actionBar, toolbar);
  }
  /**
   * Perform actual toolbar injection
   */
  doInject(messageElement, actionBar, toolbar, isGemini = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "aicopy-toolbar-container";
    if (isGemini) {
      wrapper.style.cssText = "margin-bottom: 8px; padding-left: 60px;";
    } else {
      wrapper.style.cssText = "margin-bottom: 8px;";
    }
    wrapper.appendChild(toolbar);
    actionBar.parentElement?.insertBefore(wrapper, actionBar);
    this.injectedElements.add(messageElement);
    logger$1.debug("Toolbar injected successfully");
    return true;
  }
  /**
   * Remove toolbar from a message element
   */
  remove(messageElement) {
    const toolbar = messageElement.querySelector(".aicopy-toolbar-container");
    if (toolbar) {
      toolbar.remove();
      this.injectedElements.delete(messageElement);
      logger$1.debug("Toolbar removed");
      return true;
    }
    return false;
  }
  /**
   * Check if toolbar is already injected
   */
  isInjected(messageElement) {
    return this.injectedElements.has(messageElement);
  }
}

const toolbarStyles = `
:host {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin-bottom: 8px;
  
  /* Light mode theme colors */
  --gradient-solid-from: #ad5389;
  --gradient-solid-to: #3c1053;
  --gradient-light-from: rgba(173, 83, 137, 0.12);
  --gradient-light-to: rgba(60, 16, 83, 0.12);
  --theme-color: #ad5389;
  --text-secondary: #6b7280;
  --bg-secondary: rgba(0, 0, 0, 0.05);
}

/* Dark mode theme colors */
@media (prefers-color-scheme: dark) {
  :host {
    --gradient-solid-from: #e091d0;
    --gradient-solid-to: #c084b3;
    --gradient-light-from: rgba(224, 145, 208, 0.25);
    --gradient-light-to: rgba(192, 132, 179, 0.25);
    --theme-color: #e091d0;
    --text-secondary: #9ca3af;
    --bg-secondary: rgba(255, 255, 255, 0.1);
  }
}

.aicopy-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.aicopy-button-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aicopy-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.aicopy-button:hover {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  color: var(--theme-color);
}

.aicopy-button:active {
  transform: scale(0.95);
}

.aicopy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Bookmarked state - highlighted with theme color */
.aicopy-button.bookmarked {
  background: linear-gradient(135deg, var(--gradient-light-from), var(--gradient-light-to));
  color: var(--theme-color);
}

.aicopy-button.bookmarked:hover {
  background: linear-gradient(135deg, var(--gradient-solid-from), var(--gradient-solid-to));
  color: white;
}

/* Tooltip on hover */
.aicopy-button::after {
  content: attr(aria-label);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
}

.aicopy-button::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-2px);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.85);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
}

.aicopy-button:hover::after,
.aicopy-button:hover::before {
  opacity: 1;
}

/* Click feedback tooltip */
.aicopy-button-feedback {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 6px 10px;
  background: var(--theme-color);
  color: white;
  font-size: 12px;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  z-index: 1001;
  animation: fadeInOut 1.5s ease;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  20% { opacity: 1; transform: translateX(-50%) translateY(-12px); }
  80% { opacity: 1; transform: translateX(-50%) translateY(-12px); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-16px); }
}

.aicopy-icon {
  width: 20px;
  height: 20px;
  display: block;
}

/* Word count stats - right aligned */
.aicopy-stats {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  text-align: right;
  cursor: text;
}

/* Light mode colors */
:host {
  --text-secondary: #6b7280;
  --bg-secondary: rgba(0, 0, 0, 0.05);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :host {
    --text-secondary: #9ca3af;
    --bg-secondary: rgba(255, 255, 255, 0.1);
  }
}
`;

class WordCounter {
  /**
   * Count words in Markdown text
   */
  count(markdown) {
    const excluded = {
      codeBlocks: 0,
      mathFormulas: 0
    };
    let cleaned = markdown.replace(/```[\s\S]*?```/g, () => {
      excluded.codeBlocks++;
      return "";
    });
    cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, () => {
      excluded.mathFormulas++;
      return "";
    });
    cleaned = cleaned.replace(/\$[^\$\n]+\$/g, () => {
      excluded.mathFormulas++;
      return "";
    });
    cleaned = cleaned.replace(/`[^`]+`/g, "");
    const cjkPattern = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
    const cjkMatches = cleaned.match(cjkPattern) || [];
    const cjk = cjkMatches.length;
    const latinText = cleaned.replace(cjkPattern, " ");
    const latinWords = latinText.split(/\s+/).filter((word) => {
      const cleanWord = word.replace(/[^\w]/g, "");
      return cleanWord.length > 0;
    });
    const latin = latinWords.length;
    const latinChars = latinWords.reduce((sum, word) => {
      const cleanWord = word.replace(/[^\w]/g, "");
      return sum + cleanWord.length;
    }, 0);
    return {
      words: cjk + latin,
      // CJK: 1 char = 1 word, Latin: 1 word = 1 word
      chars: cjk * 2 + latinChars,
      // CJK: 1 char = 2 chars, Latin: actual length
      cjk,
      latin,
      excluded
    };
  }
  /**
   * Format count result as human-readable string
   */
  format(result) {
    if (result.words === 0 && result.chars === 0) {
      return "No content";
    }
    return `${result.words} Words / ${result.chars} Chars`;
  }
  /**
   * Count words in HTML element (will parse to Markdown first)
   */
  countHTML(html) {
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    return this.count(text);
  }
}

class Toolbar {
  shadowRoot;
  container;
  callbacks;
  wordCounter;
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.wordCounter = new WordCounter();
    this.container = document.createElement("div");
    this.container.className = "aicopy-toolbar-container";
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    const styleElement = document.createElement("style");
    styleElement.textContent = toolbarStyles;
    this.shadowRoot.appendChild(styleElement);
    this.createUI();
  }
  /**
   * Create toolbar UI
   */
  createUI() {
    const wrapper = document.createElement("div");
    wrapper.className = "aicopy-toolbar";
    const bookmarkBtn = this.createIconButton(
      "bookmark-btn",
      this.getBookmarkIcon(),
      "Bookmark",
      () => this.handleBookmark()
    );
    const copyBtn = this.createIconButton(
      "copy-md-btn",
      this.getClipboardIcon(),
      "Copy Markdown",
      () => this.handleCopyMarkdown()
    );
    const sourceBtn = this.createIconButton(
      "source-btn",
      this.getCodeIcon(),
      "View Source",
      () => this.handleViewSource()
    );
    const reRenderBtn = this.createIconButton(
      "re-render-btn",
      this.getEyeIcon(),
      "Preview Enhance",
      () => this.handleReRender()
    );
    const stats = document.createElement("span");
    stats.className = "aicopy-stats";
    stats.id = "word-stats";
    stats.textContent = "Loading...";
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "aicopy-button-group";
    buttonGroup.appendChild(bookmarkBtn);
    buttonGroup.appendChild(copyBtn);
    buttonGroup.appendChild(sourceBtn);
    buttonGroup.appendChild(reRenderBtn);
    wrapper.appendChild(buttonGroup);
    wrapper.appendChild(stats);
    this.shadowRoot.appendChild(wrapper);
    this.initWordCountWithRetry();
  }
  /**
   * Initialize word count with retry mechanism
   */
  async initWordCountWithRetry() {
    const maxRetries = 10;
    let attempt = 0;
    await new Promise((resolve) => setTimeout(resolve, 500));
    while (attempt < maxRetries) {
      try {
        const markdown = await this.callbacks.onCopyMarkdown();
        if (markdown && markdown.trim().length > 0) {
          const stats2 = this.shadowRoot.querySelector("#word-stats");
          if (stats2) {
            const result = this.wordCounter.count(markdown);
            const formatted = this.wordCounter.format(result);
            if (formatted !== "No content") {
              stats2.textContent = formatted;
              logger$1.debug(`[WordCount] Initialized on attempt ${attempt + 1}`);
              return;
            }
          }
        }
      } catch (error) {
        logger$1.debug("[WordCount] Retry failed:", error);
      }
      attempt++;
      if (attempt < maxRetries) {
        const delay = Math.min(500 * Math.pow(2, attempt), 1e4);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    logger$1.warn("[WordCount] Failed after all retries");
    const stats = this.shadowRoot.querySelector("#word-stats");
    if (stats) stats.textContent = "Click copy";
  }
  /**
   * Create an icon button with tooltip
   */
  createIconButton(id, iconSvg, tooltipText, onClick) {
    const button = document.createElement("button");
    button.className = "aicopy-button";
    button.id = id;
    button.setAttribute("aria-label", tooltipText);
    button.innerHTML = iconSvg;
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return button;
  }
  /**
   * Get clipboard icon SVG
   */
  getClipboardIcon() {
    return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
  }
  /**
   * Get code icon SVG
   */
  getCodeIcon() {
    return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    `;
  }
  /**
   * Get eye icon SVG (for preview)
   */
  getEyeIcon() {
    return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
  /**
   * Get checkmark icon SVG
   */
  getCheckIcon() {
    return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
  }
  /**
   * Get bookmark icon SVG
   */
  getBookmarkIcon() {
    return `
      <svg class="aicopy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
  }
  /**
   * Handle Copy Markdown button click
   */
  async handleCopyMarkdown() {
    const btn = this.shadowRoot.querySelector("#copy-md-btn");
    if (!btn) return;
    try {
      btn.disabled = true;
      const markdown = await this.callbacks.onCopyMarkdown();
      const success = await copyToClipboard(markdown);
      if (success) {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = this.getCheckIcon();
        btn.style.color = "var(--theme-color)";
        logger$1.info("Markdown copied to clipboard");
        setTimeout(() => {
          btn.innerHTML = originalIcon;
          btn.style.color = "";
          btn.disabled = false;
        }, 2e3);
      } else {
        throw new Error("Failed to copy");
      }
    } catch (error) {
      logger$1.error("Copy failed:", error);
      btn.disabled = false;
    }
  }
  /**
   * Handle Re-render button click
   */
  handleReRender() {
    logger$1.debug("Re-render clicked");
    this.callbacks.onReRender();
    const btn = this.shadowRoot.querySelector("#re-render-btn");
    if (btn) this.showFeedback(btn, "Opening Preview...");
  }
  /**
   * Handle View Source button click
   */
  handleViewSource() {
    logger$1.debug("View Source clicked");
    this.callbacks.onViewSource();
    const btn = this.shadowRoot.querySelector("#source-btn");
    if (btn) this.showFeedback(btn, "Source Opened");
  }
  /**
   * Handle Bookmark button click
   */
  handleBookmark() {
    logger$1.debug("Bookmark clicked");
    if (this.callbacks.onBookmark) {
      this.callbacks.onBookmark();
    }
  }
  /**
   * Show floating feedback tooltip on button click
   */
  showFeedback(button, message) {
    const feedback = document.createElement("div");
    feedback.className = "aicopy-button-feedback";
    feedback.textContent = message;
    button.style.position = "relative";
    button.appendChild(feedback);
    setTimeout(() => {
      feedback.remove();
    }, 1500);
  }
  /**
   * Set bookmark button state (highlighted when bookmarked)
   */
  setBookmarkState(isBookmarked) {
    const bookmarkBtn = this.shadowRoot.querySelector("#bookmark-btn");
    if (!bookmarkBtn) return;
    if (isBookmarked) {
      bookmarkBtn.classList.add("bookmarked");
      bookmarkBtn.title = "Remove Bookmark";
      bookmarkBtn.setAttribute("aria-label", "Remove Bookmark");
    } else {
      bookmarkBtn.classList.remove("bookmarked");
      bookmarkBtn.title = "Bookmark";
      bookmarkBtn.setAttribute("aria-label", "Bookmark");
    }
  }
  /**
   * Get the toolbar container element
   */
  getElement() {
    return this.container;
  }
  /**
   * Destroy the toolbar
   */
  destroy() {
    this.container.remove();
  }
}

const modalStyles = `
:host {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  color: #111827;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.modal-button.primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.modal-button.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .modal-container {
    background: #1f2937;
  }

  .modal-header {
    border-bottom-color: #374151;
  }

  .modal-title {
    color: #f9fafb;
  }

  .modal-close {
    color: #9ca3af;
  }

  .modal-close:hover {
    background: #374151;
    color: #f9fafb;
  }

  .modal-content {
    background: #111827;
    border-color: #374151;
    color: #f9fafb;
  }

  .modal-footer {
    border-top-color: #374151;
  }

  .modal-button {
    background: #374151;
    color: #f9fafb;
    border-color: #4b5563;
  }

  .modal-button:hover {
    background: #4b5563;
    border-color: #6b7280;
  }
}
`;

class Modal {
  shadowRoot;
  container;
  content = "";
  constructor() {
    this.container = document.createElement("div");
    this.container.className = "aicopy-modal";
    this.shadowRoot = this.container.attachShadow({ mode: "open" });
    const styleElement = document.createElement("style");
    styleElement.textContent = modalStyles;
    this.shadowRoot.appendChild(styleElement);
  }
  /**
   * Show modal with content
   */
  show(content, title = "Markdown Source") {
    this.content = content;
    this.createUI(title);
    document.body.appendChild(this.container);
  }
  /**
   * Hide and destroy modal
   */
  hide() {
    this.container.remove();
  }
  /**
   * Create modal UI
   */
  createUI(title) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal-container";
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close" aria-label="Close">×</button>
    `;
    const body = document.createElement("div");
    body.className = "modal-body";
    const contentDiv = document.createElement("pre");
    contentDiv.className = "modal-content";
    contentDiv.textContent = this.content;
    body.appendChild(contentDiv);
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.innerHTML = `
      <button class="modal-button" id="close-btn">Close</button>
      <button class="modal-button primary" id="copy-btn">Copy</button>
    `;
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    this.shadowRoot.innerHTML = "";
    const styleElement = document.createElement("style");
    styleElement.textContent = modalStyles;
    this.shadowRoot.appendChild(styleElement);
    this.shadowRoot.appendChild(overlay);
    this.attachEventListeners();
  }
  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const closeBtn = this.shadowRoot.querySelector("#close-btn");
    closeBtn?.addEventListener("click", () => this.hide());
    const closeX = this.shadowRoot.querySelector(".modal-close");
    closeX?.addEventListener("click", () => this.hide());
    const copyBtn = this.shadowRoot.querySelector("#copy-btn");
    copyBtn?.addEventListener("click", async () => {
      const success = await copyToClipboard(this.content);
      if (success) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 2e3);
      }
    });
    const overlay = this.shadowRoot.querySelector(".modal-overlay");
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        this.hide();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }
}

function extend (destination) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      if (source.hasOwnProperty(key)) destination[key] = source[key];
    }
  }
  return destination
}

function repeat (character, count) {
  return Array(count + 1).join(character)
}

function trimLeadingNewlines (string) {
  return string.replace(/^\n*/, '')
}

function trimTrailingNewlines (string) {
  // avoid match-at-end regexp bottleneck, see #370
  var indexEnd = string.length;
  while (indexEnd > 0 && string[indexEnd - 1] === '\n') indexEnd--;
  return string.substring(0, indexEnd)
}

function trimNewlines (string) {
  return trimTrailingNewlines(trimLeadingNewlines(string))
}

var blockElements = [
  'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY', 'CANVAS',
  'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'FORM', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
  'HGROUP', 'HR', 'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
  'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
  'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
];

function isBlock (node) {
  return is(node, blockElements)
}

var voidElements = [
  'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT',
  'KEYGEN', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
];

function isVoid (node) {
  return is(node, voidElements)
}

function hasVoid (node) {
  return has(node, voidElements)
}

var meaningfulWhenBlankElements = [
  'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TH', 'TD', 'IFRAME', 'SCRIPT',
  'AUDIO', 'VIDEO'
];

function isMeaningfulWhenBlank (node) {
  return is(node, meaningfulWhenBlankElements)
}

function hasMeaningfulWhenBlank (node) {
  return has(node, meaningfulWhenBlankElements)
}

function is (node, tagNames) {
  return tagNames.indexOf(node.nodeName) >= 0
}

function has (node, tagNames) {
  return (
    node.getElementsByTagName &&
    tagNames.some(function (tagName) {
      return node.getElementsByTagName(tagName).length
    })
  )
}

var rules$1 = {};

rules$1.paragraph = {
  filter: 'p',

  replacement: function (content) {
    return '\n\n' + content + '\n\n'
  }
};

rules$1.lineBreak = {
  filter: 'br',

  replacement: function (content, node, options) {
    return options.br + '\n'
  }
};

rules$1.heading = {
  filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

  replacement: function (content, node, options) {
    var hLevel = Number(node.nodeName.charAt(1));

    if (options.headingStyle === 'setext' && hLevel < 3) {
      var underline = repeat((hLevel === 1 ? '=' : '-'), content.length);
      return (
        '\n\n' + content + '\n' + underline + '\n\n'
      )
    } else {
      return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n'
    }
  }
};

rules$1.blockquote = {
  filter: 'blockquote',

  replacement: function (content) {
    content = trimNewlines(content).replace(/^/gm, '> ');
    return '\n\n' + content + '\n\n'
  }
};

rules$1.list = {
  filter: ['ul', 'ol'],

  replacement: function (content, node) {
    var parent = node.parentNode;
    if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
      return '\n' + content
    } else {
      return '\n\n' + content + '\n\n'
    }
  }
};

rules$1.listItem = {
  filter: 'li',

  replacement: function (content, node, options) {
    var prefix = options.bulletListMarker + '   ';
    var parent = node.parentNode;
    if (parent.nodeName === 'OL') {
      var start = parent.getAttribute('start');
      var index = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + index : index + 1) + '.  ';
    }
    var isParagraph = /\n$/.test(content);
    content = trimNewlines(content) + (isParagraph ? '\n' : '');
    content = content.replace(/\n/gm, '\n' + ' '.repeat(prefix.length)); // indent
    return (
      prefix + content + (node.nextSibling ? '\n' : '')
    )
  }
};

rules$1.indentedCodeBlock = {
  filter: function (node, options) {
    return (
      options.codeBlockStyle === 'indented' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    return (
      '\n\n    ' +
      node.firstChild.textContent.replace(/\n/g, '\n    ') +
      '\n\n'
    )
  }
};

rules$1.fencedCodeBlock = {
  filter: function (node, options) {
    return (
      options.codeBlockStyle === 'fenced' &&
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    )
  },

  replacement: function (content, node, options) {
    var className = node.firstChild.getAttribute('class') || '';
    var language = (className.match(/language-(\S+)/) || [null, ''])[1];
    var code = node.firstChild.textContent;

    var fenceChar = options.fence.charAt(0);
    var fenceSize = 3;
    var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

    var match;
    while ((match = fenceInCodeRegex.exec(code))) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1;
      }
    }

    var fence = repeat(fenceChar, fenceSize);

    return (
      '\n\n' + fence + language + '\n' +
      code.replace(/\n$/, '') +
      '\n' + fence + '\n\n'
    )
  }
};

rules$1.horizontalRule = {
  filter: 'hr',

  replacement: function (content, node, options) {
    return '\n\n' + options.hr + '\n\n'
  }
};

rules$1.inlineLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'inlined' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    )
  },

  replacement: function (content, node) {
    var href = node.getAttribute('href');
    if (href) href = href.replace(/([()])/g, '\\$1');
    var title = cleanAttribute(node.getAttribute('title'));
    if (title) title = ' "' + title.replace(/"/g, '\\"') + '"';
    return '[' + content + '](' + href + title + ')'
  }
};

rules$1.referenceLink = {
  filter: function (node, options) {
    return (
      options.linkStyle === 'referenced' &&
      node.nodeName === 'A' &&
      node.getAttribute('href')
    )
  },

  replacement: function (content, node, options) {
    var href = node.getAttribute('href');
    var title = cleanAttribute(node.getAttribute('title'));
    if (title) title = ' "' + title + '"';
    var replacement;
    var reference;

    switch (options.linkReferenceStyle) {
      case 'collapsed':
        replacement = '[' + content + '][]';
        reference = '[' + content + ']: ' + href + title;
        break
      case 'shortcut':
        replacement = '[' + content + ']';
        reference = '[' + content + ']: ' + href + title;
        break
      default:
        var id = this.references.length + 1;
        replacement = '[' + content + '][' + id + ']';
        reference = '[' + id + ']: ' + href + title;
    }

    this.references.push(reference);
    return replacement
  },

  references: [],

  append: function (options) {
    var references = '';
    if (this.references.length) {
      references = '\n\n' + this.references.join('\n') + '\n\n';
      this.references = []; // Reset references
    }
    return references
  }
};

rules$1.emphasis = {
  filter: ['em', 'i'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.emDelimiter + content + options.emDelimiter
  }
};

rules$1.strong = {
  filter: ['strong', 'b'],

  replacement: function (content, node, options) {
    if (!content.trim()) return ''
    return options.strongDelimiter + content + options.strongDelimiter
  }
};

rules$1.code = {
  filter: function (node) {
    var hasSiblings = node.previousSibling || node.nextSibling;
    var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;

    return node.nodeName === 'CODE' && !isCodeBlock
  },

  replacement: function (content) {
    if (!content) return ''
    content = content.replace(/\r?\n|\r/g, ' ');

    var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? ' ' : '';
    var delimiter = '`';
    var matches = content.match(/`+/gm) || [];
    while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + '`';

    return delimiter + extraSpace + content + extraSpace + delimiter
  }
};

rules$1.image = {
  filter: 'img',

  replacement: function (content, node) {
    var alt = cleanAttribute(node.getAttribute('alt'));
    var src = node.getAttribute('src') || '';
    var title = cleanAttribute(node.getAttribute('title'));
    var titlePart = title ? ' "' + title + '"' : '';
    return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
  }
};

function cleanAttribute (attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : ''
}

/**
 * Manages a collection of rules used to convert HTML to Markdown
 */

function Rules (options) {
  this.options = options;
  this._keep = [];
  this._remove = [];

  this.blankRule = {
    replacement: options.blankReplacement
  };

  this.keepReplacement = options.keepReplacement;

  this.defaultRule = {
    replacement: options.defaultReplacement
  };

  this.array = [];
  for (var key in options.rules) this.array.push(options.rules[key]);
}

Rules.prototype = {
  add: function (key, rule) {
    this.array.unshift(rule);
  },

  keep: function (filter) {
    this._keep.unshift({
      filter: filter,
      replacement: this.keepReplacement
    });
  },

  remove: function (filter) {
    this._remove.unshift({
      filter: filter,
      replacement: function () {
        return ''
      }
    });
  },

  forNode: function (node) {
    if (node.isBlank) return this.blankRule
    var rule;

    if ((rule = findRule(this.array, node, this.options))) return rule
    if ((rule = findRule(this._keep, node, this.options))) return rule
    if ((rule = findRule(this._remove, node, this.options))) return rule

    return this.defaultRule
  },

  forEach: function (fn) {
    for (var i = 0; i < this.array.length; i++) fn(this.array[i], i);
  }
};

function findRule (rules, node, options) {
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (filterValue(rule, node, options)) return rule
  }
  return void 0
}

function filterValue (rule, node, options) {
  var filter = rule.filter;
  if (typeof filter === 'string') {
    if (filter === node.nodeName.toLowerCase()) return true
  } else if (Array.isArray(filter)) {
    if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true
  } else if (typeof filter === 'function') {
    if (filter.call(rule, node, options)) return true
  } else {
    throw new TypeError('`filter` needs to be a string, array, or function')
  }
}

/**
 * The collapseWhitespace function is adapted from collapse-whitespace
 * by Luc Thevenard.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Luc Thevenard <lucthevenard@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * collapseWhitespace(options) removes extraneous whitespace from an the given element.
 *
 * @param {Object} options
 */
function collapseWhitespace (options) {
  var element = options.element;
  var isBlock = options.isBlock;
  var isVoid = options.isVoid;
  var isPre = options.isPre || function (node) {
    return node.nodeName === 'PRE'
  };

  if (!element.firstChild || isPre(element)) return

  var prevText = null;
  var keepLeadingWs = false;

  var prev = null;
  var node = next(prev, element, isPre);

  while (node !== element) {
    if (node.nodeType === 3 || node.nodeType === 4) { // Node.TEXT_NODE or Node.CDATA_SECTION_NODE
      var text = node.data.replace(/[ \r\n\t]+/g, ' ');

      if ((!prevText || / $/.test(prevText.data)) &&
          !keepLeadingWs && text[0] === ' ') {
        text = text.substr(1);
      }

      // `text` might be empty at this point.
      if (!text) {
        node = remove(node);
        continue
      }

      node.data = text;

      prevText = node;
    } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
      if (isBlock(node) || node.nodeName === 'BR') {
        if (prevText) {
          prevText.data = prevText.data.replace(/ $/, '');
        }

        prevText = null;
        keepLeadingWs = false;
      } else if (isVoid(node) || isPre(node)) {
        // Avoid trimming space around non-block, non-BR void elements and inline PRE.
        prevText = null;
        keepLeadingWs = true;
      } else if (prevText) {
        // Drop protection if set previously.
        keepLeadingWs = false;
      }
    } else {
      node = remove(node);
      continue
    }

    var nextNode = next(prev, node, isPre);
    prev = node;
    node = nextNode;
  }

  if (prevText) {
    prevText.data = prevText.data.replace(/ $/, '');
    if (!prevText.data) {
      remove(prevText);
    }
  }
}

/**
 * remove(node) removes the given node from the DOM and returns the
 * next node in the sequence.
 *
 * @param {Node} node
 * @return {Node} node
 */
function remove (node) {
  var next = node.nextSibling || node.parentNode;

  node.parentNode.removeChild(node);

  return next
}

/**
 * next(prev, current, isPre) returns the next node in the sequence, given the
 * current and previous nodes.
 *
 * @param {Node} prev
 * @param {Node} current
 * @param {Function} isPre
 * @return {Node}
 */
function next (prev, current, isPre) {
  if ((prev && prev.parentNode === current) || isPre(current)) {
    return current.nextSibling || current.parentNode
  }

  return current.firstChild || current.nextSibling || current.parentNode
}

/*
 * Set up window for Node.js
 */

var root = (typeof window !== 'undefined' ? window : {});

/*
 * Parsing HTML strings
 */

function canParseHTMLNatively () {
  var Parser = root.DOMParser;
  var canParse = false;

  // Adapted from https://gist.github.com/1129031
  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if (new Parser().parseFromString('', 'text/html')) {
      canParse = true;
    }
  } catch (e) {}

  return canParse
}

function createHTMLParser () {
  var Parser = function () {};

  {
    if (shouldUseActiveX()) {
      Parser.prototype.parseFromString = function (string) {
        var doc = new window.ActiveXObject('htmlfile');
        doc.designMode = 'on'; // disable on-page scripts
        doc.open();
        doc.write(string);
        doc.close();
        return doc
      };
    } else {
      Parser.prototype.parseFromString = function (string) {
        var doc = document.implementation.createHTMLDocument('');
        doc.open();
        doc.write(string);
        doc.close();
        return doc
      };
    }
  }
  return Parser
}

function shouldUseActiveX () {
  var useActiveX = false;
  try {
    document.implementation.createHTMLDocument('').open();
  } catch (e) {
    if (root.ActiveXObject) useActiveX = true;
  }
  return useActiveX
}

var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();

function RootNode (input, options) {
  var root;
  if (typeof input === 'string') {
    var doc = htmlParser().parseFromString(
      // DOM parsers arrange elements in the <head> and <body>.
      // Wrapping in a custom element ensures elements are reliably arranged in
      // a single element.
      '<x-turndown id="turndown-root">' + input + '</x-turndown>',
      'text/html'
    );
    root = doc.getElementById('turndown-root');
  } else {
    root = input.cloneNode(true);
  }
  collapseWhitespace({
    element: root,
    isBlock: isBlock,
    isVoid: isVoid,
    isPre: options.preformattedCode ? isPreOrCode : null
  });

  return root
}

var _htmlParser;
function htmlParser () {
  _htmlParser = _htmlParser || new HTMLParser();
  return _htmlParser
}

function isPreOrCode (node) {
  return node.nodeName === 'PRE' || node.nodeName === 'CODE'
}

function Node (node, options) {
  node.isBlock = isBlock(node);
  node.isCode = node.nodeName === 'CODE' || node.parentNode.isCode;
  node.isBlank = isBlank(node);
  node.flankingWhitespace = flankingWhitespace(node, options);
  return node
}

function isBlank (node) {
  return (
    !isVoid(node) &&
    !isMeaningfulWhenBlank(node) &&
    /^\s*$/i.test(node.textContent) &&
    !hasVoid(node) &&
    !hasMeaningfulWhenBlank(node)
  )
}

function flankingWhitespace (node, options) {
  if (node.isBlock || (options.preformattedCode && node.isCode)) {
    return { leading: '', trailing: '' }
  }

  var edges = edgeWhitespace(node.textContent);

  // abandon leading ASCII WS if left-flanked by ASCII WS
  if (edges.leadingAscii && isFlankedByWhitespace('left', node, options)) {
    edges.leading = edges.leadingNonAscii;
  }

  // abandon trailing ASCII WS if right-flanked by ASCII WS
  if (edges.trailingAscii && isFlankedByWhitespace('right', node, options)) {
    edges.trailing = edges.trailingNonAscii;
  }

  return { leading: edges.leading, trailing: edges.trailing }
}

function edgeWhitespace (string) {
  var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
  return {
    leading: m[1], // whole string for whitespace-only strings
    leadingAscii: m[2],
    leadingNonAscii: m[3],
    trailing: m[4], // empty for whitespace-only strings
    trailingNonAscii: m[5],
    trailingAscii: m[6]
  }
}

function isFlankedByWhitespace (side, node, options) {
  var sibling;
  var regExp;
  var isFlanked;

  if (side === 'left') {
    sibling = node.previousSibling;
    regExp = / $/;
  } else {
    sibling = node.nextSibling;
    regExp = /^ /;
  }

  if (sibling) {
    if (sibling.nodeType === 3) {
      isFlanked = regExp.test(sibling.nodeValue);
    } else if (options.preformattedCode && sibling.nodeName === 'CODE') {
      isFlanked = false;
    } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
      isFlanked = regExp.test(sibling.textContent);
    }
  }
  return isFlanked
}

var reduce = Array.prototype.reduce;
var escapes = [
  [/\\/g, '\\\\'],
  [/\*/g, '\\*'],
  [/^-/g, '\\-'],
  [/^\+ /g, '\\+ '],
  [/^(=+)/g, '\\$1'],
  [/^(#{1,6}) /g, '\\$1 '],
  [/`/g, '\\`'],
  [/^~~~/g, '\\~~~'],
  [/\[/g, '\\['],
  [/\]/g, '\\]'],
  [/^>/g, '\\>'],
  [/_/g, '\\_'],
  [/^(\d+)\. /g, '$1\\. ']
];

function TurndownService (options) {
  if (!(this instanceof TurndownService)) return new TurndownService(options)

  var defaults = {
    rules: rules$1,
    headingStyle: 'setext',
    hr: '* * *',
    bulletListMarker: '*',
    codeBlockStyle: 'indented',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    br: '  ',
    preformattedCode: false,
    blankReplacement: function (content, node) {
      return node.isBlock ? '\n\n' : ''
    },
    keepReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML
    },
    defaultReplacement: function (content, node) {
      return node.isBlock ? '\n\n' + content + '\n\n' : content
    }
  };
  this.options = extend({}, defaults, options);
  this.rules = new Rules(this.options);
}

TurndownService.prototype = {
  /**
   * The entry point for converting a string or DOM node to Markdown
   * @public
   * @param {String|HTMLElement} input The string or DOM node to convert
   * @returns A Markdown representation of the input
   * @type String
   */

  turndown: function (input) {
    if (!canConvert(input)) {
      throw new TypeError(
        input + ' is not a string, or an element/document/fragment node.'
      )
    }

    if (input === '') return ''

    var output = process.call(this, new RootNode(input, this.options));
    return postProcess.call(this, output)
  },

  /**
   * Add one or more plugins
   * @public
   * @param {Function|Array} plugin The plugin or array of plugins to add
   * @returns The Turndown instance for chaining
   * @type Object
   */

  use: function (plugin) {
    if (Array.isArray(plugin)) {
      for (var i = 0; i < plugin.length; i++) this.use(plugin[i]);
    } else if (typeof plugin === 'function') {
      plugin(this);
    } else {
      throw new TypeError('plugin must be a Function or an Array of Functions')
    }
    return this
  },

  /**
   * Adds a rule
   * @public
   * @param {String} key The unique key of the rule
   * @param {Object} rule The rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  addRule: function (key, rule) {
    this.rules.add(key, rule);
    return this
  },

  /**
   * Keep a node (as HTML) that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  keep: function (filter) {
    this.rules.keep(filter);
    return this
  },

  /**
   * Remove a node that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */

  remove: function (filter) {
    this.rules.remove(filter);
    return this
  },

  /**
   * Escapes Markdown syntax
   * @public
   * @param {String} string The string to escape
   * @returns A string with Markdown syntax escaped
   * @type String
   */

  escape: function (string) {
    return escapes.reduce(function (accumulator, escape) {
      return accumulator.replace(escape[0], escape[1])
    }, string)
  }
};

/**
 * Reduces a DOM node down to its Markdown string equivalent
 * @private
 * @param {HTMLElement} parentNode The node to convert
 * @returns A Markdown representation of the node
 * @type String
 */

function process (parentNode) {
  var self = this;
  return reduce.call(parentNode.childNodes, function (output, node) {
    node = new Node(node, self.options);

    var replacement = '';
    if (node.nodeType === 3) {
      replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
    } else if (node.nodeType === 1) {
      replacement = replacementForNode.call(self, node);
    }

    return join(output, replacement)
  }, '')
}

/**
 * Appends strings as each rule requires and trims the output
 * @private
 * @param {String} output The conversion output
 * @returns A trimmed version of the ouput
 * @type String
 */

function postProcess (output) {
  var self = this;
  this.rules.forEach(function (rule) {
    if (typeof rule.append === 'function') {
      output = join(output, rule.append(self.options));
    }
  });

  return output.replace(/^[\t\r\n]+/, '').replace(/[\t\r\n\s]+$/, '')
}

/**
 * Converts an element node to its Markdown equivalent
 * @private
 * @param {HTMLElement} node The node to convert
 * @returns A Markdown representation of the node
 * @type String
 */

function replacementForNode (node) {
  var rule = this.rules.forNode(node);
  var content = process.call(this, node);
  var whitespace = node.flankingWhitespace;
  if (whitespace.leading || whitespace.trailing) content = content.trim();
  return (
    whitespace.leading +
    rule.replacement(content, node, this.options) +
    whitespace.trailing
  )
}

/**
 * Joins replacement to the current output with appropriate number of new lines
 * @private
 * @param {String} output The current conversion output
 * @param {String} replacement The string to append to the output
 * @returns Joined output
 * @type String
 */

function join (output, replacement) {
  var s1 = trimTrailingNewlines(output);
  var s2 = trimLeadingNewlines(replacement);
  var nls = Math.max(output.length - s1.length, replacement.length - s2.length);
  var separator = '\n\n'.substring(0, nls);

  return s1 + separator + s2
}

/**
 * Determines whether an input can be converted
 * @private
 * @param {String|HTMLElement} input Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */

function canConvert (input) {
  return (
    input != null && (
      typeof input === 'string' ||
      (input.nodeType && (
        input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11
      ))
    )
  )
}

var indexOf = Array.prototype.indexOf;
var every = Array.prototype.every;
var rules = {};

rules.tableCell = {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    return cell(content, node)
  }
};

rules.tableRow = {
  filter: 'tr',
  replacement: function (content, node) {
    var borderCells = '';
    var alignMap = { left: ':--', right: '--:', center: ':-:' };

    if (isHeadingRow(node)) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var border = '---';
        var align = (
          node.childNodes[i].getAttribute('align') || ''
        ).toLowerCase();

        if (align) border = alignMap[align] || border;

        borderCells += cell(border, node.childNodes[i]);
      }
    }
    return '\n' + content + (borderCells ? '\n' + borderCells : '')
  }
};

rules.table = {
  // Only convert tables with a heading row.
  // Tables with no heading row are kept using `keep` (see below).
  filter: function (node) {
    return node.nodeName === 'TABLE' && isHeadingRow(node.rows[0])
  },

  replacement: function (content) {
    // Ensure there are no blank lines
    content = content.replace('\n\n', '\n');
    return '\n\n' + content + '\n\n'
  }
};

rules.tableSection = {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: function (content) {
    return content
  }
};

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow (tr) {
  var parentNode = tr.parentNode;
  return (
    parentNode.nodeName === 'THEAD' ||
    (
      parentNode.firstChild === tr &&
      (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode)) &&
      every.call(tr.childNodes, function (n) { return n.nodeName === 'TH' })
    )
  )
}

function isFirstTbody (element) {
  var previousSibling = element.previousSibling;
  return (
    element.nodeName === 'TBODY' && (
      !previousSibling ||
      (
        previousSibling.nodeName === 'THEAD' &&
        /^\s*$/i.test(previousSibling.textContent)
      )
    )
  )
}

function cell (content, node) {
  var index = indexOf.call(node.parentNode.childNodes, node);
  var prefix = ' ';
  if (index === 0) prefix = '| ';
  return prefix + content + ' |'
}

function tables (turndownService) {
  turndownService.keep(function (node) {
    return node.nodeName === 'TABLE' && !isHeadingRow(node.rows[0])
  });
  for (var key in rules) turndownService.addRule(key, rules[key]);
}

class MarkdownParser {
  turndownService;
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      // Use - for unordered lists
      emDelimiter: "*",
      // Use * for emphasis
      strongDelimiter: "**"
      // Use ** for strong
    });
    this.turndownService.options.listIndent = "  ";
    this.turndownService.use(tables);
    this.turndownService.escape = (text) => text;
    this.turndownService.addRule("removeLinks", {
      filter: (node) => {
        if (node.nodeName === "A") return true;
        if (node.nodeName === "SPAN" && (node.getAttribute("data-testid") === "webpage-citation-pill" || node.classList?.contains("ms-1"))) {
          return true;
        }
        return false;
      },
      replacement: (content, node) => {
        if (node.getAttribute?.("data-testid") === "webpage-citation-pill" || node.classList?.contains("ms-1")) {
          return "";
        }
        return content;
      }
    });
    this.turndownService.addRule("codeBlocks", {
      filter: (node) => {
        const hasCode = node.nodeName === "PRE" && node.querySelector("code") !== null;
        if (hasCode) {
          logger$1.debug(`[CodeBlock] Found PRE with code: ${node.textContent?.substring(0, 50)}...`);
        }
        return hasCode;
      },
      replacement: (content, node) => {
        const pre = node;
        logger$1.debug(`[CodeBlock] Processing PRE element`);
        const langDiv = pre.querySelector(".flex.items-center");
        let language = langDiv?.textContent?.trim() || "";
        logger$1.debug(`[CodeBlock] Language from UI: "${language}"`);
        const codeEl = pre.querySelector("code");
        if (!codeEl) {
          logger$1.warn(`[CodeBlock] No code element found in PRE`);
          return content;
        }
        if (!language && codeEl.className) {
          const langMatch = codeEl.className.match(/language-(\w+)/);
          if (langMatch) {
            language = langMatch[1];
            logger$1.debug(`[CodeBlock] Language from class: "${language}"`);
          }
        }
        const codeText = codeEl.textContent || "";
        logger$1.debug(`[CodeBlock] Code length: ${codeText.length} chars`);
        return `

\`\`\`${language}
${codeText.trimEnd()}
\`\`\`

`;
      }
    });
    this.turndownService.addRule("geminiMathContainers", {
      filter: (node) => {
        return node.nodeName === "SPAN" && (node.classList.contains("math-inline") || node.classList.contains("math-block")) || node.nodeName === "DIV" && node.classList.contains("math-block");
      },
      replacement: (content, node) => {
        const element = node;
        let latex = element.getAttribute("data-latex-source");
        if (!latex) {
          latex = element.getAttribute("data-math");
        }
        if (!latex) {
          const katexEl = element.querySelector(".katex, .katex-display");
          if (katexEl) {
            latex = this.extractLatex(katexEl);
          }
        }
        if (latex) {
          if (element.classList.contains("math-block") || element.querySelector(".katex-display")) {
            return `

$$
${latex}
$$

`;
          }
          return `$${latex}$`;
        }
        return content;
      }
    });
    this.turndownService.addRule("katexFormulas", {
      filter: (node) => {
        return node.nodeName === "SPAN" && (node.classList.contains("katex") || node.classList.contains("katex-display"));
      },
      replacement: (content, node) => {
        const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation && annotation.textContent) {
          const latex = annotation.textContent.trim();
          if (node.classList.contains("katex-display")) {
            return `

$$
${latex}
$$

`;
          }
          return `$${latex}$`;
        }
        return content;
      }
    });
    this.turndownService.addRule("tableContainer", {
      filter: (node) => {
        return node.nodeName === "DIV" && node.classList.contains("TyagGW_tableContainer");
      },
      replacement: (content) => {
        return `

${content.trim()}

`;
      }
    });
  }
  /**
   * 主解析方法
   */
  parse(element) {
    logger$1.debug("[MarkdownParser] Starting parse (Method C)");
    logger$1.debug(`[MarkdownParser] Input element: tag=${element.tagName}, textLength=${element.textContent?.length || 0}`);
    const deepResearchDivs = element.querySelectorAll(".deep-research-result");
    if (deepResearchDivs.length > 0) {
      logger$1.debug(`[Deep Research] Found ${deepResearchDivs.length} deep-research-result divs`);
      deepResearchDivs.forEach((div, idx) => {
        logger$1.debug(`[Deep Research] Div ${idx}: textLength=${div.textContent?.length || 0}`);
      });
      return this.parseDeepResearch(deepResearchDivs);
    }
    const contentBlocks = this.extractContentBlocks(element);
    const markdown = this.blocksToMarkdown(contentBlocks);
    const result = this.postProcess(markdown);
    logger$1.debug("[MarkdownParser] Parse complete");
    return result;
  }
  /**
   * Deep Research 专用解析
   * 处理 .deep-research-result 容器中的 katex-error 元素
   * 关键：Deep Research 的内容主要在 katex-error 中（渲染失败的大段LaTeX）
   */
  parseDeepResearch(deepResearchDivs) {
    const parts = [];
    deepResearchDivs.forEach((div, idx) => {
      logger$1.debug(`[Deep Research] Processing div ${idx + 1}/${deepResearchDivs.length}, textLength=${div.textContent?.length || 0}`);
      const clone = div.cloneNode(true);
      const katexErrors = clone.querySelectorAll(".katex-error");
      const errorBlocks = [];
      logger$1.debug(`[Deep Research] Div ${idx + 1}: Found ${katexErrors.length} katex-error elements`);
      katexErrors.forEach((errorEl, i) => {
        const latex = errorEl.textContent?.trim() || "";
        if (latex) {
          const charCount = latex.length;
          logger$1.debug(`[Deep Research] katex-error ${i}: ${charCount} chars`);
          const placeholder = `__KATEX_ERROR_${i}__`;
          errorBlocks.push({ placeholder, latex });
          const textNode = document.createTextNode(placeholder);
          errorEl.replaceWith(textNode);
        }
      });
      const htmlBefore = clone.outerHTML.length;
      let markdown = this.turndownService.turndown(clone.outerHTML);
      logger$1.debug(`[Deep Research] Div ${idx + 1}: Turndown ${htmlBefore} -> ${markdown.length} chars`);
      errorBlocks.forEach(({ placeholder, latex }) => {
        const formatted = latex.replace(/\\\[/g, "$$\n").replace(/\\\]/g, "\n$$").replace(/\\\(/g, "$").replace(/\\\)/g, "$");
        markdown = markdown.split(placeholder).join(formatted);
      });
      logger$1.debug(`[Deep Research] Div ${idx + 1}: After restore ${markdown.length} chars`);
      markdown = this.postProcess(markdown);
      logger$1.debug(`[Deep Research] Div ${idx + 1}: After postProcess ${markdown.length} chars`);
      parts.push(markdown);
    });
    const result = parts.join("\n\n---\n\n");
    logger$1.debug(`[Deep Research] Final result: ${result.length} chars`);
    return result;
  }
  /**
   * 提取内容块：递归遍历 DOM，识别数学公式和文本块
   */
  extractContentBlocks(container) {
    const blocks = [];
    let blockMathCount = 0;
    let inlineMathCount = 0;
    const allDisplays = container.querySelectorAll(".katex-display");
    const processedDisplays = /* @__PURE__ */ new WeakSet();
    logger$1.debug(`[Analysis] Found ${allDisplays.length} block formulas`);
    const processNode = (node) => {
      if (node.nodeType !== 1) return;
      if (node.classList.contains("katex-display")) {
        const latex = this.extractLatex(node);
        if (latex) {
          blocks.push({
            type: "block-math",
            content: `$$
${latex}
$$`
          });
          blockMathCount++;
          logger$1.debug(`[Extract] Block math ${blockMathCount}: ${latex.substring(0, 40)}...`);
        }
        return;
      }
      if (node.tagName.toLowerCase() === "pre" && node.querySelector("code")) {
        logger$1.debug(`[Extract] Found PRE element with code`);
        const langDiv = node.querySelector(".flex.items-center");
        let language = langDiv?.textContent?.trim() || "";
        const codeEl = node.querySelector("code");
        if (!language && codeEl?.className) {
          const langMatch = codeEl.className.match(/language-(\w+)/);
          if (langMatch) {
            language = langMatch[1];
          }
        }
        const codeText = codeEl?.textContent || "";
        logger$1.debug(`[Extract] Code block: language="${language}", length=${codeText.length}`);
        if (codeText.trim()) {
          blocks.push({
            type: "text",
            content: `

\`\`\`${language}
${codeText.trimEnd()}
\`\`\`

`
          });
        }
        return;
      }
      if (node.tagName.toLowerCase() === "table" || node.classList.contains("TyagGW_tableContainer")) {
        const clone = node.cloneNode(true);
        const tableMathMap = /* @__PURE__ */ new Map();
        let tableMathCounter = 0;
        clone.querySelectorAll(".katex-display").forEach((display) => {
          const latex = this.extractLatex(display);
          if (latex) {
            const placeholder = `__TABLEMATH_DISPLAY_${tableMathCounter++}__`;
            tableMathMap.set(placeholder, `$$${latex}$$`);
            const textNode = document.createTextNode(placeholder);
            display.replaceWith(textNode);
            logger$1.debug(`[Extract-Table] Block math: ${latex.substring(0, 40)}...`);
          }
        });
        clone.querySelectorAll(".katex").forEach((katex) => {
          if (katex.closest(".katex-display")) return;
          const latex = this.extractLatex(katex);
          if (latex) {
            const placeholder = `__TABLEMATH_INLINE_${tableMathCounter++}__`;
            tableMathMap.set(placeholder, `$${latex}$`);
            const textNode = document.createTextNode(placeholder);
            katex.replaceWith(textNode);
            logger$1.debug(`[Extract-Table] Inline math: ${latex.substring(0, 40)}...`);
          }
        });
        let markdown = this.turndownService.turndown(clone.outerHTML);
        tableMathMap.forEach((formula, placeholder) => {
          markdown = markdown.split(placeholder).join(formula);
        });
        if (markdown.trim()) {
          blocks.push({ type: "text", content: markdown });
          logger$1.debug(`[Extract] Table with ${tableMathMap.size} math formulas: ${markdown.substring(0, 80)}...`);
        }
        return;
      }
      if (node.tagName.toLowerCase() === "ul" || node.tagName.toLowerCase() === "ol") {
        const clone = node.cloneNode(true);
        const listMathMap = /* @__PURE__ */ new Map();
        let listMathCounter = 0;
        clone.querySelectorAll(".katex-display").forEach((display) => {
          const latex = this.extractLatex(display);
          if (latex) {
            const placeholder = `__LISTBLOCKMATH_${listMathCounter++}__`;
            listMathMap.set(placeholder, latex);
            const textNode = document.createTextNode(placeholder);
            display.replaceWith(textNode);
            blockMathCount++;
            logger$1.debug(`[Extract-List] Block math ${blockMathCount}: ${latex.substring(0, 40)}...`);
          }
        });
        let markdown = this.turndownService.turndown(clone.outerHTML);
        listMathMap.forEach((latex, placeholder) => {
          const regex = new RegExp(`^[ \\t]*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*$`, "gm");
          markdown = markdown.replace(regex, () => {
            return "\n\n$$\n" + latex + "\n$$\n\n";
          });
        });
        if (markdown.trim()) {
          blocks.push({ type: "text", content: markdown });
          logger$1.debug(`[Extract] List (${node.tagName}) with ${listMathMap.size} block formulas`);
        }
        return;
      }
      if (this.isTextContainer(node)) {
        const clone = node.cloneNode(true);
        const childDisplays = clone.querySelectorAll(":scope > .katex-display");
        childDisplays.forEach((display) => {
          const latex = this.extractLatex(display);
          if (latex && !processedDisplays.has(display)) {
            processedDisplays.add(display);
            blocks.push({ type: "block-math", content: `$$
${latex}
$$` });
            blockMathCount++;
            logger$1.debug(`[Extract-Container] Block math ${blockMathCount}: ${latex.substring(0, 40)}...`);
          }
        });
        clone.querySelectorAll(".katex-display").forEach((d) => d.remove());
        const inlineMaths = [];
        clone.querySelectorAll(".katex").forEach((katex) => {
          if (katex.closest(".katex-display")) return;
          const latex = this.extractLatex(katex);
          if (latex) {
            const placeholder = `__INLINE${inlineMathCount}__`;
            inlineMaths.push({ placeholder, latex });
            const textNode = document.createTextNode(placeholder);
            katex.replaceWith(textNode);
            inlineMathCount++;
            logger$1.debug(`[Extract] Inline math ${inlineMathCount}: ${latex.substring(0, 30)}...`);
          }
        });
        let markdown = this.turndownService.turndown(clone.outerHTML);
        inlineMaths.forEach(({ placeholder, latex }) => {
          markdown = markdown.split(placeholder).join(`$${latex}$`);
        });
        if (markdown.trim()) {
          blocks.push({
            type: "text",
            content: markdown
          });
        }
        return;
      }
      Array.from(node.children).forEach((child) => processNode(child));
    };
    processNode(container);
    logger$1.debug(`[Extract] Total: ${blockMathCount} block formulas, ${inlineMathCount} inline formulas`);
    return blocks;
  }
  /**
   * 从 KaTeX 元素提取 LaTeX 源码
   */
  extractLatex(element) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    if (!annotation?.textContent) return null;
    return annotation.textContent.replace(/\s+/g, " ").trim();
  }
  /**
   * 判断是否为文本容器（段落、标题、列表项等）
   * 注意：不包含 ul/ol/li，因为列表需要整体交给 Turndown 处理（包含列表中的公式）
   */
  isTextContainer(node) {
    const tag = node.tagName.toLowerCase();
    return ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "td", "th"].includes(tag);
  }
  /**
   * 将内容块转换为最终 Markdown
   * 块公式前后各空一行
   */
  blocksToMarkdown(blocks) {
    const parts = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === "block-math") {
        if (i > 0 && blocks[i - 1].type !== "block-math") {
          parts.push("\n");
        }
        parts.push(block.content);
        if (i < blocks.length - 1 && blocks[i + 1].type !== "block-math") {
          parts.push("\n");
        }
      } else {
        parts.push(block.content);
      }
      if (i < blocks.length - 1) {
        parts.push("\n\n");
      }
    }
    return parts.join("");
  }
  /**
   * 后处理：清理格式（不处理数学公式，它们已是最终格式）
   */
  postProcess(markdown) {
    let result = markdown;
    result = result.replace(/^(    )+/gm, (match) => {
      const spaceCount = match.length;
      const level = spaceCount / 4;
      return "  ".repeat(level);
    });
    const lines = result.split("\n");
    const fixedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const listMatch = line.match(/^( *)([*-]|\d+\.)\s/);
      if (listMatch) {
        const currentIndent = listMatch[1].length;
        const marker = listMatch[2];
        const restOfLine = line.slice(listMatch[0].length);
        let normalizedIndent;
        if (currentIndent === 0) {
          normalizedIndent = "";
        } else if (currentIndent <= 1) {
          normalizedIndent = "  ";
          logger$1.debug(`[PostProcess] Normalizing indent: ${currentIndent} → 2 spaces`);
        } else if (currentIndent <= 3) {
          normalizedIndent = "  ";
          if (currentIndent > 2) {
            logger$1.debug(`[PostProcess] Normalizing indent: ${currentIndent} → 2 spaces`);
          }
        } else {
          const level = Math.round(currentIndent / 2);
          normalizedIndent = "  ".repeat(level);
          if (currentIndent !== level * 2) {
            logger$1.debug(`[PostProcess] Normalizing indent: ${currentIndent} → ${level * 2} spaces`);
          }
        }
        fixedLines.push(`${normalizedIndent}${marker} ${restOfLine}`);
      } else {
        fixedLines.push(line);
      }
    }
    result = fixedLines.join("\n");
    result = result.split("\n").map((line) => line.trimEnd()).join("\n");
    result = result.replace(/:contentReference\[oaicite:\d+\]\{index=\d+\}/g, "");
    result = result.replace(/\b[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/g, "");
    result = result.replace(/\b[a-zA-Z0-9._-]+\+\d+\b/g, "");
    result = result.replace(/\b(OUP Academic|OUP|developers)\s*/g, "");
    result = result.split("\n").map((line) => {
      const match = line.match(/^(\s*)(.*)/);
      if (match) {
        const indent = match[1];
        const content = match[2].replace(/ {2,}/g, " ");
        return indent + content;
      }
      return line;
    }).join("\n");
    result = result.replace(/\.{2,}/g, ".");
    result = result.replace(/ \. /g, " ");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.replace(/([^\n$])\n(#{1,6} )/g, "$1\n\n$2");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.trim() + "\n";
    return result;
  }
}

class MathClickHandler {
  activeElements = /* @__PURE__ */ new WeakSet();
  observers = /* @__PURE__ */ new WeakMap();
  /**
   * Enable click-to-copy for all math elements in a container
   * Uses MutationObserver to handle streaming updates
   */
  enable(container) {
    this.processContainer(container);
    if (this.observers.has(container)) {
      return;
    }
    const observer = new MutationObserver((mutations) => {
      let hasNewMath = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            const hasMath = node.classList.contains("katex") || node.classList.contains("katex-display") || node.querySelector(".katex, .katex-display");
            if (hasMath) {
              hasNewMath = true;
              break;
            }
          }
        }
        if (hasNewMath) break;
      }
      if (hasNewMath) {
        logger$1.debug("[MathClick] New math elements detected during streaming");
        this.processContainer(container);
      }
    });
    observer.observe(container, {
      childList: true,
      subtree: true
    });
    this.observers.set(container, observer);
    logger$1.debug("[MathClick] Observer started for container");
  }
  /**
   * Process all math elements in a container
   */
  processContainer(container) {
    const mathElements = this.findAllMathElements(container);
    mathElements.forEach((element) => {
      if (this.activeElements.has(element)) return;
      this.attachHandlers(element);
      this.activeElements.add(element);
    });
    if (mathElements.length > 0) {
      logger$1.debug(`[MathClick] Enabled click-to-copy for ${mathElements.length} math elements`);
    }
  }
  /**
   * Find all math elements in a container
   */
  findAllMathElements(container) {
    const elements = [];
    container.querySelectorAll(".katex-display").forEach((el) => elements.push(el));
    container.querySelectorAll(".katex").forEach((el) => {
      if (!el.closest(".katex-display")) {
        elements.push(el);
      }
    });
    container.querySelectorAll(".katex-error").forEach((el) => {
      const text = el.textContent?.trim() || "";
      if (text.length > 0 && text.length < 200) {
        elements.push(el);
      }
    });
    return elements;
  }
  /**
   * Attach event handlers to a math element
   */
  attachHandlers(element) {
    const mathEl = element;
    const targetEl = element.classList.contains("katex-display") ? mathEl : mathEl.querySelector(".katex") || mathEl;
    targetEl.style.cursor = "pointer";
    targetEl.style.transition = "background-color 0.2s";
    targetEl.addEventListener("mouseenter", () => {
      targetEl.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
    });
    targetEl.addEventListener("mouseleave", () => {
      targetEl.style.backgroundColor = "";
    });
    targetEl.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.handleClick(element);
    });
  }
  /**
   * Handle click on math element
   */
  async handleClick(element) {
    const latex = this.getLatexSource(element);
    if (!latex) {
      logger$1.warn("No LaTeX source found for clicked element");
      return;
    }
    const success = await copyToClipboard(latex);
    if (success) {
      logger$1.info("LaTeX copied:", latex);
      this.showCopyFeedback(element);
    } else {
      logger$1.error("Failed to copy LaTeX");
    }
  }
  /**
   * Extract LaTeX source from a math element
   */
  getLatexSource(element) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation?.textContent) {
      return annotation.textContent.trim();
    }
    if (element.classList.contains("katex-error")) {
      return element.textContent?.trim() || null;
    }
    return element.textContent?.trim() || null;
  }
  /**
   * Show visual feedback after successful copy
   */
  showCopyFeedback(element) {
    element.style.backgroundColor = "rgba(139, 92, 246, 0.2)";
    const tooltip = document.createElement("div");
    tooltip.textContent = "Copied!";
    tooltip.style.cssText = `
      position: absolute;
      background: #8b5cf6;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      z-index: 999999;
      animation: fadeOut 1.5s forwards;
    `;
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.top - 30}px`;
    tooltip.style.left = `${rect.left + rect.width / 2 - 30}px`;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeOut {
        0% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(tooltip);
    setTimeout(() => {
      tooltip.remove();
      style.remove();
      element.style.backgroundColor = "";
      if (element.matches(":hover")) {
        element.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
      }
    }, 1500);
  }
}

/**
 * marked v17.0.1 - a markdown parser
 * Copyright (c) 2018-2025, MarkedJS. (MIT License)
 * Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
 * https://github.com/markedjs/marked
 */

/**
 * DO NOT EDIT THIS FILE
 * The code in this file is generated from files in ./src/
 */

function L(){return {async:false,breaks:false,extensions:null,gfm:true,hooks:null,pedantic:false,renderer:null,silent:false,tokenizer:null,walkTokens:null}}var T$1=L();function Z(u){T$1=u;}var C={exec:()=>null};function k(u,e=""){let t=typeof u=="string"?u:u.source,n={replace:(r,i)=>{let s=typeof i=="string"?i:i.source;return s=s.replace(m.caret,"$1"),t=t.replace(r,s),n},getRegex:()=>new RegExp(t,e)};return n}var me=(()=>{try{return !!new RegExp("(?<=1)(?<!1)")}catch{return  false}})(),m={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:u=>new RegExp(`^( {0,3}${u})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:u=>new RegExp(`^ {0,${Math.min(3,u-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:u=>new RegExp(`^ {0,${Math.min(3,u-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:u=>new RegExp(`^ {0,${Math.min(3,u-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:u=>new RegExp(`^ {0,${Math.min(3,u-1)}}#`),htmlBeginRegex:u=>new RegExp(`^ {0,${Math.min(3,u-1)}}<(?:[a-z].*>|!--)`,"i")},xe=/^(?:[ \t]*(?:\n|$))+/,be=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,Re=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,I=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Te=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,N=/(?:[*+-]|\d{1,9}[.)])/,re=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,se=k(re).replace(/bull/g,N).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),Oe=k(re).replace(/bull/g,N).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Q=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,we=/^[^\n]+/,F=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,ye=k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",F).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Pe=k(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,N).getRegex(),v="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",j=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Se=k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",j).replace("tag",v).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),ie=k(Q).replace("hr",I).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",v).getRegex(),$e=k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",ie).getRegex(),U={blockquote:$e,code:be,def:ye,fences:Re,heading:Te,hr:I,html:Se,lheading:se,list:Pe,newline:xe,paragraph:ie,table:C,text:we},te=k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",I).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",v).getRegex(),_e={...U,lheading:Oe,table:te,paragraph:k(Q).replace("hr",I).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",te).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",v).getRegex()},Le={...U,html:k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",j).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:C,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:k(Q).replace("hr",I).replace("heading",` *#{1,6} *[^
]`).replace("lheading",se).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Me=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,ze=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,oe=/^( {2,}|\\)\n(?!\s*$)/,Ae=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,D$1=/[\p{P}\p{S}]/u,K=/[\s\p{P}\p{S}]/u,ae=/[^\s\p{P}\p{S}]/u,Ce=k(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,K).getRegex(),le=/(?!~)[\p{P}\p{S}]/u,Ie=/(?!~)[\s\p{P}\p{S}]/u,Ee=/(?:[^\s\p{P}\p{S}]|~)/u,Be=k(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",me?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),ue=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,qe=k(ue,"u").replace(/punct/g,D$1).getRegex(),ve=k(ue,"u").replace(/punct/g,le).getRegex(),pe="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",De=k(pe,"gu").replace(/notPunctSpace/g,ae).replace(/punctSpace/g,K).replace(/punct/g,D$1).getRegex(),He=k(pe,"gu").replace(/notPunctSpace/g,Ee).replace(/punctSpace/g,Ie).replace(/punct/g,le).getRegex(),Ze=k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,ae).replace(/punctSpace/g,K).replace(/punct/g,D$1).getRegex(),Ge=k(/\\(punct)/,"gu").replace(/punct/g,D$1).getRegex(),Ne=k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Qe=k(j).replace("(?:-->|$)","-->").getRegex(),Fe=k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Qe).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),q=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,je=k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",q).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),ce=k(/^!?\[(label)\]\[(ref)\]/).replace("label",q).replace("ref",F).getRegex(),he=k(/^!?\[(ref)\](?:\[\])?/).replace("ref",F).getRegex(),Ue=k("reflink|nolink(?!\\()","g").replace("reflink",ce).replace("nolink",he).getRegex(),ne=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,W={_backpedal:C,anyPunctuation:Ge,autolink:Ne,blockSkip:Be,br:oe,code:ze,del:C,emStrongLDelim:qe,emStrongRDelimAst:De,emStrongRDelimUnd:Ze,escape:Me,link:je,nolink:he,punctuation:Ce,reflink:ce,reflinkSearch:Ue,tag:Fe,text:Ae,url:C},Ke={...W,link:k(/^!?\[(label)\]\((.*?)\)/).replace("label",q).getRegex(),reflink:k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",q).getRegex()},G={...W,emStrongRDelimAst:He,emStrongLDelim:ve,url:k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",ne).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:k(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",ne).getRegex()},We={...G,br:k(oe).replace("{2,}","*").getRegex(),text:k(G.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},E={normal:U,gfm:_e,pedantic:Le},M={normal:W,gfm:G,breaks:We,pedantic:Ke};var Xe={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},ke=u=>Xe[u];function w(u,e){if(e){if(m.escapeTest.test(u))return u.replace(m.escapeReplace,ke)}else if(m.escapeTestNoEncode.test(u))return u.replace(m.escapeReplaceNoEncode,ke);return u}function X(u){try{u=encodeURI(u).replace(m.percentDecode,"%");}catch{return null}return u}function J(u,e){let t=u.replace(m.findPipe,(i,s,a)=>{let o=false,l=s;for(;--l>=0&&a[l]==="\\";)o=!o;return o?"|":" |"}),n=t.split(m.splitPipe),r=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),e)if(n.length>e)n.splice(e);else for(;n.length<e;)n.push("");for(;r<n.length;r++)n[r]=n[r].trim().replace(m.slashPipe,"|");return n}function z(u,e,t){let n=u.length;if(n===0)return "";let r=0;for(;r<n;){let i=u.charAt(n-r-1);if(i===e&&true)r++;else break}return u.slice(0,n-r)}function de(u,e){if(u.indexOf(e[1])===-1)return  -1;let t=0;for(let n=0;n<u.length;n++)if(u[n]==="\\")n++;else if(u[n]===e[0])t++;else if(u[n]===e[1]&&(t--,t<0))return n;return t>0?-2:-1}function ge(u,e,t,n,r){let i=e.href,s=e.title||null,a=u[1].replace(r.other.outputLinkReplace,"$1");n.state.inLink=true;let o={type:u[0].charAt(0)==="!"?"image":"link",raw:t,href:i,title:s,text:a,tokens:n.inlineTokens(a)};return n.state.inLink=false,o}function Je(u,e,t){let n=u.match(t.other.indentCodeCompensation);if(n===null)return e;let r=n[1];return e.split(`
`).map(i=>{let s=i.match(t.other.beginningSpace);if(s===null)return i;let[a]=s;return a.length>=r.length?i.slice(r.length):i}).join(`
`)}var y=class{options;rules;lexer;constructor(e){this.options=e||T$1;}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return {type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let n=t[0].replace(this.rules.other.codeRemoveIndent,"");return {type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?n:z(n,`
`)}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let n=t[0],r=Je(n,t[3]||"",this.rules);return {type:"code",raw:n,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:r}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let n=t[2].trim();if(this.rules.other.endingHash.test(n)){let r=z(n,"#");(this.options.pedantic||!r||this.rules.other.endingSpaceChar.test(r))&&(n=r.trim());}return {type:"heading",raw:t[0],depth:t[1].length,text:n,tokens:this.lexer.inline(n)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return {type:"hr",raw:z(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let n=z(t[0],`
`).split(`
`),r="",i="",s=[];for(;n.length>0;){let a=false,o=[],l;for(l=0;l<n.length;l++)if(this.rules.other.blockquoteStart.test(n[l]))o.push(n[l]),a=true;else if(!a)o.push(n[l]);else break;n=n.slice(l);let p=o.join(`
`),c=p.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");r=r?`${r}
${p}`:p,i=i?`${i}
${c}`:c;let g=this.lexer.state.top;if(this.lexer.state.top=true,this.lexer.blockTokens(c,s,true),this.lexer.state.top=g,n.length===0)break;let h=s.at(-1);if(h?.type==="code")break;if(h?.type==="blockquote"){let R=h,f=R.raw+`
`+n.join(`
`),O=this.blockquote(f);s[s.length-1]=O,r=r.substring(0,r.length-R.raw.length)+O.raw,i=i.substring(0,i.length-R.text.length)+O.text;break}else if(h?.type==="list"){let R=h,f=R.raw+`
`+n.join(`
`),O=this.list(f);s[s.length-1]=O,r=r.substring(0,r.length-h.raw.length)+O.raw,i=i.substring(0,i.length-R.raw.length)+O.raw,n=f.substring(s.at(-1).raw.length).split(`
`);continue}}return {type:"blockquote",raw:r,tokens:s,text:i}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim(),r=n.length>1,i={type:"list",raw:"",ordered:r,start:r?+n.slice(0,-1):"",loose:false,items:[]};n=r?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=r?n:"[*+-]");let s=this.rules.other.listItemRegex(n),a=false;for(;e;){let l=false,p="",c="";if(!(t=s.exec(e))||this.rules.block.hr.test(e))break;p=t[0],e=e.substring(p.length);let g=t[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,O=>" ".repeat(3*O.length)),h=e.split(`
`,1)[0],R=!g.trim(),f=0;if(this.options.pedantic?(f=2,c=g.trimStart()):R?f=t[1].length+1:(f=t[2].search(this.rules.other.nonSpaceChar),f=f>4?1:f,c=g.slice(f),f+=t[1].length),R&&this.rules.other.blankLine.test(h)&&(p+=h+`
`,e=e.substring(h.length+1),l=true),!l){let O=this.rules.other.nextBulletRegex(f),V=this.rules.other.hrRegex(f),Y=this.rules.other.fencesBeginRegex(f),ee=this.rules.other.headingBeginRegex(f),fe=this.rules.other.htmlBeginRegex(f);for(;e;){let H=e.split(`
`,1)[0],A;if(h=H,this.options.pedantic?(h=h.replace(this.rules.other.listReplaceNesting,"  "),A=h):A=h.replace(this.rules.other.tabCharGlobal,"    "),Y.test(h)||ee.test(h)||fe.test(h)||O.test(h)||V.test(h))break;if(A.search(this.rules.other.nonSpaceChar)>=f||!h.trim())c+=`
`+A.slice(f);else {if(R||g.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||Y.test(g)||ee.test(g)||V.test(g))break;c+=`
`+h;}!R&&!h.trim()&&(R=true),p+=H+`
`,e=e.substring(H.length+1),g=A.slice(f);}}i.loose||(a?i.loose=true:this.rules.other.doubleBlankLine.test(p)&&(a=true)),i.items.push({type:"list_item",raw:p,task:!!this.options.gfm&&this.rules.other.listIsTask.test(c),loose:false,text:c,tokens:[]}),i.raw+=p;}let o=i.items.at(-1);if(o)o.raw=o.raw.trimEnd(),o.text=o.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let l of i.items){if(this.lexer.state.top=false,l.tokens=this.lexer.blockTokens(l.text,[]),l.task){if(l.text=l.text.replace(this.rules.other.listReplaceTask,""),l.tokens[0]?.type==="text"||l.tokens[0]?.type==="paragraph"){l.tokens[0].raw=l.tokens[0].raw.replace(this.rules.other.listReplaceTask,""),l.tokens[0].text=l.tokens[0].text.replace(this.rules.other.listReplaceTask,"");for(let c=this.lexer.inlineQueue.length-1;c>=0;c--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[c].src)){this.lexer.inlineQueue[c].src=this.lexer.inlineQueue[c].src.replace(this.rules.other.listReplaceTask,"");break}}let p=this.rules.other.listTaskCheckbox.exec(l.raw);if(p){let c={type:"checkbox",raw:p[0]+" ",checked:p[0]!=="[ ]"};l.checked=c.checked,i.loose?l.tokens[0]&&["paragraph","text"].includes(l.tokens[0].type)&&"tokens"in l.tokens[0]&&l.tokens[0].tokens?(l.tokens[0].raw=c.raw+l.tokens[0].raw,l.tokens[0].text=c.raw+l.tokens[0].text,l.tokens[0].tokens.unshift(c)):l.tokens.unshift({type:"paragraph",raw:c.raw,text:c.raw,tokens:[c]}):l.tokens.unshift(c);}}if(!i.loose){let p=l.tokens.filter(g=>g.type==="space"),c=p.length>0&&p.some(g=>this.rules.other.anyLine.test(g.raw));i.loose=c;}}if(i.loose)for(let l of i.items){l.loose=true;for(let p of l.tokens)p.type==="text"&&(p.type="paragraph");}return i}}html(e){let t=this.rules.block.html.exec(e);if(t)return {type:"html",block:true,raw:t[0],pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:t[0]}}def(e){let t=this.rules.block.def.exec(e);if(t){let n=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),r=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",i=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return {type:"def",tag:n,raw:t[0],href:r,title:i}}}table(e){let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let n=J(t[1]),r=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),i=t[3]?.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],s={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===r.length){for(let a of r)this.rules.other.tableAlignRight.test(a)?s.align.push("right"):this.rules.other.tableAlignCenter.test(a)?s.align.push("center"):this.rules.other.tableAlignLeft.test(a)?s.align.push("left"):s.align.push(null);for(let a=0;a<n.length;a++)s.header.push({text:n[a],tokens:this.lexer.inline(n[a]),header:true,align:s.align[a]});for(let a of i)s.rows.push(J(a,s.header.length).map((o,l)=>({text:o,tokens:this.lexer.inline(o),header:false,align:s.align[l]})));return s}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t)return {type:"heading",raw:t[0],depth:t[2].charAt(0)==="="?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let n=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return {type:"paragraph",raw:t[0],text:n,tokens:this.lexer.inline(n)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return {type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return {type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return !this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=true:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=false),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=true:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=false),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:false,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let n=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(n)){if(!this.rules.other.endAngleBracket.test(n))return;let s=z(n.slice(0,-1),"\\");if((n.length-s.length)%2===0)return}else {let s=de(t[2],"()");if(s===-2)return;if(s>-1){let o=(t[0].indexOf("!")===0?5:4)+t[1].length+s;t[2]=t[2].substring(0,s),t[0]=t[0].substring(0,o).trim(),t[3]="";}}let r=t[2],i="";if(this.options.pedantic){let s=this.rules.other.pedanticHrefTitle.exec(r);s&&(r=s[1],i=s[3]);}else i=t[3]?t[3].slice(1,-1):"";return r=r.trim(),this.rules.other.startAngleBracket.test(r)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(n)?r=r.slice(1):r=r.slice(1,-1)),ge(t,{href:r&&r.replace(this.rules.inline.anyPunctuation,"$1"),title:i&&i.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){let r=(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," "),i=t[r.toLowerCase()];if(!i){let s=n[0].charAt(0);return {type:"text",raw:s,text:s}}return ge(n,i,n[0],this.lexer,this.rules)}}emStrong(e,t,n=""){let r=this.rules.inline.emStrongLDelim.exec(e);if(!r||r[3]&&n.match(this.rules.other.unicodeAlphaNumeric))return;if(!(r[1]||r[2]||"")||!n||this.rules.inline.punctuation.exec(n)){let s=[...r[0]].length-1,a,o,l=s,p=0,c=r[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(c.lastIndex=0,t=t.slice(-1*e.length+s);(r=c.exec(t))!=null;){if(a=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!a)continue;if(o=[...a].length,r[3]||r[4]){l+=o;continue}else if((r[5]||r[6])&&s%3&&!((s+o)%3)){p+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l+p);let g=[...r[0]][0].length,h=e.slice(0,s+r.index+g+o);if(Math.min(s,o)%2){let f=h.slice(1,-1);return {type:"em",raw:h,text:f,tokens:this.lexer.inlineTokens(f)}}let R=h.slice(2,-2);return {type:"strong",raw:h,text:R,tokens:this.lexer.inlineTokens(R)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let n=t[2].replace(this.rules.other.newLineCharGlobal," "),r=this.rules.other.nonSpaceChar.test(n),i=this.rules.other.startingSpaceChar.test(n)&&this.rules.other.endingSpaceChar.test(n);return r&&i&&(n=n.substring(1,n.length-1)),{type:"codespan",raw:t[0],text:n}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return {type:"br",raw:t[0]}}del(e){let t=this.rules.inline.del.exec(e);if(t)return {type:"del",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let n,r;return t[2]==="@"?(n=t[1],r="mailto:"+n):(n=t[1],r=n),{type:"link",raw:t[0],text:n,href:r,tokens:[{type:"text",raw:n,text:n}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let n,r;if(t[2]==="@")n=t[0],r="mailto:"+n;else {let i;do i=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??"";while(i!==t[0]);n=t[0],t[1]==="www."?r="http://"+t[0]:r=t[0];}return {type:"link",raw:t[0],text:n,href:r,tokens:[{type:"text",raw:n,text:n}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let n=this.lexer.state.inRawBlock;return {type:"text",raw:t[0],text:t[0],escaped:n}}}};var x=class u{tokens;options;state;inlineQueue;tokenizer;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||T$1,this.options.tokenizer=this.options.tokenizer||new y,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:false,inRawBlock:false,top:true};let t={other:m,block:E.normal,inline:M.normal};this.options.pedantic?(t.block=E.pedantic,t.inline=M.pedantic):this.options.gfm&&(t.block=E.gfm,this.options.breaks?t.inline=M.breaks:t.inline=M.gfm),this.tokenizer.rules=t;}static get rules(){return {block:E,inline:M}}static lex(e,t){return new u(t).lex(e)}static lexInline(e,t){return new u(t).inlineTokens(e)}lex(e){e=e.replace(m.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let t=0;t<this.inlineQueue.length;t++){let n=this.inlineQueue[t];this.inlineTokens(n.src,n.tokens);}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],n=false){for(this.options.pedantic&&(e=e.replace(m.tabCharGlobal,"    ").replace(m.spaceLine,""));e;){let r;if(this.options.extensions?.block?.some(s=>(r=s.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),true):false))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let s=t.at(-1);r.raw.length===1&&s!==void 0?s.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let s=t.at(-1);s?.type==="paragraph"||s?.type==="text"?(s.raw+=(s.raw.endsWith(`
`)?"":`
`)+r.raw,s.text+=`
`+r.text,this.inlineQueue.at(-1).src=s.text):t.push(r);continue}if(r=this.tokenizer.fences(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.heading(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.hr(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.blockquote(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.list(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.html(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let s=t.at(-1);s?.type==="paragraph"||s?.type==="text"?(s.raw+=(s.raw.endsWith(`
`)?"":`
`)+r.raw,s.text+=`
`+r.raw,this.inlineQueue.at(-1).src=s.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title},t.push(r));continue}if(r=this.tokenizer.table(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.lheading(e)){e=e.substring(r.raw.length),t.push(r);continue}let i=e;if(this.options.extensions?.startBlock){let s=1/0,a=e.slice(1),o;this.options.extensions.startBlock.forEach(l=>{o=l.call({lexer:this},a),typeof o=="number"&&o>=0&&(s=Math.min(s,o));}),s<1/0&&s>=0&&(i=e.substring(0,s+1));}if(this.state.top&&(r=this.tokenizer.paragraph(i))){let s=t.at(-1);n&&s?.type==="paragraph"?(s.raw+=(s.raw.endsWith(`
`)?"":`
`)+r.raw,s.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=s.text):t.push(r),n=i.length!==e.length,e=e.substring(r.raw.length);continue}if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let s=t.at(-1);s?.type==="text"?(s.raw+=(s.raw.endsWith(`
`)?"":`
`)+r.raw,s.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=s.text):t.push(r);continue}if(e){let s="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(s);break}else throw new Error(s)}}return this.state.top=true,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n=e,r=null;if(this.tokens.links){let o=Object.keys(this.tokens.links);if(o.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(n))!=null;)o.includes(r[0].slice(r[0].lastIndexOf("[")+1,-1))&&(n=n.slice(0,r.index)+"["+"a".repeat(r[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(n))!=null;)n=n.slice(0,r.index)+"++"+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let i;for(;(r=this.tokenizer.rules.inline.blockSkip.exec(n))!=null;)i=r[2]?r[2].length:0,n=n.slice(0,r.index+i)+"["+"a".repeat(r[0].length-i-2)+"]"+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);n=this.options.hooks?.emStrongMask?.call({lexer:this},n)??n;let s=false,a="";for(;e;){s||(a=""),s=false;let o;if(this.options.extensions?.inline?.some(p=>(o=p.call({lexer:this},e,t))?(e=e.substring(o.raw.length),t.push(o),true):false))continue;if(o=this.tokenizer.escape(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.tag(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.link(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(o.raw.length);let p=t.at(-1);o.type==="text"&&p?.type==="text"?(p.raw+=o.raw,p.text+=o.text):t.push(o);continue}if(o=this.tokenizer.emStrong(e,n,a)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.codespan(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.br(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.del(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.autolink(e)){e=e.substring(o.raw.length),t.push(o);continue}if(!this.state.inLink&&(o=this.tokenizer.url(e))){e=e.substring(o.raw.length),t.push(o);continue}let l=e;if(this.options.extensions?.startInline){let p=1/0,c=e.slice(1),g;this.options.extensions.startInline.forEach(h=>{g=h.call({lexer:this},c),typeof g=="number"&&g>=0&&(p=Math.min(p,g));}),p<1/0&&p>=0&&(l=e.substring(0,p+1));}if(o=this.tokenizer.inlineText(l)){e=e.substring(o.raw.length),o.raw.slice(-1)!=="_"&&(a=o.raw.slice(-1)),s=true;let p=t.at(-1);p?.type==="text"?(p.raw+=o.raw,p.text+=o.text):t.push(o);continue}if(e){let p="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(p);break}else throw new Error(p)}}return t}};var P=class{options;parser;constructor(e){this.options=e||T$1;}space(e){return ""}code({text:e,lang:t,escaped:n}){let r=(t||"").match(m.notSpaceStart)?.[0],i=e.replace(m.endingNewline,"")+`
`;return r?'<pre><code class="language-'+w(r)+'">'+(n?i:w(i,true))+`</code></pre>
`:"<pre><code>"+(n?i:w(i,true))+`</code></pre>
`}blockquote({tokens:e}){return `<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return ""}heading({tokens:e,depth:t}){return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return `<hr>
`}list(e){let t=e.ordered,n=e.start,r="";for(let a=0;a<e.items.length;a++){let o=e.items[a];r+=this.listitem(o);}let i=t?"ol":"ul",s=t&&n!==1?' start="'+n+'"':"";return "<"+i+s+`>
`+r+"</"+i+`>
`}listitem(e){return `<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return "<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return `<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",n="";for(let i=0;i<e.header.length;i++)n+=this.tablecell(e.header[i]);t+=this.tablerow({text:n});let r="";for(let i=0;i<e.rows.length;i++){let s=e.rows[i];n="";for(let a=0;a<s.length;a++)n+=this.tablecell(s[a]);r+=this.tablerow({text:n});}return r&&(r=`<tbody>${r}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+r+`</table>
`}tablerow({text:e}){return `<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),n=e.header?"th":"td";return (e.align?`<${n} align="${e.align}">`:`<${n}>`)+t+`</${n}>
`}strong({tokens:e}){return `<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return `<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return `<code>${w(e,true)}</code>`}br(e){return "<br>"}del({tokens:e}){return `<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:n}){let r=this.parser.parseInline(n),i=X(e);if(i===null)return r;e=i;let s='<a href="'+e+'"';return t&&(s+=' title="'+w(t)+'"'),s+=">"+r+"</a>",s}image({href:e,title:t,text:n,tokens:r}){r&&(n=this.parser.parseInline(r,this.parser.textRenderer));let i=X(e);if(i===null)return w(n);e=i;let s=`<img src="${e}" alt="${n}"`;return t&&(s+=` title="${w(t)}"`),s+=">",s}text(e){return "tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:w(e.text)}};var $=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return ""+e}image({text:e}){return ""+e}br(){return ""}checkbox({raw:e}){return e}};var b=class u{options;renderer;textRenderer;constructor(e){this.options=e||T$1,this.options.renderer=this.options.renderer||new P,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new $;}static parse(e,t){return new u(t).parse(e)}static parseInline(e,t){return new u(t).parseInline(e)}parse(e){let t="";for(let n=0;n<e.length;n++){let r=e[n];if(this.options.extensions?.renderers?.[r.type]){let s=r,a=this.options.extensions.renderers[s.type].call({parser:this},s);if(a!==false||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(s.type)){t+=a||"";continue}}let i=r;switch(i.type){case "space":{t+=this.renderer.space(i);break}case "hr":{t+=this.renderer.hr(i);break}case "heading":{t+=this.renderer.heading(i);break}case "code":{t+=this.renderer.code(i);break}case "table":{t+=this.renderer.table(i);break}case "blockquote":{t+=this.renderer.blockquote(i);break}case "list":{t+=this.renderer.list(i);break}case "checkbox":{t+=this.renderer.checkbox(i);break}case "html":{t+=this.renderer.html(i);break}case "def":{t+=this.renderer.def(i);break}case "paragraph":{t+=this.renderer.paragraph(i);break}case "text":{t+=this.renderer.text(i);break}default:{let s='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(s),"";throw new Error(s)}}}return t}parseInline(e,t=this.renderer){let n="";for(let r=0;r<e.length;r++){let i=e[r];if(this.options.extensions?.renderers?.[i.type]){let a=this.options.extensions.renderers[i.type].call({parser:this},i);if(a!==false||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(i.type)){n+=a||"";continue}}let s=i;switch(s.type){case "escape":{n+=t.text(s);break}case "html":{n+=t.html(s);break}case "link":{n+=t.link(s);break}case "image":{n+=t.image(s);break}case "checkbox":{n+=t.checkbox(s);break}case "strong":{n+=t.strong(s);break}case "em":{n+=t.em(s);break}case "codespan":{n+=t.codespan(s);break}case "br":{n+=t.br(s);break}case "del":{n+=t.del(s);break}case "text":{n+=t.text(s);break}default:{let a='Token with "'+s.type+'" type was not found.';if(this.options.silent)return console.error(a),"";throw new Error(a)}}}return n}};var S$1=class S{options;block;constructor(e){this.options=e||T$1;}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(){return this.block?x.lex:x.lexInline}provideParser(){return this.block?b.parse:b.parseInline}};var B=class{defaults=L();options=this.setOptions;parse=this.parseMarkdown(true);parseInline=this.parseMarkdown(false);Parser=b;Renderer=P;TextRenderer=$;Lexer=x;Tokenizer=y;Hooks=S$1;constructor(...e){this.use(...e);}walkTokens(e,t){let n=[];for(let r of e)switch(n=n.concat(t.call(this,r)),r.type){case "table":{let i=r;for(let s of i.header)n=n.concat(this.walkTokens(s.tokens,t));for(let s of i.rows)for(let a of s)n=n.concat(this.walkTokens(a.tokens,t));break}case "list":{let i=r;n=n.concat(this.walkTokens(i.items,t));break}default:{let i=r;this.defaults.extensions?.childTokens?.[i.type]?this.defaults.extensions.childTokens[i.type].forEach(s=>{let a=i[s].flat(1/0);n=n.concat(this.walkTokens(a,t));}):i.tokens&&(n=n.concat(this.walkTokens(i.tokens,t)));}}return n}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(n=>{let r={...n};if(r.async=this.defaults.async||r.async||false,n.extensions&&(n.extensions.forEach(i=>{if(!i.name)throw new Error("extension name required");if("renderer"in i){let s=t.renderers[i.name];s?t.renderers[i.name]=function(...a){let o=i.renderer.apply(this,a);return o===false&&(o=s.apply(this,a)),o}:t.renderers[i.name]=i.renderer;}if("tokenizer"in i){if(!i.level||i.level!=="block"&&i.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let s=t[i.level];s?s.unshift(i.tokenizer):t[i.level]=[i.tokenizer],i.start&&(i.level==="block"?t.startBlock?t.startBlock.push(i.start):t.startBlock=[i.start]:i.level==="inline"&&(t.startInline?t.startInline.push(i.start):t.startInline=[i.start]));}"childTokens"in i&&i.childTokens&&(t.childTokens[i.name]=i.childTokens);}),r.extensions=t),n.renderer){let i=this.defaults.renderer||new P(this.defaults);for(let s in n.renderer){if(!(s in i))throw new Error(`renderer '${s}' does not exist`);if(["options","parser"].includes(s))continue;let a=s,o=n.renderer[a],l=i[a];i[a]=(...p)=>{let c=o.apply(i,p);return c===false&&(c=l.apply(i,p)),c||""};}r.renderer=i;}if(n.tokenizer){let i=this.defaults.tokenizer||new y(this.defaults);for(let s in n.tokenizer){if(!(s in i))throw new Error(`tokenizer '${s}' does not exist`);if(["options","rules","lexer"].includes(s))continue;let a=s,o=n.tokenizer[a],l=i[a];i[a]=(...p)=>{let c=o.apply(i,p);return c===false&&(c=l.apply(i,p)),c};}r.tokenizer=i;}if(n.hooks){let i=this.defaults.hooks||new S$1;for(let s in n.hooks){if(!(s in i))throw new Error(`hook '${s}' does not exist`);if(["options","block"].includes(s))continue;let a=s,o=n.hooks[a],l=i[a];S$1.passThroughHooks.has(s)?i[a]=p=>{if(this.defaults.async&&S$1.passThroughHooksRespectAsync.has(s))return (async()=>{let g=await o.call(i,p);return l.call(i,g)})();let c=o.call(i,p);return l.call(i,c)}:i[a]=(...p)=>{if(this.defaults.async)return (async()=>{let g=await o.apply(i,p);return g===false&&(g=await l.apply(i,p)),g})();let c=o.apply(i,p);return c===false&&(c=l.apply(i,p)),c};}r.hooks=i;}if(n.walkTokens){let i=this.defaults.walkTokens,s=n.walkTokens;r.walkTokens=function(a){let o=[];return o.push(s.call(this,a)),i&&(o=o.concat(i.call(this,a))),o};}this.defaults={...this.defaults,...r};}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return x.lex(e,t??this.defaults)}parser(e,t){return b.parse(e,t??this.defaults)}parseMarkdown(e){return (n,r)=>{let i={...r},s={...this.defaults,...i},a=this.onError(!!s.silent,!!s.async);if(this.defaults.async===true&&i.async===false)return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof n>"u"||n===null)return a(new Error("marked(): input parameter is undefined or null"));if(typeof n!="string")return a(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(n)+", string expected"));if(s.hooks&&(s.hooks.options=s,s.hooks.block=e),s.async)return (async()=>{let o=s.hooks?await s.hooks.preprocess(n):n,p=await(s.hooks?await s.hooks.provideLexer():e?x.lex:x.lexInline)(o,s),c=s.hooks?await s.hooks.processAllTokens(p):p;s.walkTokens&&await Promise.all(this.walkTokens(c,s.walkTokens));let h=await(s.hooks?await s.hooks.provideParser():e?b.parse:b.parseInline)(c,s);return s.hooks?await s.hooks.postprocess(h):h})().catch(a);try{s.hooks&&(n=s.hooks.preprocess(n));let l=(s.hooks?s.hooks.provideLexer():e?x.lex:x.lexInline)(n,s);s.hooks&&(l=s.hooks.processAllTokens(l)),s.walkTokens&&this.walkTokens(l,s.walkTokens);let c=(s.hooks?s.hooks.provideParser():e?b.parse:b.parseInline)(l,s);return s.hooks&&(c=s.hooks.postprocess(c)),c}catch(o){return a(o)}}}onError(e,t){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let r="<p>An error occurred:</p><pre>"+w(n.message+"",true)+"</pre>";return t?Promise.resolve(r):r}if(t)return Promise.reject(n);throw n}}};var _=new B;function d(u,e){return _.parse(u,e)}d.options=d.setOptions=function(u){return _.setOptions(u),d.defaults=_.defaults,Z(d.defaults),d};d.getDefaults=L;d.defaults=T$1;d.use=function(...u){return _.use(...u),d.defaults=_.defaults,Z(d.defaults),d};d.walkTokens=function(u,e){return _.walkTokens(u,e)};d.parseInline=_.parseInline;d.Parser=b;d.parser=b.parse;d.Renderer=P;d.TextRenderer=$;d.Lexer=x;d.lexer=x.lex;d.Tokenizer=y;d.Hooks=S$1;d.parse=d;d.options;d.setOptions;d.use;d.walkTokens;d.parseInline;b.parse;x.lex;

/**
 * Lexing or parsing positional information for error reporting.
 * This object is immutable.
 */
class SourceLocation {
  // The + prefix indicates that these fields aren't writeable
  // Lexer holding the input string.
  // Start offset, zero-based inclusive.
  // End offset, zero-based exclusive.
  constructor(lexer, start, end) {
    this.lexer = void 0;
    this.start = void 0;
    this.end = void 0;
    this.lexer = lexer;
    this.start = start;
    this.end = end;
  }
  /**
   * Merges two `SourceLocation`s from location providers, given they are
   * provided in order of appearance.
   * - Returns the first one's location if only the first is provided.
   * - Returns a merged range of the first and the last if both are provided
   *   and their lexers match.
   * - Otherwise, returns null.
   */


  static range(first, second) {
    if (!second) {
      return first && first.loc;
    } else if (!first || !first.loc || !second.loc || first.loc.lexer !== second.loc.lexer) {
      return null;
    } else {
      return new SourceLocation(first.loc.lexer, first.loc.start, second.loc.end);
    }
  }

}

/**
 * Interface required to break circular dependency between Token, Lexer, and
 * ParseError.
 */

/**
 * The resulting token returned from `lex`.
 *
 * It consists of the token text plus some position information.
 * The position information is essentially a range in an input string,
 * but instead of referencing the bare input string, we refer to the lexer.
 * That way it is possible to attach extra metadata to the input string,
 * like for example a file name or similar.
 *
 * The position information is optional, so it is OK to construct synthetic
 * tokens if appropriate. Not providing available position information may
 * lead to degraded error reporting, though.
 */
class Token {
  // don't expand the token
  // used in \noexpand
  constructor(text, // the text of this token
  loc) {
    this.text = void 0;
    this.loc = void 0;
    this.noexpand = void 0;
    this.treatAsRelax = void 0;
    this.text = text;
    this.loc = loc;
  }
  /**
   * Given a pair of tokens (this and endToken), compute a `Token` encompassing
   * the whole input range enclosed by these two.
   */


  range(endToken, // last token of the range, inclusive
  text // the text of the newly constructed token
  ) {
    return new Token(text, SourceLocation.range(this, endToken));
  }

}

/**
 * This is the ParseError class, which is the main error thrown by KaTeX
 * functions when something has gone wrong. This is used to distinguish internal
 * errors from errors in the expression that the user provided.
 *
 * If possible, a caller should provide a Token or ParseNode with information
 * about where in the source string the problem occurred.
 */
class ParseError {
  // Error start position based on passed-in Token or ParseNode.
  // Length of affected text based on passed-in Token or ParseNode.
  // The underlying error message without any context added.
  constructor(message, // The error message
  token // An object providing position information
  ) {
    this.name = void 0;
    this.position = void 0;
    this.length = void 0;
    this.rawMessage = void 0;
    var error = "KaTeX parse error: " + message;
    var start;
    var end;
    var loc = token && token.loc;

    if (loc && loc.start <= loc.end) {
      // If we have the input and a position, make the error a bit fancier
      // Get the input
      var input = loc.lexer.input; // Prepend some information

      start = loc.start;
      end = loc.end;

      if (start === input.length) {
        error += " at end of input: ";
      } else {
        error += " at position " + (start + 1) + ": ";
      } // Underline token in question using combining underscores


      var underlined = input.slice(start, end).replace(/[^]/g, "$&\u0332"); // Extract some context from the input and add it to the error

      var left;

      if (start > 15) {
        left = "…" + input.slice(start - 15, start);
      } else {
        left = input.slice(0, start);
      }

      var right;

      if (end + 15 < input.length) {
        right = input.slice(end, end + 15) + "…";
      } else {
        right = input.slice(end);
      }

      error += left + underlined + right;
    } // Some hackery to make ParseError a prototype of Error
    // See http://stackoverflow.com/a/8460753
    // $FlowFixMe


    var self = new Error(error);
    self.name = "ParseError"; // $FlowFixMe

    self.__proto__ = ParseError.prototype;
    self.position = start;

    if (start != null && end != null) {
      self.length = end - start;
    }

    self.rawMessage = message;
    return self;
  }

} // $FlowFixMe More hackery


ParseError.prototype.__proto__ = Error.prototype;

/**
 * This file contains a list of utility functions which are useful in other
 * files.
 */

/**
 * Provide a default value if a setting is undefined
 * NOTE: Couldn't use `T` as the output type due to facebook/flow#5022.
 */
var deflt = function deflt(setting, defaultIfUndefined) {
  return setting === undefined ? defaultIfUndefined : setting;
}; // hyphenate and escape adapted from Facebook's React under Apache 2 license


var uppercase = /([A-Z])/g;

var hyphenate = function hyphenate(str) {
  return str.replace(uppercase, "-$1").toLowerCase();
};

var ESCAPE_LOOKUP = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  "\"": "&quot;",
  "'": "&#x27;"
};
var ESCAPE_REGEX = /[&><"']/g;
/**
 * Escapes text to prevent scripting attacks.
 */

function escape(text) {
  return String(text).replace(ESCAPE_REGEX, match => ESCAPE_LOOKUP[match]);
}
/**
 * Sometimes we want to pull out the innermost element of a group. In most
 * cases, this will just be the group itself, but when ordgroups and colors have
 * a single element, we want to pull that out.
 */


var getBaseElem = function getBaseElem(group) {
  if (group.type === "ordgroup") {
    if (group.body.length === 1) {
      return getBaseElem(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "color") {
    if (group.body.length === 1) {
      return getBaseElem(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "font") {
    return getBaseElem(group.body);
  } else {
    return group;
  }
};
/**
 * TeXbook algorithms often reference "character boxes", which are simply groups
 * with a single character in them. To decide if something is a character box,
 * we find its innermost group, and see if it is a single character.
 */


var isCharacterBox = function isCharacterBox(group) {
  var baseElem = getBaseElem(group); // These are all they types of groups which hold single characters

  return baseElem.type === "mathord" || baseElem.type === "textord" || baseElem.type === "atom";
};

var assert = function assert(value) {
  if (!value) {
    throw new Error('Expected non-null, but got ' + String(value));
  }

  return value;
};
/**
 * Return the protocol of a URL, or "_relative" if the URL does not specify a
 * protocol (and thus is relative), or `null` if URL has invalid protocol
 * (so should be outright rejected).
 */

var protocolFromUrl = function protocolFromUrl(url) {
  // Check for possible leading protocol.
  // https://url.spec.whatwg.org/#url-parsing strips leading whitespace
  // (U+20) or C0 control (U+00-U+1F) characters.
  // eslint-disable-next-line no-control-regex
  var protocol = /^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(url);

  if (!protocol) {
    return "_relative";
  } // Reject weird colons


  if (protocol[2] !== ":") {
    return null;
  } // Reject invalid characters in scheme according to
  // https://datatracker.ietf.org/doc/html/rfc3986#section-3.1


  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(protocol[1])) {
    return null;
  } // Lowercase the protocol


  return protocol[1].toLowerCase();
};
var utils = {
  deflt,
  escape,
  hyphenate,
  getBaseElem,
  isCharacterBox,
  protocolFromUrl
};

/* eslint no-console:0 */
// TODO: automatically generate documentation
// TODO: check all properties on Settings exist
// TODO: check the type of a property on Settings matches
var SETTINGS_SCHEMA = {
  displayMode: {
    type: "boolean",
    description: "Render math in display mode, which puts the math in " + "display style (so \\int and \\sum are large, for example), and " + "centers the math on the page on its own line.",
    cli: "-d, --display-mode"
  },
  output: {
    type: {
      enum: ["htmlAndMathml", "html", "mathml"]
    },
    description: "Determines the markup language of the output.",
    cli: "-F, --format <type>"
  },
  leqno: {
    type: "boolean",
    description: "Render display math in leqno style (left-justified tags)."
  },
  fleqn: {
    type: "boolean",
    description: "Render display math flush left."
  },
  throwOnError: {
    type: "boolean",
    default: true,
    cli: "-t, --no-throw-on-error",
    cliDescription: "Render errors (in the color given by --error-color) ins" + "tead of throwing a ParseError exception when encountering an error."
  },
  errorColor: {
    type: "string",
    default: "#cc0000",
    cli: "-c, --error-color <color>",
    cliDescription: "A color string given in the format 'rgb' or 'rrggbb' " + "(no #). This option determines the color of errors rendered by the " + "-t option.",
    cliProcessor: color => "#" + color
  },
  macros: {
    type: "object",
    cli: "-m, --macro <def>",
    cliDescription: "Define custom macro of the form '\\foo:expansion' (use " + "multiple -m arguments for multiple macros).",
    cliDefault: [],
    cliProcessor: (def, defs) => {
      defs.push(def);
      return defs;
    }
  },
  minRuleThickness: {
    type: "number",
    description: "Specifies a minimum thickness, in ems, for fraction lines," + " `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, " + "`\\hdashline`, `\\underline`, `\\overline`, and the borders of " + "`\\fbox`, `\\boxed`, and `\\fcolorbox`.",
    processor: t => Math.max(0, t),
    cli: "--min-rule-thickness <size>",
    cliProcessor: parseFloat
  },
  colorIsTextColor: {
    type: "boolean",
    description: "Makes \\color behave like LaTeX's 2-argument \\textcolor, " + "instead of LaTeX's one-argument \\color mode change.",
    cli: "-b, --color-is-text-color"
  },
  strict: {
    type: [{
      enum: ["warn", "ignore", "error"]
    }, "boolean", "function"],
    description: "Turn on strict / LaTeX faithfulness mode, which throws an " + "error if the input uses features that are not supported by LaTeX.",
    cli: "-S, --strict",
    cliDefault: false
  },
  trust: {
    type: ["boolean", "function"],
    description: "Trust the input, enabling all HTML features such as \\url.",
    cli: "-T, --trust"
  },
  maxSize: {
    type: "number",
    default: Infinity,
    description: "If non-zero, all user-specified sizes, e.g. in " + "\\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, " + "elements and spaces can be arbitrarily large",
    processor: s => Math.max(0, s),
    cli: "-s, --max-size <n>",
    cliProcessor: parseInt
  },
  maxExpand: {
    type: "number",
    default: 1000,
    description: "Limit the number of macro expansions to the specified " + "number, to prevent e.g. infinite macro loops. If set to Infinity, " + "the macro expander will try to fully expand as in LaTeX.",
    processor: n => Math.max(0, n),
    cli: "-e, --max-expand <n>",
    cliProcessor: n => n === "Infinity" ? Infinity : parseInt(n)
  },
  globalGroup: {
    type: "boolean",
    cli: false
  }
};

function getDefaultValue(schema) {
  if (schema.default) {
    return schema.default;
  }

  var type = schema.type;
  var defaultType = Array.isArray(type) ? type[0] : type;

  if (typeof defaultType !== 'string') {
    return defaultType.enum[0];
  }

  switch (defaultType) {
    case 'boolean':
      return false;

    case 'string':
      return '';

    case 'number':
      return 0;

    case 'object':
      return {};
  }
}
/**
 * The main Settings object
 *
 * The current options stored are:
 *  - displayMode: Whether the expression should be typeset as inline math
 *                 (false, the default), meaning that the math starts in
 *                 \textstyle and is placed in an inline-block); or as display
 *                 math (true), meaning that the math starts in \displaystyle
 *                 and is placed in a block with vertical margin.
 */


class Settings {
  constructor(options) {
    this.displayMode = void 0;
    this.output = void 0;
    this.leqno = void 0;
    this.fleqn = void 0;
    this.throwOnError = void 0;
    this.errorColor = void 0;
    this.macros = void 0;
    this.minRuleThickness = void 0;
    this.colorIsTextColor = void 0;
    this.strict = void 0;
    this.trust = void 0;
    this.maxSize = void 0;
    this.maxExpand = void 0;
    this.globalGroup = void 0;
    // allow null options
    options = options || {};

    for (var prop in SETTINGS_SCHEMA) {
      if (SETTINGS_SCHEMA.hasOwnProperty(prop)) {
        // $FlowFixMe
        var schema = SETTINGS_SCHEMA[prop]; // TODO: validate options
        // $FlowFixMe

        this[prop] = options[prop] !== undefined ? schema.processor ? schema.processor(options[prop]) : options[prop] : getDefaultValue(schema);
      }
    }
  }
  /**
   * Report nonstrict (non-LaTeX-compatible) input.
   * Can safely not be called if `this.strict` is false in JavaScript.
   */


  reportNonstrict(errorCode, errorMsg, token) {
    var strict = this.strict;

    if (typeof strict === "function") {
      // Allow return value of strict function to be boolean or string
      // (or null/undefined, meaning no further processing).
      strict = strict(errorCode, errorMsg, token);
    }

    if (!strict || strict === "ignore") {
      return;
    } else if (strict === true || strict === "error") {
      throw new ParseError("LaTeX-incompatible input and strict mode is set to 'error': " + (errorMsg + " [" + errorCode + "]"), token);
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
    } else {
      // won't happen in type-safe code
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
    }
  }
  /**
   * Check whether to apply strict (LaTeX-adhering) behavior for unusual
   * input (like `\\`).  Unlike `nonstrict`, will not throw an error;
   * instead, "error" translates to a return value of `true`, while "ignore"
   * translates to a return value of `false`.  May still print a warning:
   * "warn" prints a warning and returns `false`.
   * This is for the second category of `errorCode`s listed in the README.
   */


  useStrictBehavior(errorCode, errorMsg, token) {
    var strict = this.strict;

    if (typeof strict === "function") {
      // Allow return value of strict function to be boolean or string
      // (or null/undefined, meaning no further processing).
      // But catch any exceptions thrown by function, treating them
      // like "error".
      try {
        strict = strict(errorCode, errorMsg, token);
      } catch (error) {
        strict = "error";
      }
    }

    if (!strict || strict === "ignore") {
      return false;
    } else if (strict === true || strict === "error") {
      return true;
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
      return false;
    } else {
      // won't happen in type-safe code
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
      return false;
    }
  }
  /**
   * Check whether to test potentially dangerous input, and return
   * `true` (trusted) or `false` (untrusted).  The sole argument `context`
   * should be an object with `command` field specifying the relevant LaTeX
   * command (as a string starting with `\`), and any other arguments, etc.
   * If `context` has a `url` field, a `protocol` field will automatically
   * get added by this function (changing the specified object).
   */


  isTrusted(context) {
    if (context.url && !context.protocol) {
      var protocol = utils.protocolFromUrl(context.url);

      if (protocol == null) {
        return false;
      }

      context.protocol = protocol;
    }

    var trust = typeof this.trust === "function" ? this.trust(context) : this.trust;
    return Boolean(trust);
  }

}

/**
 * This file contains information and classes for the various kinds of styles
 * used in TeX. It provides a generic `Style` class, which holds information
 * about a specific style. It then provides instances of all the different kinds
 * of styles possible, and provides functions to move between them and get
 * information about them.
 */

/**
 * The main style class. Contains a unique id for the style, a size (which is
 * the same for cramped and uncramped version of a style), and a cramped flag.
 */
class Style {
  constructor(id, size, cramped) {
    this.id = void 0;
    this.size = void 0;
    this.cramped = void 0;
    this.id = id;
    this.size = size;
    this.cramped = cramped;
  }
  /**
   * Get the style of a superscript given a base in the current style.
   */


  sup() {
    return styles[sup[this.id]];
  }
  /**
   * Get the style of a subscript given a base in the current style.
   */


  sub() {
    return styles[sub[this.id]];
  }
  /**
   * Get the style of a fraction numerator given the fraction in the current
   * style.
   */


  fracNum() {
    return styles[fracNum[this.id]];
  }
  /**
   * Get the style of a fraction denominator given the fraction in the current
   * style.
   */


  fracDen() {
    return styles[fracDen[this.id]];
  }
  /**
   * Get the cramped version of a style (in particular, cramping a cramped style
   * doesn't change the style).
   */


  cramp() {
    return styles[cramp[this.id]];
  }
  /**
   * Get a text or display version of this style.
   */


  text() {
    return styles[text$1[this.id]];
  }
  /**
   * Return true if this style is tightly spaced (scriptstyle/scriptscriptstyle)
   */


  isTight() {
    return this.size >= 2;
  }

} // Export an interface for type checking, but don't expose the implementation.
// This way, no more styles can be generated.


// IDs of the different styles
var D = 0;
var Dc = 1;
var T = 2;
var Tc = 3;
var S = 4;
var Sc = 5;
var SS = 6;
var SSc = 7; // Instances of the different styles

var styles = [new Style(D, 0, false), new Style(Dc, 0, true), new Style(T, 1, false), new Style(Tc, 1, true), new Style(S, 2, false), new Style(Sc, 2, true), new Style(SS, 3, false), new Style(SSc, 3, true)]; // Lookup tables for switching from one style to another

var sup = [S, Sc, S, Sc, SS, SSc, SS, SSc];
var sub = [Sc, Sc, Sc, Sc, SSc, SSc, SSc, SSc];
var fracNum = [T, Tc, S, Sc, SS, SSc, SS, SSc];
var fracDen = [Tc, Tc, Sc, Sc, SSc, SSc, SSc, SSc];
var cramp = [Dc, Dc, Tc, Tc, Sc, Sc, SSc, SSc];
var text$1 = [D, Dc, T, Tc, T, Tc, T, Tc]; // We only export some of the styles.

var Style$1 = {
  DISPLAY: styles[D],
  TEXT: styles[T],
  SCRIPT: styles[S],
  SCRIPTSCRIPT: styles[SS]
};

/*
 * This file defines the Unicode scripts and script families that we
 * support. To add new scripts or families, just add a new entry to the
 * scriptData array below. Adding scripts to the scriptData array allows
 * characters from that script to appear in \text{} environments.
 */

/**
 * Each script or script family has a name and an array of blocks.
 * Each block is an array of two numbers which specify the start and
 * end points (inclusive) of a block of Unicode codepoints.
 */

/**
 * Unicode block data for the families of scripts we support in \text{}.
 * Scripts only need to appear here if they do not have font metrics.
 */
var scriptData = [{
  // Latin characters beyond the Latin-1 characters we have metrics for.
  // Needed for Czech, Hungarian and Turkish text, for example.
  name: 'latin',
  blocks: [[0x0100, 0x024f], // Latin Extended-A and Latin Extended-B
  [0x0300, 0x036f] // Combining Diacritical marks
  ]
}, {
  // The Cyrillic script used by Russian and related languages.
  // A Cyrillic subset used to be supported as explicitly defined
  // symbols in symbols.js
  name: 'cyrillic',
  blocks: [[0x0400, 0x04ff]]
}, {
  // Armenian
  name: 'armenian',
  blocks: [[0x0530, 0x058F]]
}, {
  // The Brahmic scripts of South and Southeast Asia
  // Devanagari (0900–097F)
  // Bengali (0980–09FF)
  // Gurmukhi (0A00–0A7F)
  // Gujarati (0A80–0AFF)
  // Oriya (0B00–0B7F)
  // Tamil (0B80–0BFF)
  // Telugu (0C00–0C7F)
  // Kannada (0C80–0CFF)
  // Malayalam (0D00–0D7F)
  // Sinhala (0D80–0DFF)
  // Thai (0E00–0E7F)
  // Lao (0E80–0EFF)
  // Tibetan (0F00–0FFF)
  // Myanmar (1000–109F)
  name: 'brahmic',
  blocks: [[0x0900, 0x109F]]
}, {
  name: 'georgian',
  blocks: [[0x10A0, 0x10ff]]
}, {
  // Chinese and Japanese.
  // The "k" in cjk is for Korean, but we've separated Korean out
  name: "cjk",
  blocks: [[0x3000, 0x30FF], // CJK symbols and punctuation, Hiragana, Katakana
  [0x4E00, 0x9FAF], // CJK ideograms
  [0xFF00, 0xFF60] // Fullwidth punctuation
  // TODO: add halfwidth Katakana and Romanji glyphs
  ]
}, {
  // Korean
  name: 'hangul',
  blocks: [[0xAC00, 0xD7AF]]
}];
/**
 * Given a codepoint, return the name of the script or script family
 * it is from, or null if it is not part of a known block
 */

function scriptFromCodepoint(codepoint) {
  for (var i = 0; i < scriptData.length; i++) {
    var script = scriptData[i];

    for (var _i = 0; _i < script.blocks.length; _i++) {
      var block = script.blocks[_i];

      if (codepoint >= block[0] && codepoint <= block[1]) {
        return script.name;
      }
    }
  }

  return null;
}
/**
 * A flattened version of all the supported blocks in a single array.
 * This is an optimization to make supportedCodepoint() fast.
 */

var allBlocks = [];
scriptData.forEach(s => s.blocks.forEach(b => allBlocks.push(...b)));
/**
 * Given a codepoint, return true if it falls within one of the
 * scripts or script families defined above and false otherwise.
 *
 * Micro benchmarks shows that this is faster than
 * /[\u3000-\u30FF\u4E00-\u9FAF\uFF00-\uFF60\uAC00-\uD7AF\u0900-\u109F]/.test()
 * in Firefox, Chrome and Node.
 */

function supportedCodepoint(codepoint) {
  for (var i = 0; i < allBlocks.length; i += 2) {
    if (codepoint >= allBlocks[i] && codepoint <= allBlocks[i + 1]) {
      return true;
    }
  }

  return false;
}

/**
 * This file provides support to domTree.js and delimiter.js.
 * It's a storehouse of path geometry for SVG images.
 */
// In all paths below, the viewBox-to-em scale is 1000:1.
var hLinePad = 80; // padding above a sqrt vinculum. Prevents image cropping.
// The vinculum of a \sqrt can be made thicker by a KaTeX rendering option.
// Think of variable extraVinculum as two detours in the SVG path.
// The detour begins at the lower left of the area labeled extraVinculum below.
// The detour proceeds one extraVinculum distance up and slightly to the right,
// displacing the radiused corner between surd and vinculum. The radius is
// traversed as usual, then the detour resumes. It goes right, to the end of
// the very long vinculum, then down one extraVinculum distance,
// after which it resumes regular path geometry for the radical.

/*                                                  vinculum
                                                   /
         /▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒←extraVinculum
        / █████████████████████←0.04em (40 unit) std vinculum thickness
       / /
      / /
     / /\
    / / surd
*/

var sqrtMain = function sqrtMain(extraVinculum, hLinePad) {
  // sqrtMain path geometry is from glyph U221A in the font KaTeX Main
  return "M95," + (622 + extraVinculum + hLinePad) + "\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl" + extraVinculum / 2.075 + " -" + extraVinculum + "\nc5.3,-9.3,12,-14,20,-14\nH400000v" + (40 + extraVinculum) + "H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM" + (834 + extraVinculum) + " " + hLinePad + "h400000v" + (40 + extraVinculum) + "h-400000z";
};

var sqrtSize1 = function sqrtSize1(extraVinculum, hLinePad) {
  // size1 is from glyph U221A in the font KaTeX_Size1-Regular
  return "M263," + (601 + extraVinculum + hLinePad) + "c0.7,0,18,39.7,52,119\nc34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120\nc340,-704.7,510.7,-1060.3,512,-1067\nl" + extraVinculum / 2.084 + " -" + extraVinculum + "\nc4.7,-7.3,11,-11,19,-11\nH40000v" + (40 + extraVinculum) + "H1012.3\ns-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232\nc-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1\ns-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26\nc-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z\nM" + (1001 + extraVinculum) + " " + hLinePad + "h400000v" + (40 + extraVinculum) + "h-400000z";
};

var sqrtSize2 = function sqrtSize2(extraVinculum, hLinePad) {
  // size2 is from glyph U221A in the font KaTeX_Size2-Regular
  return "M983 " + (10 + extraVinculum + hLinePad) + "\nl" + extraVinculum / 3.13 + " -" + extraVinculum + "\nc4,-6.7,10,-10,18,-10 H400000v" + (40 + extraVinculum) + "\nH1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7\ns-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744\nc-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30\nc26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722\nc56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5\nc53.7,-170.3,84.5,-266.8,92.5,-289.5z\nM" + (1001 + extraVinculum) + " " + hLinePad + "h400000v" + (40 + extraVinculum) + "h-400000z";
};

var sqrtSize3 = function sqrtSize3(extraVinculum, hLinePad) {
  // size3 is from glyph U221A in the font KaTeX_Size3-Regular
  return "M424," + (2398 + extraVinculum + hLinePad) + "\nc-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514\nc0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20\ns-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121\ns209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081\nl" + extraVinculum / 4.223 + " -" + extraVinculum + "c4,-6.7,10,-10,18,-10 H400000\nv" + (40 + extraVinculum) + "H1014.6\ns-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185\nc-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2z M" + (1001 + extraVinculum) + " " + hLinePad + "\nh400000v" + (40 + extraVinculum) + "h-400000z";
};

var sqrtSize4 = function sqrtSize4(extraVinculum, hLinePad) {
  // size4 is from glyph U221A in the font KaTeX_Size4-Regular
  return "M473," + (2713 + extraVinculum + hLinePad) + "\nc339.3,-1799.3,509.3,-2700,510,-2702 l" + extraVinculum / 5.298 + " -" + extraVinculum + "\nc3.3,-7.3,9.3,-11,18,-11 H400000v" + (40 + extraVinculum) + "H1017.7\ns-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200\nc0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26\ns76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,\n606zM" + (1001 + extraVinculum) + " " + hLinePad + "h400000v" + (40 + extraVinculum) + "H1017.7z";
};

var phasePath = function phasePath(y) {
  var x = y / 2; // x coordinate at top of angle

  return "M400000 " + y + " H0 L" + x + " 0 l65 45 L145 " + (y - 80) + " H400000z";
};

var sqrtTall = function sqrtTall(extraVinculum, hLinePad, viewBoxHeight) {
  // sqrtTall is from glyph U23B7 in the font KaTeX_Size4-Regular
  // One path edge has a variable length. It runs vertically from the vinculum
  // to a point near (14 units) the bottom of the surd. The vinculum
  // is normally 40 units thick. So the length of the line in question is:
  var vertSegment = viewBoxHeight - 54 - hLinePad - extraVinculum;
  return "M702 " + (extraVinculum + hLinePad) + "H400000" + (40 + extraVinculum) + "\nH742v" + vertSegment + "l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1\nh-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170\nc-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667\n219 661 l218 661zM702 " + hLinePad + "H400000v" + (40 + extraVinculum) + "H742z";
};

var sqrtPath = function sqrtPath(size, extraVinculum, viewBoxHeight) {
  extraVinculum = 1000 * extraVinculum; // Convert from document ems to viewBox.

  var path = "";

  switch (size) {
    case "sqrtMain":
      path = sqrtMain(extraVinculum, hLinePad);
      break;

    case "sqrtSize1":
      path = sqrtSize1(extraVinculum, hLinePad);
      break;

    case "sqrtSize2":
      path = sqrtSize2(extraVinculum, hLinePad);
      break;

    case "sqrtSize3":
      path = sqrtSize3(extraVinculum, hLinePad);
      break;

    case "sqrtSize4":
      path = sqrtSize4(extraVinculum, hLinePad);
      break;

    case "sqrtTall":
      path = sqrtTall(extraVinculum, hLinePad, viewBoxHeight);
  }

  return path;
};
var innerPath = function innerPath(name, height) {
  // The inner part of stretchy tall delimiters
  switch (name) {
    case "\u239c":
      return "M291 0 H417 V" + height + " H291z M291 0 H417 V" + height + " H291z";

    case "\u2223":
      return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z";

    case "\u2225":
      return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z" + ("M367 0 H410 V" + height + " H367z M367 0 H410 V" + height + " H367z");

    case "\u239f":
      return "M457 0 H583 V" + height + " H457z M457 0 H583 V" + height + " H457z";

    case "\u23a2":
      return "M319 0 H403 V" + height + " H319z M319 0 H403 V" + height + " H319z";

    case "\u23a5":
      return "M263 0 H347 V" + height + " H263z M263 0 H347 V" + height + " H263z";

    case "\u23aa":
      return "M384 0 H504 V" + height + " H384z M384 0 H504 V" + height + " H384z";

    case "\u23d0":
      return "M312 0 H355 V" + height + " H312z M312 0 H355 V" + height + " H312z";

    case "\u2016":
      return "M257 0 H300 V" + height + " H257z M257 0 H300 V" + height + " H257z" + ("M478 0 H521 V" + height + " H478z M478 0 H521 V" + height + " H478z");

    default:
      return "";
  }
};
var path = {
  // The doubleleftarrow geometry is from glyph U+21D0 in the font KaTeX Main
  doubleleftarrow: "M262 157\nl10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3\n 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28\n 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5\nc2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5\n 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87\n-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7\n-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z\nm8 0v40h399730v-40zm0 194v40h399730v-40z",
  // doublerightarrow is from glyph U+21D2 in font KaTeX Main
  doublerightarrow: "M399738 392l\n-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5\n 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88\n-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68\n-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18\n-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782\nc-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3\n-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z",
  // leftarrow is from glyph U+2190 in font KaTeX Main
  leftarrow: "M400000 241H110l3-3c68.7-52.7 113.7-120\n 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8\n-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247\nc-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208\n 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3\n 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202\n l-3-3h399890zM100 241v40h399900v-40z",
  // overbrace is from glyphs U+23A9/23A8/23A7 in font KaTeX_Size4-Regular
  leftbrace: "M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117\n-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7\n 5-6 9-10 13-.7 1-7.3 1-20 1H6z",
  leftbraceunder: "M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13\n 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688\n 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7\n-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z",
  // overgroup is from the MnSymbol package (public domain)
  leftgroup: "M400000 80\nH435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0\n 435 0h399565z",
  leftgroupunder: "M400000 262\nH435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219\n 435 219h399565z",
  // Harpoons are from glyph U+21BD in font KaTeX Main
  leftharpoon: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3\n-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5\n-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7\n-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z",
  leftharpoonplus: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5\n 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3\n-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7\n-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z\nm0 0v40h400000v-40z",
  leftharpoondown: "M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333\n 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5\n 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667\n-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z",
  leftharpoondownplus: "M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12\n 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7\n-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0\nv40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z",
  // hook is from glyph U+21A9 in font KaTeX Main
  lefthook: "M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5\n-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3\n-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21\n 71.5 23h399859zM103 281v-40h399897v40z",
  leftlinesegment: "M40 281 V428 H0 V94 H40 V241 H400000 v40z\nM40 281 V428 H0 V94 H40 V241 H400000 v40z",
  leftmapsto: "M40 281 V448H0V74H40V241H400000v40z\nM40 281 V448H0V74H40V241H400000v40z",
  // tofrom is from glyph U+21C4 in font KaTeX AMS Regular
  leftToFrom: "M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23\n-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8\nc28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3\n 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z",
  longequal: "M0 50 h400000 v40H0z m0 194h40000v40H0z\nM0 50 h400000 v40H0z m0 194h40000v40H0z",
  midbrace: "M200428 334\nc-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14\n-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7\n 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11\n 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z",
  midbraceunder: "M199572 214\nc100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14\n 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3\n 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0\n-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z",
  oiintSize1: "M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6\n-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z\nm368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8\n60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z",
  oiintSize2: "M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8\n-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z\nm502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2\nc0 110 84 276 504 276s502.4-166 502.4-276z",
  oiiintSize1: "M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6\n-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z\nm525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0\n85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z",
  oiiintSize2: "M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8\n-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z\nm770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1\nc0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z",
  rightarrow: "M0 241v40h399891c-47.3 35.3-84 78-110 128\n-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20\n 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7\n 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85\n-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n 151.7 139 205zm0 0v40h399900v-40z",
  rightbrace: "M400000 542l\n-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5\ns-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1\nc124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z",
  rightbraceunder: "M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3\n 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237\n-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z",
  rightgroup: "M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0\n 3-1 3-3v-38c-76-158-257-219-435-219H0z",
  rightgroupunder: "M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18\n 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z",
  rightharpoon: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3\n-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2\n-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58\n 69.2 92 94.5zm0 0v40h399900v-40z",
  rightharpoonplus: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11\n-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7\n 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z\nm0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z",
  rightharpoondown: "M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8\n 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5\n-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95\n-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z",
  rightharpoondownplus: "M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8\n 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3\n 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3\n-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z\nm0-194v40h400000v-40zm0 0v40h400000v-40z",
  righthook: "M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3\n 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0\n-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21\n 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z",
  rightlinesegment: "M399960 241 V94 h40 V428 h-40 V281 H0 v-40z\nM399960 241 V94 h40 V428 h-40 V281 H0 v-40z",
  rightToFrom: "M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23\n 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32\n-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142\n-167z M100 147v40h399900v-40zM0 341v40h399900v-40z",
  // twoheadleftarrow is from glyph U+219E in font KaTeX AMS Regular
  twoheadleftarrow: "M0 167c68 40\n 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69\n-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3\n-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19\n-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101\n 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z",
  twoheadrightarrow: "M400000 167\nc-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3\n 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42\n 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333\n-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70\n 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z",
  // tilde1 is a modified version of a glyph from the MnSymbol package
  tilde1: "M200 55.538c-77 0-168 73.953-177 73.953-3 0-7\n-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0\n 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0\n 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128\n-68.267.847-113-73.952-191-73.952z",
  // ditto tilde2, tilde3, & tilde4
  tilde2: "M344 55.266c-142 0-300.638 81.316-311.5 86.418\n-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9\n 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114\nc1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751\n 181.476 676 181.476c-149 0-189-126.21-332-126.21z",
  tilde3: "M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457\n-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0\n 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697\n 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696\n -338 0-409-156.573-744-156.573z",
  tilde4: "M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345\n-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409\n 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9\n 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409\n -175.236-744-175.236z",
  // vec is from glyph U+20D7 in font KaTeX Main
  vec: "M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5\n3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11\n10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63\n-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1\n-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59\nH213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359\nc-16-25.333-24-45-24-59z",
  // widehat1 is a modified version of a glyph from the MnSymbol package
  widehat1: "M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22\nc-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z",
  // ditto widehat2, widehat3, & widehat4
  widehat2: "M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat3: "M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat4: "M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  // widecheck paths are all inverted versions of widehat
  widecheck1: "M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,\n-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z",
  widecheck2: "M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck3: "M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck4: "M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  // The next ten paths support reaction arrows from the mhchem package.
  // Arrows for \ce{<-->} are offset from xAxis by 0.22ex, per mhchem in LaTeX
  // baraboveleftarrow is mostly from glyph U+2190 in font KaTeX Main
  baraboveleftarrow: "M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202\nc4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5\nc-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130\ns-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47\n121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6\ns2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11\nc0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z\nM100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z",
  // rightarrowabovebar is mostly from glyph U+2192, KaTeX Main
  rightarrowabovebar: "M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32\n-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0\n13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39\n-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5\n-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z",
  // The short left harpoon has 0.5em (i.e. 500 units) kern on the left end.
  // Ref from mhchem.sty: \rlap{\raisebox{-.22ex}{$\kern0.5em
  baraboveshortleftharpoon: "M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17\nc2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21\nc-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40\nc-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z\nM0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z",
  rightharpoonaboveshortbar: "M0,241 l0,40c399126,0,399993,0,399993,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z",
  shortbaraboveleftharpoon: "M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,\n1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,\n-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z\nM93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z",
  shortrightharpoonabovebar: "M53,241l0,40c398570,0,399437,0,399437,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z"
};
var tallDelim = function tallDelim(label, midHeight) {
  switch (label) {
    case "lbrack":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v1759 h347 v-84\nH403z M403 1759 V0 H319 V1759 v" + midHeight + " v1759 h84z";

    case "rbrack":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v1759 H0 v84 H347z\nM347 1759 V0 H263 V1759 v" + midHeight + " v1759 h84z";

    case "vert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z";

    case "doublevert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z\nM367 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M410 15 H367 v585 v" + midHeight + " v585 h43z";

    case "lfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1715 h263 v84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";

    case "rfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1799 H0 v-84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";

    case "lceil":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v602 h84z\nM403 1759 V0 H319 V1759 v" + midHeight + " v602 h84z";

    case "rceil":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v602 h84z\nM347 1759 V0 h-84 V1759 v" + midHeight + " v602 h84z";

    case "lparen":
      return "M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1\nc-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,\n-36,557 l0," + (midHeight + 84) + "c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,\n949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9\nc0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,\n-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189\nl0,-" + (midHeight + 92) + "c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,\n-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z";

    case "rparen":
      return "M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,\n63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5\nc11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0," + (midHeight + 9) + "\nc-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664\nc-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11\nc0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17\nc242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558\nl0,-" + (midHeight + 144) + "c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,\n-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z";

    default:
      // We should not ever get here.
      throw new Error("Unknown stretchy delimiter.");
  }
};

// To ensure that all nodes have compatible signatures for these methods.

/**
 * This node represents a document fragment, which contains elements, but when
 * placed into the DOM doesn't have any representation itself. It only contains
 * children and doesn't have any DOM node properties.
 */
class DocumentFragment {
  // Never used; needed for satisfying interface.
  constructor(children) {
    this.children = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.children = children;
    this.classes = [];
    this.height = 0;
    this.depth = 0;
    this.maxFontSize = 0;
    this.style = {};
  }

  hasClass(className) {
    return this.classes.includes(className);
  }
  /** Convert the fragment into a node. */


  toNode() {
    var frag = document.createDocumentFragment();

    for (var i = 0; i < this.children.length; i++) {
      frag.appendChild(this.children[i].toNode());
    }

    return frag;
  }
  /** Convert the fragment into HTML markup. */


  toMarkup() {
    var markup = ""; // Simply concatenate the markup for the children together.

    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }

    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText. Applies to
   * MathDomNode's only.
   */


  toText() {
    // To avoid this, we would subclass documentFragment separately for
    // MathML, but polyfills for subclassing is expensive per PR 1469.
    // $FlowFixMe: Only works for ChildType = MathDomNode.
    var toText = child => child.toText();

    return this.children.map(toText).join("");
  }

}

// This file is GENERATED by buildMetrics.sh. DO NOT MODIFY.
var fontMetricsData = {
  "AMS-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68889, 0, 0, 0.72222],
    "66": [0, 0.68889, 0, 0, 0.66667],
    "67": [0, 0.68889, 0, 0, 0.72222],
    "68": [0, 0.68889, 0, 0, 0.72222],
    "69": [0, 0.68889, 0, 0, 0.66667],
    "70": [0, 0.68889, 0, 0, 0.61111],
    "71": [0, 0.68889, 0, 0, 0.77778],
    "72": [0, 0.68889, 0, 0, 0.77778],
    "73": [0, 0.68889, 0, 0, 0.38889],
    "74": [0.16667, 0.68889, 0, 0, 0.5],
    "75": [0, 0.68889, 0, 0, 0.77778],
    "76": [0, 0.68889, 0, 0, 0.66667],
    "77": [0, 0.68889, 0, 0, 0.94445],
    "78": [0, 0.68889, 0, 0, 0.72222],
    "79": [0.16667, 0.68889, 0, 0, 0.77778],
    "80": [0, 0.68889, 0, 0, 0.61111],
    "81": [0.16667, 0.68889, 0, 0, 0.77778],
    "82": [0, 0.68889, 0, 0, 0.72222],
    "83": [0, 0.68889, 0, 0, 0.55556],
    "84": [0, 0.68889, 0, 0, 0.66667],
    "85": [0, 0.68889, 0, 0, 0.72222],
    "86": [0, 0.68889, 0, 0, 0.72222],
    "87": [0, 0.68889, 0, 0, 1.0],
    "88": [0, 0.68889, 0, 0, 0.72222],
    "89": [0, 0.68889, 0, 0, 0.72222],
    "90": [0, 0.68889, 0, 0, 0.66667],
    "107": [0, 0.68889, 0, 0, 0.55556],
    "160": [0, 0, 0, 0, 0.25],
    "165": [0, 0.675, 0.025, 0, 0.75],
    "174": [0.15559, 0.69224, 0, 0, 0.94666],
    "240": [0, 0.68889, 0, 0, 0.55556],
    "295": [0, 0.68889, 0, 0, 0.54028],
    "710": [0, 0.825, 0, 0, 2.33334],
    "732": [0, 0.9, 0, 0, 2.33334],
    "770": [0, 0.825, 0, 0, 2.33334],
    "771": [0, 0.9, 0, 0, 2.33334],
    "989": [0.08167, 0.58167, 0, 0, 0.77778],
    "1008": [0, 0.43056, 0.04028, 0, 0.66667],
    "8245": [0, 0.54986, 0, 0, 0.275],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8487": [0, 0.68889, 0, 0, 0.72222],
    "8498": [0, 0.68889, 0, 0, 0.55556],
    "8502": [0, 0.68889, 0, 0, 0.66667],
    "8503": [0, 0.68889, 0, 0, 0.44445],
    "8504": [0, 0.68889, 0, 0, 0.66667],
    "8513": [0, 0.68889, 0, 0, 0.63889],
    "8592": [-0.03598, 0.46402, 0, 0, 0.5],
    "8594": [-0.03598, 0.46402, 0, 0, 0.5],
    "8602": [-0.13313, 0.36687, 0, 0, 1.0],
    "8603": [-0.13313, 0.36687, 0, 0, 1.0],
    "8606": [0.01354, 0.52239, 0, 0, 1.0],
    "8608": [0.01354, 0.52239, 0, 0, 1.0],
    "8610": [0.01354, 0.52239, 0, 0, 1.11111],
    "8611": [0.01354, 0.52239, 0, 0, 1.11111],
    "8619": [0, 0.54986, 0, 0, 1.0],
    "8620": [0, 0.54986, 0, 0, 1.0],
    "8621": [-0.13313, 0.37788, 0, 0, 1.38889],
    "8622": [-0.13313, 0.36687, 0, 0, 1.0],
    "8624": [0, 0.69224, 0, 0, 0.5],
    "8625": [0, 0.69224, 0, 0, 0.5],
    "8630": [0, 0.43056, 0, 0, 1.0],
    "8631": [0, 0.43056, 0, 0, 1.0],
    "8634": [0.08198, 0.58198, 0, 0, 0.77778],
    "8635": [0.08198, 0.58198, 0, 0, 0.77778],
    "8638": [0.19444, 0.69224, 0, 0, 0.41667],
    "8639": [0.19444, 0.69224, 0, 0, 0.41667],
    "8642": [0.19444, 0.69224, 0, 0, 0.41667],
    "8643": [0.19444, 0.69224, 0, 0, 0.41667],
    "8644": [0.1808, 0.675, 0, 0, 1.0],
    "8646": [0.1808, 0.675, 0, 0, 1.0],
    "8647": [0.1808, 0.675, 0, 0, 1.0],
    "8648": [0.19444, 0.69224, 0, 0, 0.83334],
    "8649": [0.1808, 0.675, 0, 0, 1.0],
    "8650": [0.19444, 0.69224, 0, 0, 0.83334],
    "8651": [0.01354, 0.52239, 0, 0, 1.0],
    "8652": [0.01354, 0.52239, 0, 0, 1.0],
    "8653": [-0.13313, 0.36687, 0, 0, 1.0],
    "8654": [-0.13313, 0.36687, 0, 0, 1.0],
    "8655": [-0.13313, 0.36687, 0, 0, 1.0],
    "8666": [0.13667, 0.63667, 0, 0, 1.0],
    "8667": [0.13667, 0.63667, 0, 0, 1.0],
    "8669": [-0.13313, 0.37788, 0, 0, 1.0],
    "8672": [-0.064, 0.437, 0, 0, 1.334],
    "8674": [-0.064, 0.437, 0, 0, 1.334],
    "8705": [0, 0.825, 0, 0, 0.5],
    "8708": [0, 0.68889, 0, 0, 0.55556],
    "8709": [0.08167, 0.58167, 0, 0, 0.77778],
    "8717": [0, 0.43056, 0, 0, 0.42917],
    "8722": [-0.03598, 0.46402, 0, 0, 0.5],
    "8724": [0.08198, 0.69224, 0, 0, 0.77778],
    "8726": [0.08167, 0.58167, 0, 0, 0.77778],
    "8733": [0, 0.69224, 0, 0, 0.77778],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8737": [0, 0.69224, 0, 0, 0.72222],
    "8738": [0.03517, 0.52239, 0, 0, 0.72222],
    "8739": [0.08167, 0.58167, 0, 0, 0.22222],
    "8740": [0.25142, 0.74111, 0, 0, 0.27778],
    "8741": [0.08167, 0.58167, 0, 0, 0.38889],
    "8742": [0.25142, 0.74111, 0, 0, 0.5],
    "8756": [0, 0.69224, 0, 0, 0.66667],
    "8757": [0, 0.69224, 0, 0, 0.66667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8765": [-0.13313, 0.37788, 0, 0, 0.77778],
    "8769": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8770": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8774": [0.30274, 0.79383, 0, 0, 0.77778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8778": [0.08167, 0.58167, 0, 0, 0.77778],
    "8782": [0.06062, 0.54986, 0, 0, 0.77778],
    "8783": [0.06062, 0.54986, 0, 0, 0.77778],
    "8785": [0.08198, 0.58198, 0, 0, 0.77778],
    "8786": [0.08198, 0.58198, 0, 0, 0.77778],
    "8787": [0.08198, 0.58198, 0, 0, 0.77778],
    "8790": [0, 0.69224, 0, 0, 0.77778],
    "8791": [0.22958, 0.72958, 0, 0, 0.77778],
    "8796": [0.08198, 0.91667, 0, 0, 0.77778],
    "8806": [0.25583, 0.75583, 0, 0, 0.77778],
    "8807": [0.25583, 0.75583, 0, 0, 0.77778],
    "8808": [0.25142, 0.75726, 0, 0, 0.77778],
    "8809": [0.25142, 0.75726, 0, 0, 0.77778],
    "8812": [0.25583, 0.75583, 0, 0, 0.5],
    "8814": [0.20576, 0.70576, 0, 0, 0.77778],
    "8815": [0.20576, 0.70576, 0, 0, 0.77778],
    "8816": [0.30274, 0.79383, 0, 0, 0.77778],
    "8817": [0.30274, 0.79383, 0, 0, 0.77778],
    "8818": [0.22958, 0.72958, 0, 0, 0.77778],
    "8819": [0.22958, 0.72958, 0, 0, 0.77778],
    "8822": [0.1808, 0.675, 0, 0, 0.77778],
    "8823": [0.1808, 0.675, 0, 0, 0.77778],
    "8828": [0.13667, 0.63667, 0, 0, 0.77778],
    "8829": [0.13667, 0.63667, 0, 0, 0.77778],
    "8830": [0.22958, 0.72958, 0, 0, 0.77778],
    "8831": [0.22958, 0.72958, 0, 0, 0.77778],
    "8832": [0.20576, 0.70576, 0, 0, 0.77778],
    "8833": [0.20576, 0.70576, 0, 0, 0.77778],
    "8840": [0.30274, 0.79383, 0, 0, 0.77778],
    "8841": [0.30274, 0.79383, 0, 0, 0.77778],
    "8842": [0.13597, 0.63597, 0, 0, 0.77778],
    "8843": [0.13597, 0.63597, 0, 0, 0.77778],
    "8847": [0.03517, 0.54986, 0, 0, 0.77778],
    "8848": [0.03517, 0.54986, 0, 0, 0.77778],
    "8858": [0.08198, 0.58198, 0, 0, 0.77778],
    "8859": [0.08198, 0.58198, 0, 0, 0.77778],
    "8861": [0.08198, 0.58198, 0, 0, 0.77778],
    "8862": [0, 0.675, 0, 0, 0.77778],
    "8863": [0, 0.675, 0, 0, 0.77778],
    "8864": [0, 0.675, 0, 0, 0.77778],
    "8865": [0, 0.675, 0, 0, 0.77778],
    "8872": [0, 0.69224, 0, 0, 0.61111],
    "8873": [0, 0.69224, 0, 0, 0.72222],
    "8874": [0, 0.69224, 0, 0, 0.88889],
    "8876": [0, 0.68889, 0, 0, 0.61111],
    "8877": [0, 0.68889, 0, 0, 0.61111],
    "8878": [0, 0.68889, 0, 0, 0.72222],
    "8879": [0, 0.68889, 0, 0, 0.72222],
    "8882": [0.03517, 0.54986, 0, 0, 0.77778],
    "8883": [0.03517, 0.54986, 0, 0, 0.77778],
    "8884": [0.13667, 0.63667, 0, 0, 0.77778],
    "8885": [0.13667, 0.63667, 0, 0, 0.77778],
    "8888": [0, 0.54986, 0, 0, 1.11111],
    "8890": [0.19444, 0.43056, 0, 0, 0.55556],
    "8891": [0.19444, 0.69224, 0, 0, 0.61111],
    "8892": [0.19444, 0.69224, 0, 0, 0.61111],
    "8901": [0, 0.54986, 0, 0, 0.27778],
    "8903": [0.08167, 0.58167, 0, 0, 0.77778],
    "8905": [0.08167, 0.58167, 0, 0, 0.77778],
    "8906": [0.08167, 0.58167, 0, 0, 0.77778],
    "8907": [0, 0.69224, 0, 0, 0.77778],
    "8908": [0, 0.69224, 0, 0, 0.77778],
    "8909": [-0.03598, 0.46402, 0, 0, 0.77778],
    "8910": [0, 0.54986, 0, 0, 0.76042],
    "8911": [0, 0.54986, 0, 0, 0.76042],
    "8912": [0.03517, 0.54986, 0, 0, 0.77778],
    "8913": [0.03517, 0.54986, 0, 0, 0.77778],
    "8914": [0, 0.54986, 0, 0, 0.66667],
    "8915": [0, 0.54986, 0, 0, 0.66667],
    "8916": [0, 0.69224, 0, 0, 0.66667],
    "8918": [0.0391, 0.5391, 0, 0, 0.77778],
    "8919": [0.0391, 0.5391, 0, 0, 0.77778],
    "8920": [0.03517, 0.54986, 0, 0, 1.33334],
    "8921": [0.03517, 0.54986, 0, 0, 1.33334],
    "8922": [0.38569, 0.88569, 0, 0, 0.77778],
    "8923": [0.38569, 0.88569, 0, 0, 0.77778],
    "8926": [0.13667, 0.63667, 0, 0, 0.77778],
    "8927": [0.13667, 0.63667, 0, 0, 0.77778],
    "8928": [0.30274, 0.79383, 0, 0, 0.77778],
    "8929": [0.30274, 0.79383, 0, 0, 0.77778],
    "8934": [0.23222, 0.74111, 0, 0, 0.77778],
    "8935": [0.23222, 0.74111, 0, 0, 0.77778],
    "8936": [0.23222, 0.74111, 0, 0, 0.77778],
    "8937": [0.23222, 0.74111, 0, 0, 0.77778],
    "8938": [0.20576, 0.70576, 0, 0, 0.77778],
    "8939": [0.20576, 0.70576, 0, 0, 0.77778],
    "8940": [0.30274, 0.79383, 0, 0, 0.77778],
    "8941": [0.30274, 0.79383, 0, 0, 0.77778],
    "8994": [0.19444, 0.69224, 0, 0, 0.77778],
    "8995": [0.19444, 0.69224, 0, 0, 0.77778],
    "9416": [0.15559, 0.69224, 0, 0, 0.90222],
    "9484": [0, 0.69224, 0, 0, 0.5],
    "9488": [0, 0.69224, 0, 0, 0.5],
    "9492": [0, 0.37788, 0, 0, 0.5],
    "9496": [0, 0.37788, 0, 0, 0.5],
    "9585": [0.19444, 0.68889, 0, 0, 0.88889],
    "9586": [0.19444, 0.74111, 0, 0, 0.88889],
    "9632": [0, 0.675, 0, 0, 0.77778],
    "9633": [0, 0.675, 0, 0, 0.77778],
    "9650": [0, 0.54986, 0, 0, 0.72222],
    "9651": [0, 0.54986, 0, 0, 0.72222],
    "9654": [0.03517, 0.54986, 0, 0, 0.77778],
    "9660": [0, 0.54986, 0, 0, 0.72222],
    "9661": [0, 0.54986, 0, 0, 0.72222],
    "9664": [0.03517, 0.54986, 0, 0, 0.77778],
    "9674": [0.11111, 0.69224, 0, 0, 0.66667],
    "9733": [0.19444, 0.69224, 0, 0, 0.94445],
    "10003": [0, 0.69224, 0, 0, 0.83334],
    "10016": [0, 0.69224, 0, 0, 0.83334],
    "10731": [0.11111, 0.69224, 0, 0, 0.66667],
    "10846": [0.19444, 0.75583, 0, 0, 0.61111],
    "10877": [0.13667, 0.63667, 0, 0, 0.77778],
    "10878": [0.13667, 0.63667, 0, 0, 0.77778],
    "10885": [0.25583, 0.75583, 0, 0, 0.77778],
    "10886": [0.25583, 0.75583, 0, 0, 0.77778],
    "10887": [0.13597, 0.63597, 0, 0, 0.77778],
    "10888": [0.13597, 0.63597, 0, 0, 0.77778],
    "10889": [0.26167, 0.75726, 0, 0, 0.77778],
    "10890": [0.26167, 0.75726, 0, 0, 0.77778],
    "10891": [0.48256, 0.98256, 0, 0, 0.77778],
    "10892": [0.48256, 0.98256, 0, 0, 0.77778],
    "10901": [0.13667, 0.63667, 0, 0, 0.77778],
    "10902": [0.13667, 0.63667, 0, 0, 0.77778],
    "10933": [0.25142, 0.75726, 0, 0, 0.77778],
    "10934": [0.25142, 0.75726, 0, 0, 0.77778],
    "10935": [0.26167, 0.75726, 0, 0, 0.77778],
    "10936": [0.26167, 0.75726, 0, 0, 0.77778],
    "10937": [0.26167, 0.75726, 0, 0, 0.77778],
    "10938": [0.26167, 0.75726, 0, 0, 0.77778],
    "10949": [0.25583, 0.75583, 0, 0, 0.77778],
    "10950": [0.25583, 0.75583, 0, 0, 0.77778],
    "10955": [0.28481, 0.79383, 0, 0, 0.77778],
    "10956": [0.28481, 0.79383, 0, 0, 0.77778],
    "57350": [0.08167, 0.58167, 0, 0, 0.22222],
    "57351": [0.08167, 0.58167, 0, 0, 0.38889],
    "57352": [0.08167, 0.58167, 0, 0, 0.77778],
    "57353": [0, 0.43056, 0.04028, 0, 0.66667],
    "57356": [0.25142, 0.75726, 0, 0, 0.77778],
    "57357": [0.25142, 0.75726, 0, 0, 0.77778],
    "57358": [0.41951, 0.91951, 0, 0, 0.77778],
    "57359": [0.30274, 0.79383, 0, 0, 0.77778],
    "57360": [0.30274, 0.79383, 0, 0, 0.77778],
    "57361": [0.41951, 0.91951, 0, 0, 0.77778],
    "57366": [0.25142, 0.75726, 0, 0, 0.77778],
    "57367": [0.25142, 0.75726, 0, 0, 0.77778],
    "57368": [0.25142, 0.75726, 0, 0, 0.77778],
    "57369": [0.25142, 0.75726, 0, 0, 0.77778],
    "57370": [0.13597, 0.63597, 0, 0, 0.77778],
    "57371": [0.13597, 0.63597, 0, 0, 0.77778]
  },
  "Caligraphic-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68333, 0, 0.19445, 0.79847],
    "66": [0, 0.68333, 0.03041, 0.13889, 0.65681],
    "67": [0, 0.68333, 0.05834, 0.13889, 0.52653],
    "68": [0, 0.68333, 0.02778, 0.08334, 0.77139],
    "69": [0, 0.68333, 0.08944, 0.11111, 0.52778],
    "70": [0, 0.68333, 0.09931, 0.11111, 0.71875],
    "71": [0.09722, 0.68333, 0.0593, 0.11111, 0.59487],
    "72": [0, 0.68333, 0.00965, 0.11111, 0.84452],
    "73": [0, 0.68333, 0.07382, 0, 0.54452],
    "74": [0.09722, 0.68333, 0.18472, 0.16667, 0.67778],
    "75": [0, 0.68333, 0.01445, 0.05556, 0.76195],
    "76": [0, 0.68333, 0, 0.13889, 0.68972],
    "77": [0, 0.68333, 0, 0.13889, 1.2009],
    "78": [0, 0.68333, 0.14736, 0.08334, 0.82049],
    "79": [0, 0.68333, 0.02778, 0.11111, 0.79611],
    "80": [0, 0.68333, 0.08222, 0.08334, 0.69556],
    "81": [0.09722, 0.68333, 0, 0.11111, 0.81667],
    "82": [0, 0.68333, 0, 0.08334, 0.8475],
    "83": [0, 0.68333, 0.075, 0.13889, 0.60556],
    "84": [0, 0.68333, 0.25417, 0, 0.54464],
    "85": [0, 0.68333, 0.09931, 0.08334, 0.62583],
    "86": [0, 0.68333, 0.08222, 0, 0.61278],
    "87": [0, 0.68333, 0.08222, 0.08334, 0.98778],
    "88": [0, 0.68333, 0.14643, 0.13889, 0.7133],
    "89": [0.09722, 0.68333, 0.08222, 0.08334, 0.66834],
    "90": [0, 0.68333, 0.07944, 0.13889, 0.72473],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Fraktur-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69141, 0, 0, 0.29574],
    "34": [0, 0.69141, 0, 0, 0.21471],
    "38": [0, 0.69141, 0, 0, 0.73786],
    "39": [0, 0.69141, 0, 0, 0.21201],
    "40": [0.24982, 0.74947, 0, 0, 0.38865],
    "41": [0.24982, 0.74947, 0, 0, 0.38865],
    "42": [0, 0.62119, 0, 0, 0.27764],
    "43": [0.08319, 0.58283, 0, 0, 0.75623],
    "44": [0, 0.10803, 0, 0, 0.27764],
    "45": [0.08319, 0.58283, 0, 0, 0.75623],
    "46": [0, 0.10803, 0, 0, 0.27764],
    "47": [0.24982, 0.74947, 0, 0, 0.50181],
    "48": [0, 0.47534, 0, 0, 0.50181],
    "49": [0, 0.47534, 0, 0, 0.50181],
    "50": [0, 0.47534, 0, 0, 0.50181],
    "51": [0.18906, 0.47534, 0, 0, 0.50181],
    "52": [0.18906, 0.47534, 0, 0, 0.50181],
    "53": [0.18906, 0.47534, 0, 0, 0.50181],
    "54": [0, 0.69141, 0, 0, 0.50181],
    "55": [0.18906, 0.47534, 0, 0, 0.50181],
    "56": [0, 0.69141, 0, 0, 0.50181],
    "57": [0.18906, 0.47534, 0, 0, 0.50181],
    "58": [0, 0.47534, 0, 0, 0.21606],
    "59": [0.12604, 0.47534, 0, 0, 0.21606],
    "61": [-0.13099, 0.36866, 0, 0, 0.75623],
    "63": [0, 0.69141, 0, 0, 0.36245],
    "65": [0, 0.69141, 0, 0, 0.7176],
    "66": [0, 0.69141, 0, 0, 0.88397],
    "67": [0, 0.69141, 0, 0, 0.61254],
    "68": [0, 0.69141, 0, 0, 0.83158],
    "69": [0, 0.69141, 0, 0, 0.66278],
    "70": [0.12604, 0.69141, 0, 0, 0.61119],
    "71": [0, 0.69141, 0, 0, 0.78539],
    "72": [0.06302, 0.69141, 0, 0, 0.7203],
    "73": [0, 0.69141, 0, 0, 0.55448],
    "74": [0.12604, 0.69141, 0, 0, 0.55231],
    "75": [0, 0.69141, 0, 0, 0.66845],
    "76": [0, 0.69141, 0, 0, 0.66602],
    "77": [0, 0.69141, 0, 0, 1.04953],
    "78": [0, 0.69141, 0, 0, 0.83212],
    "79": [0, 0.69141, 0, 0, 0.82699],
    "80": [0.18906, 0.69141, 0, 0, 0.82753],
    "81": [0.03781, 0.69141, 0, 0, 0.82699],
    "82": [0, 0.69141, 0, 0, 0.82807],
    "83": [0, 0.69141, 0, 0, 0.82861],
    "84": [0, 0.69141, 0, 0, 0.66899],
    "85": [0, 0.69141, 0, 0, 0.64576],
    "86": [0, 0.69141, 0, 0, 0.83131],
    "87": [0, 0.69141, 0, 0, 1.04602],
    "88": [0, 0.69141, 0, 0, 0.71922],
    "89": [0.18906, 0.69141, 0, 0, 0.83293],
    "90": [0.12604, 0.69141, 0, 0, 0.60201],
    "91": [0.24982, 0.74947, 0, 0, 0.27764],
    "93": [0.24982, 0.74947, 0, 0, 0.27764],
    "94": [0, 0.69141, 0, 0, 0.49965],
    "97": [0, 0.47534, 0, 0, 0.50046],
    "98": [0, 0.69141, 0, 0, 0.51315],
    "99": [0, 0.47534, 0, 0, 0.38946],
    "100": [0, 0.62119, 0, 0, 0.49857],
    "101": [0, 0.47534, 0, 0, 0.40053],
    "102": [0.18906, 0.69141, 0, 0, 0.32626],
    "103": [0.18906, 0.47534, 0, 0, 0.5037],
    "104": [0.18906, 0.69141, 0, 0, 0.52126],
    "105": [0, 0.69141, 0, 0, 0.27899],
    "106": [0, 0.69141, 0, 0, 0.28088],
    "107": [0, 0.69141, 0, 0, 0.38946],
    "108": [0, 0.69141, 0, 0, 0.27953],
    "109": [0, 0.47534, 0, 0, 0.76676],
    "110": [0, 0.47534, 0, 0, 0.52666],
    "111": [0, 0.47534, 0, 0, 0.48885],
    "112": [0.18906, 0.52396, 0, 0, 0.50046],
    "113": [0.18906, 0.47534, 0, 0, 0.48912],
    "114": [0, 0.47534, 0, 0, 0.38919],
    "115": [0, 0.47534, 0, 0, 0.44266],
    "116": [0, 0.62119, 0, 0, 0.33301],
    "117": [0, 0.47534, 0, 0, 0.5172],
    "118": [0, 0.52396, 0, 0, 0.5118],
    "119": [0, 0.52396, 0, 0, 0.77351],
    "120": [0.18906, 0.47534, 0, 0, 0.38865],
    "121": [0.18906, 0.47534, 0, 0, 0.49884],
    "122": [0.18906, 0.47534, 0, 0, 0.39054],
    "160": [0, 0, 0, 0, 0.25],
    "8216": [0, 0.69141, 0, 0, 0.21471],
    "8217": [0, 0.69141, 0, 0, 0.21471],
    "58112": [0, 0.62119, 0, 0, 0.49749],
    "58113": [0, 0.62119, 0, 0, 0.4983],
    "58114": [0.18906, 0.69141, 0, 0, 0.33328],
    "58115": [0.18906, 0.69141, 0, 0, 0.32923],
    "58116": [0.18906, 0.47534, 0, 0, 0.50343],
    "58117": [0, 0.69141, 0, 0, 0.33301],
    "58118": [0, 0.62119, 0, 0, 0.33409],
    "58119": [0, 0.47534, 0, 0, 0.50073]
  },
  "Main-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.35],
    "34": [0, 0.69444, 0, 0, 0.60278],
    "35": [0.19444, 0.69444, 0, 0, 0.95833],
    "36": [0.05556, 0.75, 0, 0, 0.575],
    "37": [0.05556, 0.75, 0, 0, 0.95833],
    "38": [0, 0.69444, 0, 0, 0.89444],
    "39": [0, 0.69444, 0, 0, 0.31944],
    "40": [0.25, 0.75, 0, 0, 0.44722],
    "41": [0.25, 0.75, 0, 0, 0.44722],
    "42": [0, 0.75, 0, 0, 0.575],
    "43": [0.13333, 0.63333, 0, 0, 0.89444],
    "44": [0.19444, 0.15556, 0, 0, 0.31944],
    "45": [0, 0.44444, 0, 0, 0.38333],
    "46": [0, 0.15556, 0, 0, 0.31944],
    "47": [0.25, 0.75, 0, 0, 0.575],
    "48": [0, 0.64444, 0, 0, 0.575],
    "49": [0, 0.64444, 0, 0, 0.575],
    "50": [0, 0.64444, 0, 0, 0.575],
    "51": [0, 0.64444, 0, 0, 0.575],
    "52": [0, 0.64444, 0, 0, 0.575],
    "53": [0, 0.64444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0, 0.64444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0, 0.64444, 0, 0, 0.575],
    "58": [0, 0.44444, 0, 0, 0.31944],
    "59": [0.19444, 0.44444, 0, 0, 0.31944],
    "60": [0.08556, 0.58556, 0, 0, 0.89444],
    "61": [-0.10889, 0.39111, 0, 0, 0.89444],
    "62": [0.08556, 0.58556, 0, 0, 0.89444],
    "63": [0, 0.69444, 0, 0, 0.54305],
    "64": [0, 0.69444, 0, 0, 0.89444],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0, 0, 0.81805],
    "67": [0, 0.68611, 0, 0, 0.83055],
    "68": [0, 0.68611, 0, 0, 0.88194],
    "69": [0, 0.68611, 0, 0, 0.75555],
    "70": [0, 0.68611, 0, 0, 0.72361],
    "71": [0, 0.68611, 0, 0, 0.90416],
    "72": [0, 0.68611, 0, 0, 0.9],
    "73": [0, 0.68611, 0, 0, 0.43611],
    "74": [0, 0.68611, 0, 0, 0.59444],
    "75": [0, 0.68611, 0, 0, 0.90138],
    "76": [0, 0.68611, 0, 0, 0.69166],
    "77": [0, 0.68611, 0, 0, 1.09166],
    "78": [0, 0.68611, 0, 0, 0.9],
    "79": [0, 0.68611, 0, 0, 0.86388],
    "80": [0, 0.68611, 0, 0, 0.78611],
    "81": [0.19444, 0.68611, 0, 0, 0.86388],
    "82": [0, 0.68611, 0, 0, 0.8625],
    "83": [0, 0.68611, 0, 0, 0.63889],
    "84": [0, 0.68611, 0, 0, 0.8],
    "85": [0, 0.68611, 0, 0, 0.88472],
    "86": [0, 0.68611, 0.01597, 0, 0.86944],
    "87": [0, 0.68611, 0.01597, 0, 1.18888],
    "88": [0, 0.68611, 0, 0, 0.86944],
    "89": [0, 0.68611, 0.02875, 0, 0.86944],
    "90": [0, 0.68611, 0, 0, 0.70277],
    "91": [0.25, 0.75, 0, 0, 0.31944],
    "92": [0.25, 0.75, 0, 0, 0.575],
    "93": [0.25, 0.75, 0, 0, 0.31944],
    "94": [0, 0.69444, 0, 0, 0.575],
    "95": [0.31, 0.13444, 0.03194, 0, 0.575],
    "97": [0, 0.44444, 0, 0, 0.55902],
    "98": [0, 0.69444, 0, 0, 0.63889],
    "99": [0, 0.44444, 0, 0, 0.51111],
    "100": [0, 0.69444, 0, 0, 0.63889],
    "101": [0, 0.44444, 0, 0, 0.52708],
    "102": [0, 0.69444, 0.10903, 0, 0.35139],
    "103": [0.19444, 0.44444, 0.01597, 0, 0.575],
    "104": [0, 0.69444, 0, 0, 0.63889],
    "105": [0, 0.69444, 0, 0, 0.31944],
    "106": [0.19444, 0.69444, 0, 0, 0.35139],
    "107": [0, 0.69444, 0, 0, 0.60694],
    "108": [0, 0.69444, 0, 0, 0.31944],
    "109": [0, 0.44444, 0, 0, 0.95833],
    "110": [0, 0.44444, 0, 0, 0.63889],
    "111": [0, 0.44444, 0, 0, 0.575],
    "112": [0.19444, 0.44444, 0, 0, 0.63889],
    "113": [0.19444, 0.44444, 0, 0, 0.60694],
    "114": [0, 0.44444, 0, 0, 0.47361],
    "115": [0, 0.44444, 0, 0, 0.45361],
    "116": [0, 0.63492, 0, 0, 0.44722],
    "117": [0, 0.44444, 0, 0, 0.63889],
    "118": [0, 0.44444, 0.01597, 0, 0.60694],
    "119": [0, 0.44444, 0.01597, 0, 0.83055],
    "120": [0, 0.44444, 0, 0, 0.60694],
    "121": [0.19444, 0.44444, 0.01597, 0, 0.60694],
    "122": [0, 0.44444, 0, 0, 0.51111],
    "123": [0.25, 0.75, 0, 0, 0.575],
    "124": [0.25, 0.75, 0, 0, 0.31944],
    "125": [0.25, 0.75, 0, 0, 0.575],
    "126": [0.35, 0.34444, 0, 0, 0.575],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.86853],
    "168": [0, 0.69444, 0, 0, 0.575],
    "172": [0, 0.44444, 0, 0, 0.76666],
    "176": [0, 0.69444, 0, 0, 0.86944],
    "177": [0.13333, 0.63333, 0, 0, 0.89444],
    "184": [0.17014, 0, 0, 0, 0.51111],
    "198": [0, 0.68611, 0, 0, 1.04166],
    "215": [0.13333, 0.63333, 0, 0, 0.89444],
    "216": [0.04861, 0.73472, 0, 0, 0.89444],
    "223": [0, 0.69444, 0, 0, 0.59722],
    "230": [0, 0.44444, 0, 0, 0.83055],
    "247": [0.13333, 0.63333, 0, 0, 0.89444],
    "248": [0.09722, 0.54167, 0, 0, 0.575],
    "305": [0, 0.44444, 0, 0, 0.31944],
    "338": [0, 0.68611, 0, 0, 1.16944],
    "339": [0, 0.44444, 0, 0, 0.89444],
    "567": [0.19444, 0.44444, 0, 0, 0.35139],
    "710": [0, 0.69444, 0, 0, 0.575],
    "711": [0, 0.63194, 0, 0, 0.575],
    "713": [0, 0.59611, 0, 0, 0.575],
    "714": [0, 0.69444, 0, 0, 0.575],
    "715": [0, 0.69444, 0, 0, 0.575],
    "728": [0, 0.69444, 0, 0, 0.575],
    "729": [0, 0.69444, 0, 0, 0.31944],
    "730": [0, 0.69444, 0, 0, 0.86944],
    "732": [0, 0.69444, 0, 0, 0.575],
    "733": [0, 0.69444, 0, 0, 0.575],
    "915": [0, 0.68611, 0, 0, 0.69166],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0, 0, 0.89444],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0, 0, 0.76666],
    "928": [0, 0.68611, 0, 0, 0.9],
    "931": [0, 0.68611, 0, 0, 0.83055],
    "933": [0, 0.68611, 0, 0, 0.89444],
    "934": [0, 0.68611, 0, 0, 0.83055],
    "936": [0, 0.68611, 0, 0, 0.89444],
    "937": [0, 0.68611, 0, 0, 0.83055],
    "8211": [0, 0.44444, 0.03194, 0, 0.575],
    "8212": [0, 0.44444, 0.03194, 0, 1.14999],
    "8216": [0, 0.69444, 0, 0, 0.31944],
    "8217": [0, 0.69444, 0, 0, 0.31944],
    "8220": [0, 0.69444, 0, 0, 0.60278],
    "8221": [0, 0.69444, 0, 0, 0.60278],
    "8224": [0.19444, 0.69444, 0, 0, 0.51111],
    "8225": [0.19444, 0.69444, 0, 0, 0.51111],
    "8242": [0, 0.55556, 0, 0, 0.34444],
    "8407": [0, 0.72444, 0.15486, 0, 0.575],
    "8463": [0, 0.69444, 0, 0, 0.66759],
    "8465": [0, 0.69444, 0, 0, 0.83055],
    "8467": [0, 0.69444, 0, 0, 0.47361],
    "8472": [0.19444, 0.44444, 0, 0, 0.74027],
    "8476": [0, 0.69444, 0, 0, 0.83055],
    "8501": [0, 0.69444, 0, 0, 0.70277],
    "8592": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8593": [0.19444, 0.69444, 0, 0, 0.575],
    "8594": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8595": [0.19444, 0.69444, 0, 0, 0.575],
    "8596": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8597": [0.25, 0.75, 0, 0, 0.575],
    "8598": [0.19444, 0.69444, 0, 0, 1.14999],
    "8599": [0.19444, 0.69444, 0, 0, 1.14999],
    "8600": [0.19444, 0.69444, 0, 0, 1.14999],
    "8601": [0.19444, 0.69444, 0, 0, 1.14999],
    "8636": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8637": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8640": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8641": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8656": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8657": [0.19444, 0.69444, 0, 0, 0.70277],
    "8658": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8659": [0.19444, 0.69444, 0, 0, 0.70277],
    "8660": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8661": [0.25, 0.75, 0, 0, 0.70277],
    "8704": [0, 0.69444, 0, 0, 0.63889],
    "8706": [0, 0.69444, 0.06389, 0, 0.62847],
    "8707": [0, 0.69444, 0, 0, 0.63889],
    "8709": [0.05556, 0.75, 0, 0, 0.575],
    "8711": [0, 0.68611, 0, 0, 0.95833],
    "8712": [0.08556, 0.58556, 0, 0, 0.76666],
    "8715": [0.08556, 0.58556, 0, 0, 0.76666],
    "8722": [0.13333, 0.63333, 0, 0, 0.89444],
    "8723": [0.13333, 0.63333, 0, 0, 0.89444],
    "8725": [0.25, 0.75, 0, 0, 0.575],
    "8726": [0.25, 0.75, 0, 0, 0.575],
    "8727": [-0.02778, 0.47222, 0, 0, 0.575],
    "8728": [-0.02639, 0.47361, 0, 0, 0.575],
    "8729": [-0.02639, 0.47361, 0, 0, 0.575],
    "8730": [0.18, 0.82, 0, 0, 0.95833],
    "8733": [0, 0.44444, 0, 0, 0.89444],
    "8734": [0, 0.44444, 0, 0, 1.14999],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.31944],
    "8741": [0.25, 0.75, 0, 0, 0.575],
    "8743": [0, 0.55556, 0, 0, 0.76666],
    "8744": [0, 0.55556, 0, 0, 0.76666],
    "8745": [0, 0.55556, 0, 0, 0.76666],
    "8746": [0, 0.55556, 0, 0, 0.76666],
    "8747": [0.19444, 0.69444, 0.12778, 0, 0.56875],
    "8764": [-0.10889, 0.39111, 0, 0, 0.89444],
    "8768": [0.19444, 0.69444, 0, 0, 0.31944],
    "8771": [0.00222, 0.50222, 0, 0, 0.89444],
    "8773": [0.027, 0.638, 0, 0, 0.894],
    "8776": [0.02444, 0.52444, 0, 0, 0.89444],
    "8781": [0.00222, 0.50222, 0, 0, 0.89444],
    "8801": [0.00222, 0.50222, 0, 0, 0.89444],
    "8804": [0.19667, 0.69667, 0, 0, 0.89444],
    "8805": [0.19667, 0.69667, 0, 0, 0.89444],
    "8810": [0.08556, 0.58556, 0, 0, 1.14999],
    "8811": [0.08556, 0.58556, 0, 0, 1.14999],
    "8826": [0.08556, 0.58556, 0, 0, 0.89444],
    "8827": [0.08556, 0.58556, 0, 0, 0.89444],
    "8834": [0.08556, 0.58556, 0, 0, 0.89444],
    "8835": [0.08556, 0.58556, 0, 0, 0.89444],
    "8838": [0.19667, 0.69667, 0, 0, 0.89444],
    "8839": [0.19667, 0.69667, 0, 0, 0.89444],
    "8846": [0, 0.55556, 0, 0, 0.76666],
    "8849": [0.19667, 0.69667, 0, 0, 0.89444],
    "8850": [0.19667, 0.69667, 0, 0, 0.89444],
    "8851": [0, 0.55556, 0, 0, 0.76666],
    "8852": [0, 0.55556, 0, 0, 0.76666],
    "8853": [0.13333, 0.63333, 0, 0, 0.89444],
    "8854": [0.13333, 0.63333, 0, 0, 0.89444],
    "8855": [0.13333, 0.63333, 0, 0, 0.89444],
    "8856": [0.13333, 0.63333, 0, 0, 0.89444],
    "8857": [0.13333, 0.63333, 0, 0, 0.89444],
    "8866": [0, 0.69444, 0, 0, 0.70277],
    "8867": [0, 0.69444, 0, 0, 0.70277],
    "8868": [0, 0.69444, 0, 0, 0.89444],
    "8869": [0, 0.69444, 0, 0, 0.89444],
    "8900": [-0.02639, 0.47361, 0, 0, 0.575],
    "8901": [-0.02639, 0.47361, 0, 0, 0.31944],
    "8902": [-0.02778, 0.47222, 0, 0, 0.575],
    "8968": [0.25, 0.75, 0, 0, 0.51111],
    "8969": [0.25, 0.75, 0, 0, 0.51111],
    "8970": [0.25, 0.75, 0, 0, 0.51111],
    "8971": [0.25, 0.75, 0, 0, 0.51111],
    "8994": [-0.13889, 0.36111, 0, 0, 1.14999],
    "8995": [-0.13889, 0.36111, 0, 0, 1.14999],
    "9651": [0.19444, 0.69444, 0, 0, 1.02222],
    "9657": [-0.02778, 0.47222, 0, 0, 0.575],
    "9661": [0.19444, 0.69444, 0, 0, 1.02222],
    "9667": [-0.02778, 0.47222, 0, 0, 0.575],
    "9711": [0.19444, 0.69444, 0, 0, 1.14999],
    "9824": [0.12963, 0.69444, 0, 0, 0.89444],
    "9825": [0.12963, 0.69444, 0, 0, 0.89444],
    "9826": [0.12963, 0.69444, 0, 0, 0.89444],
    "9827": [0.12963, 0.69444, 0, 0, 0.89444],
    "9837": [0, 0.75, 0, 0, 0.44722],
    "9838": [0.19444, 0.69444, 0, 0, 0.44722],
    "9839": [0.19444, 0.69444, 0, 0, 0.44722],
    "10216": [0.25, 0.75, 0, 0, 0.44722],
    "10217": [0.25, 0.75, 0, 0, 0.44722],
    "10815": [0, 0.68611, 0, 0, 0.9],
    "10927": [0.19667, 0.69667, 0, 0, 0.89444],
    "10928": [0.19667, 0.69667, 0, 0, 0.89444],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Main-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.11417, 0, 0.38611],
    "34": [0, 0.69444, 0.07939, 0, 0.62055],
    "35": [0.19444, 0.69444, 0.06833, 0, 0.94444],
    "37": [0.05556, 0.75, 0.12861, 0, 0.94444],
    "38": [0, 0.69444, 0.08528, 0, 0.88555],
    "39": [0, 0.69444, 0.12945, 0, 0.35555],
    "40": [0.25, 0.75, 0.15806, 0, 0.47333],
    "41": [0.25, 0.75, 0.03306, 0, 0.47333],
    "42": [0, 0.75, 0.14333, 0, 0.59111],
    "43": [0.10333, 0.60333, 0.03306, 0, 0.88555],
    "44": [0.19444, 0.14722, 0, 0, 0.35555],
    "45": [0, 0.44444, 0.02611, 0, 0.41444],
    "46": [0, 0.14722, 0, 0, 0.35555],
    "47": [0.25, 0.75, 0.15806, 0, 0.59111],
    "48": [0, 0.64444, 0.13167, 0, 0.59111],
    "49": [0, 0.64444, 0.13167, 0, 0.59111],
    "50": [0, 0.64444, 0.13167, 0, 0.59111],
    "51": [0, 0.64444, 0.13167, 0, 0.59111],
    "52": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "53": [0, 0.64444, 0.13167, 0, 0.59111],
    "54": [0, 0.64444, 0.13167, 0, 0.59111],
    "55": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "56": [0, 0.64444, 0.13167, 0, 0.59111],
    "57": [0, 0.64444, 0.13167, 0, 0.59111],
    "58": [0, 0.44444, 0.06695, 0, 0.35555],
    "59": [0.19444, 0.44444, 0.06695, 0, 0.35555],
    "61": [-0.10889, 0.39111, 0.06833, 0, 0.88555],
    "63": [0, 0.69444, 0.11472, 0, 0.59111],
    "64": [0, 0.69444, 0.09208, 0, 0.88555],
    "65": [0, 0.68611, 0, 0, 0.86555],
    "66": [0, 0.68611, 0.0992, 0, 0.81666],
    "67": [0, 0.68611, 0.14208, 0, 0.82666],
    "68": [0, 0.68611, 0.09062, 0, 0.87555],
    "69": [0, 0.68611, 0.11431, 0, 0.75666],
    "70": [0, 0.68611, 0.12903, 0, 0.72722],
    "71": [0, 0.68611, 0.07347, 0, 0.89527],
    "72": [0, 0.68611, 0.17208, 0, 0.8961],
    "73": [0, 0.68611, 0.15681, 0, 0.47166],
    "74": [0, 0.68611, 0.145, 0, 0.61055],
    "75": [0, 0.68611, 0.14208, 0, 0.89499],
    "76": [0, 0.68611, 0, 0, 0.69777],
    "77": [0, 0.68611, 0.17208, 0, 1.07277],
    "78": [0, 0.68611, 0.17208, 0, 0.8961],
    "79": [0, 0.68611, 0.09062, 0, 0.85499],
    "80": [0, 0.68611, 0.0992, 0, 0.78721],
    "81": [0.19444, 0.68611, 0.09062, 0, 0.85499],
    "82": [0, 0.68611, 0.02559, 0, 0.85944],
    "83": [0, 0.68611, 0.11264, 0, 0.64999],
    "84": [0, 0.68611, 0.12903, 0, 0.7961],
    "85": [0, 0.68611, 0.17208, 0, 0.88083],
    "86": [0, 0.68611, 0.18625, 0, 0.86555],
    "87": [0, 0.68611, 0.18625, 0, 1.15999],
    "88": [0, 0.68611, 0.15681, 0, 0.86555],
    "89": [0, 0.68611, 0.19803, 0, 0.86555],
    "90": [0, 0.68611, 0.14208, 0, 0.70888],
    "91": [0.25, 0.75, 0.1875, 0, 0.35611],
    "93": [0.25, 0.75, 0.09972, 0, 0.35611],
    "94": [0, 0.69444, 0.06709, 0, 0.59111],
    "95": [0.31, 0.13444, 0.09811, 0, 0.59111],
    "97": [0, 0.44444, 0.09426, 0, 0.59111],
    "98": [0, 0.69444, 0.07861, 0, 0.53222],
    "99": [0, 0.44444, 0.05222, 0, 0.53222],
    "100": [0, 0.69444, 0.10861, 0, 0.59111],
    "101": [0, 0.44444, 0.085, 0, 0.53222],
    "102": [0.19444, 0.69444, 0.21778, 0, 0.4],
    "103": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "104": [0, 0.69444, 0.09426, 0, 0.59111],
    "105": [0, 0.69326, 0.11387, 0, 0.35555],
    "106": [0.19444, 0.69326, 0.1672, 0, 0.35555],
    "107": [0, 0.69444, 0.11111, 0, 0.53222],
    "108": [0, 0.69444, 0.10861, 0, 0.29666],
    "109": [0, 0.44444, 0.09426, 0, 0.94444],
    "110": [0, 0.44444, 0.09426, 0, 0.64999],
    "111": [0, 0.44444, 0.07861, 0, 0.59111],
    "112": [0.19444, 0.44444, 0.07861, 0, 0.59111],
    "113": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "114": [0, 0.44444, 0.11111, 0, 0.50167],
    "115": [0, 0.44444, 0.08167, 0, 0.48694],
    "116": [0, 0.63492, 0.09639, 0, 0.385],
    "117": [0, 0.44444, 0.09426, 0, 0.62055],
    "118": [0, 0.44444, 0.11111, 0, 0.53222],
    "119": [0, 0.44444, 0.11111, 0, 0.76777],
    "120": [0, 0.44444, 0.12583, 0, 0.56055],
    "121": [0.19444, 0.44444, 0.105, 0, 0.56166],
    "122": [0, 0.44444, 0.13889, 0, 0.49055],
    "126": [0.35, 0.34444, 0.11472, 0, 0.59111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0.11473, 0, 0.59111],
    "176": [0, 0.69444, 0, 0, 0.94888],
    "184": [0.17014, 0, 0, 0, 0.53222],
    "198": [0, 0.68611, 0.11431, 0, 1.02277],
    "216": [0.04861, 0.73472, 0.09062, 0, 0.88555],
    "223": [0.19444, 0.69444, 0.09736, 0, 0.665],
    "230": [0, 0.44444, 0.085, 0, 0.82666],
    "248": [0.09722, 0.54167, 0.09458, 0, 0.59111],
    "305": [0, 0.44444, 0.09426, 0, 0.35555],
    "338": [0, 0.68611, 0.11431, 0, 1.14054],
    "339": [0, 0.44444, 0.085, 0, 0.82666],
    "567": [0.19444, 0.44444, 0.04611, 0, 0.385],
    "710": [0, 0.69444, 0.06709, 0, 0.59111],
    "711": [0, 0.63194, 0.08271, 0, 0.59111],
    "713": [0, 0.59444, 0.10444, 0, 0.59111],
    "714": [0, 0.69444, 0.08528, 0, 0.59111],
    "715": [0, 0.69444, 0, 0, 0.59111],
    "728": [0, 0.69444, 0.10333, 0, 0.59111],
    "729": [0, 0.69444, 0.12945, 0, 0.35555],
    "730": [0, 0.69444, 0, 0, 0.94888],
    "732": [0, 0.69444, 0.11472, 0, 0.59111],
    "733": [0, 0.69444, 0.11472, 0, 0.59111],
    "915": [0, 0.68611, 0.12903, 0, 0.69777],
    "916": [0, 0.68611, 0, 0, 0.94444],
    "920": [0, 0.68611, 0.09062, 0, 0.88555],
    "923": [0, 0.68611, 0, 0, 0.80666],
    "926": [0, 0.68611, 0.15092, 0, 0.76777],
    "928": [0, 0.68611, 0.17208, 0, 0.8961],
    "931": [0, 0.68611, 0.11431, 0, 0.82666],
    "933": [0, 0.68611, 0.10778, 0, 0.88555],
    "934": [0, 0.68611, 0.05632, 0, 0.82666],
    "936": [0, 0.68611, 0.10778, 0, 0.88555],
    "937": [0, 0.68611, 0.0992, 0, 0.82666],
    "8211": [0, 0.44444, 0.09811, 0, 0.59111],
    "8212": [0, 0.44444, 0.09811, 0, 1.18221],
    "8216": [0, 0.69444, 0.12945, 0, 0.35555],
    "8217": [0, 0.69444, 0.12945, 0, 0.35555],
    "8220": [0, 0.69444, 0.16772, 0, 0.62055],
    "8221": [0, 0.69444, 0.07939, 0, 0.62055]
  },
  "Main-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.12417, 0, 0.30667],
    "34": [0, 0.69444, 0.06961, 0, 0.51444],
    "35": [0.19444, 0.69444, 0.06616, 0, 0.81777],
    "37": [0.05556, 0.75, 0.13639, 0, 0.81777],
    "38": [0, 0.69444, 0.09694, 0, 0.76666],
    "39": [0, 0.69444, 0.12417, 0, 0.30667],
    "40": [0.25, 0.75, 0.16194, 0, 0.40889],
    "41": [0.25, 0.75, 0.03694, 0, 0.40889],
    "42": [0, 0.75, 0.14917, 0, 0.51111],
    "43": [0.05667, 0.56167, 0.03694, 0, 0.76666],
    "44": [0.19444, 0.10556, 0, 0, 0.30667],
    "45": [0, 0.43056, 0.02826, 0, 0.35778],
    "46": [0, 0.10556, 0, 0, 0.30667],
    "47": [0.25, 0.75, 0.16194, 0, 0.51111],
    "48": [0, 0.64444, 0.13556, 0, 0.51111],
    "49": [0, 0.64444, 0.13556, 0, 0.51111],
    "50": [0, 0.64444, 0.13556, 0, 0.51111],
    "51": [0, 0.64444, 0.13556, 0, 0.51111],
    "52": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "53": [0, 0.64444, 0.13556, 0, 0.51111],
    "54": [0, 0.64444, 0.13556, 0, 0.51111],
    "55": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "56": [0, 0.64444, 0.13556, 0, 0.51111],
    "57": [0, 0.64444, 0.13556, 0, 0.51111],
    "58": [0, 0.43056, 0.0582, 0, 0.30667],
    "59": [0.19444, 0.43056, 0.0582, 0, 0.30667],
    "61": [-0.13313, 0.36687, 0.06616, 0, 0.76666],
    "63": [0, 0.69444, 0.1225, 0, 0.51111],
    "64": [0, 0.69444, 0.09597, 0, 0.76666],
    "65": [0, 0.68333, 0, 0, 0.74333],
    "66": [0, 0.68333, 0.10257, 0, 0.70389],
    "67": [0, 0.68333, 0.14528, 0, 0.71555],
    "68": [0, 0.68333, 0.09403, 0, 0.755],
    "69": [0, 0.68333, 0.12028, 0, 0.67833],
    "70": [0, 0.68333, 0.13305, 0, 0.65277],
    "71": [0, 0.68333, 0.08722, 0, 0.77361],
    "72": [0, 0.68333, 0.16389, 0, 0.74333],
    "73": [0, 0.68333, 0.15806, 0, 0.38555],
    "74": [0, 0.68333, 0.14028, 0, 0.525],
    "75": [0, 0.68333, 0.14528, 0, 0.76888],
    "76": [0, 0.68333, 0, 0, 0.62722],
    "77": [0, 0.68333, 0.16389, 0, 0.89666],
    "78": [0, 0.68333, 0.16389, 0, 0.74333],
    "79": [0, 0.68333, 0.09403, 0, 0.76666],
    "80": [0, 0.68333, 0.10257, 0, 0.67833],
    "81": [0.19444, 0.68333, 0.09403, 0, 0.76666],
    "82": [0, 0.68333, 0.03868, 0, 0.72944],
    "83": [0, 0.68333, 0.11972, 0, 0.56222],
    "84": [0, 0.68333, 0.13305, 0, 0.71555],
    "85": [0, 0.68333, 0.16389, 0, 0.74333],
    "86": [0, 0.68333, 0.18361, 0, 0.74333],
    "87": [0, 0.68333, 0.18361, 0, 0.99888],
    "88": [0, 0.68333, 0.15806, 0, 0.74333],
    "89": [0, 0.68333, 0.19383, 0, 0.74333],
    "90": [0, 0.68333, 0.14528, 0, 0.61333],
    "91": [0.25, 0.75, 0.1875, 0, 0.30667],
    "93": [0.25, 0.75, 0.10528, 0, 0.30667],
    "94": [0, 0.69444, 0.06646, 0, 0.51111],
    "95": [0.31, 0.12056, 0.09208, 0, 0.51111],
    "97": [0, 0.43056, 0.07671, 0, 0.51111],
    "98": [0, 0.69444, 0.06312, 0, 0.46],
    "99": [0, 0.43056, 0.05653, 0, 0.46],
    "100": [0, 0.69444, 0.10333, 0, 0.51111],
    "101": [0, 0.43056, 0.07514, 0, 0.46],
    "102": [0.19444, 0.69444, 0.21194, 0, 0.30667],
    "103": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "104": [0, 0.69444, 0.07671, 0, 0.51111],
    "105": [0, 0.65536, 0.1019, 0, 0.30667],
    "106": [0.19444, 0.65536, 0.14467, 0, 0.30667],
    "107": [0, 0.69444, 0.10764, 0, 0.46],
    "108": [0, 0.69444, 0.10333, 0, 0.25555],
    "109": [0, 0.43056, 0.07671, 0, 0.81777],
    "110": [0, 0.43056, 0.07671, 0, 0.56222],
    "111": [0, 0.43056, 0.06312, 0, 0.51111],
    "112": [0.19444, 0.43056, 0.06312, 0, 0.51111],
    "113": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "114": [0, 0.43056, 0.10764, 0, 0.42166],
    "115": [0, 0.43056, 0.08208, 0, 0.40889],
    "116": [0, 0.61508, 0.09486, 0, 0.33222],
    "117": [0, 0.43056, 0.07671, 0, 0.53666],
    "118": [0, 0.43056, 0.10764, 0, 0.46],
    "119": [0, 0.43056, 0.10764, 0, 0.66444],
    "120": [0, 0.43056, 0.12042, 0, 0.46389],
    "121": [0.19444, 0.43056, 0.08847, 0, 0.48555],
    "122": [0, 0.43056, 0.12292, 0, 0.40889],
    "126": [0.35, 0.31786, 0.11585, 0, 0.51111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.66786, 0.10474, 0, 0.51111],
    "176": [0, 0.69444, 0, 0, 0.83129],
    "184": [0.17014, 0, 0, 0, 0.46],
    "198": [0, 0.68333, 0.12028, 0, 0.88277],
    "216": [0.04861, 0.73194, 0.09403, 0, 0.76666],
    "223": [0.19444, 0.69444, 0.10514, 0, 0.53666],
    "230": [0, 0.43056, 0.07514, 0, 0.71555],
    "248": [0.09722, 0.52778, 0.09194, 0, 0.51111],
    "338": [0, 0.68333, 0.12028, 0, 0.98499],
    "339": [0, 0.43056, 0.07514, 0, 0.71555],
    "710": [0, 0.69444, 0.06646, 0, 0.51111],
    "711": [0, 0.62847, 0.08295, 0, 0.51111],
    "713": [0, 0.56167, 0.10333, 0, 0.51111],
    "714": [0, 0.69444, 0.09694, 0, 0.51111],
    "715": [0, 0.69444, 0, 0, 0.51111],
    "728": [0, 0.69444, 0.10806, 0, 0.51111],
    "729": [0, 0.66786, 0.11752, 0, 0.30667],
    "730": [0, 0.69444, 0, 0, 0.83129],
    "732": [0, 0.66786, 0.11585, 0, 0.51111],
    "733": [0, 0.69444, 0.1225, 0, 0.51111],
    "915": [0, 0.68333, 0.13305, 0, 0.62722],
    "916": [0, 0.68333, 0, 0, 0.81777],
    "920": [0, 0.68333, 0.09403, 0, 0.76666],
    "923": [0, 0.68333, 0, 0, 0.69222],
    "926": [0, 0.68333, 0.15294, 0, 0.66444],
    "928": [0, 0.68333, 0.16389, 0, 0.74333],
    "931": [0, 0.68333, 0.12028, 0, 0.71555],
    "933": [0, 0.68333, 0.11111, 0, 0.76666],
    "934": [0, 0.68333, 0.05986, 0, 0.71555],
    "936": [0, 0.68333, 0.11111, 0, 0.76666],
    "937": [0, 0.68333, 0.10257, 0, 0.71555],
    "8211": [0, 0.43056, 0.09208, 0, 0.51111],
    "8212": [0, 0.43056, 0.09208, 0, 1.02222],
    "8216": [0, 0.69444, 0.12417, 0, 0.30667],
    "8217": [0, 0.69444, 0.12417, 0, 0.30667],
    "8220": [0, 0.69444, 0.1685, 0, 0.51444],
    "8221": [0, 0.69444, 0.06961, 0, 0.51444],
    "8463": [0, 0.68889, 0, 0, 0.54028]
  },
  "Main-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.27778],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.77778],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.19444, 0.10556, 0, 0, 0.27778],
    "45": [0, 0.43056, 0, 0, 0.33333],
    "46": [0, 0.10556, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.64444, 0, 0, 0.5],
    "49": [0, 0.64444, 0, 0, 0.5],
    "50": [0, 0.64444, 0, 0, 0.5],
    "51": [0, 0.64444, 0, 0, 0.5],
    "52": [0, 0.64444, 0, 0, 0.5],
    "53": [0, 0.64444, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0, 0.64444, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0, 0.64444, 0, 0, 0.5],
    "58": [0, 0.43056, 0, 0, 0.27778],
    "59": [0.19444, 0.43056, 0, 0, 0.27778],
    "60": [0.0391, 0.5391, 0, 0, 0.77778],
    "61": [-0.13313, 0.36687, 0, 0, 0.77778],
    "62": [0.0391, 0.5391, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.77778],
    "65": [0, 0.68333, 0, 0, 0.75],
    "66": [0, 0.68333, 0, 0, 0.70834],
    "67": [0, 0.68333, 0, 0, 0.72222],
    "68": [0, 0.68333, 0, 0, 0.76389],
    "69": [0, 0.68333, 0, 0, 0.68056],
    "70": [0, 0.68333, 0, 0, 0.65278],
    "71": [0, 0.68333, 0, 0, 0.78472],
    "72": [0, 0.68333, 0, 0, 0.75],
    "73": [0, 0.68333, 0, 0, 0.36111],
    "74": [0, 0.68333, 0, 0, 0.51389],
    "75": [0, 0.68333, 0, 0, 0.77778],
    "76": [0, 0.68333, 0, 0, 0.625],
    "77": [0, 0.68333, 0, 0, 0.91667],
    "78": [0, 0.68333, 0, 0, 0.75],
    "79": [0, 0.68333, 0, 0, 0.77778],
    "80": [0, 0.68333, 0, 0, 0.68056],
    "81": [0.19444, 0.68333, 0, 0, 0.77778],
    "82": [0, 0.68333, 0, 0, 0.73611],
    "83": [0, 0.68333, 0, 0, 0.55556],
    "84": [0, 0.68333, 0, 0, 0.72222],
    "85": [0, 0.68333, 0, 0, 0.75],
    "86": [0, 0.68333, 0.01389, 0, 0.75],
    "87": [0, 0.68333, 0.01389, 0, 1.02778],
    "88": [0, 0.68333, 0, 0, 0.75],
    "89": [0, 0.68333, 0.025, 0, 0.75],
    "90": [0, 0.68333, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.27778],
    "92": [0.25, 0.75, 0, 0, 0.5],
    "93": [0.25, 0.75, 0, 0, 0.27778],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.31, 0.12056, 0.02778, 0, 0.5],
    "97": [0, 0.43056, 0, 0, 0.5],
    "98": [0, 0.69444, 0, 0, 0.55556],
    "99": [0, 0.43056, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.55556],
    "101": [0, 0.43056, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.07778, 0, 0.30556],
    "103": [0.19444, 0.43056, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.55556],
    "105": [0, 0.66786, 0, 0, 0.27778],
    "106": [0.19444, 0.66786, 0, 0, 0.30556],
    "107": [0, 0.69444, 0, 0, 0.52778],
    "108": [0, 0.69444, 0, 0, 0.27778],
    "109": [0, 0.43056, 0, 0, 0.83334],
    "110": [0, 0.43056, 0, 0, 0.55556],
    "111": [0, 0.43056, 0, 0, 0.5],
    "112": [0.19444, 0.43056, 0, 0, 0.55556],
    "113": [0.19444, 0.43056, 0, 0, 0.52778],
    "114": [0, 0.43056, 0, 0, 0.39167],
    "115": [0, 0.43056, 0, 0, 0.39445],
    "116": [0, 0.61508, 0, 0, 0.38889],
    "117": [0, 0.43056, 0, 0, 0.55556],
    "118": [0, 0.43056, 0.01389, 0, 0.52778],
    "119": [0, 0.43056, 0.01389, 0, 0.72222],
    "120": [0, 0.43056, 0, 0, 0.52778],
    "121": [0.19444, 0.43056, 0.01389, 0, 0.52778],
    "122": [0, 0.43056, 0, 0, 0.44445],
    "123": [0.25, 0.75, 0, 0, 0.5],
    "124": [0.25, 0.75, 0, 0, 0.27778],
    "125": [0.25, 0.75, 0, 0, 0.5],
    "126": [0.35, 0.31786, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.76909],
    "167": [0.19444, 0.69444, 0, 0, 0.44445],
    "168": [0, 0.66786, 0, 0, 0.5],
    "172": [0, 0.43056, 0, 0, 0.66667],
    "176": [0, 0.69444, 0, 0, 0.75],
    "177": [0.08333, 0.58333, 0, 0, 0.77778],
    "182": [0.19444, 0.69444, 0, 0, 0.61111],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "198": [0, 0.68333, 0, 0, 0.90278],
    "215": [0.08333, 0.58333, 0, 0, 0.77778],
    "216": [0.04861, 0.73194, 0, 0, 0.77778],
    "223": [0, 0.69444, 0, 0, 0.5],
    "230": [0, 0.43056, 0, 0, 0.72222],
    "247": [0.08333, 0.58333, 0, 0, 0.77778],
    "248": [0.09722, 0.52778, 0, 0, 0.5],
    "305": [0, 0.43056, 0, 0, 0.27778],
    "338": [0, 0.68333, 0, 0, 1.01389],
    "339": [0, 0.43056, 0, 0, 0.77778],
    "567": [0.19444, 0.43056, 0, 0, 0.30556],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.62847, 0, 0, 0.5],
    "713": [0, 0.56778, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.66786, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.75],
    "732": [0, 0.66786, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.68333, 0, 0, 0.625],
    "916": [0, 0.68333, 0, 0, 0.83334],
    "920": [0, 0.68333, 0, 0, 0.77778],
    "923": [0, 0.68333, 0, 0, 0.69445],
    "926": [0, 0.68333, 0, 0, 0.66667],
    "928": [0, 0.68333, 0, 0, 0.75],
    "931": [0, 0.68333, 0, 0, 0.72222],
    "933": [0, 0.68333, 0, 0, 0.77778],
    "934": [0, 0.68333, 0, 0, 0.72222],
    "936": [0, 0.68333, 0, 0, 0.77778],
    "937": [0, 0.68333, 0, 0, 0.72222],
    "8211": [0, 0.43056, 0.02778, 0, 0.5],
    "8212": [0, 0.43056, 0.02778, 0, 1.0],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5],
    "8224": [0.19444, 0.69444, 0, 0, 0.44445],
    "8225": [0.19444, 0.69444, 0, 0, 0.44445],
    "8230": [0, 0.123, 0, 0, 1.172],
    "8242": [0, 0.55556, 0, 0, 0.275],
    "8407": [0, 0.71444, 0.15382, 0, 0.5],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8465": [0, 0.69444, 0, 0, 0.72222],
    "8467": [0, 0.69444, 0, 0.11111, 0.41667],
    "8472": [0.19444, 0.43056, 0, 0.11111, 0.63646],
    "8476": [0, 0.69444, 0, 0, 0.72222],
    "8501": [0, 0.69444, 0, 0, 0.61111],
    "8592": [-0.13313, 0.36687, 0, 0, 1.0],
    "8593": [0.19444, 0.69444, 0, 0, 0.5],
    "8594": [-0.13313, 0.36687, 0, 0, 1.0],
    "8595": [0.19444, 0.69444, 0, 0, 0.5],
    "8596": [-0.13313, 0.36687, 0, 0, 1.0],
    "8597": [0.25, 0.75, 0, 0, 0.5],
    "8598": [0.19444, 0.69444, 0, 0, 1.0],
    "8599": [0.19444, 0.69444, 0, 0, 1.0],
    "8600": [0.19444, 0.69444, 0, 0, 1.0],
    "8601": [0.19444, 0.69444, 0, 0, 1.0],
    "8614": [0.011, 0.511, 0, 0, 1.0],
    "8617": [0.011, 0.511, 0, 0, 1.126],
    "8618": [0.011, 0.511, 0, 0, 1.126],
    "8636": [-0.13313, 0.36687, 0, 0, 1.0],
    "8637": [-0.13313, 0.36687, 0, 0, 1.0],
    "8640": [-0.13313, 0.36687, 0, 0, 1.0],
    "8641": [-0.13313, 0.36687, 0, 0, 1.0],
    "8652": [0.011, 0.671, 0, 0, 1.0],
    "8656": [-0.13313, 0.36687, 0, 0, 1.0],
    "8657": [0.19444, 0.69444, 0, 0, 0.61111],
    "8658": [-0.13313, 0.36687, 0, 0, 1.0],
    "8659": [0.19444, 0.69444, 0, 0, 0.61111],
    "8660": [-0.13313, 0.36687, 0, 0, 1.0],
    "8661": [0.25, 0.75, 0, 0, 0.61111],
    "8704": [0, 0.69444, 0, 0, 0.55556],
    "8706": [0, 0.69444, 0.05556, 0.08334, 0.5309],
    "8707": [0, 0.69444, 0, 0, 0.55556],
    "8709": [0.05556, 0.75, 0, 0, 0.5],
    "8711": [0, 0.68333, 0, 0, 0.83334],
    "8712": [0.0391, 0.5391, 0, 0, 0.66667],
    "8715": [0.0391, 0.5391, 0, 0, 0.66667],
    "8722": [0.08333, 0.58333, 0, 0, 0.77778],
    "8723": [0.08333, 0.58333, 0, 0, 0.77778],
    "8725": [0.25, 0.75, 0, 0, 0.5],
    "8726": [0.25, 0.75, 0, 0, 0.5],
    "8727": [-0.03472, 0.46528, 0, 0, 0.5],
    "8728": [-0.05555, 0.44445, 0, 0, 0.5],
    "8729": [-0.05555, 0.44445, 0, 0, 0.5],
    "8730": [0.2, 0.8, 0, 0, 0.83334],
    "8733": [0, 0.43056, 0, 0, 0.77778],
    "8734": [0, 0.43056, 0, 0, 1.0],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.27778],
    "8741": [0.25, 0.75, 0, 0, 0.5],
    "8743": [0, 0.55556, 0, 0, 0.66667],
    "8744": [0, 0.55556, 0, 0, 0.66667],
    "8745": [0, 0.55556, 0, 0, 0.66667],
    "8746": [0, 0.55556, 0, 0, 0.66667],
    "8747": [0.19444, 0.69444, 0.11111, 0, 0.41667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8768": [0.19444, 0.69444, 0, 0, 0.27778],
    "8771": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8773": [-0.022, 0.589, 0, 0, 0.778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8781": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8784": [-0.133, 0.673, 0, 0, 0.778],
    "8801": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8804": [0.13597, 0.63597, 0, 0, 0.77778],
    "8805": [0.13597, 0.63597, 0, 0, 0.77778],
    "8810": [0.0391, 0.5391, 0, 0, 1.0],
    "8811": [0.0391, 0.5391, 0, 0, 1.0],
    "8826": [0.0391, 0.5391, 0, 0, 0.77778],
    "8827": [0.0391, 0.5391, 0, 0, 0.77778],
    "8834": [0.0391, 0.5391, 0, 0, 0.77778],
    "8835": [0.0391, 0.5391, 0, 0, 0.77778],
    "8838": [0.13597, 0.63597, 0, 0, 0.77778],
    "8839": [0.13597, 0.63597, 0, 0, 0.77778],
    "8846": [0, 0.55556, 0, 0, 0.66667],
    "8849": [0.13597, 0.63597, 0, 0, 0.77778],
    "8850": [0.13597, 0.63597, 0, 0, 0.77778],
    "8851": [0, 0.55556, 0, 0, 0.66667],
    "8852": [0, 0.55556, 0, 0, 0.66667],
    "8853": [0.08333, 0.58333, 0, 0, 0.77778],
    "8854": [0.08333, 0.58333, 0, 0, 0.77778],
    "8855": [0.08333, 0.58333, 0, 0, 0.77778],
    "8856": [0.08333, 0.58333, 0, 0, 0.77778],
    "8857": [0.08333, 0.58333, 0, 0, 0.77778],
    "8866": [0, 0.69444, 0, 0, 0.61111],
    "8867": [0, 0.69444, 0, 0, 0.61111],
    "8868": [0, 0.69444, 0, 0, 0.77778],
    "8869": [0, 0.69444, 0, 0, 0.77778],
    "8872": [0.249, 0.75, 0, 0, 0.867],
    "8900": [-0.05555, 0.44445, 0, 0, 0.5],
    "8901": [-0.05555, 0.44445, 0, 0, 0.27778],
    "8902": [-0.03472, 0.46528, 0, 0, 0.5],
    "8904": [0.005, 0.505, 0, 0, 0.9],
    "8942": [0.03, 0.903, 0, 0, 0.278],
    "8943": [-0.19, 0.313, 0, 0, 1.172],
    "8945": [-0.1, 0.823, 0, 0, 1.282],
    "8968": [0.25, 0.75, 0, 0, 0.44445],
    "8969": [0.25, 0.75, 0, 0, 0.44445],
    "8970": [0.25, 0.75, 0, 0, 0.44445],
    "8971": [0.25, 0.75, 0, 0, 0.44445],
    "8994": [-0.14236, 0.35764, 0, 0, 1.0],
    "8995": [-0.14236, 0.35764, 0, 0, 1.0],
    "9136": [0.244, 0.744, 0, 0, 0.412],
    "9137": [0.244, 0.745, 0, 0, 0.412],
    "9651": [0.19444, 0.69444, 0, 0, 0.88889],
    "9657": [-0.03472, 0.46528, 0, 0, 0.5],
    "9661": [0.19444, 0.69444, 0, 0, 0.88889],
    "9667": [-0.03472, 0.46528, 0, 0, 0.5],
    "9711": [0.19444, 0.69444, 0, 0, 1.0],
    "9824": [0.12963, 0.69444, 0, 0, 0.77778],
    "9825": [0.12963, 0.69444, 0, 0, 0.77778],
    "9826": [0.12963, 0.69444, 0, 0, 0.77778],
    "9827": [0.12963, 0.69444, 0, 0, 0.77778],
    "9837": [0, 0.75, 0, 0, 0.38889],
    "9838": [0.19444, 0.69444, 0, 0, 0.38889],
    "9839": [0.19444, 0.69444, 0, 0, 0.38889],
    "10216": [0.25, 0.75, 0, 0, 0.38889],
    "10217": [0.25, 0.75, 0, 0, 0.38889],
    "10222": [0.244, 0.744, 0, 0, 0.412],
    "10223": [0.244, 0.745, 0, 0, 0.412],
    "10229": [0.011, 0.511, 0, 0, 1.609],
    "10230": [0.011, 0.511, 0, 0, 1.638],
    "10231": [0.011, 0.511, 0, 0, 1.859],
    "10232": [0.024, 0.525, 0, 0, 1.609],
    "10233": [0.024, 0.525, 0, 0, 1.638],
    "10234": [0.024, 0.525, 0, 0, 1.858],
    "10236": [0.011, 0.511, 0, 0, 1.638],
    "10815": [0, 0.68333, 0, 0, 0.75],
    "10927": [0.13597, 0.63597, 0, 0, 0.77778],
    "10928": [0.13597, 0.63597, 0, 0, 0.77778],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Math-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.44444, 0, 0, 0.575],
    "49": [0, 0.44444, 0, 0, 0.575],
    "50": [0, 0.44444, 0, 0, 0.575],
    "51": [0.19444, 0.44444, 0, 0, 0.575],
    "52": [0.19444, 0.44444, 0, 0, 0.575],
    "53": [0.19444, 0.44444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0.19444, 0.44444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0.19444, 0.44444, 0, 0, 0.575],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0.04835, 0, 0.8664],
    "67": [0, 0.68611, 0.06979, 0, 0.81694],
    "68": [0, 0.68611, 0.03194, 0, 0.93812],
    "69": [0, 0.68611, 0.05451, 0, 0.81007],
    "70": [0, 0.68611, 0.15972, 0, 0.68889],
    "71": [0, 0.68611, 0, 0, 0.88673],
    "72": [0, 0.68611, 0.08229, 0, 0.98229],
    "73": [0, 0.68611, 0.07778, 0, 0.51111],
    "74": [0, 0.68611, 0.10069, 0, 0.63125],
    "75": [0, 0.68611, 0.06979, 0, 0.97118],
    "76": [0, 0.68611, 0, 0, 0.75555],
    "77": [0, 0.68611, 0.11424, 0, 1.14201],
    "78": [0, 0.68611, 0.11424, 0, 0.95034],
    "79": [0, 0.68611, 0.03194, 0, 0.83666],
    "80": [0, 0.68611, 0.15972, 0, 0.72309],
    "81": [0.19444, 0.68611, 0, 0, 0.86861],
    "82": [0, 0.68611, 0.00421, 0, 0.87235],
    "83": [0, 0.68611, 0.05382, 0, 0.69271],
    "84": [0, 0.68611, 0.15972, 0, 0.63663],
    "85": [0, 0.68611, 0.11424, 0, 0.80027],
    "86": [0, 0.68611, 0.25555, 0, 0.67778],
    "87": [0, 0.68611, 0.15972, 0, 1.09305],
    "88": [0, 0.68611, 0.07778, 0, 0.94722],
    "89": [0, 0.68611, 0.25555, 0, 0.67458],
    "90": [0, 0.68611, 0.06979, 0, 0.77257],
    "97": [0, 0.44444, 0, 0, 0.63287],
    "98": [0, 0.69444, 0, 0, 0.52083],
    "99": [0, 0.44444, 0, 0, 0.51342],
    "100": [0, 0.69444, 0, 0, 0.60972],
    "101": [0, 0.44444, 0, 0, 0.55361],
    "102": [0.19444, 0.69444, 0.11042, 0, 0.56806],
    "103": [0.19444, 0.44444, 0.03704, 0, 0.5449],
    "104": [0, 0.69444, 0, 0, 0.66759],
    "105": [0, 0.69326, 0, 0, 0.4048],
    "106": [0.19444, 0.69326, 0.0622, 0, 0.47083],
    "107": [0, 0.69444, 0.01852, 0, 0.6037],
    "108": [0, 0.69444, 0.0088, 0, 0.34815],
    "109": [0, 0.44444, 0, 0, 1.0324],
    "110": [0, 0.44444, 0, 0, 0.71296],
    "111": [0, 0.44444, 0, 0, 0.58472],
    "112": [0.19444, 0.44444, 0, 0, 0.60092],
    "113": [0.19444, 0.44444, 0.03704, 0, 0.54213],
    "114": [0, 0.44444, 0.03194, 0, 0.5287],
    "115": [0, 0.44444, 0, 0, 0.53125],
    "116": [0, 0.63492, 0, 0, 0.41528],
    "117": [0, 0.44444, 0, 0, 0.68102],
    "118": [0, 0.44444, 0.03704, 0, 0.56666],
    "119": [0, 0.44444, 0.02778, 0, 0.83148],
    "120": [0, 0.44444, 0, 0, 0.65903],
    "121": [0.19444, 0.44444, 0.03704, 0, 0.59028],
    "122": [0, 0.44444, 0.04213, 0, 0.55509],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68611, 0.15972, 0, 0.65694],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0.03194, 0, 0.86722],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0.07458, 0, 0.84125],
    "928": [0, 0.68611, 0.08229, 0, 0.98229],
    "931": [0, 0.68611, 0.05451, 0, 0.88507],
    "933": [0, 0.68611, 0.15972, 0, 0.67083],
    "934": [0, 0.68611, 0, 0, 0.76666],
    "936": [0, 0.68611, 0.11653, 0, 0.71402],
    "937": [0, 0.68611, 0.04835, 0, 0.8789],
    "945": [0, 0.44444, 0, 0, 0.76064],
    "946": [0.19444, 0.69444, 0.03403, 0, 0.65972],
    "947": [0.19444, 0.44444, 0.06389, 0, 0.59003],
    "948": [0, 0.69444, 0.03819, 0, 0.52222],
    "949": [0, 0.44444, 0, 0, 0.52882],
    "950": [0.19444, 0.69444, 0.06215, 0, 0.50833],
    "951": [0.19444, 0.44444, 0.03704, 0, 0.6],
    "952": [0, 0.69444, 0.03194, 0, 0.5618],
    "953": [0, 0.44444, 0, 0, 0.41204],
    "954": [0, 0.44444, 0, 0, 0.66759],
    "955": [0, 0.69444, 0, 0, 0.67083],
    "956": [0.19444, 0.44444, 0, 0, 0.70787],
    "957": [0, 0.44444, 0.06898, 0, 0.57685],
    "958": [0.19444, 0.69444, 0.03021, 0, 0.50833],
    "959": [0, 0.44444, 0, 0, 0.58472],
    "960": [0, 0.44444, 0.03704, 0, 0.68241],
    "961": [0.19444, 0.44444, 0, 0, 0.6118],
    "962": [0.09722, 0.44444, 0.07917, 0, 0.42361],
    "963": [0, 0.44444, 0.03704, 0, 0.68588],
    "964": [0, 0.44444, 0.13472, 0, 0.52083],
    "965": [0, 0.44444, 0.03704, 0, 0.63055],
    "966": [0.19444, 0.44444, 0, 0, 0.74722],
    "967": [0.19444, 0.44444, 0, 0, 0.71805],
    "968": [0.19444, 0.69444, 0.03704, 0, 0.75833],
    "969": [0, 0.44444, 0.03704, 0, 0.71782],
    "977": [0, 0.69444, 0, 0, 0.69155],
    "981": [0.19444, 0.69444, 0, 0, 0.7125],
    "982": [0, 0.44444, 0.03194, 0, 0.975],
    "1009": [0.19444, 0.44444, 0, 0, 0.6118],
    "1013": [0, 0.44444, 0, 0, 0.48333],
    "57649": [0, 0.44444, 0, 0, 0.39352],
    "57911": [0.19444, 0.44444, 0, 0, 0.43889]
  },
  "Math-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.43056, 0, 0, 0.5],
    "49": [0, 0.43056, 0, 0, 0.5],
    "50": [0, 0.43056, 0, 0, 0.5],
    "51": [0.19444, 0.43056, 0, 0, 0.5],
    "52": [0.19444, 0.43056, 0, 0, 0.5],
    "53": [0.19444, 0.43056, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0.19444, 0.43056, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0.19444, 0.43056, 0, 0, 0.5],
    "65": [0, 0.68333, 0, 0.13889, 0.75],
    "66": [0, 0.68333, 0.05017, 0.08334, 0.75851],
    "67": [0, 0.68333, 0.07153, 0.08334, 0.71472],
    "68": [0, 0.68333, 0.02778, 0.05556, 0.82792],
    "69": [0, 0.68333, 0.05764, 0.08334, 0.7382],
    "70": [0, 0.68333, 0.13889, 0.08334, 0.64306],
    "71": [0, 0.68333, 0, 0.08334, 0.78625],
    "72": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "73": [0, 0.68333, 0.07847, 0.11111, 0.43958],
    "74": [0, 0.68333, 0.09618, 0.16667, 0.55451],
    "75": [0, 0.68333, 0.07153, 0.05556, 0.84931],
    "76": [0, 0.68333, 0, 0.02778, 0.68056],
    "77": [0, 0.68333, 0.10903, 0.08334, 0.97014],
    "78": [0, 0.68333, 0.10903, 0.08334, 0.80347],
    "79": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "80": [0, 0.68333, 0.13889, 0.08334, 0.64201],
    "81": [0.19444, 0.68333, 0, 0.08334, 0.79056],
    "82": [0, 0.68333, 0.00773, 0.08334, 0.75929],
    "83": [0, 0.68333, 0.05764, 0.08334, 0.6132],
    "84": [0, 0.68333, 0.13889, 0.08334, 0.58438],
    "85": [0, 0.68333, 0.10903, 0.02778, 0.68278],
    "86": [0, 0.68333, 0.22222, 0, 0.58333],
    "87": [0, 0.68333, 0.13889, 0, 0.94445],
    "88": [0, 0.68333, 0.07847, 0.08334, 0.82847],
    "89": [0, 0.68333, 0.22222, 0, 0.58056],
    "90": [0, 0.68333, 0.07153, 0.08334, 0.68264],
    "97": [0, 0.43056, 0, 0, 0.52859],
    "98": [0, 0.69444, 0, 0, 0.42917],
    "99": [0, 0.43056, 0, 0.05556, 0.43276],
    "100": [0, 0.69444, 0, 0.16667, 0.52049],
    "101": [0, 0.43056, 0, 0.05556, 0.46563],
    "102": [0.19444, 0.69444, 0.10764, 0.16667, 0.48959],
    "103": [0.19444, 0.43056, 0.03588, 0.02778, 0.47697],
    "104": [0, 0.69444, 0, 0, 0.57616],
    "105": [0, 0.65952, 0, 0, 0.34451],
    "106": [0.19444, 0.65952, 0.05724, 0, 0.41181],
    "107": [0, 0.69444, 0.03148, 0, 0.5206],
    "108": [0, 0.69444, 0.01968, 0.08334, 0.29838],
    "109": [0, 0.43056, 0, 0, 0.87801],
    "110": [0, 0.43056, 0, 0, 0.60023],
    "111": [0, 0.43056, 0, 0.05556, 0.48472],
    "112": [0.19444, 0.43056, 0, 0.08334, 0.50313],
    "113": [0.19444, 0.43056, 0.03588, 0.08334, 0.44641],
    "114": [0, 0.43056, 0.02778, 0.05556, 0.45116],
    "115": [0, 0.43056, 0, 0.05556, 0.46875],
    "116": [0, 0.61508, 0, 0.08334, 0.36111],
    "117": [0, 0.43056, 0, 0.02778, 0.57246],
    "118": [0, 0.43056, 0.03588, 0.02778, 0.48472],
    "119": [0, 0.43056, 0.02691, 0.08334, 0.71592],
    "120": [0, 0.43056, 0, 0.02778, 0.57153],
    "121": [0.19444, 0.43056, 0.03588, 0.05556, 0.49028],
    "122": [0, 0.43056, 0.04398, 0.05556, 0.46505],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68333, 0.13889, 0.08334, 0.61528],
    "916": [0, 0.68333, 0, 0.16667, 0.83334],
    "920": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "923": [0, 0.68333, 0, 0.16667, 0.69445],
    "926": [0, 0.68333, 0.07569, 0.08334, 0.74236],
    "928": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "931": [0, 0.68333, 0.05764, 0.08334, 0.77986],
    "933": [0, 0.68333, 0.13889, 0.05556, 0.58333],
    "934": [0, 0.68333, 0, 0.08334, 0.66667],
    "936": [0, 0.68333, 0.11, 0.05556, 0.61222],
    "937": [0, 0.68333, 0.05017, 0.08334, 0.7724],
    "945": [0, 0.43056, 0.0037, 0.02778, 0.6397],
    "946": [0.19444, 0.69444, 0.05278, 0.08334, 0.56563],
    "947": [0.19444, 0.43056, 0.05556, 0, 0.51773],
    "948": [0, 0.69444, 0.03785, 0.05556, 0.44444],
    "949": [0, 0.43056, 0, 0.08334, 0.46632],
    "950": [0.19444, 0.69444, 0.07378, 0.08334, 0.4375],
    "951": [0.19444, 0.43056, 0.03588, 0.05556, 0.49653],
    "952": [0, 0.69444, 0.02778, 0.08334, 0.46944],
    "953": [0, 0.43056, 0, 0.05556, 0.35394],
    "954": [0, 0.43056, 0, 0, 0.57616],
    "955": [0, 0.69444, 0, 0, 0.58334],
    "956": [0.19444, 0.43056, 0, 0.02778, 0.60255],
    "957": [0, 0.43056, 0.06366, 0.02778, 0.49398],
    "958": [0.19444, 0.69444, 0.04601, 0.11111, 0.4375],
    "959": [0, 0.43056, 0, 0.05556, 0.48472],
    "960": [0, 0.43056, 0.03588, 0, 0.57003],
    "961": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "962": [0.09722, 0.43056, 0.07986, 0.08334, 0.36285],
    "963": [0, 0.43056, 0.03588, 0, 0.57141],
    "964": [0, 0.43056, 0.1132, 0.02778, 0.43715],
    "965": [0, 0.43056, 0.03588, 0.02778, 0.54028],
    "966": [0.19444, 0.43056, 0, 0.08334, 0.65417],
    "967": [0.19444, 0.43056, 0, 0.05556, 0.62569],
    "968": [0.19444, 0.69444, 0.03588, 0.11111, 0.65139],
    "969": [0, 0.43056, 0.03588, 0, 0.62245],
    "977": [0, 0.69444, 0, 0.08334, 0.59144],
    "981": [0.19444, 0.69444, 0, 0.08334, 0.59583],
    "982": [0, 0.43056, 0.02778, 0, 0.82813],
    "1009": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "1013": [0, 0.43056, 0, 0.05556, 0.4059],
    "57649": [0, 0.43056, 0, 0.02778, 0.32246],
    "57911": [0.19444, 0.43056, 0, 0.08334, 0.38403]
  },
  "SansSerif-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.36667],
    "34": [0, 0.69444, 0, 0, 0.55834],
    "35": [0.19444, 0.69444, 0, 0, 0.91667],
    "36": [0.05556, 0.75, 0, 0, 0.55],
    "37": [0.05556, 0.75, 0, 0, 1.02912],
    "38": [0, 0.69444, 0, 0, 0.83056],
    "39": [0, 0.69444, 0, 0, 0.30556],
    "40": [0.25, 0.75, 0, 0, 0.42778],
    "41": [0.25, 0.75, 0, 0, 0.42778],
    "42": [0, 0.75, 0, 0, 0.55],
    "43": [0.11667, 0.61667, 0, 0, 0.85556],
    "44": [0.10556, 0.13056, 0, 0, 0.30556],
    "45": [0, 0.45833, 0, 0, 0.36667],
    "46": [0, 0.13056, 0, 0, 0.30556],
    "47": [0.25, 0.75, 0, 0, 0.55],
    "48": [0, 0.69444, 0, 0, 0.55],
    "49": [0, 0.69444, 0, 0, 0.55],
    "50": [0, 0.69444, 0, 0, 0.55],
    "51": [0, 0.69444, 0, 0, 0.55],
    "52": [0, 0.69444, 0, 0, 0.55],
    "53": [0, 0.69444, 0, 0, 0.55],
    "54": [0, 0.69444, 0, 0, 0.55],
    "55": [0, 0.69444, 0, 0, 0.55],
    "56": [0, 0.69444, 0, 0, 0.55],
    "57": [0, 0.69444, 0, 0, 0.55],
    "58": [0, 0.45833, 0, 0, 0.30556],
    "59": [0.10556, 0.45833, 0, 0, 0.30556],
    "61": [-0.09375, 0.40625, 0, 0, 0.85556],
    "63": [0, 0.69444, 0, 0, 0.51945],
    "64": [0, 0.69444, 0, 0, 0.73334],
    "65": [0, 0.69444, 0, 0, 0.73334],
    "66": [0, 0.69444, 0, 0, 0.73334],
    "67": [0, 0.69444, 0, 0, 0.70278],
    "68": [0, 0.69444, 0, 0, 0.79445],
    "69": [0, 0.69444, 0, 0, 0.64167],
    "70": [0, 0.69444, 0, 0, 0.61111],
    "71": [0, 0.69444, 0, 0, 0.73334],
    "72": [0, 0.69444, 0, 0, 0.79445],
    "73": [0, 0.69444, 0, 0, 0.33056],
    "74": [0, 0.69444, 0, 0, 0.51945],
    "75": [0, 0.69444, 0, 0, 0.76389],
    "76": [0, 0.69444, 0, 0, 0.58056],
    "77": [0, 0.69444, 0, 0, 0.97778],
    "78": [0, 0.69444, 0, 0, 0.79445],
    "79": [0, 0.69444, 0, 0, 0.79445],
    "80": [0, 0.69444, 0, 0, 0.70278],
    "81": [0.10556, 0.69444, 0, 0, 0.79445],
    "82": [0, 0.69444, 0, 0, 0.70278],
    "83": [0, 0.69444, 0, 0, 0.61111],
    "84": [0, 0.69444, 0, 0, 0.73334],
    "85": [0, 0.69444, 0, 0, 0.76389],
    "86": [0, 0.69444, 0.01528, 0, 0.73334],
    "87": [0, 0.69444, 0.01528, 0, 1.03889],
    "88": [0, 0.69444, 0, 0, 0.73334],
    "89": [0, 0.69444, 0.0275, 0, 0.73334],
    "90": [0, 0.69444, 0, 0, 0.67223],
    "91": [0.25, 0.75, 0, 0, 0.34306],
    "93": [0.25, 0.75, 0, 0, 0.34306],
    "94": [0, 0.69444, 0, 0, 0.55],
    "95": [0.35, 0.10833, 0.03056, 0, 0.55],
    "97": [0, 0.45833, 0, 0, 0.525],
    "98": [0, 0.69444, 0, 0, 0.56111],
    "99": [0, 0.45833, 0, 0, 0.48889],
    "100": [0, 0.69444, 0, 0, 0.56111],
    "101": [0, 0.45833, 0, 0, 0.51111],
    "102": [0, 0.69444, 0.07639, 0, 0.33611],
    "103": [0.19444, 0.45833, 0.01528, 0, 0.55],
    "104": [0, 0.69444, 0, 0, 0.56111],
    "105": [0, 0.69444, 0, 0, 0.25556],
    "106": [0.19444, 0.69444, 0, 0, 0.28611],
    "107": [0, 0.69444, 0, 0, 0.53056],
    "108": [0, 0.69444, 0, 0, 0.25556],
    "109": [0, 0.45833, 0, 0, 0.86667],
    "110": [0, 0.45833, 0, 0, 0.56111],
    "111": [0, 0.45833, 0, 0, 0.55],
    "112": [0.19444, 0.45833, 0, 0, 0.56111],
    "113": [0.19444, 0.45833, 0, 0, 0.56111],
    "114": [0, 0.45833, 0.01528, 0, 0.37222],
    "115": [0, 0.45833, 0, 0, 0.42167],
    "116": [0, 0.58929, 0, 0, 0.40417],
    "117": [0, 0.45833, 0, 0, 0.56111],
    "118": [0, 0.45833, 0.01528, 0, 0.5],
    "119": [0, 0.45833, 0.01528, 0, 0.74445],
    "120": [0, 0.45833, 0, 0, 0.5],
    "121": [0.19444, 0.45833, 0.01528, 0, 0.5],
    "122": [0, 0.45833, 0, 0, 0.47639],
    "126": [0.35, 0.34444, 0, 0, 0.55],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0, 0, 0.55],
    "176": [0, 0.69444, 0, 0, 0.73334],
    "180": [0, 0.69444, 0, 0, 0.55],
    "184": [0.17014, 0, 0, 0, 0.48889],
    "305": [0, 0.45833, 0, 0, 0.25556],
    "567": [0.19444, 0.45833, 0, 0, 0.28611],
    "710": [0, 0.69444, 0, 0, 0.55],
    "711": [0, 0.63542, 0, 0, 0.55],
    "713": [0, 0.63778, 0, 0, 0.55],
    "728": [0, 0.69444, 0, 0, 0.55],
    "729": [0, 0.69444, 0, 0, 0.30556],
    "730": [0, 0.69444, 0, 0, 0.73334],
    "732": [0, 0.69444, 0, 0, 0.55],
    "733": [0, 0.69444, 0, 0, 0.55],
    "915": [0, 0.69444, 0, 0, 0.58056],
    "916": [0, 0.69444, 0, 0, 0.91667],
    "920": [0, 0.69444, 0, 0, 0.85556],
    "923": [0, 0.69444, 0, 0, 0.67223],
    "926": [0, 0.69444, 0, 0, 0.73334],
    "928": [0, 0.69444, 0, 0, 0.79445],
    "931": [0, 0.69444, 0, 0, 0.79445],
    "933": [0, 0.69444, 0, 0, 0.85556],
    "934": [0, 0.69444, 0, 0, 0.79445],
    "936": [0, 0.69444, 0, 0, 0.85556],
    "937": [0, 0.69444, 0, 0, 0.79445],
    "8211": [0, 0.45833, 0.03056, 0, 0.55],
    "8212": [0, 0.45833, 0.03056, 0, 1.10001],
    "8216": [0, 0.69444, 0, 0, 0.30556],
    "8217": [0, 0.69444, 0, 0, 0.30556],
    "8220": [0, 0.69444, 0, 0, 0.55834],
    "8221": [0, 0.69444, 0, 0, 0.55834]
  },
  "SansSerif-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.05733, 0, 0.31945],
    "34": [0, 0.69444, 0.00316, 0, 0.5],
    "35": [0.19444, 0.69444, 0.05087, 0, 0.83334],
    "36": [0.05556, 0.75, 0.11156, 0, 0.5],
    "37": [0.05556, 0.75, 0.03126, 0, 0.83334],
    "38": [0, 0.69444, 0.03058, 0, 0.75834],
    "39": [0, 0.69444, 0.07816, 0, 0.27778],
    "40": [0.25, 0.75, 0.13164, 0, 0.38889],
    "41": [0.25, 0.75, 0.02536, 0, 0.38889],
    "42": [0, 0.75, 0.11775, 0, 0.5],
    "43": [0.08333, 0.58333, 0.02536, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0.01946, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0.13164, 0, 0.5],
    "48": [0, 0.65556, 0.11156, 0, 0.5],
    "49": [0, 0.65556, 0.11156, 0, 0.5],
    "50": [0, 0.65556, 0.11156, 0, 0.5],
    "51": [0, 0.65556, 0.11156, 0, 0.5],
    "52": [0, 0.65556, 0.11156, 0, 0.5],
    "53": [0, 0.65556, 0.11156, 0, 0.5],
    "54": [0, 0.65556, 0.11156, 0, 0.5],
    "55": [0, 0.65556, 0.11156, 0, 0.5],
    "56": [0, 0.65556, 0.11156, 0, 0.5],
    "57": [0, 0.65556, 0.11156, 0, 0.5],
    "58": [0, 0.44444, 0.02502, 0, 0.27778],
    "59": [0.125, 0.44444, 0.02502, 0, 0.27778],
    "61": [-0.13, 0.37, 0.05087, 0, 0.77778],
    "63": [0, 0.69444, 0.11809, 0, 0.47222],
    "64": [0, 0.69444, 0.07555, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0.08293, 0, 0.66667],
    "67": [0, 0.69444, 0.11983, 0, 0.63889],
    "68": [0, 0.69444, 0.07555, 0, 0.72223],
    "69": [0, 0.69444, 0.11983, 0, 0.59722],
    "70": [0, 0.69444, 0.13372, 0, 0.56945],
    "71": [0, 0.69444, 0.11983, 0, 0.66667],
    "72": [0, 0.69444, 0.08094, 0, 0.70834],
    "73": [0, 0.69444, 0.13372, 0, 0.27778],
    "74": [0, 0.69444, 0.08094, 0, 0.47222],
    "75": [0, 0.69444, 0.11983, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0.08094, 0, 0.875],
    "78": [0, 0.69444, 0.08094, 0, 0.70834],
    "79": [0, 0.69444, 0.07555, 0, 0.73611],
    "80": [0, 0.69444, 0.08293, 0, 0.63889],
    "81": [0.125, 0.69444, 0.07555, 0, 0.73611],
    "82": [0, 0.69444, 0.08293, 0, 0.64584],
    "83": [0, 0.69444, 0.09205, 0, 0.55556],
    "84": [0, 0.69444, 0.13372, 0, 0.68056],
    "85": [0, 0.69444, 0.08094, 0, 0.6875],
    "86": [0, 0.69444, 0.1615, 0, 0.66667],
    "87": [0, 0.69444, 0.1615, 0, 0.94445],
    "88": [0, 0.69444, 0.13372, 0, 0.66667],
    "89": [0, 0.69444, 0.17261, 0, 0.66667],
    "90": [0, 0.69444, 0.11983, 0, 0.61111],
    "91": [0.25, 0.75, 0.15942, 0, 0.28889],
    "93": [0.25, 0.75, 0.08719, 0, 0.28889],
    "94": [0, 0.69444, 0.0799, 0, 0.5],
    "95": [0.35, 0.09444, 0.08616, 0, 0.5],
    "97": [0, 0.44444, 0.00981, 0, 0.48056],
    "98": [0, 0.69444, 0.03057, 0, 0.51667],
    "99": [0, 0.44444, 0.08336, 0, 0.44445],
    "100": [0, 0.69444, 0.09483, 0, 0.51667],
    "101": [0, 0.44444, 0.06778, 0, 0.44445],
    "102": [0, 0.69444, 0.21705, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.10836, 0, 0.5],
    "104": [0, 0.69444, 0.01778, 0, 0.51667],
    "105": [0, 0.67937, 0.09718, 0, 0.23889],
    "106": [0.19444, 0.67937, 0.09162, 0, 0.26667],
    "107": [0, 0.69444, 0.08336, 0, 0.48889],
    "108": [0, 0.69444, 0.09483, 0, 0.23889],
    "109": [0, 0.44444, 0.01778, 0, 0.79445],
    "110": [0, 0.44444, 0.01778, 0, 0.51667],
    "111": [0, 0.44444, 0.06613, 0, 0.5],
    "112": [0.19444, 0.44444, 0.0389, 0, 0.51667],
    "113": [0.19444, 0.44444, 0.04169, 0, 0.51667],
    "114": [0, 0.44444, 0.10836, 0, 0.34167],
    "115": [0, 0.44444, 0.0778, 0, 0.38333],
    "116": [0, 0.57143, 0.07225, 0, 0.36111],
    "117": [0, 0.44444, 0.04169, 0, 0.51667],
    "118": [0, 0.44444, 0.10836, 0, 0.46111],
    "119": [0, 0.44444, 0.10836, 0, 0.68334],
    "120": [0, 0.44444, 0.09169, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.10836, 0, 0.46111],
    "122": [0, 0.44444, 0.08752, 0, 0.43472],
    "126": [0.35, 0.32659, 0.08826, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0.06385, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.73752],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0.04169, 0, 0.23889],
    "567": [0.19444, 0.44444, 0.04169, 0, 0.26667],
    "710": [0, 0.69444, 0.0799, 0, 0.5],
    "711": [0, 0.63194, 0.08432, 0, 0.5],
    "713": [0, 0.60889, 0.08776, 0, 0.5],
    "714": [0, 0.69444, 0.09205, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0.09483, 0, 0.5],
    "729": [0, 0.67937, 0.07774, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.73752],
    "732": [0, 0.67659, 0.08826, 0, 0.5],
    "733": [0, 0.69444, 0.09205, 0, 0.5],
    "915": [0, 0.69444, 0.13372, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0.07555, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0.12816, 0, 0.66667],
    "928": [0, 0.69444, 0.08094, 0, 0.70834],
    "931": [0, 0.69444, 0.11983, 0, 0.72222],
    "933": [0, 0.69444, 0.09031, 0, 0.77778],
    "934": [0, 0.69444, 0.04603, 0, 0.72222],
    "936": [0, 0.69444, 0.09031, 0, 0.77778],
    "937": [0, 0.69444, 0.08293, 0, 0.72222],
    "8211": [0, 0.44444, 0.08616, 0, 0.5],
    "8212": [0, 0.44444, 0.08616, 0, 1.0],
    "8216": [0, 0.69444, 0.07816, 0, 0.27778],
    "8217": [0, 0.69444, 0.07816, 0, 0.27778],
    "8220": [0, 0.69444, 0.14205, 0, 0.5],
    "8221": [0, 0.69444, 0.00316, 0, 0.5]
  },
  "SansSerif-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.31945],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.75834],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.65556, 0, 0, 0.5],
    "49": [0, 0.65556, 0, 0, 0.5],
    "50": [0, 0.65556, 0, 0, 0.5],
    "51": [0, 0.65556, 0, 0, 0.5],
    "52": [0, 0.65556, 0, 0, 0.5],
    "53": [0, 0.65556, 0, 0, 0.5],
    "54": [0, 0.65556, 0, 0, 0.5],
    "55": [0, 0.65556, 0, 0, 0.5],
    "56": [0, 0.65556, 0, 0, 0.5],
    "57": [0, 0.65556, 0, 0, 0.5],
    "58": [0, 0.44444, 0, 0, 0.27778],
    "59": [0.125, 0.44444, 0, 0, 0.27778],
    "61": [-0.13, 0.37, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0, 0, 0.66667],
    "67": [0, 0.69444, 0, 0, 0.63889],
    "68": [0, 0.69444, 0, 0, 0.72223],
    "69": [0, 0.69444, 0, 0, 0.59722],
    "70": [0, 0.69444, 0, 0, 0.56945],
    "71": [0, 0.69444, 0, 0, 0.66667],
    "72": [0, 0.69444, 0, 0, 0.70834],
    "73": [0, 0.69444, 0, 0, 0.27778],
    "74": [0, 0.69444, 0, 0, 0.47222],
    "75": [0, 0.69444, 0, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0, 0, 0.875],
    "78": [0, 0.69444, 0, 0, 0.70834],
    "79": [0, 0.69444, 0, 0, 0.73611],
    "80": [0, 0.69444, 0, 0, 0.63889],
    "81": [0.125, 0.69444, 0, 0, 0.73611],
    "82": [0, 0.69444, 0, 0, 0.64584],
    "83": [0, 0.69444, 0, 0, 0.55556],
    "84": [0, 0.69444, 0, 0, 0.68056],
    "85": [0, 0.69444, 0, 0, 0.6875],
    "86": [0, 0.69444, 0.01389, 0, 0.66667],
    "87": [0, 0.69444, 0.01389, 0, 0.94445],
    "88": [0, 0.69444, 0, 0, 0.66667],
    "89": [0, 0.69444, 0.025, 0, 0.66667],
    "90": [0, 0.69444, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.28889],
    "93": [0.25, 0.75, 0, 0, 0.28889],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.35, 0.09444, 0.02778, 0, 0.5],
    "97": [0, 0.44444, 0, 0, 0.48056],
    "98": [0, 0.69444, 0, 0, 0.51667],
    "99": [0, 0.44444, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.51667],
    "101": [0, 0.44444, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.06944, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.51667],
    "105": [0, 0.67937, 0, 0, 0.23889],
    "106": [0.19444, 0.67937, 0, 0, 0.26667],
    "107": [0, 0.69444, 0, 0, 0.48889],
    "108": [0, 0.69444, 0, 0, 0.23889],
    "109": [0, 0.44444, 0, 0, 0.79445],
    "110": [0, 0.44444, 0, 0, 0.51667],
    "111": [0, 0.44444, 0, 0, 0.5],
    "112": [0.19444, 0.44444, 0, 0, 0.51667],
    "113": [0.19444, 0.44444, 0, 0, 0.51667],
    "114": [0, 0.44444, 0.01389, 0, 0.34167],
    "115": [0, 0.44444, 0, 0, 0.38333],
    "116": [0, 0.57143, 0, 0, 0.36111],
    "117": [0, 0.44444, 0, 0, 0.51667],
    "118": [0, 0.44444, 0.01389, 0, 0.46111],
    "119": [0, 0.44444, 0.01389, 0, 0.68334],
    "120": [0, 0.44444, 0, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.01389, 0, 0.46111],
    "122": [0, 0.44444, 0, 0, 0.43472],
    "126": [0.35, 0.32659, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.66667],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0, 0, 0.23889],
    "567": [0.19444, 0.44444, 0, 0, 0.26667],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.63194, 0, 0, 0.5],
    "713": [0, 0.60889, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.67937, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.66667],
    "732": [0, 0.67659, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.69444, 0, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0, 0, 0.66667],
    "928": [0, 0.69444, 0, 0, 0.70834],
    "931": [0, 0.69444, 0, 0, 0.72222],
    "933": [0, 0.69444, 0, 0, 0.77778],
    "934": [0, 0.69444, 0, 0, 0.72222],
    "936": [0, 0.69444, 0, 0, 0.77778],
    "937": [0, 0.69444, 0, 0, 0.72222],
    "8211": [0, 0.44444, 0.02778, 0, 0.5],
    "8212": [0, 0.44444, 0.02778, 0, 1.0],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5]
  },
  "Script-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.7, 0.22925, 0, 0.80253],
    "66": [0, 0.7, 0.04087, 0, 0.90757],
    "67": [0, 0.7, 0.1689, 0, 0.66619],
    "68": [0, 0.7, 0.09371, 0, 0.77443],
    "69": [0, 0.7, 0.18583, 0, 0.56162],
    "70": [0, 0.7, 0.13634, 0, 0.89544],
    "71": [0, 0.7, 0.17322, 0, 0.60961],
    "72": [0, 0.7, 0.29694, 0, 0.96919],
    "73": [0, 0.7, 0.19189, 0, 0.80907],
    "74": [0.27778, 0.7, 0.19189, 0, 1.05159],
    "75": [0, 0.7, 0.31259, 0, 0.91364],
    "76": [0, 0.7, 0.19189, 0, 0.87373],
    "77": [0, 0.7, 0.15981, 0, 1.08031],
    "78": [0, 0.7, 0.3525, 0, 0.9015],
    "79": [0, 0.7, 0.08078, 0, 0.73787],
    "80": [0, 0.7, 0.08078, 0, 1.01262],
    "81": [0, 0.7, 0.03305, 0, 0.88282],
    "82": [0, 0.7, 0.06259, 0, 0.85],
    "83": [0, 0.7, 0.19189, 0, 0.86767],
    "84": [0, 0.7, 0.29087, 0, 0.74697],
    "85": [0, 0.7, 0.25815, 0, 0.79996],
    "86": [0, 0.7, 0.27523, 0, 0.62204],
    "87": [0, 0.7, 0.27523, 0, 0.80532],
    "88": [0, 0.7, 0.26006, 0, 0.94445],
    "89": [0, 0.7, 0.2939, 0, 0.70961],
    "90": [0, 0.7, 0.24037, 0, 0.8212],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Size1-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.35001, 0.85, 0, 0, 0.45834],
    "41": [0.35001, 0.85, 0, 0, 0.45834],
    "47": [0.35001, 0.85, 0, 0, 0.57778],
    "91": [0.35001, 0.85, 0, 0, 0.41667],
    "92": [0.35001, 0.85, 0, 0, 0.57778],
    "93": [0.35001, 0.85, 0, 0, 0.41667],
    "123": [0.35001, 0.85, 0, 0, 0.58334],
    "125": [0.35001, 0.85, 0, 0, 0.58334],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.72222, 0, 0, 0.55556],
    "732": [0, 0.72222, 0, 0, 0.55556],
    "770": [0, 0.72222, 0, 0, 0.55556],
    "771": [0, 0.72222, 0, 0, 0.55556],
    "8214": [-99e-5, 0.601, 0, 0, 0.77778],
    "8593": [1e-05, 0.6, 0, 0, 0.66667],
    "8595": [1e-05, 0.6, 0, 0, 0.66667],
    "8657": [1e-05, 0.6, 0, 0, 0.77778],
    "8659": [1e-05, 0.6, 0, 0, 0.77778],
    "8719": [0.25001, 0.75, 0, 0, 0.94445],
    "8720": [0.25001, 0.75, 0, 0, 0.94445],
    "8721": [0.25001, 0.75, 0, 0, 1.05556],
    "8730": [0.35001, 0.85, 0, 0, 1.0],
    "8739": [-599e-5, 0.606, 0, 0, 0.33333],
    "8741": [-599e-5, 0.606, 0, 0, 0.55556],
    "8747": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8748": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8749": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8750": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8896": [0.25001, 0.75, 0, 0, 0.83334],
    "8897": [0.25001, 0.75, 0, 0, 0.83334],
    "8898": [0.25001, 0.75, 0, 0, 0.83334],
    "8899": [0.25001, 0.75, 0, 0, 0.83334],
    "8968": [0.35001, 0.85, 0, 0, 0.47222],
    "8969": [0.35001, 0.85, 0, 0, 0.47222],
    "8970": [0.35001, 0.85, 0, 0, 0.47222],
    "8971": [0.35001, 0.85, 0, 0, 0.47222],
    "9168": [-99e-5, 0.601, 0, 0, 0.66667],
    "10216": [0.35001, 0.85, 0, 0, 0.47222],
    "10217": [0.35001, 0.85, 0, 0, 0.47222],
    "10752": [0.25001, 0.75, 0, 0, 1.11111],
    "10753": [0.25001, 0.75, 0, 0, 1.11111],
    "10754": [0.25001, 0.75, 0, 0, 1.11111],
    "10756": [0.25001, 0.75, 0, 0, 0.83334],
    "10758": [0.25001, 0.75, 0, 0, 0.83334]
  },
  "Size2-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.65002, 1.15, 0, 0, 0.59722],
    "41": [0.65002, 1.15, 0, 0, 0.59722],
    "47": [0.65002, 1.15, 0, 0, 0.81111],
    "91": [0.65002, 1.15, 0, 0, 0.47222],
    "92": [0.65002, 1.15, 0, 0, 0.81111],
    "93": [0.65002, 1.15, 0, 0, 0.47222],
    "123": [0.65002, 1.15, 0, 0, 0.66667],
    "125": [0.65002, 1.15, 0, 0, 0.66667],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1.0],
    "732": [0, 0.75, 0, 0, 1.0],
    "770": [0, 0.75, 0, 0, 1.0],
    "771": [0, 0.75, 0, 0, 1.0],
    "8719": [0.55001, 1.05, 0, 0, 1.27778],
    "8720": [0.55001, 1.05, 0, 0, 1.27778],
    "8721": [0.55001, 1.05, 0, 0, 1.44445],
    "8730": [0.65002, 1.15, 0, 0, 1.0],
    "8747": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8748": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8749": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8750": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8896": [0.55001, 1.05, 0, 0, 1.11111],
    "8897": [0.55001, 1.05, 0, 0, 1.11111],
    "8898": [0.55001, 1.05, 0, 0, 1.11111],
    "8899": [0.55001, 1.05, 0, 0, 1.11111],
    "8968": [0.65002, 1.15, 0, 0, 0.52778],
    "8969": [0.65002, 1.15, 0, 0, 0.52778],
    "8970": [0.65002, 1.15, 0, 0, 0.52778],
    "8971": [0.65002, 1.15, 0, 0, 0.52778],
    "10216": [0.65002, 1.15, 0, 0, 0.61111],
    "10217": [0.65002, 1.15, 0, 0, 0.61111],
    "10752": [0.55001, 1.05, 0, 0, 1.51112],
    "10753": [0.55001, 1.05, 0, 0, 1.51112],
    "10754": [0.55001, 1.05, 0, 0, 1.51112],
    "10756": [0.55001, 1.05, 0, 0, 1.11111],
    "10758": [0.55001, 1.05, 0, 0, 1.11111]
  },
  "Size3-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.95003, 1.45, 0, 0, 0.73611],
    "41": [0.95003, 1.45, 0, 0, 0.73611],
    "47": [0.95003, 1.45, 0, 0, 1.04445],
    "91": [0.95003, 1.45, 0, 0, 0.52778],
    "92": [0.95003, 1.45, 0, 0, 1.04445],
    "93": [0.95003, 1.45, 0, 0, 0.52778],
    "123": [0.95003, 1.45, 0, 0, 0.75],
    "125": [0.95003, 1.45, 0, 0, 0.75],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1.44445],
    "732": [0, 0.75, 0, 0, 1.44445],
    "770": [0, 0.75, 0, 0, 1.44445],
    "771": [0, 0.75, 0, 0, 1.44445],
    "8730": [0.95003, 1.45, 0, 0, 1.0],
    "8968": [0.95003, 1.45, 0, 0, 0.58334],
    "8969": [0.95003, 1.45, 0, 0, 0.58334],
    "8970": [0.95003, 1.45, 0, 0, 0.58334],
    "8971": [0.95003, 1.45, 0, 0, 0.58334],
    "10216": [0.95003, 1.45, 0, 0, 0.75],
    "10217": [0.95003, 1.45, 0, 0, 0.75]
  },
  "Size4-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [1.25003, 1.75, 0, 0, 0.79167],
    "41": [1.25003, 1.75, 0, 0, 0.79167],
    "47": [1.25003, 1.75, 0, 0, 1.27778],
    "91": [1.25003, 1.75, 0, 0, 0.58334],
    "92": [1.25003, 1.75, 0, 0, 1.27778],
    "93": [1.25003, 1.75, 0, 0, 0.58334],
    "123": [1.25003, 1.75, 0, 0, 0.80556],
    "125": [1.25003, 1.75, 0, 0, 0.80556],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.825, 0, 0, 1.8889],
    "732": [0, 0.825, 0, 0, 1.8889],
    "770": [0, 0.825, 0, 0, 1.8889],
    "771": [0, 0.825, 0, 0, 1.8889],
    "8730": [1.25003, 1.75, 0, 0, 1.0],
    "8968": [1.25003, 1.75, 0, 0, 0.63889],
    "8969": [1.25003, 1.75, 0, 0, 0.63889],
    "8970": [1.25003, 1.75, 0, 0, 0.63889],
    "8971": [1.25003, 1.75, 0, 0, 0.63889],
    "9115": [0.64502, 1.155, 0, 0, 0.875],
    "9116": [1e-05, 0.6, 0, 0, 0.875],
    "9117": [0.64502, 1.155, 0, 0, 0.875],
    "9118": [0.64502, 1.155, 0, 0, 0.875],
    "9119": [1e-05, 0.6, 0, 0, 0.875],
    "9120": [0.64502, 1.155, 0, 0, 0.875],
    "9121": [0.64502, 1.155, 0, 0, 0.66667],
    "9122": [-99e-5, 0.601, 0, 0, 0.66667],
    "9123": [0.64502, 1.155, 0, 0, 0.66667],
    "9124": [0.64502, 1.155, 0, 0, 0.66667],
    "9125": [-99e-5, 0.601, 0, 0, 0.66667],
    "9126": [0.64502, 1.155, 0, 0, 0.66667],
    "9127": [1e-05, 0.9, 0, 0, 0.88889],
    "9128": [0.65002, 1.15, 0, 0, 0.88889],
    "9129": [0.90001, 0, 0, 0, 0.88889],
    "9130": [0, 0.3, 0, 0, 0.88889],
    "9131": [1e-05, 0.9, 0, 0, 0.88889],
    "9132": [0.65002, 1.15, 0, 0, 0.88889],
    "9133": [0.90001, 0, 0, 0, 0.88889],
    "9143": [0.88502, 0.915, 0, 0, 1.05556],
    "10216": [1.25003, 1.75, 0, 0, 0.80556],
    "10217": [1.25003, 1.75, 0, 0, 0.80556],
    "57344": [-499e-5, 0.605, 0, 0, 1.05556],
    "57345": [-499e-5, 0.605, 0, 0, 1.05556],
    "57680": [0, 0.12, 0, 0, 0.45],
    "57681": [0, 0.12, 0, 0, 0.45],
    "57682": [0, 0.12, 0, 0, 0.45],
    "57683": [0, 0.12, 0, 0, 0.45]
  },
  "Typewriter-Regular": {
    "32": [0, 0, 0, 0, 0.525],
    "33": [0, 0.61111, 0, 0, 0.525],
    "34": [0, 0.61111, 0, 0, 0.525],
    "35": [0, 0.61111, 0, 0, 0.525],
    "36": [0.08333, 0.69444, 0, 0, 0.525],
    "37": [0.08333, 0.69444, 0, 0, 0.525],
    "38": [0, 0.61111, 0, 0, 0.525],
    "39": [0, 0.61111, 0, 0, 0.525],
    "40": [0.08333, 0.69444, 0, 0, 0.525],
    "41": [0.08333, 0.69444, 0, 0, 0.525],
    "42": [0, 0.52083, 0, 0, 0.525],
    "43": [-0.08056, 0.53055, 0, 0, 0.525],
    "44": [0.13889, 0.125, 0, 0, 0.525],
    "45": [-0.08056, 0.53055, 0, 0, 0.525],
    "46": [0, 0.125, 0, 0, 0.525],
    "47": [0.08333, 0.69444, 0, 0, 0.525],
    "48": [0, 0.61111, 0, 0, 0.525],
    "49": [0, 0.61111, 0, 0, 0.525],
    "50": [0, 0.61111, 0, 0, 0.525],
    "51": [0, 0.61111, 0, 0, 0.525],
    "52": [0, 0.61111, 0, 0, 0.525],
    "53": [0, 0.61111, 0, 0, 0.525],
    "54": [0, 0.61111, 0, 0, 0.525],
    "55": [0, 0.61111, 0, 0, 0.525],
    "56": [0, 0.61111, 0, 0, 0.525],
    "57": [0, 0.61111, 0, 0, 0.525],
    "58": [0, 0.43056, 0, 0, 0.525],
    "59": [0.13889, 0.43056, 0, 0, 0.525],
    "60": [-0.05556, 0.55556, 0, 0, 0.525],
    "61": [-0.19549, 0.41562, 0, 0, 0.525],
    "62": [-0.05556, 0.55556, 0, 0, 0.525],
    "63": [0, 0.61111, 0, 0, 0.525],
    "64": [0, 0.61111, 0, 0, 0.525],
    "65": [0, 0.61111, 0, 0, 0.525],
    "66": [0, 0.61111, 0, 0, 0.525],
    "67": [0, 0.61111, 0, 0, 0.525],
    "68": [0, 0.61111, 0, 0, 0.525],
    "69": [0, 0.61111, 0, 0, 0.525],
    "70": [0, 0.61111, 0, 0, 0.525],
    "71": [0, 0.61111, 0, 0, 0.525],
    "72": [0, 0.61111, 0, 0, 0.525],
    "73": [0, 0.61111, 0, 0, 0.525],
    "74": [0, 0.61111, 0, 0, 0.525],
    "75": [0, 0.61111, 0, 0, 0.525],
    "76": [0, 0.61111, 0, 0, 0.525],
    "77": [0, 0.61111, 0, 0, 0.525],
    "78": [0, 0.61111, 0, 0, 0.525],
    "79": [0, 0.61111, 0, 0, 0.525],
    "80": [0, 0.61111, 0, 0, 0.525],
    "81": [0.13889, 0.61111, 0, 0, 0.525],
    "82": [0, 0.61111, 0, 0, 0.525],
    "83": [0, 0.61111, 0, 0, 0.525],
    "84": [0, 0.61111, 0, 0, 0.525],
    "85": [0, 0.61111, 0, 0, 0.525],
    "86": [0, 0.61111, 0, 0, 0.525],
    "87": [0, 0.61111, 0, 0, 0.525],
    "88": [0, 0.61111, 0, 0, 0.525],
    "89": [0, 0.61111, 0, 0, 0.525],
    "90": [0, 0.61111, 0, 0, 0.525],
    "91": [0.08333, 0.69444, 0, 0, 0.525],
    "92": [0.08333, 0.69444, 0, 0, 0.525],
    "93": [0.08333, 0.69444, 0, 0, 0.525],
    "94": [0, 0.61111, 0, 0, 0.525],
    "95": [0.09514, 0, 0, 0, 0.525],
    "96": [0, 0.61111, 0, 0, 0.525],
    "97": [0, 0.43056, 0, 0, 0.525],
    "98": [0, 0.61111, 0, 0, 0.525],
    "99": [0, 0.43056, 0, 0, 0.525],
    "100": [0, 0.61111, 0, 0, 0.525],
    "101": [0, 0.43056, 0, 0, 0.525],
    "102": [0, 0.61111, 0, 0, 0.525],
    "103": [0.22222, 0.43056, 0, 0, 0.525],
    "104": [0, 0.61111, 0, 0, 0.525],
    "105": [0, 0.61111, 0, 0, 0.525],
    "106": [0.22222, 0.61111, 0, 0, 0.525],
    "107": [0, 0.61111, 0, 0, 0.525],
    "108": [0, 0.61111, 0, 0, 0.525],
    "109": [0, 0.43056, 0, 0, 0.525],
    "110": [0, 0.43056, 0, 0, 0.525],
    "111": [0, 0.43056, 0, 0, 0.525],
    "112": [0.22222, 0.43056, 0, 0, 0.525],
    "113": [0.22222, 0.43056, 0, 0, 0.525],
    "114": [0, 0.43056, 0, 0, 0.525],
    "115": [0, 0.43056, 0, 0, 0.525],
    "116": [0, 0.55358, 0, 0, 0.525],
    "117": [0, 0.43056, 0, 0, 0.525],
    "118": [0, 0.43056, 0, 0, 0.525],
    "119": [0, 0.43056, 0, 0, 0.525],
    "120": [0, 0.43056, 0, 0, 0.525],
    "121": [0.22222, 0.43056, 0, 0, 0.525],
    "122": [0, 0.43056, 0, 0, 0.525],
    "123": [0.08333, 0.69444, 0, 0, 0.525],
    "124": [0.08333, 0.69444, 0, 0, 0.525],
    "125": [0.08333, 0.69444, 0, 0, 0.525],
    "126": [0, 0.61111, 0, 0, 0.525],
    "127": [0, 0.61111, 0, 0, 0.525],
    "160": [0, 0, 0, 0, 0.525],
    "176": [0, 0.61111, 0, 0, 0.525],
    "184": [0.19445, 0, 0, 0, 0.525],
    "305": [0, 0.43056, 0, 0, 0.525],
    "567": [0.22222, 0.43056, 0, 0, 0.525],
    "711": [0, 0.56597, 0, 0, 0.525],
    "713": [0, 0.56555, 0, 0, 0.525],
    "714": [0, 0.61111, 0, 0, 0.525],
    "715": [0, 0.61111, 0, 0, 0.525],
    "728": [0, 0.61111, 0, 0, 0.525],
    "730": [0, 0.61111, 0, 0, 0.525],
    "770": [0, 0.61111, 0, 0, 0.525],
    "771": [0, 0.61111, 0, 0, 0.525],
    "776": [0, 0.61111, 0, 0, 0.525],
    "915": [0, 0.61111, 0, 0, 0.525],
    "916": [0, 0.61111, 0, 0, 0.525],
    "920": [0, 0.61111, 0, 0, 0.525],
    "923": [0, 0.61111, 0, 0, 0.525],
    "926": [0, 0.61111, 0, 0, 0.525],
    "928": [0, 0.61111, 0, 0, 0.525],
    "931": [0, 0.61111, 0, 0, 0.525],
    "933": [0, 0.61111, 0, 0, 0.525],
    "934": [0, 0.61111, 0, 0, 0.525],
    "936": [0, 0.61111, 0, 0, 0.525],
    "937": [0, 0.61111, 0, 0, 0.525],
    "8216": [0, 0.61111, 0, 0, 0.525],
    "8217": [0, 0.61111, 0, 0, 0.525],
    "8242": [0, 0.61111, 0, 0, 0.525],
    "9251": [0.11111, 0.21944, 0, 0, 0.525]
  }
};

/**
 * This file contains metrics regarding fonts and individual symbols. The sigma
 * and xi variables, as well as the metricMap map contain data extracted from
 * TeX, TeX font metrics, and the TTF files. These data are then exposed via the
 * `metrics` variable and the getCharacterMetrics function.
 */
// In TeX, there are actually three sets of dimensions, one for each of
// textstyle (size index 5 and higher: >=9pt), scriptstyle (size index 3 and 4:
// 7-8pt), and scriptscriptstyle (size index 1 and 2: 5-6pt).  These are
// provided in the arrays below, in that order.
//
// The font metrics are stored in fonts cmsy10, cmsy7, and cmsy5 respectively.
// This was determined by running the following script:
//
//     latex -interaction=nonstopmode \
//     '\documentclass{article}\usepackage{amsmath}\begin{document}' \
//     '$a$ \expandafter\show\the\textfont2' \
//     '\expandafter\show\the\scriptfont2' \
//     '\expandafter\show\the\scriptscriptfont2' \
//     '\stop'
//
// The metrics themselves were retrieved using the following commands:
//
//     tftopl cmsy10
//     tftopl cmsy7
//     tftopl cmsy5
//
// The output of each of these commands is quite lengthy.  The only part we
// care about is the FONTDIMEN section. Each value is measured in EMs.
var sigmasAndXis = {
  slant: [0.250, 0.250, 0.250],
  // sigma1
  space: [0.000, 0.000, 0.000],
  // sigma2
  stretch: [0.000, 0.000, 0.000],
  // sigma3
  shrink: [0.000, 0.000, 0.000],
  // sigma4
  xHeight: [0.431, 0.431, 0.431],
  // sigma5
  quad: [1.000, 1.171, 1.472],
  // sigma6
  extraSpace: [0.000, 0.000, 0.000],
  // sigma7
  num1: [0.677, 0.732, 0.925],
  // sigma8
  num2: [0.394, 0.384, 0.387],
  // sigma9
  num3: [0.444, 0.471, 0.504],
  // sigma10
  denom1: [0.686, 0.752, 1.025],
  // sigma11
  denom2: [0.345, 0.344, 0.532],
  // sigma12
  sup1: [0.413, 0.503, 0.504],
  // sigma13
  sup2: [0.363, 0.431, 0.404],
  // sigma14
  sup3: [0.289, 0.286, 0.294],
  // sigma15
  sub1: [0.150, 0.143, 0.200],
  // sigma16
  sub2: [0.247, 0.286, 0.400],
  // sigma17
  supDrop: [0.386, 0.353, 0.494],
  // sigma18
  subDrop: [0.050, 0.071, 0.100],
  // sigma19
  delim1: [2.390, 1.700, 1.980],
  // sigma20
  delim2: [1.010, 1.157, 1.420],
  // sigma21
  axisHeight: [0.250, 0.250, 0.250],
  // sigma22
  // These font metrics are extracted from TeX by using tftopl on cmex10.tfm;
  // they correspond to the font parameters of the extension fonts (family 3).
  // See the TeXbook, page 441. In AMSTeX, the extension fonts scale; to
  // match cmex7, we'd use cmex7.tfm values for script and scriptscript
  // values.
  defaultRuleThickness: [0.04, 0.049, 0.049],
  // xi8; cmex7: 0.049
  bigOpSpacing1: [0.111, 0.111, 0.111],
  // xi9
  bigOpSpacing2: [0.166, 0.166, 0.166],
  // xi10
  bigOpSpacing3: [0.2, 0.2, 0.2],
  // xi11
  bigOpSpacing4: [0.6, 0.611, 0.611],
  // xi12; cmex7: 0.611
  bigOpSpacing5: [0.1, 0.143, 0.143],
  // xi13; cmex7: 0.143
  // The \sqrt rule width is taken from the height of the surd character.
  // Since we use the same font at all sizes, this thickness doesn't scale.
  sqrtRuleThickness: [0.04, 0.04, 0.04],
  // This value determines how large a pt is, for metrics which are defined
  // in terms of pts.
  // This value is also used in katex.scss; if you change it make sure the
  // values match.
  ptPerEm: [10.0, 10.0, 10.0],
  // The space between adjacent `|` columns in an array definition. From
  // `\showthe\doublerulesep` in LaTeX. Equals 2.0 / ptPerEm.
  doubleRuleSep: [0.2, 0.2, 0.2],
  // The width of separator lines in {array} environments. From
  // `\showthe\arrayrulewidth` in LaTeX. Equals 0.4 / ptPerEm.
  arrayRuleWidth: [0.04, 0.04, 0.04],
  // Two values from LaTeX source2e:
  fboxsep: [0.3, 0.3, 0.3],
  //        3 pt / ptPerEm
  fboxrule: [0.04, 0.04, 0.04] // 0.4 pt / ptPerEm

}; // This map contains a mapping from font name and character code to character
// should have Latin-1 and Cyrillic characters, but may not depending on the
// operating system.  The metrics do not account for extra height from the
// accents.  In the case of Cyrillic characters which have both ascenders and
// descenders we prefer approximations with ascenders, primarily to prevent
// the fraction bar or root line from intersecting the glyph.
// TODO(kevinb) allow union of multiple glyph metrics for better accuracy.

var extraCharacterMap = {
  // Latin-1
  'Å': 'A',
  'Ð': 'D',
  'Þ': 'o',
  'å': 'a',
  'ð': 'd',
  'þ': 'o',
  // Cyrillic
  'А': 'A',
  'Б': 'B',
  'В': 'B',
  'Г': 'F',
  'Д': 'A',
  'Е': 'E',
  'Ж': 'K',
  'З': '3',
  'И': 'N',
  'Й': 'N',
  'К': 'K',
  'Л': 'N',
  'М': 'M',
  'Н': 'H',
  'О': 'O',
  'П': 'N',
  'Р': 'P',
  'С': 'C',
  'Т': 'T',
  'У': 'y',
  'Ф': 'O',
  'Х': 'X',
  'Ц': 'U',
  'Ч': 'h',
  'Ш': 'W',
  'Щ': 'W',
  'Ъ': 'B',
  'Ы': 'X',
  'Ь': 'B',
  'Э': '3',
  'Ю': 'X',
  'Я': 'R',
  'а': 'a',
  'б': 'b',
  'в': 'a',
  'г': 'r',
  'д': 'y',
  'е': 'e',
  'ж': 'm',
  'з': 'e',
  'и': 'n',
  'й': 'n',
  'к': 'n',
  'л': 'n',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'n',
  'р': 'p',
  'с': 'c',
  'т': 'o',
  'у': 'y',
  'ф': 'b',
  'х': 'x',
  'ц': 'n',
  'ч': 'n',
  'ш': 'w',
  'щ': 'w',
  'ъ': 'a',
  'ы': 'm',
  'ь': 'a',
  'э': 'e',
  'ю': 'm',
  'я': 'r'
};

/**
 * This function adds new font metrics to default metricMap
 * It can also override existing metrics
 */
function setFontMetrics(fontName, metrics) {
  fontMetricsData[fontName] = metrics;
}
/**
 * This function is a convenience function for looking up information in the
 * metricMap table. It takes a character as a string, and a font.
 *
 * Note: the `width` property may be undefined if fontMetricsData.js wasn't
 * built using `Make extended_metrics`.
 */

function getCharacterMetrics(character, font, mode) {
  if (!fontMetricsData[font]) {
    throw new Error("Font metrics not found for font: " + font + ".");
  }

  var ch = character.charCodeAt(0);
  var metrics = fontMetricsData[font][ch];

  if (!metrics && character[0] in extraCharacterMap) {
    ch = extraCharacterMap[character[0]].charCodeAt(0);
    metrics = fontMetricsData[font][ch];
  }

  if (!metrics && mode === 'text') {
    // We don't typically have font metrics for Asian scripts.
    // But since we support them in text mode, we need to return
    // some sort of metrics.
    // So if the character is in a script we support but we
    // don't have metrics for it, just use the metrics for
    // the Latin capital letter M. This is close enough because
    // we (currently) only care about the height of the glyph
    // not its width.
    if (supportedCodepoint(ch)) {
      metrics = fontMetricsData[font][77]; // 77 is the charcode for 'M'
    }
  }

  if (metrics) {
    return {
      depth: metrics[0],
      height: metrics[1],
      italic: metrics[2],
      skew: metrics[3],
      width: metrics[4]
    };
  }
}
var fontMetricsBySizeIndex = {};
/**
 * Get the font metrics for a given size.
 */

function getGlobalMetrics(size) {
  var sizeIndex;

  if (size >= 5) {
    sizeIndex = 0;
  } else if (size >= 3) {
    sizeIndex = 1;
  } else {
    sizeIndex = 2;
  }

  if (!fontMetricsBySizeIndex[sizeIndex]) {
    var metrics = fontMetricsBySizeIndex[sizeIndex] = {
      cssEmPerMu: sigmasAndXis.quad[sizeIndex] / 18
    };

    for (var key in sigmasAndXis) {
      if (sigmasAndXis.hasOwnProperty(key)) {
        metrics[key] = sigmasAndXis[key][sizeIndex];
      }
    }
  }

  return fontMetricsBySizeIndex[sizeIndex];
}

/**
 * This file contains information about the options that the Parser carries
 * around with it while parsing. Data is held in an `Options` object, and when
 * recursing, a new `Options` object can be created with the `.with*` and
 * `.reset` functions.
 */
var sizeStyleMap = [// Each element contains [textsize, scriptsize, scriptscriptsize].
// The size mappings are taken from TeX with \normalsize=10pt.
[1, 1, 1], // size1: [5, 5, 5]              \tiny
[2, 1, 1], // size2: [6, 5, 5]
[3, 1, 1], // size3: [7, 5, 5]              \scriptsize
[4, 2, 1], // size4: [8, 6, 5]              \footnotesize
[5, 2, 1], // size5: [9, 6, 5]              \small
[6, 3, 1], // size6: [10, 7, 5]             \normalsize
[7, 4, 2], // size7: [12, 8, 6]             \large
[8, 6, 3], // size8: [14.4, 10, 7]          \Large
[9, 7, 6], // size9: [17.28, 12, 10]        \LARGE
[10, 8, 7], // size10: [20.74, 14.4, 12]     \huge
[11, 10, 9] // size11: [24.88, 20.74, 17.28] \HUGE
];
var sizeMultipliers = [// fontMetrics.js:getGlobalMetrics also uses size indexes, so if
// you change size indexes, change that function.
0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.44, 1.728, 2.074, 2.488];

var sizeAtStyle = function sizeAtStyle(size, style) {
  return style.size < 2 ? size : sizeStyleMap[size - 1][style.size - 1];
}; // In these types, "" (empty string) means "no change".


/**
 * This is the main options class. It contains the current style, size, color,
 * and font.
 *
 * Options objects should not be modified. To create a new Options with
 * different properties, call a `.having*` method.
 */
class Options {
  // A font family applies to a group of fonts (i.e. SansSerif), while a font
  // represents a specific font (i.e. SansSerif Bold).
  // See: https://tex.stackexchange.com/questions/22350/difference-between-textrm-and-mathrm

  /**
   * The base size index.
   */
  constructor(data) {
    this.style = void 0;
    this.color = void 0;
    this.size = void 0;
    this.textSize = void 0;
    this.phantom = void 0;
    this.font = void 0;
    this.fontFamily = void 0;
    this.fontWeight = void 0;
    this.fontShape = void 0;
    this.sizeMultiplier = void 0;
    this.maxSize = void 0;
    this.minRuleThickness = void 0;
    this._fontMetrics = void 0;
    this.style = data.style;
    this.color = data.color;
    this.size = data.size || Options.BASESIZE;
    this.textSize = data.textSize || this.size;
    this.phantom = !!data.phantom;
    this.font = data.font || "";
    this.fontFamily = data.fontFamily || "";
    this.fontWeight = data.fontWeight || '';
    this.fontShape = data.fontShape || '';
    this.sizeMultiplier = sizeMultipliers[this.size - 1];
    this.maxSize = data.maxSize;
    this.minRuleThickness = data.minRuleThickness;
    this._fontMetrics = undefined;
  }
  /**
   * Returns a new options object with the same properties as "this".  Properties
   * from "extension" will be copied to the new options object.
   */


  extend(extension) {
    var data = {
      style: this.style,
      size: this.size,
      textSize: this.textSize,
      color: this.color,
      phantom: this.phantom,
      font: this.font,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontShape: this.fontShape,
      maxSize: this.maxSize,
      minRuleThickness: this.minRuleThickness
    };

    for (var key in extension) {
      if (extension.hasOwnProperty(key)) {
        data[key] = extension[key];
      }
    }

    return new Options(data);
  }
  /**
   * Return an options object with the given style. If `this.style === style`,
   * returns `this`.
   */


  havingStyle(style) {
    if (this.style === style) {
      return this;
    } else {
      return this.extend({
        style: style,
        size: sizeAtStyle(this.textSize, style)
      });
    }
  }
  /**
   * Return an options object with a cramped version of the current style. If
   * the current style is cramped, returns `this`.
   */


  havingCrampedStyle() {
    return this.havingStyle(this.style.cramp());
  }
  /**
   * Return an options object with the given size and in at least `\textstyle`.
   * Returns `this` if appropriate.
   */


  havingSize(size) {
    if (this.size === size && this.textSize === size) {
      return this;
    } else {
      return this.extend({
        style: this.style.text(),
        size: size,
        textSize: size,
        sizeMultiplier: sizeMultipliers[size - 1]
      });
    }
  }
  /**
   * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
   * changes to at least `\textstyle`.
   */


  havingBaseStyle(style) {
    style = style || this.style.text();
    var wantSize = sizeAtStyle(Options.BASESIZE, style);

    if (this.size === wantSize && this.textSize === Options.BASESIZE && this.style === style) {
      return this;
    } else {
      return this.extend({
        style: style,
        size: wantSize
      });
    }
  }
  /**
   * Remove the effect of sizing changes such as \Huge.
   * Keep the effect of the current style, such as \scriptstyle.
   */


  havingBaseSizing() {
    var size;

    switch (this.style.id) {
      case 4:
      case 5:
        size = 3; // normalsize in scriptstyle

        break;

      case 6:
      case 7:
        size = 1; // normalsize in scriptscriptstyle

        break;

      default:
        size = 6;
      // normalsize in textstyle or displaystyle
    }

    return this.extend({
      style: this.style.text(),
      size: size
    });
  }
  /**
   * Create a new options object with the given color.
   */


  withColor(color) {
    return this.extend({
      color: color
    });
  }
  /**
   * Create a new options object with "phantom" set to true.
   */


  withPhantom() {
    return this.extend({
      phantom: true
    });
  }
  /**
   * Creates a new options object with the given math font or old text font.
   * @type {[type]}
   */


  withFont(font) {
    return this.extend({
      font
    });
  }
  /**
   * Create a new options objects with the given fontFamily.
   */


  withTextFontFamily(fontFamily) {
    return this.extend({
      fontFamily,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */


  withTextFontWeight(fontWeight) {
    return this.extend({
      fontWeight,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */


  withTextFontShape(fontShape) {
    return this.extend({
      fontShape,
      font: ""
    });
  }
  /**
   * Return the CSS sizing classes required to switch from enclosing options
   * `oldOptions` to `this`. Returns an array of classes.
   */


  sizingClasses(oldOptions) {
    if (oldOptions.size !== this.size) {
      return ["sizing", "reset-size" + oldOptions.size, "size" + this.size];
    } else {
      return [];
    }
  }
  /**
   * Return the CSS sizing classes required to switch to the base size. Like
   * `this.havingSize(BASESIZE).sizingClasses(this)`.
   */


  baseSizingClasses() {
    if (this.size !== Options.BASESIZE) {
      return ["sizing", "reset-size" + this.size, "size" + Options.BASESIZE];
    } else {
      return [];
    }
  }
  /**
   * Return the font metrics for this size.
   */


  fontMetrics() {
    if (!this._fontMetrics) {
      this._fontMetrics = getGlobalMetrics(this.size);
    }

    return this._fontMetrics;
  }
  /**
   * Gets the CSS color of the current options object
   */


  getColor() {
    if (this.phantom) {
      return "transparent";
    } else {
      return this.color;
    }
  }

}

Options.BASESIZE = 6;

/**
 * This file does conversion between units.  In particular, it provides
 * calculateSize to convert other units into ems.
 */
// Thus, multiplying a length by this number converts the length from units
// into pts.  Dividing the result by ptPerEm gives the number of ems
// *assuming* a font size of ptPerEm (normal size, normal style).

var ptPerUnit = {
  // https://en.wikibooks.org/wiki/LaTeX/Lengths and
  // https://tex.stackexchange.com/a/8263
  "pt": 1,
  // TeX point
  "mm": 7227 / 2540,
  // millimeter
  "cm": 7227 / 254,
  // centimeter
  "in": 72.27,
  // inch
  "bp": 803 / 800,
  // big (PostScript) points
  "pc": 12,
  // pica
  "dd": 1238 / 1157,
  // didot
  "cc": 14856 / 1157,
  // cicero (12 didot)
  "nd": 685 / 642,
  // new didot
  "nc": 1370 / 107,
  // new cicero (12 new didot)
  "sp": 1 / 65536,
  // scaled point (TeX's internal smallest unit)
  // https://tex.stackexchange.com/a/41371
  "px": 803 / 800 // \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX

}; // Dictionary of relative units, for fast validity testing.

var relativeUnit = {
  "ex": true,
  "em": true,
  "mu": true
};

/**
 * Determine whether the specified unit (either a string defining the unit
 * or a "size" parse node containing a unit field) is valid.
 */
var validUnit = function validUnit(unit) {
  if (typeof unit !== "string") {
    unit = unit.unit;
  }

  return unit in ptPerUnit || unit in relativeUnit || unit === "ex";
};
/*
 * Convert a "size" parse node (with numeric "number" and string "unit" fields,
 * as parsed by functions.js argType "size") into a CSS em value for the
 * current style/scale.  `options` gives the current options.
 */

var calculateSize = function calculateSize(sizeValue, options) {
  var scale;

  if (sizeValue.unit in ptPerUnit) {
    // Absolute units
    scale = ptPerUnit[sizeValue.unit] // Convert unit to pt
    / options.fontMetrics().ptPerEm // Convert pt to CSS em
    / options.sizeMultiplier; // Unscale to make absolute units
  } else if (sizeValue.unit === "mu") {
    // `mu` units scale with scriptstyle/scriptscriptstyle.
    scale = options.fontMetrics().cssEmPerMu;
  } else {
    // Other relative units always refer to the *textstyle* font
    // in the current size.
    var unitOptions;

    if (options.style.isTight()) {
      // isTight() means current style is script/scriptscript.
      unitOptions = options.havingStyle(options.style.text());
    } else {
      unitOptions = options;
    } // TODO: In TeX these units are relative to the quad of the current
    // *text* font, e.g. cmr10. KaTeX instead uses values from the
    // comparably-sized *Computer Modern symbol* font. At 10pt, these
    // match. At 7pt and 5pt, they differ: cmr7=1.138894, cmsy7=1.170641;
    // cmr5=1.361133, cmsy5=1.472241. Consider $\scriptsize a\kern1emb$.
    // TeX \showlists shows a kern of 1.13889 * fontsize;
    // KaTeX shows a kern of 1.171 * fontsize.


    if (sizeValue.unit === "ex") {
      scale = unitOptions.fontMetrics().xHeight;
    } else if (sizeValue.unit === "em") {
      scale = unitOptions.fontMetrics().quad;
    } else {
      throw new ParseError("Invalid unit: '" + sizeValue.unit + "'");
    }

    if (unitOptions !== options) {
      scale *= unitOptions.sizeMultiplier / options.sizeMultiplier;
    }
  }

  return Math.min(sizeValue.number * scale, options.maxSize);
};
/**
 * Round `n` to 4 decimal places, or to the nearest 1/10,000th em. See
 * https://github.com/KaTeX/KaTeX/pull/2460.
 */

var makeEm = function makeEm(n) {
  return +n.toFixed(4) + "em";
};

/**
 * These objects store the data about the DOM nodes we create, as well as some
 * extra data. They can then be transformed into real DOM nodes with the
 * `toNode` function or HTML markup using `toMarkup`. They are useful for both
 * storing extra properties on the nodes, as well as providing a way to easily
 * work with the DOM.
 *
 * Similar functions for working with MathML nodes exist in mathMLTree.js.
 *
 * TODO: refactor `span` and `anchor` into common superclass when
 * target environments support class inheritance
 */

/**
 * Create an HTML className based on a list of classes. In addition to joining
 * with spaces, we also remove empty classes.
 */
var createClass = function createClass(classes) {
  return classes.filter(cls => cls).join(" ");
};

var initNode = function initNode(classes, options, style) {
  this.classes = classes || [];
  this.attributes = {};
  this.height = 0;
  this.depth = 0;
  this.maxFontSize = 0;
  this.style = style || {};

  if (options) {
    if (options.style.isTight()) {
      this.classes.push("mtight");
    }

    var color = options.getColor();

    if (color) {
      this.style.color = color;
    }
  }
};
/**
 * Convert into an HTML node
 */


var toNode = function toNode(tagName) {
  var node = document.createElement(tagName); // Apply the class

  node.className = createClass(this.classes); // Apply inline styles

  for (var style in this.style) {
    if (this.style.hasOwnProperty(style)) {
      // $FlowFixMe Flow doesn't seem to understand span.style's type.
      node.style[style] = this.style[style];
    }
  } // Apply attributes


  for (var attr in this.attributes) {
    if (this.attributes.hasOwnProperty(attr)) {
      node.setAttribute(attr, this.attributes[attr]);
    }
  } // Append the children, also as HTML nodes


  for (var i = 0; i < this.children.length; i++) {
    node.appendChild(this.children[i].toNode());
  }

  return node;
};
/**
 * https://w3c.github.io/html-reference/syntax.html#syntax-attributes
 *
 * > Attribute Names must consist of one or more characters
 * other than the space characters, U+0000 NULL,
 * '"', "'", ">", "/", "=", the control characters,
 * and any characters that are not defined by Unicode.
 */


var invalidAttributeNameRegex = /[\s"'>/=\x00-\x1f]/;
/**
 * Convert into an HTML markup string
 */

var toMarkup = function toMarkup(tagName) {
  var markup = "<" + tagName; // Add the class

  if (this.classes.length) {
    markup += " class=\"" + utils.escape(createClass(this.classes)) + "\"";
  }

  var styles = ""; // Add the styles, after hyphenation

  for (var style in this.style) {
    if (this.style.hasOwnProperty(style)) {
      styles += utils.hyphenate(style) + ":" + this.style[style] + ";";
    }
  }

  if (styles) {
    markup += " style=\"" + utils.escape(styles) + "\"";
  } // Add the attributes


  for (var attr in this.attributes) {
    if (this.attributes.hasOwnProperty(attr)) {
      if (invalidAttributeNameRegex.test(attr)) {
        throw new ParseError("Invalid attribute name '" + attr + "'");
      }

      markup += " " + attr + "=\"" + utils.escape(this.attributes[attr]) + "\"";
    }
  }

  markup += ">"; // Add the markup of the children, also as markup

  for (var i = 0; i < this.children.length; i++) {
    markup += this.children[i].toMarkup();
  }

  markup += "</" + tagName + ">";
  return markup;
}; // Making the type below exact with all optional fields doesn't work due to
// - https://github.com/facebook/flow/issues/4582
// - https://github.com/facebook/flow/issues/5688
// However, since *all* fields are optional, $Shape<> works as suggested in 5688
// above.
// This type does not include all CSS properties. Additional properties should
// be added as needed.


/**
 * This node represents a span node, with a className, a list of children, and
 * an inline style. It also contains information about its height, depth, and
 * maxFontSize.
 *
 * Represents two types with different uses: SvgSpan to wrap an SVG and DomSpan
 * otherwise. This typesafety is important when HTML builders access a span's
 * children.
 */
class Span {
  constructor(classes, children, options, style) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    initNode.call(this, classes, options, style);
    this.children = children || [];
  }
  /**
   * Sets an arbitrary attribute on the span. Warning: use this wisely. Not
   * all browsers support attributes the same, and having too many custom
   * attributes is probably bad.
   */


  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }

  hasClass(className) {
    return this.classes.includes(className);
  }

  toNode() {
    return toNode.call(this, "span");
  }

  toMarkup() {
    return toMarkup.call(this, "span");
  }

}
/**
 * This node represents an anchor (<a>) element with a hyperlink.  See `span`
 * for further details.
 */

class Anchor {
  constructor(href, classes, children, options) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    initNode.call(this, classes, options);
    this.children = children || [];
    this.setAttribute('href', href);
  }

  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }

  hasClass(className) {
    return this.classes.includes(className);
  }

  toNode() {
    return toNode.call(this, "a");
  }

  toMarkup() {
    return toMarkup.call(this, "a");
  }

}
/**
 * This node represents an image embed (<img>) element.
 */

class Img {
  constructor(src, alt, style) {
    this.src = void 0;
    this.alt = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.alt = alt;
    this.src = src;
    this.classes = ["mord"];
    this.style = style;
  }

  hasClass(className) {
    return this.classes.includes(className);
  }

  toNode() {
    var node = document.createElement("img");
    node.src = this.src;
    node.alt = this.alt;
    node.className = "mord"; // Apply inline styles

    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        // $FlowFixMe
        node.style[style] = this.style[style];
      }
    }

    return node;
  }

  toMarkup() {
    var markup = "<img src=\"" + utils.escape(this.src) + "\"" + (" alt=\"" + utils.escape(this.alt) + "\""); // Add the styles, after hyphenation

    var styles = "";

    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        styles += utils.hyphenate(style) + ":" + this.style[style] + ";";
      }
    }

    if (styles) {
      markup += " style=\"" + utils.escape(styles) + "\"";
    }

    markup += "'/>";
    return markup;
  }

}
var iCombinations = {
  'î': '\u0131\u0302',
  'ï': '\u0131\u0308',
  'í': '\u0131\u0301',
  // 'ī': '\u0131\u0304', // enable when we add Extended Latin
  'ì': '\u0131\u0300'
};
/**
 * A symbol node contains information about a single symbol. It either renders
 * to a single text node, or a span with a single text node in it, depending on
 * whether it has CSS classes, styles, or needs italic correction.
 */

class SymbolNode {
  constructor(text, height, depth, italic, skew, width, classes, style) {
    this.text = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.italic = void 0;
    this.skew = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.classes = void 0;
    this.style = void 0;
    this.text = text;
    this.height = height || 0;
    this.depth = depth || 0;
    this.italic = italic || 0;
    this.skew = skew || 0;
    this.width = width || 0;
    this.classes = classes || [];
    this.style = style || {};
    this.maxFontSize = 0; // Mark text from non-Latin scripts with specific classes so that we
    // can specify which fonts to use.  This allows us to render these
    // characters with a serif font in situations where the browser would
    // either default to a sans serif or render a placeholder character.
    // We use CSS class names like cjk_fallback, hangul_fallback and
    // brahmic_fallback. See ./unicodeScripts.js for the set of possible
    // script names

    var script = scriptFromCodepoint(this.text.charCodeAt(0));

    if (script) {
      this.classes.push(script + "_fallback");
    }

    if (/[îïíì]/.test(this.text)) {
      // add ī when we add Extended Latin
      this.text = iCombinations[this.text];
    }
  }

  hasClass(className) {
    return this.classes.includes(className);
  }
  /**
   * Creates a text node or span from a symbol node. Note that a span is only
   * created if it is needed.
   */


  toNode() {
    var node = document.createTextNode(this.text);
    var span = null;

    if (this.italic > 0) {
      span = document.createElement("span");
      span.style.marginRight = makeEm(this.italic);
    }

    if (this.classes.length > 0) {
      span = span || document.createElement("span");
      span.className = createClass(this.classes);
    }

    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        span = span || document.createElement("span"); // $FlowFixMe Flow doesn't seem to understand span.style's type.

        span.style[style] = this.style[style];
      }
    }

    if (span) {
      span.appendChild(node);
      return span;
    } else {
      return node;
    }
  }
  /**
   * Creates markup for a symbol node.
   */


  toMarkup() {
    // TODO(alpert): More duplication than I'd like from
    // span.prototype.toMarkup and symbolNode.prototype.toNode...
    var needsSpan = false;
    var markup = "<span";

    if (this.classes.length) {
      needsSpan = true;
      markup += " class=\"";
      markup += utils.escape(createClass(this.classes));
      markup += "\"";
    }

    var styles = "";

    if (this.italic > 0) {
      styles += "margin-right:" + this.italic + "em;";
    }

    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        styles += utils.hyphenate(style) + ":" + this.style[style] + ";";
      }
    }

    if (styles) {
      needsSpan = true;
      markup += " style=\"" + utils.escape(styles) + "\"";
    }

    var escaped = utils.escape(this.text);

    if (needsSpan) {
      markup += ">";
      markup += escaped;
      markup += "</span>";
      return markup;
    } else {
      return escaped;
    }
  }

}
/**
 * SVG nodes are used to render stretchy wide elements.
 */

class SvgNode {
  constructor(children, attributes) {
    this.children = void 0;
    this.attributes = void 0;
    this.children = children || [];
    this.attributes = attributes || {};
  }

  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "svg"); // Apply attributes

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }

    for (var i = 0; i < this.children.length; i++) {
      node.appendChild(this.children[i].toNode());
    }

    return node;
  }

  toMarkup() {
    var markup = "<svg xmlns=\"http://www.w3.org/2000/svg\""; // Apply attributes

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + "=\"" + utils.escape(this.attributes[attr]) + "\"";
      }
    }

    markup += ">";

    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }

    markup += "</svg>";
    return markup;
  }

}
class PathNode {
  constructor(pathName, alternate) {
    this.pathName = void 0;
    this.alternate = void 0;
    this.pathName = pathName;
    this.alternate = alternate; // Used only for \sqrt, \phase, & tall delims
  }

  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "path");

    if (this.alternate) {
      node.setAttribute("d", this.alternate);
    } else {
      node.setAttribute("d", path[this.pathName]);
    }

    return node;
  }

  toMarkup() {
    if (this.alternate) {
      return "<path d=\"" + utils.escape(this.alternate) + "\"/>";
    } else {
      return "<path d=\"" + utils.escape(path[this.pathName]) + "\"/>";
    }
  }

}
class LineNode {
  constructor(attributes) {
    this.attributes = void 0;
    this.attributes = attributes || {};
  }

  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "line"); // Apply attributes

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }

    return node;
  }

  toMarkup() {
    var markup = "<line";

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + "=\"" + utils.escape(this.attributes[attr]) + "\"";
      }
    }

    markup += "/>";
    return markup;
  }

}
function assertSymbolDomNode(group) {
  if (group instanceof SymbolNode) {
    return group;
  } else {
    throw new Error("Expected symbolNode but got " + String(group) + ".");
  }
}
function assertSpan(group) {
  if (group instanceof Span) {
    return group;
  } else {
    throw new Error("Expected span<HtmlDomNode> but got " + String(group) + ".");
  }
}

/**
 * This file holds a list of all no-argument functions and single-character
 * symbols (like 'a' or ';').
 *
 * For each of the symbols, there are three properties they can have:
 * - font (required): the font to be used for this symbol. Either "main" (the
     normal font), or "ams" (the ams fonts).
 * - group (required): the ParseNode group type the symbol should have (i.e.
     "textord", "mathord", etc).
     See https://github.com/KaTeX/KaTeX/wiki/Examining-TeX#group-types
 * - replace: the character that this symbol or function should be
 *   replaced with (i.e. "\phi" has a replace value of "\u03d5", the phi
 *   character in the main font).
 *
 * The outermost map in the table indicates what mode the symbols should be
 * accepted in (e.g. "math" or "text").
 */
// Some of these have a "-token" suffix since these are also used as `ParseNode`
// types for raw text tokens, and we want to avoid conflicts with higher-level
// `ParseNode` types. These `ParseNode`s are constructed within `Parser` by
// looking up the `symbols` map.
var ATOMS = {
  "bin": 1,
  "close": 1,
  "inner": 1,
  "open": 1,
  "punct": 1,
  "rel": 1
};
var NON_ATOMS = {
  "accent-token": 1,
  "mathord": 1,
  "op-token": 1,
  "spacing": 1,
  "textord": 1
};
var symbols = {
  "math": {},
  "text": {}
};
/** `acceptUnicodeChar = true` is only applicable if `replace` is set. */

function defineSymbol(mode, font, group, replace, name, acceptUnicodeChar) {
  symbols[mode][name] = {
    font,
    group,
    replace
  };

  if (acceptUnicodeChar && replace) {
    symbols[mode][replace] = symbols[mode][name];
  }
} // Some abbreviations for commonly used strings.
// This helps minify the code, and also spotting typos using jshint.
// modes:

var math = "math";
var text = "text"; // fonts:

var main = "main";
var ams = "ams"; // groups:

var accent = "accent-token";
var bin = "bin";
var close = "close";
var inner = "inner";
var mathord = "mathord";
var op = "op-token";
var open = "open";
var punct = "punct";
var rel = "rel";
var spacing = "spacing";
var textord = "textord"; // Now comes the symbol table
// Relation Symbols

defineSymbol(math, main, rel, "\u2261", "\\equiv", true);
defineSymbol(math, main, rel, "\u227a", "\\prec", true);
defineSymbol(math, main, rel, "\u227b", "\\succ", true);
defineSymbol(math, main, rel, "\u223c", "\\sim", true);
defineSymbol(math, main, rel, "\u22a5", "\\perp");
defineSymbol(math, main, rel, "\u2aaf", "\\preceq", true);
defineSymbol(math, main, rel, "\u2ab0", "\\succeq", true);
defineSymbol(math, main, rel, "\u2243", "\\simeq", true);
defineSymbol(math, main, rel, "\u2223", "\\mid", true);
defineSymbol(math, main, rel, "\u226a", "\\ll", true);
defineSymbol(math, main, rel, "\u226b", "\\gg", true);
defineSymbol(math, main, rel, "\u224d", "\\asymp", true);
defineSymbol(math, main, rel, "\u2225", "\\parallel");
defineSymbol(math, main, rel, "\u22c8", "\\bowtie", true);
defineSymbol(math, main, rel, "\u2323", "\\smile", true);
defineSymbol(math, main, rel, "\u2291", "\\sqsubseteq", true);
defineSymbol(math, main, rel, "\u2292", "\\sqsupseteq", true);
defineSymbol(math, main, rel, "\u2250", "\\doteq", true);
defineSymbol(math, main, rel, "\u2322", "\\frown", true);
defineSymbol(math, main, rel, "\u220b", "\\ni", true);
defineSymbol(math, main, rel, "\u221d", "\\propto", true);
defineSymbol(math, main, rel, "\u22a2", "\\vdash", true);
defineSymbol(math, main, rel, "\u22a3", "\\dashv", true);
defineSymbol(math, main, rel, "\u220b", "\\owns"); // Punctuation

defineSymbol(math, main, punct, "\u002e", "\\ldotp");
defineSymbol(math, main, punct, "\u22c5", "\\cdotp"); // Misc Symbols

defineSymbol(math, main, textord, "\u0023", "\\#");
defineSymbol(text, main, textord, "\u0023", "\\#");
defineSymbol(math, main, textord, "\u0026", "\\&");
defineSymbol(text, main, textord, "\u0026", "\\&");
defineSymbol(math, main, textord, "\u2135", "\\aleph", true);
defineSymbol(math, main, textord, "\u2200", "\\forall", true);
defineSymbol(math, main, textord, "\u210f", "\\hbar", true);
defineSymbol(math, main, textord, "\u2203", "\\exists", true);
defineSymbol(math, main, textord, "\u2207", "\\nabla", true);
defineSymbol(math, main, textord, "\u266d", "\\flat", true);
defineSymbol(math, main, textord, "\u2113", "\\ell", true);
defineSymbol(math, main, textord, "\u266e", "\\natural", true);
defineSymbol(math, main, textord, "\u2663", "\\clubsuit", true);
defineSymbol(math, main, textord, "\u2118", "\\wp", true);
defineSymbol(math, main, textord, "\u266f", "\\sharp", true);
defineSymbol(math, main, textord, "\u2662", "\\diamondsuit", true);
defineSymbol(math, main, textord, "\u211c", "\\Re", true);
defineSymbol(math, main, textord, "\u2661", "\\heartsuit", true);
defineSymbol(math, main, textord, "\u2111", "\\Im", true);
defineSymbol(math, main, textord, "\u2660", "\\spadesuit", true);
defineSymbol(math, main, textord, "\u00a7", "\\S", true);
defineSymbol(text, main, textord, "\u00a7", "\\S");
defineSymbol(math, main, textord, "\u00b6", "\\P", true);
defineSymbol(text, main, textord, "\u00b6", "\\P"); // Math and Text

defineSymbol(math, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\textdagger");
defineSymbol(math, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\textdaggerdbl"); // Large Delimiters

defineSymbol(math, main, close, "\u23b1", "\\rmoustache", true);
defineSymbol(math, main, open, "\u23b0", "\\lmoustache", true);
defineSymbol(math, main, close, "\u27ef", "\\rgroup", true);
defineSymbol(math, main, open, "\u27ee", "\\lgroup", true); // Binary Operators

defineSymbol(math, main, bin, "\u2213", "\\mp", true);
defineSymbol(math, main, bin, "\u2296", "\\ominus", true);
defineSymbol(math, main, bin, "\u228e", "\\uplus", true);
defineSymbol(math, main, bin, "\u2293", "\\sqcap", true);
defineSymbol(math, main, bin, "\u2217", "\\ast");
defineSymbol(math, main, bin, "\u2294", "\\sqcup", true);
defineSymbol(math, main, bin, "\u25ef", "\\bigcirc", true);
defineSymbol(math, main, bin, "\u2219", "\\bullet", true);
defineSymbol(math, main, bin, "\u2021", "\\ddagger");
defineSymbol(math, main, bin, "\u2240", "\\wr", true);
defineSymbol(math, main, bin, "\u2a3f", "\\amalg");
defineSymbol(math, main, bin, "\u0026", "\\And"); // from amsmath
// Arrow Symbols

defineSymbol(math, main, rel, "\u27f5", "\\longleftarrow", true);
defineSymbol(math, main, rel, "\u21d0", "\\Leftarrow", true);
defineSymbol(math, main, rel, "\u27f8", "\\Longleftarrow", true);
defineSymbol(math, main, rel, "\u27f6", "\\longrightarrow", true);
defineSymbol(math, main, rel, "\u21d2", "\\Rightarrow", true);
defineSymbol(math, main, rel, "\u27f9", "\\Longrightarrow", true);
defineSymbol(math, main, rel, "\u2194", "\\leftrightarrow", true);
defineSymbol(math, main, rel, "\u27f7", "\\longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21d4", "\\Leftrightarrow", true);
defineSymbol(math, main, rel, "\u27fa", "\\Longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21a6", "\\mapsto", true);
defineSymbol(math, main, rel, "\u27fc", "\\longmapsto", true);
defineSymbol(math, main, rel, "\u2197", "\\nearrow", true);
defineSymbol(math, main, rel, "\u21a9", "\\hookleftarrow", true);
defineSymbol(math, main, rel, "\u21aa", "\\hookrightarrow", true);
defineSymbol(math, main, rel, "\u2198", "\\searrow", true);
defineSymbol(math, main, rel, "\u21bc", "\\leftharpoonup", true);
defineSymbol(math, main, rel, "\u21c0", "\\rightharpoonup", true);
defineSymbol(math, main, rel, "\u2199", "\\swarrow", true);
defineSymbol(math, main, rel, "\u21bd", "\\leftharpoondown", true);
defineSymbol(math, main, rel, "\u21c1", "\\rightharpoondown", true);
defineSymbol(math, main, rel, "\u2196", "\\nwarrow", true);
defineSymbol(math, main, rel, "\u21cc", "\\rightleftharpoons", true); // AMS Negated Binary Relations

defineSymbol(math, ams, rel, "\u226e", "\\nless", true); // Symbol names preceded by "@" each have a corresponding macro.

defineSymbol(math, ams, rel, "\ue010", "\\@nleqslant");
defineSymbol(math, ams, rel, "\ue011", "\\@nleqq");
defineSymbol(math, ams, rel, "\u2a87", "\\lneq", true);
defineSymbol(math, ams, rel, "\u2268", "\\lneqq", true);
defineSymbol(math, ams, rel, "\ue00c", "\\@lvertneqq");
defineSymbol(math, ams, rel, "\u22e6", "\\lnsim", true);
defineSymbol(math, ams, rel, "\u2a89", "\\lnapprox", true);
defineSymbol(math, ams, rel, "\u2280", "\\nprec", true); // unicode-math maps \u22e0 to \npreccurlyeq. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u22e0", "\\npreceq", true);
defineSymbol(math, ams, rel, "\u22e8", "\\precnsim", true);
defineSymbol(math, ams, rel, "\u2ab9", "\\precnapprox", true);
defineSymbol(math, ams, rel, "\u2241", "\\nsim", true);
defineSymbol(math, ams, rel, "\ue006", "\\@nshortmid");
defineSymbol(math, ams, rel, "\u2224", "\\nmid", true);
defineSymbol(math, ams, rel, "\u22ac", "\\nvdash", true);
defineSymbol(math, ams, rel, "\u22ad", "\\nvDash", true);
defineSymbol(math, ams, rel, "\u22ea", "\\ntriangleleft");
defineSymbol(math, ams, rel, "\u22ec", "\\ntrianglelefteq", true);
defineSymbol(math, ams, rel, "\u228a", "\\subsetneq", true);
defineSymbol(math, ams, rel, "\ue01a", "\\@varsubsetneq");
defineSymbol(math, ams, rel, "\u2acb", "\\subsetneqq", true);
defineSymbol(math, ams, rel, "\ue017", "\\@varsubsetneqq");
defineSymbol(math, ams, rel, "\u226f", "\\ngtr", true);
defineSymbol(math, ams, rel, "\ue00f", "\\@ngeqslant");
defineSymbol(math, ams, rel, "\ue00e", "\\@ngeqq");
defineSymbol(math, ams, rel, "\u2a88", "\\gneq", true);
defineSymbol(math, ams, rel, "\u2269", "\\gneqq", true);
defineSymbol(math, ams, rel, "\ue00d", "\\@gvertneqq");
defineSymbol(math, ams, rel, "\u22e7", "\\gnsim", true);
defineSymbol(math, ams, rel, "\u2a8a", "\\gnapprox", true);
defineSymbol(math, ams, rel, "\u2281", "\\nsucc", true); // unicode-math maps \u22e1 to \nsucccurlyeq. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u22e1", "\\nsucceq", true);
defineSymbol(math, ams, rel, "\u22e9", "\\succnsim", true);
defineSymbol(math, ams, rel, "\u2aba", "\\succnapprox", true); // unicode-math maps \u2246 to \simneqq. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u2246", "\\ncong", true);
defineSymbol(math, ams, rel, "\ue007", "\\@nshortparallel");
defineSymbol(math, ams, rel, "\u2226", "\\nparallel", true);
defineSymbol(math, ams, rel, "\u22af", "\\nVDash", true);
defineSymbol(math, ams, rel, "\u22eb", "\\ntriangleright");
defineSymbol(math, ams, rel, "\u22ed", "\\ntrianglerighteq", true);
defineSymbol(math, ams, rel, "\ue018", "\\@nsupseteqq");
defineSymbol(math, ams, rel, "\u228b", "\\supsetneq", true);
defineSymbol(math, ams, rel, "\ue01b", "\\@varsupsetneq");
defineSymbol(math, ams, rel, "\u2acc", "\\supsetneqq", true);
defineSymbol(math, ams, rel, "\ue019", "\\@varsupsetneqq");
defineSymbol(math, ams, rel, "\u22ae", "\\nVdash", true);
defineSymbol(math, ams, rel, "\u2ab5", "\\precneqq", true);
defineSymbol(math, ams, rel, "\u2ab6", "\\succneqq", true);
defineSymbol(math, ams, rel, "\ue016", "\\@nsubseteqq");
defineSymbol(math, ams, bin, "\u22b4", "\\unlhd");
defineSymbol(math, ams, bin, "\u22b5", "\\unrhd"); // AMS Negated Arrows

defineSymbol(math, ams, rel, "\u219a", "\\nleftarrow", true);
defineSymbol(math, ams, rel, "\u219b", "\\nrightarrow", true);
defineSymbol(math, ams, rel, "\u21cd", "\\nLeftarrow", true);
defineSymbol(math, ams, rel, "\u21cf", "\\nRightarrow", true);
defineSymbol(math, ams, rel, "\u21ae", "\\nleftrightarrow", true);
defineSymbol(math, ams, rel, "\u21ce", "\\nLeftrightarrow", true); // AMS Misc

defineSymbol(math, ams, rel, "\u25b3", "\\vartriangle");
defineSymbol(math, ams, textord, "\u210f", "\\hslash");
defineSymbol(math, ams, textord, "\u25bd", "\\triangledown");
defineSymbol(math, ams, textord, "\u25ca", "\\lozenge");
defineSymbol(math, ams, textord, "\u24c8", "\\circledS");
defineSymbol(math, ams, textord, "\u00ae", "\\circledR");
defineSymbol(text, ams, textord, "\u00ae", "\\circledR");
defineSymbol(math, ams, textord, "\u2221", "\\measuredangle", true);
defineSymbol(math, ams, textord, "\u2204", "\\nexists");
defineSymbol(math, ams, textord, "\u2127", "\\mho");
defineSymbol(math, ams, textord, "\u2132", "\\Finv", true);
defineSymbol(math, ams, textord, "\u2141", "\\Game", true);
defineSymbol(math, ams, textord, "\u2035", "\\backprime");
defineSymbol(math, ams, textord, "\u25b2", "\\blacktriangle");
defineSymbol(math, ams, textord, "\u25bc", "\\blacktriangledown");
defineSymbol(math, ams, textord, "\u25a0", "\\blacksquare");
defineSymbol(math, ams, textord, "\u29eb", "\\blacklozenge");
defineSymbol(math, ams, textord, "\u2605", "\\bigstar");
defineSymbol(math, ams, textord, "\u2222", "\\sphericalangle", true);
defineSymbol(math, ams, textord, "\u2201", "\\complement", true); // unicode-math maps U+F0 to \matheth. We map to AMS function \eth

defineSymbol(math, ams, textord, "\u00f0", "\\eth", true);
defineSymbol(text, main, textord, "\u00f0", "\u00f0");
defineSymbol(math, ams, textord, "\u2571", "\\diagup");
defineSymbol(math, ams, textord, "\u2572", "\\diagdown");
defineSymbol(math, ams, textord, "\u25a1", "\\square");
defineSymbol(math, ams, textord, "\u25a1", "\\Box");
defineSymbol(math, ams, textord, "\u25ca", "\\Diamond"); // unicode-math maps U+A5 to \mathyen. We map to AMS function \yen

defineSymbol(math, ams, textord, "\u00a5", "\\yen", true);
defineSymbol(text, ams, textord, "\u00a5", "\\yen", true);
defineSymbol(math, ams, textord, "\u2713", "\\checkmark", true);
defineSymbol(text, ams, textord, "\u2713", "\\checkmark"); // AMS Hebrew

defineSymbol(math, ams, textord, "\u2136", "\\beth", true);
defineSymbol(math, ams, textord, "\u2138", "\\daleth", true);
defineSymbol(math, ams, textord, "\u2137", "\\gimel", true); // AMS Greek

defineSymbol(math, ams, textord, "\u03dd", "\\digamma", true);
defineSymbol(math, ams, textord, "\u03f0", "\\varkappa"); // AMS Delimiters

defineSymbol(math, ams, open, "\u250c", "\\@ulcorner", true);
defineSymbol(math, ams, close, "\u2510", "\\@urcorner", true);
defineSymbol(math, ams, open, "\u2514", "\\@llcorner", true);
defineSymbol(math, ams, close, "\u2518", "\\@lrcorner", true); // AMS Binary Relations

defineSymbol(math, ams, rel, "\u2266", "\\leqq", true);
defineSymbol(math, ams, rel, "\u2a7d", "\\leqslant", true);
defineSymbol(math, ams, rel, "\u2a95", "\\eqslantless", true);
defineSymbol(math, ams, rel, "\u2272", "\\lesssim", true);
defineSymbol(math, ams, rel, "\u2a85", "\\lessapprox", true);
defineSymbol(math, ams, rel, "\u224a", "\\approxeq", true);
defineSymbol(math, ams, bin, "\u22d6", "\\lessdot");
defineSymbol(math, ams, rel, "\u22d8", "\\lll", true);
defineSymbol(math, ams, rel, "\u2276", "\\lessgtr", true);
defineSymbol(math, ams, rel, "\u22da", "\\lesseqgtr", true);
defineSymbol(math, ams, rel, "\u2a8b", "\\lesseqqgtr", true);
defineSymbol(math, ams, rel, "\u2251", "\\doteqdot");
defineSymbol(math, ams, rel, "\u2253", "\\risingdotseq", true);
defineSymbol(math, ams, rel, "\u2252", "\\fallingdotseq", true);
defineSymbol(math, ams, rel, "\u223d", "\\backsim", true);
defineSymbol(math, ams, rel, "\u22cd", "\\backsimeq", true);
defineSymbol(math, ams, rel, "\u2ac5", "\\subseteqq", true);
defineSymbol(math, ams, rel, "\u22d0", "\\Subset", true);
defineSymbol(math, ams, rel, "\u228f", "\\sqsubset", true);
defineSymbol(math, ams, rel, "\u227c", "\\preccurlyeq", true);
defineSymbol(math, ams, rel, "\u22de", "\\curlyeqprec", true);
defineSymbol(math, ams, rel, "\u227e", "\\precsim", true);
defineSymbol(math, ams, rel, "\u2ab7", "\\precapprox", true);
defineSymbol(math, ams, rel, "\u22b2", "\\vartriangleleft");
defineSymbol(math, ams, rel, "\u22b4", "\\trianglelefteq");
defineSymbol(math, ams, rel, "\u22a8", "\\vDash", true);
defineSymbol(math, ams, rel, "\u22aa", "\\Vvdash", true);
defineSymbol(math, ams, rel, "\u2323", "\\smallsmile");
defineSymbol(math, ams, rel, "\u2322", "\\smallfrown");
defineSymbol(math, ams, rel, "\u224f", "\\bumpeq", true);
defineSymbol(math, ams, rel, "\u224e", "\\Bumpeq", true);
defineSymbol(math, ams, rel, "\u2267", "\\geqq", true);
defineSymbol(math, ams, rel, "\u2a7e", "\\geqslant", true);
defineSymbol(math, ams, rel, "\u2a96", "\\eqslantgtr", true);
defineSymbol(math, ams, rel, "\u2273", "\\gtrsim", true);
defineSymbol(math, ams, rel, "\u2a86", "\\gtrapprox", true);
defineSymbol(math, ams, bin, "\u22d7", "\\gtrdot");
defineSymbol(math, ams, rel, "\u22d9", "\\ggg", true);
defineSymbol(math, ams, rel, "\u2277", "\\gtrless", true);
defineSymbol(math, ams, rel, "\u22db", "\\gtreqless", true);
defineSymbol(math, ams, rel, "\u2a8c", "\\gtreqqless", true);
defineSymbol(math, ams, rel, "\u2256", "\\eqcirc", true);
defineSymbol(math, ams, rel, "\u2257", "\\circeq", true);
defineSymbol(math, ams, rel, "\u225c", "\\triangleq", true);
defineSymbol(math, ams, rel, "\u223c", "\\thicksim");
defineSymbol(math, ams, rel, "\u2248", "\\thickapprox");
defineSymbol(math, ams, rel, "\u2ac6", "\\supseteqq", true);
defineSymbol(math, ams, rel, "\u22d1", "\\Supset", true);
defineSymbol(math, ams, rel, "\u2290", "\\sqsupset", true);
defineSymbol(math, ams, rel, "\u227d", "\\succcurlyeq", true);
defineSymbol(math, ams, rel, "\u22df", "\\curlyeqsucc", true);
defineSymbol(math, ams, rel, "\u227f", "\\succsim", true);
defineSymbol(math, ams, rel, "\u2ab8", "\\succapprox", true);
defineSymbol(math, ams, rel, "\u22b3", "\\vartriangleright");
defineSymbol(math, ams, rel, "\u22b5", "\\trianglerighteq");
defineSymbol(math, ams, rel, "\u22a9", "\\Vdash", true);
defineSymbol(math, ams, rel, "\u2223", "\\shortmid");
defineSymbol(math, ams, rel, "\u2225", "\\shortparallel");
defineSymbol(math, ams, rel, "\u226c", "\\between", true);
defineSymbol(math, ams, rel, "\u22d4", "\\pitchfork", true);
defineSymbol(math, ams, rel, "\u221d", "\\varpropto");
defineSymbol(math, ams, rel, "\u25c0", "\\blacktriangleleft"); // unicode-math says that \therefore is a mathord atom.
// We kept the amssymb atom type, which is rel.

defineSymbol(math, ams, rel, "\u2234", "\\therefore", true);
defineSymbol(math, ams, rel, "\u220d", "\\backepsilon");
defineSymbol(math, ams, rel, "\u25b6", "\\blacktriangleright"); // unicode-math says that \because is a mathord atom.
// We kept the amssymb atom type, which is rel.

defineSymbol(math, ams, rel, "\u2235", "\\because", true);
defineSymbol(math, ams, rel, "\u22d8", "\\llless");
defineSymbol(math, ams, rel, "\u22d9", "\\gggtr");
defineSymbol(math, ams, bin, "\u22b2", "\\lhd");
defineSymbol(math, ams, bin, "\u22b3", "\\rhd");
defineSymbol(math, ams, rel, "\u2242", "\\eqsim", true);
defineSymbol(math, main, rel, "\u22c8", "\\Join");
defineSymbol(math, ams, rel, "\u2251", "\\Doteq", true); // AMS Binary Operators

defineSymbol(math, ams, bin, "\u2214", "\\dotplus", true);
defineSymbol(math, ams, bin, "\u2216", "\\smallsetminus");
defineSymbol(math, ams, bin, "\u22d2", "\\Cap", true);
defineSymbol(math, ams, bin, "\u22d3", "\\Cup", true);
defineSymbol(math, ams, bin, "\u2a5e", "\\doublebarwedge", true);
defineSymbol(math, ams, bin, "\u229f", "\\boxminus", true);
defineSymbol(math, ams, bin, "\u229e", "\\boxplus", true);
defineSymbol(math, ams, bin, "\u22c7", "\\divideontimes", true);
defineSymbol(math, ams, bin, "\u22c9", "\\ltimes", true);
defineSymbol(math, ams, bin, "\u22ca", "\\rtimes", true);
defineSymbol(math, ams, bin, "\u22cb", "\\leftthreetimes", true);
defineSymbol(math, ams, bin, "\u22cc", "\\rightthreetimes", true);
defineSymbol(math, ams, bin, "\u22cf", "\\curlywedge", true);
defineSymbol(math, ams, bin, "\u22ce", "\\curlyvee", true);
defineSymbol(math, ams, bin, "\u229d", "\\circleddash", true);
defineSymbol(math, ams, bin, "\u229b", "\\circledast", true);
defineSymbol(math, ams, bin, "\u22c5", "\\centerdot");
defineSymbol(math, ams, bin, "\u22ba", "\\intercal", true);
defineSymbol(math, ams, bin, "\u22d2", "\\doublecap");
defineSymbol(math, ams, bin, "\u22d3", "\\doublecup");
defineSymbol(math, ams, bin, "\u22a0", "\\boxtimes", true); // AMS Arrows
// Note: unicode-math maps \u21e2 to their own function \rightdasharrow.
// We'll map it to AMS function \dashrightarrow. It produces the same atom.

defineSymbol(math, ams, rel, "\u21e2", "\\dashrightarrow", true); // unicode-math maps \u21e0 to \leftdasharrow. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u21e0", "\\dashleftarrow", true);
defineSymbol(math, ams, rel, "\u21c7", "\\leftleftarrows", true);
defineSymbol(math, ams, rel, "\u21c6", "\\leftrightarrows", true);
defineSymbol(math, ams, rel, "\u21da", "\\Lleftarrow", true);
defineSymbol(math, ams, rel, "\u219e", "\\twoheadleftarrow", true);
defineSymbol(math, ams, rel, "\u21a2", "\\leftarrowtail", true);
defineSymbol(math, ams, rel, "\u21ab", "\\looparrowleft", true);
defineSymbol(math, ams, rel, "\u21cb", "\\leftrightharpoons", true);
defineSymbol(math, ams, rel, "\u21b6", "\\curvearrowleft", true); // unicode-math maps \u21ba to \acwopencirclearrow. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u21ba", "\\circlearrowleft", true);
defineSymbol(math, ams, rel, "\u21b0", "\\Lsh", true);
defineSymbol(math, ams, rel, "\u21c8", "\\upuparrows", true);
defineSymbol(math, ams, rel, "\u21bf", "\\upharpoonleft", true);
defineSymbol(math, ams, rel, "\u21c3", "\\downharpoonleft", true);
defineSymbol(math, main, rel, "\u22b6", "\\origof", true); // not in font

defineSymbol(math, main, rel, "\u22b7", "\\imageof", true); // not in font

defineSymbol(math, ams, rel, "\u22b8", "\\multimap", true);
defineSymbol(math, ams, rel, "\u21ad", "\\leftrightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21c9", "\\rightrightarrows", true);
defineSymbol(math, ams, rel, "\u21c4", "\\rightleftarrows", true);
defineSymbol(math, ams, rel, "\u21a0", "\\twoheadrightarrow", true);
defineSymbol(math, ams, rel, "\u21a3", "\\rightarrowtail", true);
defineSymbol(math, ams, rel, "\u21ac", "\\looparrowright", true);
defineSymbol(math, ams, rel, "\u21b7", "\\curvearrowright", true); // unicode-math maps \u21bb to \cwopencirclearrow. We'll use the AMS synonym.

defineSymbol(math, ams, rel, "\u21bb", "\\circlearrowright", true);
defineSymbol(math, ams, rel, "\u21b1", "\\Rsh", true);
defineSymbol(math, ams, rel, "\u21ca", "\\downdownarrows", true);
defineSymbol(math, ams, rel, "\u21be", "\\upharpoonright", true);
defineSymbol(math, ams, rel, "\u21c2", "\\downharpoonright", true);
defineSymbol(math, ams, rel, "\u21dd", "\\rightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21dd", "\\leadsto");
defineSymbol(math, ams, rel, "\u21db", "\\Rrightarrow", true);
defineSymbol(math, ams, rel, "\u21be", "\\restriction");
defineSymbol(math, main, textord, "\u2018", "`");
defineSymbol(math, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\textdollar");
defineSymbol(math, main, textord, "%", "\\%");
defineSymbol(text, main, textord, "%", "\\%");
defineSymbol(math, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\textunderscore");
defineSymbol(math, main, textord, "\u2220", "\\angle", true);
defineSymbol(math, main, textord, "\u221e", "\\infty", true);
defineSymbol(math, main, textord, "\u2032", "\\prime");
defineSymbol(math, main, textord, "\u25b3", "\\triangle");
defineSymbol(math, main, textord, "\u0393", "\\Gamma", true);
defineSymbol(math, main, textord, "\u0394", "\\Delta", true);
defineSymbol(math, main, textord, "\u0398", "\\Theta", true);
defineSymbol(math, main, textord, "\u039b", "\\Lambda", true);
defineSymbol(math, main, textord, "\u039e", "\\Xi", true);
defineSymbol(math, main, textord, "\u03a0", "\\Pi", true);
defineSymbol(math, main, textord, "\u03a3", "\\Sigma", true);
defineSymbol(math, main, textord, "\u03a5", "\\Upsilon", true);
defineSymbol(math, main, textord, "\u03a6", "\\Phi", true);
defineSymbol(math, main, textord, "\u03a8", "\\Psi", true);
defineSymbol(math, main, textord, "\u03a9", "\\Omega", true);
defineSymbol(math, main, textord, "A", "\u0391");
defineSymbol(math, main, textord, "B", "\u0392");
defineSymbol(math, main, textord, "E", "\u0395");
defineSymbol(math, main, textord, "Z", "\u0396");
defineSymbol(math, main, textord, "H", "\u0397");
defineSymbol(math, main, textord, "I", "\u0399");
defineSymbol(math, main, textord, "K", "\u039A");
defineSymbol(math, main, textord, "M", "\u039C");
defineSymbol(math, main, textord, "N", "\u039D");
defineSymbol(math, main, textord, "O", "\u039F");
defineSymbol(math, main, textord, "P", "\u03A1");
defineSymbol(math, main, textord, "T", "\u03A4");
defineSymbol(math, main, textord, "X", "\u03A7");
defineSymbol(math, main, textord, "\u00ac", "\\neg", true);
defineSymbol(math, main, textord, "\u00ac", "\\lnot");
defineSymbol(math, main, textord, "\u22a4", "\\top");
defineSymbol(math, main, textord, "\u22a5", "\\bot");
defineSymbol(math, main, textord, "\u2205", "\\emptyset");
defineSymbol(math, ams, textord, "\u2205", "\\varnothing");
defineSymbol(math, main, mathord, "\u03b1", "\\alpha", true);
defineSymbol(math, main, mathord, "\u03b2", "\\beta", true);
defineSymbol(math, main, mathord, "\u03b3", "\\gamma", true);
defineSymbol(math, main, mathord, "\u03b4", "\\delta", true);
defineSymbol(math, main, mathord, "\u03f5", "\\epsilon", true);
defineSymbol(math, main, mathord, "\u03b6", "\\zeta", true);
defineSymbol(math, main, mathord, "\u03b7", "\\eta", true);
defineSymbol(math, main, mathord, "\u03b8", "\\theta", true);
defineSymbol(math, main, mathord, "\u03b9", "\\iota", true);
defineSymbol(math, main, mathord, "\u03ba", "\\kappa", true);
defineSymbol(math, main, mathord, "\u03bb", "\\lambda", true);
defineSymbol(math, main, mathord, "\u03bc", "\\mu", true);
defineSymbol(math, main, mathord, "\u03bd", "\\nu", true);
defineSymbol(math, main, mathord, "\u03be", "\\xi", true);
defineSymbol(math, main, mathord, "\u03bf", "\\omicron", true);
defineSymbol(math, main, mathord, "\u03c0", "\\pi", true);
defineSymbol(math, main, mathord, "\u03c1", "\\rho", true);
defineSymbol(math, main, mathord, "\u03c3", "\\sigma", true);
defineSymbol(math, main, mathord, "\u03c4", "\\tau", true);
defineSymbol(math, main, mathord, "\u03c5", "\\upsilon", true);
defineSymbol(math, main, mathord, "\u03d5", "\\phi", true);
defineSymbol(math, main, mathord, "\u03c7", "\\chi", true);
defineSymbol(math, main, mathord, "\u03c8", "\\psi", true);
defineSymbol(math, main, mathord, "\u03c9", "\\omega", true);
defineSymbol(math, main, mathord, "\u03b5", "\\varepsilon", true);
defineSymbol(math, main, mathord, "\u03d1", "\\vartheta", true);
defineSymbol(math, main, mathord, "\u03d6", "\\varpi", true);
defineSymbol(math, main, mathord, "\u03f1", "\\varrho", true);
defineSymbol(math, main, mathord, "\u03c2", "\\varsigma", true);
defineSymbol(math, main, mathord, "\u03c6", "\\varphi", true);
defineSymbol(math, main, bin, "\u2217", "*", true);
defineSymbol(math, main, bin, "+", "+");
defineSymbol(math, main, bin, "\u2212", "-", true);
defineSymbol(math, main, bin, "\u22c5", "\\cdot", true);
defineSymbol(math, main, bin, "\u2218", "\\circ", true);
defineSymbol(math, main, bin, "\u00f7", "\\div", true);
defineSymbol(math, main, bin, "\u00b1", "\\pm", true);
defineSymbol(math, main, bin, "\u00d7", "\\times", true);
defineSymbol(math, main, bin, "\u2229", "\\cap", true);
defineSymbol(math, main, bin, "\u222a", "\\cup", true);
defineSymbol(math, main, bin, "\u2216", "\\setminus", true);
defineSymbol(math, main, bin, "\u2227", "\\land");
defineSymbol(math, main, bin, "\u2228", "\\lor");
defineSymbol(math, main, bin, "\u2227", "\\wedge", true);
defineSymbol(math, main, bin, "\u2228", "\\vee", true);
defineSymbol(math, main, textord, "\u221a", "\\surd");
defineSymbol(math, main, open, "\u27e8", "\\langle", true);
defineSymbol(math, main, open, "\u2223", "\\lvert");
defineSymbol(math, main, open, "\u2225", "\\lVert");
defineSymbol(math, main, close, "?", "?");
defineSymbol(math, main, close, "!", "!");
defineSymbol(math, main, close, "\u27e9", "\\rangle", true);
defineSymbol(math, main, close, "\u2223", "\\rvert");
defineSymbol(math, main, close, "\u2225", "\\rVert");
defineSymbol(math, main, rel, "=", "=");
defineSymbol(math, main, rel, ":", ":");
defineSymbol(math, main, rel, "\u2248", "\\approx", true);
defineSymbol(math, main, rel, "\u2245", "\\cong", true);
defineSymbol(math, main, rel, "\u2265", "\\ge");
defineSymbol(math, main, rel, "\u2265", "\\geq", true);
defineSymbol(math, main, rel, "\u2190", "\\gets");
defineSymbol(math, main, rel, ">", "\\gt", true);
defineSymbol(math, main, rel, "\u2208", "\\in", true);
defineSymbol(math, main, rel, "\ue020", "\\@not");
defineSymbol(math, main, rel, "\u2282", "\\subset", true);
defineSymbol(math, main, rel, "\u2283", "\\supset", true);
defineSymbol(math, main, rel, "\u2286", "\\subseteq", true);
defineSymbol(math, main, rel, "\u2287", "\\supseteq", true);
defineSymbol(math, ams, rel, "\u2288", "\\nsubseteq", true);
defineSymbol(math, ams, rel, "\u2289", "\\nsupseteq", true);
defineSymbol(math, main, rel, "\u22a8", "\\models");
defineSymbol(math, main, rel, "\u2190", "\\leftarrow", true);
defineSymbol(math, main, rel, "\u2264", "\\le");
defineSymbol(math, main, rel, "\u2264", "\\leq", true);
defineSymbol(math, main, rel, "<", "\\lt", true);
defineSymbol(math, main, rel, "\u2192", "\\rightarrow", true);
defineSymbol(math, main, rel, "\u2192", "\\to");
defineSymbol(math, ams, rel, "\u2271", "\\ngeq", true);
defineSymbol(math, ams, rel, "\u2270", "\\nleq", true);
defineSymbol(math, main, spacing, "\u00a0", "\\ ");
defineSymbol(math, main, spacing, "\u00a0", "\\space"); // Ref: LaTeX Source 2e: \DeclareRobustCommand{\nobreakspace}{%

defineSymbol(math, main, spacing, "\u00a0", "\\nobreakspace");
defineSymbol(text, main, spacing, "\u00a0", "\\ ");
defineSymbol(text, main, spacing, "\u00a0", " ");
defineSymbol(text, main, spacing, "\u00a0", "\\space");
defineSymbol(text, main, spacing, "\u00a0", "\\nobreakspace");
defineSymbol(math, main, spacing, null, "\\nobreak");
defineSymbol(math, main, spacing, null, "\\allowbreak");
defineSymbol(math, main, punct, ",", ",");
defineSymbol(math, main, punct, ";", ";");
defineSymbol(math, ams, bin, "\u22bc", "\\barwedge", true);
defineSymbol(math, ams, bin, "\u22bb", "\\veebar", true);
defineSymbol(math, main, bin, "\u2299", "\\odot", true);
defineSymbol(math, main, bin, "\u2295", "\\oplus", true);
defineSymbol(math, main, bin, "\u2297", "\\otimes", true);
defineSymbol(math, main, textord, "\u2202", "\\partial", true);
defineSymbol(math, main, bin, "\u2298", "\\oslash", true);
defineSymbol(math, ams, bin, "\u229a", "\\circledcirc", true);
defineSymbol(math, ams, bin, "\u22a1", "\\boxdot", true);
defineSymbol(math, main, bin, "\u25b3", "\\bigtriangleup");
defineSymbol(math, main, bin, "\u25bd", "\\bigtriangledown");
defineSymbol(math, main, bin, "\u2020", "\\dagger");
defineSymbol(math, main, bin, "\u22c4", "\\diamond");
defineSymbol(math, main, bin, "\u22c6", "\\star");
defineSymbol(math, main, bin, "\u25c3", "\\triangleleft");
defineSymbol(math, main, bin, "\u25b9", "\\triangleright");
defineSymbol(math, main, open, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\textbraceleft");
defineSymbol(math, main, close, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\textbraceright");
defineSymbol(math, main, open, "{", "\\lbrace");
defineSymbol(math, main, close, "}", "\\rbrace");
defineSymbol(math, main, open, "[", "\\lbrack", true);
defineSymbol(text, main, textord, "[", "\\lbrack", true);
defineSymbol(math, main, close, "]", "\\rbrack", true);
defineSymbol(text, main, textord, "]", "\\rbrack", true);
defineSymbol(math, main, open, "(", "\\lparen", true);
defineSymbol(math, main, close, ")", "\\rparen", true);
defineSymbol(text, main, textord, "<", "\\textless", true); // in T1 fontenc

defineSymbol(text, main, textord, ">", "\\textgreater", true); // in T1 fontenc

defineSymbol(math, main, open, "\u230a", "\\lfloor", true);
defineSymbol(math, main, close, "\u230b", "\\rfloor", true);
defineSymbol(math, main, open, "\u2308", "\\lceil", true);
defineSymbol(math, main, close, "\u2309", "\\rceil", true);
defineSymbol(math, main, textord, "\\", "\\backslash");
defineSymbol(math, main, textord, "\u2223", "|");
defineSymbol(math, main, textord, "\u2223", "\\vert");
defineSymbol(text, main, textord, "|", "\\textbar", true); // in T1 fontenc

defineSymbol(math, main, textord, "\u2225", "\\|");
defineSymbol(math, main, textord, "\u2225", "\\Vert");
defineSymbol(text, main, textord, "\u2225", "\\textbardbl");
defineSymbol(text, main, textord, "~", "\\textasciitilde");
defineSymbol(text, main, textord, "\\", "\\textbackslash");
defineSymbol(text, main, textord, "^", "\\textasciicircum");
defineSymbol(math, main, rel, "\u2191", "\\uparrow", true);
defineSymbol(math, main, rel, "\u21d1", "\\Uparrow", true);
defineSymbol(math, main, rel, "\u2193", "\\downarrow", true);
defineSymbol(math, main, rel, "\u21d3", "\\Downarrow", true);
defineSymbol(math, main, rel, "\u2195", "\\updownarrow", true);
defineSymbol(math, main, rel, "\u21d5", "\\Updownarrow", true);
defineSymbol(math, main, op, "\u2210", "\\coprod");
defineSymbol(math, main, op, "\u22c1", "\\bigvee");
defineSymbol(math, main, op, "\u22c0", "\\bigwedge");
defineSymbol(math, main, op, "\u2a04", "\\biguplus");
defineSymbol(math, main, op, "\u22c2", "\\bigcap");
defineSymbol(math, main, op, "\u22c3", "\\bigcup");
defineSymbol(math, main, op, "\u222b", "\\int");
defineSymbol(math, main, op, "\u222b", "\\intop");
defineSymbol(math, main, op, "\u222c", "\\iint");
defineSymbol(math, main, op, "\u222d", "\\iiint");
defineSymbol(math, main, op, "\u220f", "\\prod");
defineSymbol(math, main, op, "\u2211", "\\sum");
defineSymbol(math, main, op, "\u2a02", "\\bigotimes");
defineSymbol(math, main, op, "\u2a01", "\\bigoplus");
defineSymbol(math, main, op, "\u2a00", "\\bigodot");
defineSymbol(math, main, op, "\u222e", "\\oint");
defineSymbol(math, main, op, "\u222f", "\\oiint");
defineSymbol(math, main, op, "\u2230", "\\oiiint");
defineSymbol(math, main, op, "\u2a06", "\\bigsqcup");
defineSymbol(math, main, op, "\u222b", "\\smallint");
defineSymbol(text, main, inner, "\u2026", "\\textellipsis");
defineSymbol(math, main, inner, "\u2026", "\\mathellipsis");
defineSymbol(text, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u22ef", "\\@cdots", true);
defineSymbol(math, main, inner, "\u22f1", "\\ddots", true); // \vdots is a macro that uses one of these two symbols (with made-up names):

defineSymbol(math, main, textord, "\u22ee", "\\varvdots");
defineSymbol(text, main, textord, "\u22ee", "\\varvdots");
defineSymbol(math, main, accent, "\u02ca", "\\acute");
defineSymbol(math, main, accent, "\u02cb", "\\grave");
defineSymbol(math, main, accent, "\u00a8", "\\ddot");
defineSymbol(math, main, accent, "\u007e", "\\tilde");
defineSymbol(math, main, accent, "\u02c9", "\\bar");
defineSymbol(math, main, accent, "\u02d8", "\\breve");
defineSymbol(math, main, accent, "\u02c7", "\\check");
defineSymbol(math, main, accent, "\u005e", "\\hat");
defineSymbol(math, main, accent, "\u20d7", "\\vec");
defineSymbol(math, main, accent, "\u02d9", "\\dot");
defineSymbol(math, main, accent, "\u02da", "\\mathring"); // \imath and \jmath should be invariant to \mathrm, \mathbf, etc., so use PUA

defineSymbol(math, main, mathord, "\ue131", "\\@imath");
defineSymbol(math, main, mathord, "\ue237", "\\@jmath");
defineSymbol(math, main, textord, "\u0131", "\u0131");
defineSymbol(math, main, textord, "\u0237", "\u0237");
defineSymbol(text, main, textord, "\u0131", "\\i", true);
defineSymbol(text, main, textord, "\u0237", "\\j", true);
defineSymbol(text, main, textord, "\u00df", "\\ss", true);
defineSymbol(text, main, textord, "\u00e6", "\\ae", true);
defineSymbol(text, main, textord, "\u0153", "\\oe", true);
defineSymbol(text, main, textord, "\u00f8", "\\o", true);
defineSymbol(text, main, textord, "\u00c6", "\\AE", true);
defineSymbol(text, main, textord, "\u0152", "\\OE", true);
defineSymbol(text, main, textord, "\u00d8", "\\O", true);
defineSymbol(text, main, accent, "\u02ca", "\\'"); // acute

defineSymbol(text, main, accent, "\u02cb", "\\`"); // grave

defineSymbol(text, main, accent, "\u02c6", "\\^"); // circumflex

defineSymbol(text, main, accent, "\u02dc", "\\~"); // tilde

defineSymbol(text, main, accent, "\u02c9", "\\="); // macron

defineSymbol(text, main, accent, "\u02d8", "\\u"); // breve

defineSymbol(text, main, accent, "\u02d9", "\\."); // dot above

defineSymbol(text, main, accent, "\u00b8", "\\c"); // cedilla

defineSymbol(text, main, accent, "\u02da", "\\r"); // ring above

defineSymbol(text, main, accent, "\u02c7", "\\v"); // caron

defineSymbol(text, main, accent, "\u00a8", '\\"'); // diaeresis

defineSymbol(text, main, accent, "\u02dd", "\\H"); // double acute

defineSymbol(text, main, accent, "\u25ef", "\\textcircled"); // \bigcirc glyph
// These ligatures are detected and created in Parser.js's `formLigatures`.

var ligatures = {
  "--": true,
  "---": true,
  "``": true,
  "''": true
};
defineSymbol(text, main, textord, "\u2013", "--", true);
defineSymbol(text, main, textord, "\u2013", "\\textendash");
defineSymbol(text, main, textord, "\u2014", "---", true);
defineSymbol(text, main, textord, "\u2014", "\\textemdash");
defineSymbol(text, main, textord, "\u2018", "`", true);
defineSymbol(text, main, textord, "\u2018", "\\textquoteleft");
defineSymbol(text, main, textord, "\u2019", "'", true);
defineSymbol(text, main, textord, "\u2019", "\\textquoteright");
defineSymbol(text, main, textord, "\u201c", "``", true);
defineSymbol(text, main, textord, "\u201c", "\\textquotedblleft");
defineSymbol(text, main, textord, "\u201d", "''", true);
defineSymbol(text, main, textord, "\u201d", "\\textquotedblright"); //  \degree from gensymb package

defineSymbol(math, main, textord, "\u00b0", "\\degree", true);
defineSymbol(text, main, textord, "\u00b0", "\\degree"); // \textdegree from inputenc package

defineSymbol(text, main, textord, "\u00b0", "\\textdegree", true); // TODO: In LaTeX, \pounds can generate a different character in text and math
// mode, but among our fonts, only Main-Regular defines this character "163".

defineSymbol(math, main, textord, "\u00a3", "\\pounds");
defineSymbol(math, main, textord, "\u00a3", "\\mathsterling", true);
defineSymbol(text, main, textord, "\u00a3", "\\pounds");
defineSymbol(text, main, textord, "\u00a3", "\\textsterling", true);
defineSymbol(math, ams, textord, "\u2720", "\\maltese");
defineSymbol(text, ams, textord, "\u2720", "\\maltese"); // There are lots of symbols which are the same, so we add them in afterwards.
// All of these are textords in math mode

var mathTextSymbols = "0123456789/@.\"";

for (var i = 0; i < mathTextSymbols.length; i++) {
  var ch = mathTextSymbols.charAt(i);
  defineSymbol(math, main, textord, ch, ch);
} // All of these are textords in text mode


var textSymbols = "0123456789!@*()-=+\";:?/.,";

for (var _i = 0; _i < textSymbols.length; _i++) {
  var _ch = textSymbols.charAt(_i);

  defineSymbol(text, main, textord, _ch, _ch);
} // All of these are textords in text mode, and mathords in math mode


var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

for (var _i2 = 0; _i2 < letters.length; _i2++) {
  var _ch2 = letters.charAt(_i2);

  defineSymbol(math, main, mathord, _ch2, _ch2);
  defineSymbol(text, main, textord, _ch2, _ch2);
} // Blackboard bold and script letters in Unicode range


defineSymbol(math, ams, textord, "C", "\u2102"); // blackboard bold

defineSymbol(text, ams, textord, "C", "\u2102");
defineSymbol(math, ams, textord, "H", "\u210D");
defineSymbol(text, ams, textord, "H", "\u210D");
defineSymbol(math, ams, textord, "N", "\u2115");
defineSymbol(text, ams, textord, "N", "\u2115");
defineSymbol(math, ams, textord, "P", "\u2119");
defineSymbol(text, ams, textord, "P", "\u2119");
defineSymbol(math, ams, textord, "Q", "\u211A");
defineSymbol(text, ams, textord, "Q", "\u211A");
defineSymbol(math, ams, textord, "R", "\u211D");
defineSymbol(text, ams, textord, "R", "\u211D");
defineSymbol(math, ams, textord, "Z", "\u2124");
defineSymbol(text, ams, textord, "Z", "\u2124");
defineSymbol(math, main, mathord, "h", "\u210E"); // italic h, Planck constant

defineSymbol(text, main, mathord, "h", "\u210E"); // The next loop loads wide (surrogate pair) characters.
// We support some letters in the Unicode range U+1D400 to U+1D7FF,
// Mathematical Alphanumeric Symbols.
// Some editors do not deal well with wide characters. So don't write the
// string into this file. Instead, create the string from the surrogate pair.

var wideChar = "";

for (var _i3 = 0; _i3 < letters.length; _i3++) {
  var _ch3 = letters.charAt(_i3); // The hex numbers in the next line are a surrogate pair.
  // 0xD835 is the high surrogate for all letters in the range we support.
  // 0xDC00 is the low surrogate for bold A.


  wideChar = String.fromCharCode(0xD835, 0xDC00 + _i3); // A-Z a-z bold

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDC34 + _i3); // A-Z a-z italic

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDC68 + _i3); // A-Z a-z bold italic

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDD04 + _i3); // A-Z a-z Fraktur

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDD6C + _i3); // A-Z a-z bold Fraktur

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDDA0 + _i3); // A-Z a-z sans-serif

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDDD4 + _i3); // A-Z a-z sans bold

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDE08 + _i3); // A-Z a-z sans italic

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDE70 + _i3); // A-Z a-z monospace

  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);

  if (_i3 < 26) {
    // KaTeX fonts have only capital letters for blackboard bold and script.
    // See exception for k below.
    wideChar = String.fromCharCode(0xD835, 0xDD38 + _i3); // A-Z double struck

    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(0xD835, 0xDC9C + _i3); // A-Z script

    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
  } // TODO: Add bold script when it is supported by a KaTeX font.

} // "k" is the only double struck lower case letter in the KaTeX fonts.


wideChar = String.fromCharCode(0xD835, 0xDD5C); // k double struck

defineSymbol(math, main, mathord, "k", wideChar);
defineSymbol(text, main, textord, "k", wideChar); // Next, some wide character numerals

for (var _i4 = 0; _i4 < 10; _i4++) {
  var _ch4 = _i4.toString();

  wideChar = String.fromCharCode(0xD835, 0xDFCE + _i4); // 0-9 bold

  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDFE2 + _i4); // 0-9 sans serif

  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDFEC + _i4); // 0-9 bold sans

  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(0xD835, 0xDFF6 + _i4); // 0-9 monospace

  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
} // We add these Latin-1 letters as symbols for backwards-compatibility,
// but they are not actually in the font, nor are they supported by the
// Unicode accent mechanism, so they fall back to Times font and look ugly.
// TODO(edemaine): Fix this.


var extraLatin = "\u00d0\u00de\u00fe";

for (var _i5 = 0; _i5 < extraLatin.length; _i5++) {
  var _ch5 = extraLatin.charAt(_i5);

  defineSymbol(math, main, mathord, _ch5, _ch5);
  defineSymbol(text, main, textord, _ch5, _ch5);
}

/**
 * This file provides support for Unicode range U+1D400 to U+1D7FF,
 * Mathematical Alphanumeric Symbols.
 *
 * Function wideCharacterFont takes a wide character as input and returns
 * the font information necessary to render it properly.
 */
/**
 * Data below is from https://www.unicode.org/charts/PDF/U1D400.pdf
 * That document sorts characters into groups by font type, say bold or italic.
 *
 * In the arrays below, each subarray consists three elements:
 *      * The CSS class of that group when in math mode.
 *      * The CSS class of that group when in text mode.
 *      * The font name, so that KaTeX can get font metrics.
 */

var wideLatinLetterData = [["mathbf", "textbf", "Main-Bold"], // A-Z bold upright
["mathbf", "textbf", "Main-Bold"], // a-z bold upright
["mathnormal", "textit", "Math-Italic"], // A-Z italic
["mathnormal", "textit", "Math-Italic"], // a-z italic
["boldsymbol", "boldsymbol", "Main-BoldItalic"], // A-Z bold italic
["boldsymbol", "boldsymbol", "Main-BoldItalic"], // a-z bold italic
// Map fancy A-Z letters to script, not calligraphic.
// This aligns with unicode-math and math fonts (except Cambria Math).
["mathscr", "textscr", "Script-Regular"], // A-Z script
["", "", ""], // a-z script.  No font
["", "", ""], // A-Z bold script. No font
["", "", ""], // a-z bold script. No font
["mathfrak", "textfrak", "Fraktur-Regular"], // A-Z Fraktur
["mathfrak", "textfrak", "Fraktur-Regular"], // a-z Fraktur
["mathbb", "textbb", "AMS-Regular"], // A-Z double-struck
["mathbb", "textbb", "AMS-Regular"], // k double-struck
// Note that we are using a bold font, but font metrics for regular Fraktur.
["mathboldfrak", "textboldfrak", "Fraktur-Regular"], // A-Z bold Fraktur
["mathboldfrak", "textboldfrak", "Fraktur-Regular"], // a-z bold Fraktur
["mathsf", "textsf", "SansSerif-Regular"], // A-Z sans-serif
["mathsf", "textsf", "SansSerif-Regular"], // a-z sans-serif
["mathboldsf", "textboldsf", "SansSerif-Bold"], // A-Z bold sans-serif
["mathboldsf", "textboldsf", "SansSerif-Bold"], // a-z bold sans-serif
["mathitsf", "textitsf", "SansSerif-Italic"], // A-Z italic sans-serif
["mathitsf", "textitsf", "SansSerif-Italic"], // a-z italic sans-serif
["", "", ""], // A-Z bold italic sans. No font
["", "", ""], // a-z bold italic sans. No font
["mathtt", "texttt", "Typewriter-Regular"], // A-Z monospace
["mathtt", "texttt", "Typewriter-Regular"] // a-z monospace
];
var wideNumeralData = [["mathbf", "textbf", "Main-Bold"], // 0-9 bold
["", "", ""], // 0-9 double-struck. No KaTeX font.
["mathsf", "textsf", "SansSerif-Regular"], // 0-9 sans-serif
["mathboldsf", "textboldsf", "SansSerif-Bold"], // 0-9 bold sans-serif
["mathtt", "texttt", "Typewriter-Regular"] // 0-9 monospace
];
var wideCharacterFont = function wideCharacterFont(wideChar, mode) {
  // IE doesn't support codePointAt(). So work with the surrogate pair.
  var H = wideChar.charCodeAt(0); // high surrogate

  var L = wideChar.charCodeAt(1); // low surrogate

  var codePoint = (H - 0xD800) * 0x400 + (L - 0xDC00) + 0x10000;
  var j = mode === "math" ? 0 : 1; // column index for CSS class.

  if (0x1D400 <= codePoint && codePoint < 0x1D6A4) {
    // wideLatinLetterData contains exactly 26 chars on each row.
    // So we can calculate the relevant row. No traverse necessary.
    var i = Math.floor((codePoint - 0x1D400) / 26);
    return [wideLatinLetterData[i][2], wideLatinLetterData[i][j]];
  } else if (0x1D7CE <= codePoint && codePoint <= 0x1D7FF) {
    // Numerals, ten per row.
    var _i = Math.floor((codePoint - 0x1D7CE) / 10);

    return [wideNumeralData[_i][2], wideNumeralData[_i][j]];
  } else if (codePoint === 0x1D6A5 || codePoint === 0x1D6A6) {
    // dotless i or j
    return [wideLatinLetterData[0][2], wideLatinLetterData[0][j]];
  } else if (0x1D6A6 < codePoint && codePoint < 0x1D7CE) {
    // Greek letters. Not supported, yet.
    return ["", ""];
  } else {
    // We don't support any wide characters outside 1D400–1D7FF.
    throw new ParseError("Unsupported character: " + wideChar);
  }
};

/* eslint no-console:0 */

/**
 * Looks up the given symbol in fontMetrics, after applying any symbol
 * replacements defined in symbol.js
 */
var lookupSymbol = function lookupSymbol(value, // TODO(#963): Use a union type for this.
fontName, mode) {
  // Replace the value with its replaced value from symbol.js
  if (symbols[mode][value] && symbols[mode][value].replace) {
    value = symbols[mode][value].replace;
  }

  return {
    value: value,
    metrics: getCharacterMetrics(value, fontName, mode)
  };
};
/**
 * Makes a symbolNode after translation via the list of symbols in symbols.js.
 * Correctly pulls out metrics for the character, and optionally takes a list of
 * classes to be attached to the node.
 *
 * TODO: make argument order closer to makeSpan
 * TODO: add a separate argument for math class (e.g. `mop`, `mbin`), which
 * should if present come first in `classes`.
 * TODO(#953): Make `options` mandatory and always pass it in.
 */


var makeSymbol = function makeSymbol(value, fontName, mode, options, classes) {
  var lookup = lookupSymbol(value, fontName, mode);
  var metrics = lookup.metrics;
  value = lookup.value;
  var symbolNode;

  if (metrics) {
    var italic = metrics.italic;

    if (mode === "text" || options && options.font === "mathit") {
      italic = 0;
    }

    symbolNode = new SymbolNode(value, metrics.height, metrics.depth, italic, metrics.skew, metrics.width, classes);
  } else {
    // TODO(emily): Figure out a good way to only print this in development
    typeof console !== "undefined" && console.warn("No character metrics " + ("for '" + value + "' in style '" + fontName + "' and mode '" + mode + "'"));
    symbolNode = new SymbolNode(value, 0, 0, 0, 0, 0, classes);
  }

  if (options) {
    symbolNode.maxFontSize = options.sizeMultiplier;

    if (options.style.isTight()) {
      symbolNode.classes.push("mtight");
    }

    var color = options.getColor();

    if (color) {
      symbolNode.style.color = color;
    }
  }

  return symbolNode;
};
/**
 * Makes a symbol in Main-Regular or AMS-Regular.
 * Used for rel, bin, open, close, inner, and punct.
 */


var mathsym = function mathsym(value, mode, options, classes) {
  if (classes === void 0) {
    classes = [];
  }

  // Decide what font to render the symbol in by its entry in the symbols
  // table.
  // Have a special case for when the value = \ because the \ is used as a
  // textord in unsupported command errors but cannot be parsed as a regular
  // text ordinal and is therefore not present as a symbol in the symbols
  // table for text, as well as a special case for boldsymbol because it
  // can be used for bold + and -
  if (options.font === "boldsymbol" && lookupSymbol(value, "Main-Bold", mode).metrics) {
    return makeSymbol(value, "Main-Bold", mode, options, classes.concat(["mathbf"]));
  } else if (value === "\\" || symbols[mode][value].font === "main") {
    return makeSymbol(value, "Main-Regular", mode, options, classes);
  } else {
    return makeSymbol(value, "AMS-Regular", mode, options, classes.concat(["amsrm"]));
  }
};
/**
 * Determines which of the two font names (Main-Bold and Math-BoldItalic) and
 * corresponding style tags (mathbf or boldsymbol) to use for font "boldsymbol",
 * depending on the symbol.  Use this function instead of fontMap for font
 * "boldsymbol".
 */


var boldsymbol = function boldsymbol(value, mode, options, classes, type) {
  if (type !== "textord" && lookupSymbol(value, "Math-BoldItalic", mode).metrics) {
    return {
      fontName: "Math-BoldItalic",
      fontClass: "boldsymbol"
    };
  } else {
    // Some glyphs do not exist in Math-BoldItalic so we need to use
    // Main-Bold instead.
    return {
      fontName: "Main-Bold",
      fontClass: "mathbf"
    };
  }
};
/**
 * Makes either a mathord or textord in the correct font and color.
 */


var makeOrd = function makeOrd(group, options, type) {
  var mode = group.mode;
  var text = group.text;
  var classes = ["mord"]; // Math mode or Old font (i.e. \rm)

  var isFont = mode === "math" || mode === "text" && options.font;
  var fontOrFamily = isFont ? options.font : options.fontFamily;
  var wideFontName = "";
  var wideFontClass = "";

  if (text.charCodeAt(0) === 0xD835) {
    [wideFontName, wideFontClass] = wideCharacterFont(text, mode);
  }

  if (wideFontName.length > 0) {
    // surrogate pairs get special treatment
    return makeSymbol(text, wideFontName, mode, options, classes.concat(wideFontClass));
  } else if (fontOrFamily) {
    var fontName;
    var fontClasses;

    if (fontOrFamily === "boldsymbol") {
      var fontData = boldsymbol(text, mode, options, classes, type);
      fontName = fontData.fontName;
      fontClasses = [fontData.fontClass];
    } else if (isFont) {
      fontName = fontMap[fontOrFamily].fontName;
      fontClasses = [fontOrFamily];
    } else {
      fontName = retrieveTextFontName(fontOrFamily, options.fontWeight, options.fontShape);
      fontClasses = [fontOrFamily, options.fontWeight, options.fontShape];
    }

    if (lookupSymbol(text, fontName, mode).metrics) {
      return makeSymbol(text, fontName, mode, options, classes.concat(fontClasses));
    } else if (ligatures.hasOwnProperty(text) && fontName.slice(0, 10) === "Typewriter") {
      // Deconstruct ligatures in monospace fonts (\texttt, \tt).
      var parts = [];

      for (var i = 0; i < text.length; i++) {
        parts.push(makeSymbol(text[i], fontName, mode, options, classes.concat(fontClasses)));
      }

      return makeFragment(parts);
    }
  } // Makes a symbol in the default font for mathords and textords.


  if (type === "mathord") {
    return makeSymbol(text, "Math-Italic", mode, options, classes.concat(["mathnormal"]));
  } else if (type === "textord") {
    var font = symbols[mode][text] && symbols[mode][text].font;

    if (font === "ams") {
      var _fontName = retrieveTextFontName("amsrm", options.fontWeight, options.fontShape);

      return makeSymbol(text, _fontName, mode, options, classes.concat("amsrm", options.fontWeight, options.fontShape));
    } else if (font === "main" || !font) {
      var _fontName2 = retrieveTextFontName("textrm", options.fontWeight, options.fontShape);

      return makeSymbol(text, _fontName2, mode, options, classes.concat(options.fontWeight, options.fontShape));
    } else {
      // fonts added by plugins
      var _fontName3 = retrieveTextFontName(font, options.fontWeight, options.fontShape); // We add font name as a css class


      return makeSymbol(text, _fontName3, mode, options, classes.concat(_fontName3, options.fontWeight, options.fontShape));
    }
  } else {
    throw new Error("unexpected type: " + type + " in makeOrd");
  }
};
/**
 * Returns true if subsequent symbolNodes have the same classes, skew, maxFont,
 * and styles.
 */


var canCombine = (prev, next) => {
  if (createClass(prev.classes) !== createClass(next.classes) || prev.skew !== next.skew || prev.maxFontSize !== next.maxFontSize) {
    return false;
  } // If prev and next both are just "mbin"s or "mord"s we don't combine them
  // so that the proper spacing can be preserved.


  if (prev.classes.length === 1) {
    var cls = prev.classes[0];

    if (cls === "mbin" || cls === "mord") {
      return false;
    }
  }

  for (var style in prev.style) {
    if (prev.style.hasOwnProperty(style) && prev.style[style] !== next.style[style]) {
      return false;
    }
  }

  for (var _style in next.style) {
    if (next.style.hasOwnProperty(_style) && prev.style[_style] !== next.style[_style]) {
      return false;
    }
  }

  return true;
};
/**
 * Combine consecutive domTree.symbolNodes into a single symbolNode.
 * Note: this function mutates the argument.
 */


var tryCombineChars = chars => {
  for (var i = 0; i < chars.length - 1; i++) {
    var prev = chars[i];
    var next = chars[i + 1];

    if (prev instanceof SymbolNode && next instanceof SymbolNode && canCombine(prev, next)) {
      prev.text += next.text;
      prev.height = Math.max(prev.height, next.height);
      prev.depth = Math.max(prev.depth, next.depth); // Use the last character's italic correction since we use
      // it to add padding to the right of the span created from
      // the combined characters.

      prev.italic = next.italic;
      chars.splice(i + 1, 1);
      i--;
    }
  }

  return chars;
};
/**
 * Calculate the height, depth, and maxFontSize of an element based on its
 * children.
 */


var sizeElementFromChildren = function sizeElementFromChildren(elem) {
  var height = 0;
  var depth = 0;
  var maxFontSize = 0;

  for (var i = 0; i < elem.children.length; i++) {
    var child = elem.children[i];

    if (child.height > height) {
      height = child.height;
    }

    if (child.depth > depth) {
      depth = child.depth;
    }

    if (child.maxFontSize > maxFontSize) {
      maxFontSize = child.maxFontSize;
    }
  }

  elem.height = height;
  elem.depth = depth;
  elem.maxFontSize = maxFontSize;
};
/**
 * Makes a span with the given list of classes, list of children, and options.
 *
 * TODO(#953): Ensure that `options` is always provided (currently some call
 * sites don't pass it) and make the type below mandatory.
 * TODO: add a separate argument for math class (e.g. `mop`, `mbin`), which
 * should if present come first in `classes`.
 */


var makeSpan$2 = function makeSpan(classes, children, options, style) {
  var span = new Span(classes, children, options, style);
  sizeElementFromChildren(span);
  return span;
}; // SVG one is simpler -- doesn't require height, depth, max-font setting.
// This is also a separate method for typesafety.


var makeSvgSpan = (classes, children, options, style) => new Span(classes, children, options, style);

var makeLineSpan = function makeLineSpan(className, options, thickness) {
  var line = makeSpan$2([className], [], options);
  line.height = Math.max(thickness || options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
  line.style.borderBottomWidth = makeEm(line.height);
  line.maxFontSize = 1.0;
  return line;
};
/**
 * Makes an anchor with the given href, list of classes, list of children,
 * and options.
 */


var makeAnchor = function makeAnchor(href, classes, children, options) {
  var anchor = new Anchor(href, classes, children, options);
  sizeElementFromChildren(anchor);
  return anchor;
};
/**
 * Makes a document fragment with the given list of children.
 */


var makeFragment = function makeFragment(children) {
  var fragment = new DocumentFragment(children);
  sizeElementFromChildren(fragment);
  return fragment;
};
/**
 * Wraps group in a span if it's a document fragment, allowing to apply classes
 * and styles
 */


var wrapFragment = function wrapFragment(group, options) {
  if (group instanceof DocumentFragment) {
    return makeSpan$2([], [group], options);
  }

  return group;
}; // These are exact object types to catch typos in the names of the optional fields.


// Computes the updated `children` list and the overall depth.
//
// This helper function for makeVList makes it easier to enforce type safety by
// allowing early exits (returns) in the logic.
var getVListChildrenAndDepth = function getVListChildrenAndDepth(params) {
  if (params.positionType === "individualShift") {
    var oldChildren = params.children;
    var children = [oldChildren[0]]; // Add in kerns to the list of params.children to get each element to be
    // shifted to the correct specified shift

    var _depth = -oldChildren[0].shift - oldChildren[0].elem.depth;

    var currPos = _depth;

    for (var i = 1; i < oldChildren.length; i++) {
      var diff = -oldChildren[i].shift - currPos - oldChildren[i].elem.depth;
      var size = diff - (oldChildren[i - 1].elem.height + oldChildren[i - 1].elem.depth);
      currPos = currPos + diff;
      children.push({
        type: "kern",
        size
      });
      children.push(oldChildren[i]);
    }

    return {
      children,
      depth: _depth
    };
  }

  var depth;

  if (params.positionType === "top") {
    // We always start at the bottom, so calculate the bottom by adding up
    // all the sizes
    var bottom = params.positionData;

    for (var _i = 0; _i < params.children.length; _i++) {
      var child = params.children[_i];
      bottom -= child.type === "kern" ? child.size : child.elem.height + child.elem.depth;
    }

    depth = bottom;
  } else if (params.positionType === "bottom") {
    depth = -params.positionData;
  } else {
    var firstChild = params.children[0];

    if (firstChild.type !== "elem") {
      throw new Error('First child must have type "elem".');
    }

    if (params.positionType === "shift") {
      depth = -firstChild.elem.depth - params.positionData;
    } else if (params.positionType === "firstBaseline") {
      depth = -firstChild.elem.depth;
    } else {
      throw new Error("Invalid positionType " + params.positionType + ".");
    }
  }

  return {
    children: params.children,
    depth
  };
};
/**
 * Makes a vertical list by stacking elements and kerns on top of each other.
 * Allows for many different ways of specifying the positioning method.
 *
 * See VListParam documentation above.
 */


var makeVList = function makeVList(params, options) {
  var {
    children,
    depth
  } = getVListChildrenAndDepth(params); // Create a strut that is taller than any list item. The strut is added to
  // each item, where it will determine the item's baseline. Since it has
  // `overflow:hidden`, the strut's top edge will sit on the item's line box's
  // top edge and the strut's bottom edge will sit on the item's baseline,
  // with no additional line-height spacing. This allows the item baseline to
  // be positioned precisely without worrying about font ascent and
  // line-height.

  var pstrutSize = 0;

  for (var i = 0; i < children.length; i++) {
    var child = children[i];

    if (child.type === "elem") {
      var elem = child.elem;
      pstrutSize = Math.max(pstrutSize, elem.maxFontSize, elem.height);
    }
  }

  pstrutSize += 2;
  var pstrut = makeSpan$2(["pstrut"], []);
  pstrut.style.height = makeEm(pstrutSize); // Create a new list of actual children at the correct offsets

  var realChildren = [];
  var minPos = depth;
  var maxPos = depth;
  var currPos = depth;

  for (var _i2 = 0; _i2 < children.length; _i2++) {
    var _child = children[_i2];

    if (_child.type === "kern") {
      currPos += _child.size;
    } else {
      var _elem = _child.elem;
      var classes = _child.wrapperClasses || [];
      var style = _child.wrapperStyle || {};
      var childWrap = makeSpan$2(classes, [pstrut, _elem], undefined, style);
      childWrap.style.top = makeEm(-pstrutSize - currPos - _elem.depth);

      if (_child.marginLeft) {
        childWrap.style.marginLeft = _child.marginLeft;
      }

      if (_child.marginRight) {
        childWrap.style.marginRight = _child.marginRight;
      }

      realChildren.push(childWrap);
      currPos += _elem.height + _elem.depth;
    }

    minPos = Math.min(minPos, currPos);
    maxPos = Math.max(maxPos, currPos);
  } // The vlist contents go in a table-cell with `vertical-align:bottom`.
  // This cell's bottom edge will determine the containing table's baseline
  // without overly expanding the containing line-box.


  var vlist = makeSpan$2(["vlist"], realChildren);
  vlist.style.height = makeEm(maxPos); // A second row is used if necessary to represent the vlist's depth.

  var rows;

  if (minPos < 0) {
    // We will define depth in an empty span with display: table-cell.
    // It should render with the height that we define. But Chrome, in
    // contenteditable mode only, treats that span as if it contains some
    // text content. And that min-height over-rides our desired height.
    // So we put another empty span inside the depth strut span.
    var emptySpan = makeSpan$2([], []);
    var depthStrut = makeSpan$2(["vlist"], [emptySpan]);
    depthStrut.style.height = makeEm(-minPos); // Safari wants the first row to have inline content; otherwise it
    // puts the bottom of the *second* row on the baseline.

    var topStrut = makeSpan$2(["vlist-s"], [new SymbolNode("\u200b")]);
    rows = [makeSpan$2(["vlist-r"], [vlist, topStrut]), makeSpan$2(["vlist-r"], [depthStrut])];
  } else {
    rows = [makeSpan$2(["vlist-r"], [vlist])];
  }

  var vtable = makeSpan$2(["vlist-t"], rows);

  if (rows.length === 2) {
    vtable.classes.push("vlist-t2");
  }

  vtable.height = maxPos;
  vtable.depth = -minPos;
  return vtable;
}; // Glue is a concept from TeX which is a flexible space between elements in
// either a vertical or horizontal list. In KaTeX, at least for now, it's
// static space between elements in a horizontal layout.


var makeGlue = (measurement, options) => {
  // Make an empty span for the space
  var rule = makeSpan$2(["mspace"], [], options);
  var size = calculateSize(measurement, options);
  rule.style.marginRight = makeEm(size);
  return rule;
}; // Takes font options, and returns the appropriate fontLookup name


var retrieveTextFontName = function retrieveTextFontName(fontFamily, fontWeight, fontShape) {
  var baseFontName = "";

  switch (fontFamily) {
    case "amsrm":
      baseFontName = "AMS";
      break;

    case "textrm":
      baseFontName = "Main";
      break;

    case "textsf":
      baseFontName = "SansSerif";
      break;

    case "texttt":
      baseFontName = "Typewriter";
      break;

    default:
      baseFontName = fontFamily;
    // use fonts added by a plugin
  }

  var fontStylesName;

  if (fontWeight === "textbf" && fontShape === "textit") {
    fontStylesName = "BoldItalic";
  } else if (fontWeight === "textbf") {
    fontStylesName = "Bold";
  } else if (fontWeight === "textit") {
    fontStylesName = "Italic";
  } else {
    fontStylesName = "Regular";
  }

  return baseFontName + "-" + fontStylesName;
};
/**
 * Maps TeX font commands to objects containing:
 * - variant: string used for "mathvariant" attribute in buildMathML.js
 * - fontName: the "style" parameter to fontMetrics.getCharacterMetrics
 */
// A map between tex font commands an MathML mathvariant attribute values


var fontMap = {
  // styles
  "mathbf": {
    variant: "bold",
    fontName: "Main-Bold"
  },
  "mathrm": {
    variant: "normal",
    fontName: "Main-Regular"
  },
  "textit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathnormal": {
    variant: "italic",
    fontName: "Math-Italic"
  },
  "mathsfit": {
    variant: "sans-serif-italic",
    fontName: "SansSerif-Italic"
  },
  // "boldsymbol" is missing because they require the use of multiple fonts:
  // Math-BoldItalic and Main-Bold.  This is handled by a special case in
  // makeOrd which ends up calling boldsymbol.
  // families
  "mathbb": {
    variant: "double-struck",
    fontName: "AMS-Regular"
  },
  "mathcal": {
    variant: "script",
    fontName: "Caligraphic-Regular"
  },
  "mathfrak": {
    variant: "fraktur",
    fontName: "Fraktur-Regular"
  },
  "mathscr": {
    variant: "script",
    fontName: "Script-Regular"
  },
  "mathsf": {
    variant: "sans-serif",
    fontName: "SansSerif-Regular"
  },
  "mathtt": {
    variant: "monospace",
    fontName: "Typewriter-Regular"
  }
};
var svgData = {
  //   path, width, height
  vec: ["vec", 0.471, 0.714],
  // values from the font glyph
  oiintSize1: ["oiintSize1", 0.957, 0.499],
  // oval to overlay the integrand
  oiintSize2: ["oiintSize2", 1.472, 0.659],
  oiiintSize1: ["oiiintSize1", 1.304, 0.499],
  oiiintSize2: ["oiiintSize2", 1.98, 0.659]
};

var staticSvg = function staticSvg(value, options) {
  // Create a span with inline SVG for the element.
  var [pathName, width, height] = svgData[value];
  var path = new PathNode(pathName);
  var svgNode = new SvgNode([path], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1000 * width + " " + 1000 * height,
    "preserveAspectRatio": "xMinYMin"
  });
  var span = makeSvgSpan(["overlay"], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return span;
};

var buildCommon = {
  fontMap,
  makeSymbol,
  mathsym,
  makeSpan: makeSpan$2,
  makeSvgSpan,
  makeLineSpan,
  makeAnchor,
  makeFragment,
  wrapFragment,
  makeVList,
  makeOrd,
  makeGlue,
  staticSvg,
  svgData,
  tryCombineChars
};

/**
 * Describes spaces between different classes of atoms.
 */
var thinspace = {
  number: 3,
  unit: "mu"
};
var mediumspace = {
  number: 4,
  unit: "mu"
};
var thickspace = {
  number: 5,
  unit: "mu"
}; // Making the type below exact with all optional fields doesn't work due to
// - https://github.com/facebook/flow/issues/4582
// - https://github.com/facebook/flow/issues/5688
// However, since *all* fields are optional, $Shape<> works as suggested in 5688
// above.

// Spacing relationships for display and text styles
var spacings = {
  mord: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    minner: thinspace
  },
  mbin: {
    mord: mediumspace,
    mop: mediumspace,
    mopen: mediumspace,
    minner: mediumspace
  },
  mrel: {
    mord: thickspace,
    mop: thickspace,
    mopen: thickspace,
    minner: thickspace
  },
  mopen: {},
  mclose: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mpunct: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    mopen: thinspace,
    mclose: thinspace,
    mpunct: thinspace,
    minner: thinspace
  },
  minner: {
    mord: thinspace,
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    mopen: thinspace,
    mpunct: thinspace,
    minner: thinspace
  }
}; // Spacing relationships for script and scriptscript styles

var tightSpacings = {
  mord: {
    mop: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace
  },
  mbin: {},
  mrel: {},
  mopen: {},
  mclose: {
    mop: thinspace
  },
  mpunct: {},
  minner: {
    mop: thinspace
  }
};

/** Context provided to function handlers for error messages. */
// Note: reverse the order of the return type union will cause a flow error.
// See https://github.com/facebook/flow/issues/3663.
// More general version of `HtmlBuilder` for nodes (e.g. \sum, accent types)
// whose presence impacts super/subscripting. In this case, ParseNode<"supsub">
// delegates its HTML building to the HtmlBuilder corresponding to these nodes.

/**
 * Final function spec for use at parse time.
 * This is almost identical to `FunctionPropSpec`, except it
 * 1. includes the function handler, and
 * 2. requires all arguments except argTypes.
 * It is generated by `defineFunction()` below.
 */

/**
 * All registered functions.
 * `functions.js` just exports this same dictionary again and makes it public.
 * `Parser.js` requires this dictionary.
 */
var _functions = {};
/**
 * All HTML builders. Should be only used in the `define*` and the `build*ML`
 * functions.
 */

var _htmlGroupBuilders = {};
/**
 * All MathML builders. Should be only used in the `define*` and the `build*ML`
 * functions.
 */

var _mathmlGroupBuilders = {};
function defineFunction(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder,
    mathmlBuilder
  } = _ref;
  // Set default values of functions
  var data = {
    type,
    numArgs: props.numArgs,
    argTypes: props.argTypes,
    allowedInArgument: !!props.allowedInArgument,
    allowedInText: !!props.allowedInText,
    allowedInMath: props.allowedInMath === undefined ? true : props.allowedInMath,
    numOptionalArgs: props.numOptionalArgs || 0,
    infix: !!props.infix,
    primitive: !!props.primitive,
    handler: handler
  };

  for (var i = 0; i < names.length; ++i) {
    _functions[names[i]] = data;
  }

  if (type) {
    if (htmlBuilder) {
      _htmlGroupBuilders[type] = htmlBuilder;
    }

    if (mathmlBuilder) {
      _mathmlGroupBuilders[type] = mathmlBuilder;
    }
  }
}
/**
 * Use this to register only the HTML and MathML builders for a function (e.g.
 * if the function's ParseNode is generated in Parser.js rather than via a
 * stand-alone handler provided to `defineFunction`).
 */

function defineFunctionBuilders(_ref2) {
  var {
    type,
    htmlBuilder,
    mathmlBuilder
  } = _ref2;
  defineFunction({
    type,
    names: [],
    props: {
      numArgs: 0
    },

    handler() {
      throw new Error('Should never be called.');
    },

    htmlBuilder,
    mathmlBuilder
  });
}
var normalizeArgument = function normalizeArgument(arg) {
  return arg.type === "ordgroup" && arg.body.length === 1 ? arg.body[0] : arg;
}; // Since the corresponding buildHTML/buildMathML function expects a
// list of elements, we normalize for different kinds of arguments

var ordargument = function ordargument(arg) {
  return arg.type === "ordgroup" ? arg.body : [arg];
};

/**
 * This file does the main work of building a domTree structure from a parse
 * tree. The entry point is the `buildHTML` function, which takes a parse tree.
 * Then, the buildExpression, buildGroup, and various groupBuilders functions
 * are called, to produce a final HTML tree.
 */
var makeSpan$1 = buildCommon.makeSpan; // Binary atoms (first class `mbin`) change into ordinary atoms (`mord`)
// depending on their surroundings. See TeXbook pg. 442-446, Rules 5 and 6,
// and the text before Rule 19.

var binLeftCanceller = ["leftmost", "mbin", "mopen", "mrel", "mop", "mpunct"];
var binRightCanceller = ["rightmost", "mrel", "mclose", "mpunct"];
var styleMap$1 = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
var DomEnum = {
  mord: "mord",
  mop: "mop",
  mbin: "mbin",
  mrel: "mrel",
  mopen: "mopen",
  mclose: "mclose",
  mpunct: "mpunct",
  minner: "minner"
};

/**
 * Take a list of nodes, build them in order, and return a list of the built
 * nodes. documentFragments are flattened into their contents, so the
 * returned list contains no fragments. `isRealGroup` is true if `expression`
 * is a real group (no atoms will be added on either side), as opposed to
 * a partial group (e.g. one created by \color). `surrounding` is an array
 * consisting type of nodes that will be added to the left and right.
 */
var buildExpression$1 = function buildExpression(expression, options, isRealGroup, surrounding) {
  if (surrounding === void 0) {
    surrounding = [null, null];
  }

  // Parse expressions into `groups`.
  var groups = [];

  for (var i = 0; i < expression.length; i++) {
    var output = buildGroup$1(expression[i], options);

    if (output instanceof DocumentFragment) {
      var children = output.children;
      groups.push(...children);
    } else {
      groups.push(output);
    }
  } // Combine consecutive domTree.symbolNodes into a single symbolNode.


  buildCommon.tryCombineChars(groups); // If `expression` is a partial group, let the parent handle spacings
  // to avoid processing groups multiple times.

  if (!isRealGroup) {
    return groups;
  }

  var glueOptions = options;

  if (expression.length === 1) {
    var node = expression[0];

    if (node.type === "sizing") {
      glueOptions = options.havingSize(node.size);
    } else if (node.type === "styling") {
      glueOptions = options.havingStyle(styleMap$1[node.style]);
    }
  } // Dummy spans for determining spacings between surrounding atoms.
  // If `expression` has no atoms on the left or right, class "leftmost"
  // or "rightmost", respectively, is used to indicate it.


  var dummyPrev = makeSpan$1([surrounding[0] || "leftmost"], [], options);
  var dummyNext = makeSpan$1([surrounding[1] || "rightmost"], [], options); // TODO: These code assumes that a node's math class is the first element
  // of its `classes` array. A later cleanup should ensure this, for
  // instance by changing the signature of `makeSpan`.
  // Before determining what spaces to insert, perform bin cancellation.
  // Binary operators change to ordinary symbols in some contexts.

  var isRoot = isRealGroup === "root";
  traverseNonSpaceNodes(groups, (node, prev) => {
    var prevType = prev.classes[0];
    var type = node.classes[0];

    if (prevType === "mbin" && binRightCanceller.includes(type)) {
      prev.classes[0] = "mord";
    } else if (type === "mbin" && binLeftCanceller.includes(prevType)) {
      node.classes[0] = "mord";
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  traverseNonSpaceNodes(groups, (node, prev) => {
    var prevType = getTypeOfDomTree(prev);
    var type = getTypeOfDomTree(node); // 'mtight' indicates that the node is script or scriptscript style.

    var space = prevType && type ? node.hasClass("mtight") ? tightSpacings[prevType][type] : spacings[prevType][type] : null;

    if (space) {
      // Insert glue (spacing) after the `prev`.
      return buildCommon.makeGlue(space, glueOptions);
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  return groups;
}; // Depth-first traverse non-space `nodes`, calling `callback` with the current and
// previous node as arguments, optionally returning a node to insert after the
// previous node. `prev` is an object with the previous node and `insertAfter`
// function to insert after it. `next` is a node that will be added to the right.
// Used for bin cancellation and inserting spacings.

var traverseNonSpaceNodes = function traverseNonSpaceNodes(nodes, callback, prev, next, isRoot) {
  if (next) {
    // temporarily append the right node, if exists
    nodes.push(next);
  }

  var i = 0;

  for (; i < nodes.length; i++) {
    var node = nodes[i];
    var partialGroup = checkPartialGroup(node);

    if (partialGroup) {
      // Recursive DFS
      // $FlowFixMe: make nodes a $ReadOnlyArray by returning a new array
      traverseNonSpaceNodes(partialGroup.children, callback, prev, null, isRoot);
      continue;
    } // Ignore explicit spaces (e.g., \;, \,) when determining what implicit
    // spacing should go between atoms of different classes


    var nonspace = !node.hasClass("mspace");

    if (nonspace) {
      var result = callback(node, prev.node);

      if (result) {
        if (prev.insertAfter) {
          prev.insertAfter(result);
        } else {
          // insert at front
          nodes.unshift(result);
          i++;
        }
      }
    }

    if (nonspace) {
      prev.node = node;
    } else if (isRoot && node.hasClass("newline")) {
      prev.node = makeSpan$1(["leftmost"]); // treat like beginning of line
    }

    prev.insertAfter = (index => n => {
      nodes.splice(index + 1, 0, n);
      i++;
    })(i);
  }

  if (next) {
    nodes.pop();
  }
}; // Check if given node is a partial group, i.e., does not affect spacing around.


var checkPartialGroup = function checkPartialGroup(node) {
  if (node instanceof DocumentFragment || node instanceof Anchor || node instanceof Span && node.hasClass("enclosing")) {
    return node;
  }

  return null;
}; // Return the outermost node of a domTree.


var getOutermostNode = function getOutermostNode(node, side) {
  var partialGroup = checkPartialGroup(node);

  if (partialGroup) {
    var children = partialGroup.children;

    if (children.length) {
      if (side === "right") {
        return getOutermostNode(children[children.length - 1], "right");
      } else if (side === "left") {
        return getOutermostNode(children[0], "left");
      }
    }
  }

  return node;
}; // Return math atom class (mclass) of a domTree.
// If `side` is given, it will get the type of the outermost node at given side.


var getTypeOfDomTree = function getTypeOfDomTree(node, side) {
  if (!node) {
    return null;
  }

  if (side) {
    node = getOutermostNode(node, side);
  } // This makes a lot of assumptions as to where the type of atom
  // appears.  We should do a better job of enforcing this.


  return DomEnum[node.classes[0]] || null;
};
var makeNullDelimiter = function makeNullDelimiter(options, classes) {
  var moreClasses = ["nulldelimiter"].concat(options.baseSizingClasses());
  return makeSpan$1(classes.concat(moreClasses));
};
/**
 * buildGroup is the function that takes a group and calls the correct groupType
 * function for it. It also handles the interaction of size and style changes
 * between parents and children.
 */

var buildGroup$1 = function buildGroup(group, options, baseOptions) {
  if (!group) {
    return makeSpan$1();
  }

  if (_htmlGroupBuilders[group.type]) {
    // Call the groupBuilders function
    // $FlowFixMe
    var groupNode = _htmlGroupBuilders[group.type](group, options); // If the size changed between the parent and the current group, account
    // for that size difference.

    if (baseOptions && options.size !== baseOptions.size) {
      groupNode = makeSpan$1(options.sizingClasses(baseOptions), [groupNode], options);
      var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
      groupNode.height *= multiplier;
      groupNode.depth *= multiplier;
    }

    return groupNode;
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
/**
 * Combine an array of HTML DOM nodes (e.g., the output of `buildExpression`)
 * into an unbreakable HTML node of class .base, with proper struts to
 * guarantee correct vertical extent.  `buildHTML` calls this repeatedly to
 * make up the entire expression as a sequence of unbreakable units.
 */

function buildHTMLUnbreakable(children, options) {
  // Compute height and depth of this chunk.
  var body = makeSpan$1(["base"], children, options); // Add strut, which ensures that the top of the HTML element falls at
  // the height of the expression, and the bottom of the HTML element
  // falls at the depth of the expression.

  var strut = makeSpan$1(["strut"]);
  strut.style.height = makeEm(body.height + body.depth);

  if (body.depth) {
    strut.style.verticalAlign = makeEm(-body.depth);
  }

  body.children.unshift(strut);
  return body;
}
/**
 * Take an entire parse tree, and build it into an appropriate set of HTML
 * nodes.
 */


function buildHTML(tree, options) {
  // Strip off outer tag wrapper for processing below.
  var tag = null;

  if (tree.length === 1 && tree[0].type === "tag") {
    tag = tree[0].tag;
    tree = tree[0].body;
  } // Build the expression contained in the tree


  var expression = buildExpression$1(tree, options, "root");
  var eqnNum;

  if (expression.length === 2 && expression[1].hasClass("tag")) {
    // An environment with automatic equation numbers, e.g. {gather}.
    eqnNum = expression.pop();
  }

  var children = []; // Create one base node for each chunk between potential line breaks.
  // The TeXBook [p.173] says "A formula will be broken only after a
  // relation symbol like $=$ or $<$ or $\rightarrow$, or after a binary
  // operation symbol like $+$ or $-$ or $\times$, where the relation or
  // binary operation is on the ``outer level'' of the formula (i.e., not
  // enclosed in {...} and not part of an \over construction)."

  var parts = [];

  for (var i = 0; i < expression.length; i++) {
    parts.push(expression[i]);

    if (expression[i].hasClass("mbin") || expression[i].hasClass("mrel") || expression[i].hasClass("allowbreak")) {
      // Put any post-operator glue on same line as operator.
      // Watch for \nobreak along the way, and stop at \newline.
      var nobreak = false;

      while (i < expression.length - 1 && expression[i + 1].hasClass("mspace") && !expression[i + 1].hasClass("newline")) {
        i++;
        parts.push(expression[i]);

        if (expression[i].hasClass("nobreak")) {
          nobreak = true;
        }
      } // Don't allow break if \nobreak among the post-operator glue.


      if (!nobreak) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      }
    } else if (expression[i].hasClass("newline")) {
      // Write the line except the newline
      parts.pop();

      if (parts.length > 0) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      } // Put the newline at the top level


      children.push(expression[i]);
    }
  }

  if (parts.length > 0) {
    children.push(buildHTMLUnbreakable(parts, options));
  } // Now, if there was a tag, build it too and append it as a final child.


  var tagChild;

  if (tag) {
    tagChild = buildHTMLUnbreakable(buildExpression$1(tag, options, true));
    tagChild.classes = ["tag"];
    children.push(tagChild);
  } else if (eqnNum) {
    children.push(eqnNum);
  }

  var htmlNode = makeSpan$1(["katex-html"], children);
  htmlNode.setAttribute("aria-hidden", "true"); // Adjust the strut of the tag to be the maximum height of all children
  // (the height of the enclosing htmlNode) for proper vertical alignment.

  if (tagChild) {
    var strut = tagChild.children[0];
    strut.style.height = makeEm(htmlNode.height + htmlNode.depth);

    if (htmlNode.depth) {
      strut.style.verticalAlign = makeEm(-htmlNode.depth);
    }
  }

  return htmlNode;
}

/**
 * These objects store data about MathML nodes. This is the MathML equivalent
 * of the types in domTree.js. Since MathML handles its own rendering, and
 * since we're mainly using MathML to improve accessibility, we don't manage
 * any of the styling state that the plain DOM nodes do.
 *
 * The `toNode` and `toMarkup` functions work similarly to how they do in
 * domTree.js, creating namespaced DOM nodes and HTML text markup respectively.
 */
function newDocumentFragment(children) {
  return new DocumentFragment(children);
}
/**
 * This node represents a general purpose MathML node of any type. The
 * constructor requires the type of node to create (for example, `"mo"` or
 * `"mspace"`, corresponding to `<mo>` and `<mspace>` tags).
 */

class MathNode {
  constructor(type, children, classes) {
    this.type = void 0;
    this.attributes = void 0;
    this.children = void 0;
    this.classes = void 0;
    this.type = type;
    this.attributes = {};
    this.children = children || [];
    this.classes = classes || [];
  }
  /**
   * Sets an attribute on a MathML node. MathML depends on attributes to convey a
   * semantic content, so this is used heavily.
   */


  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  /**
   * Gets an attribute on a MathML node.
   */


  getAttribute(name) {
    return this.attributes[name];
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */


  toNode() {
    var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", this.type);

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }

    if (this.classes.length > 0) {
      node.className = createClass(this.classes);
    }

    for (var i = 0; i < this.children.length; i++) {
      // Combine multiple TextNodes into one TextNode, to prevent
      // screen readers from reading each as a separate word [#3995]
      if (this.children[i] instanceof TextNode && this.children[i + 1] instanceof TextNode) {
        var text = this.children[i].toText() + this.children[++i].toText();

        while (this.children[i + 1] instanceof TextNode) {
          text += this.children[++i].toText();
        }

        node.appendChild(new TextNode(text).toNode());
      } else {
        node.appendChild(this.children[i].toNode());
      }
    }

    return node;
  }
  /**
   * Converts the math node into an HTML markup string.
   */


  toMarkup() {
    var markup = "<" + this.type; // Add the attributes

    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + "=\"";
        markup += utils.escape(this.attributes[attr]);
        markup += "\"";
      }
    }

    if (this.classes.length > 0) {
      markup += " class =\"" + utils.escape(createClass(this.classes)) + "\"";
    }

    markup += ">";

    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }

    markup += "</" + this.type + ">";
    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText, but escaped.
   */


  toText() {
    return this.children.map(child => child.toText()).join("");
  }

}
/**
 * This node represents a piece of text.
 */

class TextNode {
  constructor(text) {
    this.text = void 0;
    this.text = text;
  }
  /**
   * Converts the text node into a DOM text node.
   */


  toNode() {
    return document.createTextNode(this.text);
  }
  /**
   * Converts the text node into escaped HTML markup
   * (representing the text itself).
   */


  toMarkup() {
    return utils.escape(this.toText());
  }
  /**
   * Converts the text node into a string
   * (representing the text itself).
   */


  toText() {
    return this.text;
  }

}
/**
 * This node represents a space, but may render as <mspace.../> or as text,
 * depending on the width.
 */

class SpaceNode {
  /**
   * Create a Space node with width given in CSS ems.
   */
  constructor(width) {
    this.width = void 0;
    this.character = void 0;
    this.width = width; // See https://www.w3.org/TR/2000/WD-MathML2-20000328/chapter6.html
    // for a table of space-like characters.  We use Unicode
    // representations instead of &LongNames; as it's not clear how to
    // make the latter via document.createTextNode.

    if (width >= 0.05555 && width <= 0.05556) {
      this.character = "\u200a"; // &VeryThinSpace;
    } else if (width >= 0.1666 && width <= 0.1667) {
      this.character = "\u2009"; // &ThinSpace;
    } else if (width >= 0.2222 && width <= 0.2223) {
      this.character = "\u2005"; // &MediumSpace;
    } else if (width >= 0.2777 && width <= 0.2778) {
      this.character = "\u2005\u200a"; // &ThickSpace;
    } else if (width >= -0.05556 && width <= -0.05555) {
      this.character = "\u200a\u2063"; // &NegativeVeryThinSpace;
    } else if (width >= -0.1667 && width <= -0.1666) {
      this.character = "\u2009\u2063"; // &NegativeThinSpace;
    } else if (width >= -0.2223 && width <= -0.2222) {
      this.character = "\u205f\u2063"; // &NegativeMediumSpace;
    } else if (width >= -0.2778 && width <= -0.2777) {
      this.character = "\u2005\u2063"; // &NegativeThickSpace;
    } else {
      this.character = null;
    }
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */


  toNode() {
    if (this.character) {
      return document.createTextNode(this.character);
    } else {
      var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mspace");
      node.setAttribute("width", makeEm(this.width));
      return node;
    }
  }
  /**
   * Converts the math node into an HTML markup string.
   */


  toMarkup() {
    if (this.character) {
      return "<mtext>" + this.character + "</mtext>";
    } else {
      return "<mspace width=\"" + makeEm(this.width) + "\"/>";
    }
  }
  /**
   * Converts the math node into a string, similar to innerText.
   */


  toText() {
    if (this.character) {
      return this.character;
    } else {
      return " ";
    }
  }

}

var mathMLTree = {
  MathNode,
  TextNode,
  SpaceNode,
  newDocumentFragment
};

/**
 * This file converts a parse tree into a corresponding MathML tree. The main
 * entry point is the `buildMathML` function, which takes a parse tree from the
 * parser.
 */

/**
 * Takes a symbol and converts it into a MathML text node after performing
 * optional replacement from symbols.js.
 */
var makeText = function makeText(text, mode, options) {
  if (symbols[mode][text] && symbols[mode][text].replace && text.charCodeAt(0) !== 0xD835 && !(ligatures.hasOwnProperty(text) && options && (options.fontFamily && options.fontFamily.slice(4, 6) === "tt" || options.font && options.font.slice(4, 6) === "tt"))) {
    text = symbols[mode][text].replace;
  }

  return new mathMLTree.TextNode(text);
};
/**
 * Wrap the given array of nodes in an <mrow> node if needed, i.e.,
 * unless the array has length 1.  Always returns a single node.
 */

var makeRow = function makeRow(body) {
  if (body.length === 1) {
    return body[0];
  } else {
    return new mathMLTree.MathNode("mrow", body);
  }
};
/**
 * Returns the math variant as a string or null if none is required.
 */

var getVariant = function getVariant(group, options) {
  // Handle \text... font specifiers as best we can.
  // MathML has a limited list of allowable mathvariant specifiers; see
  // https://www.w3.org/TR/MathML3/chapter3.html#presm.commatt
  if (options.fontFamily === "texttt") {
    return "monospace";
  } else if (options.fontFamily === "textsf") {
    if (options.fontShape === "textit" && options.fontWeight === "textbf") {
      return "sans-serif-bold-italic";
    } else if (options.fontShape === "textit") {
      return "sans-serif-italic";
    } else if (options.fontWeight === "textbf") {
      return "bold-sans-serif";
    } else {
      return "sans-serif";
    }
  } else if (options.fontShape === "textit" && options.fontWeight === "textbf") {
    return "bold-italic";
  } else if (options.fontShape === "textit") {
    return "italic";
  } else if (options.fontWeight === "textbf") {
    return "bold";
  }

  var font = options.font;

  if (!font || font === "mathnormal") {
    return null;
  }

  var mode = group.mode;

  if (font === "mathit") {
    return "italic";
  } else if (font === "boldsymbol") {
    return group.type === "textord" ? "bold" : "bold-italic";
  } else if (font === "mathbf") {
    return "bold";
  } else if (font === "mathbb") {
    return "double-struck";
  } else if (font === "mathsfit") {
    return "sans-serif-italic";
  } else if (font === "mathfrak") {
    return "fraktur";
  } else if (font === "mathscr" || font === "mathcal") {
    // MathML makes no distinction between script and calligraphic
    return "script";
  } else if (font === "mathsf") {
    return "sans-serif";
  } else if (font === "mathtt") {
    return "monospace";
  }

  var text = group.text;

  if (["\\imath", "\\jmath"].includes(text)) {
    return null;
  }

  if (symbols[mode][text] && symbols[mode][text].replace) {
    text = symbols[mode][text].replace;
  }

  var fontName = buildCommon.fontMap[font].fontName;

  if (getCharacterMetrics(text, fontName, mode)) {
    return buildCommon.fontMap[font].variant;
  }

  return null;
};
/**
 * Check for <mi>.</mi> which is how a dot renders in MathML,
 * or <mo separator="true" lspace="0em" rspace="0em">,</mo>
 * which is how a braced comma {,} renders in MathML
 */

function isNumberPunctuation(group) {
  if (!group) {
    return false;
  }

  if (group.type === 'mi' && group.children.length === 1) {
    var child = group.children[0];
    return child instanceof TextNode && child.text === '.';
  } else if (group.type === 'mo' && group.children.length === 1 && group.getAttribute('separator') === 'true' && group.getAttribute('lspace') === '0em' && group.getAttribute('rspace') === '0em') {
    var _child = group.children[0];
    return _child instanceof TextNode && _child.text === ',';
  } else {
    return false;
  }
}
/**
 * Takes a list of nodes, builds them, and returns a list of the generated
 * MathML nodes.  Also combine consecutive <mtext> outputs into a single
 * <mtext> tag.
 */


var buildExpression = function buildExpression(expression, options, isOrdgroup) {
  if (expression.length === 1) {
    var group = buildGroup(expression[0], options);

    if (isOrdgroup && group instanceof MathNode && group.type === "mo") {
      // When TeX writers want to suppress spacing on an operator,
      // they often put the operator by itself inside braces.
      group.setAttribute("lspace", "0em");
      group.setAttribute("rspace", "0em");
    }

    return [group];
  }

  var groups = [];
  var lastGroup;

  for (var i = 0; i < expression.length; i++) {
    var _group = buildGroup(expression[i], options);

    if (_group instanceof MathNode && lastGroup instanceof MathNode) {
      // Concatenate adjacent <mtext>s
      if (_group.type === 'mtext' && lastGroup.type === 'mtext' && _group.getAttribute('mathvariant') === lastGroup.getAttribute('mathvariant')) {
        lastGroup.children.push(..._group.children);
        continue; // Concatenate adjacent <mn>s
      } else if (_group.type === 'mn' && lastGroup.type === 'mn') {
        lastGroup.children.push(..._group.children);
        continue; // Concatenate <mn>...</mn> followed by <mi>.</mi>
      } else if (isNumberPunctuation(_group) && lastGroup.type === 'mn') {
        lastGroup.children.push(..._group.children);
        continue; // Concatenate <mi>.</mi> followed by <mn>...</mn>
      } else if (_group.type === 'mn' && isNumberPunctuation(lastGroup)) {
        _group.children = [...lastGroup.children, ..._group.children];
        groups.pop(); // Put preceding <mn>...</mn> or <mi>.</mi> inside base of
        // <msup><mn>...base...</mn>...exponent...</msup> (or <msub>)
      } else if ((_group.type === 'msup' || _group.type === 'msub') && _group.children.length >= 1 && (lastGroup.type === 'mn' || isNumberPunctuation(lastGroup))) {
        var base = _group.children[0];

        if (base instanceof MathNode && base.type === 'mn') {
          base.children = [...lastGroup.children, ...base.children];
          groups.pop();
        } // \not

      } else if (lastGroup.type === 'mi' && lastGroup.children.length === 1) {
        var lastChild = lastGroup.children[0];

        if (lastChild instanceof TextNode && lastChild.text === '\u0338' && (_group.type === 'mo' || _group.type === 'mi' || _group.type === 'mn')) {
          var child = _group.children[0];

          if (child instanceof TextNode && child.text.length > 0) {
            // Overlay with combining character long solidus
            child.text = child.text.slice(0, 1) + "\u0338" + child.text.slice(1);
            groups.pop();
          }
        }
      }
    }

    groups.push(_group);
    lastGroup = _group;
  }

  return groups;
};
/**
 * Equivalent to buildExpression, but wraps the elements in an <mrow>
 * if there's more than one.  Returns a single node instead of an array.
 */

var buildExpressionRow = function buildExpressionRow(expression, options, isOrdgroup) {
  return makeRow(buildExpression(expression, options, isOrdgroup));
};
/**
 * Takes a group from the parser and calls the appropriate groupBuilders function
 * on it to produce a MathML node.
 */

var buildGroup = function buildGroup(group, options) {
  if (!group) {
    return new mathMLTree.MathNode("mrow");
  }

  if (_mathmlGroupBuilders[group.type]) {
    // Call the groupBuilders function
    // $FlowFixMe
    var result = _mathmlGroupBuilders[group.type](group, options); // $FlowFixMe

    return result;
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
/**
 * Takes a full parse tree and settings and builds a MathML representation of
 * it. In particular, we put the elements from building the parse tree into a
 * <semantics> tag so we can also include that TeX source as an annotation.
 *
 * Note that we actually return a domTree element with a `<math>` inside it so
 * we can do appropriate styling.
 */

function buildMathML(tree, texExpression, options, isDisplayMode, forMathmlOnly) {
  var expression = buildExpression(tree, options); // TODO: Make a pass thru the MathML similar to buildHTML.traverseNonSpaceNodes
  // and add spacing nodes. This is necessary only adjacent to math operators
  // like \sin or \lim or to subsup elements that contain math operators.
  // MathML takes care of the other spacing issues.
  // Wrap up the expression in an mrow so it is presented in the semantics
  // tag correctly, unless it's a single <mrow> or <mtable>.

  var wrapper;

  if (expression.length === 1 && expression[0] instanceof MathNode && ["mrow", "mtable"].includes(expression[0].type)) {
    wrapper = expression[0];
  } else {
    wrapper = new mathMLTree.MathNode("mrow", expression);
  } // Build a TeX annotation of the source


  var annotation = new mathMLTree.MathNode("annotation", [new mathMLTree.TextNode(texExpression)]);
  annotation.setAttribute("encoding", "application/x-tex");
  var semantics = new mathMLTree.MathNode("semantics", [wrapper, annotation]);
  var math = new mathMLTree.MathNode("math", [semantics]);
  math.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");

  if (isDisplayMode) {
    math.setAttribute("display", "block");
  } // You can't style <math> nodes, so we wrap the node in a span.
  // NOTE: The span class is not typed to have <math> nodes as children, and
  // we don't want to make the children type more generic since the children
  // of span are expected to have more fields in `buildHtml` contexts.


  var wrapperClass = forMathmlOnly ? "katex" : "katex-mathml"; // $FlowFixMe

  return buildCommon.makeSpan([wrapperClass], [math]);
}

var optionsFromSettings = function optionsFromSettings(settings) {
  return new Options({
    style: settings.displayMode ? Style$1.DISPLAY : Style$1.TEXT,
    maxSize: settings.maxSize,
    minRuleThickness: settings.minRuleThickness
  });
};

var displayWrap = function displayWrap(node, settings) {
  if (settings.displayMode) {
    var classes = ["katex-display"];

    if (settings.leqno) {
      classes.push("leqno");
    }

    if (settings.fleqn) {
      classes.push("fleqn");
    }

    node = buildCommon.makeSpan(classes, [node]);
  }

  return node;
};

var buildTree = function buildTree(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var katexNode;

  if (settings.output === "mathml") {
    return buildMathML(tree, expression, options, settings.displayMode, true);
  } else if (settings.output === "html") {
    var htmlNode = buildHTML(tree, options);
    katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
  } else {
    var mathMLNode = buildMathML(tree, expression, options, settings.displayMode, false);

    var _htmlNode = buildHTML(tree, options);

    katexNode = buildCommon.makeSpan(["katex"], [mathMLNode, _htmlNode]);
  }

  return displayWrap(katexNode, settings);
};
var buildHTMLTree = function buildHTMLTree(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var htmlNode = buildHTML(tree, options);
  var katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
  return displayWrap(katexNode, settings);
};

/**
 * This file provides support to buildMathML.js and buildHTML.js
 * for stretchy wide elements rendered from SVG files
 * and other CSS trickery.
 */
var stretchyCodePoint = {
  widehat: "^",
  widecheck: "ˇ",
  widetilde: "~",
  utilde: "~",
  overleftarrow: "\u2190",
  underleftarrow: "\u2190",
  xleftarrow: "\u2190",
  overrightarrow: "\u2192",
  underrightarrow: "\u2192",
  xrightarrow: "\u2192",
  underbrace: "\u23df",
  overbrace: "\u23de",
  overgroup: "\u23e0",
  undergroup: "\u23e1",
  overleftrightarrow: "\u2194",
  underleftrightarrow: "\u2194",
  xleftrightarrow: "\u2194",
  Overrightarrow: "\u21d2",
  xRightarrow: "\u21d2",
  overleftharpoon: "\u21bc",
  xleftharpoonup: "\u21bc",
  overrightharpoon: "\u21c0",
  xrightharpoonup: "\u21c0",
  xLeftarrow: "\u21d0",
  xLeftrightarrow: "\u21d4",
  xhookleftarrow: "\u21a9",
  xhookrightarrow: "\u21aa",
  xmapsto: "\u21a6",
  xrightharpoondown: "\u21c1",
  xleftharpoondown: "\u21bd",
  xrightleftharpoons: "\u21cc",
  xleftrightharpoons: "\u21cb",
  xtwoheadleftarrow: "\u219e",
  xtwoheadrightarrow: "\u21a0",
  xlongequal: "=",
  xtofrom: "\u21c4",
  xrightleftarrows: "\u21c4",
  xrightequilibrium: "\u21cc",
  // Not a perfect match.
  xleftequilibrium: "\u21cb",
  // None better available.
  "\\cdrightarrow": "\u2192",
  "\\cdleftarrow": "\u2190",
  "\\cdlongequal": "="
};

var mathMLnode = function mathMLnode(label) {
  var node = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(stretchyCodePoint[label.replace(/^\\/, '')])]);
  node.setAttribute("stretchy", "true");
  return node;
}; // Many of the KaTeX SVG images have been adapted from glyphs in KaTeX fonts.
// Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
// Copyright (c) 2014-2017 Khan Academy (<www.khanacademy.org>)
// Licensed under the SIL Open Font License, Version 1.1.
// See \nhttp://scripts.sil.org/OFL
// Very Long SVGs
//    Many of the KaTeX stretchy wide elements use a long SVG image and an
//    overflow: hidden tactic to achieve a stretchy image while avoiding
//    distortion of arrowheads or brace corners.
//    The SVG typically contains a very long (400 em) arrow.
//    The SVG is in a container span that has overflow: hidden, so the span
//    acts like a window that exposes only part of the  SVG.
//    The SVG always has a longer, thinner aspect ratio than the container span.
//    After the SVG fills 100% of the height of the container span,
//    there is a long arrow shaft left over. That left-over shaft is not shown.
//    Instead, it is sliced off because the span's CSS has overflow: hidden.
//    Thus, the reader sees an arrow that matches the subject matter width
//    without distortion.
//    Some functions, such as \cancel, need to vary their aspect ratio. These
//    functions do not get the overflow SVG treatment.
// Second Brush Stroke
//    Low resolution monitors struggle to display images in fine detail.
//    So browsers apply anti-aliasing. A long straight arrow shaft therefore
//    will sometimes appear as if it has a blurred edge.
//    To mitigate this, these SVG files contain a second "brush-stroke" on the
//    arrow shafts. That is, a second long thin rectangular SVG path has been
//    written directly on top of each arrow shaft. This reinforcement causes
//    some of the screen pixels to display as black instead of the anti-aliased
//    gray pixel that a  single path would generate. So we get arrow shafts
//    whose edges appear to be sharper.
// In the katexImagesData object just below, the dimensions all
// correspond to path geometry inside the relevant SVG.
// For example, \overrightarrow uses the same arrowhead as glyph U+2192
// from the KaTeX Main font. The scaling factor is 1000.
// That is, inside the font, that arrowhead is 522 units tall, which
// corresponds to 0.522 em inside the document.


var katexImagesData = {
  //   path(s), minWidth, height, align
  overrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  overleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  underrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  underleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  xrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"],
  "\\cdrightarrow": [["rightarrow"], 3.0, 522, "xMaxYMin"],
  // CD minwwidth2.5pc
  xleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"],
  "\\cdleftarrow": [["leftarrow"], 3.0, 522, "xMinYMin"],
  Overrightarrow: [["doublerightarrow"], 0.888, 560, "xMaxYMin"],
  xRightarrow: [["doublerightarrow"], 1.526, 560, "xMaxYMin"],
  xLeftarrow: [["doubleleftarrow"], 1.526, 560, "xMinYMin"],
  overleftharpoon: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoonup: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoondown: [["leftharpoondown"], 0.888, 522, "xMinYMin"],
  overrightharpoon: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoonup: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoondown: [["rightharpoondown"], 0.888, 522, "xMaxYMin"],
  xlongequal: [["longequal"], 0.888, 334, "xMinYMin"],
  "\\cdlongequal": [["longequal"], 3.0, 334, "xMinYMin"],
  xtwoheadleftarrow: [["twoheadleftarrow"], 0.888, 334, "xMinYMin"],
  xtwoheadrightarrow: [["twoheadrightarrow"], 0.888, 334, "xMaxYMin"],
  overleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  overbrace: [["leftbrace", "midbrace", "rightbrace"], 1.6, 548],
  underbrace: [["leftbraceunder", "midbraceunder", "rightbraceunder"], 1.6, 548],
  underleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  xleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522],
  xLeftrightarrow: [["doubleleftarrow", "doublerightarrow"], 1.75, 560],
  xrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716],
  xleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716],
  xhookleftarrow: [["leftarrow", "righthook"], 1.08, 522],
  xhookrightarrow: [["lefthook", "rightarrow"], 1.08, 522],
  overlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  underlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  overgroup: [["leftgroup", "rightgroup"], 0.888, 342],
  undergroup: [["leftgroupunder", "rightgroupunder"], 0.888, 342],
  xmapsto: [["leftmapsto", "rightarrow"], 1.5, 522],
  xtofrom: [["leftToFrom", "rightToFrom"], 1.75, 528],
  // The next three arrows are from the mhchem package.
  // In mhchem.sty, min-length is 2.0em. But these arrows might appear in the
  // document as \xrightarrow or \xrightleftharpoons. Those have
  // min-length = 1.75em, so we set min-length on these next three to match.
  xrightleftarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901],
  xrightequilibrium: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716],
  xleftequilibrium: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716]
};

var groupLength = function groupLength(arg) {
  if (arg.type === "ordgroup") {
    return arg.body.length;
  } else {
    return 1;
  }
};

var svgSpan = function svgSpan(group, options) {
  // Create a span with inline SVG for the element.
  function buildSvgSpan_() {
    var viewBoxWidth = 400000; // default

    var label = group.label.slice(1);

    if (["widehat", "widecheck", "widetilde", "utilde"].includes(label)) {
      // Each type in the `if` statement corresponds to one of the ParseNode
      // types below. This narrowing is required to access `grp.base`.
      // $FlowFixMe
      var grp = group; // There are four SVG images available for each function.
      // Choose a taller image when there are more characters.

      var numChars = groupLength(grp.base);
      var viewBoxHeight;
      var pathName;

      var _height;

      if (numChars > 5) {
        if (label === "widehat" || label === "widecheck") {
          viewBoxHeight = 420;
          viewBoxWidth = 2364;
          _height = 0.42;
          pathName = label + "4";
        } else {
          viewBoxHeight = 312;
          viewBoxWidth = 2340;
          _height = 0.34;
          pathName = "tilde4";
        }
      } else {
        var imgIndex = [1, 1, 2, 2, 3, 3][numChars];

        if (label === "widehat" || label === "widecheck") {
          viewBoxWidth = [0, 1062, 2364, 2364, 2364][imgIndex];
          viewBoxHeight = [0, 239, 300, 360, 420][imgIndex];
          _height = [0, 0.24, 0.3, 0.3, 0.36, 0.42][imgIndex];
          pathName = label + imgIndex;
        } else {
          viewBoxWidth = [0, 600, 1033, 2339, 2340][imgIndex];
          viewBoxHeight = [0, 260, 286, 306, 312][imgIndex];
          _height = [0, 0.26, 0.286, 0.3, 0.306, 0.34][imgIndex];
          pathName = "tilde" + imgIndex;
        }
      }

      var path = new PathNode(pathName);
      var svgNode = new SvgNode([path], {
        "width": "100%",
        "height": makeEm(_height),
        "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight,
        "preserveAspectRatio": "none"
      });
      return {
        span: buildCommon.makeSvgSpan([], [svgNode], options),
        minWidth: 0,
        height: _height
      };
    } else {
      var spans = [];
      var data = katexImagesData[label];
      var [paths, _minWidth, _viewBoxHeight] = data;

      var _height2 = _viewBoxHeight / 1000;

      var numSvgChildren = paths.length;
      var widthClasses;
      var aligns;

      if (numSvgChildren === 1) {
        // $FlowFixMe: All these cases must be of the 4-tuple type.
        var align1 = data[3];
        widthClasses = ["hide-tail"];
        aligns = [align1];
      } else if (numSvgChildren === 2) {
        widthClasses = ["halfarrow-left", "halfarrow-right"];
        aligns = ["xMinYMin", "xMaxYMin"];
      } else if (numSvgChildren === 3) {
        widthClasses = ["brace-left", "brace-center", "brace-right"];
        aligns = ["xMinYMin", "xMidYMin", "xMaxYMin"];
      } else {
        throw new Error("Correct katexImagesData or update code here to support\n                    " + numSvgChildren + " children.");
      }

      for (var i = 0; i < numSvgChildren; i++) {
        var _path = new PathNode(paths[i]);

        var _svgNode = new SvgNode([_path], {
          "width": "400em",
          "height": makeEm(_height2),
          "viewBox": "0 0 " + viewBoxWidth + " " + _viewBoxHeight,
          "preserveAspectRatio": aligns[i] + " slice"
        });

        var _span = buildCommon.makeSvgSpan([widthClasses[i]], [_svgNode], options);

        if (numSvgChildren === 1) {
          return {
            span: _span,
            minWidth: _minWidth,
            height: _height2
          };
        } else {
          _span.style.height = makeEm(_height2);
          spans.push(_span);
        }
      }

      return {
        span: buildCommon.makeSpan(["stretchy"], spans, options),
        minWidth: _minWidth,
        height: _height2
      };
    }
  } // buildSvgSpan_()


  var {
    span,
    minWidth,
    height
  } = buildSvgSpan_(); // Note that we are returning span.depth = 0.
  // Any adjustments relative to the baseline must be done in buildHTML.

  span.height = height;
  span.style.height = makeEm(height);

  if (minWidth > 0) {
    span.style.minWidth = makeEm(minWidth);
  }

  return span;
};

var encloseSpan = function encloseSpan(inner, label, topPad, bottomPad, options) {
  // Return an image span for \cancel, \bcancel, \xcancel, \fbox, or \angl
  var img;
  var totalHeight = inner.height + inner.depth + topPad + bottomPad;

  if (/fbox|color|angl/.test(label)) {
    img = buildCommon.makeSpan(["stretchy", label], [], options);

    if (label === "fbox") {
      var color = options.color && options.getColor();

      if (color) {
        img.style.borderColor = color;
      }
    }
  } else {
    // \cancel, \bcancel, or \xcancel
    // Since \cancel's SVG is inline and it omits the viewBox attribute,
    // its stroke-width will not vary with span area.
    var lines = [];

    if (/^[bx]cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "0",
        "x2": "100%",
        "y2": "100%",
        "stroke-width": "0.046em"
      }));
    }

    if (/^x?cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "100%",
        "x2": "100%",
        "y2": "0",
        "stroke-width": "0.046em"
      }));
    }

    var svgNode = new SvgNode(lines, {
      "width": "100%",
      "height": makeEm(totalHeight)
    });
    img = buildCommon.makeSvgSpan([], [svgNode], options);
  }

  img.height = totalHeight;
  img.style.height = makeEm(totalHeight);
  return img;
};

var stretchy = {
  encloseSpan,
  mathMLnode,
  svgSpan
};

/**
 * Asserts that the node is of the given type and returns it with stricter
 * typing. Throws if the node's type does not match.
 */
function assertNodeType(node, type) {
  if (!node || node.type !== type) {
    throw new Error("Expected node of type " + type + ", but got " + (node ? "node of type " + node.type : String(node)));
  } // $FlowFixMe, >=0.125


  return node;
}
/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */

function assertSymbolNodeType(node) {
  var typedNode = checkSymbolNodeType(node);

  if (!typedNode) {
    throw new Error("Expected node of symbol group type, but got " + (node ? "node of type " + node.type : String(node)));
  }

  return typedNode;
}
/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */

function checkSymbolNodeType(node) {
  if (node && (node.type === "atom" || NON_ATOMS.hasOwnProperty(node.type))) {
    // $FlowFixMe
    return node;
  }

  return null;
}

// NOTE: Unlike most `htmlBuilder`s, this one handles not only "accent", but
// also "supsub" since an accent can affect super/subscripting.
var htmlBuilder$a = (grp, options) => {
  // Accents are handled in the TeXbook pg. 443, rule 12.
  var base;
  var group;
  var supSubGroup;

  if (grp && grp.type === "supsub") {
    // If our base is a character box, and we have superscripts and
    // subscripts, the supsub will defer to us. In particular, we want
    // to attach the superscripts and subscripts to the inner body (so
    // that the position of the superscripts and subscripts won't be
    // affected by the height of the accent). We accomplish this by
    // sticking the base of the accent into the base of the supsub, and
    // rendering that, while keeping track of where the accent is.
    // The real accent group is the base of the supsub group
    group = assertNodeType(grp.base, "accent"); // The character box is the base of the accent group

    base = group.base; // Stick the character box into the base of the supsub group

    grp.base = base; // Rerender the supsub group with its new base, and store that
    // result.

    supSubGroup = assertSpan(buildGroup$1(grp, options)); // reset original base

    grp.base = group;
  } else {
    group = assertNodeType(grp, "accent");
    base = group.base;
  } // Build the base group


  var body = buildGroup$1(base, options.havingCrampedStyle()); // Does the accent need to shift for the skew of a character?

  var mustShift = group.isShifty && utils.isCharacterBox(base); // Calculate the skew of the accent. This is based on the line "If the
  // nucleus is not a single character, let s = 0; otherwise set s to the
  // kern amount for the nucleus followed by the \skewchar of its font."
  // Note that our skew metrics are just the kern between each character
  // and the skewchar.

  var skew = 0;

  if (mustShift) {
    // If the base is a character box, then we want the skew of the
    // innermost character. To do that, we find the innermost character:
    var baseChar = utils.getBaseElem(base); // Then, we render its group to get the symbol inside it

    var baseGroup = buildGroup$1(baseChar, options.havingCrampedStyle()); // Finally, we pull the skew off of the symbol.

    skew = assertSymbolDomNode(baseGroup).skew; // Note that we now throw away baseGroup, because the layers we
    // removed with getBaseElem might contain things like \color which
    // we can't get rid of.
    // TODO(emily): Find a better way to get the skew
  }

  var accentBelow = group.label === "\\c"; // calculate the amount of space between the body and the accent

  var clearance = accentBelow ? body.height + body.depth : Math.min(body.height, options.fontMetrics().xHeight); // Build the accent

  var accentBody;

  if (!group.isStretchy) {
    var accent;
    var width;

    if (group.label === "\\vec") {
      // Before version 0.9, \vec used the combining font glyph U+20D7.
      // But browsers, especially Safari, are not consistent in how they
      // render combining characters when not preceded by a character.
      // So now we use an SVG.
      // If Safari reforms, we should consider reverting to the glyph.
      accent = buildCommon.staticSvg("vec", options);
      width = buildCommon.svgData.vec[1];
    } else {
      accent = buildCommon.makeOrd({
        mode: group.mode,
        text: group.label
      }, options, "textord");
      accent = assertSymbolDomNode(accent); // Remove the italic correction of the accent, because it only serves to
      // shift the accent over to a place we don't want.

      accent.italic = 0;
      width = accent.width;

      if (accentBelow) {
        clearance += accent.depth;
      }
    }

    accentBody = buildCommon.makeSpan(["accent-body"], [accent]); // "Full" accents expand the width of the resulting symbol to be
    // at least the width of the accent, and overlap directly onto the
    // character without any vertical offset.

    var accentFull = group.label === "\\textcircled";

    if (accentFull) {
      accentBody.classes.push('accent-full');
      clearance = body.height;
    } // Shift the accent over by the skew.


    var left = skew; // CSS defines `.katex .accent .accent-body:not(.accent-full) { width: 0 }`
    // so that the accent doesn't contribute to the bounding box.
    // We need to shift the character by its width (effectively half
    // its width) to compensate.

    if (!accentFull) {
      left -= width / 2;
    }

    accentBody.style.left = makeEm(left); // \textcircled uses the \bigcirc glyph, so it needs some
    // vertical adjustment to match LaTeX.

    if (group.label === "\\textcircled") {
      accentBody.style.top = ".2em";
    }

    accentBody = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: -clearance
      }, {
        type: "elem",
        elem: accentBody
      }]
    }, options);
  } else {
    accentBody = stretchy.svgSpan(group, options);
    accentBody = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"],
        wrapperStyle: skew > 0 ? {
          width: "calc(100% - " + makeEm(2 * skew) + ")",
          marginLeft: makeEm(2 * skew)
        } : undefined
      }]
    }, options);
  }

  var accentWrap = buildCommon.makeSpan(["mord", "accent"], [accentBody], options);

  if (supSubGroup) {
    // Here, we replace the "base" child of the supsub with our newly
    // generated accent.
    supSubGroup.children[0] = accentWrap; // Since we don't rerun the height calculation after replacing the
    // accent, we manually recalculate height.

    supSubGroup.height = Math.max(accentWrap.height, supSubGroup.height); // Accents should always be ords, even when their innards are not.

    supSubGroup.classes[0] = "mord";
    return supSubGroup;
  } else {
    return accentWrap;
  }
};

var mathmlBuilder$9 = (group, options) => {
  var accentNode = group.isStretchy ? stretchy.mathMLnode(group.label) : new mathMLTree.MathNode("mo", [makeText(group.label, group.mode)]);
  var node = new mathMLTree.MathNode("mover", [buildGroup(group.base, options), accentNode]);
  node.setAttribute("accent", "true");
  return node;
};

var NON_STRETCHY_ACCENT_REGEX = new RegExp(["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring"].map(accent => "\\" + accent).join("|")); // Accents

defineFunction({
  type: "accent",
  names: ["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring", "\\widecheck", "\\widehat", "\\widetilde", "\\overrightarrow", "\\overleftarrow", "\\Overrightarrow", "\\overleftrightarrow", "\\overgroup", "\\overlinesegment", "\\overleftharpoon", "\\overrightharpoon"],
  props: {
    numArgs: 1
  },
  handler: (context, args) => {
    var base = normalizeArgument(args[0]);
    var isStretchy = !NON_STRETCHY_ACCENT_REGEX.test(context.funcName);
    var isShifty = !isStretchy || context.funcName === "\\widehat" || context.funcName === "\\widetilde" || context.funcName === "\\widecheck";
    return {
      type: "accent",
      mode: context.parser.mode,
      label: context.funcName,
      isStretchy: isStretchy,
      isShifty: isShifty,
      base: base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
}); // Text-mode accents

defineFunction({
  type: "accent",
  names: ["\\'", "\\`", "\\^", "\\~", "\\=", "\\u", "\\.", '\\"', "\\c", "\\r", "\\H", "\\v", "\\textcircled"],
  props: {
    numArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    // unless in strict mode
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var base = args[0];
    var mode = context.parser.mode;

    if (mode === "math") {
      context.parser.settings.reportNonstrict("mathVsTextAccents", "LaTeX's accent " + context.funcName + " works only in text mode");
      mode = "text";
    }

    return {
      type: "accent",
      mode: mode,
      label: context.funcName,
      isStretchy: false,
      isShifty: true,
      base: base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
});

// Horizontal overlap functions
defineFunction({
  type: "accentUnder",
  names: ["\\underleftarrow", "\\underrightarrow", "\\underleftrightarrow", "\\undergroup", "\\underlinesegment", "\\utilde"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var base = args[0];
    return {
      type: "accentUnder",
      mode: parser.mode,
      label: funcName,
      base: base
    };
  },
  htmlBuilder: (group, options) => {
    // Treat under accents much like underlines.
    var innerGroup = buildGroup$1(group.base, options);
    var accentBody = stretchy.svgSpan(group, options);
    var kern = group.label === "\\utilde" ? 0.12 : 0; // Generate the vlist, with the appropriate kerns

    var vlist = buildCommon.makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: kern
      }, {
        type: "elem",
        elem: innerGroup
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "accentunder"], [vlist], options);
  },
  mathmlBuilder: (group, options) => {
    var accentNode = stretchy.mathMLnode(group.label);
    var node = new mathMLTree.MathNode("munder", [buildGroup(group.base, options), accentNode]);
    node.setAttribute("accentunder", "true");
    return node;
  }
});

// Helper function
var paddedNode = group => {
  var node = new mathMLTree.MathNode("mpadded", group ? [group] : []);
  node.setAttribute("width", "+0.6em");
  node.setAttribute("lspace", "0.3em");
  return node;
}; // Stretchy arrows with an optional argument


defineFunction({
  type: "xArrow",
  names: ["\\xleftarrow", "\\xrightarrow", "\\xLeftarrow", "\\xRightarrow", "\\xleftrightarrow", "\\xLeftrightarrow", "\\xhookleftarrow", "\\xhookrightarrow", "\\xmapsto", "\\xrightharpoondown", "\\xrightharpoonup", "\\xleftharpoondown", "\\xleftharpoonup", "\\xrightleftharpoons", "\\xleftrightharpoons", "\\xlongequal", "\\xtwoheadrightarrow", "\\xtwoheadleftarrow", "\\xtofrom", // The next 3 functions are here to support the mhchem extension.
  // Direct use of these functions is discouraged and may break someday.
  "\\xrightleftarrows", "\\xrightequilibrium", "\\xleftequilibrium", // The next 3 functions are here only to support the {CD} environment.
  "\\\\cdrightarrow", "\\\\cdleftarrow", "\\\\cdlongequal"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },

  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "xArrow",
      mode: parser.mode,
      label: funcName,
      body: args[0],
      below: optArgs[0]
    };
  },

  // Flow is unable to correctly infer the type of `group`, even though it's
  // unambiguously determined from the passed-in `type` above.
  htmlBuilder(group, options) {
    var style = options.style; // Build the argument groups in the appropriate style.
    // Ref: amsmath.dtx:   \hbox{$\scriptstyle\mkern#3mu{#6}\mkern#4mu$}%
    // Some groups can return document fragments.  Handle those by wrapping
    // them in a span.

    var newOptions = options.havingStyle(style.sup());
    var upperGroup = buildCommon.wrapFragment(buildGroup$1(group.body, newOptions, options), options);
    var arrowPrefix = group.label.slice(0, 2) === "\\x" ? "x" : "cd";
    upperGroup.classes.push(arrowPrefix + "-arrow-pad");
    var lowerGroup;

    if (group.below) {
      // Build the lower group
      newOptions = options.havingStyle(style.sub());
      lowerGroup = buildCommon.wrapFragment(buildGroup$1(group.below, newOptions, options), options);
      lowerGroup.classes.push(arrowPrefix + "-arrow-pad");
    }

    var arrowBody = stretchy.svgSpan(group, options); // Re shift: Note that stretchy.svgSpan returned arrowBody.depth = 0.
    // The point we want on the math axis is at 0.5 * arrowBody.height.

    var arrowShift = -options.fontMetrics().axisHeight + 0.5 * arrowBody.height; // 2 mu kern. Ref: amsmath.dtx: #7\if0#2\else\mkern#2mu\fi

    var upperShift = -options.fontMetrics().axisHeight - 0.5 * arrowBody.height - 0.111; // 0.111 em = 2 mu

    if (upperGroup.depth > 0.25 || group.label === "\\xleftequilibrium") {
      upperShift -= upperGroup.depth; // shift up if depth encroaches
    } // Generate the vlist


    var vlist;

    if (lowerGroup) {
      var lowerShift = -options.fontMetrics().axisHeight + lowerGroup.height + 0.5 * arrowBody.height + 0.111;
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift
        }, {
          type: "elem",
          elem: lowerGroup,
          shift: lowerShift
        }]
      }, options);
    } else {
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift
        }]
      }, options);
    } // $FlowFixMe: Replace this with passing "svg-align" into makeVList.


    vlist.children[0].children[0].children[1].classes.push("svg-align");
    return buildCommon.makeSpan(["mrel", "x-arrow"], [vlist], options);
  },

  mathmlBuilder(group, options) {
    var arrowNode = stretchy.mathMLnode(group.label);
    arrowNode.setAttribute("minsize", group.label.charAt(0) === "x" ? "1.75em" : "3.0em");
    var node;

    if (group.body) {
      var upperNode = paddedNode(buildGroup(group.body, options));

      if (group.below) {
        var lowerNode = paddedNode(buildGroup(group.below, options));
        node = new mathMLTree.MathNode("munderover", [arrowNode, lowerNode, upperNode]);
      } else {
        node = new mathMLTree.MathNode("mover", [arrowNode, upperNode]);
      }
    } else if (group.below) {
      var _lowerNode = paddedNode(buildGroup(group.below, options));

      node = new mathMLTree.MathNode("munder", [arrowNode, _lowerNode]);
    } else {
      // This should never happen.
      // Parser.js throws an error if there is no argument.
      node = paddedNode();
      node = new mathMLTree.MathNode("mover", [arrowNode, node]);
    }

    return node;
  }

});

var makeSpan = buildCommon.makeSpan;

function htmlBuilder$9(group, options) {
  var elements = buildExpression$1(group.body, options, true);
  return makeSpan([group.mclass], elements, options);
}

function mathmlBuilder$8(group, options) {
  var node;
  var inner = buildExpression(group.body, options);

  if (group.mclass === "minner") {
    node = new mathMLTree.MathNode("mpadded", inner);
  } else if (group.mclass === "mord") {
    if (group.isCharacterBox) {
      node = inner[0];
      node.type = "mi";
    } else {
      node = new mathMLTree.MathNode("mi", inner);
    }
  } else {
    if (group.isCharacterBox) {
      node = inner[0];
      node.type = "mo";
    } else {
      node = new mathMLTree.MathNode("mo", inner);
    } // Set spacing based on what is the most likely adjacent atom type.
    // See TeXbook p170.


    if (group.mclass === "mbin") {
      node.attributes.lspace = "0.22em"; // medium space

      node.attributes.rspace = "0.22em";
    } else if (group.mclass === "mpunct") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0.17em"; // thinspace
    } else if (group.mclass === "mopen" || group.mclass === "mclose") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0em";
    } else if (group.mclass === "minner") {
      node.attributes.lspace = "0.0556em"; // 1 mu is the most likely option

      node.attributes.width = "+0.1111em";
    } // MathML <mo> default space is 5/18 em, so <mrel> needs no action.
    // Ref: https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mo

  }

  return node;
} // Math class commands except \mathop


defineFunction({
  type: "mclass",
  names: ["\\mathord", "\\mathbin", "\\mathrel", "\\mathopen", "\\mathclose", "\\mathpunct", "\\mathinner"],
  props: {
    numArgs: 1,
    primitive: true
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: "m" + funcName.slice(5),
      // TODO(kevinb): don't prefix with 'm'
      body: ordargument(body),
      isCharacterBox: utils.isCharacterBox(body)
    };
  },

  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});
var binrelClass = arg => {
  // \binrel@ spacing varies with (bin|rel|ord) of the atom in the argument.
  // (by rendering separately and with {}s before and after, and measuring
  // the change in spacing).  We'll do roughly the same by detecting the
  // atom type directly.
  var atom = arg.type === "ordgroup" && arg.body.length ? arg.body[0] : arg;

  if (atom.type === "atom" && (atom.family === "bin" || atom.family === "rel")) {
    return "m" + atom.family;
  } else {
    return "mord";
  }
}; // \@binrel{x}{y} renders like y but as mbin/mrel/mord if x is mbin/mrel/mord.
// This is equivalent to \binrel@{x}\binrel@@{y} in AMSTeX.

defineFunction({
  type: "mclass",
  names: ["\\@binrel"],
  props: {
    numArgs: 2
  },

  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[1]),
      isCharacterBox: utils.isCharacterBox(args[1])
    };
  }

}); // Build a relation or stacked op by placing one symbol on top of another

defineFunction({
  type: "mclass",
  names: ["\\stackrel", "\\overset", "\\underset"],
  props: {
    numArgs: 2
  },

  handler(_ref3, args) {
    var {
      parser,
      funcName
    } = _ref3;
    var baseArg = args[1];
    var shiftedArg = args[0];
    var mclass;

    if (funcName !== "\\stackrel") {
      // LaTeX applies \binrel spacing to \overset and \underset.
      mclass = binrelClass(baseArg);
    } else {
      mclass = "mrel"; // for \stackrel
    }

    var baseOp = {
      type: "op",
      mode: baseArg.mode,
      limits: true,
      alwaysHandleSupSub: true,
      parentIsSupSub: false,
      symbol: false,
      suppressBaseShift: funcName !== "\\stackrel",
      body: ordargument(baseArg)
    };
    var supsub = {
      type: "supsub",
      mode: shiftedArg.mode,
      base: baseOp,
      sup: funcName === "\\underset" ? null : shiftedArg,
      sub: funcName === "\\underset" ? shiftedArg : null
    };
    return {
      type: "mclass",
      mode: parser.mode,
      mclass,
      body: [supsub],
      isCharacterBox: utils.isCharacterBox(supsub)
    };
  },

  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});

// \pmb is a simulation of bold font.
// The version of \pmb in ambsy.sty works by typesetting three copies
// with small offsets. We use CSS text-shadow.
// It's a hack. Not as good as a real bold font. Better than nothing.
defineFunction({
  type: "pmb",
  names: ["\\pmb"],
  props: {
    numArgs: 1,
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "pmb",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[0])
    };
  },

  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options, true);
    var node = buildCommon.makeSpan([group.mclass], elements, options);
    node.style.textShadow = "0.02em 0.01em 0.04px";
    return node;
  },

  mathmlBuilder(group, style) {
    var inner = buildExpression(group.body, style); // Wrap with an <mstyle> element.

    var node = new mathMLTree.MathNode("mstyle", inner);
    node.setAttribute("style", "text-shadow: 0.02em 0.01em 0.04px");
    return node;
  }

});

var cdArrowFunctionName = {
  ">": "\\\\cdrightarrow",
  "<": "\\\\cdleftarrow",
  "=": "\\\\cdlongequal",
  "A": "\\uparrow",
  "V": "\\downarrow",
  "|": "\\Vert",
  ".": "no arrow"
};

var newCell = () => {
  // Create an empty cell, to be filled below with parse nodes.
  // The parseTree from this module must be constructed like the
  // one created by parseArray(), so an empty CD cell must
  // be a ParseNode<"styling">. And CD is always displaystyle.
  // So these values are fixed and flow can do implicit typing.
  return {
    type: "styling",
    body: [],
    mode: "math",
    style: "display"
  };
};

var isStartOfArrow = node => {
  return node.type === "textord" && node.text === "@";
};

var isLabelEnd = (node, endChar) => {
  return (node.type === "mathord" || node.type === "atom") && node.text === endChar;
};

function cdArrow(arrowChar, labels, parser) {
  // Return a parse tree of an arrow and its labels.
  // This acts in a way similar to a macro expansion.
  var funcName = cdArrowFunctionName[arrowChar];

  switch (funcName) {
    case "\\\\cdrightarrow":
    case "\\\\cdleftarrow":
      return parser.callFunction(funcName, [labels[0]], [labels[1]]);

    case "\\uparrow":
    case "\\downarrow":
      {
        var leftLabel = parser.callFunction("\\\\cdleft", [labels[0]], []);
        var bareArrow = {
          type: "atom",
          text: funcName,
          mode: "math",
          family: "rel"
        };
        var sizedArrow = parser.callFunction("\\Big", [bareArrow], []);
        var rightLabel = parser.callFunction("\\\\cdright", [labels[1]], []);
        var arrowGroup = {
          type: "ordgroup",
          mode: "math",
          body: [leftLabel, sizedArrow, rightLabel]
        };
        return parser.callFunction("\\\\cdparent", [arrowGroup], []);
      }

    case "\\\\cdlongequal":
      return parser.callFunction("\\\\cdlongequal", [], []);

    case "\\Vert":
      {
        var arrow = {
          type: "textord",
          text: "\\Vert",
          mode: "math"
        };
        return parser.callFunction("\\Big", [arrow], []);
      }

    default:
      return {
        type: "textord",
        text: " ",
        mode: "math"
      };
  }
}

function parseCD(parser) {
  // Get the array's parse nodes with \\ temporarily mapped to \cr.
  var parsedRows = [];
  parser.gullet.beginGroup();
  parser.gullet.macros.set("\\cr", "\\\\\\relax");
  parser.gullet.beginGroup();

  while (true) {
    // eslint-disable-line no-constant-condition
    // Get the parse nodes for the next row.
    parsedRows.push(parser.parseExpression(false, "\\\\"));
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    var next = parser.fetch().text;

    if (next === "&" || next === "\\\\") {
      parser.consume();
    } else if (next === "\\end") {
      if (parsedRows[parsedRows.length - 1].length === 0) {
        parsedRows.pop(); // final row ended in \\
      }

      break;
    } else {
      throw new ParseError("Expected \\\\ or \\cr or \\end", parser.nextToken);
    }
  }

  var row = [];
  var body = [row]; // Loop thru the parse nodes. Collect them into cells and arrows.

  for (var i = 0; i < parsedRows.length; i++) {
    // Start a new row.
    var rowNodes = parsedRows[i]; // Create the first cell.

    var cell = newCell();

    for (var j = 0; j < rowNodes.length; j++) {
      if (!isStartOfArrow(rowNodes[j])) {
        // If a parseNode is not an arrow, it goes into a cell.
        cell.body.push(rowNodes[j]);
      } else {
        // Parse node j is an "@", the start of an arrow.
        // Before starting on the arrow, push the cell into `row`.
        row.push(cell); // Now collect parseNodes into an arrow.
        // The character after "@" defines the arrow type.

        j += 1;
        var arrowChar = assertSymbolNodeType(rowNodes[j]).text; // Create two empty label nodes. We may or may not use them.

        var labels = new Array(2);
        labels[0] = {
          type: "ordgroup",
          mode: "math",
          body: []
        };
        labels[1] = {
          type: "ordgroup",
          mode: "math",
          body: []
        }; // Process the arrow.

        if ("=|.".indexOf(arrowChar) > -1) ; else if ("<>AV".indexOf(arrowChar) > -1) {
          // Four arrows, `@>>>`, `@<<<`, `@AAA`, and `@VVV`, each take
          // two optional labels. E.g. the right-point arrow syntax is
          // really:  @>{optional label}>{optional label}>
          // Collect parseNodes into labels.
          for (var labelNum = 0; labelNum < 2; labelNum++) {
            var inLabel = true;

            for (var k = j + 1; k < rowNodes.length; k++) {
              if (isLabelEnd(rowNodes[k], arrowChar)) {
                inLabel = false;
                j = k;
                break;
              }

              if (isStartOfArrow(rowNodes[k])) {
                throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[k]);
              }

              labels[labelNum].body.push(rowNodes[k]);
            }

            if (inLabel) {
              // isLabelEnd never returned a true.
              throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[j]);
            }
          }
        } else {
          throw new ParseError("Expected one of \"<>AV=|.\" after @", rowNodes[j]);
        } // Now join the arrow to its labels.


        var arrow = cdArrow(arrowChar, labels, parser); // Wrap the arrow in  ParseNode<"styling">.
        // This is done to match parseArray() behavior.

        var wrappedArrow = {
          type: "styling",
          body: [arrow],
          mode: "math",
          style: "display" // CD is always displaystyle.

        };
        row.push(wrappedArrow); // In CD's syntax, cells are implicit. That is, everything that
        // is not an arrow gets collected into a cell. So create an empty
        // cell now. It will collect upcoming parseNodes.

        cell = newCell();
      }
    }

    if (i % 2 === 0) {
      // Even-numbered rows consist of: cell, arrow, cell, arrow, ... cell
      // The last cell is not yet pushed into `row`, so:
      row.push(cell);
    } else {
      // Odd-numbered rows consist of: vert arrow, empty cell, ... vert arrow
      // Remove the empty cell that was placed at the beginning of `row`.
      row.shift();
    }

    row = [];
    body.push(row);
  } // End row group


  parser.gullet.endGroup(); // End array group defining \\

  parser.gullet.endGroup(); // define column separation.

  var cols = new Array(body[0].length).fill({
    type: "align",
    align: "c",
    pregap: 0.25,
    // CD package sets \enskip between columns.
    postgap: 0.25 // So pre and post each get half an \enskip, i.e. 0.25em.

  });
  return {
    type: "array",
    mode: "math",
    body,
    arraystretch: 1,
    addJot: true,
    rowGaps: [null],
    cols,
    colSeparationType: "CD",
    hLinesBeforeRow: new Array(body.length + 1).fill([])
  };
} // The functions below are not available for general use.
// They are here only for internal use by the {CD} environment in placing labels
// next to vertical arrows.
// We don't need any such functions for horizontal arrows because we can reuse
// the functionality that already exists for extensible arrows.

defineFunction({
  type: "cdlabel",
  names: ["\\\\cdleft", "\\\\cdright"],
  props: {
    numArgs: 1
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "cdlabel",
      mode: parser.mode,
      side: funcName.slice(4),
      label: args[0]
    };
  },

  htmlBuilder(group, options) {
    var newOptions = options.havingStyle(options.style.sup());
    var label = buildCommon.wrapFragment(buildGroup$1(group.label, newOptions, options), options);
    label.classes.push("cd-label-" + group.side);
    label.style.bottom = makeEm(0.8 - label.depth); // Zero out label height & depth, so vertical align of arrow is set
    // by the arrow height, not by the label.

    label.height = 0;
    label.depth = 0;
    return label;
  },

  mathmlBuilder(group, options) {
    var label = new mathMLTree.MathNode("mrow", [buildGroup(group.label, options)]);
    label = new mathMLTree.MathNode("mpadded", [label]);
    label.setAttribute("width", "0");

    if (group.side === "left") {
      label.setAttribute("lspace", "-1width");
    } // We have to guess at vertical alignment. We know the arrow is 1.8em tall,
    // But we don't know the height or depth of the label.


    label.setAttribute("voffset", "0.7em");
    label = new mathMLTree.MathNode("mstyle", [label]);
    label.setAttribute("displaystyle", "false");
    label.setAttribute("scriptlevel", "1");
    return label;
  }

});
defineFunction({
  type: "cdlabelparent",
  names: ["\\\\cdparent"],
  props: {
    numArgs: 1
  },

  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "cdlabelparent",
      mode: parser.mode,
      fragment: args[0]
    };
  },

  htmlBuilder(group, options) {
    // Wrap the vertical arrow and its labels.
    // The parent gets position: relative. The child gets position: absolute.
    // So CSS can locate the label correctly.
    var parent = buildCommon.wrapFragment(buildGroup$1(group.fragment, options), options);
    parent.classes.push("cd-vert-arrow");
    return parent;
  },

  mathmlBuilder(group, options) {
    return new mathMLTree.MathNode("mrow", [buildGroup(group.fragment, options)]);
  }

});

// {123} and converts into symbol with code 123.  It is used by the *macro*
// \char defined in macros.js.

defineFunction({
  type: "textord",
  names: ["\\@char"],
  props: {
    numArgs: 1,
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var arg = assertNodeType(args[0], "ordgroup");
    var group = arg.body;
    var number = "";

    for (var i = 0; i < group.length; i++) {
      var node = assertNodeType(group[i], "textord");
      number += node.text;
    }

    var code = parseInt(number);
    var text;

    if (isNaN(code)) {
      throw new ParseError("\\@char has non-numeric argument " + number); // If we drop IE support, the following code could be replaced with
      // text = String.fromCodePoint(code)
    } else if (code < 0 || code >= 0x10ffff) {
      throw new ParseError("\\@char with invalid code point " + number);
    } else if (code <= 0xffff) {
      text = String.fromCharCode(code);
    } else {
      // Astral code point; split into surrogate halves
      code -= 0x10000;
      text = String.fromCharCode((code >> 10) + 0xd800, (code & 0x3ff) + 0xdc00);
    }

    return {
      type: "textord",
      mode: parser.mode,
      text: text
    };
  }

});

var htmlBuilder$8 = (group, options) => {
  var elements = buildExpression$1(group.body, options.withColor(group.color), false); // \color isn't supposed to affect the type of the elements it contains.
  // To accomplish this, we wrap the results in a fragment, so the inner
  // elements will be able to directly interact with their neighbors. For
  // example, `\color{red}{2 +} 3` has the same spacing as `2 + 3`

  return buildCommon.makeFragment(elements);
};

var mathmlBuilder$7 = (group, options) => {
  var inner = buildExpression(group.body, options.withColor(group.color));
  var node = new mathMLTree.MathNode("mstyle", inner);
  node.setAttribute("mathcolor", group.color);
  return node;
};

defineFunction({
  type: "color",
  names: ["\\textcolor"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "original"]
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "color",
      mode: parser.mode,
      color,
      body: ordargument(body)
    };
  },

  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});
defineFunction({
  type: "color",
  names: ["\\color"],
  props: {
    numArgs: 1,
    allowedInText: true,
    argTypes: ["color"]
  },

  handler(_ref2, args) {
    var {
      parser,
      breakOnTokenText
    } = _ref2;
    var color = assertNodeType(args[0], "color-token").color; // Set macro \current@color in current namespace to store the current
    // color, mimicking the behavior of color.sty.
    // This is currently used just to correctly color a \right
    // that follows a \color command.

    parser.gullet.macros.set("\\current@color", color); // Parse out the implicit body that should be colored.

    var body = parser.parseExpression(true, breakOnTokenText);
    return {
      type: "color",
      mode: parser.mode,
      color,
      body
    };
  },

  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});

// Row breaks within tabular environments, and line breaks at top level

defineFunction({
  type: "cr",
  names: ["\\\\"],
  props: {
    numArgs: 0,
    numOptionalArgs: 0,
    allowedInText: true
  },

  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var size = parser.gullet.future().text === "[" ? parser.parseSizeGroup(true) : null;
    var newLine = !parser.settings.displayMode || !parser.settings.useStrictBehavior("newLineInDisplayMode", "In LaTeX, \\\\ or \\newline " + "does nothing in display mode");
    return {
      type: "cr",
      mode: parser.mode,
      newLine,
      size: size && assertNodeType(size, "size").value
    };
  },

  // The following builders are called only at the top level,
  // not within tabular/array environments.
  htmlBuilder(group, options) {
    var span = buildCommon.makeSpan(["mspace"], [], options);

    if (group.newLine) {
      span.classes.push("newline");

      if (group.size) {
        span.style.marginTop = makeEm(calculateSize(group.size, options));
      }
    }

    return span;
  },

  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mspace");

    if (group.newLine) {
      node.setAttribute("linebreak", "newline");

      if (group.size) {
        node.setAttribute("height", makeEm(calculateSize(group.size, options)));
      }
    }

    return node;
  }

});

var globalMap = {
  "\\global": "\\global",
  "\\long": "\\\\globallong",
  "\\\\globallong": "\\\\globallong",
  "\\def": "\\gdef",
  "\\gdef": "\\gdef",
  "\\edef": "\\xdef",
  "\\xdef": "\\xdef",
  "\\let": "\\\\globallet",
  "\\futurelet": "\\\\globalfuture"
};

var checkControlSequence = tok => {
  var name = tok.text;

  if (/^(?:[\\{}$&#^_]|EOF)$/.test(name)) {
    throw new ParseError("Expected a control sequence", tok);
  }

  return name;
};

var getRHS = parser => {
  var tok = parser.gullet.popToken();

  if (tok.text === "=") {
    // consume optional equals
    tok = parser.gullet.popToken();

    if (tok.text === " ") {
      // consume one optional space
      tok = parser.gullet.popToken();
    }
  }

  return tok;
};

var letCommand = (parser, name, tok, global) => {
  var macro = parser.gullet.macros.get(tok.text);

  if (macro == null) {
    // don't expand it later even if a macro with the same name is defined
    // e.g., \let\foo=\frac \def\frac{\relax} \frac12
    tok.noexpand = true;
    macro = {
      tokens: [tok],
      numArgs: 0,
      // reproduce the same behavior in expansion
      unexpandable: !parser.gullet.isExpandable(tok.text)
    };
  }

  parser.gullet.macros.set(name, macro, global);
}; // <assignment> -> <non-macro assignment>|<macro assignment>
// <non-macro assignment> -> <simple assignment>|\global<non-macro assignment>
// <macro assignment> -> <definition>|<prefix><macro assignment>
// <prefix> -> \global|\long|\outer


defineFunction({
  type: "internal",
  names: ["\\global", "\\long", "\\\\globallong" // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true
  },

  handler(_ref) {
    var {
      parser,
      funcName
    } = _ref;
    parser.consumeSpaces();
    var token = parser.fetch();

    if (globalMap[token.text]) {
      // KaTeX doesn't have \par, so ignore \long
      if (funcName === "\\global" || funcName === "\\\\globallong") {
        token.text = globalMap[token.text];
      }

      return assertNodeType(parser.parseFunction(), "internal");
    }

    throw new ParseError("Invalid token after macro prefix", token);
  }

}); // Basic support for macro definitions: \def, \gdef, \edef, \xdef
// <definition> -> <def><control sequence><definition text>
// <def> -> \def|\gdef|\edef|\xdef
// <definition text> -> <parameter text><left brace><balanced text><right brace>

defineFunction({
  type: "internal",
  names: ["\\def", "\\gdef", "\\edef", "\\xdef"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },

  handler(_ref2) {
    var {
      parser,
      funcName
    } = _ref2;
    var tok = parser.gullet.popToken();
    var name = tok.text;

    if (/^(?:[\\{}$&#^_]|EOF)$/.test(name)) {
      throw new ParseError("Expected a control sequence", tok);
    }

    var numArgs = 0;
    var insert;
    var delimiters = [[]]; // <parameter text> contains no braces

    while (parser.gullet.future().text !== "{") {
      tok = parser.gullet.popToken();

      if (tok.text === "#") {
        // If the very last character of the <parameter text> is #, so that
        // this # is immediately followed by {, TeX will behave as if the {
        // had been inserted at the right end of both the parameter text
        // and the replacement text.
        if (parser.gullet.future().text === "{") {
          insert = parser.gullet.future();
          delimiters[numArgs].push("{");
          break;
        } // A parameter, the first appearance of # must be followed by 1,
        // the next by 2, and so on; up to nine #’s are allowed


        tok = parser.gullet.popToken();

        if (!/^[1-9]$/.test(tok.text)) {
          throw new ParseError("Invalid argument number \"" + tok.text + "\"");
        }

        if (parseInt(tok.text) !== numArgs + 1) {
          throw new ParseError("Argument number \"" + tok.text + "\" out of order");
        }

        numArgs++;
        delimiters.push([]);
      } else if (tok.text === "EOF") {
        throw new ParseError("Expected a macro definition");
      } else {
        delimiters[numArgs].push(tok.text);
      }
    } // replacement text, enclosed in '{' and '}' and properly nested


    var {
      tokens
    } = parser.gullet.consumeArg();

    if (insert) {
      tokens.unshift(insert);
    }

    if (funcName === "\\edef" || funcName === "\\xdef") {
      tokens = parser.gullet.expandTokens(tokens);
      tokens.reverse(); // to fit in with stack order
    } // Final arg is the expansion of the macro


    parser.gullet.macros.set(name, {
      tokens,
      numArgs,
      delimiters
    }, funcName === globalMap[funcName]);
    return {
      type: "internal",
      mode: parser.mode
    };
  }

}); // <simple assignment> -> <let assignment>
// <let assignment> -> \futurelet<control sequence><token><token>
//     | \let<control sequence><equals><one optional space><token>
// <equals> -> <optional spaces>|<optional spaces>=

defineFunction({
  type: "internal",
  names: ["\\let", "\\\\globallet" // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },

  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    var name = checkControlSequence(parser.gullet.popToken());
    parser.gullet.consumeSpaces();
    var tok = getRHS(parser);
    letCommand(parser, name, tok, funcName === "\\\\globallet");
    return {
      type: "internal",
      mode: parser.mode
    };
  }

}); // ref: https://www.tug.org/TUGboat/tb09-3/tb22bechtolsheim.pdf

defineFunction({
  type: "internal",
  names: ["\\futurelet", "\\\\globalfuture" // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },

  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    var name = checkControlSequence(parser.gullet.popToken());
    var middle = parser.gullet.popToken();
    var tok = parser.gullet.popToken();
    letCommand(parser, name, tok, funcName === "\\\\globalfuture");
    parser.gullet.pushToken(tok);
    parser.gullet.pushToken(middle);
    return {
      type: "internal",
      mode: parser.mode
    };
  }

});

/**
 * This file deals with creating delimiters of various sizes. The TeXbook
 * discusses these routines on page 441-442, in the "Another subroutine sets box
 * x to a specified variable delimiter" paragraph.
 *
 * There are three main routines here. `makeSmallDelim` makes a delimiter in the
 * normal font, but in either text, script, or scriptscript style.
 * `makeLargeDelim` makes a delimiter in textstyle, but in one of the Size1,
 * Size2, Size3, or Size4 fonts. `makeStackedDelim` makes a delimiter out of
 * smaller pieces that are stacked on top of one another.
 *
 * The functions take a parameter `center`, which determines if the delimiter
 * should be centered around the axis.
 *
 * Then, there are three exposed functions. `sizedDelim` makes a delimiter in
 * one of the given sizes. This is used for things like `\bigl`.
 * `customSizedDelim` makes a delimiter with a given total height+depth. It is
 * called in places like `\sqrt`. `leftRightDelim` makes an appropriate
 * delimiter which surrounds an expression of a given height an depth. It is
 * used in `\left` and `\right`.
 */

/**
 * Get the metrics for a given symbol and font, after transformation (i.e.
 * after following replacement from symbols.js)
 */
var getMetrics = function getMetrics(symbol, font, mode) {
  var replace = symbols.math[symbol] && symbols.math[symbol].replace;
  var metrics = getCharacterMetrics(replace || symbol, font, mode);

  if (!metrics) {
    throw new Error("Unsupported symbol " + symbol + " and font size " + font + ".");
  }

  return metrics;
};
/**
 * Puts a delimiter span in a given style, and adds appropriate height, depth,
 * and maxFontSizes.
 */


var styleWrap = function styleWrap(delim, toStyle, options, classes) {
  var newOptions = options.havingBaseStyle(toStyle);
  var span = buildCommon.makeSpan(classes.concat(newOptions.sizingClasses(options)), [delim], options);
  var delimSizeMultiplier = newOptions.sizeMultiplier / options.sizeMultiplier;
  span.height *= delimSizeMultiplier;
  span.depth *= delimSizeMultiplier;
  span.maxFontSize = newOptions.sizeMultiplier;
  return span;
};

var centerSpan = function centerSpan(span, options, style) {
  var newOptions = options.havingBaseStyle(style);
  var shift = (1 - options.sizeMultiplier / newOptions.sizeMultiplier) * options.fontMetrics().axisHeight;
  span.classes.push("delimcenter");
  span.style.top = makeEm(shift);
  span.height -= shift;
  span.depth += shift;
};
/**
 * Makes a small delimiter. This is a delimiter that comes in the Main-Regular
 * font, but is restyled to either be in textstyle, scriptstyle, or
 * scriptscriptstyle.
 */


var makeSmallDelim = function makeSmallDelim(delim, style, center, options, mode, classes) {
  var text = buildCommon.makeSymbol(delim, "Main-Regular", mode, options);
  var span = styleWrap(text, style, options, classes);

  if (center) {
    centerSpan(span, options, style);
  }

  return span;
};
/**
 * Builds a symbol in the given font size (note size is an integer)
 */


var mathrmSize = function mathrmSize(value, size, mode, options) {
  return buildCommon.makeSymbol(value, "Size" + size + "-Regular", mode, options);
};
/**
 * Makes a large delimiter. This is a delimiter that comes in the Size1, Size2,
 * Size3, or Size4 fonts. It is always rendered in textstyle.
 */


var makeLargeDelim = function makeLargeDelim(delim, size, center, options, mode, classes) {
  var inner = mathrmSize(delim, size, mode, options);
  var span = styleWrap(buildCommon.makeSpan(["delimsizing", "size" + size], [inner], options), Style$1.TEXT, options, classes);

  if (center) {
    centerSpan(span, options, Style$1.TEXT);
  }

  return span;
};
/**
 * Make a span from a font glyph with the given offset and in the given font.
 * This is used in makeStackedDelim to make the stacking pieces for the delimiter.
 */


var makeGlyphSpan = function makeGlyphSpan(symbol, font, mode) {
  var sizeClass; // Apply the correct CSS class to choose the right font.

  if (font === "Size1-Regular") {
    sizeClass = "delim-size1";
  } else
    /* if (font === "Size4-Regular") */
    {
      sizeClass = "delim-size4";
    }

  var corner = buildCommon.makeSpan(["delimsizinginner", sizeClass], [buildCommon.makeSpan([], [buildCommon.makeSymbol(symbol, font, mode)])]); // Since this will be passed into `makeVList` in the end, wrap the element
  // in the appropriate tag that VList uses.

  return {
    type: "elem",
    elem: corner
  };
};

var makeInner = function makeInner(ch, height, options) {
  // Create a span with inline SVG for the inner part of a tall stacked delimiter.
  var width = fontMetricsData['Size4-Regular'][ch.charCodeAt(0)] ? fontMetricsData['Size4-Regular'][ch.charCodeAt(0)][4] : fontMetricsData['Size1-Regular'][ch.charCodeAt(0)][4];
  var path = new PathNode("inner", innerPath(ch, Math.round(1000 * height)));
  var svgNode = new SvgNode([path], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1000 * width + " " + Math.round(1000 * height),
    "preserveAspectRatio": "xMinYMin"
  });
  var span = buildCommon.makeSvgSpan([], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return {
    type: "elem",
    elem: span
  };
}; // Helpers for makeStackedDelim


var lapInEms = 0.008;
var lap = {
  type: "kern",
  size: -1 * lapInEms
};
var verts = ["|", "\\lvert", "\\rvert", "\\vert"];
var doubleVerts = ["\\|", "\\lVert", "\\rVert", "\\Vert"];
/**
 * Make a stacked delimiter out of a given delimiter, with the total height at
 * least `heightTotal`. This routine is mentioned on page 442 of the TeXbook.
 */

var makeStackedDelim = function makeStackedDelim(delim, heightTotal, center, options, mode, classes) {
  // There are four parts, the top, an optional middle, a repeated part, and a
  // bottom.
  var top;
  var middle;
  var repeat;
  var bottom;
  var svgLabel = "";
  var viewBoxWidth = 0;
  top = repeat = bottom = delim;
  middle = null; // Also keep track of what font the delimiters are in

  var font = "Size1-Regular"; // We set the parts and font based on the symbol. Note that we use
  // '\u23d0' instead of '|' and '\u2016' instead of '\\|' for the
  // repeats of the arrows

  if (delim === "\\uparrow") {
    repeat = bottom = "\u23d0";
  } else if (delim === "\\Uparrow") {
    repeat = bottom = "\u2016";
  } else if (delim === "\\downarrow") {
    top = repeat = "\u23d0";
  } else if (delim === "\\Downarrow") {
    top = repeat = "\u2016";
  } else if (delim === "\\updownarrow") {
    top = "\\uparrow";
    repeat = "\u23d0";
    bottom = "\\downarrow";
  } else if (delim === "\\Updownarrow") {
    top = "\\Uparrow";
    repeat = "\u2016";
    bottom = "\\Downarrow";
  } else if (verts.includes(delim)) {
    repeat = "\u2223";
    svgLabel = "vert";
    viewBoxWidth = 333;
  } else if (doubleVerts.includes(delim)) {
    repeat = "\u2225";
    svgLabel = "doublevert";
    viewBoxWidth = 556;
  } else if (delim === "[" || delim === "\\lbrack") {
    top = "\u23a1";
    repeat = "\u23a2";
    bottom = "\u23a3";
    font = "Size4-Regular";
    svgLabel = "lbrack";
    viewBoxWidth = 667;
  } else if (delim === "]" || delim === "\\rbrack") {
    top = "\u23a4";
    repeat = "\u23a5";
    bottom = "\u23a6";
    font = "Size4-Regular";
    svgLabel = "rbrack";
    viewBoxWidth = 667;
  } else if (delim === "\\lfloor" || delim === "\u230a") {
    repeat = top = "\u23a2";
    bottom = "\u23a3";
    font = "Size4-Regular";
    svgLabel = "lfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\lceil" || delim === "\u2308") {
    top = "\u23a1";
    repeat = bottom = "\u23a2";
    font = "Size4-Regular";
    svgLabel = "lceil";
    viewBoxWidth = 667;
  } else if (delim === "\\rfloor" || delim === "\u230b") {
    repeat = top = "\u23a5";
    bottom = "\u23a6";
    font = "Size4-Regular";
    svgLabel = "rfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\rceil" || delim === "\u2309") {
    top = "\u23a4";
    repeat = bottom = "\u23a5";
    font = "Size4-Regular";
    svgLabel = "rceil";
    viewBoxWidth = 667;
  } else if (delim === "(" || delim === "\\lparen") {
    top = "\u239b";
    repeat = "\u239c";
    bottom = "\u239d";
    font = "Size4-Regular";
    svgLabel = "lparen";
    viewBoxWidth = 875;
  } else if (delim === ")" || delim === "\\rparen") {
    top = "\u239e";
    repeat = "\u239f";
    bottom = "\u23a0";
    font = "Size4-Regular";
    svgLabel = "rparen";
    viewBoxWidth = 875;
  } else if (delim === "\\{" || delim === "\\lbrace") {
    top = "\u23a7";
    middle = "\u23a8";
    bottom = "\u23a9";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } else if (delim === "\\}" || delim === "\\rbrace") {
    top = "\u23ab";
    middle = "\u23ac";
    bottom = "\u23ad";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } else if (delim === "\\lgroup" || delim === "\u27ee") {
    top = "\u23a7";
    bottom = "\u23a9";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } else if (delim === "\\rgroup" || delim === "\u27ef") {
    top = "\u23ab";
    bottom = "\u23ad";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } else if (delim === "\\lmoustache" || delim === "\u23b0") {
    top = "\u23a7";
    bottom = "\u23ad";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } else if (delim === "\\rmoustache" || delim === "\u23b1") {
    top = "\u23ab";
    bottom = "\u23a9";
    repeat = "\u23aa";
    font = "Size4-Regular";
  } // Get the metrics of the four sections


  var topMetrics = getMetrics(top, font, mode);
  var topHeightTotal = topMetrics.height + topMetrics.depth;
  var repeatMetrics = getMetrics(repeat, font, mode);
  var repeatHeightTotal = repeatMetrics.height + repeatMetrics.depth;
  var bottomMetrics = getMetrics(bottom, font, mode);
  var bottomHeightTotal = bottomMetrics.height + bottomMetrics.depth;
  var middleHeightTotal = 0;
  var middleFactor = 1;

  if (middle !== null) {
    var middleMetrics = getMetrics(middle, font, mode);
    middleHeightTotal = middleMetrics.height + middleMetrics.depth;
    middleFactor = 2; // repeat symmetrically above and below middle
  } // Calculate the minimal height that the delimiter can have.
  // It is at least the size of the top, bottom, and optional middle combined.


  var minHeight = topHeightTotal + bottomHeightTotal + middleHeightTotal; // Compute the number of copies of the repeat symbol we will need

  var repeatCount = Math.max(0, Math.ceil((heightTotal - minHeight) / (middleFactor * repeatHeightTotal))); // Compute the total height of the delimiter including all the symbols

  var realHeightTotal = minHeight + repeatCount * middleFactor * repeatHeightTotal; // The center of the delimiter is placed at the center of the axis. Note
  // that in this context, "center" means that the delimiter should be
  // centered around the axis in the current style, while normally it is
  // centered around the axis in textstyle.

  var axisHeight = options.fontMetrics().axisHeight;

  if (center) {
    axisHeight *= options.sizeMultiplier;
  } // Calculate the depth


  var depth = realHeightTotal / 2 - axisHeight; // Now, we start building the pieces that will go into the vlist
  // Keep a list of the pieces of the stacked delimiter

  var stack = [];

  if (svgLabel.length > 0) {
    // Instead of stacking glyphs, create a single SVG.
    // This evades browser problems with imprecise positioning of spans.
    var midHeight = realHeightTotal - topHeightTotal - bottomHeightTotal;
    var viewBoxHeight = Math.round(realHeightTotal * 1000);
    var pathStr = tallDelim(svgLabel, Math.round(midHeight * 1000));
    var path = new PathNode(svgLabel, pathStr);
    var width = (viewBoxWidth / 1000).toFixed(3) + "em";
    var height = (viewBoxHeight / 1000).toFixed(3) + "em";
    var svg = new SvgNode([path], {
      "width": width,
      "height": height,
      "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight
    });
    var wrapper = buildCommon.makeSvgSpan([], [svg], options);
    wrapper.height = viewBoxHeight / 1000;
    wrapper.style.width = width;
    wrapper.style.height = height;
    stack.push({
      type: "elem",
      elem: wrapper
    });
  } else {
    // Stack glyphs
    // Start by adding the bottom symbol
    stack.push(makeGlyphSpan(bottom, font, mode));
    stack.push(lap); // overlap

    if (middle === null) {
      // The middle section will be an SVG. Make it an extra 0.016em tall.
      // We'll overlap by 0.008em at top and bottom.
      var innerHeight = realHeightTotal - topHeightTotal - bottomHeightTotal + 2 * lapInEms;
      stack.push(makeInner(repeat, innerHeight, options));
    } else {
      // When there is a middle bit, we need the middle part and two repeated
      // sections
      var _innerHeight = (realHeightTotal - topHeightTotal - bottomHeightTotal - middleHeightTotal) / 2 + 2 * lapInEms;

      stack.push(makeInner(repeat, _innerHeight, options)); // Now insert the middle of the brace.

      stack.push(lap);
      stack.push(makeGlyphSpan(middle, font, mode));
      stack.push(lap);
      stack.push(makeInner(repeat, _innerHeight, options));
    } // Add the top symbol


    stack.push(lap);
    stack.push(makeGlyphSpan(top, font, mode));
  } // Finally, build the vlist


  var newOptions = options.havingBaseStyle(Style$1.TEXT);
  var inner = buildCommon.makeVList({
    positionType: "bottom",
    positionData: depth,
    children: stack
  }, newOptions);
  return styleWrap(buildCommon.makeSpan(["delimsizing", "mult"], [inner], newOptions), Style$1.TEXT, options, classes);
}; // All surds have 0.08em padding above the vinculum inside the SVG.
// That keeps browser span height rounding error from pinching the line.


var vbPad = 80; // padding above the surd, measured inside the viewBox.

var emPad = 0.08; // padding, in ems, measured in the document.

var sqrtSvg = function sqrtSvg(sqrtName, height, viewBoxHeight, extraVinculum, options) {
  var path = sqrtPath(sqrtName, extraVinculum, viewBoxHeight);
  var pathNode = new PathNode(sqrtName, path);
  var svg = new SvgNode([pathNode], {
    // Note: 1000:1 ratio of viewBox to document em width.
    "width": "400em",
    "height": makeEm(height),
    "viewBox": "0 0 400000 " + viewBoxHeight,
    "preserveAspectRatio": "xMinYMin slice"
  });
  return buildCommon.makeSvgSpan(["hide-tail"], [svg], options);
};
/**
 * Make a sqrt image of the given height,
 */


var makeSqrtImage = function makeSqrtImage(height, options) {
  // Define a newOptions that removes the effect of size changes such as \Huge.
  // We don't pick different a height surd for \Huge. For it, we scale up.
  var newOptions = options.havingBaseSizing(); // Pick the desired surd glyph from a sequence of surds.

  var delim = traverseSequence("\\surd", height * newOptions.sizeMultiplier, stackLargeDelimiterSequence, newOptions);
  var sizeMultiplier = newOptions.sizeMultiplier; // default
  // The standard sqrt SVGs each have a 0.04em thick vinculum.
  // If Settings.minRuleThickness is larger than that, we add extraVinculum.

  var extraVinculum = Math.max(0, options.minRuleThickness - options.fontMetrics().sqrtRuleThickness); // Create a span containing an SVG image of a sqrt symbol.

  var span;
  var spanHeight = 0;
  var texHeight = 0;
  var viewBoxHeight = 0;
  var advanceWidth; // We create viewBoxes with 80 units of "padding" above each surd.
  // Then browser rounding error on the parent span height will not
  // encroach on the ink of the vinculum. But that padding is not
  // included in the TeX-like `height` used for calculation of
  // vertical alignment. So texHeight = span.height < span.style.height.

  if (delim.type === "small") {
    // Get an SVG that is derived from glyph U+221A in font KaTeX-Main.
    // 1000 unit normal glyph height.
    viewBoxHeight = 1000 + 1000 * extraVinculum + vbPad;

    if (height < 1.0) {
      sizeMultiplier = 1.0; // mimic a \textfont radical
    } else if (height < 1.4) {
      sizeMultiplier = 0.7; // mimic a \scriptfont radical
    }

    spanHeight = (1.0 + extraVinculum + emPad) / sizeMultiplier;
    texHeight = (1.00 + extraVinculum) / sizeMultiplier;
    span = sqrtSvg("sqrtMain", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.853em";
    advanceWidth = 0.833 / sizeMultiplier; // from the font.
  } else if (delim.type === "large") {
    // These SVGs come from fonts: KaTeX_Size1, _Size2, etc.
    viewBoxHeight = (1000 + vbPad) * sizeToMaxHeight[delim.size];
    texHeight = (sizeToMaxHeight[delim.size] + extraVinculum) / sizeMultiplier;
    spanHeight = (sizeToMaxHeight[delim.size] + extraVinculum + emPad) / sizeMultiplier;
    span = sqrtSvg("sqrtSize" + delim.size, spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "1.02em";
    advanceWidth = 1.0 / sizeMultiplier; // 1.0 from the font.
  } else {
    // Tall sqrt. In TeX, this would be stacked using multiple glyphs.
    // We'll use a single SVG to accomplish the same thing.
    spanHeight = height + extraVinculum + emPad;
    texHeight = height + extraVinculum;
    viewBoxHeight = Math.floor(1000 * height + extraVinculum) + vbPad;
    span = sqrtSvg("sqrtTall", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.742em";
    advanceWidth = 1.056;
  }

  span.height = texHeight;
  span.style.height = makeEm(spanHeight);
  return {
    span,
    advanceWidth,
    // Calculate the actual line width.
    // This actually should depend on the chosen font -- e.g. \boldmath
    // should use the thicker surd symbols from e.g. KaTeX_Main-Bold, and
    // have thicker rules.
    ruleWidth: (options.fontMetrics().sqrtRuleThickness + extraVinculum) * sizeMultiplier
  };
}; // There are three kinds of delimiters, delimiters that stack when they become
// too large


var stackLargeDelimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230a", "\u230b", "\\lceil", "\\rceil", "\u2308", "\u2309", "\\surd"]; // delimiters that always stack

var stackAlwaysDelimiters = ["\\uparrow", "\\downarrow", "\\updownarrow", "\\Uparrow", "\\Downarrow", "\\Updownarrow", "|", "\\|", "\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27ee", "\u27ef", "\\lmoustache", "\\rmoustache", "\u23b0", "\u23b1"]; // and delimiters that never stack

var stackNeverDelimiters = ["<", ">", "\\langle", "\\rangle", "/", "\\backslash", "\\lt", "\\gt"]; // Metrics of the different sizes. Found by looking at TeX's output of
// $\bigl| // \Bigl| \biggl| \Biggl| \showlists$
// Used to create stacked delimiters of appropriate sizes in makeSizedDelim.

var sizeToMaxHeight = [0, 1.2, 1.8, 2.4, 3.0];
/**
 * Used to create a delimiter of a specific size, where `size` is 1, 2, 3, or 4.
 */

var makeSizedDelim = function makeSizedDelim(delim, size, options, mode, classes) {
  // < and > turn into \langle and \rangle in delimiters
  if (delim === "<" || delim === "\\lt" || delim === "\u27e8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27e9") {
    delim = "\\rangle";
  } // Sized delimiters are never centered.


  if (stackLargeDelimiters.includes(delim) || stackNeverDelimiters.includes(delim)) {
    return makeLargeDelim(delim, size, false, options, mode, classes);
  } else if (stackAlwaysDelimiters.includes(delim)) {
    return makeStackedDelim(delim, sizeToMaxHeight[size], false, options, mode, classes);
  } else {
    throw new ParseError("Illegal delimiter: '" + delim + "'");
  }
};
/**
 * There are three different sequences of delimiter sizes that the delimiters
 * follow depending on the kind of delimiter. This is used when creating custom
 * sized delimiters to decide whether to create a small, large, or stacked
 * delimiter.
 *
 * In real TeX, these sequences aren't explicitly defined, but are instead
 * defined inside the font metrics. Since there are only three sequences that
 * are possible for the delimiters that TeX defines, it is easier to just encode
 * them explicitly here.
 */


// Delimiters that never stack try small delimiters and large delimiters only
var stackNeverDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}]; // Delimiters that always stack try the small delimiters first, then stack

var stackAlwaysDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "stack"
}]; // Delimiters that stack when large try the small and then large delimiters, and
// stack afterwards

var stackLargeDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}, {
  type: "stack"
}];
/**
 * Get the font used in a delimiter based on what kind of delimiter it is.
 * TODO(#963) Use more specific font family return type once that is introduced.
 */

var delimTypeToFont = function delimTypeToFont(type) {
  if (type.type === "small") {
    return "Main-Regular";
  } else if (type.type === "large") {
    return "Size" + type.size + "-Regular";
  } else if (type.type === "stack") {
    return "Size4-Regular";
  } else {
    throw new Error("Add support for delim type '" + type.type + "' here.");
  }
};
/**
 * Traverse a sequence of types of delimiters to decide what kind of delimiter
 * should be used to create a delimiter of the given height+depth.
 */


var traverseSequence = function traverseSequence(delim, height, sequence, options) {
  // Here, we choose the index we should start at in the sequences. In smaller
  // sizes (which correspond to larger numbers in style.size) we start earlier
  // in the sequence. Thus, scriptscript starts at index 3-3=0, script starts
  // at index 3-2=1, text starts at 3-1=2, and display starts at min(2,3-0)=2
  var start = Math.min(2, 3 - options.style.size);

  for (var i = start; i < sequence.length; i++) {
    if (sequence[i].type === "stack") {
      // This is always the last delimiter, so we just break the loop now.
      break;
    }

    var metrics = getMetrics(delim, delimTypeToFont(sequence[i]), "math");
    var heightDepth = metrics.height + metrics.depth; // Small delimiters are scaled down versions of the same font, so we
    // account for the style change size.

    if (sequence[i].type === "small") {
      var newOptions = options.havingBaseStyle(sequence[i].style);
      heightDepth *= newOptions.sizeMultiplier;
    } // Check if the delimiter at this size works for the given height.


    if (heightDepth > height) {
      return sequence[i];
    }
  } // If we reached the end of the sequence, return the last sequence element.


  return sequence[sequence.length - 1];
};
/**
 * Make a delimiter of a given height+depth, with optional centering. Here, we
 * traverse the sequences, and create a delimiter that the sequence tells us to.
 */


var makeCustomSizedDelim = function makeCustomSizedDelim(delim, height, center, options, mode, classes) {
  if (delim === "<" || delim === "\\lt" || delim === "\u27e8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27e9") {
    delim = "\\rangle";
  } // Decide what sequence to use


  var sequence;

  if (stackNeverDelimiters.includes(delim)) {
    sequence = stackNeverDelimiterSequence;
  } else if (stackLargeDelimiters.includes(delim)) {
    sequence = stackLargeDelimiterSequence;
  } else {
    sequence = stackAlwaysDelimiterSequence;
  } // Look through the sequence


  var delimType = traverseSequence(delim, height, sequence, options); // Get the delimiter from font glyphs.
  // Depending on the sequence element we decided on, call the
  // appropriate function.

  if (delimType.type === "small") {
    return makeSmallDelim(delim, delimType.style, center, options, mode, classes);
  } else if (delimType.type === "large") {
    return makeLargeDelim(delim, delimType.size, center, options, mode, classes);
  } else
    /* if (delimType.type === "stack") */
    {
      return makeStackedDelim(delim, height, center, options, mode, classes);
    }
};
/**
 * Make a delimiter for use with `\left` and `\right`, given a height and depth
 * of an expression that the delimiters surround.
 */


var makeLeftRightDelim = function makeLeftRightDelim(delim, height, depth, options, mode, classes) {
  // We always center \left/\right delimiters, so the axis is always shifted
  var axisHeight = options.fontMetrics().axisHeight * options.sizeMultiplier; // Taken from TeX source, tex.web, function make_left_right

  var delimiterFactor = 901;
  var delimiterExtend = 5.0 / options.fontMetrics().ptPerEm;
  var maxDistFromAxis = Math.max(height - axisHeight, depth + axisHeight);
  var totalHeight = Math.max( // In real TeX, calculations are done using integral values which are
  // 65536 per pt, or 655360 per em. So, the division here truncates in
  // TeX but doesn't here, producing different results. If we wanted to
  // exactly match TeX's calculation, we could do
  //   Math.floor(655360 * maxDistFromAxis / 500) *
  //    delimiterFactor / 655360
  // (To see the difference, compare
  //    x^{x^{\left(\rule{0.1em}{0.68em}\right)}}
  // in TeX and KaTeX)
  maxDistFromAxis / 500 * delimiterFactor, 2 * maxDistFromAxis - delimiterExtend); // Finally, we defer to `makeCustomSizedDelim` with our calculated total
  // height

  return makeCustomSizedDelim(delim, totalHeight, true, options, mode, classes);
};

var delimiter = {
  sqrtImage: makeSqrtImage,
  sizedDelim: makeSizedDelim,
  sizeToMaxHeight: sizeToMaxHeight,
  customSizedDelim: makeCustomSizedDelim,
  leftRightDelim: makeLeftRightDelim
};

// Extra data needed for the delimiter handler down below
var delimiterSizes = {
  "\\bigl": {
    mclass: "mopen",
    size: 1
  },
  "\\Bigl": {
    mclass: "mopen",
    size: 2
  },
  "\\biggl": {
    mclass: "mopen",
    size: 3
  },
  "\\Biggl": {
    mclass: "mopen",
    size: 4
  },
  "\\bigr": {
    mclass: "mclose",
    size: 1
  },
  "\\Bigr": {
    mclass: "mclose",
    size: 2
  },
  "\\biggr": {
    mclass: "mclose",
    size: 3
  },
  "\\Biggr": {
    mclass: "mclose",
    size: 4
  },
  "\\bigm": {
    mclass: "mrel",
    size: 1
  },
  "\\Bigm": {
    mclass: "mrel",
    size: 2
  },
  "\\biggm": {
    mclass: "mrel",
    size: 3
  },
  "\\Biggm": {
    mclass: "mrel",
    size: 4
  },
  "\\big": {
    mclass: "mord",
    size: 1
  },
  "\\Big": {
    mclass: "mord",
    size: 2
  },
  "\\bigg": {
    mclass: "mord",
    size: 3
  },
  "\\Bigg": {
    mclass: "mord",
    size: 4
  }
};
var delimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230a", "\u230b", "\\lceil", "\\rceil", "\u2308", "\u2309", "<", ">", "\\langle", "\u27e8", "\\rangle", "\u27e9", "\\lt", "\\gt", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27ee", "\u27ef", "\\lmoustache", "\\rmoustache", "\u23b0", "\u23b1", "/", "\\backslash", "|", "\\vert", "\\|", "\\Vert", "\\uparrow", "\\Uparrow", "\\downarrow", "\\Downarrow", "\\updownarrow", "\\Updownarrow", "."];

// Delimiter functions
function checkDelimiter(delim, context) {
  var symDelim = checkSymbolNodeType(delim);

  if (symDelim && delimiters.includes(symDelim.text)) {
    return symDelim;
  } else if (symDelim) {
    throw new ParseError("Invalid delimiter '" + symDelim.text + "' after '" + context.funcName + "'", delim);
  } else {
    throw new ParseError("Invalid delimiter type '" + delim.type + "'", delim);
  }
}

defineFunction({
  type: "delimsizing",
  names: ["\\bigl", "\\Bigl", "\\biggl", "\\Biggl", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr", "\\bigm", "\\Bigm", "\\biggm", "\\Biggm", "\\big", "\\Big", "\\bigg", "\\Bigg"],
  props: {
    numArgs: 1,
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    return {
      type: "delimsizing",
      mode: context.parser.mode,
      size: delimiterSizes[context.funcName].size,
      mclass: delimiterSizes[context.funcName].mclass,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    if (group.delim === ".") {
      // Empty delimiters still count as elements, even though they don't
      // show anything.
      return buildCommon.makeSpan([group.mclass]);
    } // Use delimiter.sizedDelim to generate the delimiter.


    return delimiter.sizedDelim(group.delim, group.size, options, group.mode, [group.mclass]);
  },
  mathmlBuilder: group => {
    var children = [];

    if (group.delim !== ".") {
      children.push(makeText(group.delim, group.mode));
    }

    var node = new mathMLTree.MathNode("mo", children);

    if (group.mclass === "mopen" || group.mclass === "mclose") {
      // Only some of the delimsizing functions act as fences, and they
      // return "mopen" or "mclose" mclass.
      node.setAttribute("fence", "true");
    } else {
      // Explicitly disable fencing if it's not a fence, to override the
      // defaults.
      node.setAttribute("fence", "false");
    }

    node.setAttribute("stretchy", "true");
    var size = makeEm(delimiter.sizeToMaxHeight[group.size]);
    node.setAttribute("minsize", size);
    node.setAttribute("maxsize", size);
    return node;
  }
});

function assertParsed(group) {
  if (!group.body) {
    throw new Error("Bug: The leftright ParseNode wasn't fully parsed.");
  }
}

defineFunction({
  type: "leftright-right",
  names: ["\\right"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    // \left case below triggers parsing of \right in
    //   `const right = parser.parseFunction();`
    // uses this return value.
    var color = context.parser.gullet.macros.get("\\current@color");

    if (color && typeof color !== "string") {
      throw new ParseError("\\current@color set to non-string in \\right");
    }

    return {
      type: "leftright-right",
      mode: context.parser.mode,
      delim: checkDelimiter(args[0], context).text,
      color // undefined if not set via \color

    };
  }
});
defineFunction({
  type: "leftright",
  names: ["\\left"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    var parser = context.parser; // Parse out the implicit body

    ++parser.leftrightDepth; // parseExpression stops before '\\right'

    var body = parser.parseExpression(false);
    --parser.leftrightDepth; // Check the next token

    parser.expect("\\right", false);
    var right = assertNodeType(parser.parseFunction(), "leftright-right");
    return {
      type: "leftright",
      mode: parser.mode,
      body,
      left: delim.text,
      right: right.delim,
      rightColor: right.color
    };
  },
  htmlBuilder: (group, options) => {
    assertParsed(group); // Build the inner expression

    var inner = buildExpression$1(group.body, options, true, ["mopen", "mclose"]);
    var innerHeight = 0;
    var innerDepth = 0;
    var hadMiddle = false; // Calculate its height and depth

    for (var i = 0; i < inner.length; i++) {
      // Property `isMiddle` not defined on `span`. See comment in
      // "middle"'s htmlBuilder.
      // $FlowFixMe
      if (inner[i].isMiddle) {
        hadMiddle = true;
      } else {
        innerHeight = Math.max(inner[i].height, innerHeight);
        innerDepth = Math.max(inner[i].depth, innerDepth);
      }
    } // The size of delimiters is the same, regardless of what style we are
    // in. Thus, to correctly calculate the size of delimiter we need around
    // a group, we scale down the inner size based on the size.


    innerHeight *= options.sizeMultiplier;
    innerDepth *= options.sizeMultiplier;
    var leftDelim;

    if (group.left === ".") {
      // Empty delimiters in \left and \right make null delimiter spaces.
      leftDelim = makeNullDelimiter(options, ["mopen"]);
    } else {
      // Otherwise, use leftRightDelim to generate the correct sized
      // delimiter.
      leftDelim = delimiter.leftRightDelim(group.left, innerHeight, innerDepth, options, group.mode, ["mopen"]);
    } // Add it to the beginning of the expression


    inner.unshift(leftDelim); // Handle middle delimiters

    if (hadMiddle) {
      for (var _i = 1; _i < inner.length; _i++) {
        var middleDelim = inner[_i]; // Property `isMiddle` not defined on `span`. See comment in
        // "middle"'s htmlBuilder.
        // $FlowFixMe

        var isMiddle = middleDelim.isMiddle;

        if (isMiddle) {
          // Apply the options that were active when \middle was called
          inner[_i] = delimiter.leftRightDelim(isMiddle.delim, innerHeight, innerDepth, isMiddle.options, group.mode, []);
        }
      }
    }

    var rightDelim; // Same for the right delimiter, but using color specified by \color

    if (group.right === ".") {
      rightDelim = makeNullDelimiter(options, ["mclose"]);
    } else {
      var colorOptions = group.rightColor ? options.withColor(group.rightColor) : options;
      rightDelim = delimiter.leftRightDelim(group.right, innerHeight, innerDepth, colorOptions, group.mode, ["mclose"]);
    } // Add it to the end of the expression.


    inner.push(rightDelim);
    return buildCommon.makeSpan(["minner"], inner, options);
  },
  mathmlBuilder: (group, options) => {
    assertParsed(group);
    var inner = buildExpression(group.body, options);

    if (group.left !== ".") {
      var leftNode = new mathMLTree.MathNode("mo", [makeText(group.left, group.mode)]);
      leftNode.setAttribute("fence", "true");
      inner.unshift(leftNode);
    }

    if (group.right !== ".") {
      var rightNode = new mathMLTree.MathNode("mo", [makeText(group.right, group.mode)]);
      rightNode.setAttribute("fence", "true");

      if (group.rightColor) {
        rightNode.setAttribute("mathcolor", group.rightColor);
      }

      inner.push(rightNode);
    }

    return makeRow(inner);
  }
});
defineFunction({
  type: "middle",
  names: ["\\middle"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);

    if (!context.parser.leftrightDepth) {
      throw new ParseError("\\middle without preceding \\left", delim);
    }

    return {
      type: "middle",
      mode: context.parser.mode,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    var middleDelim;

    if (group.delim === ".") {
      middleDelim = makeNullDelimiter(options, []);
    } else {
      middleDelim = delimiter.sizedDelim(group.delim, 1, options, group.mode, []);
      var isMiddle = {
        delim: group.delim,
        options
      }; // Property `isMiddle` not defined on `span`. It is only used in
      // this file above.
      // TODO: Fix this violation of the `span` type and possibly rename
      // things since `isMiddle` sounds like a boolean, but is a struct.
      // $FlowFixMe

      middleDelim.isMiddle = isMiddle;
    }

    return middleDelim;
  },
  mathmlBuilder: (group, options) => {
    // A Firefox \middle will stretch a character vertically only if it
    // is in the fence part of the operator dictionary at:
    // https://www.w3.org/TR/MathML3/appendixc.html.
    // So we need to avoid U+2223 and use plain "|" instead.
    var textNode = group.delim === "\\vert" || group.delim === "|" ? makeText("|", "text") : makeText(group.delim, group.mode);
    var middleNode = new mathMLTree.MathNode("mo", [textNode]);
    middleNode.setAttribute("fence", "true"); // MathML gives 5/18em spacing to each <mo> element.
    // \middle should get delimiter spacing instead.

    middleNode.setAttribute("lspace", "0.05em");
    middleNode.setAttribute("rspace", "0.05em");
    return middleNode;
  }
});

var htmlBuilder$7 = (group, options) => {
  // \cancel, \bcancel, \xcancel, \sout, \fbox, \colorbox, \fcolorbox, \phase
  // Some groups can return document fragments.  Handle those by wrapping
  // them in a span.
  var inner = buildCommon.wrapFragment(buildGroup$1(group.body, options), options);
  var label = group.label.slice(1);
  var scale = options.sizeMultiplier;
  var img;
  var imgShift = 0; // In the LaTeX cancel package, line geometry is slightly different
  // depending on whether the subject is wider than it is tall, or vice versa.
  // We don't know the width of a group, so as a proxy, we test if
  // the subject is a single character. This captures most of the
  // subjects that should get the "tall" treatment.

  var isSingleChar = utils.isCharacterBox(group.body);

  if (label === "sout") {
    img = buildCommon.makeSpan(["stretchy", "sout"]);
    img.height = options.fontMetrics().defaultRuleThickness / scale;
    imgShift = -0.5 * options.fontMetrics().xHeight;
  } else if (label === "phase") {
    // Set a couple of dimensions from the steinmetz package.
    var lineWeight = calculateSize({
      number: 0.6,
      unit: "pt"
    }, options);
    var clearance = calculateSize({
      number: 0.35,
      unit: "ex"
    }, options); // Prevent size changes like \Huge from affecting line thickness

    var newOptions = options.havingBaseSizing();
    scale = scale / newOptions.sizeMultiplier;
    var angleHeight = inner.height + inner.depth + lineWeight + clearance; // Reserve a left pad for the angle.

    inner.style.paddingLeft = makeEm(angleHeight / 2 + lineWeight); // Create an SVG

    var viewBoxHeight = Math.floor(1000 * angleHeight * scale);
    var path = phasePath(viewBoxHeight);
    var svgNode = new SvgNode([new PathNode("phase", path)], {
      "width": "400em",
      "height": makeEm(viewBoxHeight / 1000),
      "viewBox": "0 0 400000 " + viewBoxHeight,
      "preserveAspectRatio": "xMinYMin slice"
    }); // Wrap it in a span with overflow: hidden.

    img = buildCommon.makeSvgSpan(["hide-tail"], [svgNode], options);
    img.style.height = makeEm(angleHeight);
    imgShift = inner.depth + lineWeight + clearance;
  } else {
    // Add horizontal padding
    if (/cancel/.test(label)) {
      if (!isSingleChar) {
        inner.classes.push("cancel-pad");
      }
    } else if (label === "angl") {
      inner.classes.push("anglpad");
    } else {
      inner.classes.push("boxpad");
    } // Add vertical padding


    var topPad = 0;
    var bottomPad = 0;
    var ruleThickness = 0; // ref: cancel package: \advance\totalheight2\p@ % "+2"

    if (/box/.test(label)) {
      ruleThickness = Math.max(options.fontMetrics().fboxrule, // default
      options.minRuleThickness // User override.
      );
      topPad = options.fontMetrics().fboxsep + (label === "colorbox" ? 0 : ruleThickness);
      bottomPad = topPad;
    } else if (label === "angl") {
      ruleThickness = Math.max(options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
      topPad = 4 * ruleThickness; // gap = 3 × line, plus the line itself.

      bottomPad = Math.max(0, 0.25 - inner.depth);
    } else {
      topPad = isSingleChar ? 0.2 : 0;
      bottomPad = topPad;
    }

    img = stretchy.encloseSpan(inner, label, topPad, bottomPad, options);

    if (/fbox|boxed|fcolorbox/.test(label)) {
      img.style.borderStyle = "solid";
      img.style.borderWidth = makeEm(ruleThickness);
    } else if (label === "angl" && ruleThickness !== 0.049) {
      img.style.borderTopWidth = makeEm(ruleThickness);
      img.style.borderRightWidth = makeEm(ruleThickness);
    }

    imgShift = inner.depth + bottomPad;

    if (group.backgroundColor) {
      img.style.backgroundColor = group.backgroundColor;

      if (group.borderColor) {
        img.style.borderColor = group.borderColor;
      }
    }
  }

  var vlist;

  if (group.backgroundColor) {
    vlist = buildCommon.makeVList({
      positionType: "individualShift",
      children: [// Put the color background behind inner;
      {
        type: "elem",
        elem: img,
        shift: imgShift
      }, {
        type: "elem",
        elem: inner,
        shift: 0
      }]
    }, options);
  } else {
    var classes = /cancel|phase/.test(label) ? ["svg-align"] : [];
    vlist = buildCommon.makeVList({
      positionType: "individualShift",
      children: [// Write the \cancel stroke on top of inner.
      {
        type: "elem",
        elem: inner,
        shift: 0
      }, {
        type: "elem",
        elem: img,
        shift: imgShift,
        wrapperClasses: classes
      }]
    }, options);
  }

  if (/cancel/.test(label)) {
    // The cancel package documentation says that cancel lines add their height
    // to the expression, but tests show that isn't how it actually works.
    vlist.height = inner.height;
    vlist.depth = inner.depth;
  }

  if (/cancel/.test(label) && !isSingleChar) {
    // cancel does not create horiz space for its line extension.
    return buildCommon.makeSpan(["mord", "cancel-lap"], [vlist], options);
  } else {
    return buildCommon.makeSpan(["mord"], [vlist], options);
  }
};

var mathmlBuilder$6 = (group, options) => {
  var fboxsep = 0;
  var node = new mathMLTree.MathNode(group.label.indexOf("colorbox") > -1 ? "mpadded" : "menclose", [buildGroup(group.body, options)]);

  switch (group.label) {
    case "\\cancel":
      node.setAttribute("notation", "updiagonalstrike");
      break;

    case "\\bcancel":
      node.setAttribute("notation", "downdiagonalstrike");
      break;

    case "\\phase":
      node.setAttribute("notation", "phasorangle");
      break;

    case "\\sout":
      node.setAttribute("notation", "horizontalstrike");
      break;

    case "\\fbox":
      node.setAttribute("notation", "box");
      break;

    case "\\angl":
      node.setAttribute("notation", "actuarial");
      break;

    case "\\fcolorbox":
    case "\\colorbox":
      // <menclose> doesn't have a good notation option. So use <mpadded>
      // instead. Set some attributes that come included with <menclose>.
      fboxsep = options.fontMetrics().fboxsep * options.fontMetrics().ptPerEm;
      node.setAttribute("width", "+" + 2 * fboxsep + "pt");
      node.setAttribute("height", "+" + 2 * fboxsep + "pt");
      node.setAttribute("lspace", fboxsep + "pt"); //

      node.setAttribute("voffset", fboxsep + "pt");

      if (group.label === "\\fcolorbox") {
        var thk = Math.max(options.fontMetrics().fboxrule, // default
        options.minRuleThickness // user override
        );
        node.setAttribute("style", "border: " + thk + "em solid " + String(group.borderColor));
      }

      break;

    case "\\xcancel":
      node.setAttribute("notation", "updiagonalstrike downdiagonalstrike");
      break;
  }

  if (group.backgroundColor) {
    node.setAttribute("mathbackground", group.backgroundColor);
  }

  return node;
};

defineFunction({
  type: "enclose",
  names: ["\\colorbox"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "text"]
  },

  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor: color,
      body
    };
  },

  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fcolorbox"],
  props: {
    numArgs: 3,
    allowedInText: true,
    argTypes: ["color", "color", "text"]
  },

  handler(_ref2, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref2;
    var borderColor = assertNodeType(args[0], "color-token").color;
    var backgroundColor = assertNodeType(args[1], "color-token").color;
    var body = args[2];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor,
      borderColor,
      body
    };
  },

  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fbox"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: true
  },

  handler(_ref3, args) {
    var {
      parser
    } = _ref3;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\fbox",
      body: args[0]
    };
  }

});
defineFunction({
  type: "enclose",
  names: ["\\cancel", "\\bcancel", "\\xcancel", "\\sout", "\\phase"],
  props: {
    numArgs: 1
  },

  handler(_ref4, args) {
    var {
      parser,
      funcName
    } = _ref4;
    var body = args[0];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      body
    };
  },

  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\angl"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: false
  },

  handler(_ref5, args) {
    var {
      parser
    } = _ref5;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\angl",
      body: args[0]
    };
  }

});

/**
 * All registered environments.
 * `environments.js` exports this same dictionary again and makes it public.
 * `Parser.js` requires this dictionary via `environments.js`.
 */
var _environments = {};
function defineEnvironment(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder,
    mathmlBuilder
  } = _ref;
  // Set default values of environments.
  var data = {
    type,
    numArgs: props.numArgs || 0,
    allowedInText: false,
    numOptionalArgs: 0,
    handler
  };

  for (var i = 0; i < names.length; ++i) {
    // TODO: The value type of _environments should be a type union of all
    // possible `EnvSpec<>` possibilities instead of `EnvSpec<*>`, which is
    // an existential type.
    _environments[names[i]] = data;
  }

  if (htmlBuilder) {
    _htmlGroupBuilders[type] = htmlBuilder;
  }

  if (mathmlBuilder) {
    _mathmlGroupBuilders[type] = mathmlBuilder;
  }
}

/**
 * All registered global/built-in macros.
 * `macros.js` exports this same dictionary again and makes it public.
 * `Parser.js` requires this dictionary via `macros.js`.
 */
var _macros = {}; // This function might one day accept an additional argument and do more things.

function defineMacro(name, body) {
  _macros[name] = body;
}

// Helper functions
function getHLines(parser) {
  // Return an array. The array length = number of hlines.
  // Each element in the array tells if the line is dashed.
  var hlineInfo = [];
  parser.consumeSpaces();
  var nxt = parser.fetch().text;

  if (nxt === "\\relax") {
    // \relax is an artifact of the \cr macro below
    parser.consume();
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }

  while (nxt === "\\hline" || nxt === "\\hdashline") {
    parser.consume();
    hlineInfo.push(nxt === "\\hdashline");
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }

  return hlineInfo;
}

var validateAmsEnvironmentContext = context => {
  var settings = context.parser.settings;

  if (!settings.displayMode) {
    throw new ParseError("{" + context.envName + "} can be used only in" + " display mode.");
  }
}; // autoTag (an argument to parseArray) can be one of three values:
// * undefined: Regular (not-top-level) array; no tags on each row
// * true: Automatic equation numbering, overridable by \tag
// * false: Tags allowed on each row, but no automatic numbering
// This function *doesn't* work with the "split" environment name.


function getAutoTag(name) {
  if (name.indexOf("ed") === -1) {
    return name.indexOf("*") === -1;
  } // return undefined;

}
/**
 * Parse the body of the environment, with rows delimited by \\ and
 * columns delimited by &, and create a nested list in row-major order
 * with one group per cell.  If given an optional argument style
 * ("text", "display", etc.), then each cell is cast into that style.
 */


function parseArray(parser, _ref, style) {
  var {
    hskipBeforeAndAfter,
    addJot,
    cols,
    arraystretch,
    colSeparationType,
    autoTag,
    singleRow,
    emptySingleRow,
    maxNumCols,
    leqno
  } = _ref;
  parser.gullet.beginGroup();

  if (!singleRow) {
    // \cr is equivalent to \\ without the optional size argument (see below)
    // TODO: provide helpful error when \cr is used outside array environment
    parser.gullet.macros.set("\\cr", "\\\\\\relax");
  } // Get current arraystretch if it's not set by the environment


  if (!arraystretch) {
    var stretch = parser.gullet.expandMacroAsText("\\arraystretch");

    if (stretch == null) {
      // Default \arraystretch from lttab.dtx
      arraystretch = 1;
    } else {
      arraystretch = parseFloat(stretch);

      if (!arraystretch || arraystretch < 0) {
        throw new ParseError("Invalid \\arraystretch: " + stretch);
      }
    }
  } // Start group for first cell


  parser.gullet.beginGroup();
  var row = [];
  var body = [row];
  var rowGaps = [];
  var hLinesBeforeRow = [];
  var tags = autoTag != null ? [] : undefined; // amsmath uses \global\@eqnswtrue and \global\@eqnswfalse to represent
  // whether this row should have an equation number.  Simulate this with
  // a \@eqnsw macro set to 1 or 0.

  function beginRow() {
    if (autoTag) {
      parser.gullet.macros.set("\\@eqnsw", "1", true);
    }
  }

  function endRow() {
    if (tags) {
      if (parser.gullet.macros.get("\\df@tag")) {
        tags.push(parser.subparse([new Token("\\df@tag")]));
        parser.gullet.macros.set("\\df@tag", undefined, true);
      } else {
        tags.push(Boolean(autoTag) && parser.gullet.macros.get("\\@eqnsw") === "1");
      }
    }
  }

  beginRow(); // Test for \hline at the top of the array.

  hLinesBeforeRow.push(getHLines(parser));

  while (true) {
    // eslint-disable-line no-constant-condition
    // Parse each cell in its own group (namespace)
    var cell = parser.parseExpression(false, singleRow ? "\\end" : "\\\\");
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    cell = {
      type: "ordgroup",
      mode: parser.mode,
      body: cell
    };

    if (style) {
      cell = {
        type: "styling",
        mode: parser.mode,
        style,
        body: [cell]
      };
    }

    row.push(cell);
    var next = parser.fetch().text;

    if (next === "&") {
      if (maxNumCols && row.length === maxNumCols) {
        if (singleRow || colSeparationType) {
          // {equation} or {split}
          throw new ParseError("Too many tab characters: &", parser.nextToken);
        } else {
          // {array} environment
          parser.settings.reportNonstrict("textEnv", "Too few columns " + "specified in the {array} column argument.");
        }
      }

      parser.consume();
    } else if (next === "\\end") {
      endRow(); // Arrays terminate newlines with `\crcr` which consumes a `\cr` if
      // the last line is empty.  However, AMS environments keep the
      // empty row if it's the only one.
      // NOTE: Currently, `cell` is the last item added into `row`.

      if (row.length === 1 && cell.type === "styling" && cell.body[0].body.length === 0 && (body.length > 1 || !emptySingleRow)) {
        body.pop();
      }

      if (hLinesBeforeRow.length < body.length + 1) {
        hLinesBeforeRow.push([]);
      }

      break;
    } else if (next === "\\\\") {
      parser.consume();
      var size = void 0; // \def\Let@{\let\\\math@cr}
      // \def\math@cr{...\math@cr@}
      // \def\math@cr@{\new@ifnextchar[\math@cr@@{\math@cr@@[\z@]}}
      // \def\math@cr@@[#1]{...\math@cr@@@...}
      // \def\math@cr@@@{\cr}

      if (parser.gullet.future().text !== " ") {
        size = parser.parseSizeGroup(true);
      }

      rowGaps.push(size ? size.value : null);
      endRow(); // check for \hline(s) following the row separator

      hLinesBeforeRow.push(getHLines(parser));
      row = [];
      body.push(row);
      beginRow();
    } else {
      throw new ParseError("Expected & or \\\\ or \\cr or \\end", parser.nextToken);
    }
  } // End cell group


  parser.gullet.endGroup(); // End array group defining \cr

  parser.gullet.endGroup();
  return {
    type: "array",
    mode: parser.mode,
    addJot,
    arraystretch,
    body,
    cols,
    rowGaps,
    hskipBeforeAndAfter,
    hLinesBeforeRow,
    colSeparationType,
    tags,
    leqno
  };
} // Decides on a style for cells in an array according to whether the given
// environment name starts with the letter 'd'.


function dCellStyle(envName) {
  if (envName.slice(0, 1) === "d") {
    return "display";
  } else {
    return "text";
  }
}

var htmlBuilder$6 = function htmlBuilder(group, options) {
  var r;
  var c;
  var nr = group.body.length;
  var hLinesBeforeRow = group.hLinesBeforeRow;
  var nc = 0;
  var body = new Array(nr);
  var hlines = [];
  var ruleThickness = Math.max( // From LaTeX \showthe\arrayrulewidth. Equals 0.04 em.
  options.fontMetrics().arrayRuleWidth, options.minRuleThickness // User override.
  ); // Horizontal spacing

  var pt = 1 / options.fontMetrics().ptPerEm;
  var arraycolsep = 5 * pt; // default value, i.e. \arraycolsep in article.cls

  if (group.colSeparationType && group.colSeparationType === "small") {
    // We're in a {smallmatrix}. Default column space is \thickspace,
    // i.e. 5/18em = 0.2778em, per amsmath.dtx for {smallmatrix}.
    // But that needs adjustment because LaTeX applies \scriptstyle to the
    // entire array, including the colspace, but this function applies
    // \scriptstyle only inside each element.
    var localMultiplier = options.havingStyle(Style$1.SCRIPT).sizeMultiplier;
    arraycolsep = 0.2778 * (localMultiplier / options.sizeMultiplier);
  } // Vertical spacing


  var baselineskip = group.colSeparationType === "CD" ? calculateSize({
    number: 3,
    unit: "ex"
  }, options) : 12 * pt; // see size10.clo
  // Default \jot from ltmath.dtx
  // TODO(edemaine): allow overriding \jot via \setlength (#687)

  var jot = 3 * pt;
  var arrayskip = group.arraystretch * baselineskip;
  var arstrutHeight = 0.7 * arrayskip; // \strutbox in ltfsstrc.dtx and

  var arstrutDepth = 0.3 * arrayskip; // \@arstrutbox in lttab.dtx

  var totalHeight = 0; // Set a position for \hline(s) at the top of the array, if any.

  function setHLinePos(hlinesInGap) {
    for (var i = 0; i < hlinesInGap.length; ++i) {
      if (i > 0) {
        totalHeight += 0.25;
      }

      hlines.push({
        pos: totalHeight,
        isDashed: hlinesInGap[i]
      });
    }
  }

  setHLinePos(hLinesBeforeRow[0]);

  for (r = 0; r < group.body.length; ++r) {
    var inrow = group.body[r];
    var height = arstrutHeight; // \@array adds an \@arstrut

    var depth = arstrutDepth; // to each tow (via the template)

    if (nc < inrow.length) {
      nc = inrow.length;
    }

    var outrow = new Array(inrow.length);

    for (c = 0; c < inrow.length; ++c) {
      var elt = buildGroup$1(inrow[c], options);

      if (depth < elt.depth) {
        depth = elt.depth;
      }

      if (height < elt.height) {
        height = elt.height;
      }

      outrow[c] = elt;
    }

    var rowGap = group.rowGaps[r];
    var gap = 0;

    if (rowGap) {
      gap = calculateSize(rowGap, options);

      if (gap > 0) {
        // \@argarraycr
        gap += arstrutDepth;

        if (depth < gap) {
          depth = gap; // \@xargarraycr
        }

        gap = 0;
      }
    } // In AMS multiline environments such as aligned and gathered, rows
    // correspond to lines that have additional \jot added to the
    // \baselineskip via \openup.


    if (group.addJot) {
      depth += jot;
    }

    outrow.height = height;
    outrow.depth = depth;
    totalHeight += height;
    outrow.pos = totalHeight;
    totalHeight += depth + gap; // \@yargarraycr

    body[r] = outrow; // Set a position for \hline(s), if any.

    setHLinePos(hLinesBeforeRow[r + 1]);
  }

  var offset = totalHeight / 2 + options.fontMetrics().axisHeight;
  var colDescriptions = group.cols || [];
  var cols = [];
  var colSep;
  var colDescrNum;
  var tagSpans = [];

  if (group.tags && group.tags.some(tag => tag)) {
    // An environment with manual tags and/or automatic equation numbers.
    // Create node(s), the latter of which trigger CSS counter increment.
    for (r = 0; r < nr; ++r) {
      var rw = body[r];
      var shift = rw.pos - offset;
      var tag = group.tags[r];
      var tagSpan = void 0;

      if (tag === true) {
        // automatic numbering
        tagSpan = buildCommon.makeSpan(["eqn-num"], [], options);
      } else if (tag === false) {
        // \nonumber/\notag or starred environment
        tagSpan = buildCommon.makeSpan([], [], options);
      } else {
        // manual \tag
        tagSpan = buildCommon.makeSpan([], buildExpression$1(tag, options, true), options);
      }

      tagSpan.depth = rw.depth;
      tagSpan.height = rw.height;
      tagSpans.push({
        type: "elem",
        elem: tagSpan,
        shift
      });
    }
  }

  for (c = 0, colDescrNum = 0; // Continue while either there are more columns or more column
  // descriptions, so trailing separators don't get lost.
  c < nc || colDescrNum < colDescriptions.length; ++c, ++colDescrNum) {
    var colDescr = colDescriptions[colDescrNum] || {};
    var firstSeparator = true;

    while (colDescr.type === "separator") {
      // If there is more than one separator in a row, add a space
      // between them.
      if (!firstSeparator) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(options.fontMetrics().doubleRuleSep);
        cols.push(colSep);
      }

      if (colDescr.separator === "|" || colDescr.separator === ":") {
        var lineType = colDescr.separator === "|" ? "solid" : "dashed";
        var separator = buildCommon.makeSpan(["vertical-separator"], [], options);
        separator.style.height = makeEm(totalHeight);
        separator.style.borderRightWidth = makeEm(ruleThickness);
        separator.style.borderRightStyle = lineType;
        separator.style.margin = "0 " + makeEm(-ruleThickness / 2);

        var _shift = totalHeight - offset;

        if (_shift) {
          separator.style.verticalAlign = makeEm(-_shift);
        }

        cols.push(separator);
      } else {
        throw new ParseError("Invalid separator type: " + colDescr.separator);
      }

      colDescrNum++;
      colDescr = colDescriptions[colDescrNum] || {};
      firstSeparator = false;
    }

    if (c >= nc) {
      continue;
    }

    var sepwidth = void 0;

    if (c > 0 || group.hskipBeforeAndAfter) {
      sepwidth = utils.deflt(colDescr.pregap, arraycolsep);

      if (sepwidth !== 0) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }

    var col = [];

    for (r = 0; r < nr; ++r) {
      var row = body[r];
      var elem = row[c];

      if (!elem) {
        continue;
      }

      var _shift2 = row.pos - offset;

      elem.depth = row.depth;
      elem.height = row.height;
      col.push({
        type: "elem",
        elem: elem,
        shift: _shift2
      });
    }

    col = buildCommon.makeVList({
      positionType: "individualShift",
      children: col
    }, options);
    col = buildCommon.makeSpan(["col-align-" + (colDescr.align || "c")], [col]);
    cols.push(col);

    if (c < nc - 1 || group.hskipBeforeAndAfter) {
      sepwidth = utils.deflt(colDescr.postgap, arraycolsep);

      if (sepwidth !== 0) {
        colSep = buildCommon.makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }
  }

  body = buildCommon.makeSpan(["mtable"], cols); // Add \hline(s), if any.

  if (hlines.length > 0) {
    var line = buildCommon.makeLineSpan("hline", options, ruleThickness);
    var dashes = buildCommon.makeLineSpan("hdashline", options, ruleThickness);
    var vListElems = [{
      type: "elem",
      elem: body,
      shift: 0
    }];

    while (hlines.length > 0) {
      var hline = hlines.pop();
      var lineShift = hline.pos - offset;

      if (hline.isDashed) {
        vListElems.push({
          type: "elem",
          elem: dashes,
          shift: lineShift
        });
      } else {
        vListElems.push({
          type: "elem",
          elem: line,
          shift: lineShift
        });
      }
    }

    body = buildCommon.makeVList({
      positionType: "individualShift",
      children: vListElems
    }, options);
  }

  if (tagSpans.length === 0) {
    return buildCommon.makeSpan(["mord"], [body], options);
  } else {
    var eqnNumCol = buildCommon.makeVList({
      positionType: "individualShift",
      children: tagSpans
    }, options);
    eqnNumCol = buildCommon.makeSpan(["tag"], [eqnNumCol], options);
    return buildCommon.makeFragment([body, eqnNumCol]);
  }
};

var alignMap = {
  c: "center ",
  l: "left ",
  r: "right "
};

var mathmlBuilder$5 = function mathmlBuilder(group, options) {
  var tbl = [];
  var glue = new mathMLTree.MathNode("mtd", [], ["mtr-glue"]);
  var tag = new mathMLTree.MathNode("mtd", [], ["mml-eqn-num"]);

  for (var i = 0; i < group.body.length; i++) {
    var rw = group.body[i];
    var row = [];

    for (var j = 0; j < rw.length; j++) {
      row.push(new mathMLTree.MathNode("mtd", [buildGroup(rw[j], options)]));
    }

    if (group.tags && group.tags[i]) {
      row.unshift(glue);
      row.push(glue);

      if (group.leqno) {
        row.unshift(tag);
      } else {
        row.push(tag);
      }
    }

    tbl.push(new mathMLTree.MathNode("mtr", row));
  }

  var table = new mathMLTree.MathNode("mtable", tbl); // Set column alignment, row spacing, column spacing, and
  // array lines by setting attributes on the table element.
  // Set the row spacing. In MathML, we specify a gap distance.
  // We do not use rowGap[] because MathML automatically increases
  // cell height with the height/depth of the element content.
  // LaTeX \arraystretch multiplies the row baseline-to-baseline distance.
  // We simulate this by adding (arraystretch - 1)em to the gap. This
  // does a reasonable job of adjusting arrays containing 1 em tall content.
  // The 0.16 and 0.09 values are found empirically. They produce an array
  // similar to LaTeX and in which content does not interfere with \hlines.

  var gap = group.arraystretch === 0.5 ? 0.1 // {smallmatrix}, {subarray}
  : 0.16 + group.arraystretch - 1 + (group.addJot ? 0.09 : 0);
  table.setAttribute("rowspacing", makeEm(gap)); // MathML table lines go only between cells.
  // To place a line on an edge we'll use <menclose>, if necessary.

  var menclose = "";
  var align = "";

  if (group.cols && group.cols.length > 0) {
    // Find column alignment, column spacing, and  vertical lines.
    var cols = group.cols;
    var columnLines = "";
    var prevTypeWasAlign = false;
    var iStart = 0;
    var iEnd = cols.length;

    if (cols[0].type === "separator") {
      menclose += "top ";
      iStart = 1;
    }

    if (cols[cols.length - 1].type === "separator") {
      menclose += "bottom ";
      iEnd -= 1;
    }

    for (var _i = iStart; _i < iEnd; _i++) {
      if (cols[_i].type === "align") {
        align += alignMap[cols[_i].align];

        if (prevTypeWasAlign) {
          columnLines += "none ";
        }

        prevTypeWasAlign = true;
      } else if (cols[_i].type === "separator") {
        // MathML accepts only single lines between cells.
        // So we read only the first of consecutive separators.
        if (prevTypeWasAlign) {
          columnLines += cols[_i].separator === "|" ? "solid " : "dashed ";
          prevTypeWasAlign = false;
        }
      }
    }

    table.setAttribute("columnalign", align.trim());

    if (/[sd]/.test(columnLines)) {
      table.setAttribute("columnlines", columnLines.trim());
    }
  } // Set column spacing.


  if (group.colSeparationType === "align") {
    var _cols = group.cols || [];

    var spacing = "";

    for (var _i2 = 1; _i2 < _cols.length; _i2++) {
      spacing += _i2 % 2 ? "0em " : "1em ";
    }

    table.setAttribute("columnspacing", spacing.trim());
  } else if (group.colSeparationType === "alignat" || group.colSeparationType === "gather") {
    table.setAttribute("columnspacing", "0em");
  } else if (group.colSeparationType === "small") {
    table.setAttribute("columnspacing", "0.2778em");
  } else if (group.colSeparationType === "CD") {
    table.setAttribute("columnspacing", "0.5em");
  } else {
    table.setAttribute("columnspacing", "1em");
  } // Address \hline and \hdashline


  var rowLines = "";
  var hlines = group.hLinesBeforeRow;
  menclose += hlines[0].length > 0 ? "left " : "";
  menclose += hlines[hlines.length - 1].length > 0 ? "right " : "";

  for (var _i3 = 1; _i3 < hlines.length - 1; _i3++) {
    rowLines += hlines[_i3].length === 0 ? "none " // MathML accepts only a single line between rows. Read one element.
    : hlines[_i3][0] ? "dashed " : "solid ";
  }

  if (/[sd]/.test(rowLines)) {
    table.setAttribute("rowlines", rowLines.trim());
  }

  if (menclose !== "") {
    table = new mathMLTree.MathNode("menclose", [table]);
    table.setAttribute("notation", menclose.trim());
  }

  if (group.arraystretch && group.arraystretch < 1) {
    // A small array. Wrap in scriptstyle so row gap is not too large.
    table = new mathMLTree.MathNode("mstyle", [table]);
    table.setAttribute("scriptlevel", "1");
  }

  return table;
}; // Convenience function for align, align*, aligned, alignat, alignat*, alignedat.


var alignedHandler = function alignedHandler(context, args) {
  if (context.envName.indexOf("ed") === -1) {
    validateAmsEnvironmentContext(context);
  }

  var cols = [];
  var separationType = context.envName.indexOf("at") > -1 ? "alignat" : "align";
  var isSplit = context.envName === "split";
  var res = parseArray(context.parser, {
    cols,
    addJot: true,
    autoTag: isSplit ? undefined : getAutoTag(context.envName),
    emptySingleRow: true,
    colSeparationType: separationType,
    maxNumCols: isSplit ? 2 : undefined,
    leqno: context.parser.settings.leqno
  }, "display"); // Determining number of columns.
  // 1. If the first argument is given, we use it as a number of columns,
  //    and makes sure that each row doesn't exceed that number.
  // 2. Otherwise, just count number of columns = maximum number
  //    of cells in each row ("aligned" mode -- isAligned will be true).
  //
  // At the same time, prepend empty group {} at beginning of every second
  // cell in each row (starting with second cell) so that operators become
  // binary.  This behavior is implemented in amsmath's \start@aligned.

  var numMaths;
  var numCols = 0;
  var emptyGroup = {
    type: "ordgroup",
    mode: context.mode,
    body: []
  };

  if (args[0] && args[0].type === "ordgroup") {
    var arg0 = "";

    for (var i = 0; i < args[0].body.length; i++) {
      var textord = assertNodeType(args[0].body[i], "textord");
      arg0 += textord.text;
    }

    numMaths = Number(arg0);
    numCols = numMaths * 2;
  }

  var isAligned = !numCols;
  res.body.forEach(function (row) {
    for (var _i4 = 1; _i4 < row.length; _i4 += 2) {
      // Modify ordgroup node within styling node
      var styling = assertNodeType(row[_i4], "styling");
      var ordgroup = assertNodeType(styling.body[0], "ordgroup");
      ordgroup.body.unshift(emptyGroup);
    }

    if (!isAligned) {
      // Case 1
      var curMaths = row.length / 2;

      if (numMaths < curMaths) {
        throw new ParseError("Too many math in a row: " + ("expected " + numMaths + ", but got " + curMaths), row[0]);
      }
    } else if (numCols < row.length) {
      // Case 2
      numCols = row.length;
    }
  }); // Adjusting alignment.
  // In aligned mode, we add one \qquad between columns;
  // otherwise we add nothing.

  for (var _i5 = 0; _i5 < numCols; ++_i5) {
    var align = "r";
    var pregap = 0;

    if (_i5 % 2 === 1) {
      align = "l";
    } else if (_i5 > 0 && isAligned) {
      // "aligned" mode.
      pregap = 1; // add one \quad
    }

    cols[_i5] = {
      type: "align",
      align: align,
      pregap: pregap,
      postgap: 0
    };
  }

  res.colSeparationType = isAligned ? "align" : "alignat";
  return res;
}; // Arrays are part of LaTeX, defined in lttab.dtx so its documentation
// is part of the source2e.pdf file of LaTeX2e source documentation.
// {darray} is an {array} environment where cells are set in \displaystyle,
// as defined in nccmath.sty.


defineEnvironment({
  type: "array",
  names: ["array", "darray"],
  props: {
    numArgs: 1
  },

  handler(context, args) {
    // Since no types are specified above, the two possibilities are
    // - The argument is wrapped in {} or [], in which case Parser's
    //   parseGroup() returns an "ordgroup" wrapping some symbol node.
    // - The argument is a bare symbol node.
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function (nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text;

      if ("lcr".indexOf(ca) !== -1) {
        return {
          type: "align",
          align: ca
        };
      } else if (ca === "|") {
        return {
          type: "separator",
          separator: "|"
        };
      } else if (ca === ":") {
        return {
          type: "separator",
          separator: ":"
        };
      }

      throw new ParseError("Unknown column alignment: " + ca, nde);
    });
    var res = {
      cols,
      hskipBeforeAndAfter: true,
      // \@preamble in lttab.dtx
      maxNumCols: cols.length
    };
    return parseArray(context.parser, res, dCellStyle(context.envName));
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
}); // The matrix environments of amsmath builds on the array environment
// of LaTeX, which is discussed above.
// The mathtools package adds starred versions of the same environments.
// These have an optional argument to choose left|center|right justification.

defineEnvironment({
  type: "array",
  names: ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix*", "pmatrix*", "bmatrix*", "Bmatrix*", "vmatrix*", "Vmatrix*"],
  props: {
    numArgs: 0
  },

  handler(context) {
    var delimiters = {
      "matrix": null,
      "pmatrix": ["(", ")"],
      "bmatrix": ["[", "]"],
      "Bmatrix": ["\\{", "\\}"],
      "vmatrix": ["|", "|"],
      "Vmatrix": ["\\Vert", "\\Vert"]
    }[context.envName.replace("*", "")]; // \hskip -\arraycolsep in amsmath

    var colAlign = "c";
    var payload = {
      hskipBeforeAndAfter: false,
      cols: [{
        type: "align",
        align: colAlign
      }]
    };

    if (context.envName.charAt(context.envName.length - 1) === "*") {
      // It's one of the mathtools starred functions.
      // Parse the optional alignment argument.
      var parser = context.parser;
      parser.consumeSpaces();

      if (parser.fetch().text === "[") {
        parser.consume();
        parser.consumeSpaces();
        colAlign = parser.fetch().text;

        if ("lcr".indexOf(colAlign) === -1) {
          throw new ParseError("Expected l or c or r", parser.nextToken);
        }

        parser.consume();
        parser.consumeSpaces();
        parser.expect("]");
        parser.consume();
        payload.cols = [{
          type: "align",
          align: colAlign
        }];
      }
    }

    var res = parseArray(context.parser, payload, dCellStyle(context.envName)); // Populate cols with the correct number of column alignment specs.

    var numCols = Math.max(0, ...res.body.map(row => row.length));
    res.cols = new Array(numCols).fill({
      type: "align",
      align: colAlign
    });
    return delimiters ? {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: delimiters[0],
      right: delimiters[1],
      rightColor: undefined // \right uninfluenced by \color in array

    } : res;
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["smallmatrix"],
  props: {
    numArgs: 0
  },

  handler(context) {
    var payload = {
      arraystretch: 0.5
    };
    var res = parseArray(context.parser, payload, "script");
    res.colSeparationType = "small";
    return res;
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["subarray"],
  props: {
    numArgs: 1
  },

  handler(context, args) {
    // Parsing of {subarray} is similar to {array}
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function (nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text; // {subarray} only recognizes "l" & "c"

      if ("lc".indexOf(ca) !== -1) {
        return {
          type: "align",
          align: ca
        };
      }

      throw new ParseError("Unknown column alignment: " + ca, nde);
    });

    if (cols.length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }

    var res = {
      cols,
      hskipBeforeAndAfter: false,
      arraystretch: 0.5
    };
    res = parseArray(context.parser, res, "script");

    if (res.body.length > 0 && res.body[0].length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }

    return res;
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
}); // A cases environment (in amsmath.sty) is almost equivalent to
// \def\arraystretch{1.2}%
// \left\{\begin{array}{@{}l@{\quad}l@{}} … \end{array}\right.
// {dcases} is a {cases} environment where cells are set in \displaystyle,
// as defined in mathtools.sty.
// {rcases} is another mathtools environment. It's brace is on the right side.

defineEnvironment({
  type: "array",
  names: ["cases", "dcases", "rcases", "drcases"],
  props: {
    numArgs: 0
  },

  handler(context) {
    var payload = {
      arraystretch: 1.2,
      cols: [{
        type: "align",
        align: "l",
        pregap: 0,
        // TODO(kevinb) get the current style.
        // For now we use the metrics for TEXT style which is what we were
        // doing before.  Before attempting to get the current style we
        // should look at TeX's behavior especially for \over and matrices.
        postgap: 1.0
        /* 1em quad */

      }, {
        type: "align",
        align: "l",
        pregap: 0,
        postgap: 0
      }]
    };
    var res = parseArray(context.parser, payload, dCellStyle(context.envName));
    return {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: context.envName.indexOf("r") > -1 ? "." : "\\{",
      right: context.envName.indexOf("r") > -1 ? "\\}" : ".",
      rightColor: undefined
    };
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
}); // In the align environment, one uses ampersands, &, to specify number of
// columns in each row, and to locate spacing between each column.
// align gets automatic numbering. align* and aligned do not.
// The alignedat environment can be used in math mode.
// Note that we assume \nomallineskiplimit to be zero,
// so that \strut@ is the same as \strut.

defineEnvironment({
  type: "array",
  names: ["align", "align*", "aligned", "split"],
  props: {
    numArgs: 0
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
}); // A gathered environment is like an array environment with one centered
// column, but where rows are considered lines so get \jot line spacing
// and contents are set in \displaystyle.

defineEnvironment({
  type: "array",
  names: ["gathered", "gather", "gather*"],
  props: {
    numArgs: 0
  },

  handler(context) {
    if (["gather", "gather*"].includes(context.envName)) {
      validateAmsEnvironmentContext(context);
    }

    var res = {
      cols: [{
        type: "align",
        align: "c"
      }],
      addJot: true,
      colSeparationType: "gather",
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
}); // alignat environment is like an align environment, but one must explicitly
// specify maximum number of columns in each row, and can adjust spacing between
// each columns.

defineEnvironment({
  type: "array",
  names: ["alignat", "alignat*", "alignedat"],
  props: {
    numArgs: 1
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["equation", "equation*"],
  props: {
    numArgs: 0
  },

  handler(context) {
    validateAmsEnvironmentContext(context);
    var res = {
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      singleRow: true,
      maxNumCols: 1,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["CD"],
  props: {
    numArgs: 0
  },

  handler(context) {
    validateAmsEnvironmentContext(context);
    return parseCD(context.parser);
  },

  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineMacro("\\nonumber", "\\gdef\\@eqnsw{0}");
defineMacro("\\notag", "\\nonumber"); // Catch \hline outside array environment

defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\hline", "\\hdashline"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: true
  },

  handler(context, args) {
    throw new ParseError(context.funcName + " valid only within array environment");
  }

});

var environments = _environments;

// defineEnvironment definitions.

defineFunction({
  type: "environment",
  names: ["\\begin", "\\end"],
  props: {
    numArgs: 1,
    argTypes: ["text"]
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var nameGroup = args[0];

    if (nameGroup.type !== "ordgroup") {
      throw new ParseError("Invalid environment name", nameGroup);
    }

    var envName = "";

    for (var i = 0; i < nameGroup.body.length; ++i) {
      envName += assertNodeType(nameGroup.body[i], "textord").text;
    }

    if (funcName === "\\begin") {
      // begin...end is similar to left...right
      if (!environments.hasOwnProperty(envName)) {
        throw new ParseError("No such environment: " + envName, nameGroup);
      } // Build the environment object. Arguments and other information will
      // be made available to the begin and end methods using properties.


      var env = environments[envName];
      var {
        args: _args,
        optArgs
      } = parser.parseArguments("\\begin{" + envName + "}", env);
      var context = {
        mode: parser.mode,
        envName,
        parser
      };
      var result = env.handler(context, _args, optArgs);
      parser.expect("\\end", false);
      var endNameToken = parser.nextToken;
      var end = assertNodeType(parser.parseFunction(), "environment");

      if (end.name !== envName) {
        throw new ParseError("Mismatch: \\begin{" + envName + "} matched by \\end{" + end.name + "}", endNameToken);
      } // $FlowFixMe, "environment" handler returns an environment ParseNode


      return result;
    }

    return {
      type: "environment",
      mode: parser.mode,
      name: envName,
      nameGroup
    };
  }

});

// TODO(kevinb): implement \\sl and \\sc

var htmlBuilder$5 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup$1(group.body, newOptions);
};

var mathmlBuilder$4 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup(group.body, newOptions);
};

var fontAliases = {
  "\\Bbb": "\\mathbb",
  "\\bold": "\\mathbf",
  "\\frak": "\\mathfrak",
  "\\bm": "\\boldsymbol"
};
defineFunction({
  type: "font",
  names: [// styles, except \boldsymbol defined below
  "\\mathrm", "\\mathit", "\\mathbf", "\\mathnormal", "\\mathsfit", // families
  "\\mathbb", "\\mathcal", "\\mathfrak", "\\mathscr", "\\mathsf", "\\mathtt", // aliases, except \bm defined below
  "\\Bbb", "\\bold", "\\frak"],
  props: {
    numArgs: 1,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = normalizeArgument(args[0]);
    var func = funcName;

    if (func in fontAliases) {
      func = fontAliases[func];
    }

    return {
      type: "font",
      mode: parser.mode,
      font: func.slice(1),
      body
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});
defineFunction({
  type: "mclass",
  names: ["\\boldsymbol", "\\bm"],
  props: {
    numArgs: 1
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    var isCharacterBox = utils.isCharacterBox(body); // amsbsy.sty's \boldsymbol uses \binrel spacing to inherit the
    // argument's bin|rel|ord status

    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(body),
      body: [{
        type: "font",
        mode: parser.mode,
        font: "boldsymbol",
        body
      }],
      isCharacterBox: isCharacterBox
    };
  }
}); // Old font changing functions

defineFunction({
  type: "font",
  names: ["\\rm", "\\sf", "\\tt", "\\bf", "\\it", "\\cal"],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref3, args) => {
    var {
      parser,
      funcName,
      breakOnTokenText
    } = _ref3;
    var {
      mode
    } = parser;
    var body = parser.parseExpression(true, breakOnTokenText);
    var style = "math" + funcName.slice(1);
    return {
      type: "font",
      mode: mode,
      font: style,
      body: {
        type: "ordgroup",
        mode: parser.mode,
        body
      }
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});

var adjustStyle = (size, originalStyle) => {
  // Figure out what style this fraction should be in based on the
  // function used
  var style = originalStyle;

  if (size === "display") {
    // Get display style as a default.
    // If incoming style is sub/sup, use style.text() to get correct size.
    style = style.id >= Style$1.SCRIPT.id ? style.text() : Style$1.DISPLAY;
  } else if (size === "text" && style.size === Style$1.DISPLAY.size) {
    // We're in a \tfrac but incoming style is displaystyle, so:
    style = Style$1.TEXT;
  } else if (size === "script") {
    style = Style$1.SCRIPT;
  } else if (size === "scriptscript") {
    style = Style$1.SCRIPTSCRIPT;
  }

  return style;
};

var htmlBuilder$4 = (group, options) => {
  // Fractions are handled in the TeXbook on pages 444-445, rules 15(a-e).
  var style = adjustStyle(group.size, options.style);
  var nstyle = style.fracNum();
  var dstyle = style.fracDen();
  var newOptions;
  newOptions = options.havingStyle(nstyle);
  var numerm = buildGroup$1(group.numer, newOptions, options);

  if (group.continued) {
    // \cfrac inserts a \strut into the numerator.
    // Get \strut dimensions from TeXbook page 353.
    var hStrut = 8.5 / options.fontMetrics().ptPerEm;
    var dStrut = 3.5 / options.fontMetrics().ptPerEm;
    numerm.height = numerm.height < hStrut ? hStrut : numerm.height;
    numerm.depth = numerm.depth < dStrut ? dStrut : numerm.depth;
  }

  newOptions = options.havingStyle(dstyle);
  var denomm = buildGroup$1(group.denom, newOptions, options);
  var rule;
  var ruleWidth;
  var ruleSpacing;

  if (group.hasBarLine) {
    if (group.barSize) {
      ruleWidth = calculateSize(group.barSize, options);
      rule = buildCommon.makeLineSpan("frac-line", options, ruleWidth);
    } else {
      rule = buildCommon.makeLineSpan("frac-line", options);
    }

    ruleWidth = rule.height;
    ruleSpacing = rule.height;
  } else {
    rule = null;
    ruleWidth = 0;
    ruleSpacing = options.fontMetrics().defaultRuleThickness;
  } // Rule 15b


  var numShift;
  var clearance;
  var denomShift;

  if (style.size === Style$1.DISPLAY.size || group.size === "display") {
    numShift = options.fontMetrics().num1;

    if (ruleWidth > 0) {
      clearance = 3 * ruleSpacing;
    } else {
      clearance = 7 * ruleSpacing;
    }

    denomShift = options.fontMetrics().denom1;
  } else {
    if (ruleWidth > 0) {
      numShift = options.fontMetrics().num2;
      clearance = ruleSpacing;
    } else {
      numShift = options.fontMetrics().num3;
      clearance = 3 * ruleSpacing;
    }

    denomShift = options.fontMetrics().denom2;
  }

  var frac;

  if (!rule) {
    // Rule 15c
    var candidateClearance = numShift - numerm.depth - (denomm.height - denomShift);

    if (candidateClearance < clearance) {
      numShift += 0.5 * (clearance - candidateClearance);
      denomShift += 0.5 * (clearance - candidateClearance);
    }

    frac = buildCommon.makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    }, options);
  } else {
    // Rule 15d
    var axisHeight = options.fontMetrics().axisHeight;

    if (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth) < clearance) {
      numShift += clearance - (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth));
    }

    if (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift) < clearance) {
      denomShift += clearance - (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift));
    }

    var midShift = -(axisHeight - 0.5 * ruleWidth);
    frac = buildCommon.makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: rule,
        shift: midShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    }, options);
  } // Since we manually change the style sometimes (with \dfrac or \tfrac),
  // account for the possible size change here.


  newOptions = options.havingStyle(style);
  frac.height *= newOptions.sizeMultiplier / options.sizeMultiplier;
  frac.depth *= newOptions.sizeMultiplier / options.sizeMultiplier; // Rule 15e

  var delimSize;

  if (style.size === Style$1.DISPLAY.size) {
    delimSize = options.fontMetrics().delim1;
  } else if (style.size === Style$1.SCRIPTSCRIPT.size) {
    delimSize = options.havingStyle(Style$1.SCRIPT).fontMetrics().delim2;
  } else {
    delimSize = options.fontMetrics().delim2;
  }

  var leftDelim;
  var rightDelim;

  if (group.leftDelim == null) {
    leftDelim = makeNullDelimiter(options, ["mopen"]);
  } else {
    leftDelim = delimiter.customSizedDelim(group.leftDelim, delimSize, true, options.havingStyle(style), group.mode, ["mopen"]);
  }

  if (group.continued) {
    rightDelim = buildCommon.makeSpan([]); // zero width for \cfrac
  } else if (group.rightDelim == null) {
    rightDelim = makeNullDelimiter(options, ["mclose"]);
  } else {
    rightDelim = delimiter.customSizedDelim(group.rightDelim, delimSize, true, options.havingStyle(style), group.mode, ["mclose"]);
  }

  return buildCommon.makeSpan(["mord"].concat(newOptions.sizingClasses(options)), [leftDelim, buildCommon.makeSpan(["mfrac"], [frac]), rightDelim], options);
};

var mathmlBuilder$3 = (group, options) => {
  var node = new mathMLTree.MathNode("mfrac", [buildGroup(group.numer, options), buildGroup(group.denom, options)]);

  if (!group.hasBarLine) {
    node.setAttribute("linethickness", "0px");
  } else if (group.barSize) {
    var ruleWidth = calculateSize(group.barSize, options);
    node.setAttribute("linethickness", makeEm(ruleWidth));
  }

  var style = adjustStyle(group.size, options.style);

  if (style.size !== options.style.size) {
    node = new mathMLTree.MathNode("mstyle", [node]);
    var isDisplay = style.size === Style$1.DISPLAY.size ? "true" : "false";
    node.setAttribute("displaystyle", isDisplay);
    node.setAttribute("scriptlevel", "0");
  }

  if (group.leftDelim != null || group.rightDelim != null) {
    var withDelims = [];

    if (group.leftDelim != null) {
      var leftOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.leftDelim.replace("\\", ""))]);
      leftOp.setAttribute("fence", "true");
      withDelims.push(leftOp);
    }

    withDelims.push(node);

    if (group.rightDelim != null) {
      var rightOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.rightDelim.replace("\\", ""))]);
      rightOp.setAttribute("fence", "true");
      withDelims.push(rightOp);
    }

    return makeRow(withDelims);
  }

  return node;
};

defineFunction({
  type: "genfrac",
  names: ["\\dfrac", "\\frac", "\\tfrac", "\\dbinom", "\\binom", "\\tbinom", "\\\\atopfrac", // can’t be entered directly
  "\\\\bracefrac", "\\\\brackfrac" // ditto
  ],
  props: {
    numArgs: 2,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var numer = args[0];
    var denom = args[1];
    var hasBarLine;
    var leftDelim = null;
    var rightDelim = null;
    var size = "auto";

    switch (funcName) {
      case "\\dfrac":
      case "\\frac":
      case "\\tfrac":
        hasBarLine = true;
        break;

      case "\\\\atopfrac":
        hasBarLine = false;
        break;

      case "\\dbinom":
      case "\\binom":
      case "\\tbinom":
        hasBarLine = false;
        leftDelim = "(";
        rightDelim = ")";
        break;

      case "\\\\bracefrac":
        hasBarLine = false;
        leftDelim = "\\{";
        rightDelim = "\\}";
        break;

      case "\\\\brackfrac":
        hasBarLine = false;
        leftDelim = "[";
        rightDelim = "]";
        break;

      default:
        throw new Error("Unrecognized genfrac command");
    }

    switch (funcName) {
      case "\\dfrac":
      case "\\dbinom":
        size = "display";
        break;

      case "\\tfrac":
      case "\\tbinom":
        size = "text";
        break;
    }

    return {
      type: "genfrac",
      mode: parser.mode,
      continued: false,
      numer,
      denom,
      hasBarLine,
      leftDelim,
      rightDelim,
      size,
      barSize: null
    };
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});
defineFunction({
  type: "genfrac",
  names: ["\\cfrac"],
  props: {
    numArgs: 2
  },
  handler: (_ref2, args) => {
    var {
      parser,
      funcName
    } = _ref2;
    var numer = args[0];
    var denom = args[1];
    return {
      type: "genfrac",
      mode: parser.mode,
      continued: true,
      numer,
      denom,
      hasBarLine: true,
      leftDelim: null,
      rightDelim: null,
      size: "display",
      barSize: null
    };
  }
}); // Infix generalized fractions -- these are not rendered directly, but replaced
// immediately by one of the variants above.

defineFunction({
  type: "infix",
  names: ["\\over", "\\choose", "\\atop", "\\brace", "\\brack"],
  props: {
    numArgs: 0,
    infix: true
  },

  handler(_ref3) {
    var {
      parser,
      funcName,
      token
    } = _ref3;
    var replaceWith;

    switch (funcName) {
      case "\\over":
        replaceWith = "\\frac";
        break;

      case "\\choose":
        replaceWith = "\\binom";
        break;

      case "\\atop":
        replaceWith = "\\\\atopfrac";
        break;

      case "\\brace":
        replaceWith = "\\\\bracefrac";
        break;

      case "\\brack":
        replaceWith = "\\\\brackfrac";
        break;

      default:
        throw new Error("Unrecognized infix genfrac command");
    }

    return {
      type: "infix",
      mode: parser.mode,
      replaceWith,
      token
    };
  }

});
var stylArray = ["display", "text", "script", "scriptscript"];

var delimFromValue = function delimFromValue(delimString) {
  var delim = null;

  if (delimString.length > 0) {
    delim = delimString;
    delim = delim === "." ? null : delim;
  }

  return delim;
};

defineFunction({
  type: "genfrac",
  names: ["\\genfrac"],
  props: {
    numArgs: 6,
    allowedInArgument: true,
    argTypes: ["math", "math", "size", "text", "math", "math"]
  },

  handler(_ref4, args) {
    var {
      parser
    } = _ref4;
    var numer = args[4];
    var denom = args[5]; // Look into the parse nodes to get the desired delimiters.

    var leftNode = normalizeArgument(args[0]);
    var leftDelim = leftNode.type === "atom" && leftNode.family === "open" ? delimFromValue(leftNode.text) : null;
    var rightNode = normalizeArgument(args[1]);
    var rightDelim = rightNode.type === "atom" && rightNode.family === "close" ? delimFromValue(rightNode.text) : null;
    var barNode = assertNodeType(args[2], "size");
    var hasBarLine;
    var barSize = null;

    if (barNode.isBlank) {
      // \genfrac acts differently than \above.
      // \genfrac treats an empty size group as a signal to use a
      // standard bar size. \above would see size = 0 and omit the bar.
      hasBarLine = true;
    } else {
      barSize = barNode.value;
      hasBarLine = barSize.number > 0;
    } // Find out if we want displaystyle, textstyle, etc.


    var size = "auto";
    var styl = args[3];

    if (styl.type === "ordgroup") {
      if (styl.body.length > 0) {
        var textOrd = assertNodeType(styl.body[0], "textord");
        size = stylArray[Number(textOrd.text)];
      }
    } else {
      styl = assertNodeType(styl, "textord");
      size = stylArray[Number(styl.text)];
    }

    return {
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim,
      rightDelim,
      size
    };
  },

  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
}); // \above is an infix fraction that also defines a fraction bar size.

defineFunction({
  type: "infix",
  names: ["\\above"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    infix: true
  },

  handler(_ref5, args) {
    var {
      parser,
      funcName,
      token
    } = _ref5;
    return {
      type: "infix",
      mode: parser.mode,
      replaceWith: "\\\\abovefrac",
      size: assertNodeType(args[0], "size").value,
      token
    };
  }

});
defineFunction({
  type: "genfrac",
  names: ["\\\\abovefrac"],
  props: {
    numArgs: 3,
    argTypes: ["math", "size", "math"]
  },
  handler: (_ref6, args) => {
    var {
      parser,
      funcName
    } = _ref6;
    var numer = args[0];
    var barSize = assert(assertNodeType(args[1], "infix").size);
    var denom = args[2];
    var hasBarLine = barSize.number > 0;
    return {
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim: null,
      rightDelim: null,
      size: "auto"
    };
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});

// NOTE: Unlike most `htmlBuilder`s, this one handles not only "horizBrace", but
// also "supsub" since an over/underbrace can affect super/subscripting.
var htmlBuilder$3 = (grp, options) => {
  var style = options.style; // Pull out the `ParseNode<"horizBrace">` if `grp` is a "supsub" node.

  var supSubGroup;
  var group;

  if (grp.type === "supsub") {
    // Ref: LaTeX source2e: }}}}\limits}
    // i.e. LaTeX treats the brace similar to an op and passes it
    // with \limits, so we need to assign supsub style.
    supSubGroup = grp.sup ? buildGroup$1(grp.sup, options.havingStyle(style.sup()), options) : buildGroup$1(grp.sub, options.havingStyle(style.sub()), options);
    group = assertNodeType(grp.base, "horizBrace");
  } else {
    group = assertNodeType(grp, "horizBrace");
  } // Build the base group


  var body = buildGroup$1(group.base, options.havingBaseStyle(Style$1.DISPLAY)); // Create the stretchy element

  var braceBody = stretchy.svgSpan(group, options); // Generate the vlist, with the appropriate kerns        ┏━━━━━━━━┓
  // This first vlist contains the content and the brace:   equation

  var vlist;

  if (group.isOver) {
    vlist = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: braceBody
      }]
    }, options); // $FlowFixMe: Replace this with passing "svg-align" into makeVList.

    vlist.children[0].children[0].children[1].classes.push("svg-align");
  } else {
    vlist = buildCommon.makeVList({
      positionType: "bottom",
      positionData: body.depth + 0.1 + braceBody.height,
      children: [{
        type: "elem",
        elem: braceBody
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: body
      }]
    }, options); // $FlowFixMe: Replace this with passing "svg-align" into makeVList.

    vlist.children[0].children[0].children[0].classes.push("svg-align");
  }

  if (supSubGroup) {
    // To write the supsub, wrap the first vlist in another vlist:
    // They can't all go in the same vlist, because the note might be
    // wider than the equation. We want the equation to control the
    // brace width.
    //      note          long note           long note
    //   ┏━━━━━━━━┓   or    ┏━━━┓     not    ┏━━━━━━━━━┓
    //    equation           eqn                 eqn
    var vSpan = buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);

    if (group.isOver) {
      vlist = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: vSpan
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: supSubGroup
        }]
      }, options);
    } else {
      vlist = buildCommon.makeVList({
        positionType: "bottom",
        positionData: vSpan.depth + 0.2 + supSubGroup.height + supSubGroup.depth,
        children: [{
          type: "elem",
          elem: supSubGroup
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: vSpan
        }]
      }, options);
    }
  }

  return buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);
};

var mathmlBuilder$2 = (group, options) => {
  var accentNode = stretchy.mathMLnode(group.label);
  return new mathMLTree.MathNode(group.isOver ? "mover" : "munder", [buildGroup(group.base, options), accentNode]);
}; // Horizontal stretchy braces


defineFunction({
  type: "horizBrace",
  names: ["\\overbrace", "\\underbrace"],
  props: {
    numArgs: 1
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "horizBrace",
      mode: parser.mode,
      label: funcName,
      isOver: /^\\over/.test(funcName),
      base: args[0]
    };
  },

  htmlBuilder: htmlBuilder$3,
  mathmlBuilder: mathmlBuilder$2
});

defineFunction({
  type: "href",
  names: ["\\href"],
  props: {
    numArgs: 2,
    argTypes: ["url", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[1];
    var href = assertNodeType(args[0], "url").url;

    if (!parser.settings.isTrusted({
      command: "\\href",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\href");
    }

    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    return buildCommon.makeAnchor(group.href, [], elements, options);
  },
  mathmlBuilder: (group, options) => {
    var math = buildExpressionRow(group.body, options);

    if (!(math instanceof MathNode)) {
      math = new MathNode("mrow", [math]);
    }

    math.setAttribute("href", group.href);
    return math;
  }
});
defineFunction({
  type: "href",
  names: ["\\url"],
  props: {
    numArgs: 1,
    argTypes: ["url"],
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var href = assertNodeType(args[0], "url").url;

    if (!parser.settings.isTrusted({
      command: "\\url",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\url");
    }

    var chars = [];

    for (var i = 0; i < href.length; i++) {
      var c = href[i];

      if (c === "~") {
        c = "\\textasciitilde";
      }

      chars.push({
        type: "textord",
        mode: "text",
        text: c
      });
    }

    var body = {
      type: "text",
      mode: parser.mode,
      font: "\\texttt",
      body: chars
    };
    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  }
});

// In LaTeX, \vcenter can act only on a box, as in
// \vcenter{\hbox{$\frac{a+b}{\dfrac{c}{d}}$}}
// This function by itself doesn't do anything but prevent a soft line break.

defineFunction({
  type: "hbox",
  names: ["\\hbox"],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInText: true,
    primitive: true
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "hbox",
      mode: parser.mode,
      body: ordargument(args[0])
    };
  },

  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options, false);
    return buildCommon.makeFragment(elements);
  },

  mathmlBuilder(group, options) {
    return new mathMLTree.MathNode("mrow", buildExpression(group.body, options));
  }

});

defineFunction({
  type: "html",
  names: ["\\htmlClass", "\\htmlId", "\\htmlStyle", "\\htmlData"],
  props: {
    numArgs: 2,
    argTypes: ["raw", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName,
      token
    } = _ref;
    var value = assertNodeType(args[0], "raw").string;
    var body = args[1];

    if (parser.settings.strict) {
      parser.settings.reportNonstrict("htmlExtension", "HTML extension is disabled on strict mode");
    }

    var trustContext;
    var attributes = {};

    switch (funcName) {
      case "\\htmlClass":
        attributes.class = value;
        trustContext = {
          command: "\\htmlClass",
          class: value
        };
        break;

      case "\\htmlId":
        attributes.id = value;
        trustContext = {
          command: "\\htmlId",
          id: value
        };
        break;

      case "\\htmlStyle":
        attributes.style = value;
        trustContext = {
          command: "\\htmlStyle",
          style: value
        };
        break;

      case "\\htmlData":
        {
          var data = value.split(",");

          for (var i = 0; i < data.length; i++) {
            var keyVal = data[i].split("=");

            if (keyVal.length !== 2) {
              throw new ParseError("Error parsing key-value for \\htmlData");
            }

            attributes["data-" + keyVal[0].trim()] = keyVal[1].trim();
          }

          trustContext = {
            command: "\\htmlData",
            attributes
          };
          break;
        }

      default:
        throw new Error("Unrecognized html command");
    }

    if (!parser.settings.isTrusted(trustContext)) {
      return parser.formatUnsupportedCmd(funcName);
    }

    return {
      type: "html",
      mode: parser.mode,
      attributes,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    var classes = ["enclosing"];

    if (group.attributes.class) {
      classes.push(...group.attributes.class.trim().split(/\s+/));
    }

    var span = buildCommon.makeSpan(classes, elements, options);

    for (var attr in group.attributes) {
      if (attr !== "class" && group.attributes.hasOwnProperty(attr)) {
        span.setAttribute(attr, group.attributes[attr]);
      }
    }

    return span;
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.body, options);
  }
});

defineFunction({
  type: "htmlmathml",
  names: ["\\html@mathml"],
  props: {
    numArgs: 2,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "htmlmathml",
      mode: parser.mode,
      html: ordargument(args[0]),
      mathml: ordargument(args[1])
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.html, options, false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.mathml, options);
  }
});

var sizeData = function sizeData(str) {
  if (/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(str)) {
    // str is a number with no unit specified.
    // default unit is bp, per graphix package.
    return {
      number: +str,
      unit: "bp"
    };
  } else {
    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(str);

    if (!match) {
      throw new ParseError("Invalid size: '" + str + "' in \\includegraphics");
    }

    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };

    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "' in \\includegraphics.");
    }

    return data;
  }
};

defineFunction({
  type: "includegraphics",
  names: ["\\includegraphics"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    argTypes: ["raw", "url"],
    allowedInText: false
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var width = {
      number: 0,
      unit: "em"
    };
    var height = {
      number: 0.9,
      unit: "em"
    }; // sorta character sized.

    var totalheight = {
      number: 0,
      unit: "em"
    };
    var alt = "";

    if (optArgs[0]) {
      var attributeStr = assertNodeType(optArgs[0], "raw").string; // Parser.js does not parse key/value pairs. We get a string.

      var attributes = attributeStr.split(",");

      for (var i = 0; i < attributes.length; i++) {
        var keyVal = attributes[i].split("=");

        if (keyVal.length === 2) {
          var str = keyVal[1].trim();

          switch (keyVal[0].trim()) {
            case "alt":
              alt = str;
              break;

            case "width":
              width = sizeData(str);
              break;

            case "height":
              height = sizeData(str);
              break;

            case "totalheight":
              totalheight = sizeData(str);
              break;

            default:
              throw new ParseError("Invalid key: '" + keyVal[0] + "' in \\includegraphics.");
          }
        }
      }
    }

    var src = assertNodeType(args[0], "url").url;

    if (alt === "") {
      // No alt given. Use the file name. Strip away the path.
      alt = src;
      alt = alt.replace(/^.*[\\/]/, '');
      alt = alt.substring(0, alt.lastIndexOf('.'));
    }

    if (!parser.settings.isTrusted({
      command: "\\includegraphics",
      url: src
    })) {
      return parser.formatUnsupportedCmd("\\includegraphics");
    }

    return {
      type: "includegraphics",
      mode: parser.mode,
      alt: alt,
      width: width,
      height: height,
      totalheight: totalheight,
      src: src
    };
  },
  htmlBuilder: (group, options) => {
    var height = calculateSize(group.height, options);
    var depth = 0;

    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
    }

    var width = 0;

    if (group.width.number > 0) {
      width = calculateSize(group.width, options);
    }

    var style = {
      height: makeEm(height + depth)
    };

    if (width > 0) {
      style.width = makeEm(width);
    }

    if (depth > 0) {
      style.verticalAlign = makeEm(-depth);
    }

    var node = new Img(group.src, group.alt, style);
    node.height = height;
    node.depth = depth;
    return node;
  },
  mathmlBuilder: (group, options) => {
    var node = new mathMLTree.MathNode("mglyph", []);
    node.setAttribute("alt", group.alt);
    var height = calculateSize(group.height, options);
    var depth = 0;

    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
      node.setAttribute("valign", makeEm(-depth));
    }

    node.setAttribute("height", makeEm(height + depth));

    if (group.width.number > 0) {
      var width = calculateSize(group.width, options);
      node.setAttribute("width", makeEm(width));
    }

    node.setAttribute("src", group.src);
    return node;
  }
});

// Horizontal spacing commands

defineFunction({
  type: "kern",
  names: ["\\kern", "\\mkern", "\\hskip", "\\mskip"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    primitive: true,
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var size = assertNodeType(args[0], "size");

    if (parser.settings.strict) {
      var mathFunction = funcName[1] === 'm'; // \mkern, \mskip

      var muUnit = size.value.unit === 'mu';

      if (mathFunction) {
        if (!muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " supports only mu units, " + ("not " + size.value.unit + " units"));
        }

        if (parser.mode !== "math") {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " works only in math mode");
        }
      } else {
        // !mathFunction
        if (muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " doesn't support mu units");
        }
      }
    }

    return {
      type: "kern",
      mode: parser.mode,
      dimension: size.value
    };
  },

  htmlBuilder(group, options) {
    return buildCommon.makeGlue(group.dimension, options);
  },

  mathmlBuilder(group, options) {
    var dimension = calculateSize(group.dimension, options);
    return new mathMLTree.SpaceNode(dimension);
  }

});

// Horizontal overlap functions
defineFunction({
  type: "lap",
  names: ["\\mathllap", "\\mathrlap", "\\mathclap"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "lap",
      mode: parser.mode,
      alignment: funcName.slice(5),
      body
    };
  },
  htmlBuilder: (group, options) => {
    // mathllap, mathrlap, mathclap
    var inner;

    if (group.alignment === "clap") {
      // ref: https://www.math.lsu.edu/~aperlis/publications/mathclap/
      inner = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]); // wrap, since CSS will center a .clap > .inner > span

      inner = buildCommon.makeSpan(["inner"], [inner], options);
    } else {
      inner = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options)]);
    }

    var fix = buildCommon.makeSpan(["fix"], []);
    var node = buildCommon.makeSpan([group.alignment], [inner, fix], options); // At this point, we have correctly set horizontal alignment of the
    // two items involved in the lap.
    // Next, use a strut to set the height of the HTML bounding box.
    // Otherwise, a tall argument may be misplaced.
    // This code resolved issue #1153

    var strut = buildCommon.makeSpan(["strut"]);
    strut.style.height = makeEm(node.height + node.depth);

    if (node.depth) {
      strut.style.verticalAlign = makeEm(-node.depth);
    }

    node.children.unshift(strut); // Next, prevent vertical misplacement when next to something tall.
    // This code resolves issue #1234

    node = buildCommon.makeSpan(["thinbox"], [node], options);
    return buildCommon.makeSpan(["mord", "vbox"], [node], options);
  },
  mathmlBuilder: (group, options) => {
    // mathllap, mathrlap, mathclap
    var node = new mathMLTree.MathNode("mpadded", [buildGroup(group.body, options)]);

    if (group.alignment !== "rlap") {
      var offset = group.alignment === "llap" ? "-1" : "-0.5";
      node.setAttribute("lspace", offset + "width");
    }

    node.setAttribute("width", "0px");
    return node;
  }
});

defineFunction({
  type: "styling",
  names: ["\\(", "$"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },

  handler(_ref, args) {
    var {
      funcName,
      parser
    } = _ref;
    var outerMode = parser.mode;
    parser.switchMode("math");
    var close = funcName === "\\(" ? "\\)" : "$";
    var body = parser.parseExpression(false, close);
    parser.expect(close);
    parser.switchMode(outerMode);
    return {
      type: "styling",
      mode: parser.mode,
      style: "text",
      body
    };
  }

}); // Check for extra closing math delimiters

defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\)", "\\]"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },

  handler(context, args) {
    throw new ParseError("Mismatched " + context.funcName);
  }

});

var chooseMathStyle = (group, options) => {
  switch (options.style.size) {
    case Style$1.DISPLAY.size:
      return group.display;

    case Style$1.TEXT.size:
      return group.text;

    case Style$1.SCRIPT.size:
      return group.script;

    case Style$1.SCRIPTSCRIPT.size:
      return group.scriptscript;

    default:
      return group.text;
  }
};

defineFunction({
  type: "mathchoice",
  names: ["\\mathchoice"],
  props: {
    numArgs: 4,
    primitive: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "mathchoice",
      mode: parser.mode,
      display: ordargument(args[0]),
      text: ordargument(args[1]),
      script: ordargument(args[2]),
      scriptscript: ordargument(args[3])
    };
  },
  htmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    var elements = buildExpression$1(body, options, false);
    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    return buildExpressionRow(body, options);
  }
});

var assembleSupSub = (base, supGroup, subGroup, options, style, slant, baseShift) => {
  base = buildCommon.makeSpan([], [base]);
  var subIsSingleCharacter = subGroup && utils.isCharacterBox(subGroup);
  var sub;
  var sup; // We manually have to handle the superscripts and subscripts. This,
  // aside from the kern calculations, is copied from supsub.

  if (supGroup) {
    var elem = buildGroup$1(supGroup, options.havingStyle(style.sup()), options);
    sup = {
      elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing1, options.fontMetrics().bigOpSpacing3 - elem.depth)
    };
  }

  if (subGroup) {
    var _elem = buildGroup$1(subGroup, options.havingStyle(style.sub()), options);

    sub = {
      elem: _elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing2, options.fontMetrics().bigOpSpacing4 - _elem.height)
    };
  } // Build the final group as a vlist of the possible subscript, base,
  // and possible superscript.


  var finalGroup;

  if (sup && sub) {
    var bottom = options.fontMetrics().bigOpSpacing5 + sub.elem.height + sub.elem.depth + sub.kern + base.depth + baseShift;
    finalGroup = buildCommon.makeVList({
      positionType: "bottom",
      positionData: bottom,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub.kern
      }, {
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup.kern
      }, {
        type: "elem",
        elem: sup.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    }, options);
  } else if (sub) {
    var top = base.height - baseShift; // Shift the limits by the slant of the symbol. Note
    // that we are supposed to shift the limits by 1/2 of the slant,
    // but since we are centering the limits adding a full slant of
    // margin will shift by 1/2 that.

    finalGroup = buildCommon.makeVList({
      positionType: "top",
      positionData: top,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub.kern
      }, {
        type: "elem",
        elem: base
      }]
    }, options);
  } else if (sup) {
    var _bottom = base.depth + baseShift;

    finalGroup = buildCommon.makeVList({
      positionType: "bottom",
      positionData: _bottom,
      children: [{
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup.kern
      }, {
        type: "elem",
        elem: sup.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    }, options);
  } else {
    // This case probably shouldn't occur (this would mean the
    // supsub was sending us a group with no superscript or
    // subscript) but be safe.
    return base;
  }

  var parts = [finalGroup];

  if (sub && slant !== 0 && !subIsSingleCharacter) {
    // A negative margin-left was applied to the lower limit.
    // Avoid an overlap by placing a spacer on the left on the group.
    var spacer = buildCommon.makeSpan(["mspace"], [], options);
    spacer.style.marginRight = makeEm(slant);
    parts.unshift(spacer);
  }

  return buildCommon.makeSpan(["mop", "op-limits"], parts, options);
};

// Limits, symbols
// Most operators have a large successor symbol, but these don't.
var noSuccessor = ["\\smallint"]; // NOTE: Unlike most `htmlBuilder`s, this one handles not only "op", but also
// "supsub" since some of them (like \int) can affect super/subscripting.

var htmlBuilder$2 = (grp, options) => {
  // Operators are handled in the TeXbook pg. 443-444, rule 13(a).
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;

  if (grp.type === "supsub") {
    // If we have limits, supsub will pass us its group to handle. Pull
    // out the superscript and subscript and set the group to the op in
    // its base.
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "op");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "op");
  }

  var style = options.style;
  var large = false;

  if (style.size === Style$1.DISPLAY.size && group.symbol && !noSuccessor.includes(group.name)) {
    // Most symbol operators get larger in displaystyle (rule 13)
    large = true;
  }

  var base;

  if (group.symbol) {
    // If this is a symbol, create the symbol.
    var fontName = large ? "Size2-Regular" : "Size1-Regular";
    var stash = "";

    if (group.name === "\\oiint" || group.name === "\\oiiint") {
      // No font glyphs yet, so use a glyph w/o the oval.
      // TODO: When font glyphs are available, delete this code.
      stash = group.name.slice(1);
      group.name = stash === "oiint" ? "\\iint" : "\\iiint";
    }

    base = buildCommon.makeSymbol(group.name, fontName, "math", options, ["mop", "op-symbol", large ? "large-op" : "small-op"]);

    if (stash.length > 0) {
      // We're in \oiint or \oiiint. Overlay the oval.
      // TODO: When font glyphs are available, delete this code.
      var italic = base.italic;
      var oval = buildCommon.staticSvg(stash + "Size" + (large ? "2" : "1"), options);
      base = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: base,
          shift: 0
        }, {
          type: "elem",
          elem: oval,
          shift: large ? 0.08 : 0
        }]
      }, options);
      group.name = "\\" + stash;
      base.classes.unshift("mop"); // $FlowFixMe

      base.italic = italic;
    }
  } else if (group.body) {
    // If this is a list, compose that list.
    var inner = buildExpression$1(group.body, options, true);

    if (inner.length === 1 && inner[0] instanceof SymbolNode) {
      base = inner[0];
      base.classes[0] = "mop"; // replace old mclass
    } else {
      base = buildCommon.makeSpan(["mop"], inner, options);
    }
  } else {
    // Otherwise, this is a text operator. Build the text from the
    // operator's name.
    var output = [];

    for (var i = 1; i < group.name.length; i++) {
      output.push(buildCommon.mathsym(group.name[i], group.mode, options));
    }

    base = buildCommon.makeSpan(["mop"], output, options);
  } // If content of op is a single symbol, shift it vertically.


  var baseShift = 0;
  var slant = 0;

  if ((base instanceof SymbolNode || group.name === "\\oiint" || group.name === "\\oiiint") && !group.suppressBaseShift) {
    // We suppress the shift of the base of \overset and \underset. Otherwise,
    // shift the symbol so its center lies on the axis (rule 13). It
    // appears that our fonts have the centers of the symbols already
    // almost on the axis, so these numbers are very small. Note we
    // don't actually apply this here, but instead it is used either in
    // the vlist creation or separately when there are no limits.
    baseShift = (base.height - base.depth) / 2 - options.fontMetrics().axisHeight; // The slant of the symbol is just its italic correction.
    // $FlowFixMe

    slant = base.italic;
  }

  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, style, slant, baseShift);
  } else {
    if (baseShift) {
      base.style.position = "relative";
      base.style.top = makeEm(baseShift);
    }

    return base;
  }
};

var mathmlBuilder$1 = (group, options) => {
  var node;

  if (group.symbol) {
    // This is a symbol. Just add the symbol.
    node = new MathNode("mo", [makeText(group.name, group.mode)]);

    if (noSuccessor.includes(group.name)) {
      node.setAttribute("largeop", "false");
    }
  } else if (group.body) {
    // This is an operator with children. Add them.
    node = new MathNode("mo", buildExpression(group.body, options));
  } else {
    // This is a text operator. Add all of the characters from the
    // operator's name.
    node = new MathNode("mi", [new TextNode(group.name.slice(1))]); // Append an <mo>&ApplyFunction;</mo>.
    // ref: https://www.w3.org/TR/REC-MathML/chap3_2.html#sec3.2.4

    var operator = new MathNode("mo", [makeText("\u2061", "text")]);

    if (group.parentIsSupSub) {
      node = new MathNode("mrow", [node, operator]);
    } else {
      node = newDocumentFragment([node, operator]);
    }
  }

  return node;
};

var singleCharBigOps = {
  "\u220F": "\\prod",
  "\u2210": "\\coprod",
  "\u2211": "\\sum",
  "\u22c0": "\\bigwedge",
  "\u22c1": "\\bigvee",
  "\u22c2": "\\bigcap",
  "\u22c3": "\\bigcup",
  "\u2a00": "\\bigodot",
  "\u2a01": "\\bigoplus",
  "\u2a02": "\\bigotimes",
  "\u2a04": "\\biguplus",
  "\u2a06": "\\bigsqcup"
};
defineFunction({
  type: "op",
  names: ["\\coprod", "\\bigvee", "\\bigwedge", "\\biguplus", "\\bigcap", "\\bigcup", "\\intop", "\\prod", "\\sum", "\\bigotimes", "\\bigoplus", "\\bigodot", "\\bigsqcup", "\\smallint", "\u220F", "\u2210", "\u2211", "\u22c0", "\u22c1", "\u22c2", "\u22c3", "\u2a00", "\u2a01", "\u2a02", "\u2a04", "\u2a06"],
  props: {
    numArgs: 0
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var fName = funcName;

    if (fName.length === 1) {
      fName = singleCharBigOps[fName];
    }

    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
}); // Note: calling defineFunction with a type that's already been defined only
// works because the same htmlBuilder and mathmlBuilder are being used.

defineFunction({
  type: "op",
  names: ["\\mathop"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      body: ordargument(body)
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
}); // There are 2 flags for operators; whether they produce limits in
// displaystyle, and whether they are symbols and should grow in
// displaystyle. These four groups cover the four possible choices.

var singleCharIntegrals = {
  "\u222b": "\\int",
  "\u222c": "\\iint",
  "\u222d": "\\iiint",
  "\u222e": "\\oint",
  "\u222f": "\\oiint",
  "\u2230": "\\oiiint"
}; // No limits, not symbols

defineFunction({
  type: "op",
  names: ["\\arcsin", "\\arccos", "\\arctan", "\\arctg", "\\arcctg", "\\arg", "\\ch", "\\cos", "\\cosec", "\\cosh", "\\cot", "\\cotg", "\\coth", "\\csc", "\\ctg", "\\cth", "\\deg", "\\dim", "\\exp", "\\hom", "\\ker", "\\lg", "\\ln", "\\log", "\\sec", "\\sin", "\\sinh", "\\sh", "\\tan", "\\tanh", "\\tg", "\\th"],
  props: {
    numArgs: 0
  },

  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },

  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
}); // Limits, not symbols

defineFunction({
  type: "op",
  names: ["\\det", "\\gcd", "\\inf", "\\lim", "\\max", "\\min", "\\Pr", "\\sup"],
  props: {
    numArgs: 0
  },

  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },

  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
}); // No limits, symbols

defineFunction({
  type: "op",
  names: ["\\int", "\\iint", "\\iiint", "\\oint", "\\oiint", "\\oiiint", "\u222b", "\u222c", "\u222d", "\u222e", "\u222f", "\u2230"],
  props: {
    numArgs: 0
  },

  handler(_ref5) {
    var {
      parser,
      funcName
    } = _ref5;
    var fName = funcName;

    if (fName.length === 1) {
      fName = singleCharIntegrals[fName];
    }

    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },

  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});

// NOTE: Unlike most `htmlBuilder`s, this one handles not only
// "operatorname", but also  "supsub" since \operatorname* can
// affect super/subscripting.
var htmlBuilder$1 = (grp, options) => {
  // Operators are handled in the TeXbook pg. 443-444, rule 13(a).
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;

  if (grp.type === "supsub") {
    // If we have limits, supsub will pass us its group to handle. Pull
    // out the superscript and subscript and set the group to the op in
    // its base.
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "operatorname");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "operatorname");
  }

  var base;

  if (group.body.length > 0) {
    var body = group.body.map(child => {
      // $FlowFixMe: Check if the node has a string `text` property.
      var childText = child.text;

      if (typeof childText === "string") {
        return {
          type: "textord",
          mode: child.mode,
          text: childText
        };
      } else {
        return child;
      }
    }); // Consolidate function names into symbol characters.

    var expression = buildExpression$1(body, options.withFont("mathrm"), true);

    for (var i = 0; i < expression.length; i++) {
      var child = expression[i];

      if (child instanceof SymbolNode) {
        // Per amsopn package,
        // change minus to hyphen and \ast to asterisk
        child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
      }
    }

    base = buildCommon.makeSpan(["mop"], expression, options);
  } else {
    base = buildCommon.makeSpan(["mop"], [], options);
  }

  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, options.style, 0, 0);
  } else {
    return base;
  }
};

var mathmlBuilder = (group, options) => {
  // The steps taken here are similar to the html version.
  var expression = buildExpression(group.body, options.withFont("mathrm")); // Is expression a string or has it something like a fraction?

  var isAllString = true; // default

  for (var i = 0; i < expression.length; i++) {
    var node = expression[i];

    if (node instanceof mathMLTree.SpaceNode) ; else if (node instanceof mathMLTree.MathNode) {
      switch (node.type) {
        case "mi":
        case "mn":
        case "ms":
        case "mspace":
        case "mtext":
          break;
        // Do nothing yet.

        case "mo":
          {
            var child = node.children[0];

            if (node.children.length === 1 && child instanceof mathMLTree.TextNode) {
              child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
            } else {
              isAllString = false;
            }

            break;
          }

        default:
          isAllString = false;
      }
    } else {
      isAllString = false;
    }
  }

  if (isAllString) {
    // Write a single TextNode instead of multiple nested tags.
    var word = expression.map(node => node.toText()).join("");
    expression = [new mathMLTree.TextNode(word)];
  }

  var identifier = new mathMLTree.MathNode("mi", expression);
  identifier.setAttribute("mathvariant", "normal"); // \u2061 is the same as &ApplyFunction;
  // ref: https://www.w3schools.com/charsets/ref_html_entities_a.asp

  var operator = new mathMLTree.MathNode("mo", [makeText("\u2061", "text")]);

  if (group.parentIsSupSub) {
    return new mathMLTree.MathNode("mrow", [identifier, operator]);
  } else {
    return mathMLTree.newDocumentFragment([identifier, operator]);
  }
}; // \operatorname
// amsopn.dtx: \mathop{#1\kern\z@\operator@font#3}\newmcodes@


defineFunction({
  type: "operatorname",
  names: ["\\operatorname@", "\\operatornamewithlimits"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "operatorname",
      mode: parser.mode,
      body: ordargument(body),
      alwaysHandleSupSub: funcName === "\\operatornamewithlimits",
      limits: false,
      parentIsSupSub: false
    };
  },
  htmlBuilder: htmlBuilder$1,
  mathmlBuilder
});
defineMacro("\\operatorname", "\\@ifstar\\operatornamewithlimits\\operatorname@");

defineFunctionBuilders({
  type: "ordgroup",

  htmlBuilder(group, options) {
    if (group.semisimple) {
      return buildCommon.makeFragment(buildExpression$1(group.body, options, false));
    }

    return buildCommon.makeSpan(["mord"], buildExpression$1(group.body, options, true), options);
  },

  mathmlBuilder(group, options) {
    return buildExpressionRow(group.body, options, true);
  }

});

defineFunction({
  type: "overline",
  names: ["\\overline"],
  props: {
    numArgs: 1
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "overline",
      mode: parser.mode,
      body
    };
  },

  htmlBuilder(group, options) {
    // Overlines are handled in the TeXbook pg 443, Rule 9.
    // Build the inner group in the cramped style.
    var innerGroup = buildGroup$1(group.body, options.havingCrampedStyle()); // Create the line above the body

    var line = buildCommon.makeLineSpan("overline-line", options); // Generate the vlist, with the appropriate kerns

    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: innerGroup
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: defaultRuleThickness
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "overline"], [vlist], options);
  },

  mathmlBuilder(group, options) {
    var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203e")]);
    operator.setAttribute("stretchy", "true");
    var node = new mathMLTree.MathNode("mover", [buildGroup(group.body, options), operator]);
    node.setAttribute("accent", "true");
    return node;
  }

});

defineFunction({
  type: "phantom",
  names: ["\\phantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "phantom",
      mode: parser.mode,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options.withPhantom(), false); // \phantom isn't supposed to affect the elements it contains.
    // See "color" for more details.

    return buildCommon.makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var inner = buildExpression(group.body, options);
    return new mathMLTree.MathNode("mphantom", inner);
  }
});
defineFunction({
  type: "hphantom",
  names: ["\\hphantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "hphantom",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder: (group, options) => {
    var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options.withPhantom())]);
    node.height = 0;
    node.depth = 0;

    if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        node.children[i].height = 0;
        node.children[i].depth = 0;
      }
    } // See smash for comment re: use of makeVList


    node = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: node
      }]
    }, options); // For spacing, TeX treats \smash as a math group (same spacing as ord).

    return buildCommon.makeSpan(["mord"], [node], options);
  },
  mathmlBuilder: (group, options) => {
    var inner = buildExpression(ordargument(group.body), options);
    var phantom = new mathMLTree.MathNode("mphantom", inner);
    var node = new mathMLTree.MathNode("mpadded", [phantom]);
    node.setAttribute("height", "0px");
    node.setAttribute("depth", "0px");
    return node;
  }
});
defineFunction({
  type: "vphantom",
  names: ["\\vphantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref3, args) => {
    var {
      parser
    } = _ref3;
    var body = args[0];
    return {
      type: "vphantom",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder: (group, options) => {
    var inner = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options.withPhantom())]);
    var fix = buildCommon.makeSpan(["fix"], []);
    return buildCommon.makeSpan(["mord", "rlap"], [inner, fix], options);
  },
  mathmlBuilder: (group, options) => {
    var inner = buildExpression(ordargument(group.body), options);
    var phantom = new mathMLTree.MathNode("mphantom", inner);
    var node = new mathMLTree.MathNode("mpadded", [phantom]);
    node.setAttribute("width", "0px");
    return node;
  }
});

defineFunction({
  type: "raisebox",
  names: ["\\raisebox"],
  props: {
    numArgs: 2,
    argTypes: ["size", "hbox"],
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var amount = assertNodeType(args[0], "size").value;
    var body = args[1];
    return {
      type: "raisebox",
      mode: parser.mode,
      dy: amount,
      body
    };
  },

  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var dy = calculateSize(group.dy, options);
    return buildCommon.makeVList({
      positionType: "shift",
      positionData: -dy,
      children: [{
        type: "elem",
        elem: body
      }]
    }, options);
  },

  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mpadded", [buildGroup(group.body, options)]);
    var dy = group.dy.number + group.dy.unit;
    node.setAttribute("voffset", dy);
    return node;
  }

});

defineFunction({
  type: "internal",
  names: ["\\relax"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInArgument: true
  },

  handler(_ref) {
    var {
      parser
    } = _ref;
    return {
      type: "internal",
      mode: parser.mode
    };
  }

});

defineFunction({
  type: "rule",
  names: ["\\rule"],
  props: {
    numArgs: 2,
    numOptionalArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    argTypes: ["size", "size", "size"]
  },

  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var shift = optArgs[0];
    var width = assertNodeType(args[0], "size");
    var height = assertNodeType(args[1], "size");
    return {
      type: "rule",
      mode: parser.mode,
      shift: shift && assertNodeType(shift, "size").value,
      width: width.value,
      height: height.value
    };
  },

  htmlBuilder(group, options) {
    // Make an empty span for the rule
    var rule = buildCommon.makeSpan(["mord", "rule"], [], options); // Calculate the shift, width, and height of the rule, and account for units

    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0; // Style the rule to the right size

    rule.style.borderRightWidth = makeEm(width);
    rule.style.borderTopWidth = makeEm(height);
    rule.style.bottom = makeEm(shift); // Record the height and width

    rule.width = width;
    rule.height = height + shift;
    rule.depth = -shift; // Font size is the number large enough that the browser will
    // reserve at least `absHeight` space above the baseline.
    // The 1.125 factor was empirically determined

    rule.maxFontSize = height * 1.125 * options.sizeMultiplier;
    return rule;
  },

  mathmlBuilder(group, options) {
    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0;
    var color = options.color && options.getColor() || "black";
    var rule = new mathMLTree.MathNode("mspace");
    rule.setAttribute("mathbackground", color);
    rule.setAttribute("width", makeEm(width));
    rule.setAttribute("height", makeEm(height));
    var wrapper = new mathMLTree.MathNode("mpadded", [rule]);

    if (shift >= 0) {
      wrapper.setAttribute("height", makeEm(shift));
    } else {
      wrapper.setAttribute("height", makeEm(shift));
      wrapper.setAttribute("depth", makeEm(-shift));
    }

    wrapper.setAttribute("voffset", makeEm(shift));
    return wrapper;
  }

});

function sizingGroup(value, options, baseOptions) {
  var inner = buildExpression$1(value, options, false);
  var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier; // Add size-resetting classes to the inner list and set maxFontSize
  // manually. Handle nested size changes.

  for (var i = 0; i < inner.length; i++) {
    var pos = inner[i].classes.indexOf("sizing");

    if (pos < 0) {
      Array.prototype.push.apply(inner[i].classes, options.sizingClasses(baseOptions));
    } else if (inner[i].classes[pos + 1] === "reset-size" + options.size) {
      // This is a nested size change: e.g., inner[i] is the "b" in
      // `\Huge a \small b`. Override the old size (the `reset-` class)
      // but not the new size.
      inner[i].classes[pos + 1] = "reset-size" + baseOptions.size;
    }

    inner[i].height *= multiplier;
    inner[i].depth *= multiplier;
  }

  return buildCommon.makeFragment(inner);
}
var sizeFuncs = ["\\tiny", "\\sixptsize", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"];
var htmlBuilder = (group, options) => {
  // Handle sizing operators like \Huge. Real TeX doesn't actually allow
  // these functions inside of math expressions, so we do some special
  // handling.
  var newOptions = options.havingSize(group.size);
  return sizingGroup(group.body, newOptions, options);
};
defineFunction({
  type: "sizing",
  names: sizeFuncs,
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    var body = parser.parseExpression(false, breakOnTokenText);
    return {
      type: "sizing",
      mode: parser.mode,
      // Figure out what size to use based on the list of functions above
      size: sizeFuncs.indexOf(funcName) + 1,
      body
    };
  },
  htmlBuilder,
  mathmlBuilder: (group, options) => {
    var newOptions = options.havingSize(group.size);
    var inner = buildExpression(group.body, newOptions);
    var node = new mathMLTree.MathNode("mstyle", inner); // TODO(emily): This doesn't produce the correct size for nested size
    // changes, because we don't keep state of what style we're currently
    // in, so we can't reset the size to normal before changing it.  Now
    // that we're passing an options parameter we should be able to fix
    // this.

    node.setAttribute("mathsize", makeEm(newOptions.sizeMultiplier));
    return node;
  }
});

// smash, with optional [tb], as in AMS
defineFunction({
  type: "smash",
  names: ["\\smash"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var smashHeight = false;
    var smashDepth = false;
    var tbArg = optArgs[0] && assertNodeType(optArgs[0], "ordgroup");

    if (tbArg) {
      // Optional [tb] argument is engaged.
      // ref: amsmath: \renewcommand{\smash}[1][tb]{%
      //               def\mb@t{\ht}\def\mb@b{\dp}\def\mb@tb{\ht\z@\z@\dp}%
      var letter = "";

      for (var i = 0; i < tbArg.body.length; ++i) {
        var node = tbArg.body[i]; // $FlowFixMe: Not every node type has a `text` property.

        letter = node.text;

        if (letter === "t") {
          smashHeight = true;
        } else if (letter === "b") {
          smashDepth = true;
        } else {
          smashHeight = false;
          smashDepth = false;
          break;
        }
      }
    } else {
      smashHeight = true;
      smashDepth = true;
    }

    var body = args[0];
    return {
      type: "smash",
      mode: parser.mode,
      body,
      smashHeight,
      smashDepth
    };
  },
  htmlBuilder: (group, options) => {
    var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]);

    if (!group.smashHeight && !group.smashDepth) {
      return node;
    }

    if (group.smashHeight) {
      node.height = 0; // In order to influence makeVList, we have to reset the children.

      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          node.children[i].height = 0;
        }
      }
    }

    if (group.smashDepth) {
      node.depth = 0;

      if (node.children) {
        for (var _i = 0; _i < node.children.length; _i++) {
          node.children[_i].depth = 0;
        }
      }
    } // At this point, we've reset the TeX-like height and depth values.
    // But the span still has an HTML line height.
    // makeVList applies "display: table-cell", which prevents the browser
    // from acting on that line height. So we'll call makeVList now.


    var smashedNode = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: node
      }]
    }, options); // For spacing, TeX treats \hphantom as a math group (same spacing as ord).

    return buildCommon.makeSpan(["mord"], [smashedNode], options);
  },
  mathmlBuilder: (group, options) => {
    var node = new mathMLTree.MathNode("mpadded", [buildGroup(group.body, options)]);

    if (group.smashHeight) {
      node.setAttribute("height", "0px");
    }

    if (group.smashDepth) {
      node.setAttribute("depth", "0px");
    }

    return node;
  }
});

defineFunction({
  type: "sqrt",
  names: ["\\sqrt"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },

  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var index = optArgs[0];
    var body = args[0];
    return {
      type: "sqrt",
      mode: parser.mode,
      body,
      index
    };
  },

  htmlBuilder(group, options) {
    // Square roots are handled in the TeXbook pg. 443, Rule 11.
    // First, we do the same steps as in overline to build the inner group
    // and line
    var inner = buildGroup$1(group.body, options.havingCrampedStyle());

    if (inner.height === 0) {
      // Render a small surd.
      inner.height = options.fontMetrics().xHeight;
    } // Some groups can return document fragments.  Handle those by wrapping
    // them in a span.


    inner = buildCommon.wrapFragment(inner, options); // Calculate the minimum size for the \surd delimiter

    var metrics = options.fontMetrics();
    var theta = metrics.defaultRuleThickness;
    var phi = theta;

    if (options.style.id < Style$1.TEXT.id) {
      phi = options.fontMetrics().xHeight;
    } // Calculate the clearance between the body and line


    var lineClearance = theta + phi / 4;
    var minDelimiterHeight = inner.height + inner.depth + lineClearance + theta; // Create a sqrt SVG of the required minimum size

    var {
      span: img,
      ruleWidth,
      advanceWidth
    } = delimiter.sqrtImage(minDelimiterHeight, options);
    var delimDepth = img.height - ruleWidth; // Adjust the clearance based on the delimiter size

    if (delimDepth > inner.height + inner.depth + lineClearance) {
      lineClearance = (lineClearance + delimDepth - inner.height - inner.depth) / 2;
    } // Shift the sqrt image


    var imgShift = img.height - inner.height - lineClearance - ruleWidth;
    inner.style.paddingLeft = makeEm(advanceWidth); // Overlay the image and the argument.

    var body = buildCommon.makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: inner,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: -(inner.height + imgShift)
      }, {
        type: "elem",
        elem: img
      }, {
        type: "kern",
        size: ruleWidth
      }]
    }, options);

    if (!group.index) {
      return buildCommon.makeSpan(["mord", "sqrt"], [body], options);
    } else {
      // Handle the optional root index
      // The index is always in scriptscript style
      var newOptions = options.havingStyle(Style$1.SCRIPTSCRIPT);
      var rootm = buildGroup$1(group.index, newOptions, options); // The amount the index is shifted by. This is taken from the TeX
      // source, in the definition of `\r@@t`.

      var toShift = 0.6 * (body.height - body.depth); // Build a VList with the superscript shifted up correctly

      var rootVList = buildCommon.makeVList({
        positionType: "shift",
        positionData: -toShift,
        children: [{
          type: "elem",
          elem: rootm
        }]
      }, options); // Add a class surrounding it so we can add on the appropriate
      // kerning

      var rootVListWrap = buildCommon.makeSpan(["root"], [rootVList]);
      return buildCommon.makeSpan(["mord", "sqrt"], [rootVListWrap, body], options);
    }
  },

  mathmlBuilder(group, options) {
    var {
      body,
      index
    } = group;
    return index ? new mathMLTree.MathNode("mroot", [buildGroup(body, options), buildGroup(index, options)]) : new mathMLTree.MathNode("msqrt", [buildGroup(body, options)]);
  }

});

var styleMap = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
defineFunction({
  type: "styling",
  names: ["\\displaystyle", "\\textstyle", "\\scriptstyle", "\\scriptscriptstyle"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },

  handler(_ref, args) {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    // parse out the implicit body
    var body = parser.parseExpression(true, breakOnTokenText); // TODO: Refactor to avoid duplicating styleMap in multiple places (e.g.
    // here and in buildHTML and de-dupe the enumeration of all the styles).
    // $FlowFixMe: The names above exactly match the styles.

    var style = funcName.slice(1, funcName.length - 5);
    return {
      type: "styling",
      mode: parser.mode,
      // Figure out what style to use by pulling out the style from
      // the function name
      style,
      body
    };
  },

  htmlBuilder(group, options) {
    // Style changes are handled in the TeXbook on pg. 442, Rule 3.
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle).withFont('');
    return sizingGroup(group.body, newOptions, options);
  },

  mathmlBuilder(group, options) {
    // Figure out what style we're changing to.
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle);
    var inner = buildExpression(group.body, newOptions);
    var node = new mathMLTree.MathNode("mstyle", inner);
    var styleAttributes = {
      "display": ["0", "true"],
      "text": ["0", "false"],
      "script": ["1", "false"],
      "scriptscript": ["2", "false"]
    };
    var attr = styleAttributes[group.style];
    node.setAttribute("scriptlevel", attr[0]);
    node.setAttribute("displaystyle", attr[1]);
    return node;
  }

});

/**
 * Sometimes, groups perform special rules when they have superscripts or
 * subscripts attached to them. This function lets the `supsub` group know that
 * Sometimes, groups perform special rules when they have superscripts or
 * its inner element should handle the superscripts and subscripts instead of
 * handling them itself.
 */
var htmlBuilderDelegate = function htmlBuilderDelegate(group, options) {
  var base = group.base;

  if (!base) {
    return null;
  } else if (base.type === "op") {
    // Operators handle supsubs differently when they have limits
    // (e.g. `\displaystyle\sum_2^3`)
    var delegate = base.limits && (options.style.size === Style$1.DISPLAY.size || base.alwaysHandleSupSub);
    return delegate ? htmlBuilder$2 : null;
  } else if (base.type === "operatorname") {
    var _delegate = base.alwaysHandleSupSub && (options.style.size === Style$1.DISPLAY.size || base.limits);

    return _delegate ? htmlBuilder$1 : null;
  } else if (base.type === "accent") {
    return utils.isCharacterBox(base.base) ? htmlBuilder$a : null;
  } else if (base.type === "horizBrace") {
    var isSup = !group.sub;
    return isSup === base.isOver ? htmlBuilder$3 : null;
  } else {
    return null;
  }
}; // Super scripts and subscripts, whose precise placement can depend on other
// functions that precede them.


defineFunctionBuilders({
  type: "supsub",

  htmlBuilder(group, options) {
    // Superscript and subscripts are handled in the TeXbook on page
    // 445-446, rules 18(a-f).
    // Here is where we defer to the inner group if it should handle
    // superscripts and subscripts itself.
    var builderDelegate = htmlBuilderDelegate(group, options);

    if (builderDelegate) {
      return builderDelegate(group, options);
    }

    var {
      base: valueBase,
      sup: valueSup,
      sub: valueSub
    } = group;
    var base = buildGroup$1(valueBase, options);
    var supm;
    var subm;
    var metrics = options.fontMetrics(); // Rule 18a

    var supShift = 0;
    var subShift = 0;
    var isCharacterBox = valueBase && utils.isCharacterBox(valueBase);

    if (valueSup) {
      var newOptions = options.havingStyle(options.style.sup());
      supm = buildGroup$1(valueSup, newOptions, options);

      if (!isCharacterBox) {
        supShift = base.height - newOptions.fontMetrics().supDrop * newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }

    if (valueSub) {
      var _newOptions = options.havingStyle(options.style.sub());

      subm = buildGroup$1(valueSub, _newOptions, options);

      if (!isCharacterBox) {
        subShift = base.depth + _newOptions.fontMetrics().subDrop * _newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    } // Rule 18c


    var minSupShift;

    if (options.style === Style$1.DISPLAY) {
      minSupShift = metrics.sup1;
    } else if (options.style.cramped) {
      minSupShift = metrics.sup3;
    } else {
      minSupShift = metrics.sup2;
    } // scriptspace is a font-size-independent size, so scale it
    // appropriately for use as the marginRight.


    var multiplier = options.sizeMultiplier;
    var marginRight = makeEm(0.5 / metrics.ptPerEm / multiplier);
    var marginLeft = null;

    if (subm) {
      // Subscripts shouldn't be shifted by the base's italic correction.
      // Account for that by shifting the subscript back the appropriate
      // amount. Note we only do this when the base is a single symbol.
      var isOiint = group.base && group.base.type === "op" && group.base.name && (group.base.name === "\\oiint" || group.base.name === "\\oiiint");

      if (base instanceof SymbolNode || isOiint) {
        // $FlowFixMe
        marginLeft = makeEm(-base.italic);
      }
    }

    var supsub;

    if (supm && subm) {
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      subShift = Math.max(subShift, metrics.sub2);
      var ruleWidth = metrics.defaultRuleThickness; // Rule 18e

      var maxWidth = 4 * ruleWidth;

      if (supShift - supm.depth - (subm.height - subShift) < maxWidth) {
        subShift = maxWidth - (supShift - supm.depth) + subm.height;
        var psi = 0.8 * metrics.xHeight - (supShift - supm.depth);

        if (psi > 0) {
          supShift += psi;
          subShift -= psi;
        }
      }

      var vlistElem = [{
        type: "elem",
        elem: subm,
        shift: subShift,
        marginRight,
        marginLeft
      }, {
        type: "elem",
        elem: supm,
        shift: -supShift,
        marginRight
      }];
      supsub = buildCommon.makeVList({
        positionType: "individualShift",
        children: vlistElem
      }, options);
    } else if (subm) {
      // Rule 18b
      subShift = Math.max(subShift, metrics.sub1, subm.height - 0.8 * metrics.xHeight);
      var _vlistElem = [{
        type: "elem",
        elem: subm,
        marginLeft,
        marginRight
      }];
      supsub = buildCommon.makeVList({
        positionType: "shift",
        positionData: subShift,
        children: _vlistElem
      }, options);
    } else if (supm) {
      // Rule 18c, d
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      supsub = buildCommon.makeVList({
        positionType: "shift",
        positionData: -supShift,
        children: [{
          type: "elem",
          elem: supm,
          marginRight
        }]
      }, options);
    } else {
      throw new Error("supsub must have either sup or sub.");
    } // Wrap the supsub vlist in a span.msupsub to reset text-align.


    var mclass = getTypeOfDomTree(base, "right") || "mord";
    return buildCommon.makeSpan([mclass], [base, buildCommon.makeSpan(["msupsub"], [supsub])], options);
  },

  mathmlBuilder(group, options) {
    // Is the inner group a relevant horizontal brace?
    var isBrace = false;
    var isOver;
    var isSup;

    if (group.base && group.base.type === "horizBrace") {
      isSup = !!group.sup;

      if (isSup === group.base.isOver) {
        isBrace = true;
        isOver = group.base.isOver;
      }
    }

    if (group.base && (group.base.type === "op" || group.base.type === "operatorname")) {
      group.base.parentIsSupSub = true;
    }

    var children = [buildGroup(group.base, options)];

    if (group.sub) {
      children.push(buildGroup(group.sub, options));
    }

    if (group.sup) {
      children.push(buildGroup(group.sup, options));
    }

    var nodeType;

    if (isBrace) {
      nodeType = isOver ? "mover" : "munder";
    } else if (!group.sub) {
      var base = group.base;

      if (base && base.type === "op" && base.limits && (options.style === Style$1.DISPLAY || base.alwaysHandleSupSub)) {
        nodeType = "mover";
      } else if (base && base.type === "operatorname" && base.alwaysHandleSupSub && (base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "mover";
      } else {
        nodeType = "msup";
      }
    } else if (!group.sup) {
      var _base = group.base;

      if (_base && _base.type === "op" && _base.limits && (options.style === Style$1.DISPLAY || _base.alwaysHandleSupSub)) {
        nodeType = "munder";
      } else if (_base && _base.type === "operatorname" && _base.alwaysHandleSupSub && (_base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "munder";
      } else {
        nodeType = "msub";
      }
    } else {
      var _base2 = group.base;

      if (_base2 && _base2.type === "op" && _base2.limits && options.style === Style$1.DISPLAY) {
        nodeType = "munderover";
      } else if (_base2 && _base2.type === "operatorname" && _base2.alwaysHandleSupSub && (options.style === Style$1.DISPLAY || _base2.limits)) {
        nodeType = "munderover";
      } else {
        nodeType = "msubsup";
      }
    }

    return new mathMLTree.MathNode(nodeType, children);
  }

});

defineFunctionBuilders({
  type: "atom",

  htmlBuilder(group, options) {
    return buildCommon.mathsym(group.text, group.mode, options, ["m" + group.family]);
  },

  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mo", [makeText(group.text, group.mode)]);

    if (group.family === "bin") {
      var variant = getVariant(group, options);

      if (variant === "bold-italic") {
        node.setAttribute("mathvariant", variant);
      }
    } else if (group.family === "punct") {
      node.setAttribute("separator", "true");
    } else if (group.family === "open" || group.family === "close") {
      // Delims built here should not stretch vertically.
      // See delimsizing.js for stretchy delims.
      node.setAttribute("stretchy", "false");
    }

    return node;
  }

});

// "mathord" and "textord" ParseNodes created in Parser.js from symbol Groups in
// src/symbols.js.
var defaultVariant = {
  "mi": "italic",
  "mn": "normal",
  "mtext": "normal"
};
defineFunctionBuilders({
  type: "mathord",

  htmlBuilder(group, options) {
    return buildCommon.makeOrd(group, options, "mathord");
  },

  mathmlBuilder(group, options) {
    var node = new mathMLTree.MathNode("mi", [makeText(group.text, group.mode, options)]);
    var variant = getVariant(group, options) || "italic";

    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }

    return node;
  }

});
defineFunctionBuilders({
  type: "textord",

  htmlBuilder(group, options) {
    return buildCommon.makeOrd(group, options, "textord");
  },

  mathmlBuilder(group, options) {
    var text = makeText(group.text, group.mode, options);
    var variant = getVariant(group, options) || "normal";
    var node;

    if (group.mode === 'text') {
      node = new mathMLTree.MathNode("mtext", [text]);
    } else if (/[0-9]/.test(group.text)) {
      node = new mathMLTree.MathNode("mn", [text]);
    } else if (group.text === "\\prime") {
      node = new mathMLTree.MathNode("mo", [text]);
    } else {
      node = new mathMLTree.MathNode("mi", [text]);
    }

    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }

    return node;
  }

});

var cssSpace = {
  "\\nobreak": "nobreak",
  "\\allowbreak": "allowbreak"
}; // A lookup table to determine whether a spacing function/symbol should be
// treated like a regular space character.  If a symbol or command is a key
// in this table, then it should be a regular space character.  Furthermore,
// the associated value may have a `className` specifying an extra CSS class
// to add to the created `span`.

var regularSpace = {
  " ": {},
  "\\ ": {},
  "~": {
    className: "nobreak"
  },
  "\\space": {},
  "\\nobreakspace": {
    className: "nobreak"
  }
}; // ParseNode<"spacing"> created in Parser.js from the "spacing" symbol Groups in
// src/symbols.js.

defineFunctionBuilders({
  type: "spacing",

  htmlBuilder(group, options) {
    if (regularSpace.hasOwnProperty(group.text)) {
      var className = regularSpace[group.text].className || ""; // Spaces are generated by adding an actual space. Each of these
      // things has an entry in the symbols table, so these will be turned
      // into appropriate outputs.

      if (group.mode === "text") {
        var ord = buildCommon.makeOrd(group, options, "textord");
        ord.classes.push(className);
        return ord;
      } else {
        return buildCommon.makeSpan(["mspace", className], [buildCommon.mathsym(group.text, group.mode, options)], options);
      }
    } else if (cssSpace.hasOwnProperty(group.text)) {
      // Spaces based on just a CSS class.
      return buildCommon.makeSpan(["mspace", cssSpace[group.text]], [], options);
    } else {
      throw new ParseError("Unknown type of space \"" + group.text + "\"");
    }
  },

  mathmlBuilder(group, options) {
    var node;

    if (regularSpace.hasOwnProperty(group.text)) {
      node = new mathMLTree.MathNode("mtext", [new mathMLTree.TextNode("\u00a0")]);
    } else if (cssSpace.hasOwnProperty(group.text)) {
      // CSS-based MathML spaces (\nobreak, \allowbreak) are ignored
      return new mathMLTree.MathNode("mspace");
    } else {
      throw new ParseError("Unknown type of space \"" + group.text + "\"");
    }

    return node;
  }

});

var pad = () => {
  var padNode = new mathMLTree.MathNode("mtd", []);
  padNode.setAttribute("width", "50%");
  return padNode;
};

defineFunctionBuilders({
  type: "tag",

  mathmlBuilder(group, options) {
    var table = new mathMLTree.MathNode("mtable", [new mathMLTree.MathNode("mtr", [pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.body, options)]), pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.tag, options)])])]);
    table.setAttribute("width", "100%");
    return table; // TODO: Left-aligned tags.
    // Currently, the group and options passed here do not contain
    // enough info to set tag alignment. `leqno` is in Settings but it is
    // not passed to Options. On the HTML side, leqno is
    // set by a CSS class applied in buildTree.js. That would have worked
    // in MathML if browsers supported <mlabeledtr>. Since they don't, we
    // need to rewrite the way this function is called.
  }

});

var textFontFamilies = {
  "\\text": undefined,
  "\\textrm": "textrm",
  "\\textsf": "textsf",
  "\\texttt": "texttt",
  "\\textnormal": "textrm"
};
var textFontWeights = {
  "\\textbf": "textbf",
  "\\textmd": "textmd"
};
var textFontShapes = {
  "\\textit": "textit",
  "\\textup": "textup"
};

var optionsWithFont = (group, options) => {
  var font = group.font; // Checks if the argument is a font family or a font style.

  if (!font) {
    return options;
  } else if (textFontFamilies[font]) {
    return options.withTextFontFamily(textFontFamilies[font]);
  } else if (textFontWeights[font]) {
    return options.withTextFontWeight(textFontWeights[font]);
  } else if (font === "\\emph") {
    return options.fontShape === "textit" ? options.withTextFontShape("textup") : options.withTextFontShape("textit");
  }

  return options.withTextFontShape(textFontShapes[font]);
};

defineFunction({
  type: "text",
  names: [// Font families
  "\\text", "\\textrm", "\\textsf", "\\texttt", "\\textnormal", // Font weights
  "\\textbf", "\\textmd", // Font Shapes
  "\\textit", "\\textup", "\\emph"],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInArgument: true,
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "text",
      mode: parser.mode,
      body: ordargument(body),
      font: funcName
    };
  },

  htmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    var inner = buildExpression$1(group.body, newOptions, true);
    return buildCommon.makeSpan(["mord", "text"], inner, newOptions);
  },

  mathmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    return buildExpressionRow(group.body, newOptions);
  }

});

defineFunction({
  type: "underline",
  names: ["\\underline"],
  props: {
    numArgs: 1,
    allowedInText: true
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "underline",
      mode: parser.mode,
      body: args[0]
    };
  },

  htmlBuilder(group, options) {
    // Underlines are handled in the TeXbook pg 443, Rule 10.
    // Build the inner group.
    var innerGroup = buildGroup$1(group.body, options); // Create the line to go below the body

    var line = buildCommon.makeLineSpan("underline-line", options); // Generate the vlist, with the appropriate kerns

    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = buildCommon.makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "kern",
        size: defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: innerGroup
      }]
    }, options);
    return buildCommon.makeSpan(["mord", "underline"], [vlist], options);
  },

  mathmlBuilder(group, options) {
    var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203e")]);
    operator.setAttribute("stretchy", "true");
    var node = new mathMLTree.MathNode("munder", [buildGroup(group.body, options), operator]);
    node.setAttribute("accentunder", "true");
    return node;
  }

});

defineFunction({
  type: "vcenter",
  names: ["\\vcenter"],
  props: {
    numArgs: 1,
    argTypes: ["original"],
    // In LaTeX, \vcenter can act only on a box.
    allowedInText: false
  },

  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "vcenter",
      mode: parser.mode,
      body: args[0]
    };
  },

  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var axisHeight = options.fontMetrics().axisHeight;
    var dy = 0.5 * (body.height - axisHeight - (body.depth + axisHeight));
    return buildCommon.makeVList({
      positionType: "shift",
      positionData: dy,
      children: [{
        type: "elem",
        elem: body
      }]
    }, options);
  },

  mathmlBuilder(group, options) {
    // There is no way to do this in MathML.
    // Write a class as a breadcrumb in case some post-processor wants
    // to perform a vcenter adjustment.
    return new mathMLTree.MathNode("mpadded", [buildGroup(group.body, options)], ["vcenter"]);
  }

});

defineFunction({
  type: "verb",
  names: ["\\verb"],
  props: {
    numArgs: 0,
    allowedInText: true
  },

  handler(context, args, optArgs) {
    // \verb and \verb* are dealt with directly in Parser.js.
    // If we end up here, it's because of a failure to match the two delimiters
    // in the regex in Lexer.js.  LaTeX raises the following error when \verb is
    // terminated by end of line (or file).
    throw new ParseError("\\verb ended by end of line instead of matching delimiter");
  },

  htmlBuilder(group, options) {
    var text = makeVerb(group);
    var body = []; // \verb enters text mode and therefore is sized like \textstyle

    var newOptions = options.havingStyle(options.style.text());

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (c === '~') {
        c = '\\textasciitilde';
      }

      body.push(buildCommon.makeSymbol(c, "Typewriter-Regular", group.mode, newOptions, ["mord", "texttt"]));
    }

    return buildCommon.makeSpan(["mord", "text"].concat(newOptions.sizingClasses(options)), buildCommon.tryCombineChars(body), newOptions);
  },

  mathmlBuilder(group, options) {
    var text = new mathMLTree.TextNode(makeVerb(group));
    var node = new mathMLTree.MathNode("mtext", [text]);
    node.setAttribute("mathvariant", "monospace");
    return node;
  }

});
/**
 * Converts verb group into body string.
 *
 * \verb* replaces each space with an open box \u2423
 * \verb replaces each space with a no-break space \xA0
 */

var makeVerb = group => group.body.replace(/ /g, group.star ? '\u2423' : '\xA0');

/** Include this to ensure that all functions are defined. */
var functions = _functions;

/**
 * The Lexer class handles tokenizing the input in various ways. Since our
 * parser expects us to be able to backtrack, the lexer allows lexing from any
 * given starting point.
 *
 * Its main exposed function is the `lex` function, which takes a position to
 * lex from and a type of token to lex. It defers to the appropriate `_innerLex`
 * function.
 *
 * The various `_innerLex` functions perform the actual lexing of different
 * kinds.
 */

/* The following tokenRegex
 * - matches typical whitespace (but not NBSP etc.) using its first group
 * - does not match any control character \x00-\x1f except whitespace
 * - does not match a bare backslash
 * - matches any ASCII character except those just mentioned
 * - does not match the BMP private use area \uE000-\uF8FF
 * - does not match bare surrogate code units
 * - matches any BMP character except for those just described
 * - matches any valid Unicode surrogate pair
 * - matches a backslash followed by one or more whitespace characters
 * - matches a backslash followed by one or more letters then whitespace
 * - matches a backslash followed by any BMP character
 * Capturing groups:
 *   [1] regular whitespace
 *   [2] backslash followed by whitespace
 *   [3] anything else, which may include:
 *     [4] left character of \verb*
 *     [5] left character of \verb
 *     [6] backslash followed by word, excluding any trailing whitespace
 * Just because the Lexer matches something doesn't mean it's valid input:
 * If there is no matching function or symbol definition, the Parser will
 * still reject the input.
 */
var spaceRegexString = "[ \r\n\t]";
var controlWordRegexString = "\\\\[a-zA-Z@]+";
var controlSymbolRegexString = "\\\\[^\uD800-\uDFFF]";
var controlWordWhitespaceRegexString = "(" + controlWordRegexString + ")" + spaceRegexString + "*";
var controlSpaceRegexString = "\\\\(\n|[ \r\t]+\n?)[ \r\t]*";
var combiningDiacriticalMarkString = "[\u0300-\u036f]";
var combiningDiacriticalMarksEndRegex = new RegExp(combiningDiacriticalMarkString + "+$");
var tokenRegexString = "(" + spaceRegexString + "+)|" + ( // whitespace
controlSpaceRegexString + "|") + // \whitespace
"([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" + ( // single codepoint
combiningDiacriticalMarkString + "*") + // ...plus accents
"|[\uD800-\uDBFF][\uDC00-\uDFFF]" + ( // surrogate pair
combiningDiacriticalMarkString + "*") + // ...plus accents
"|\\\\verb\\*([^]).*?\\4" + // \verb*
"|\\\\verb([^*a-zA-Z]).*?\\5" + ( // \verb unstarred
"|" + controlWordWhitespaceRegexString) + ( // \macroName + spaces
"|" + controlSymbolRegexString + ")"); // \\, \', etc.

/** Main Lexer class */

class Lexer {
  // Category codes. The lexer only supports comment characters (14) for now.
  // MacroExpander additionally distinguishes active (13).
  constructor(input, settings) {
    this.input = void 0;
    this.settings = void 0;
    this.tokenRegex = void 0;
    this.catcodes = void 0;
    // Separate accents from characters
    this.input = input;
    this.settings = settings;
    this.tokenRegex = new RegExp(tokenRegexString, 'g');
    this.catcodes = {
      "%": 14,
      // comment character
      "~": 13 // active character

    };
  }

  setCatcode(char, code) {
    this.catcodes[char] = code;
  }
  /**
   * This function lexes a single token.
   */


  lex() {
    var input = this.input;
    var pos = this.tokenRegex.lastIndex;

    if (pos === input.length) {
      return new Token("EOF", new SourceLocation(this, pos, pos));
    }

    var match = this.tokenRegex.exec(input);

    if (match === null || match.index !== pos) {
      throw new ParseError("Unexpected character: '" + input[pos] + "'", new Token(input[pos], new SourceLocation(this, pos, pos + 1)));
    }

    var text = match[6] || match[3] || (match[2] ? "\\ " : " ");

    if (this.catcodes[text] === 14) {
      // comment character
      var nlIndex = input.indexOf('\n', this.tokenRegex.lastIndex);

      if (nlIndex === -1) {
        this.tokenRegex.lastIndex = input.length; // EOF

        this.settings.reportNonstrict("commentAtEnd", "% comment has no terminating newline; LaTeX would " + "fail because of commenting the end of math mode (e.g. $)");
      } else {
        this.tokenRegex.lastIndex = nlIndex + 1;
      }

      return this.lex();
    }

    return new Token(text, new SourceLocation(this, pos, this.tokenRegex.lastIndex));
  }

}

/**
 * A `Namespace` refers to a space of nameable things like macros or lengths,
 * which can be `set` either globally or local to a nested group, using an
 * undo stack similar to how TeX implements this functionality.
 * Performance-wise, `get` and local `set` take constant time, while global
 * `set` takes time proportional to the depth of group nesting.
 */
class Namespace {
  /**
   * Both arguments are optional.  The first argument is an object of
   * built-in mappings which never change.  The second argument is an object
   * of initial (global-level) mappings, which will constantly change
   * according to any global/top-level `set`s done.
   */
  constructor(builtins, globalMacros) {
    if (builtins === void 0) {
      builtins = {};
    }

    if (globalMacros === void 0) {
      globalMacros = {};
    }

    this.current = void 0;
    this.builtins = void 0;
    this.undefStack = void 0;
    this.current = globalMacros;
    this.builtins = builtins;
    this.undefStack = [];
  }
  /**
   * Start a new nested group, affecting future local `set`s.
   */


  beginGroup() {
    this.undefStack.push({});
  }
  /**
   * End current nested group, restoring values before the group began.
   */


  endGroup() {
    if (this.undefStack.length === 0) {
      throw new ParseError("Unbalanced namespace destruction: attempt " + "to pop global namespace; please report this as a bug");
    }

    var undefs = this.undefStack.pop();

    for (var undef in undefs) {
      if (undefs.hasOwnProperty(undef)) {
        if (undefs[undef] == null) {
          delete this.current[undef];
        } else {
          this.current[undef] = undefs[undef];
        }
      }
    }
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */


  endGroups() {
    while (this.undefStack.length > 0) {
      this.endGroup();
    }
  }
  /**
   * Detect whether `name` has a definition.  Equivalent to
   * `get(name) != null`.
   */


  has(name) {
    return this.current.hasOwnProperty(name) || this.builtins.hasOwnProperty(name);
  }
  /**
   * Get the current value of a name, or `undefined` if there is no value.
   *
   * Note: Do not use `if (namespace.get(...))` to detect whether a macro
   * is defined, as the definition may be the empty string which evaluates
   * to `false` in JavaScript.  Use `if (namespace.get(...) != null)` or
   * `if (namespace.has(...))`.
   */


  get(name) {
    if (this.current.hasOwnProperty(name)) {
      return this.current[name];
    } else {
      return this.builtins[name];
    }
  }
  /**
   * Set the current value of a name, and optionally set it globally too.
   * Local set() sets the current value and (when appropriate) adds an undo
   * operation to the undo stack.  Global set() may change the undo
   * operation at every level, so takes time linear in their number.
   * A value of undefined means to delete existing definitions.
   */


  set(name, value, global) {
    if (global === void 0) {
      global = false;
    }

    if (global) {
      // Global set is equivalent to setting in all groups.  Simulate this
      // by destroying any undos currently scheduled for this name,
      // and adding an undo with the *new* value (in case it later gets
      // locally reset within this environment).
      for (var i = 0; i < this.undefStack.length; i++) {
        delete this.undefStack[i][name];
      }

      if (this.undefStack.length > 0) {
        this.undefStack[this.undefStack.length - 1][name] = value;
      }
    } else {
      // Undo this set at end of this group (possibly to `undefined`),
      // unless an undo is already in place, in which case that older
      // value is the correct one.
      var top = this.undefStack[this.undefStack.length - 1];

      if (top && !top.hasOwnProperty(name)) {
        top[name] = this.current[name];
      }
    }

    if (value == null) {
      delete this.current[name];
    } else {
      this.current[name] = value;
    }
  }

}

/**
 * Predefined macros for KaTeX.
 * This can be used to define some commands in terms of others.
 */
var macros = _macros;
// macro tools

defineMacro("\\noexpand", function (context) {
  // The expansion is the token itself; but that token is interpreted
  // as if its meaning were ‘\relax’ if it is a control sequence that
  // would ordinarily be expanded by TeX’s expansion rules.
  var t = context.popToken();

  if (context.isExpandable(t.text)) {
    t.noexpand = true;
    t.treatAsRelax = true;
  }

  return {
    tokens: [t],
    numArgs: 0
  };
});
defineMacro("\\expandafter", function (context) {
  // TeX first reads the token that comes immediately after \expandafter,
  // without expanding it; let’s call this token t. Then TeX reads the
  // token that comes after t (and possibly more tokens, if that token
  // has an argument), replacing it by its expansion. Finally TeX puts
  // t back in front of that expansion.
  var t = context.popToken();
  context.expandOnce(true); // expand only an expandable token

  return {
    tokens: [t],
    numArgs: 0
  };
}); // LaTeX's \@firstoftwo{#1}{#2} expands to #1, skipping #2
// TeX source: \long\def\@firstoftwo#1#2{#1}

defineMacro("\\@firstoftwo", function (context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[0],
    numArgs: 0
  };
}); // LaTeX's \@secondoftwo{#1}{#2} expands to #2, skipping #1
// TeX source: \long\def\@secondoftwo#1#2{#2}

defineMacro("\\@secondoftwo", function (context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[1],
    numArgs: 0
  };
}); // LaTeX's \@ifnextchar{#1}{#2}{#3} looks ahead to the next (unexpanded)
// symbol that isn't a space, consuming any spaces but not consuming the
// first nonspace character.  If that nonspace character matches #1, then
// the macro expands to #2; otherwise, it expands to #3.

defineMacro("\\@ifnextchar", function (context) {
  var args = context.consumeArgs(3); // symbol, if, else

  context.consumeSpaces();
  var nextToken = context.future();

  if (args[0].length === 1 && args[0][0].text === nextToken.text) {
    return {
      tokens: args[1],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[2],
      numArgs: 0
    };
  }
}); // LaTeX's \@ifstar{#1}{#2} looks ahead to the next (unexpanded) symbol.
// If it is `*`, then it consumes the symbol, and the macro expands to #1;
// otherwise, the macro expands to #2 (without consuming the symbol).
// TeX source: \def\@ifstar#1{\@ifnextchar *{\@firstoftwo{#1}}}

defineMacro("\\@ifstar", "\\@ifnextchar *{\\@firstoftwo{#1}}"); // LaTeX's \TextOrMath{#1}{#2} expands to #1 in text mode, #2 in math mode

defineMacro("\\TextOrMath", function (context) {
  var args = context.consumeArgs(2);

  if (context.mode === 'text') {
    return {
      tokens: args[0],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[1],
      numArgs: 0
    };
  }
}); // Lookup table for parsing numbers in base 8 through 16

var digitToNumber = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "a": 10,
  "A": 10,
  "b": 11,
  "B": 11,
  "c": 12,
  "C": 12,
  "d": 13,
  "D": 13,
  "e": 14,
  "E": 14,
  "f": 15,
  "F": 15
}; // TeX \char makes a literal character (catcode 12) using the following forms:
// (see The TeXBook, p. 43)
//   \char123  -- decimal
//   \char'123 -- octal
//   \char"123 -- hex
//   \char`x   -- character that can be written (i.e. isn't active)
//   \char`\x  -- character that cannot be written (e.g. %)
// These all refer to characters from the font, so we turn them into special
// calls to a function \@char dealt with in the Parser.

defineMacro("\\char", function (context) {
  var token = context.popToken();
  var base;
  var number = '';

  if (token.text === "'") {
    base = 8;
    token = context.popToken();
  } else if (token.text === '"') {
    base = 16;
    token = context.popToken();
  } else if (token.text === "`") {
    token = context.popToken();

    if (token.text[0] === "\\") {
      number = token.text.charCodeAt(1);
    } else if (token.text === "EOF") {
      throw new ParseError("\\char` missing argument");
    } else {
      number = token.text.charCodeAt(0);
    }
  } else {
    base = 10;
  }

  if (base) {
    // Parse a number in the given base, starting with first `token`.
    number = digitToNumber[token.text];

    if (number == null || number >= base) {
      throw new ParseError("Invalid base-" + base + " digit " + token.text);
    }

    var digit;

    while ((digit = digitToNumber[context.future().text]) != null && digit < base) {
      number *= base;
      number += digit;
      context.popToken();
    }
  }

  return "\\@char{" + number + "}";
}); // \newcommand{\macro}[args]{definition}
// \renewcommand{\macro}[args]{definition}
// TODO: Optional arguments: \newcommand{\macro}[args][default]{definition}

var newcommand = (context, existsOK, nonexistsOK, skipIfExists) => {
  var arg = context.consumeArg().tokens;

  if (arg.length !== 1) {
    throw new ParseError("\\newcommand's first argument must be a macro name");
  }

  var name = arg[0].text;
  var exists = context.isDefined(name);

  if (exists && !existsOK) {
    throw new ParseError("\\newcommand{" + name + "} attempting to redefine " + (name + "; use \\renewcommand"));
  }

  if (!exists && !nonexistsOK) {
    throw new ParseError("\\renewcommand{" + name + "} when command " + name + " " + "does not yet exist; use \\newcommand");
  }

  var numArgs = 0;
  arg = context.consumeArg().tokens;

  if (arg.length === 1 && arg[0].text === "[") {
    var argText = '';
    var token = context.expandNextToken();

    while (token.text !== "]" && token.text !== "EOF") {
      // TODO: Should properly expand arg, e.g., ignore {}s
      argText += token.text;
      token = context.expandNextToken();
    }

    if (!argText.match(/^\s*[0-9]+\s*$/)) {
      throw new ParseError("Invalid number of arguments: " + argText);
    }

    numArgs = parseInt(argText);
    arg = context.consumeArg().tokens;
  }

  if (!(exists && skipIfExists)) {
    // Final arg is the expansion of the macro
    context.macros.set(name, {
      tokens: arg,
      numArgs
    });
  }

  return '';
};

defineMacro("\\newcommand", context => newcommand(context, false, true, false));
defineMacro("\\renewcommand", context => newcommand(context, true, false, false));
defineMacro("\\providecommand", context => newcommand(context, true, true, true)); // terminal (console) tools

defineMacro("\\message", context => {
  var arg = context.consumeArgs(1)[0]; // eslint-disable-next-line no-console

  console.log(arg.reverse().map(token => token.text).join(""));
  return '';
});
defineMacro("\\errmessage", context => {
  var arg = context.consumeArgs(1)[0]; // eslint-disable-next-line no-console

  console.error(arg.reverse().map(token => token.text).join(""));
  return '';
});
defineMacro("\\show", context => {
  var tok = context.popToken();
  var name = tok.text; // eslint-disable-next-line no-console

  console.log(tok, context.macros.get(name), functions[name], symbols.math[name], symbols.text[name]);
  return '';
}); //////////////////////////////////////////////////////////////////////
// Grouping
// \let\bgroup={ \let\egroup=}

defineMacro("\\bgroup", "{");
defineMacro("\\egroup", "}"); // Symbols from latex.ltx:
// \def~{\nobreakspace{}}
// \def\lq{`}
// \def\rq{'}
// \def \aa {\r a}
// \def \AA {\r A}

defineMacro("~", "\\nobreakspace");
defineMacro("\\lq", "`");
defineMacro("\\rq", "'");
defineMacro("\\aa", "\\r a");
defineMacro("\\AA", "\\r A"); // Copyright (C) and registered (R) symbols. Use raw symbol in MathML.
// \DeclareTextCommandDefault{\textcopyright}{\textcircled{c}}
// \DeclareTextCommandDefault{\textregistered}{\textcircled{%
//      \check@mathfonts\fontsize\sf@size\z@\math@fontsfalse\selectfont R}}
// \DeclareRobustCommand{\copyright}{%
//    \ifmmode{\nfss@text{\textcopyright}}\else\textcopyright\fi}

defineMacro("\\textcopyright", "\\html@mathml{\\textcircled{c}}{\\char`©}");
defineMacro("\\copyright", "\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");
defineMacro("\\textregistered", "\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`®}"); // Characters omitted from Unicode range 1D400–1D7FF

defineMacro("\u212C", "\\mathscr{B}"); // script

defineMacro("\u2130", "\\mathscr{E}");
defineMacro("\u2131", "\\mathscr{F}");
defineMacro("\u210B", "\\mathscr{H}");
defineMacro("\u2110", "\\mathscr{I}");
defineMacro("\u2112", "\\mathscr{L}");
defineMacro("\u2133", "\\mathscr{M}");
defineMacro("\u211B", "\\mathscr{R}");
defineMacro("\u212D", "\\mathfrak{C}"); // Fraktur

defineMacro("\u210C", "\\mathfrak{H}");
defineMacro("\u2128", "\\mathfrak{Z}"); // Define \Bbbk with a macro that works in both HTML and MathML.

defineMacro("\\Bbbk", "\\Bbb{k}"); // Unicode middle dot
// The KaTeX fonts do not contain U+00B7. Instead, \cdotp displays
// the dot at U+22C5 and gives it punct spacing.

defineMacro("\u00b7", "\\cdotp"); // \llap and \rlap render their contents in text mode

defineMacro("\\llap", "\\mathllap{\\textrm{#1}}");
defineMacro("\\rlap", "\\mathrlap{\\textrm{#1}}");
defineMacro("\\clap", "\\mathclap{\\textrm{#1}}"); // \mathstrut from the TeXbook, p 360

defineMacro("\\mathstrut", "\\vphantom{(}"); // \underbar from TeXbook p 353

defineMacro("\\underbar", "\\underline{\\text{#1}}"); // \not is defined by base/fontmath.ltx via
// \DeclareMathSymbol{\not}{\mathrel}{symbols}{"36}
// It's thus treated like a \mathrel, but defined by a symbol that has zero
// width but extends to the right.  We use \rlap to get that spacing.
// For MathML we write U+0338 here. buildMathML.js will then do the overlay.

defineMacro("\\not", '\\html@mathml{\\mathrel{\\mathrlap\\@not}}{\\char"338}'); // Negated symbols from base/fontmath.ltx:
// \def\neq{\not=} \let\ne=\neq
// \DeclareRobustCommand
//   \notin{\mathrel{\m@th\mathpalette\c@ncel\in}}
// \def\c@ncel#1#2{\m@th\ooalign{$\hfil#1\mkern1mu/\hfil$\crcr$#1#2$}}

defineMacro("\\neq", "\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`≠}}");
defineMacro("\\ne", "\\neq");
defineMacro("\u2260", "\\neq");
defineMacro("\\notin", "\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}" + "{\\mathrel{\\char`∉}}");
defineMacro("\u2209", "\\notin"); // Unicode stacked relations

defineMacro("\u2258", "\\html@mathml{" + "\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}" + "}{\\mathrel{\\char`\u2258}}");
defineMacro("\u2259", "\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}");
defineMacro("\u225A", "\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225A}}");
defineMacro("\u225B", "\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}" + "{\\mathrel{\\char`\u225B}}");
defineMacro("\u225D", "\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}" + "{\\mathrel{\\char`\u225D}}");
defineMacro("\u225E", "\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}" + "{\\mathrel{\\char`\u225E}}");
defineMacro("\u225F", "\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225F}}"); // Misc Unicode

defineMacro("\u27C2", "\\perp");
defineMacro("\u203C", "\\mathclose{!\\mkern-0.8mu!}");
defineMacro("\u220C", "\\notni");
defineMacro("\u231C", "\\ulcorner");
defineMacro("\u231D", "\\urcorner");
defineMacro("\u231E", "\\llcorner");
defineMacro("\u231F", "\\lrcorner");
defineMacro("\u00A9", "\\copyright");
defineMacro("\u00AE", "\\textregistered");
defineMacro("\uFE0F", "\\textregistered"); // The KaTeX fonts have corners at codepoints that don't match Unicode.
// For MathML purposes, use the Unicode code point.

defineMacro("\\ulcorner", "\\html@mathml{\\@ulcorner}{\\mathop{\\char\"231c}}");
defineMacro("\\urcorner", "\\html@mathml{\\@urcorner}{\\mathop{\\char\"231d}}");
defineMacro("\\llcorner", "\\html@mathml{\\@llcorner}{\\mathop{\\char\"231e}}");
defineMacro("\\lrcorner", "\\html@mathml{\\@lrcorner}{\\mathop{\\char\"231f}}"); //////////////////////////////////////////////////////////////////////
// LaTeX_2ε
// \vdots{\vbox{\baselineskip4\p@  \lineskiplimit\z@
// \kern6\p@\hbox{.}\hbox{.}\hbox{.}}}
// We'll call \varvdots, which gets a glyph from symbols.js.
// The zero-width rule gets us an equivalent to the vertical 6pt kern.

defineMacro("\\vdots", "{\\varvdots\\rule{0pt}{15pt}}");
defineMacro("\u22ee", "\\vdots"); //////////////////////////////////////////////////////////////////////
// amsmath.sty
// http://mirrors.concertpass.com/tex-archive/macros/latex/required/amsmath/amsmath.pdf
// Italic Greek capital letters.  AMS defines these with \DeclareMathSymbol,
// but they are equivalent to \mathit{\Letter}.

defineMacro("\\varGamma", "\\mathit{\\Gamma}");
defineMacro("\\varDelta", "\\mathit{\\Delta}");
defineMacro("\\varTheta", "\\mathit{\\Theta}");
defineMacro("\\varLambda", "\\mathit{\\Lambda}");
defineMacro("\\varXi", "\\mathit{\\Xi}");
defineMacro("\\varPi", "\\mathit{\\Pi}");
defineMacro("\\varSigma", "\\mathit{\\Sigma}");
defineMacro("\\varUpsilon", "\\mathit{\\Upsilon}");
defineMacro("\\varPhi", "\\mathit{\\Phi}");
defineMacro("\\varPsi", "\\mathit{\\Psi}");
defineMacro("\\varOmega", "\\mathit{\\Omega}"); //\newcommand{\substack}[1]{\subarray{c}#1\endsubarray}

defineMacro("\\substack", "\\begin{subarray}{c}#1\\end{subarray}"); // \renewcommand{\colon}{\nobreak\mskip2mu\mathpunct{}\nonscript
// \mkern-\thinmuskip{:}\mskip6muplus1mu\relax}

defineMacro("\\colon", "\\nobreak\\mskip2mu\\mathpunct{}" + "\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax"); // \newcommand{\boxed}[1]{\fbox{\m@th$\displaystyle#1$}}

defineMacro("\\boxed", "\\fbox{$\\displaystyle{#1}$}"); // \def\iff{\DOTSB\;\Longleftrightarrow\;}
// \def\implies{\DOTSB\;\Longrightarrow\;}
// \def\impliedby{\DOTSB\;\Longleftarrow\;}

defineMacro("\\iff", "\\DOTSB\\;\\Longleftrightarrow\\;");
defineMacro("\\implies", "\\DOTSB\\;\\Longrightarrow\\;");
defineMacro("\\impliedby", "\\DOTSB\\;\\Longleftarrow\\;"); // \def\dddot#1{{\mathop{#1}\limits^{\vbox to-1.4\ex@{\kern-\tw@\ex@
//  \hbox{\normalfont ...}\vss}}}}
// We use \overset which avoids the vertical shift of \mathop.

defineMacro("\\dddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");
defineMacro("\\ddddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}"); // AMSMath's automatic \dots, based on \mdots@@ macro.

var dotsByToken = {
  ',': '\\dotsc',
  '\\not': '\\dotsb',
  // \keybin@ checks for the following:
  '+': '\\dotsb',
  '=': '\\dotsb',
  '<': '\\dotsb',
  '>': '\\dotsb',
  '-': '\\dotsb',
  '*': '\\dotsb',
  ':': '\\dotsb',
  // Symbols whose definition starts with \DOTSB:
  '\\DOTSB': '\\dotsb',
  '\\coprod': '\\dotsb',
  '\\bigvee': '\\dotsb',
  '\\bigwedge': '\\dotsb',
  '\\biguplus': '\\dotsb',
  '\\bigcap': '\\dotsb',
  '\\bigcup': '\\dotsb',
  '\\prod': '\\dotsb',
  '\\sum': '\\dotsb',
  '\\bigotimes': '\\dotsb',
  '\\bigoplus': '\\dotsb',
  '\\bigodot': '\\dotsb',
  '\\bigsqcup': '\\dotsb',
  '\\And': '\\dotsb',
  '\\longrightarrow': '\\dotsb',
  '\\Longrightarrow': '\\dotsb',
  '\\longleftarrow': '\\dotsb',
  '\\Longleftarrow': '\\dotsb',
  '\\longleftrightarrow': '\\dotsb',
  '\\Longleftrightarrow': '\\dotsb',
  '\\mapsto': '\\dotsb',
  '\\longmapsto': '\\dotsb',
  '\\hookrightarrow': '\\dotsb',
  '\\doteq': '\\dotsb',
  // Symbols whose definition starts with \mathbin:
  '\\mathbin': '\\dotsb',
  // Symbols whose definition starts with \mathrel:
  '\\mathrel': '\\dotsb',
  '\\relbar': '\\dotsb',
  '\\Relbar': '\\dotsb',
  '\\xrightarrow': '\\dotsb',
  '\\xleftarrow': '\\dotsb',
  // Symbols whose definition starts with \DOTSI:
  '\\DOTSI': '\\dotsi',
  '\\int': '\\dotsi',
  '\\oint': '\\dotsi',
  '\\iint': '\\dotsi',
  '\\iiint': '\\dotsi',
  '\\iiiint': '\\dotsi',
  '\\idotsint': '\\dotsi',
  // Symbols whose definition starts with \DOTSX:
  '\\DOTSX': '\\dotsx'
};
defineMacro("\\dots", function (context) {
  // TODO: If used in text mode, should expand to \textellipsis.
  // However, in KaTeX, \textellipsis and \ldots behave the same
  // (in text mode), and it's unlikely we'd see any of the math commands
  // that affect the behavior of \dots when in text mode.  So fine for now
  // (until we support \ifmmode ... \else ... \fi).
  var thedots = '\\dotso';
  var next = context.expandAfterFuture().text;

  if (next in dotsByToken) {
    thedots = dotsByToken[next];
  } else if (next.slice(0, 4) === '\\not') {
    thedots = '\\dotsb';
  } else if (next in symbols.math) {
    if (['bin', 'rel'].includes(symbols.math[next].group)) {
      thedots = '\\dotsb';
    }
  }

  return thedots;
});
var spaceAfterDots = {
  // \rightdelim@ checks for the following:
  ')': true,
  ']': true,
  '\\rbrack': true,
  '\\}': true,
  '\\rbrace': true,
  '\\rangle': true,
  '\\rceil': true,
  '\\rfloor': true,
  '\\rgroup': true,
  '\\rmoustache': true,
  '\\right': true,
  '\\bigr': true,
  '\\biggr': true,
  '\\Bigr': true,
  '\\Biggr': true,
  // \extra@ also tests for the following:
  '$': true,
  // \extrap@ checks for the following:
  ';': true,
  '.': true,
  ',': true
};
defineMacro("\\dotso", function (context) {
  var next = context.future().text;

  if (next in spaceAfterDots) {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\dotsc", function (context) {
  var next = context.future().text; // \dotsc uses \extra@ but not \extrap@, instead specially checking for
  // ';' and '.', but doesn't check for ','.

  if (next in spaceAfterDots && next !== ',') {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\cdots", function (context) {
  var next = context.future().text;

  if (next in spaceAfterDots) {
    return "\\@cdots\\,";
  } else {
    return "\\@cdots";
  }
});
defineMacro("\\dotsb", "\\cdots");
defineMacro("\\dotsm", "\\cdots");
defineMacro("\\dotsi", "\\!\\cdots"); // amsmath doesn't actually define \dotsx, but \dots followed by a macro
// starting with \DOTSX implies \dotso, and then \extra@ detects this case
// and forces the added `\,`.

defineMacro("\\dotsx", "\\ldots\\,"); // \let\DOTSI\relax
// \let\DOTSB\relax
// \let\DOTSX\relax

defineMacro("\\DOTSI", "\\relax");
defineMacro("\\DOTSB", "\\relax");
defineMacro("\\DOTSX", "\\relax"); // Spacing, based on amsmath.sty's override of LaTeX defaults
// \DeclareRobustCommand{\tmspace}[3]{%
//   \ifmmode\mskip#1#2\else\kern#1#3\fi\relax}

defineMacro("\\tmspace", "\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax"); // \renewcommand{\,}{\tmspace+\thinmuskip{.1667em}}
// TODO: math mode should use \thinmuskip

defineMacro("\\,", "\\tmspace+{3mu}{.1667em}"); // \let\thinspace\,

defineMacro("\\thinspace", "\\,"); // \def\>{\mskip\medmuskip}
// \renewcommand{\:}{\tmspace+\medmuskip{.2222em}}
// TODO: \> and math mode of \: should use \medmuskip = 4mu plus 2mu minus 4mu

defineMacro("\\>", "\\mskip{4mu}");
defineMacro("\\:", "\\tmspace+{4mu}{.2222em}"); // \let\medspace\:

defineMacro("\\medspace", "\\:"); // \renewcommand{\;}{\tmspace+\thickmuskip{.2777em}}
// TODO: math mode should use \thickmuskip = 5mu plus 5mu

defineMacro("\\;", "\\tmspace+{5mu}{.2777em}"); // \let\thickspace\;

defineMacro("\\thickspace", "\\;"); // \renewcommand{\!}{\tmspace-\thinmuskip{.1667em}}
// TODO: math mode should use \thinmuskip

defineMacro("\\!", "\\tmspace-{3mu}{.1667em}"); // \let\negthinspace\!

defineMacro("\\negthinspace", "\\!"); // \newcommand{\negmedspace}{\tmspace-\medmuskip{.2222em}}
// TODO: math mode should use \medmuskip

defineMacro("\\negmedspace", "\\tmspace-{4mu}{.2222em}"); // \newcommand{\negthickspace}{\tmspace-\thickmuskip{.2777em}}
// TODO: math mode should use \thickmuskip

defineMacro("\\negthickspace", "\\tmspace-{5mu}{.277em}"); // \def\enspace{\kern.5em }

defineMacro("\\enspace", "\\kern.5em "); // \def\enskip{\hskip.5em\relax}

defineMacro("\\enskip", "\\hskip.5em\\relax"); // \def\quad{\hskip1em\relax}

defineMacro("\\quad", "\\hskip1em\\relax"); // \def\qquad{\hskip2em\relax}

defineMacro("\\qquad", "\\hskip2em\\relax"); // \tag@in@display form of \tag

defineMacro("\\tag", "\\@ifstar\\tag@literal\\tag@paren");
defineMacro("\\tag@paren", "\\tag@literal{({#1})}");
defineMacro("\\tag@literal", context => {
  if (context.macros.get("\\df@tag")) {
    throw new ParseError("Multiple \\tag");
  }

  return "\\gdef\\df@tag{\\text{#1}}";
}); // \renewcommand{\bmod}{\nonscript\mskip-\medmuskip\mkern5mu\mathbin
//   {\operator@font mod}\penalty900
//   \mkern5mu\nonscript\mskip-\medmuskip}
// \newcommand{\pod}[1]{\allowbreak
//   \if@display\mkern18mu\else\mkern8mu\fi(#1)}
// \renewcommand{\pmod}[1]{\pod{{\operator@font mod}\mkern6mu#1}}
// \newcommand{\mod}[1]{\allowbreak\if@display\mkern18mu
//   \else\mkern12mu\fi{\operator@font mod}\,\,#1}
// TODO: math mode should use \medmuskip = 4mu plus 2mu minus 4mu

defineMacro("\\bmod", "\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}" + "\\mathbin{\\rm mod}" + "\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");
defineMacro("\\pod", "\\allowbreak" + "\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");
defineMacro("\\pmod", "\\pod{{\\rm mod}\\mkern6mu#1}");
defineMacro("\\mod", "\\allowbreak" + "\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}" + "{\\rm mod}\\,\\,#1"); //////////////////////////////////////////////////////////////////////
// LaTeX source2e
// \expandafter\let\expandafter\@normalcr
//     \csname\expandafter\@gobble\string\\ \endcsname
// \DeclareRobustCommand\newline{\@normalcr\relax}

defineMacro("\\newline", "\\\\\\relax"); // \def\TeX{T\kern-.1667em\lower.5ex\hbox{E}\kern-.125emX\@}
// TODO: Doesn't normally work in math mode because \@ fails.  KaTeX doesn't
// support \@ yet, so that's omitted, and we add \text so that the result
// doesn't look funny in math mode.

defineMacro("\\TeX", "\\textrm{\\html@mathml{" + "T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX" + "}{TeX}}"); // \DeclareRobustCommand{\LaTeX}{L\kern-.36em%
//         {\sbox\z@ T%
//          \vbox to\ht\z@{\hbox{\check@mathfonts
//                               \fontsize\sf@size\z@
//                               \math@fontsfalse\selectfont
//                               A}%
//                         \vss}%
//         }%
//         \kern-.15em%
//         \TeX}
// This code aligns the top of the A with the T (from the perspective of TeX's
// boxes, though visually the A appears to extend above slightly).
// We compute the corresponding \raisebox when A is rendered in \normalsize
// \scriptstyle, which has a scale factor of 0.7 (see Options.js).

var latexRaiseA = makeEm(fontMetricsData['Main-Regular']["T".charCodeAt(0)][1] - 0.7 * fontMetricsData['Main-Regular']["A".charCodeAt(0)][1]);
defineMacro("\\LaTeX", "\\textrm{\\html@mathml{" + ("L\\kern-.36em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{LaTeX}}"); // New KaTeX logo based on tweaking LaTeX logo

defineMacro("\\KaTeX", "\\textrm{\\html@mathml{" + ("K\\kern-.17em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{KaTeX}}"); // \DeclareRobustCommand\hspace{\@ifstar\@hspacer\@hspace}
// \def\@hspace#1{\hskip  #1\relax}
// \def\@hspacer#1{\vrule \@width\z@\nobreak
//                 \hskip #1\hskip \z@skip}

defineMacro("\\hspace", "\\@ifstar\\@hspacer\\@hspace");
defineMacro("\\@hspace", "\\hskip #1\\relax");
defineMacro("\\@hspacer", "\\rule{0pt}{0pt}\\hskip #1\\relax"); //////////////////////////////////////////////////////////////////////
// mathtools.sty
//\providecommand\ordinarycolon{:}

defineMacro("\\ordinarycolon", ":"); //\def\vcentcolon{\mathrel{\mathop\ordinarycolon}}
//TODO(edemaine): Not yet centered. Fix via \raisebox or #726

defineMacro("\\vcentcolon", "\\mathrel{\\mathop\\ordinarycolon}"); // \providecommand*\dblcolon{\vcentcolon\mathrel{\mkern-.9mu}\vcentcolon}

defineMacro("\\dblcolon", "\\html@mathml{" + "\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}" + "{\\mathop{\\char\"2237}}"); // \providecommand*\coloneqq{\vcentcolon\mathrel{\mkern-1.2mu}=}

defineMacro("\\coloneqq", "\\html@mathml{" + "\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}" + "{\\mathop{\\char\"2254}}"); // ≔
// \providecommand*\Coloneqq{\dblcolon\mathrel{\mkern-1.2mu}=}

defineMacro("\\Coloneqq", "\\html@mathml{" + "\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}" + "{\\mathop{\\char\"2237\\char\"3d}}"); // \providecommand*\coloneq{\vcentcolon\mathrel{\mkern-1.2mu}\mathrel{-}}

defineMacro("\\coloneq", "\\html@mathml{" + "\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}" + "{\\mathop{\\char\"3a\\char\"2212}}"); // \providecommand*\Coloneq{\dblcolon\mathrel{\mkern-1.2mu}\mathrel{-}}

defineMacro("\\Coloneq", "\\html@mathml{" + "\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}" + "{\\mathop{\\char\"2237\\char\"2212}}"); // \providecommand*\eqqcolon{=\mathrel{\mkern-1.2mu}\vcentcolon}

defineMacro("\\eqqcolon", "\\html@mathml{" + "\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}" + "{\\mathop{\\char\"2255}}"); // ≕
// \providecommand*\Eqqcolon{=\mathrel{\mkern-1.2mu}\dblcolon}

defineMacro("\\Eqqcolon", "\\html@mathml{" + "\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}" + "{\\mathop{\\char\"3d\\char\"2237}}"); // \providecommand*\eqcolon{\mathrel{-}\mathrel{\mkern-1.2mu}\vcentcolon}

defineMacro("\\eqcolon", "\\html@mathml{" + "\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}" + "{\\mathop{\\char\"2239}}"); // \providecommand*\Eqcolon{\mathrel{-}\mathrel{\mkern-1.2mu}\dblcolon}

defineMacro("\\Eqcolon", "\\html@mathml{" + "\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}" + "{\\mathop{\\char\"2212\\char\"2237}}"); // \providecommand*\colonapprox{\vcentcolon\mathrel{\mkern-1.2mu}\approx}

defineMacro("\\colonapprox", "\\html@mathml{" + "\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}" + "{\\mathop{\\char\"3a\\char\"2248}}"); // \providecommand*\Colonapprox{\dblcolon\mathrel{\mkern-1.2mu}\approx}

defineMacro("\\Colonapprox", "\\html@mathml{" + "\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}" + "{\\mathop{\\char\"2237\\char\"2248}}"); // \providecommand*\colonsim{\vcentcolon\mathrel{\mkern-1.2mu}\sim}

defineMacro("\\colonsim", "\\html@mathml{" + "\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}" + "{\\mathop{\\char\"3a\\char\"223c}}"); // \providecommand*\Colonsim{\dblcolon\mathrel{\mkern-1.2mu}\sim}

defineMacro("\\Colonsim", "\\html@mathml{" + "\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}" + "{\\mathop{\\char\"2237\\char\"223c}}"); // Some Unicode characters are implemented with macros to mathtools functions.

defineMacro("\u2237", "\\dblcolon"); // ::

defineMacro("\u2239", "\\eqcolon"); // -:

defineMacro("\u2254", "\\coloneqq"); // :=

defineMacro("\u2255", "\\eqqcolon"); // =:

defineMacro("\u2A74", "\\Coloneqq"); // ::=
//////////////////////////////////////////////////////////////////////
// colonequals.sty
// Alternate names for mathtools's macros:

defineMacro("\\ratio", "\\vcentcolon");
defineMacro("\\coloncolon", "\\dblcolon");
defineMacro("\\colonequals", "\\coloneqq");
defineMacro("\\coloncolonequals", "\\Coloneqq");
defineMacro("\\equalscolon", "\\eqqcolon");
defineMacro("\\equalscoloncolon", "\\Eqqcolon");
defineMacro("\\colonminus", "\\coloneq");
defineMacro("\\coloncolonminus", "\\Coloneq");
defineMacro("\\minuscolon", "\\eqcolon");
defineMacro("\\minuscoloncolon", "\\Eqcolon"); // \colonapprox name is same in mathtools and colonequals.

defineMacro("\\coloncolonapprox", "\\Colonapprox"); // \colonsim name is same in mathtools and colonequals.

defineMacro("\\coloncolonsim", "\\Colonsim"); // Additional macros, implemented by analogy with mathtools definitions:

defineMacro("\\simcolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\simcoloncolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");
defineMacro("\\approxcolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\approxcoloncolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}"); // Present in newtxmath, pxfonts and txfonts

defineMacro("\\notni", "\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220C}}");
defineMacro("\\limsup", "\\DOTSB\\operatorname*{lim\\,sup}");
defineMacro("\\liminf", "\\DOTSB\\operatorname*{lim\\,inf}"); //////////////////////////////////////////////////////////////////////
// From amsopn.sty

defineMacro("\\injlim", "\\DOTSB\\operatorname*{inj\\,lim}");
defineMacro("\\projlim", "\\DOTSB\\operatorname*{proj\\,lim}");
defineMacro("\\varlimsup", "\\DOTSB\\operatorname*{\\overline{lim}}");
defineMacro("\\varliminf", "\\DOTSB\\operatorname*{\\underline{lim}}");
defineMacro("\\varinjlim", "\\DOTSB\\operatorname*{\\underrightarrow{lim}}");
defineMacro("\\varprojlim", "\\DOTSB\\operatorname*{\\underleftarrow{lim}}"); //////////////////////////////////////////////////////////////////////
// MathML alternates for KaTeX glyphs in the Unicode private area

defineMacro("\\gvertneqq", "\\html@mathml{\\@gvertneqq}{\u2269}");
defineMacro("\\lvertneqq", "\\html@mathml{\\@lvertneqq}{\u2268}");
defineMacro("\\ngeqq", "\\html@mathml{\\@ngeqq}{\u2271}");
defineMacro("\\ngeqslant", "\\html@mathml{\\@ngeqslant}{\u2271}");
defineMacro("\\nleqq", "\\html@mathml{\\@nleqq}{\u2270}");
defineMacro("\\nleqslant", "\\html@mathml{\\@nleqslant}{\u2270}");
defineMacro("\\nshortmid", "\\html@mathml{\\@nshortmid}{∤}");
defineMacro("\\nshortparallel", "\\html@mathml{\\@nshortparallel}{∦}");
defineMacro("\\nsubseteqq", "\\html@mathml{\\@nsubseteqq}{\u2288}");
defineMacro("\\nsupseteqq", "\\html@mathml{\\@nsupseteqq}{\u2289}");
defineMacro("\\varsubsetneq", "\\html@mathml{\\@varsubsetneq}{⊊}");
defineMacro("\\varsubsetneqq", "\\html@mathml{\\@varsubsetneqq}{⫋}");
defineMacro("\\varsupsetneq", "\\html@mathml{\\@varsupsetneq}{⊋}");
defineMacro("\\varsupsetneqq", "\\html@mathml{\\@varsupsetneqq}{⫌}");
defineMacro("\\imath", "\\html@mathml{\\@imath}{\u0131}");
defineMacro("\\jmath", "\\html@mathml{\\@jmath}{\u0237}"); //////////////////////////////////////////////////////////////////////
// stmaryrd and semantic
// The stmaryrd and semantic packages render the next four items by calling a
// glyph. Those glyphs do not exist in the KaTeX fonts. Hence the macros.

defineMacro("\\llbracket", "\\html@mathml{" + "\\mathopen{[\\mkern-3.2mu[}}" + "{\\mathopen{\\char`\u27e6}}");
defineMacro("\\rrbracket", "\\html@mathml{" + "\\mathclose{]\\mkern-3.2mu]}}" + "{\\mathclose{\\char`\u27e7}}");
defineMacro("\u27e6", "\\llbracket"); // blackboard bold [

defineMacro("\u27e7", "\\rrbracket"); // blackboard bold ]

defineMacro("\\lBrace", "\\html@mathml{" + "\\mathopen{\\{\\mkern-3.2mu[}}" + "{\\mathopen{\\char`\u2983}}");
defineMacro("\\rBrace", "\\html@mathml{" + "\\mathclose{]\\mkern-3.2mu\\}}}" + "{\\mathclose{\\char`\u2984}}");
defineMacro("\u2983", "\\lBrace"); // blackboard bold {

defineMacro("\u2984", "\\rBrace"); // blackboard bold }
// TODO: Create variable sized versions of the last two items. I believe that
// will require new font glyphs.
// The stmaryrd function `\minuso` provides a "Plimsoll" symbol that
// superimposes the characters \circ and \mathminus. Used in chemistry.

defineMacro("\\minuso", "\\mathbin{\\html@mathml{" + "{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}" + "{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}" + "{\\char`⦵}}");
defineMacro("⦵", "\\minuso"); //////////////////////////////////////////////////////////////////////
// texvc.sty
// The texvc package contains macros available in mediawiki pages.
// We omit the functions deprecated at
// https://en.wikipedia.org/wiki/Help:Displaying_a_formula#Deprecated_syntax
// We also omit texvc's \O, which conflicts with \text{\O}

defineMacro("\\darr", "\\downarrow");
defineMacro("\\dArr", "\\Downarrow");
defineMacro("\\Darr", "\\Downarrow");
defineMacro("\\lang", "\\langle");
defineMacro("\\rang", "\\rangle");
defineMacro("\\uarr", "\\uparrow");
defineMacro("\\uArr", "\\Uparrow");
defineMacro("\\Uarr", "\\Uparrow");
defineMacro("\\N", "\\mathbb{N}");
defineMacro("\\R", "\\mathbb{R}");
defineMacro("\\Z", "\\mathbb{Z}");
defineMacro("\\alef", "\\aleph");
defineMacro("\\alefsym", "\\aleph");
defineMacro("\\Alpha", "\\mathrm{A}");
defineMacro("\\Beta", "\\mathrm{B}");
defineMacro("\\bull", "\\bullet");
defineMacro("\\Chi", "\\mathrm{X}");
defineMacro("\\clubs", "\\clubsuit");
defineMacro("\\cnums", "\\mathbb{C}");
defineMacro("\\Complex", "\\mathbb{C}");
defineMacro("\\Dagger", "\\ddagger");
defineMacro("\\diamonds", "\\diamondsuit");
defineMacro("\\empty", "\\emptyset");
defineMacro("\\Epsilon", "\\mathrm{E}");
defineMacro("\\Eta", "\\mathrm{H}");
defineMacro("\\exist", "\\exists");
defineMacro("\\harr", "\\leftrightarrow");
defineMacro("\\hArr", "\\Leftrightarrow");
defineMacro("\\Harr", "\\Leftrightarrow");
defineMacro("\\hearts", "\\heartsuit");
defineMacro("\\image", "\\Im");
defineMacro("\\infin", "\\infty");
defineMacro("\\Iota", "\\mathrm{I}");
defineMacro("\\isin", "\\in");
defineMacro("\\Kappa", "\\mathrm{K}");
defineMacro("\\larr", "\\leftarrow");
defineMacro("\\lArr", "\\Leftarrow");
defineMacro("\\Larr", "\\Leftarrow");
defineMacro("\\lrarr", "\\leftrightarrow");
defineMacro("\\lrArr", "\\Leftrightarrow");
defineMacro("\\Lrarr", "\\Leftrightarrow");
defineMacro("\\Mu", "\\mathrm{M}");
defineMacro("\\natnums", "\\mathbb{N}");
defineMacro("\\Nu", "\\mathrm{N}");
defineMacro("\\Omicron", "\\mathrm{O}");
defineMacro("\\plusmn", "\\pm");
defineMacro("\\rarr", "\\rightarrow");
defineMacro("\\rArr", "\\Rightarrow");
defineMacro("\\Rarr", "\\Rightarrow");
defineMacro("\\real", "\\Re");
defineMacro("\\reals", "\\mathbb{R}");
defineMacro("\\Reals", "\\mathbb{R}");
defineMacro("\\Rho", "\\mathrm{P}");
defineMacro("\\sdot", "\\cdot");
defineMacro("\\sect", "\\S");
defineMacro("\\spades", "\\spadesuit");
defineMacro("\\sub", "\\subset");
defineMacro("\\sube", "\\subseteq");
defineMacro("\\supe", "\\supseteq");
defineMacro("\\Tau", "\\mathrm{T}");
defineMacro("\\thetasym", "\\vartheta"); // TODO: defineMacro("\\varcoppa", "\\\mbox{\\coppa}");

defineMacro("\\weierp", "\\wp");
defineMacro("\\Zeta", "\\mathrm{Z}"); //////////////////////////////////////////////////////////////////////
// statmath.sty
// https://ctan.math.illinois.edu/macros/latex/contrib/statmath/statmath.pdf

defineMacro("\\argmin", "\\DOTSB\\operatorname*{arg\\,min}");
defineMacro("\\argmax", "\\DOTSB\\operatorname*{arg\\,max}");
defineMacro("\\plim", "\\DOTSB\\mathop{\\operatorname{plim}}\\limits"); //////////////////////////////////////////////////////////////////////
// braket.sty
// http://ctan.math.washington.edu/tex-archive/macros/latex/contrib/braket/braket.pdf

defineMacro("\\bra", "\\mathinner{\\langle{#1}|}");
defineMacro("\\ket", "\\mathinner{|{#1}\\rangle}");
defineMacro("\\braket", "\\mathinner{\\langle{#1}\\rangle}");
defineMacro("\\Bra", "\\left\\langle#1\\right|");
defineMacro("\\Ket", "\\left|#1\\right\\rangle");

var braketHelper = one => context => {
  var left = context.consumeArg().tokens;
  var middle = context.consumeArg().tokens;
  var middleDouble = context.consumeArg().tokens;
  var right = context.consumeArg().tokens;
  var oldMiddle = context.macros.get("|");
  var oldMiddleDouble = context.macros.get("\\|");
  context.macros.beginGroup();

  var midMacro = double => context => {
    if (one) {
      // Only modify the first instance of | or \|
      context.macros.set("|", oldMiddle);

      if (middleDouble.length) {
        context.macros.set("\\|", oldMiddleDouble);
      }
    }

    var doubled = double;

    if (!double && middleDouble.length) {
      // Mimic \@ifnextchar
      var nextToken = context.future();

      if (nextToken.text === "|") {
        context.popToken();
        doubled = true;
      }
    }

    return {
      tokens: doubled ? middleDouble : middle,
      numArgs: 0
    };
  };

  context.macros.set("|", midMacro(false));

  if (middleDouble.length) {
    context.macros.set("\\|", midMacro(true));
  }

  var arg = context.consumeArg().tokens;
  var expanded = context.expandTokens([...right, ...arg, ...left // reversed
  ]);
  context.macros.endGroup();
  return {
    tokens: expanded.reverse(),
    numArgs: 0
  };
};

defineMacro("\\bra@ket", braketHelper(false));
defineMacro("\\bra@set", braketHelper(true));
defineMacro("\\Braket", "\\bra@ket{\\left\\langle}" + "{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");
defineMacro("\\Set", "\\bra@set{\\left\\{\\:}" + "{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");
defineMacro("\\set", "\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}"); // has no support for special || or \|
//////////////////////////////////////////////////////////////////////
// actuarialangle.dtx

defineMacro("\\angln", "{\\angl n}"); // Custom Khan Academy colors, should be moved to an optional package

defineMacro("\\blue", "\\textcolor{##6495ed}{#1}");
defineMacro("\\orange", "\\textcolor{##ffa500}{#1}");
defineMacro("\\pink", "\\textcolor{##ff00af}{#1}");
defineMacro("\\red", "\\textcolor{##df0030}{#1}");
defineMacro("\\green", "\\textcolor{##28ae7b}{#1}");
defineMacro("\\gray", "\\textcolor{gray}{#1}");
defineMacro("\\purple", "\\textcolor{##9d38bd}{#1}");
defineMacro("\\blueA", "\\textcolor{##ccfaff}{#1}");
defineMacro("\\blueB", "\\textcolor{##80f6ff}{#1}");
defineMacro("\\blueC", "\\textcolor{##63d9ea}{#1}");
defineMacro("\\blueD", "\\textcolor{##11accd}{#1}");
defineMacro("\\blueE", "\\textcolor{##0c7f99}{#1}");
defineMacro("\\tealA", "\\textcolor{##94fff5}{#1}");
defineMacro("\\tealB", "\\textcolor{##26edd5}{#1}");
defineMacro("\\tealC", "\\textcolor{##01d1c1}{#1}");
defineMacro("\\tealD", "\\textcolor{##01a995}{#1}");
defineMacro("\\tealE", "\\textcolor{##208170}{#1}");
defineMacro("\\greenA", "\\textcolor{##b6ffb0}{#1}");
defineMacro("\\greenB", "\\textcolor{##8af281}{#1}");
defineMacro("\\greenC", "\\textcolor{##74cf70}{#1}");
defineMacro("\\greenD", "\\textcolor{##1fab54}{#1}");
defineMacro("\\greenE", "\\textcolor{##0d923f}{#1}");
defineMacro("\\goldA", "\\textcolor{##ffd0a9}{#1}");
defineMacro("\\goldB", "\\textcolor{##ffbb71}{#1}");
defineMacro("\\goldC", "\\textcolor{##ff9c39}{#1}");
defineMacro("\\goldD", "\\textcolor{##e07d10}{#1}");
defineMacro("\\goldE", "\\textcolor{##a75a05}{#1}");
defineMacro("\\redA", "\\textcolor{##fca9a9}{#1}");
defineMacro("\\redB", "\\textcolor{##ff8482}{#1}");
defineMacro("\\redC", "\\textcolor{##f9685d}{#1}");
defineMacro("\\redD", "\\textcolor{##e84d39}{#1}");
defineMacro("\\redE", "\\textcolor{##bc2612}{#1}");
defineMacro("\\maroonA", "\\textcolor{##ffbde0}{#1}");
defineMacro("\\maroonB", "\\textcolor{##ff92c6}{#1}");
defineMacro("\\maroonC", "\\textcolor{##ed5fa6}{#1}");
defineMacro("\\maroonD", "\\textcolor{##ca337c}{#1}");
defineMacro("\\maroonE", "\\textcolor{##9e034e}{#1}");
defineMacro("\\purpleA", "\\textcolor{##ddd7ff}{#1}");
defineMacro("\\purpleB", "\\textcolor{##c6b9fc}{#1}");
defineMacro("\\purpleC", "\\textcolor{##aa87ff}{#1}");
defineMacro("\\purpleD", "\\textcolor{##7854ab}{#1}");
defineMacro("\\purpleE", "\\textcolor{##543b78}{#1}");
defineMacro("\\mintA", "\\textcolor{##f5f9e8}{#1}");
defineMacro("\\mintB", "\\textcolor{##edf2df}{#1}");
defineMacro("\\mintC", "\\textcolor{##e0e5cc}{#1}");
defineMacro("\\grayA", "\\textcolor{##f6f7f7}{#1}");
defineMacro("\\grayB", "\\textcolor{##f0f1f2}{#1}");
defineMacro("\\grayC", "\\textcolor{##e3e5e6}{#1}");
defineMacro("\\grayD", "\\textcolor{##d6d8da}{#1}");
defineMacro("\\grayE", "\\textcolor{##babec2}{#1}");
defineMacro("\\grayF", "\\textcolor{##888d93}{#1}");
defineMacro("\\grayG", "\\textcolor{##626569}{#1}");
defineMacro("\\grayH", "\\textcolor{##3b3e40}{#1}");
defineMacro("\\grayI", "\\textcolor{##21242c}{#1}");
defineMacro("\\kaBlue", "\\textcolor{##314453}{#1}");
defineMacro("\\kaGreen", "\\textcolor{##71B307}{#1}");

/**
 * This file contains the “gullet” where macros are expanded
 * until only non-macro tokens remain.
 */
// List of commands that act like macros but aren't defined as a macro,
// function, or symbol.  Used in `isDefined`.
var implicitCommands = {
  "^": true,
  // Parser.js
  "_": true,
  // Parser.js
  "\\limits": true,
  // Parser.js
  "\\nolimits": true // Parser.js

};
class MacroExpander {
  constructor(input, settings, mode) {
    this.settings = void 0;
    this.expansionCount = void 0;
    this.lexer = void 0;
    this.macros = void 0;
    this.stack = void 0;
    this.mode = void 0;
    this.settings = settings;
    this.expansionCount = 0;
    this.feed(input); // Make new global namespace

    this.macros = new Namespace(macros, settings.macros);
    this.mode = mode;
    this.stack = []; // contains tokens in REVERSE order
  }
  /**
   * Feed a new input string to the same MacroExpander
   * (with existing macros etc.).
   */


  feed(input) {
    this.lexer = new Lexer(input, this.settings);
  }
  /**
   * Switches between "text" and "math" modes.
   */


  switchMode(newMode) {
    this.mode = newMode;
  }
  /**
   * Start a new group nesting within all namespaces.
   */


  beginGroup() {
    this.macros.beginGroup();
  }
  /**
   * End current group nesting within all namespaces.
   */


  endGroup() {
    this.macros.endGroup();
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */


  endGroups() {
    this.macros.endGroups();
  }
  /**
   * Returns the topmost token on the stack, without expanding it.
   * Similar in behavior to TeX's `\futurelet`.
   */


  future() {
    if (this.stack.length === 0) {
      this.pushToken(this.lexer.lex());
    }

    return this.stack[this.stack.length - 1];
  }
  /**
   * Remove and return the next unexpanded token.
   */


  popToken() {
    this.future(); // ensure non-empty stack

    return this.stack.pop();
  }
  /**
   * Add a given token to the token stack.  In particular, this get be used
   * to put back a token returned from one of the other methods.
   */


  pushToken(token) {
    this.stack.push(token);
  }
  /**
   * Append an array of tokens to the token stack.
   */


  pushTokens(tokens) {
    this.stack.push(...tokens);
  }
  /**
   * Find an macro argument without expanding tokens and append the array of
   * tokens to the token stack. Uses Token as a container for the result.
   */


  scanArgument(isOptional) {
    var start;
    var end;
    var tokens;

    if (isOptional) {
      this.consumeSpaces(); // \@ifnextchar gobbles any space following it

      if (this.future().text !== "[") {
        return null;
      }

      start = this.popToken(); // don't include [ in tokens

      ({
        tokens,
        end
      } = this.consumeArg(["]"]));
    } else {
      ({
        tokens,
        start,
        end
      } = this.consumeArg());
    } // indicate the end of an argument


    this.pushToken(new Token("EOF", end.loc));
    this.pushTokens(tokens);
    return new Token("", SourceLocation.range(start, end));
  }
  /**
   * Consume all following space tokens, without expansion.
   */


  consumeSpaces() {
    for (;;) {
      var token = this.future();

      if (token.text === " ") {
        this.stack.pop();
      } else {
        break;
      }
    }
  }
  /**
   * Consume an argument from the token stream, and return the resulting array
   * of tokens and start/end token.
   */


  consumeArg(delims) {
    // The argument for a delimited parameter is the shortest (possibly
    // empty) sequence of tokens with properly nested {...} groups that is
    // followed ... by this particular list of non-parameter tokens.
    // The argument for an undelimited parameter is the next nonblank
    // token, unless that token is ‘{’, when the argument will be the
    // entire {...} group that follows.
    var tokens = [];
    var isDelimited = delims && delims.length > 0;

    if (!isDelimited) {
      // Ignore spaces between arguments.  As the TeXbook says:
      // "After you have said ‘\def\row#1#2{...}’, you are allowed to
      //  put spaces between the arguments (e.g., ‘\row x n’), because
      //  TeX doesn’t use single spaces as undelimited arguments."
      this.consumeSpaces();
    }

    var start = this.future();
    var tok;
    var depth = 0;
    var match = 0;

    do {
      tok = this.popToken();
      tokens.push(tok);

      if (tok.text === "{") {
        ++depth;
      } else if (tok.text === "}") {
        --depth;

        if (depth === -1) {
          throw new ParseError("Extra }", tok);
        }
      } else if (tok.text === "EOF") {
        throw new ParseError("Unexpected end of input in a macro argument" + ", expected '" + (delims && isDelimited ? delims[match] : "}") + "'", tok);
      }

      if (delims && isDelimited) {
        if ((depth === 0 || depth === 1 && delims[match] === "{") && tok.text === delims[match]) {
          ++match;

          if (match === delims.length) {
            // don't include delims in tokens
            tokens.splice(-match, match);
            break;
          }
        } else {
          match = 0;
        }
      }
    } while (depth !== 0 || isDelimited); // If the argument found ... has the form ‘{<nested tokens>}’,
    // ... the outermost braces enclosing the argument are removed


    if (start.text === "{" && tokens[tokens.length - 1].text === "}") {
      tokens.pop();
      tokens.shift();
    }

    tokens.reverse(); // to fit in with stack order

    return {
      tokens,
      start,
      end: tok
    };
  }
  /**
   * Consume the specified number of (delimited) arguments from the token
   * stream and return the resulting array of arguments.
   */


  consumeArgs(numArgs, delimiters) {
    if (delimiters) {
      if (delimiters.length !== numArgs + 1) {
        throw new ParseError("The length of delimiters doesn't match the number of args!");
      }

      var delims = delimiters[0];

      for (var i = 0; i < delims.length; i++) {
        var tok = this.popToken();

        if (delims[i] !== tok.text) {
          throw new ParseError("Use of the macro doesn't match its definition", tok);
        }
      }
    }

    var args = [];

    for (var _i = 0; _i < numArgs; _i++) {
      args.push(this.consumeArg(delimiters && delimiters[_i + 1]).tokens);
    }

    return args;
  }
  /**
   * Increment `expansionCount` by the specified amount.
   * Throw an error if it exceeds `maxExpand`.
   */


  countExpansion(amount) {
    this.expansionCount += amount;

    if (this.expansionCount > this.settings.maxExpand) {
      throw new ParseError("Too many expansions: infinite loop or " + "need to increase maxExpand setting");
    }
  }
  /**
   * Expand the next token only once if possible.
   *
   * If the token is expanded, the resulting tokens will be pushed onto
   * the stack in reverse order, and the number of such tokens will be
   * returned.  This number might be zero or positive.
   *
   * If not, the return value is `false`, and the next token remains at the
   * top of the stack.
   *
   * In either case, the next token will be on the top of the stack,
   * or the stack will be empty (in case of empty expansion
   * and no other tokens).
   *
   * Used to implement `expandAfterFuture` and `expandNextToken`.
   *
   * If expandableOnly, only expandable tokens are expanded and
   * an undefined control sequence results in an error.
   */


  expandOnce(expandableOnly) {
    var topToken = this.popToken();
    var name = topToken.text;
    var expansion = !topToken.noexpand ? this._getExpansion(name) : null;

    if (expansion == null || expandableOnly && expansion.unexpandable) {
      if (expandableOnly && expansion == null && name[0] === "\\" && !this.isDefined(name)) {
        throw new ParseError("Undefined control sequence: " + name);
      }

      this.pushToken(topToken);
      return false;
    }

    this.countExpansion(1);
    var tokens = expansion.tokens;
    var args = this.consumeArgs(expansion.numArgs, expansion.delimiters);

    if (expansion.numArgs) {
      // paste arguments in place of the placeholders
      tokens = tokens.slice(); // make a shallow copy

      for (var i = tokens.length - 1; i >= 0; --i) {
        var tok = tokens[i];

        if (tok.text === "#") {
          if (i === 0) {
            throw new ParseError("Incomplete placeholder at end of macro body", tok);
          }

          tok = tokens[--i]; // next token on stack

          if (tok.text === "#") {
            // ## → #
            tokens.splice(i + 1, 1); // drop first #
          } else if (/^[1-9]$/.test(tok.text)) {
            // replace the placeholder with the indicated argument
            tokens.splice(i, 2, ...args[+tok.text - 1]);
          } else {
            throw new ParseError("Not a valid argument number", tok);
          }
        }
      }
    } // Concatenate expansion onto top of stack.


    this.pushTokens(tokens);
    return tokens.length;
  }
  /**
   * Expand the next token only once (if possible), and return the resulting
   * top token on the stack (without removing anything from the stack).
   * Similar in behavior to TeX's `\expandafter\futurelet`.
   * Equivalent to expandOnce() followed by future().
   */


  expandAfterFuture() {
    this.expandOnce();
    return this.future();
  }
  /**
   * Recursively expand first token, then return first non-expandable token.
   */


  expandNextToken() {
    for (;;) {
      if (this.expandOnce() === false) {
        // fully expanded
        var token = this.stack.pop(); // the token after \noexpand is interpreted as if its meaning
        // were ‘\relax’

        if (token.treatAsRelax) {
          token.text = "\\relax";
        }

        return token;
      }
    } // Flow unable to figure out that this pathway is impossible.
    // https://github.com/facebook/flow/issues/4808


    throw new Error(); // eslint-disable-line no-unreachable
  }
  /**
   * Fully expand the given macro name and return the resulting list of
   * tokens, or return `undefined` if no such macro is defined.
   */


  expandMacro(name) {
    return this.macros.has(name) ? this.expandTokens([new Token(name)]) : undefined;
  }
  /**
   * Fully expand the given token stream and return the resulting list of
   * tokens.  Note that the input tokens are in reverse order, but the
   * output tokens are in forward order.
   */


  expandTokens(tokens) {
    var output = [];
    var oldStackLength = this.stack.length;
    this.pushTokens(tokens);

    while (this.stack.length > oldStackLength) {
      // Expand only expandable tokens
      if (this.expandOnce(true) === false) {
        // fully expanded
        var token = this.stack.pop();

        if (token.treatAsRelax) {
          // the expansion of \noexpand is the token itself
          token.noexpand = false;
          token.treatAsRelax = false;
        }

        output.push(token);
      }
    } // Count all of these tokens as additional expansions, to prevent
    // exponential blowup from linearly many \edef's.


    this.countExpansion(output.length);
    return output;
  }
  /**
   * Fully expand the given macro name and return the result as a string,
   * or return `undefined` if no such macro is defined.
   */


  expandMacroAsText(name) {
    var tokens = this.expandMacro(name);

    if (tokens) {
      return tokens.map(token => token.text).join("");
    } else {
      return tokens;
    }
  }
  /**
   * Returns the expanded macro as a reversed array of tokens and a macro
   * argument count.  Or returns `null` if no such macro.
   */


  _getExpansion(name) {
    var definition = this.macros.get(name);

    if (definition == null) {
      // mainly checking for undefined here
      return definition;
    } // If a single character has an associated catcode other than 13
    // (active character), then don't expand it.


    if (name.length === 1) {
      var catcode = this.lexer.catcodes[name];

      if (catcode != null && catcode !== 13) {
        return;
      }
    }

    var expansion = typeof definition === "function" ? definition(this) : definition;

    if (typeof expansion === "string") {
      var numArgs = 0;

      if (expansion.indexOf("#") !== -1) {
        var stripped = expansion.replace(/##/g, "");

        while (stripped.indexOf("#" + (numArgs + 1)) !== -1) {
          ++numArgs;
        }
      }

      var bodyLexer = new Lexer(expansion, this.settings);
      var tokens = [];
      var tok = bodyLexer.lex();

      while (tok.text !== "EOF") {
        tokens.push(tok);
        tok = bodyLexer.lex();
      }

      tokens.reverse(); // to fit in with stack using push and pop

      var expanded = {
        tokens,
        numArgs
      };
      return expanded;
    }

    return expansion;
  }
  /**
   * Determine whether a command is currently "defined" (has some
   * functionality), meaning that it's a macro (in the current group),
   * a function, a symbol, or one of the special commands listed in
   * `implicitCommands`.
   */


  isDefined(name) {
    return this.macros.has(name) || functions.hasOwnProperty(name) || symbols.math.hasOwnProperty(name) || symbols.text.hasOwnProperty(name) || implicitCommands.hasOwnProperty(name);
  }
  /**
   * Determine whether a command is expandable.
   */


  isExpandable(name) {
    var macro = this.macros.get(name);
    return macro != null ? typeof macro === "string" || typeof macro === "function" || !macro.unexpandable : functions.hasOwnProperty(name) && !functions[name].primitive;
  }

}

// Helpers for Parser.js handling of Unicode (sub|super)script characters.
var unicodeSubRegEx = /^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/;
var uSubsAndSups = Object.freeze({
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '\u2090': 'a',
  '\u2091': 'e',
  '\u2095': 'h',
  '\u1D62': 'i',
  '\u2C7C': 'j',
  '\u2096': 'k',
  '\u2097': 'l',
  '\u2098': 'm',
  '\u2099': 'n',
  '\u2092': 'o',
  '\u209A': 'p',
  '\u1D63': 'r',
  '\u209B': 's',
  '\u209C': 't',
  '\u1D64': 'u',
  '\u1D65': 'v',
  '\u2093': 'x',
  '\u1D66': 'β',
  '\u1D67': 'γ',
  '\u1D68': 'ρ',
  '\u1D69': '\u03d5',
  '\u1D6A': 'χ',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '\u1D2C': 'A',
  '\u1D2E': 'B',
  '\u1D30': 'D',
  '\u1D31': 'E',
  '\u1D33': 'G',
  '\u1D34': 'H',
  '\u1D35': 'I',
  '\u1D36': 'J',
  '\u1D37': 'K',
  '\u1D38': 'L',
  '\u1D39': 'M',
  '\u1D3A': 'N',
  '\u1D3C': 'O',
  '\u1D3E': 'P',
  '\u1D3F': 'R',
  '\u1D40': 'T',
  '\u1D41': 'U',
  '\u2C7D': 'V',
  '\u1D42': 'W',
  '\u1D43': 'a',
  '\u1D47': 'b',
  '\u1D9C': 'c',
  '\u1D48': 'd',
  '\u1D49': 'e',
  '\u1DA0': 'f',
  '\u1D4D': 'g',
  '\u02B0': 'h',
  '\u2071': 'i',
  '\u02B2': 'j',
  '\u1D4F': 'k',
  '\u02E1': 'l',
  '\u1D50': 'm',
  '\u207F': 'n',
  '\u1D52': 'o',
  '\u1D56': 'p',
  '\u02B3': 'r',
  '\u02E2': 's',
  '\u1D57': 't',
  '\u1D58': 'u',
  '\u1D5B': 'v',
  '\u02B7': 'w',
  '\u02E3': 'x',
  '\u02B8': 'y',
  '\u1DBB': 'z',
  '\u1D5D': 'β',
  '\u1D5E': 'γ',
  '\u1D5F': 'δ',
  '\u1D60': '\u03d5',
  '\u1D61': 'χ',
  '\u1DBF': 'θ'
});

/* eslint no-constant-condition:0 */

var unicodeAccents = {
  "́": {
    "text": "\\'",
    "math": "\\acute"
  },
  "̀": {
    "text": "\\`",
    "math": "\\grave"
  },
  "̈": {
    "text": "\\\"",
    "math": "\\ddot"
  },
  "̃": {
    "text": "\\~",
    "math": "\\tilde"
  },
  "̄": {
    "text": "\\=",
    "math": "\\bar"
  },
  "̆": {
    "text": "\\u",
    "math": "\\breve"
  },
  "̌": {
    "text": "\\v",
    "math": "\\check"
  },
  "̂": {
    "text": "\\^",
    "math": "\\hat"
  },
  "̇": {
    "text": "\\.",
    "math": "\\dot"
  },
  "̊": {
    "text": "\\r",
    "math": "\\mathring"
  },
  "̋": {
    "text": "\\H"
  },
  "̧": {
    "text": "\\c"
  }
};
var unicodeSymbols = {
  "á": "á",
  "à": "à",
  "ä": "ä",
  "ǟ": "ǟ",
  "ã": "ã",
  "ā": "ā",
  "ă": "ă",
  "ắ": "ắ",
  "ằ": "ằ",
  "ẵ": "ẵ",
  "ǎ": "ǎ",
  "â": "â",
  "ấ": "ấ",
  "ầ": "ầ",
  "ẫ": "ẫ",
  "ȧ": "ȧ",
  "ǡ": "ǡ",
  "å": "å",
  "ǻ": "ǻ",
  "ḃ": "ḃ",
  "ć": "ć",
  "ḉ": "ḉ",
  "č": "č",
  "ĉ": "ĉ",
  "ċ": "ċ",
  "ç": "ç",
  "ď": "ď",
  "ḋ": "ḋ",
  "ḑ": "ḑ",
  "é": "é",
  "è": "è",
  "ë": "ë",
  "ẽ": "ẽ",
  "ē": "ē",
  "ḗ": "ḗ",
  "ḕ": "ḕ",
  "ĕ": "ĕ",
  "ḝ": "ḝ",
  "ě": "ě",
  "ê": "ê",
  "ế": "ế",
  "ề": "ề",
  "ễ": "ễ",
  "ė": "ė",
  "ȩ": "ȩ",
  "ḟ": "ḟ",
  "ǵ": "ǵ",
  "ḡ": "ḡ",
  "ğ": "ğ",
  "ǧ": "ǧ",
  "ĝ": "ĝ",
  "ġ": "ġ",
  "ģ": "ģ",
  "ḧ": "ḧ",
  "ȟ": "ȟ",
  "ĥ": "ĥ",
  "ḣ": "ḣ",
  "ḩ": "ḩ",
  "í": "í",
  "ì": "ì",
  "ï": "ï",
  "ḯ": "ḯ",
  "ĩ": "ĩ",
  "ī": "ī",
  "ĭ": "ĭ",
  "ǐ": "ǐ",
  "î": "î",
  "ǰ": "ǰ",
  "ĵ": "ĵ",
  "ḱ": "ḱ",
  "ǩ": "ǩ",
  "ķ": "ķ",
  "ĺ": "ĺ",
  "ľ": "ľ",
  "ļ": "ļ",
  "ḿ": "ḿ",
  "ṁ": "ṁ",
  "ń": "ń",
  "ǹ": "ǹ",
  "ñ": "ñ",
  "ň": "ň",
  "ṅ": "ṅ",
  "ņ": "ņ",
  "ó": "ó",
  "ò": "ò",
  "ö": "ö",
  "ȫ": "ȫ",
  "õ": "õ",
  "ṍ": "ṍ",
  "ṏ": "ṏ",
  "ȭ": "ȭ",
  "ō": "ō",
  "ṓ": "ṓ",
  "ṑ": "ṑ",
  "ŏ": "ŏ",
  "ǒ": "ǒ",
  "ô": "ô",
  "ố": "ố",
  "ồ": "ồ",
  "ỗ": "ỗ",
  "ȯ": "ȯ",
  "ȱ": "ȱ",
  "ő": "ő",
  "ṕ": "ṕ",
  "ṗ": "ṗ",
  "ŕ": "ŕ",
  "ř": "ř",
  "ṙ": "ṙ",
  "ŗ": "ŗ",
  "ś": "ś",
  "ṥ": "ṥ",
  "š": "š",
  "ṧ": "ṧ",
  "ŝ": "ŝ",
  "ṡ": "ṡ",
  "ş": "ş",
  "ẗ": "ẗ",
  "ť": "ť",
  "ṫ": "ṫ",
  "ţ": "ţ",
  "ú": "ú",
  "ù": "ù",
  "ü": "ü",
  "ǘ": "ǘ",
  "ǜ": "ǜ",
  "ǖ": "ǖ",
  "ǚ": "ǚ",
  "ũ": "ũ",
  "ṹ": "ṹ",
  "ū": "ū",
  "ṻ": "ṻ",
  "ŭ": "ŭ",
  "ǔ": "ǔ",
  "û": "û",
  "ů": "ů",
  "ű": "ű",
  "ṽ": "ṽ",
  "ẃ": "ẃ",
  "ẁ": "ẁ",
  "ẅ": "ẅ",
  "ŵ": "ŵ",
  "ẇ": "ẇ",
  "ẘ": "ẘ",
  "ẍ": "ẍ",
  "ẋ": "ẋ",
  "ý": "ý",
  "ỳ": "ỳ",
  "ÿ": "ÿ",
  "ỹ": "ỹ",
  "ȳ": "ȳ",
  "ŷ": "ŷ",
  "ẏ": "ẏ",
  "ẙ": "ẙ",
  "ź": "ź",
  "ž": "ž",
  "ẑ": "ẑ",
  "ż": "ż",
  "Á": "Á",
  "À": "À",
  "Ä": "Ä",
  "Ǟ": "Ǟ",
  "Ã": "Ã",
  "Ā": "Ā",
  "Ă": "Ă",
  "Ắ": "Ắ",
  "Ằ": "Ằ",
  "Ẵ": "Ẵ",
  "Ǎ": "Ǎ",
  "Â": "Â",
  "Ấ": "Ấ",
  "Ầ": "Ầ",
  "Ẫ": "Ẫ",
  "Ȧ": "Ȧ",
  "Ǡ": "Ǡ",
  "Å": "Å",
  "Ǻ": "Ǻ",
  "Ḃ": "Ḃ",
  "Ć": "Ć",
  "Ḉ": "Ḉ",
  "Č": "Č",
  "Ĉ": "Ĉ",
  "Ċ": "Ċ",
  "Ç": "Ç",
  "Ď": "Ď",
  "Ḋ": "Ḋ",
  "Ḑ": "Ḑ",
  "É": "É",
  "È": "È",
  "Ë": "Ë",
  "Ẽ": "Ẽ",
  "Ē": "Ē",
  "Ḗ": "Ḗ",
  "Ḕ": "Ḕ",
  "Ĕ": "Ĕ",
  "Ḝ": "Ḝ",
  "Ě": "Ě",
  "Ê": "Ê",
  "Ế": "Ế",
  "Ề": "Ề",
  "Ễ": "Ễ",
  "Ė": "Ė",
  "Ȩ": "Ȩ",
  "Ḟ": "Ḟ",
  "Ǵ": "Ǵ",
  "Ḡ": "Ḡ",
  "Ğ": "Ğ",
  "Ǧ": "Ǧ",
  "Ĝ": "Ĝ",
  "Ġ": "Ġ",
  "Ģ": "Ģ",
  "Ḧ": "Ḧ",
  "Ȟ": "Ȟ",
  "Ĥ": "Ĥ",
  "Ḣ": "Ḣ",
  "Ḩ": "Ḩ",
  "Í": "Í",
  "Ì": "Ì",
  "Ï": "Ï",
  "Ḯ": "Ḯ",
  "Ĩ": "Ĩ",
  "Ī": "Ī",
  "Ĭ": "Ĭ",
  "Ǐ": "Ǐ",
  "Î": "Î",
  "İ": "İ",
  "Ĵ": "Ĵ",
  "Ḱ": "Ḱ",
  "Ǩ": "Ǩ",
  "Ķ": "Ķ",
  "Ĺ": "Ĺ",
  "Ľ": "Ľ",
  "Ļ": "Ļ",
  "Ḿ": "Ḿ",
  "Ṁ": "Ṁ",
  "Ń": "Ń",
  "Ǹ": "Ǹ",
  "Ñ": "Ñ",
  "Ň": "Ň",
  "Ṅ": "Ṅ",
  "Ņ": "Ņ",
  "Ó": "Ó",
  "Ò": "Ò",
  "Ö": "Ö",
  "Ȫ": "Ȫ",
  "Õ": "Õ",
  "Ṍ": "Ṍ",
  "Ṏ": "Ṏ",
  "Ȭ": "Ȭ",
  "Ō": "Ō",
  "Ṓ": "Ṓ",
  "Ṑ": "Ṑ",
  "Ŏ": "Ŏ",
  "Ǒ": "Ǒ",
  "Ô": "Ô",
  "Ố": "Ố",
  "Ồ": "Ồ",
  "Ỗ": "Ỗ",
  "Ȯ": "Ȯ",
  "Ȱ": "Ȱ",
  "Ő": "Ő",
  "Ṕ": "Ṕ",
  "Ṗ": "Ṗ",
  "Ŕ": "Ŕ",
  "Ř": "Ř",
  "Ṙ": "Ṙ",
  "Ŗ": "Ŗ",
  "Ś": "Ś",
  "Ṥ": "Ṥ",
  "Š": "Š",
  "Ṧ": "Ṧ",
  "Ŝ": "Ŝ",
  "Ṡ": "Ṡ",
  "Ş": "Ş",
  "Ť": "Ť",
  "Ṫ": "Ṫ",
  "Ţ": "Ţ",
  "Ú": "Ú",
  "Ù": "Ù",
  "Ü": "Ü",
  "Ǘ": "Ǘ",
  "Ǜ": "Ǜ",
  "Ǖ": "Ǖ",
  "Ǚ": "Ǚ",
  "Ũ": "Ũ",
  "Ṹ": "Ṹ",
  "Ū": "Ū",
  "Ṻ": "Ṻ",
  "Ŭ": "Ŭ",
  "Ǔ": "Ǔ",
  "Û": "Û",
  "Ů": "Ů",
  "Ű": "Ű",
  "Ṽ": "Ṽ",
  "Ẃ": "Ẃ",
  "Ẁ": "Ẁ",
  "Ẅ": "Ẅ",
  "Ŵ": "Ŵ",
  "Ẇ": "Ẇ",
  "Ẍ": "Ẍ",
  "Ẋ": "Ẋ",
  "Ý": "Ý",
  "Ỳ": "Ỳ",
  "Ÿ": "Ÿ",
  "Ỹ": "Ỹ",
  "Ȳ": "Ȳ",
  "Ŷ": "Ŷ",
  "Ẏ": "Ẏ",
  "Ź": "Ź",
  "Ž": "Ž",
  "Ẑ": "Ẑ",
  "Ż": "Ż",
  "ά": "ά",
  "ὰ": "ὰ",
  "ᾱ": "ᾱ",
  "ᾰ": "ᾰ",
  "έ": "έ",
  "ὲ": "ὲ",
  "ή": "ή",
  "ὴ": "ὴ",
  "ί": "ί",
  "ὶ": "ὶ",
  "ϊ": "ϊ",
  "ΐ": "ΐ",
  "ῒ": "ῒ",
  "ῑ": "ῑ",
  "ῐ": "ῐ",
  "ό": "ό",
  "ὸ": "ὸ",
  "ύ": "ύ",
  "ὺ": "ὺ",
  "ϋ": "ϋ",
  "ΰ": "ΰ",
  "ῢ": "ῢ",
  "ῡ": "ῡ",
  "ῠ": "ῠ",
  "ώ": "ώ",
  "ὼ": "ὼ",
  "Ύ": "Ύ",
  "Ὺ": "Ὺ",
  "Ϋ": "Ϋ",
  "Ῡ": "Ῡ",
  "Ῠ": "Ῠ",
  "Ώ": "Ώ",
  "Ὼ": "Ὼ"
};

/**
 * This file contains the parser used to parse out a TeX expression from the
 * input. Since TeX isn't context-free, standard parsers don't work particularly
 * well.
 *
 * The strategy of this parser is as such:
 *
 * The main functions (the `.parse...` ones) take a position in the current
 * parse string to parse tokens from. The lexer (found in Lexer.js, stored at
 * this.gullet.lexer) also supports pulling out tokens at arbitrary places. When
 * individual tokens are needed at a position, the lexer is called to pull out a
 * token, which is then used.
 *
 * The parser has a property called "mode" indicating the mode that
 * the parser is currently in. Currently it has to be one of "math" or
 * "text", which denotes whether the current environment is a math-y
 * one or a text-y one (e.g. inside \text). Currently, this serves to
 * limit the functions which can be used in text mode.
 *
 * The main functions then return an object which contains the useful data that
 * was parsed at its given point, and a new position at the end of the parsed
 * data. The main functions can call each other and continue the parsing by
 * using the returned position as a new starting point.
 *
 * There are also extra `.handle...` functions, which pull out some reused
 * functionality into self-contained functions.
 *
 * The functions return ParseNodes.
 */
class Parser {
  constructor(input, settings) {
    this.mode = void 0;
    this.gullet = void 0;
    this.settings = void 0;
    this.leftrightDepth = void 0;
    this.nextToken = void 0;
    // Start in math mode
    this.mode = "math"; // Create a new macro expander (gullet) and (indirectly via that) also a
    // new lexer (mouth) for this parser (stomach, in the language of TeX)

    this.gullet = new MacroExpander(input, settings, this.mode); // Store the settings for use in parsing

    this.settings = settings; // Count leftright depth (for \middle errors)

    this.leftrightDepth = 0;
  }
  /**
   * Checks a result to make sure it has the right type, and throws an
   * appropriate error otherwise.
   */


  expect(text, consume) {
    if (consume === void 0) {
      consume = true;
    }

    if (this.fetch().text !== text) {
      throw new ParseError("Expected '" + text + "', got '" + this.fetch().text + "'", this.fetch());
    }

    if (consume) {
      this.consume();
    }
  }
  /**
   * Discards the current lookahead token, considering it consumed.
   */


  consume() {
    this.nextToken = null;
  }
  /**
   * Return the current lookahead token, or if there isn't one (at the
   * beginning, or if the previous lookahead token was consume()d),
   * fetch the next token as the new lookahead token and return it.
   */


  fetch() {
    if (this.nextToken == null) {
      this.nextToken = this.gullet.expandNextToken();
    }

    return this.nextToken;
  }
  /**
   * Switches between "text" and "math" modes.
   */


  switchMode(newMode) {
    this.mode = newMode;
    this.gullet.switchMode(newMode);
  }
  /**
   * Main parsing function, which parses an entire input.
   */


  parse() {
    if (!this.settings.globalGroup) {
      // Create a group namespace for the math expression.
      // (LaTeX creates a new group for every $...$, $$...$$, \[...\].)
      this.gullet.beginGroup();
    } // Use old \color behavior (same as LaTeX's \textcolor) if requested.
    // We do this within the group for the math expression, so it doesn't
    // pollute settings.macros.


    if (this.settings.colorIsTextColor) {
      this.gullet.macros.set("\\color", "\\textcolor");
    }

    try {
      // Try to parse the input
      var parse = this.parseExpression(false); // If we succeeded, make sure there's an EOF at the end

      this.expect("EOF"); // End the group namespace for the expression

      if (!this.settings.globalGroup) {
        this.gullet.endGroup();
      }

      return parse; // Close any leftover groups in case of a parse error.
    } finally {
      this.gullet.endGroups();
    }
  }
  /**
   * Fully parse a separate sequence of tokens as a separate job.
   * Tokens should be specified in reverse order, as in a MacroDefinition.
   */


  subparse(tokens) {
    // Save the next token from the current job.
    var oldToken = this.nextToken;
    this.consume(); // Run the new job, terminating it with an excess '}'

    this.gullet.pushToken(new Token("}"));
    this.gullet.pushTokens(tokens);
    var parse = this.parseExpression(false);
    this.expect("}"); // Restore the next token from the current job.

    this.nextToken = oldToken;
    return parse;
  }

  /**
   * Parses an "expression", which is a list of atoms.
   *
   * `breakOnInfix`: Should the parsing stop when we hit infix nodes? This
   *                 happens when functions have higher precedence han infix
   *                 nodes in implicit parses.
   *
   * `breakOnTokenText`: The text of the token that the expression should end
   *                     with, or `null` if something else should end the
   *                     expression.
   */
  parseExpression(breakOnInfix, breakOnTokenText) {
    var body = []; // Keep adding atoms to the body until we can't parse any more atoms (either
    // we reached the end, a }, or a \right)

    while (true) {
      // Ignore spaces in math mode
      if (this.mode === "math") {
        this.consumeSpaces();
      }

      var lex = this.fetch();

      if (Parser.endOfExpression.indexOf(lex.text) !== -1) {
        break;
      }

      if (breakOnTokenText && lex.text === breakOnTokenText) {
        break;
      }

      if (breakOnInfix && functions[lex.text] && functions[lex.text].infix) {
        break;
      }

      var atom = this.parseAtom(breakOnTokenText);

      if (!atom) {
        break;
      } else if (atom.type === "internal") {
        // Internal nodes do not appear in parse tree
        continue;
      }

      body.push(atom);
    }

    if (this.mode === "text") {
      this.formLigatures(body);
    }

    return this.handleInfixNodes(body);
  }
  /**
   * Rewrites infix operators such as \over with corresponding commands such
   * as \frac.
   *
   * There can only be one infix operator per group.  If there's more than one
   * then the expression is ambiguous.  This can be resolved by adding {}.
   */


  handleInfixNodes(body) {
    var overIndex = -1;
    var funcName;

    for (var i = 0; i < body.length; i++) {
      if (body[i].type === "infix") {
        if (overIndex !== -1) {
          throw new ParseError("only one infix operator per group", body[i].token);
        }

        overIndex = i;
        funcName = body[i].replaceWith;
      }
    }

    if (overIndex !== -1 && funcName) {
      var numerNode;
      var denomNode;
      var numerBody = body.slice(0, overIndex);
      var denomBody = body.slice(overIndex + 1);

      if (numerBody.length === 1 && numerBody[0].type === "ordgroup") {
        numerNode = numerBody[0];
      } else {
        numerNode = {
          type: "ordgroup",
          mode: this.mode,
          body: numerBody
        };
      }

      if (denomBody.length === 1 && denomBody[0].type === "ordgroup") {
        denomNode = denomBody[0];
      } else {
        denomNode = {
          type: "ordgroup",
          mode: this.mode,
          body: denomBody
        };
      }

      var node;

      if (funcName === "\\\\abovefrac") {
        node = this.callFunction(funcName, [numerNode, body[overIndex], denomNode], []);
      } else {
        node = this.callFunction(funcName, [numerNode, denomNode], []);
      }

      return [node];
    } else {
      return body;
    }
  }
  /**
   * Handle a subscript or superscript with nice errors.
   */


  handleSupSubscript(name // For error reporting.
  ) {
    var symbolToken = this.fetch();
    var symbol = symbolToken.text;
    this.consume();
    this.consumeSpaces(); // ignore spaces before sup/subscript argument
    // Skip over allowed internal nodes such as \relax

    var group;

    do {
      var _group;

      group = this.parseGroup(name);
    } while (((_group = group) == null ? void 0 : _group.type) === "internal");

    if (!group) {
      throw new ParseError("Expected group after '" + symbol + "'", symbolToken);
    }

    return group;
  }
  /**
   * Converts the textual input of an unsupported command into a text node
   * contained within a color node whose color is determined by errorColor
   */


  formatUnsupportedCmd(text) {
    var textordArray = [];

    for (var i = 0; i < text.length; i++) {
      textordArray.push({
        type: "textord",
        mode: "text",
        text: text[i]
      });
    }

    var textNode = {
      type: "text",
      mode: this.mode,
      body: textordArray
    };
    var colorNode = {
      type: "color",
      mode: this.mode,
      color: this.settings.errorColor,
      body: [textNode]
    };
    return colorNode;
  }
  /**
   * Parses a group with optional super/subscripts.
   */


  parseAtom(breakOnTokenText) {
    // The body of an atom is an implicit group, so that things like
    // \left(x\right)^2 work correctly.
    var base = this.parseGroup("atom", breakOnTokenText); // Internal nodes (e.g. \relax) cannot support super/subscripts.
    // Instead we will pick up super/subscripts with blank base next round.

    if ((base == null ? void 0 : base.type) === "internal") {
      return base;
    } // In text mode, we don't have superscripts or subscripts


    if (this.mode === "text") {
      return base;
    } // Note that base may be empty (i.e. null) at this point.


    var superscript;
    var subscript;

    while (true) {
      // Guaranteed in math mode, so eat any spaces first.
      this.consumeSpaces(); // Lex the first token

      var lex = this.fetch();

      if (lex.text === "\\limits" || lex.text === "\\nolimits") {
        // We got a limit control
        if (base && base.type === "op") {
          var limits = lex.text === "\\limits";
          base.limits = limits;
          base.alwaysHandleSupSub = true;
        } else if (base && base.type === "operatorname") {
          if (base.alwaysHandleSupSub) {
            base.limits = lex.text === "\\limits";
          }
        } else {
          throw new ParseError("Limit controls must follow a math operator", lex);
        }

        this.consume();
      } else if (lex.text === "^") {
        // We got a superscript start
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }

        superscript = this.handleSupSubscript("superscript");
      } else if (lex.text === "_") {
        // We got a subscript start
        if (subscript) {
          throw new ParseError("Double subscript", lex);
        }

        subscript = this.handleSupSubscript("subscript");
      } else if (lex.text === "'") {
        // We got a prime
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }

        var prime = {
          type: "textord",
          mode: this.mode,
          text: "\\prime"
        }; // Many primes can be grouped together, so we handle this here

        var primes = [prime];
        this.consume(); // Keep lexing tokens until we get something that's not a prime

        while (this.fetch().text === "'") {
          // For each one, add another prime to the list
          primes.push(prime);
          this.consume();
        } // If there's a superscript following the primes, combine that
        // superscript in with the primes.


        if (this.fetch().text === "^") {
          primes.push(this.handleSupSubscript("superscript"));
        } // Put everything into an ordgroup as the superscript


        superscript = {
          type: "ordgroup",
          mode: this.mode,
          body: primes
        };
      } else if (uSubsAndSups[lex.text]) {
        // A Unicode subscript or superscript character.
        // We treat these similarly to the unicode-math package.
        // So we render a string of Unicode (sub|super)scripts the
        // same as a (sub|super)script of regular characters.
        var isSub = unicodeSubRegEx.test(lex.text);
        var subsupTokens = [];
        subsupTokens.push(new Token(uSubsAndSups[lex.text]));
        this.consume(); // Continue fetching tokens to fill out the string.

        while (true) {
          var token = this.fetch().text;

          if (!uSubsAndSups[token]) {
            break;
          }

          if (unicodeSubRegEx.test(token) !== isSub) {
            break;
          }

          subsupTokens.unshift(new Token(uSubsAndSups[token]));
          this.consume();
        } // Now create a (sub|super)script.


        var body = this.subparse(subsupTokens);

        if (isSub) {
          subscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        } else {
          superscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        }
      } else {
        // If it wasn't ^, _, or ', stop parsing super/subscripts
        break;
      }
    } // Base must be set if superscript or subscript are set per logic above,
    // but need to check here for type check to pass.


    if (superscript || subscript) {
      // If we got either a superscript or subscript, create a supsub
      return {
        type: "supsub",
        mode: this.mode,
        base: base,
        sup: superscript,
        sub: subscript
      };
    } else {
      // Otherwise return the original body
      return base;
    }
  }
  /**
   * Parses an entire function, including its base and all of its arguments.
   */


  parseFunction(breakOnTokenText, name // For determining its context
  ) {
    var token = this.fetch();
    var func = token.text;
    var funcData = functions[func];

    if (!funcData) {
      return null;
    }

    this.consume(); // consume command token

    if (name && name !== "atom" && !funcData.allowedInArgument) {
      throw new ParseError("Got function '" + func + "' with no arguments" + (name ? " as " + name : ""), token);
    } else if (this.mode === "text" && !funcData.allowedInText) {
      throw new ParseError("Can't use function '" + func + "' in text mode", token);
    } else if (this.mode === "math" && funcData.allowedInMath === false) {
      throw new ParseError("Can't use function '" + func + "' in math mode", token);
    }

    var {
      args,
      optArgs
    } = this.parseArguments(func, funcData);
    return this.callFunction(func, args, optArgs, token, breakOnTokenText);
  }
  /**
   * Call a function handler with a suitable context and arguments.
   */


  callFunction(name, args, optArgs, token, breakOnTokenText) {
    var context = {
      funcName: name,
      parser: this,
      token,
      breakOnTokenText
    };
    var func = functions[name];

    if (func && func.handler) {
      return func.handler(context, args, optArgs);
    } else {
      throw new ParseError("No function handler for " + name);
    }
  }
  /**
   * Parses the arguments of a function or environment
   */


  parseArguments(func, // Should look like "\name" or "\begin{name}".
  funcData) {
    var totalArgs = funcData.numArgs + funcData.numOptionalArgs;

    if (totalArgs === 0) {
      return {
        args: [],
        optArgs: []
      };
    }

    var args = [];
    var optArgs = [];

    for (var i = 0; i < totalArgs; i++) {
      var argType = funcData.argTypes && funcData.argTypes[i];
      var isOptional = i < funcData.numOptionalArgs;

      if (funcData.primitive && argType == null || // \sqrt expands into primitive if optional argument doesn't exist
      funcData.type === "sqrt" && i === 1 && optArgs[0] == null) {
        argType = "primitive";
      }

      var arg = this.parseGroupOfType("argument to '" + func + "'", argType, isOptional);

      if (isOptional) {
        optArgs.push(arg);
      } else if (arg != null) {
        args.push(arg);
      } else {
        // should be unreachable
        throw new ParseError("Null argument, please report this as a bug");
      }
    }

    return {
      args,
      optArgs
    };
  }
  /**
   * Parses a group when the mode is changing.
   */


  parseGroupOfType(name, type, optional) {
    switch (type) {
      case "color":
        return this.parseColorGroup(optional);

      case "size":
        return this.parseSizeGroup(optional);

      case "url":
        return this.parseUrlGroup(optional);

      case "math":
      case "text":
        return this.parseArgumentGroup(optional, type);

      case "hbox":
        {
          // hbox argument type wraps the argument in the equivalent of
          // \hbox, which is like \text but switching to \textstyle size.
          var group = this.parseArgumentGroup(optional, "text");
          return group != null ? {
            type: "styling",
            mode: group.mode,
            body: [group],
            style: "text" // simulate \textstyle

          } : null;
        }

      case "raw":
        {
          var token = this.parseStringGroup("raw", optional);
          return token != null ? {
            type: "raw",
            mode: "text",
            string: token.text
          } : null;
        }

      case "primitive":
        {
          if (optional) {
            throw new ParseError("A primitive argument cannot be optional");
          }

          var _group2 = this.parseGroup(name);

          if (_group2 == null) {
            throw new ParseError("Expected group as " + name, this.fetch());
          }

          return _group2;
        }

      case "original":
      case null:
      case undefined:
        return this.parseArgumentGroup(optional);

      default:
        throw new ParseError("Unknown group type as " + name, this.fetch());
    }
  }
  /**
   * Discard any space tokens, fetching the next non-space token.
   */


  consumeSpaces() {
    while (this.fetch().text === " ") {
      this.consume();
    }
  }
  /**
   * Parses a group, essentially returning the string formed by the
   * brace-enclosed tokens plus some position information.
   */


  parseStringGroup(modeName, // Used to describe the mode in error messages.
  optional) {
    var argToken = this.gullet.scanArgument(optional);

    if (argToken == null) {
      return null;
    }

    var str = "";
    var nextToken;

    while ((nextToken = this.fetch()).text !== "EOF") {
      str += nextToken.text;
      this.consume();
    }

    this.consume(); // consume the end of the argument

    argToken.text = str;
    return argToken;
  }
  /**
   * Parses a regex-delimited group: the largest sequence of tokens
   * whose concatenated strings match `regex`. Returns the string
   * formed by the tokens plus some position information.
   */


  parseRegexGroup(regex, modeName // Used to describe the mode in error messages.
  ) {
    var firstToken = this.fetch();
    var lastToken = firstToken;
    var str = "";
    var nextToken;

    while ((nextToken = this.fetch()).text !== "EOF" && regex.test(str + nextToken.text)) {
      lastToken = nextToken;
      str += lastToken.text;
      this.consume();
    }

    if (str === "") {
      throw new ParseError("Invalid " + modeName + ": '" + firstToken.text + "'", firstToken);
    }

    return firstToken.range(lastToken, str);
  }
  /**
   * Parses a color description.
   */


  parseColorGroup(optional) {
    var res = this.parseStringGroup("color", optional);

    if (res == null) {
      return null;
    }

    var match = /^(#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-f0-9]{6}|[a-z]+)$/i.exec(res.text);

    if (!match) {
      throw new ParseError("Invalid color: '" + res.text + "'", res);
    }

    var color = match[0];

    if (/^[0-9a-f]{6}$/i.test(color)) {
      // We allow a 6-digit HTML color spec without a leading "#".
      // This follows the xcolor package's HTML color model.
      // Predefined color names are all missed by this RegEx pattern.
      color = "#" + color;
    }

    return {
      type: "color-token",
      mode: this.mode,
      color
    };
  }
  /**
   * Parses a size specification, consisting of magnitude and unit.
   */


  parseSizeGroup(optional) {
    var res;
    var isBlank = false; // don't expand before parseStringGroup

    this.gullet.consumeSpaces();

    if (!optional && this.gullet.future().text !== "{") {
      res = this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/, "size");
    } else {
      res = this.parseStringGroup("size", optional);
    }

    if (!res) {
      return null;
    }

    if (!optional && res.text.length === 0) {
      // Because we've tested for what is !optional, this block won't
      // affect \kern, \hspace, etc. It will capture the mandatory arguments
      // to \genfrac and \above.
      res.text = "0pt"; // Enable \above{}

      isBlank = true; // This is here specifically for \genfrac
    }

    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(res.text);

    if (!match) {
      throw new ParseError("Invalid size: '" + res.text + "'", res);
    }

    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };

    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "'", res);
    }

    return {
      type: "size",
      mode: this.mode,
      value: data,
      isBlank
    };
  }
  /**
   * Parses an URL, checking escaped letters and allowed protocols,
   * and setting the catcode of % as an active character (as in \hyperref).
   */


  parseUrlGroup(optional) {
    this.gullet.lexer.setCatcode("%", 13); // active character

    this.gullet.lexer.setCatcode("~", 12); // other character

    var res = this.parseStringGroup("url", optional);
    this.gullet.lexer.setCatcode("%", 14); // comment character

    this.gullet.lexer.setCatcode("~", 13); // active character

    if (res == null) {
      return null;
    } // hyperref package allows backslashes alone in href, but doesn't
    // generate valid links in such cases; we interpret this as
    // "undefined" behaviour, and keep them as-is. Some browser will
    // replace backslashes with forward slashes.


    var url = res.text.replace(/\\([#$%&~_^{}])/g, '$1');
    return {
      type: "url",
      mode: this.mode,
      url
    };
  }
  /**
   * Parses an argument with the mode specified.
   */


  parseArgumentGroup(optional, mode) {
    var argToken = this.gullet.scanArgument(optional);

    if (argToken == null) {
      return null;
    }

    var outerMode = this.mode;

    if (mode) {
      // Switch to specified mode
      this.switchMode(mode);
    }

    this.gullet.beginGroup();
    var expression = this.parseExpression(false, "EOF"); // TODO: find an alternative way to denote the end

    this.expect("EOF"); // expect the end of the argument

    this.gullet.endGroup();
    var result = {
      type: "ordgroup",
      mode: this.mode,
      loc: argToken.loc,
      body: expression
    };

    if (mode) {
      // Switch mode back
      this.switchMode(outerMode);
    }

    return result;
  }
  /**
   * Parses an ordinary group, which is either a single nucleus (like "x")
   * or an expression in braces (like "{x+y}") or an implicit group, a group
   * that starts at the current position, and ends right before a higher explicit
   * group ends, or at EOF.
   */


  parseGroup(name, // For error reporting.
  breakOnTokenText) {
    var firstToken = this.fetch();
    var text = firstToken.text;
    var result; // Try to parse an open brace or \begingroup

    if (text === "{" || text === "\\begingroup") {
      this.consume();
      var groupEnd = text === "{" ? "}" : "\\endgroup";
      this.gullet.beginGroup(); // If we get a brace, parse an expression

      var expression = this.parseExpression(false, groupEnd);
      var lastToken = this.fetch();
      this.expect(groupEnd); // Check that we got a matching closing brace

      this.gullet.endGroup();
      result = {
        type: "ordgroup",
        mode: this.mode,
        loc: SourceLocation.range(firstToken, lastToken),
        body: expression,
        // A group formed by \begingroup...\endgroup is a semi-simple group
        // which doesn't affect spacing in math mode, i.e., is transparent.
        // https://tex.stackexchange.com/questions/1930/when-should-one-
        // use-begingroup-instead-of-bgroup
        semisimple: text === "\\begingroup" || undefined
      };
    } else {
      // If there exists a function with this name, parse the function.
      // Otherwise, just return a nucleus
      result = this.parseFunction(breakOnTokenText, name) || this.parseSymbol();

      if (result == null && text[0] === "\\" && !implicitCommands.hasOwnProperty(text)) {
        if (this.settings.throwOnError) {
          throw new ParseError("Undefined control sequence: " + text, firstToken);
        }

        result = this.formatUnsupportedCmd(text);
        this.consume();
      }
    }

    return result;
  }
  /**
   * Form ligature-like combinations of characters for text mode.
   * This includes inputs like "--", "---", "``" and "''".
   * The result will simply replace multiple textord nodes with a single
   * character in each value by a single textord node having multiple
   * characters in its value.  The representation is still ASCII source.
   * The group will be modified in place.
   */


  formLigatures(group) {
    var n = group.length - 1;

    for (var i = 0; i < n; ++i) {
      var a = group[i]; // $FlowFixMe: Not every node type has a `text` property.

      var v = a.text;

      if (v === "-" && group[i + 1].text === "-") {
        if (i + 1 < n && group[i + 2].text === "-") {
          group.splice(i, 3, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a, group[i + 2]),
            text: "---"
          });
          n -= 2;
        } else {
          group.splice(i, 2, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a, group[i + 1]),
            text: "--"
          });
          n -= 1;
        }
      }

      if ((v === "'" || v === "`") && group[i + 1].text === v) {
        group.splice(i, 2, {
          type: "textord",
          mode: "text",
          loc: SourceLocation.range(a, group[i + 1]),
          text: v + v
        });
        n -= 1;
      }
    }
  }
  /**
   * Parse a single symbol out of the string. Here, we handle single character
   * symbols and special functions like \verb.
   */


  parseSymbol() {
    var nucleus = this.fetch();
    var text = nucleus.text;

    if (/^\\verb[^a-zA-Z]/.test(text)) {
      this.consume();
      var arg = text.slice(5);
      var star = arg.charAt(0) === "*";

      if (star) {
        arg = arg.slice(1);
      } // Lexer's tokenRegex is constructed to always have matching
      // first/last characters.


      if (arg.length < 2 || arg.charAt(0) !== arg.slice(-1)) {
        throw new ParseError("\\verb assertion failed --\n                    please report what input caused this bug");
      }

      arg = arg.slice(1, -1); // remove first and last char

      return {
        type: "verb",
        mode: "text",
        body: arg,
        star
      };
    } // At this point, we should have a symbol, possibly with accents.
    // First expand any accented base symbol according to unicodeSymbols.


    if (unicodeSymbols.hasOwnProperty(text[0]) && !symbols[this.mode][text[0]]) {
      // This behavior is not strict (XeTeX-compatible) in math mode.
      if (this.settings.strict && this.mode === "math") {
        this.settings.reportNonstrict("unicodeTextInMathMode", "Accented Unicode text character \"" + text[0] + "\" used in " + "math mode", nucleus);
      }

      text = unicodeSymbols[text[0]] + text.slice(1);
    } // Strip off any combining characters


    var match = combiningDiacriticalMarksEndRegex.exec(text);

    if (match) {
      text = text.substring(0, match.index);

      if (text === 'i') {
        text = '\u0131'; // dotless i, in math and text mode
      } else if (text === 'j') {
        text = '\u0237'; // dotless j, in math and text mode
      }
    } // Recognize base symbol


    var symbol;

    if (symbols[this.mode][text]) {
      if (this.settings.strict && this.mode === 'math' && extraLatin.indexOf(text) >= 0) {
        this.settings.reportNonstrict("unicodeTextInMathMode", "Latin-1/Unicode text character \"" + text[0] + "\" used in " + "math mode", nucleus);
      }

      var group = symbols[this.mode][text].group;
      var loc = SourceLocation.range(nucleus);
      var s;

      if (ATOMS.hasOwnProperty(group)) {
        // $FlowFixMe
        var family = group;
        s = {
          type: "atom",
          mode: this.mode,
          family,
          loc,
          text
        };
      } else {
        // $FlowFixMe
        s = {
          type: group,
          mode: this.mode,
          loc,
          text
        };
      } // $FlowFixMe


      symbol = s;
    } else if (text.charCodeAt(0) >= 0x80) {
      // no symbol for e.g. ^
      if (this.settings.strict) {
        if (!supportedCodepoint(text.charCodeAt(0))) {
          this.settings.reportNonstrict("unknownSymbol", "Unrecognized Unicode character \"" + text[0] + "\"" + (" (" + text.charCodeAt(0) + ")"), nucleus);
        } else if (this.mode === "math") {
          this.settings.reportNonstrict("unicodeTextInMathMode", "Unicode text character \"" + text[0] + "\" used in math mode", nucleus);
        }
      } // All nonmathematical Unicode characters are rendered as if they
      // are in text mode (wrapped in \text) because that's what it
      // takes to render them in LaTeX.  Setting `mode: this.mode` is
      // another natural choice (the user requested math mode), but
      // this makes it more difficult for getCharacterMetrics() to
      // distinguish Unicode characters without metrics and those for
      // which we want to simulate the letter M.


      symbol = {
        type: "textord",
        mode: "text",
        loc: SourceLocation.range(nucleus),
        text
      };
    } else {
      return null; // EOF, ^, _, {, }, etc.
    }

    this.consume(); // Transform combining characters into accents

    if (match) {
      for (var i = 0; i < match[0].length; i++) {
        var accent = match[0][i];

        if (!unicodeAccents[accent]) {
          throw new ParseError("Unknown accent ' " + accent + "'", nucleus);
        }

        var command = unicodeAccents[accent][this.mode] || unicodeAccents[accent].text;

        if (!command) {
          throw new ParseError("Accent " + accent + " unsupported in " + this.mode + " mode", nucleus);
        }

        symbol = {
          type: "accent",
          mode: this.mode,
          loc: SourceLocation.range(nucleus),
          label: command,
          isStretchy: false,
          isShifty: true,
          // $FlowFixMe
          base: symbol
        };
      }
    } // $FlowFixMe


    return symbol;
  }

}
Parser.endOfExpression = ["}", "\\endgroup", "\\end", "\\right", "&"];

/**
 * Provides a single function for parsing an expression using a Parser
 * TODO(emily): Remove this
 */

/**
 * Parses an expression using a Parser, then returns the parsed result.
 */
var parseTree = function parseTree(toParse, settings) {
  if (!(typeof toParse === 'string' || toParse instanceof String)) {
    throw new TypeError('KaTeX can only parse string typed expression');
  }

  var parser = new Parser(toParse, settings); // Blank out any \df@tag to avoid spurious "Duplicate \tag" errors

  delete parser.gullet.macros.current["\\df@tag"];
  var tree = parser.parse(); // Prevent a color definition from persisting between calls to katex.render().

  delete parser.gullet.macros.current["\\current@color"];
  delete parser.gullet.macros.current["\\color"]; // If the input used \tag, it will set the \df@tag macro to the tag.
  // In this case, we separately parse the tag and wrap the tree.

  if (parser.gullet.macros.get("\\df@tag")) {
    if (!settings.displayMode) {
      throw new ParseError("\\tag works only in display equations");
    }

    tree = [{
      type: "tag",
      mode: "text",
      body: tree,
      tag: parser.subparse([new Token("\\df@tag")])
    }];
  }

  return tree;
};

/* eslint no-console:0 */

/**
 * Parse and build an expression, and place that expression in the DOM node
 * given.
 */
var render = function render(expression, baseNode, options) {
  baseNode.textContent = "";
  var node = renderToDomTree(expression, options).toNode();
  baseNode.appendChild(node);
}; // KaTeX's styles don't work properly in quirks mode. Print out an error, and
// disable rendering.


if (typeof document !== "undefined") {
  if (document.compatMode !== "CSS1Compat") {
    typeof console !== "undefined" && console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your " + "website has a suitable doctype.");

    render = function render() {
      throw new ParseError("KaTeX doesn't work in quirks mode.");
    };
  }
}
/**
 * Parse and build an expression, and return the markup for that.
 */


var renderToString = function renderToString(expression, options) {
  var markup = renderToDomTree(expression, options).toMarkup();
  return markup;
};
/**
 * Parse an expression and return the parse tree.
 */


var generateParseTree = function generateParseTree(expression, options) {
  var settings = new Settings(options);
  return parseTree(expression, settings);
};
/**
 * If the given error is a KaTeX ParseError and options.throwOnError is false,
 * renders the invalid LaTeX as a span with hover title giving the KaTeX
 * error message.  Otherwise, simply throws the error.
 */


var renderError = function renderError(error, expression, options) {
  if (options.throwOnError || !(error instanceof ParseError)) {
    throw error;
  }

  var node = buildCommon.makeSpan(["katex-error"], [new SymbolNode(expression)]);
  node.setAttribute("title", error.toString());
  node.setAttribute("style", "color:" + options.errorColor);
  return node;
};
/**
 * Generates and returns the katex build tree. This is used for advanced
 * use cases (like rendering to custom output).
 */


var renderToDomTree = function renderToDomTree(expression, options) {
  var settings = new Settings(options);

  try {
    var tree = parseTree(expression, settings);
    return buildTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};
/**
 * Generates and returns the katex build tree, with just HTML (no MathML).
 * This is used for advanced use cases (like rendering to custom output).
 */


var renderToHTMLTree = function renderToHTMLTree(expression, options) {
  var settings = new Settings(options);

  try {
    var tree = parseTree(expression, settings);
    return buildHTMLTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};

var version = "0.16.25";
var __domTree = {
  Span,
  Anchor,
  SymbolNode,
  SvgNode,
  PathNode,
  LineNode
}; // ESM exports

var katex = {
  /**
   * Current KaTeX version
   */
  version,

  /**
   * Renders the given LaTeX into an HTML+MathML combination, and adds
   * it as a child to the specified DOM node.
   */
  render,

  /**
   * Renders the given LaTeX into an HTML+MathML combination string,
   * for sending to the client.
   */
  renderToString,

  /**
   * KaTeX error, usually during parsing.
   */
  ParseError,

  /**
   * The schema of Settings
   */
  SETTINGS_SCHEMA,

  /**
   * Parses the given LaTeX into KaTeX's internal parse tree structure,
   * without rendering to HTML or MathML.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __parse: generateParseTree,

  /**
   * Renders the given LaTeX into an HTML+MathML internal DOM tree
   * representation, without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToDomTree: renderToDomTree,

  /**
   * Renders the given LaTeX into an HTML internal DOM tree representation,
   * without MathML and without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToHTMLTree: renderToHTMLTree,

  /**
   * extends internal font metrics object with a new object
   * each key in the new object represents a font name
  */
  __setFontMetrics: setFontMetrics,

  /**
   * adds a new symbol to builtin symbols table
   */
  __defineSymbol: defineSymbol,

  /**
   * adds a new function to builtin function list,
   * which directly produce parse tree elements
   * and have their own html/mathml builders
   */
  __defineFunction: defineFunction,

  /**
   * adds a new macro to builtin macro list
   */
  __defineMacro: defineMacro,

  /**
   * Expose the dom tree node types, which can be useful for type checking nodes.
   *
   * NOTE: These methods are not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __domTree
};

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/;
const inlineRuleNonStandard = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/; // Non-standard, even if there are no spaces before and after $ or $$, try to parse

const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

function markedKatex(options = {}) {
  return {
    extensions: [
      inlineKatex(options, createRenderer(options, false)),
      blockKatex(options, createRenderer(options, true)),
    ],
  };
}

function createRenderer(options, newlineAfter) {
  return (token) => katex.renderToString(token.text, { ...options, displayMode: token.displayMode }) + (newlineAfter ? '\n' : '');
}

function inlineKatex(options, renderer) {
  const nonStandard = options && options.nonStandard;
  const ruleReg = nonStandard ? inlineRuleNonStandard : inlineRule;
  return {
    name: 'inlineKatex',
    level: 'inline',
    start(src) {
      let index;
      let indexSrc = src;

      while (indexSrc) {
        index = indexSrc.indexOf('$');
        if (index === -1) {
          return;
        }
        const f = nonStandard ? index > -1 : index === 0 || indexSrc.charAt(index - 1) === ' ';
        if (f) {
          const possibleKatex = indexSrc.substring(index);

          if (possibleKatex.match(ruleReg)) {
            return index;
          }
        }

        indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
      }
    },
    tokenizer(src, tokens) {
      const match = src.match(ruleReg);
      if (match) {
        return {
          type: 'inlineKatex',
          raw: match[0],
          text: match[2].trim(),
          displayMode: match[1].length === 2,
        };
      }
    },
    renderer,
  };
}

function blockKatex(options, renderer) {
  return {
    name: 'blockKatex',
    level: 'block',
    tokenizer(src, tokens) {
      const match = src.match(blockRule);
      if (match) {
        return {
          type: 'blockKatex',
          raw: match[0],
          text: match[2].trim(),
          displayMode: match[1].length === 2,
        };
      }
    },
    renderer,
  };
}

const panelStyles = `
.aicopy-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999998;
  backdrop-filter: blur(2px);
}

.aicopy-panel {
  position: fixed;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 900px;
  height: 80vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  z-index: 999999;
  overflow: hidden;
}

.aicopy-panel-fullscreen {
  top: 0 !important;
  left: 0 !important;
  transform: none !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100vh !important;
  border-radius: 0 !important;
}

.aicopy-panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
}

.aicopy-panel-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.aicopy-panel-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.aicopy-panel-fullscreen-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.aicopy-panel-fullscreen-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
  color: #374151;
}

.aicopy-panel-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.aicopy-panel-close:hover {
  background: #e5e7eb;
  color: #111827;
}

.aicopy-panel-body {
  flex: 1;
  overflow: auto;
  background: white;
  padding: 24px;
}
`;
const markdownStyles = `
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #24292f;
  background: #fff;
}

.markdown-content {
  padding: 24px;
  max-width: 100%;
}

/* Limit content width in fullscreen mode for better readability */
.aicopy-panel-fullscreen .markdown-content {
  max-width: 800px;
  margin: 0 auto;
}


h1, h2 {
  padding-bottom: 0.3em;
  border-bottom: 1px solid #d0d7de;
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}

h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; font-weight: 600; margin: 24px 0 16px; }
h4, h5, h6 { font-weight: 600; margin: 24px 0 16px; }

p { margin: 0 0 16px; }

blockquote {
  padding: 0 1em;
  color: #57606a;
  border-left: 0.25em solid #d0d7de;
  margin: 0 0 16px;
}

code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin: 0 0 16px;
}

pre code {
  background: transparent;
  padding: 0;
  margin: 0;
  font-size: 100%;
}

table {
  border-spacing: 0;
  border-collapse: collapse;
  margin: 0 0 16px;
  width: 100%;
}

th, td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}

th {
  font-weight: 600;
  background-color: #f6f8fa;
}

tr:nth-child(2n) {
  background-color: #f6f8fa;
}

ul, ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

ul {
  list-style-type: disc;
}

ol {
  list-style-type: decimal;
}

li {
  margin-top: 0.25em;
}

li:first-child {
  margin-top: 0;
}

li > p {
  margin-top: 16px;
  margin-bottom: 0;
}

li > p:first-child {
  margin-top: 0;
}

li + li {
  margin-top: 0.25em;
}

ul ul, 
ul ol, 
ol ul, 
ol ol {
  margin-top: 0;
  margin-bottom: 0;
}

hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #d0d7de;
  border: 0;
}

a {
  color: #0969da;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

img {
  max-width: 100%;
}

/* KaTeX styles - inline to avoid loading issues */
.katex { font-size: 1.1em; }
.katex-display {
  display: block;
  margin: 1em 0;
  text-align: center;
}
`;
class ReRenderPanel {
  container = null;
  constructor() {
    d.setOptions({
      breaks: true,
      // Convert \n to <br>
      gfm: true
      // GitHub Flavored Markdown
    });
    d.use(markedKatex({
      throwOnError: false,
      output: "html",
      nonStandard: true
      // Allow non-standard syntax
    }));
  }
  /**
   * Show panel with rendered Markdown
   */
  show(markdown) {
    this.hide();
    if (!document.querySelector("#aicopy-panel-styles")) {
      const style = document.createElement("style");
      style.id = "aicopy-panel-styles";
      style.textContent = panelStyles;
      document.head.appendChild(style);
    }
    this.createPanel(markdown);
  }
  /**
   * Hide panel
   */
  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
  /**
   * Create panel with direct DOM rendering
   */
  createPanel(markdown) {
    let processedMarkdown = markdown.replace(/\$([^$]+)\$([、，。；：！？])\$([^$]+)\$/g, "$$$1$$ $2 $$$3$$").replace(/\$([^$]+)\$(——)\$([^$]+)\$/g, "$$$1$$ $2 $$$3$$");
    const html = d.parse(processedMarkdown);
    const overlay = document.createElement("div");
    overlay.className = "aicopy-panel-overlay";
    overlay.addEventListener("click", () => this.hide());
    const panel = document.createElement("div");
    panel.className = "aicopy-panel";
    panel.addEventListener("click", (e) => e.stopPropagation());
    const header = document.createElement("div");
    header.className = "aicopy-panel-header";
    header.innerHTML = `
      <div class="aicopy-panel-header-left">
        <h2 class="aicopy-panel-title">Rendered Markdown</h2>
        <button class="aicopy-panel-fullscreen-btn" aria-label="Toggle fullscreen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          Fullscreen
        </button>
      </div>
      <button class="aicopy-panel-close" aria-label="Close">×</button>
    `;
    const closeBtn = header.querySelector(".aicopy-panel-close");
    closeBtn?.addEventListener("click", () => this.hide());
    const fullscreenBtn = header.querySelector(".aicopy-panel-fullscreen-btn");
    fullscreenBtn?.addEventListener("click", () => this.toggleFullscreen());
    const body = document.createElement("div");
    body.className = "aicopy-panel-body";
    const styleEl = document.createElement("style");
    styleEl.textContent = markdownStyles;
    const content = document.createElement("div");
    content.className = "markdown-content";
    content.innerHTML = html;
    body.appendChild(styleEl);
    body.appendChild(content);
    panel.appendChild(header);
    panel.appendChild(body);
    this.container = document.createElement("div");
    this.container.appendChild(overlay);
    this.container.appendChild(panel);
    document.body.appendChild(this.container);
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        this.hide();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }
  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    if (!this.container) return;
    const panel = this.container.querySelector(".aicopy-panel");
    if (panel) {
      panel.classList.toggle("aicopy-panel-fullscreen");
    }
  }
}

class TooltipHelper {
  static tooltipContainer = null;
  static activeTooltip = null;
  static hideTimeout = null;
  /**
   * Initialize tooltip container (call once)
   */
  static init() {
    if (this.tooltipContainer) return;
    this.tooltipContainer = document.createElement("div");
    this.tooltipContainer.className = "aicopy-tooltip-container";
    this.tooltipContainer.style.cssText = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(this.tooltipContainer);
  }
  /**
   * Attach tooltip to a button
   */
  static attach(button, text) {
    this.init();
    button.addEventListener("mouseenter", () => {
      this.show(button, text);
    });
    button.addEventListener("mouseleave", () => {
      this.hide();
    });
  }
  /**
   * Show tooltip
   */
  static show(anchor, text) {
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
    const tooltip = document.createElement("div");
    tooltip.className = "aicopy-tooltip";
    tooltip.textContent = text;
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(60, 64, 67, 0.9);
      color: white;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s ease-in-out;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    this.tooltipContainer.appendChild(tooltip);
    const rect = anchor.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.transform = "translateX(-50%)";
    requestAnimationFrame(() => {
      tooltip.style.opacity = "1";
    });
    this.activeTooltip = tooltip;
  }
  /**
   * Hide tooltip
   */
  static hide() {
    if (this.activeTooltip) {
      const tooltip = this.activeTooltip;
      tooltip.style.opacity = "0";
      if (this.hideTimeout !== null) {
        clearTimeout(this.hideTimeout);
      }
      this.hideTimeout = window.setTimeout(() => {
        tooltip.remove();
        if (this.activeTooltip === tooltip) {
          this.activeTooltip = null;
        }
        this.hideTimeout = null;
      }, 150);
    }
  }
}

class DeepResearchHandler {
  observer = null;
  activePanel = null;
  parser;
  reRenderPanel;
  constructor() {
    this.parser = new MarkdownParser();
    this.reRenderPanel = new ReRenderPanel();
  }
  /**
   * Enable Deep Research panel detection
   */
  enable() {
    logger$1.info("[DeepResearch] Enabling Deep Research handler");
    this.observer = new MutationObserver(() => {
      this.checkForPanel();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    this.checkForPanel();
  }
  /**
   * Disable and cleanup
   */
  disable() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.activePanel = null;
  }
  /**
   * Check if Deep Research panel exists
   */
  checkForPanel() {
    const panel = document.querySelector("deep-research-immersive-panel");
    if (panel && !this.activePanel) {
      logger$1.info("[DeepResearch] Panel detected, injecting toolbar");
      this.injectToolbar(panel);
      this.activePanel = panel;
    } else if (!panel && this.activePanel) {
      logger$1.info("[DeepResearch] Panel closed");
      this.activePanel = null;
    }
  }
  /**
   * Inject copy/preview buttons into panel toolbar
   */
  injectToolbar(panel) {
    const actionButtons = panel.querySelector("toolbar .action-buttons");
    if (!actionButtons) {
      logger$1.warn("[DeepResearch] Action buttons container not found");
      return;
    }
    if (actionButtons.querySelector(".aicopy-dr-button")) {
      logger$1.debug("[DeepResearch] Buttons already injected");
      return;
    }
    const copyBtn = this.createButton("Copy Markdown", "content_copy", () => {
      this.handleCopy(panel);
    });
    const previewBtn = this.createButton("Preview Enhance", "travel_explore", () => {
      this.handlePreview(panel);
    });
    const firstButton = actionButtons.firstElementChild;
    if (firstButton) {
      actionButtons.insertBefore(previewBtn, firstButton);
      actionButtons.insertBefore(copyBtn, firstButton);
    } else {
      actionButtons.appendChild(copyBtn);
      actionButtons.appendChild(previewBtn);
    }
    logger$1.info("[DeepResearch] Toolbar buttons injected");
  }
  /**
   * Create a button matching Gemini's icon-button style
   */
  createButton(tooltip, icon, onClick) {
    const button = document.createElement("button");
    button.className = "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger aicopy-dr-button";
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", tooltip);
    TooltipHelper.attach(button, tooltip);
    button.style.cssText = `
            width: 40px;
            height: 40px;
            padding: 8px;
            flex-shrink: 0;
        `;
    const matIcon = document.createElement("mat-icon");
    matIcon.className = "notranslate gds-icon-m google-symbols mat-ligature-font mat-icon-no-color";
    matIcon.setAttribute("role", "img");
    matIcon.setAttribute("aria-hidden", "true");
    matIcon.setAttribute("data-mat-icon-type", "font");
    matIcon.setAttribute("data-mat-icon-name", icon);
    matIcon.setAttribute("fonticon", icon);
    matIcon.textContent = icon;
    const ripple = document.createElement("span");
    ripple.className = "mat-mdc-button-persistent-ripple mdc-icon-button__ripple";
    const touchTarget = document.createElement("span");
    touchTarget.className = "mat-mdc-button-touch-target";
    button.appendChild(ripple);
    button.appendChild(matIcon);
    button.appendChild(touchTarget);
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return button;
  }
  /**
   * Handle copy button click
   */
  async handleCopy(panel) {
    const content = panel.querySelector("#extended-response-markdown-content");
    if (!content) {
      logger$1.warn("[DeepResearch] Content element not found");
      return;
    }
    try {
      const markdown = this.parser.parse(content);
      const success = await copyToClipboard(markdown);
      if (success) {
        logger$1.info("[DeepResearch] Content copied to clipboard");
        this.showFeedback("已复制!");
      } else {
        logger$1.error("[DeepResearch] Failed to copy to clipboard");
        this.showFeedback("复制失败", true);
      }
    } catch (error) {
      logger$1.error("[DeepResearch] Error during copy:", error);
      this.showFeedback("复制失败", true);
    }
  }
  /**
   * Handle preview button click
   */
  handlePreview(panel) {
    const content = panel.querySelector("#extended-response-markdown-content");
    if (!content) {
      logger$1.warn("[DeepResearch] Content element not found");
      return;
    }
    try {
      const markdown = this.parser.parse(content);
      this.reRenderPanel.show(markdown);
      logger$1.info("[DeepResearch] Preview panel opened");
    } catch (error) {
      logger$1.error("[DeepResearch] Error during preview:", error);
    }
  }
  /**
   * Show feedback message
   */
  showFeedback(message, isError = false) {
    const feedback = document.createElement("div");
    feedback.textContent = message;
    feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? "#ef4444" : "#8b5cf6"};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999999;
            animation: fadeInOut 2s forwards;
        `;
    const style = document.createElement("style");
    style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(-10px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
    document.head.appendChild(style);
    document.body.appendChild(feedback);
    setTimeout(() => {
      feedback.remove();
      style.remove();
    }, 2e3);
  }
}

class SimpleBookmarkStorage {
  /**
   * Generate storage key - AITimeline format
   */
  static getKey(url, position) {
    const urlWithoutProtocol = url.replace(/^https?:\/\//, "");
    return `bookmark:${urlWithoutProtocol}:${position}`;
  }
  /**
   * Save a bookmark
   */
  static async save(url, position, userMessage, aiResponse, title, platform, timestamp, folderPath) {
    try {
      const key = this.getKey(url, position);
      const urlWithoutProtocol = url.replace(/^https?:\/\//, "");
      const value = {
        url,
        urlWithoutProtocol,
        position,
        userMessage,
        aiResponse,
        timestamp: timestamp || Date.now(),
        title: title || userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : ""),
        platform: platform || "ChatGPT",
        folderPath: folderPath || "Import"
      };
      await chrome.storage.local.set({ [key]: value });
      logger$1.info(`[SimpleBookmarkStorage] Saved bookmark at position ${position}`);
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to save bookmark:", error);
      throw error;
    }
  }
  /**
   * Remove a bookmark
   */
  static async remove(url, position) {
    try {
      const key = this.getKey(url, position);
      await chrome.storage.local.remove(key);
      logger$1.info(`[SimpleBookmarkStorage] Removed bookmark at position ${position}`);
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to remove bookmark:", error);
      throw error;
    }
  }
  /**
   * Check if a position is bookmarked
   */
  static async isBookmarked(url, position) {
    try {
      const key = this.getKey(url, position);
      const result = await chrome.storage.local.get(key);
      return !!result[key];
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to check bookmark:", error);
      return false;
    }
  }
  /**
   * Load all bookmarked positions for current URL
   * Returns a Set of positions - AITimeline pattern
   */
  static async loadAllPositions(url) {
    try {
      const urlWithoutProtocol = url.replace(/^https?:\/\//, "");
      const prefix = `bookmark:${urlWithoutProtocol}:`;
      const all = await chrome.storage.local.get(null);
      const positions = /* @__PURE__ */ new Set();
      Object.keys(all).forEach((key) => {
        if (key.startsWith(prefix)) {
          const posStr = key.substring(prefix.length);
          const pos = parseInt(posStr, 10);
          if (!isNaN(pos)) {
            positions.add(pos);
          }
        }
      });
      logger$1.info(`[SimpleBookmarkStorage] Loaded ${positions.size} bookmarks for current page`);
      return positions;
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to load bookmarks:", error);
      return /* @__PURE__ */ new Set();
    }
  }
  /**
   * Update an existing bookmark
   */
  static async updateBookmark(url, position, updates) {
    try {
      const key = this.getKey(url, position);
      const result = await chrome.storage.local.get(key);
      const existing = result[key];
      if (!existing) {
        throw new Error(`Bookmark not found at position ${position}`);
      }
      const updated = {
        ...existing,
        ...updates
      };
      await chrome.storage.local.set({ [key]: updated });
      logger$1.info(`[SimpleBookmarkStorage] Updated bookmark at position ${position}`);
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to update bookmark:", error);
      throw error;
    }
  }
  /**
   * Get all bookmarks across all URLs
   */
  static async getAllBookmarks() {
    try {
      const all = await chrome.storage.local.get(null);
      const bookmarks = [];
      Object.keys(all).forEach((key) => {
        if (key.startsWith("bookmark:")) {
          bookmarks.push(all[key]);
        }
      });
      bookmarks.sort((a, b) => b.timestamp - a.timestamp);
      logger$1.info(`[SimpleBookmarkStorage] Loaded ${bookmarks.length} total bookmarks`);
      return bookmarks;
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to get all bookmarks:", error);
      return [];
    }
  }
  /**
   * Check storage quota usage
   */
  static async checkStorageQuota() {
    try {
      const used = await chrome.storage.local.getBytesInUse();
      const limit = 5 * 1024 * 1024;
      const percentage = used / limit * 100;
      logger$1.info(`[SimpleBookmarkStorage] Storage usage: ${used} bytes (${percentage.toFixed(2)}%)`);
      return { used, limit, percentage };
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to check storage quota:", error);
      return { used: 0, limit: 5 * 1024 * 1024, percentage: 0 };
    }
  }
  /**
   * Validate bookmark data
   */
  static validateBookmark(bookmark) {
    return typeof bookmark === "object" && bookmark !== null && typeof bookmark.url === "string" && typeof bookmark.urlWithoutProtocol === "string" && typeof bookmark.position === "number" && typeof bookmark.userMessage === "string" && typeof bookmark.timestamp === "number" && (bookmark.aiResponse === void 0 || typeof bookmark.aiResponse === "string") && typeof bookmark.title === "string" && (bookmark.platform === "ChatGPT" || bookmark.platform === "Gemini") && typeof bookmark.folderPath === "string";
  }
  /**
   * Repair corrupted bookmarks
   */
  static async repairBookmarks() {
    try {
      const all = await chrome.storage.local.get(null);
      let repaired = 0;
      let removed = 0;
      for (const key of Object.keys(all)) {
        if (!key.startsWith("bookmark:")) continue;
        const bookmark = all[key];
        if (!this.validateBookmark(bookmark)) {
          logger$1.warn(`[SimpleBookmarkStorage] Invalid bookmark found: ${key}`);
          if (typeof bookmark === "object" && bookmark !== null) {
            const repairedBookmark = {
              url: bookmark.url || "",
              urlWithoutProtocol: bookmark.urlWithoutProtocol || bookmark.url?.replace(/^https?:\/\//, "") || "",
              position: bookmark.position || 0,
              userMessage: bookmark.userMessage || "",
              aiResponse: bookmark.aiResponse,
              timestamp: bookmark.timestamp || Date.now(),
              title: bookmark.title || bookmark.userMessage?.substring(0, 50) || "Untitled",
              platform: bookmark.platform || "ChatGPT",
              folderPath: bookmark.folderPath || "Import"
            };
            if (this.validateBookmark(repairedBookmark)) {
              await chrome.storage.local.set({ [key]: repairedBookmark });
              repaired++;
              logger$1.info(`[SimpleBookmarkStorage] Repaired bookmark: ${key}`);
            } else {
              await chrome.storage.local.remove(key);
              removed++;
              logger$1.warn(`[SimpleBookmarkStorage] Removed irreparable bookmark: ${key}`);
            }
          } else {
            await chrome.storage.local.remove(key);
            removed++;
          }
        }
      }
      logger$1.info(`[SimpleBookmarkStorage] Repair complete: ${repaired} repaired, ${removed} removed`);
      return { repaired, removed };
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to repair bookmarks:", error);
      return { repaired: 0, removed: 0 };
    }
  }
  /**
   * Get bookmarks by folder path
   * 
   * @param folderPath Folder path to filter by
   * @param recursive Include bookmarks in subfolders
   */
  static async getBookmarksByFolder(folderPath, recursive = false) {
    try {
      const allBookmarks = await this.getAllBookmarks();
      if (recursive) {
        const { PathUtils } = await __vitePreload(async () => { const { PathUtils } = await Promise.resolve().then(() => pathUtils);return { PathUtils }},true?void 0:void 0);
        return allBookmarks.filter(
          (b) => b.folderPath === folderPath || PathUtils.isDescendantOf(b.folderPath, folderPath)
        );
      } else {
        return allBookmarks.filter((b) => b.folderPath === folderPath);
      }
    } catch (error) {
      logger$1.error(`[SimpleBookmarkStorage] Failed to get bookmarks by folder: ${folderPath}`, error);
      return [];
    }
  }
  /**
   * Move bookmark to a different folder
   * 
   * @param url Bookmark URL
   * @param position Bookmark position
   * @param newFolderPath New folder path
   */
  static async moveToFolder(url, position, newFolderPath) {
    try {
      const key = this.getKey(url, position);
      const result = await chrome.storage.local.get(key);
      const bookmark = result[key];
      if (!bookmark) {
        throw new Error(`Bookmark not found: ${url}:${position}`);
      }
      bookmark.folderPath = newFolderPath;
      await chrome.storage.local.set({ [key]: bookmark });
      logger$1.info(`[SimpleBookmarkStorage] Moved bookmark to folder: ${newFolderPath}`);
    } catch (error) {
      logger$1.error("[SimpleBookmarkStorage] Failed to move bookmark to folder:", error);
      throw error;
    }
  }
}

const SimpleBookmarkStorage$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  SimpleBookmarkStorage
}, Symbol.toStringTag, { value: 'Module' }));

class PathValidationError extends Error {
  constructor(message, path) {
    super(message);
    this.path = path;
    this.name = "PathValidationError";
  }
}
class PathUtils {
  /** Path separator (forward slash for cross-platform compatibility) */
  static SEPARATOR = "/";
  /** Maximum allowed folder depth */
  static MAX_DEPTH = 4;
  /** Maximum folder name length */
  static MAX_NAME_LENGTH = 50;
  /** Forbidden characters in folder names (includes separator and control chars) */
  static FORBIDDEN_CHARS = /[/\x00-\x1F\x7F<>:"|?*\\]/;
  /** Pattern to detect directory traversal attempts */
  static TRAVERSAL_PATTERN = /\.\./;
  /**
   * Normalize path to prevent directory traversal attacks
   * 
   * Security measures:
   * - Removes redundant separators (// -> /)
   * - Removes trailing separators
   * - Validates no directory traversal sequences (..)
   * - Ensures consistent separator usage
   * 
   * @throws {PathValidationError} if path contains traversal sequences
   */
  static normalize(path) {
    if (!path || typeof path !== "string") {
      throw new PathValidationError("Path must be a non-empty string", path);
    }
    if (this.TRAVERSAL_PATTERN.test(path)) {
      throw new PathValidationError(
        "Path contains directory traversal sequence (..)",
        path
      );
    }
    let normalized = path.replace(/\/+/g, this.SEPARATOR);
    if (normalized.length > 1 && normalized.endsWith(this.SEPARATOR)) {
      normalized = normalized.slice(0, -1);
    }
    if (normalized.startsWith(this.SEPARATOR)) {
      normalized = normalized.slice(1);
    }
    return normalized;
  }
  /**
   * Get parent path from full path
   * 
   * Examples:
   * - "Work/AI Research" → "Work"
   * - "Work" → null (root level)
   * - "" → null
   * 
   * @returns Parent path or null if at root level
   */
  static getParentPath(path) {
    if (!path) return null;
    const normalized = this.normalize(path);
    const lastSep = normalized.lastIndexOf(this.SEPARATOR);
    if (lastSep === -1) {
      return null;
    }
    return normalized.substring(0, lastSep);
  }
  /**
   * Get folder name from path (last segment)
   * 
   * Examples:
   * - "Work/AI Research" → "AI Research"
   * - "Work" → "Work"
   * - "" → ""
   */
  static getFolderName(path) {
    if (!path) return "";
    const normalized = this.normalize(path);
    const lastSep = normalized.lastIndexOf(this.SEPARATOR);
    return lastSep === -1 ? normalized : normalized.substring(lastSep + 1);
  }
  /**
   * Calculate depth from path
   * 
   * Examples:
   * - "Work" → 1
   * - "Work/AI Research" → 2
   * - "Work/AI Research/ChatGPT" → 3
   * - "" → 0
   */
  static getDepth(path) {
    if (!path) return 0;
    const normalized = this.normalize(path);
    if (!normalized) return 0;
    return normalized.split(this.SEPARATOR).length;
  }
  /**
   * Check if childPath is descendant of parentPath
   * 
   * Examples:
   * - isDescendantOf("Work/AI Research", "Work") → true
   * - isDescendantOf("Work", "Personal") → false
   * - isDescendantOf("Work", "Work") → false (not descendant of itself)
   */
  static isDescendantOf(childPath, parentPath) {
    if (!childPath || !parentPath) return false;
    const normalizedChild = this.normalize(childPath);
    const normalizedParent = this.normalize(parentPath);
    return normalizedChild.startsWith(normalizedParent + this.SEPARATOR);
  }
  /**
   * Join path segments safely
   * 
   * Examples:
   * - join("Work", "AI Research") → "Work/AI Research"
   * - join("Work", "", "AI Research") → "Work/AI Research" (empty segments ignored)
   * 
   * @throws {PathValidationError} if any segment is invalid
   */
  static join(...segments) {
    const validSegments = segments.filter((s) => s && s.trim());
    if (validSegments.length === 0) {
      return "";
    }
    for (const segment of validSegments) {
      if (this.TRAVERSAL_PATTERN.test(segment)) {
        throw new PathValidationError(
          "Path segment contains directory traversal sequence (..)",
          segment
        );
      }
      if (segment.includes(this.SEPARATOR)) {
        throw new PathValidationError(
          "Path segment cannot contain separator",
          segment
        );
      }
    }
    const joined = validSegments.join(this.SEPARATOR);
    return this.normalize(joined);
  }
  /**
   * Update path prefix for rename/move operations
   * 
   * Used for recursive updates when renaming or moving folders.
   * 
   * Examples:
   * - updatePathPrefix("Work", "Projects", "Work/AI Research") 
   *   → "Projects/AI Research"
   * - updatePathPrefix("Work", "Projects", "Work") 
   *   → "Projects"
   * - updatePathPrefix("Work", "Projects", "Personal/Research")
   *   → "Personal/Research" (unchanged, not a match)
   */
  static updatePathPrefix(oldPrefix, newPrefix, path) {
    if (!path) return path;
    const normalizedPath = this.normalize(path);
    const normalizedOld = this.normalize(oldPrefix);
    const normalizedNew = this.normalize(newPrefix);
    if (normalizedPath === normalizedOld) {
      return normalizedNew;
    }
    if (normalizedPath.startsWith(normalizedOld + this.SEPARATOR)) {
      return normalizedNew + normalizedPath.substring(normalizedOld.length);
    }
    return normalizedPath;
  }
  /**
   * Validate folder name against security and business rules
   * 
   * Validation rules:
   * - Non-empty after trimming
   * - No forbidden characters (/, \, :, *, ?, ", <, >, |, control chars)
   * - No directory traversal sequences (..)
   * - Length <= MAX_NAME_LENGTH
   * 
   * @returns true if valid, false otherwise
   */
  static isValidFolderName(name) {
    if (!name || typeof name !== "string") {
      return false;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return false;
    }
    if (trimmed.length > this.MAX_NAME_LENGTH) {
      return false;
    }
    if (this.FORBIDDEN_CHARS.test(trimmed)) {
      return false;
    }
    if (this.TRAVERSAL_PATTERN.test(trimmed)) {
      return false;
    }
    return true;
  }
  /**
   * Validate complete folder path
   * 
   * Validates:
   * - Path structure is valid
   * - Each segment is a valid folder name
   * - Depth does not exceed MAX_DEPTH
   * - No directory traversal attempts
   * 
   * @throws {PathValidationError} with detailed error message
   */
  static validatePath(path) {
    if (!path || typeof path !== "string") {
      throw new PathValidationError("Path must be a non-empty string", path);
    }
    const normalized = this.normalize(path);
    const depth = this.getDepth(normalized);
    if (depth > this.MAX_DEPTH) {
      throw new PathValidationError(
        `Path depth ${depth} exceeds maximum ${this.MAX_DEPTH}`,
        path
      );
    }
    const segments = normalized.split(this.SEPARATOR);
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!this.isValidFolderName(segment)) {
        throw new PathValidationError(
          `Invalid folder name at depth ${i + 1}: "${segment}"`,
          path
        );
      }
    }
  }
  /**
   * Get all ancestor paths for a given path
   * 
   * Example:
   * - getAncestors("Work/AI Research/ChatGPT") 
   *   → ["Work", "Work/AI Research"]
   * - getAncestors("Work")
   *   → []
   */
  static getAncestors(path) {
    if (!path) return [];
    const normalized = this.normalize(path);
    const ancestors = [];
    let current = this.getParentPath(normalized);
    while (current !== null) {
      ancestors.unshift(current);
      current = this.getParentPath(current);
    }
    return ancestors;
  }
  /**
   * Check if two paths are equal (after normalization)
   */
  static areEqual(path1, path2) {
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    return this.normalize(path1) === this.normalize(path2);
  }
  /**
   * Get level/depth of a path (1-indexed)
   * Same as getDepth but 1-indexed for user-facing display
   * 
   * Examples:
   * - "Work" → Level 1
   * - "Work/AI Research" → Level 2
   */
  static getLevel(path) {
    return this.getDepth(path);
  }
}

const pathUtils = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  PathUtils,
  PathValidationError
}, Symbol.toStringTag, { value: 'Module' }));

const logger = {
  info: (message, ...args) => console.log(`[FolderStorage] ${message}`, ...args),
  error: (message, ...args) => console.error(`[FolderStorage] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[FolderStorage] ${message}`, ...args)
};
class FolderOperationError extends Error {
  constructor(message, operation, path) {
    super(message);
    this.operation = operation;
    this.path = path;
    this.name = "FolderOperationError";
  }
}
class FolderStorage {
  /** Storage key prefix for folders */
  static FOLDER_KEY_PREFIX = "folder:";
  /** Storage key for folder index (list of all folder paths) */
  static FOLDER_INDEX_KEY = "folderPaths";
  /**
   * Create a new folder
   * 
   * Validation:
   * - Path is valid (no traversal, correct depth, valid names)
   * - No duplicate at same level
   * - Parent exists (if not root level)
   * 
   * @throws {PathValidationError} if path is invalid
   * @throws {FolderOperationError} if folder already exists or parent missing
   */
  static async create(path) {
    try {
      PathUtils.validatePath(path);
      const name = PathUtils.getFolderName(path);
      const depth = PathUtils.getDepth(path);
      if (name.length > PathUtils.MAX_NAME_LENGTH) {
        throw new FolderOperationError(
          `Folder name exceeds maximum length of ${PathUtils.MAX_NAME_LENGTH} characters`,
          "create",
          path
        );
      }
      const existing = await this.get(path);
      if (existing) {
        throw new FolderOperationError(
          `Folder already exists: ${path}`,
          "create",
          path
        );
      }
      if (depth > 1) {
        const parentPath = PathUtils.getParentPath(path);
        if (parentPath) {
          const parent = await this.get(parentPath);
          if (!parent) {
            throw new FolderOperationError(
              `Parent folder does not exist: ${parentPath}`,
              "create",
              path
            );
          }
        }
      }
      const siblings = await this.getSiblings(path);
      if (siblings.some((f) => f.name === name)) {
        throw new FolderOperationError(
          `Folder "${name}" already exists at this level`,
          "create",
          path
        );
      }
      const folder = {
        path,
        name,
        depth,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const key = this.getStorageKey(path);
      await chrome.storage.local.set({ [key]: folder });
      await this.addToIndex(path);
      logger.info(`Created folder: ${path}`);
      return folder;
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FolderOperationError) {
        throw error;
      }
      throw new FolderOperationError(
        `Failed to create folder: ${error instanceof Error ? error.message : "Unknown error"}`,
        "create",
        path
      );
    }
  }
  /**
   * Get folder by path
   * 
   * @returns Folder or null if not found
   */
  static async get(path) {
    try {
      const normalized = PathUtils.normalize(path);
      const key = this.getStorageKey(normalized);
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      logger.error(`Failed to get folder: ${path}`, error);
      return null;
    }
  }
  /**
   * Get all folders
   * 
   * @returns Array of all folders, sorted by path
   */
  static async getAll() {
    try {
      const index = await this.getIndex();
      if (index.length === 0) {
        return [];
      }
      const keys = index.map((path) => this.getStorageKey(path));
      const result = await chrome.storage.local.get(keys);
      const folders = Object.values(result);
      return folders.sort(
        (a, b) => a.path.localeCompare(b.path, void 0, { sensitivity: "base" })
      );
    } catch (error) {
      logger.error("Failed to get all folders", error);
      return [];
    }
  }
  /**
   * Rename folder (recursive path update)
   * 
   * This is a complex operation that updates:
   * 1. The folder itself
   * 2. All descendant folders
   * 3. All bookmarks in this folder and descendants
   * 
   * Uses validation-first approach to ensure atomicity
   * 
   * @throws {PathValidationError} if new name is invalid
   * @throws {FolderOperationError} if operation fails
   */
  static async rename(oldPath, newName) {
    try {
      if (!PathUtils.isValidFolderName(newName)) {
        throw new PathValidationError("Invalid folder name", newName);
      }
      const parentPath = PathUtils.getParentPath(oldPath);
      const newPath = parentPath ? `${parentPath}${PathUtils.SEPARATOR}${newName}` : newName;
      PathUtils.validatePath(newPath);
      const folder = await this.get(oldPath);
      if (!folder) {
        throw new FolderOperationError(
          `Folder not found: ${oldPath}`,
          "rename",
          oldPath
        );
      }
      const siblings = await this.getSiblings(newPath);
      if (siblings.some((f) => f.path !== oldPath && f.name === newName)) {
        throw new FolderOperationError(
          `Folder "${newName}" already exists at this level`,
          "rename",
          oldPath
        );
      }
      const affectedFolders = await this.getDescendants(oldPath, true);
      const affectedBookmarks = await this.getBookmarksInFolder(oldPath, true);
      logger.info(`Renaming folder: ${oldPath} → ${newPath} (${affectedFolders.length} folders, ${affectedBookmarks.length} bookmarks)`);
      const folderUpdates = {};
      const folderDeletes = [];
      for (const f of affectedFolders) {
        const updatedPath = PathUtils.updatePathPrefix(oldPath, newPath, f.path);
        const updatedFolder = {
          ...f,
          path: updatedPath,
          name: PathUtils.getFolderName(updatedPath),
          updatedAt: Date.now()
        };
        folderUpdates[this.getStorageKey(updatedPath)] = updatedFolder;
        if (f.path !== updatedPath) {
          folderDeletes.push(this.getStorageKey(f.path));
        }
      }
      const bookmarkUpdates = {};
      for (const bookmark of affectedBookmarks) {
        const updatedFolderPath = PathUtils.updatePathPrefix(oldPath, newPath, bookmark.folderPath);
        const key = `bookmark:${bookmark.urlWithoutProtocol}:${bookmark.position}`;
        bookmarkUpdates[key] = { ...bookmark, folderPath: updatedFolderPath };
      }
      if (Object.keys(folderUpdates).length > 0) {
        await chrome.storage.local.set(folderUpdates);
      }
      if (Object.keys(bookmarkUpdates).length > 0) {
        await chrome.storage.local.set(bookmarkUpdates);
      }
      if (folderDeletes.length > 0) {
        await chrome.storage.local.remove(folderDeletes);
      }
      await this.updateIndex(oldPath, newPath);
      logger.info(`Renamed folder successfully: ${oldPath} → ${newPath}`);
    } catch (error) {
      if (error instanceof PathValidationError || error instanceof FolderOperationError) {
        throw error;
      }
      throw new FolderOperationError(
        `Failed to rename folder: ${error instanceof Error ? error.message : "Unknown error"}`,
        "rename",
        oldPath
      );
    }
  }
  /**
   * Delete folder (must be empty)
   * 
   * Validation:
   * - Folder exists
   * - No child folders
   * - No bookmarks
   * 
   * @throws {FolderOperationError} if folder not empty or doesn't exist
   */
  static async delete(path) {
    try {
      const folder = await this.get(path);
      if (!folder) {
        throw new FolderOperationError(
          `Folder not found: ${path}`,
          "delete",
          path
        );
      }
      const hasChildren = await this.hasChildren(path);
      const hasBookmarks = await this.hasBookmarks(path);
      if (hasChildren || hasBookmarks) {
        throw new FolderOperationError(
          "Folder must be empty before deletion",
          "delete",
          path
        );
      }
      const key = this.getStorageKey(path);
      await chrome.storage.local.remove(key);
      await this.removeFromIndex(path);
      logger.info(`Deleted folder: ${path}`);
    } catch (error) {
      if (error instanceof FolderOperationError) {
        throw error;
      }
      throw new FolderOperationError(
        `Failed to delete folder: ${error instanceof Error ? error.message : "Unknown error"}`,
        "delete",
        path
      );
    }
  }
  /**
   * Move folder (recursive path update)
   * 
   * Validation:
   * - Cannot move into itself or descendants
   * - New depth doesn't exceed max
   * - Target parent exists
   * 
   * @param sourcePath Path of folder to move
   * @param targetParentPath Path of new parent (empty string for root)
   */
  static async move(sourcePath, targetParentPath) {
    try {
      if (targetParentPath && PathUtils.isDescendantOf(targetParentPath, sourcePath)) {
        throw new FolderOperationError(
          "Cannot move folder into its own descendant",
          "move",
          sourcePath
        );
      }
      const folderName = PathUtils.getFolderName(sourcePath);
      const newPath = targetParentPath ? `${targetParentPath}${PathUtils.SEPARATOR}${folderName}` : folderName;
      const newDepth = PathUtils.getDepth(newPath);
      if (newDepth > PathUtils.MAX_DEPTH) {
        throw new FolderOperationError(
          `Move would exceed max depth of ${PathUtils.MAX_DEPTH}`,
          "move",
          sourcePath
        );
      }
      if (targetParentPath) {
        const targetParent = await this.get(targetParentPath);
        if (!targetParent) {
          throw new FolderOperationError(
            `Target parent folder does not exist: ${targetParentPath}`,
            "move",
            sourcePath
          );
        }
      }
      await this.rename(sourcePath, folderName);
      logger.info(`Moved folder: ${sourcePath} → ${newPath}`);
    } catch (error) {
      if (error instanceof FolderOperationError) {
        throw error;
      }
      throw new FolderOperationError(
        `Failed to move folder: ${error instanceof Error ? error.message : "Unknown error"}`,
        "move",
        sourcePath
      );
    }
  }
  // ============================================================================
  // Helper Methods
  // ============================================================================
  /**
   * Get storage key for folder path
   */
  static getStorageKey(path) {
    return `${this.FOLDER_KEY_PREFIX}${path}`;
  }
  /**
   * Get folder index (list of all paths)
   */
  static async getIndex() {
    try {
      const result = await chrome.storage.local.get(this.FOLDER_INDEX_KEY);
      return result[this.FOLDER_INDEX_KEY] || [];
    } catch (error) {
      logger.error("Failed to get folder index", error);
      return [];
    }
  }
  /**
   * Add path to index
   */
  static async addToIndex(path) {
    const index = await this.getIndex();
    if (!index.includes(path)) {
      index.push(path);
      await chrome.storage.local.set({ [this.FOLDER_INDEX_KEY]: index });
    }
  }
  /**
   * Remove path from index
   */
  static async removeFromIndex(path) {
    const index = await this.getIndex();
    const updated = index.filter((p) => p !== path);
    await chrome.storage.local.set({ [this.FOLDER_INDEX_KEY]: updated });
  }
  /**
   * Update index for rename/move operations
   */
  static async updateIndex(oldPath, newPath) {
    const index = await this.getIndex();
    const updated = index.map(
      (p) => PathUtils.updatePathPrefix(oldPath, newPath, p)
    );
    await chrome.storage.local.set({ [this.FOLDER_INDEX_KEY]: updated });
  }
  /**
   * Get sibling folders (same parent)
   */
  static async getSiblings(path) {
    const parentPath = PathUtils.getParentPath(path);
    const allFolders = await this.getAll();
    return allFolders.filter((f) => {
      const fParent = PathUtils.getParentPath(f.path);
      return fParent === parentPath;
    });
  }
  /**
   * Get descendant folders
   * 
   * @param path Parent path
   * @param includeSelf Include the folder itself
   */
  static async getDescendants(path, includeSelf) {
    const allFolders = await this.getAll();
    return allFolders.filter(
      (f) => includeSelf && f.path === path || PathUtils.isDescendantOf(f.path, path)
    );
  }
  /**
   * Check if folder has children
   */
  static async hasChildren(path) {
    const allFolders = await this.getAll();
    return allFolders.some((f) => PathUtils.isDescendantOf(f.path, path));
  }
  /**
   * Check if folder has bookmarks
   */
  static async hasBookmarks(path) {
    const bookmarks = await this.getBookmarksInFolder(path, false);
    return bookmarks.length > 0;
  }
  /**
   * Get bookmarks in folder
   * 
   * @param path Folder path
   * @param recursive Include bookmarks in subfolders
   */
  static async getBookmarksInFolder(path, recursive) {
    try {
      const { SimpleBookmarkStorage } = await __vitePreload(async () => { const { SimpleBookmarkStorage } = await Promise.resolve().then(() => SimpleBookmarkStorage$1);return { SimpleBookmarkStorage }},true?void 0:void 0);
      const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
      if (recursive) {
        return bookmarks.filter(
          (b) => b.folderPath === path || PathUtils.isDescendantOf(b.folderPath, path)
        );
      } else {
        return bookmarks.filter((b) => b.folderPath === path);
      }
    } catch (error) {
      logger.error(`Failed to get bookmarks in folder: ${path}`, error);
      return [];
    }
  }
}

class TreeBuilder {
  /**
   * Build folder tree from flat folder list
   * 
   * Algorithm:
   * 1. Sort folders alphabetically by path
   * 2. Create tree nodes for each folder
   * 3. Attach nodes to parents or root
   * 4. Attach bookmarks to folders
   * 5. Sort recursively
   * 
   * @param folders Flat list of folders
   * @param bookmarks All bookmarks
   * @param expandedPaths Set of expanded folder paths
   * @param selectedPath Currently selected folder path
   * @returns Root-level tree nodes
   */
  static buildTree(folders, bookmarks, expandedPaths = /* @__PURE__ */ new Set(), selectedPath = null) {
    const sortedFolders = [...folders].sort(
      (a, b) => a.path.localeCompare(b.path, void 0, { sensitivity: "base" })
    );
    const rootNodes = [];
    const nodeMap = /* @__PURE__ */ new Map();
    for (const folder of sortedFolders) {
      const node = {
        folder,
        children: [],
        bookmarks: this.getBookmarksForFolder(folder.path, bookmarks),
        isExpanded: expandedPaths.has(folder.path),
        isSelected: folder.path === selectedPath
      };
      nodeMap.set(folder.path, node);
      const parentPath = PathUtils.getParentPath(folder.path);
      if (parentPath && nodeMap.has(parentPath)) {
        nodeMap.get(parentPath).children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
    this.sortTreeNodes(rootNodes);
    return rootNodes;
  }
  /**
   * Get bookmarks for a specific folder (non-recursive)
   * 
   * @param folderPath Folder path
   * @param bookmarks All bookmarks
   * @returns Bookmarks in this folder only (not subfolders)
   */
  static getBookmarksForFolder(folderPath, bookmarks) {
    return bookmarks.filter((b) => b.folderPath === folderPath).sort((a, b) => a.title.localeCompare(b.title, void 0, { sensitivity: "base" }));
  }
  /**
   * Sort tree nodes recursively (alphabetical by folder name)
   * 
   * @param nodes Tree nodes to sort
   */
  static sortTreeNodes(nodes) {
    nodes.sort(
      (a, b) => a.folder.name.localeCompare(b.folder.name, void 0, { sensitivity: "base" })
    );
    for (const node of nodes) {
      if (node.children.length > 0) {
        this.sortTreeNodes(node.children);
      }
      if (node.bookmarks.length > 0) {
        node.bookmarks.sort(
          (a, b) => a.title.localeCompare(b.title, void 0, { sensitivity: "base" })
        );
      }
    }
  }
  /**
   * Flatten tree to list of all nodes (depth-first)
   * 
   * Useful for search and filtering operations.
   * 
   * @param nodes Root nodes
   * @returns Flat list of all nodes
   */
  static flattenTree(nodes) {
    const result = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        result.push(...this.flattenTree(node.children));
      }
    }
    return result;
  }
  /**
   * Find path to a specific node (for auto-expand)
   * 
   * Returns array of folder paths from root to target.
   * 
   * @param nodes Root nodes
   * @param targetPath Target folder path
   * @returns Array of paths to expand, or empty if not found
   */
  static findPathToNode(nodes, targetPath) {
    for (const node of nodes) {
      if (node.folder.path === targetPath) {
        return [targetPath];
      }
      if (node.children.length > 0) {
        const childPath = this.findPathToNode(node.children, targetPath);
        if (childPath.length > 0) {
          return [node.folder.path, ...childPath];
        }
      }
    }
    return [];
  }
  /**
   * Find node by path
   * 
   * @param nodes Root nodes
   * @param targetPath Target folder path
   * @returns Node or null if not found
   */
  static findNode(nodes, targetPath) {
    for (const node of nodes) {
      if (node.folder.path === targetPath) {
        return node;
      }
      if (node.children.length > 0) {
        const found = this.findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }
  /**
   * Count total bookmarks in tree (recursive)
   * 
   * @param nodes Root nodes
   * @returns Total bookmark count
   */
  static countBookmarks(nodes) {
    let count = 0;
    for (const node of nodes) {
      count += node.bookmarks.length;
      if (node.children.length > 0) {
        count += this.countBookmarks(node.children);
      }
    }
    return count;
  }
  /**
   * Get total bookmark count for a single node (including all descendants)
   * 
   * @param node Tree node
   * @returns Total bookmark count
   */
  static getTotalBookmarkCount(node) {
    let count = node.bookmarks.length;
    if (node.children.length > 0) {
      count += this.countBookmarks(node.children);
    }
    return count;
  }
  /**
   * Get all bookmarks from tree (flattened)
   * 
   * @param nodes Root nodes
   * @returns All bookmarks in tree
   */
  static getAllBookmarks(nodes) {
    const bookmarks = [];
    for (const node of nodes) {
      bookmarks.push(...node.bookmarks);
      if (node.children.length > 0) {
        bookmarks.push(...this.getAllBookmarks(node.children));
      }
    }
    return bookmarks;
  }
  /**
   * Filter tree by search query
   * 
   * Returns new tree with only matching nodes.
   * Automatically expands paths to matching bookmarks.
   * 
   * @param nodes Root nodes
   * @param query Search query (case-insensitive)
   * @returns Filtered tree
   */
  static filterTree(nodes, query) {
    if (!query || query.trim().length === 0) {
      return nodes;
    }
    const lowerQuery = query.toLowerCase();
    const filteredNodes = [];
    for (const node of nodes) {
      const matchingBookmarks = node.bookmarks.filter(
        (b) => b.title.toLowerCase().includes(lowerQuery) || b.userMessage.toLowerCase().includes(lowerQuery) || b.aiResponse && b.aiResponse.toLowerCase().includes(lowerQuery)
      );
      const filteredChildren = this.filterTree(node.children, query);
      if (matchingBookmarks.length > 0 || filteredChildren.length > 0) {
        filteredNodes.push({
          ...node,
          bookmarks: matchingBookmarks,
          children: filteredChildren,
          isExpanded: true
          // Auto-expand when filtering
        });
      }
    }
    return filteredNodes;
  }
  /**
   * Update node state (expand/collapse, select)
   * 
   * Returns new tree with updated state.
   * 
   * @param nodes Root nodes
   * @param targetPath Path of node to update
   * @param updates State updates
   * @returns New tree with updated state
   */
  static updateNodeState(nodes, targetPath, updates) {
    return nodes.map((node) => {
      if (node.folder.path === targetPath) {
        return { ...node, ...updates };
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: this.updateNodeState(node.children, targetPath, updates)
        };
      }
      return node;
    });
  }
  /**
   * Expand path to specific folder
   * 
   * Returns new tree with all ancestors expanded.
   * 
   * @param nodes Root nodes
   * @param targetPath Path to expand to
   * @returns New tree with path expanded
   */
  static expandPathTo(nodes, targetPath) {
    const pathToExpand = this.findPathToNode(nodes, targetPath);
    let updatedNodes = nodes;
    for (const path of pathToExpand) {
      updatedNodes = this.updateNodeState(updatedNodes, path, { isExpanded: true });
    }
    return updatedNodes;
  }
  /**
   * Collapse all nodes
   * 
   * @param nodes Root nodes
   * @returns New tree with all nodes collapsed
   */
  static collapseAll(nodes) {
    return nodes.map((node) => ({
      ...node,
      isExpanded: false,
      children: node.children.length > 0 ? this.collapseAll(node.children) : []
    }));
  }
}

class BookmarkSaveModal {
  overlay = null;
  modal = null;
  // State
  folders = [];
  selectedPath = null;
  expandedPaths = /* @__PURE__ */ new Set();
  title = "";
  titleValid = true;
  // Callbacks
  onSave = null;
  escKeyHandler = null;
  /**
   * Show save modal
   */
  async show(options) {
    const mode = options.mode || "create";
    this.onSave = options.onSave;
    this.title = options.defaultTitle;
    this.selectedPath = mode === "edit" ? options.currentFolder || null : options.lastUsedFolder || null;
    this.folders = await FolderStorage.getAll();
    logger$1.debug(`[BookmarkSaveModal] Loaded ${this.folders.length} folders`);
    if (this.selectedPath) {
      this.expandPathToFolder(this.selectedPath);
    }
    this.overlay = document.createElement("div");
    this.overlay.className = "bookmark-save-modal-overlay";
    this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
        `;
    this.modal = this.createModal();
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    this.escKeyHandler = (e) => {
      if (e.key === "Escape") {
        this.hide();
      }
    };
    document.addEventListener("keydown", this.escKeyHandler);
    this.renderFolderTree();
    const headerText = mode === "edit" ? "Edit Bookmark" : "Save Bookmark";
    const header = this.modal.querySelector(".save-modal-header h2");
    if (header) {
      header.textContent = headerText;
    }
    setTimeout(() => {
      const titleInput = this.modal?.querySelector(".title-input");
      if (titleInput) {
        titleInput.select();
      }
    }, 100);
    logger$1.info("[BookmarkSaveModal] Modal shown");
  }
  /**
   * Hide and cleanup modal
   */
  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.remove();
    }
    if (this.escKeyHandler) {
      document.removeEventListener("keydown", this.escKeyHandler);
      this.escKeyHandler = null;
    }
    this.overlay = null;
    this.modal = null;
    this.onSave = null;
    logger$1.debug("[BookmarkSaveModal] Modal hidden");
  }
  /**
   * Create modal structure
   */
  createModal() {
    const modal = document.createElement("div");
    modal.className = "bookmark-save-modal";
    modal.style.cssText = `
            position: relative;
            width: 90%;
            max-width: 550px;
            max-height: 85vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.2s ease-out;
        `;
    modal.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    modal.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .bookmark-save-modal * {
                    box-sizing: border-box;
                }

                /* Header */
                .save-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                }

                .save-modal-header h2 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                }

                .save-modal-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                }

                .save-modal-close-btn:hover {
                    background: #f3f4f6;
                    color: #111827;
                }

                /* Body */
                .save-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                /* Title Section */
                .title-section {
                    margin-bottom: 20px;
                }

                .title-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 8px;
                }

                .title-input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: all 0.15s ease;
                    outline: none;
                }

                .title-input:focus {
                    border-color: #3b82f6;
                }

                .title-input.error {
                    border-color: #ef4444;
                }

                .title-error {
                    color: #ef4444;
                    font-size: 13px;
                    margin-top: 4px;
                    display: none;
                }

                .title-error.visible {
                    display: block;
                }

                /* Folder Section */
                .folder-section {
                    margin-bottom: 20px;
                }

                .folder-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .folder-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #374151;
                }

                .new-folder-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }

                .new-folder-btn:hover {
                    background: #2563eb;
                }

                .folder-tree-container {
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    height: 300px;
                    overflow-y: auto;
                    background: #f9fafb;
                }

                .folder-tree-body {
                    padding: 8px 0;
                }

                .folder-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    user-select: none;
                    position: relative;
                }

                .folder-item:hover {
                    background: #f3f4f6;
                }

                .folder-item.selected {
                    background: #dbeafe;
                }

                .folder-item.selected:hover {
                    background: #bfdbfe;
                }

                .folder-icon {
                    margin-right: 8px;
                    font-size: 16px;
                }

                .folder-toggle {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    margin-right: 4px;
                    font-size: 10px;
                    color: #6b7280;
                    cursor: pointer;
                    user-select: none;
                    flex-shrink: 0;
                    transition: transform 0.15s ease;
                }

                .folder-toggle:hover {
                    color: #111827;
                }

                .folder-name {
                    flex: 1;
                    font-size: 14px;
                    color: #111827;
                }

                .folder-count {
                    margin-left: 6px;
                    font-size: 12px;
                    color: #6b7280;
                    font-weight: 400;
                }

                .folder-check {
                    color: #3b82f6;
                    font-weight: 600;
                    margin-left: 8px;
                }

                .folder-add-btn {
                    position: absolute;
                    right: 8px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.15s;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .folder-item:hover .folder-add-btn {
                    opacity: 1;
                }

                .folder-empty {
                    padding: 40px 20px;
                    text-align: center;
                    color: #6b7280;
                }

                .folder-empty-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .folder-empty-text {
                    font-size: 14px;
                }

                /* Footer */
                .save-modal-footer {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 16px 20px;
                    border-top: 1px solid #e5e7eb;
                }

                .save-modal-btn {
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border: none;
                }

                .save-modal-btn-cancel {
                    background: #f3f4f6;
                    color: #374151;
                }

                .save-modal-btn-cancel:hover {
                    background: #e5e7eb;
                }

                .save-modal-btn-save {
                    background: #3b82f6;
                    color: white;
                }

                .save-modal-btn-save:hover:not(:disabled) {
                    background: #2563eb;
                }

                .save-modal-btn-save:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
            </style>

            <div class="save-modal-header">
                <h2>Save Bookmark</h2>
                <button class="save-modal-close-btn" aria-label="Close">×</button>
            </div>

            <div class="save-modal-body">
                <!-- Title Section -->
                <div class="title-section">
                    <label class="title-label">Title</label>
                    <input type="text" 
                           class="title-input" 
                           value="${this.escapeAttr(this.title)}"
                           maxlength="100"
                           placeholder="Enter bookmark title...">
                    <div class="title-error"></div>
                </div>

                <!-- Folder Section -->
                <div class="folder-section">
                    <div class="folder-header">
                        <span class="folder-label">Folder</span>
                        <button class="new-folder-btn">+ New Folder</button>
                    </div>
                    <div class="folder-tree-container">
                        <div class="folder-tree-body">
                            <div class="folder-empty">
                                <div class="folder-empty-icon">📁</div>
                                <div class="folder-empty-text">Loading folders...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="save-modal-footer">
                <button class="save-modal-btn save-modal-btn-cancel">Cancel</button>
                <button class="save-modal-btn save-modal-btn-save" disabled>Save</button>
            </div>
        `;
    this.bindEvents(modal);
    return modal;
  }
  /**
   * Bind event listeners
   */
  bindEvents(modal) {
    const closeBtn = modal.querySelector(".save-modal-close-btn");
    closeBtn?.addEventListener("click", () => this.hide());
    const cancelBtn = modal.querySelector(".save-modal-btn-cancel");
    cancelBtn?.addEventListener("click", () => this.hide());
    const saveBtn = modal.querySelector(".save-modal-btn-save");
    saveBtn?.addEventListener("click", () => this.handleSave());
    const titleInput = modal.querySelector(".title-input");
    titleInput?.addEventListener("input", (e) => this.handleTitleInput(e));
    const newFolderBtn = modal.querySelector(".new-folder-btn");
    newFolderBtn?.addEventListener("click", () => this.showCreateRootFolderInput());
  }
  /**
   * Handle title input with validation
   */
  handleTitleInput(e) {
    const input = e.target;
    this.title = input.value;
    const validation = this.validateTitle(this.title);
    this.titleValid = validation.valid;
    const errorDiv = this.modal?.querySelector(".title-error");
    if (!errorDiv) return;
    if (!validation.valid) {
      input.classList.add("error");
      errorDiv.textContent = validation.error;
      errorDiv.classList.add("visible");
    } else {
      input.classList.remove("error");
      errorDiv.classList.remove("visible");
    }
    this.updateSaveButtonState();
  }
  /**
   * Validate title
   */
  validateTitle(title) {
    if (!title || title.trim().length === 0) {
      return { valid: false, error: "Title is required" };
    }
    if (title.length > 100) {
      return { valid: false, error: `Title too long (${title.length}/100)` };
    }
    return { valid: true };
  }
  /**
   * Expand path to folder (auto-expand parent folders)
   */
  expandPathToFolder(path) {
    const segments = path.split("/");
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      this.expandedPaths.add(currentPath);
    }
  }
  /**
   * Render folder tree
   */
  renderFolderTree() {
    if (!this.modal) return;
    const treeBody = this.modal.querySelector(".folder-tree-body");
    if (!treeBody) return;
    const tree = TreeBuilder.buildTree(this.folders, [], /* @__PURE__ */ new Set(), null);
    if (tree.length === 0) {
      treeBody.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">📁</div>
                    <div class="folder-empty-text">No folders yet. Create one to get started!</div>
                </div>
            `;
      return;
    }
    treeBody.innerHTML = this.renderTreeNodes(tree, 0);
    this.bindFolderClickHandlers();
    this.scrollToSelected();
  }
  /**
   * Render tree nodes recursively
   */
  renderTreeNodes(nodes, depth) {
    return nodes.map((node) => {
      const isExpanded = this.expandedPaths.has(node.folder.path);
      const isSelected = node.folder.path === this.selectedPath;
      const icon = isExpanded ? "📂" : "📁";
      const indent = depth * 20;
      const showAddButton = depth < PathUtils.MAX_DEPTH - 1;
      let html = `
                <div class="folder-item ${isSelected ? "selected" : ""}"
                     data-path="${this.escapeAttr(node.folder.path)}"
                     data-depth="${depth}"
                     style="padding-left: ${indent + 12}px">
                    <span class="folder-toggle" data-path="${this.escapeAttr(node.folder.path)}" aria-label="Toggle folder">${isExpanded ? "▼" : "▶"}</span>
                    <span class="folder-icon">${icon}</span>
                    <span class="folder-name">${this.escapeHtml(node.folder.name)}</span>
                    ${isSelected ? '<span class="folder-check">✓</span>' : ""}
                    ${showAddButton ? `<button class="folder-add-btn" data-parent="${this.escapeAttr(node.folder.path)}" title="Create subfolder">+</button>` : ""}
                </div>
            `;
      if (isExpanded && node.children.length > 0) {
        html += this.renderTreeNodes(node.children, depth + 1);
      }
      return html;
    }).join("");
  }
  /**
   * Bind folder click handlers
   */
  bindFolderClickHandlers() {
    if (!this.modal) return;
    const toggleBtns = this.modal.querySelectorAll(".folder-toggle");
    toggleBtns.forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const path = toggle.dataset.path;
        if (this.expandedPaths.has(path)) {
          this.expandedPaths.delete(path);
        } else {
          this.expandedPaths.add(path);
        }
        this.renderFolderTree();
      });
    });
    const folderItems = this.modal.querySelectorAll(".folder-item");
    folderItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const path = item.dataset.path;
        this.handleFolderClick(path);
      });
    });
    const addBtns = this.modal.querySelectorAll(".folder-add-btn");
    addBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentPath = btn.dataset.parent;
        this.showCreateSubfolderInput(parentPath);
      });
    });
  }
  /**
   * Handle folder click
   */
  handleFolderClick(path) {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
    } else {
      this.expandedPaths.add(path);
    }
    this.selectedPath = path;
    this.renderFolderTree();
    this.updateSaveButtonState();
    logger$1.debug(`[BookmarkSaveModal] Folder clicked: ${path}`);
  }
  /**
   * Scroll to selected folder
   */
  scrollToSelected() {
    if (!this.modal) return;
    const selectedItem = this.modal.querySelector(".folder-item.selected");
    if (selectedItem) {
      selectedItem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  /**
   * Show create root folder input (placeholder for T3.1)
   */
  showCreateRootFolderInput() {
    const name = prompt("Enter folder name:");
    if (!name) return;
    this.createFolder(name, null);
  }
  /**
   * Show create subfolder input (placeholder for T3.3)
   */
  showCreateSubfolderInput(parentPath) {
    const name = prompt("Enter folder name:");
    if (!name) return;
    this.createFolder(name, parentPath);
  }
  /**
   * Create folder
   */
  async createFolder(name, parentPath) {
    if (name.length > 50) {
      alert("❌ Folder name too long (max 50 characters)");
      return;
    }
    if (name.includes("/")) {
      alert('❌ Folder name cannot contain "/"');
      return;
    }
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    const depth = newPath.split("/").length;
    if (depth > PathUtils.MAX_DEPTH) {
      alert(`❌ Maximum folder depth is ${PathUtils.MAX_DEPTH} levels (e.g., Work/Projects/AI/ChatGPT)`);
      return;
    }
    const exists = this.folders.find((f) => f.path === newPath);
    if (exists) {
      alert(`❌ Folder "${name}" already exists`);
      return;
    }
    try {
      await FolderStorage.create(newPath);
      logger$1.info(`[BookmarkSaveModal] Created folder: ${newPath}`);
      this.folders = await FolderStorage.getAll();
      this.selectedPath = newPath;
      if (parentPath) {
        this.expandedPaths.add(parentPath);
      }
      this.expandPathToFolder(newPath);
      this.renderFolderTree();
      this.updateSaveButtonState();
    } catch (error) {
      logger$1.error("[BookmarkSaveModal] Failed to create folder:", error);
      alert(`❌ Failed to create folder: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Update save button state
   */
  updateSaveButtonState() {
    if (!this.modal) return;
    const saveBtn = this.modal.querySelector(".save-modal-btn-save");
    if (saveBtn) {
      saveBtn.disabled = !this.titleValid || !this.selectedPath;
    }
  }
  /**
   * Handle save action
   */
  handleSave() {
    if (!this.titleValid || !this.selectedPath || !this.onSave) return;
    logger$1.info(`[BookmarkSaveModal] Saving: "${this.title}" to "${this.selectedPath}"`);
    this.onSave(this.title, this.selectedPath);
    this.hide();
  }
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  /**
   * Escape attribute
   */
  escapeAttr(text) {
    return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
}

const BookmarkSaveModal$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  BookmarkSaveModal
}, Symbol.toStringTag, { value: 'Module' }));

class FolderState {
  /** Storage key for last selected folder */
  static LAST_SELECTED_KEY = "lastSelectedFolderPath";
  /** In-memory expanded paths */
  expandedPaths = /* @__PURE__ */ new Set();
  /** Currently selected folder path */
  selectedPath = null;
  /**
   * Load state from storage
   * 
   * Loads last selected folder and auto-expands path to it.
   */
  async load() {
    try {
      const result = await chrome.storage.local.get(FolderState.LAST_SELECTED_KEY);
      this.selectedPath = result[FolderState.LAST_SELECTED_KEY] || null;
      if (this.selectedPath) {
        this.expandPathTo(this.selectedPath);
      }
    } catch (error) {
      console.error("[FolderState] Failed to load state:", error);
    }
  }
  /**
   * Save last selected folder to storage
   * 
   * @param path Folder path
   */
  async saveLastSelected(path) {
    try {
      this.selectedPath = path;
      await chrome.storage.local.set({ [FolderState.LAST_SELECTED_KEY]: path });
    } catch (error) {
      console.error("[FolderState] Failed to save last selected:", error);
    }
  }
  /**
   * Toggle folder expand/collapse
   * 
   * @param path Folder path
   */
  toggleExpand(path) {
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path);
    } else {
      this.expandedPaths.add(path);
    }
  }
  /**
   * Expand folder
   * 
   * @param path Folder path
   */
  expand(path) {
    this.expandedPaths.add(path);
  }
  /**
   * Collapse folder
   * 
   * @param path Folder path
   */
  collapse(path) {
    this.expandedPaths.delete(path);
  }
  /**
   * Expand path to specific folder (all ancestors)
   * 
   * @param targetPath Path to expand to
   */
  expandPathTo(targetPath) {
    const ancestors = PathUtils.getAncestors(targetPath);
    for (const ancestor of ancestors) {
      this.expandedPaths.add(ancestor);
    }
    this.expandedPaths.add(targetPath);
  }
  /**
   * Collapse all folders
   */
  collapseAll() {
    this.expandedPaths.clear();
  }
  /**
   * Expand all folders
   * 
   * @param allPaths All folder paths
   */
  expandAll(allPaths) {
    this.expandedPaths = new Set(allPaths);
  }
  /**
   * Check if folder is expanded
   * 
   * @param path Folder path
   */
  isExpanded(path) {
    return this.expandedPaths.has(path);
  }
  /**
   * Get all expanded paths
   */
  getExpandedPaths() {
    return new Set(this.expandedPaths);
  }
  /**
   * Get selected path
   */
  getSelectedPath() {
    return this.selectedPath;
  }
  /**
   * Set selected path
   * 
   * @param path Folder path (null to clear)
   */
  setSelectedPath(path) {
    this.selectedPath = path;
  }
  /**
   * Check if folder is selected
   * 
   * @param path Folder path
   */
  isSelected(path) {
    return this.selectedPath === path;
  }
  /**
   * Clear all state
   */
  clear() {
    this.expandedPaths.clear();
    this.selectedPath = null;
  }
  /**
   * Get state summary for debugging
   */
  getStateSummary() {
    return {
      expandedCount: this.expandedPaths.size,
      selectedPath: this.selectedPath,
      expandedPaths: Array.from(this.expandedPaths)
    };
  }
}

class FolderOperationsManager {
  /** Event listeners */
  listeners = [];
  /**
   * Create a new folder
   * 
   * @param parentPath Parent folder path (empty string for root)
   * @param name Folder name
   * @returns Operation result
   */
  async createFolder(parentPath, name) {
    try {
      if (!PathUtils.isValidFolderName(name)) {
        return {
          success: false,
          error: "Invalid folder name. Name cannot contain special characters or be empty."
        };
      }
      const path = parentPath ? `${parentPath}${PathUtils.SEPARATOR}${name}` : name;
      const depth = PathUtils.getDepth(path);
      if (depth > PathUtils.MAX_DEPTH) {
        return {
          success: false,
          error: `Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.`
        };
      }
      const folder = await FolderStorage.create(path);
      this.emitEvent({
        type: "create",
        path,
        timestamp: Date.now()
      });
      return {
        success: true,
        data: folder
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create folder"
      };
    }
  }
  /**
   * Rename a folder
   * 
   * @param path Current folder path
   * @param newName New folder name
   * @returns Operation result
   */
  async renameFolder(path, newName) {
    try {
      if (!PathUtils.isValidFolderName(newName)) {
        return {
          success: false,
          error: "Invalid folder name. Name cannot contain special characters or be empty."
        };
      }
      const parentPath = PathUtils.getParentPath(path);
      const newPath = parentPath ? `${parentPath}${PathUtils.SEPARATOR}${newName}` : newName;
      await FolderStorage.rename(path, newName);
      this.emitEvent({
        type: "rename",
        path,
        newPath,
        timestamp: Date.now()
      });
      return {
        success: true,
        data: { oldPath: path, newPath }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rename folder"
      };
    }
  }
  /**
   * Delete a folder
   * 
   * @param path Folder path
   * @returns Operation result
   */
  async deleteFolder(path) {
    try {
      await FolderStorage.delete(path);
      this.emitEvent({
        type: "delete",
        path,
        timestamp: Date.now()
      });
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete folder"
      };
    }
  }
  /**
   * Move a folder
   * 
   * @param sourcePath Source folder path
   * @param targetParentPath Target parent path (empty for root)
   * @returns Operation result
   */
  async moveFolder(sourcePath, targetParentPath) {
    try {
      await FolderStorage.move(sourcePath, targetParentPath);
      const folderName = PathUtils.getFolderName(sourcePath);
      const newPath = targetParentPath ? `${targetParentPath}${PathUtils.SEPARATOR}${folderName}` : folderName;
      this.emitEvent({
        type: "move",
        path: sourcePath,
        newPath,
        timestamp: Date.now()
      });
      return {
        success: true,
        data: { oldPath: sourcePath, newPath }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to move folder"
      };
    }
  }
  /**
   * Get all folders
   * 
   * @returns All folders
   */
  async getAllFolders() {
    return await FolderStorage.getAll();
  }
  /**
   * Get folder by path
   * 
   * @param path Folder path
   * @returns Folder or null
   */
  async getFolder(path) {
    return await FolderStorage.get(path);
  }
  /**
   * Validate folder name
   * 
   * @param name Folder name
   * @returns Validation result
   */
  validateFolderName(name) {
    if (!PathUtils.isValidFolderName(name)) {
      return {
        valid: false,
        error: "Invalid folder name. Name cannot contain special characters, be empty, or exceed 50 characters."
      };
    }
    return { valid: true };
  }
  /**
   * Check if folder can be deleted
   * 
   * @param path Folder path
   * @returns Check result
   */
  async canDelete(path) {
    try {
      const folder = await FolderStorage.get(path);
      if (!folder) {
        return { canDelete: false, reason: "Folder not found" };
      }
      return { canDelete: true };
    } catch (error) {
      return {
        canDelete: false,
        reason: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * Check if folder can be moved
   * 
   * @param sourcePath Source folder path
   * @param targetParentPath Target parent path
   * @returns Check result
   */
  canMove(sourcePath, targetParentPath) {
    if (sourcePath === targetParentPath) {
      return { canMove: false, reason: "Cannot move folder into itself" };
    }
    if (targetParentPath && PathUtils.isDescendantOf(targetParentPath, sourcePath)) {
      return { canMove: false, reason: "Cannot move folder into its own descendant" };
    }
    const folderName = PathUtils.getFolderName(sourcePath);
    const newPath = targetParentPath ? `${targetParentPath}${PathUtils.SEPARATOR}${folderName}` : folderName;
    const newDepth = PathUtils.getDepth(newPath);
    if (newDepth > PathUtils.MAX_DEPTH) {
      return { canMove: false, reason: `Move would exceed maximum depth of ${PathUtils.MAX_DEPTH}` };
    }
    return { canMove: true };
  }
  /**
   * Add event listener
   * 
   * @param listener Event listener function
   */
  addEventListener(listener) {
    this.listeners.push(listener);
  }
  /**
   * Remove event listener
   * 
   * @param listener Event listener function
   */
  removeEventListener(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  /**
   * Emit event to all listeners
   * 
   * @param event Event to emit
   */
  emitEvent(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[FolderOperationsManager] Event listener error:", error);
      }
    }
  }
  /**
   * Clear all event listeners
   */
  clearEventListeners() {
    this.listeners = [];
  }
}

class SimpleBookmarkPanel {
  overlay = null;
  shadowRoot = null;
  bookmarks = [];
  filteredBookmarks = [];
  searchQuery = "";
  platformFilter = "";
  storageListener = null;
  // Selection state for batch operations (Gmail-style)
  selectedItems = /* @__PURE__ */ new Set();
  // Keys: "folder:path" or "url:position"
  // Folder tree properties
  folders = [];
  folderState = new FolderState();
  folderOpsManager = new FolderOperationsManager();
  /**
   * Show the bookmark panel
   */
  async show() {
    if (this.overlay) {
      this.overlay.style.display = "flex";
      await this.refresh();
      return;
    }
    const migratedCount = await this.migrateLegacyBookmarks();
    this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
    this.folders = await FolderStorage.getAll();
    this.filteredBookmarks = [...this.bookmarks];
    logger$1.info(`[SimpleBookmarkPanel] Loaded ${this.bookmarks.length} bookmarks, ${this.folders.length} folders`);
    this.overlay = document.createElement("div");
    this.overlay.className = "simple-bookmark-panel-overlay";
    this.shadowRoot = this.overlay.attachShadow({ mode: "open" });
    const styles = document.createElement("style");
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);
    const panel = this.createPanel();
    this.shadowRoot.appendChild(panel);
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    document.body.appendChild(this.overlay);
    this.setupStorageListener();
    this.bindEventListeners();
    if (migratedCount > 0) {
      setTimeout(() => {
        alert(`✅ Migrated ${migratedCount} bookmark${migratedCount > 1 ? "s" : ""} to "Import" folder`);
      }, 100);
    }
  }
  /**
   * Migrate legacy bookmarks without folderPath to "Import" folder
   * Per PRD Section 9.2
   */
  async migrateLegacyBookmarks() {
    try {
      const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
      const needsMigration = bookmarks.filter((b) => !b.folderPath);
      if (needsMigration.length === 0) {
        return 0;
      }
      logger$1.info(`[Migration] Found ${needsMigration.length} bookmarks without folderPath`);
      const folders = await FolderStorage.getAll();
      if (!folders.find((f) => f.path === "Import")) {
        await FolderStorage.create("Import");
        logger$1.info('[Migration] Created "Import" folder');
      }
      for (const bookmark of needsMigration) {
        bookmark.folderPath = "Import";
        await SimpleBookmarkStorage.updateBookmark(
          bookmark.urlWithoutProtocol,
          bookmark.position,
          bookmark
        );
      }
      logger$1.info(`[Migration] Migrated ${needsMigration.length} bookmarks to "Import"`);
      return needsMigration.length;
    } catch (error) {
      logger$1.error("[Migration] Failed:", error);
      return 0;
    }
  }
  /**
   * Hide the bookmark panel
   */
  hide() {
    if (this.overlay) {
      this.overlay.style.display = "none";
    }
  }
  /**
   * Toggle panel visibility
   */
  async toggle() {
    if (this.overlay && this.overlay.style.display !== "none") {
      this.hide();
    } else {
      await this.show();
    }
  }
  /**
   * Create panel structure with sidebar tabs
   */
  createPanel() {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    panel.innerHTML = `
            <div class="sidebar">
                <button class="tab-btn active" data-tab="bookmarks">
                    <span class="tab-icon">📌</span>
                    <span class="tab-label">Bookmarks</span>
                </button>
                <button class="tab-btn" data-tab="settings">
                    <span class="tab-icon">⚙️</span>
                    <span class="tab-label">Settings</span>
                </button>
                <button class="tab-btn" data-tab="support">
                    <span class="tab-icon">☕</span>
                    <span class="tab-label">Buy Me a Coffee</span>
                </button>
            </div>

            <div class="main">
                <div class="header">
                    <h2>📌 Bookmarks (${this.bookmarks.length})</h2>
                    <button class="close-btn" aria-label="Close">×</button>
                </div>

                <div class="tab-content bookmarks-tab active">
                    <div class="toolbar">
                        <input type="text" class="search-input" placeholder="🔍 Search...">
                        <select class="platform-filter">
                            <option value="">All Platforms</option>
                            <option value="ChatGPT">ChatGPT</option>
                            <option value="Gemini">Gemini</option>
                        </select>
                        <button class="new-folder-btn" title="Create new folder">➕ New Folder</button>
                        <div class="toolbar-divider"></div>
                        <button class="export-btn" title="Export bookmarks">📥 Export</button>
                        <button class="import-btn" title="Import bookmarks">📤 Import</button>
                    </div>
                    <div class="content">
                        ${this.renderTreeView()}
                    </div>
                    
                    <!-- Batch Actions Bar (Gmail-style floating) -->
                    <div class="batch-actions-bar">
                        <div class="batch-info">
                            <input type="checkbox" class="select-all-checkbox" title="Select all" aria-label="Select all items" />
                            <span class="selected-count">0 selected</span>
                        </div>
                        <div class="batch-buttons">
                            <button class="batch-delete-btn" title="Delete selected items">🗑 Delete</button>
                            <button class="batch-move-btn" title="Move selected items">📁 Move To</button>
                            <button class="batch-export-btn" title="Export selected items">📤 Export</button>
                            <button class="batch-clear-btn" title="Clear selection">✕ Clear</button>
                        </div>
                    </div>
                </div>

                <div class="tab-content settings-tab">
                    <div class="settings-content">
                        <h3>Settings</h3>
                        <p>Settings panel coming soon...</p>
                    </div>
                </div>

                <div class="tab-content support-tab">
                    <div class="support-content">
                        <h3>☕ Buy Me a Coffee</h3>
                        <p>If you find this extension helpful, consider supporting the development!</p>
                        <a href="https://www.buymeacoffee.com/yourusername" target="_blank" class="support-btn">
                            Support Development
                        </a>
                    </div>
                </div>
            </div>
        `;
    return panel;
  }
  /**
   * Render tree view with folders and bookmarks
   * Reference: VS Code Explorer rendering
   */
  renderTreeView() {
    const tree = TreeBuilder.buildTree(
      this.folders,
      this.filteredBookmarks,
      this.folderState.getExpandedPaths(),
      this.folderState.getSelectedPath()
    );
    if (tree.length === 0) {
      return this.renderEmptyState();
    }
    return `
            <div class="tree-view" role="tree">
                ${tree.map((node) => this.renderTreeNode(node, 0)).join("")}
            </div>
        `;
  }
  /**
   * Render single tree node (folder or bookmark)
   */
  renderTreeNode(node, depth) {
    if (node.folder) {
      return this.renderFolderItem(node, depth);
    }
    return "";
  }
  /**
   * Render folder item with expand/collapse (VSCode-style)
   * Children are always rendered, CSS controls visibility
   */
  renderFolderItem(node, depth) {
    const folder = node.folder;
    const icon = node.isExpanded ? "📂" : "📁";
    const indent = depth * 20;
    const showAddSubfolder = depth < PathUtils.MAX_DEPTH - 1;
    const selectedClass = node.isSelected ? "selected" : "";
    const expandedClass = node.isExpanded ? "expanded" : "";
    let html = `
            <div class="tree-item folder-item ${selectedClass} ${expandedClass}"
                 data-path="${this.escapeAttr(folder.path)}"
                 data-depth="${depth}"
                 style="padding-left: ${indent}px"
                 role="treeitem"
                 aria-expanded="${node.isExpanded}"
                 aria-level="${depth + 1}"
                 tabindex="0">
                <span class="folder-toggle ${node.isExpanded ? "expanded" : ""}" aria-label="Toggle folder">▶</span>
                <input type="checkbox" 
                       class="item-checkbox folder-checkbox" 
                       data-path="${this.escapeAttr(folder.path)}"
                       aria-label="Select ${folder.name} and all children">
                <span class="folder-icon">${icon}</span>
                <span class="folder-name">${this.escapeHtml(folder.name)} <span class="folder-count">(${TreeBuilder.getTotalBookmarkCount(node)})</span></span>
                <div class="item-actions">
                    ${showAddSubfolder ? `<button class="action-btn add-subfolder" data-path="${this.escapeAttr(folder.path)}" data-depth="${depth}" title="New Subfolder" aria-label="Create subfolder">➕</button>` : ""}
                    <button class="action-btn rename-folder" title="Rename" aria-label="Rename folder">✏️</button>
                    <button class="action-btn delete-folder" title="Delete" aria-label="Delete folder">🗑</button>
                </div>
            </div>
        `;
    if (node.children.length > 0 || node.bookmarks.length > 0) {
      html += `<div class="folder-children" data-parent="${this.escapeAttr(folder.path)}">`;
      for (const child of node.children) {
        html += this.renderTreeNode(child, depth + 1);
      }
      for (const bookmark of node.bookmarks) {
        html += this.renderBookmarkItemInTree(bookmark, depth + 1);
      }
      html += "</div>";
    }
    return html;
  }
  /**
   * Render bookmark item in tree
   * Reference: Notion list items, Linear task items
   */
  renderBookmarkItemInTree(bookmark, depth) {
    const icon = bookmark.platform === "ChatGPT" ? "🤖" : "✨";
    const indent = depth * 20;
    const timestamp = this.formatTimestamp(bookmark.timestamp);
    const key = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
    const checked = this.selectedItems.has(key) ? "checked" : "";
    return `
            <div class="tree-item bookmark-item"
                 data-url="${this.escapeAttr(bookmark.url)}"
                 data-position="${bookmark.position}"
                 data-depth="${depth}"
                 style="padding-left: ${indent}px"
                 role="treeitem"
                 aria-level="${depth + 1}"
                 tabindex="0">
                <input type="checkbox" 
                       class="item-checkbox bookmark-checkbox" 
                       data-key="${this.escapeAttr(key)}"
                       ${checked}
                       aria-label="Select ${bookmark.title}">
                <span class="platform-icon">${icon}</span>
                <span class="bookmark-title">${this.escapeHtml(bookmark.title)}</span>
                <span class="bookmark-timestamp">${timestamp}</span>
                <div class="item-actions">
                    <button class="action-btn preview-bookmark" title="Preview" aria-label="Preview bookmark">👁</button>
                    <button class="action-btn edit-bookmark" title="Edit" aria-label="Edit bookmark">✏️</button>
                    <button class="action-btn delete-bookmark" title="Delete" aria-label="Delete bookmark">🗑</button>
                </div>
            </div>
        `;
  }
  /**
   * Render empty state when no folders exist
   * Reference: GitHub empty repository state
   */
  renderEmptyState() {
    return `
            <div class="tree-empty">
                <div class="empty-icon">📁</div>
                <h3>No folders yet</h3>
                <p>Create your first folder to organize bookmarks</p>
                <button class="btn-primary create-first-folder">
                    ➕ Create First Folder
                </button>
            </div>
        `;
  }
  /**
   * Escape HTML attribute value
   */
  escapeAttr(text) {
    return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /**
   * Get platform icon
   */
  getPlatformIcon(platform) {
    switch (platform) {
      case "ChatGPT":
        return "🤖";
      case "Gemini":
        return "✨";
      default:
        return "🤖";
    }
  }
  /**
   * Format timestamp to relative time
   */
  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1e3);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 7) {
      return new Date(timestamp).toLocaleDateString();
    } else if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return "now";
    }
  }
  /**
   * Truncate text
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
  /**
   * Filter bookmarks based on search and platform
   */
  filterBookmarks() {
    this.filteredBookmarks = this.bookmarks.filter((b) => {
      if (this.platformFilter && b.platform !== this.platformFilter) {
        return false;
      }
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesTitle = b.title?.toLowerCase().includes(query);
        const matchesMessage = b.userMessage.toLowerCase().includes(query);
        const matchesResponse = b.aiResponse?.toLowerCase().includes(query);
        return matchesTitle || matchesMessage || matchesResponse;
      }
      return true;
    });
  }
  /**
   * Refresh panel content
   */
  async refresh() {
    this.folders = await FolderStorage.getAll();
    this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
    this.filterBookmarks();
    logger$1.debug(`[SimpleBookmarkPanel] Refreshed: ${this.folders.length} folders, ${this.bookmarks.length} bookmarks`);
    this.refreshContent();
  }
  /**
   * Refresh only the content area
   */
  refreshContent() {
    if (this.shadowRoot) {
      const content = this.shadowRoot.querySelector(".bookmarks-tab .content");
      if (content) {
        content.innerHTML = this.renderTreeView();
        this.bindTreeEventListeners();
      }
      const header = this.shadowRoot.querySelector("h2");
      if (header) {
        header.textContent = `📌 Bookmarks (${this.bookmarks.length})`;
      }
      this.updateBatchActionsBar();
    }
  }
  /**
   * Bind event listeners to buttons
   */
  bindEventListeners() {
    this.shadowRoot?.querySelector(".close-btn")?.addEventListener("click", () => this.hide());
    this.shadowRoot?.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (tab) this.switchTab(tab);
      });
    });
    const searchInput = this.shadowRoot?.querySelector(".search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.filterBookmarks();
        this.refreshContent();
      });
    }
    const platformFilter = this.shadowRoot?.querySelector(".platform-filter");
    if (platformFilter) {
      platformFilter.addEventListener("change", (e) => {
        this.platformFilter = e.target.value;
        this.filterBookmarks();
        this.refreshContent();
      });
    }
    this.shadowRoot?.querySelector(".export-btn")?.addEventListener("click", () => {
      this.handleExport();
    });
    this.shadowRoot?.querySelector(".import-btn")?.addEventListener("click", () => {
      this.handleImport();
    });
    this.shadowRoot?.querySelector(".select-all-checkbox")?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      this.handleSelectAllClick(checked);
    });
    this.shadowRoot?.querySelector(".batch-delete-btn")?.addEventListener("click", () => {
      this.handleBatchDelete();
    });
    this.shadowRoot?.querySelector(".batch-move-btn")?.addEventListener("click", () => {
      this.handleBatchMove();
    });
    this.shadowRoot?.querySelector(".batch-export-btn")?.addEventListener("click", () => {
      this.handleBatchExport();
    });
    this.shadowRoot?.querySelector(".batch-clear-btn")?.addEventListener("click", () => {
      this.clearSelection();
    });
    this.shadowRoot?.querySelector(".new-folder-btn")?.addEventListener("click", () => {
      this.showCreateFolderInput(null);
    });
    this.bindBookmarkListeners();
    this.bindTreeEventListeners();
    this.setupTreeKeyboardNavigation();
  }
  /**
   * Bind listeners for bookmark list items
   */
  bindBookmarkListeners() {
    this.shadowRoot?.querySelectorAll(".preview-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = btn.getAttribute("data-url");
        const position = parseInt(btn.getAttribute("data-position") || "0");
        if (url && position) {
          this.showDetailModal(url, position);
        }
      });
    });
    this.shadowRoot?.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = btn.getAttribute("data-url");
        const position = parseInt(btn.getAttribute("data-position") || "0");
        if (url && position) {
          this.handleEdit(url, position);
        }
      });
    });
    this.shadowRoot?.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const url = btn.getAttribute("data-url");
        const position = parseInt(btn.getAttribute("data-position") || "0");
        if (url && position) {
          await this.handleDelete(url, position);
        }
      });
    });
    this.shadowRoot?.querySelectorAll(".bookmark-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        const target = e.target;
        if (target.classList.contains("bookmark-checkbox") || target.closest(".actions") || target.classList.contains("action-btn")) {
          return;
        }
        const url = item.getAttribute("data-url");
        const position = parseInt(item.getAttribute("data-position") || "0");
        if (url && position) {
          await this.handleGoTo(url, position);
        }
      });
    });
    this.shadowRoot?.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const target = e.target;
        const key = target.getAttribute("data-key");
        if (!key) return;
        if (target.checked) {
          this.selectedItems.add(key);
        } else {
          this.selectedItems.delete(key);
        }
        this.updateBatchActionsBar();
      });
    });
  }
  /**
   * Bind event listeners for tree interactions
   * Reference: VS Code Explorer event handling
   */
  bindTreeEventListeners() {
    this.shadowRoot?.querySelectorAll(".folder-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const target = e.target;
        if (target.classList.contains("item-checkbox") || target.closest(".item-actions")) {
          return;
        }
        const path = item.dataset.path;
        this.toggleFolder(path);
      });
    });
    this.shadowRoot?.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const path = e.target.dataset.path;
        const checked = e.target.checked;
        const key = `folder:${path}`;
        if (checked) {
          this.selectItem(key);
        } else {
          this.deselectItem(key);
        }
        this.updateAffectedCheckboxes(key);
        this.updateBatchActionsBar();
      });
    });
    this.shadowRoot?.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        e.stopPropagation();
        const key = e.target.dataset.key;
        const checked = e.target.checked;
        if (checked) {
          this.selectItem(key);
        } else {
          this.deselectItem(key);
        }
        this.updateAffectedCheckboxes(key);
        this.updateBatchActionsBar();
      });
    });
    this.shadowRoot?.querySelectorAll(".folder-toggle").forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const folderItem = e.target.closest(".folder-item");
        const path = folderItem.dataset.path;
        this.folderState.toggleExpand(path);
        this.refreshTreeView();
      });
    });
    this.shadowRoot?.querySelectorAll(".add-subfolder").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const path = btn.dataset.path;
        const depth = parseInt(btn.dataset.depth || "0");
        if (depth >= PathUtils.MAX_DEPTH) {
          alert(`❌ Cannot create subfolder: Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.

Please create a new root folder or organize within existing folders.`);
          return;
        }
        this.showCreateFolderInput(path);
      });
    });
    this.shadowRoot?.querySelectorAll(".rename-folder").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const folderItem = e.target.closest(".folder-item");
        const path = folderItem.dataset.path;
        this.showRenameFolderInput(path);
      });
    });
    this.shadowRoot?.querySelectorAll(".delete-folder").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const folderItem = e.target.closest(".folder-item");
        const path = folderItem.dataset.path;
        await this.handleDeleteFolder(path);
      });
    });
    this.shadowRoot?.querySelectorAll(".preview-bookmark").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bookmarkItem = e.target.closest(".bookmark-item");
        const url = bookmarkItem.dataset.url;
        const position = parseInt(bookmarkItem.dataset.position);
        this.showDetailModal(url, position);
      });
    });
    this.shadowRoot?.querySelectorAll(".edit-bookmark").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const bookmarkItem = e.target.closest(".bookmark-item");
        const url = bookmarkItem.dataset.url;
        const position = parseInt(bookmarkItem.dataset.position);
        this.handleEdit(url, position);
      });
    });
    this.shadowRoot?.querySelectorAll(".delete-bookmark").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const bookmarkItem = e.target.closest(".bookmark-item");
        const url = bookmarkItem.dataset.url;
        const position = parseInt(bookmarkItem.dataset.position);
        await this.handleDelete(url, position);
      });
    });
    this.shadowRoot?.querySelector(".create-first-folder")?.addEventListener("click", () => {
      this.showCreateFolderInput(null);
    });
  }
  /**
   * Toggle folder expand/collapse (VSCode-style - no re-render)
   */
  async toggleFolder(path) {
    this.folderState.toggleExpand(path);
    this.folderState.setSelectedPath(path);
    await this.folderState.saveLastSelected(path);
    const isExpanded = this.folderState.isExpanded(path);
    this.shadowRoot?.querySelectorAll(".folder-item.selected").forEach((item) => {
      item.classList.remove("selected");
    });
    const folderElement = this.shadowRoot?.querySelector(
      `.folder-item[data-path="${path}"]`
    );
    if (folderElement) {
      folderElement.classList.add("selected");
      folderElement.setAttribute("aria-expanded", String(isExpanded));
      const icon = folderElement.querySelector(".folder-icon");
      if (icon) {
        icon.textContent = isExpanded ? "📂" : "📁";
      }
      const toggle = folderElement.querySelector(".folder-toggle");
      if (toggle) {
        if (isExpanded) {
          toggle.classList.add("expanded");
        } else {
          toggle.classList.remove("expanded");
        }
      }
      if (isExpanded) {
        folderElement.classList.add("expanded");
      } else {
        folderElement.classList.remove("expanded");
      }
    }
  }
  /**
   * Select item and all descendants (Gmail-style)
   * When selecting a folder, all children are automatically selected
   */
  selectItem(key) {
    this.selectedItems.add(key);
    if (key.startsWith("folder:")) {
      const path = key.replace("folder:", "");
      const descendants = this.getAllDescendants(path);
      descendants.forEach((d) => this.selectedItems.add(d));
    }
    this.updateParentSelection(key);
  }
  /**
   * Deselect item and all descendants (Gmail-style)
   * When deselecting a folder, all children are automatically deselected
   */
  deselectItem(key) {
    this.selectedItems.delete(key);
    if (key.startsWith("folder:")) {
      const path = key.replace("folder:", "");
      const descendants = this.getAllDescendants(path);
      descendants.forEach((d) => this.selectedItems.delete(d));
    }
    this.updateParentSelection(key);
  }
  /**
   * Get all descendant keys (folders and bookmarks) for a folder path
   * Used for Gmail-style selection
   */
  getAllDescendants(path) {
    const keys = [];
    this.folders.filter((f) => f.path.startsWith(path + "/")).forEach((f) => keys.push(`folder:${f.path}`));
    this.bookmarks.filter((b) => b.folderPath === path || b.folderPath?.startsWith(path + "/")).forEach((b) => keys.push(`${b.urlWithoutProtocol}:${b.position}`));
    return keys;
  }
  /**
   * Get parent folder path
   * T2.4: Helper method
   */
  getParentPath(path) {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return null;
    return path.substring(0, lastSlash);
  }
  /**
   * Update parent folder selection based on children (Gmail-style upward sync)
   * Automatically selects parent when all children are selected
   */
  updateParentSelection(childKey) {
    let parentPath = null;
    if (childKey.startsWith("folder:")) {
      parentPath = this.getParentPath(childKey.replace("folder:", ""));
    } else {
      const bookmark = this.bookmarks.find(
        (b) => `${b.urlWithoutProtocol}:${b.position}` === childKey
      );
      if (bookmark && bookmark.folderPath) {
        parentPath = bookmark.folderPath;
      }
    }
    if (!parentPath) return;
    const parentKey = `folder:${parentPath}`;
    const siblings = this.getAllDescendants(parentPath);
    const allSelected = siblings.length > 0 && siblings.every((s) => this.selectedItems.has(s));
    const noneSelected = siblings.every((s) => !this.selectedItems.has(s));
    if (allSelected) {
      this.selectedItems.add(parentKey);
    } else if (noneSelected) {
      this.selectedItems.delete(parentKey);
    } else {
      this.selectedItems.delete(parentKey);
    }
    this.updateParentSelection(parentKey);
  }
  /**
   * Update affected checkboxes incrementally (VSCode-style)
   * Only updates checkboxes that changed, no full re-render
   */
  updateAffectedCheckboxes(changedKey) {
    this.updateSingleCheckbox(changedKey);
    if (changedKey.startsWith("folder:")) {
      const path = changedKey.replace("folder:", "");
      const descendants = this.getAllDescendants(path);
      descendants.forEach((descendantKey) => {
        this.updateSingleCheckbox(descendantKey);
      });
    }
    this.updateParentCheckboxes(changedKey);
  }
  /**
   * Update a single checkbox element
   */
  updateSingleCheckbox(key) {
    let checkbox = null;
    if (key.startsWith("folder:")) {
      const path = key.replace("folder:", "");
      checkbox = this.shadowRoot?.querySelector(
        `.folder-checkbox[data-path="${path}"]`
      );
    } else {
      checkbox = this.shadowRoot?.querySelector(
        `.bookmark-checkbox[data-key="${key}"]`
      );
    }
    if (!checkbox) return;
    if (key.startsWith("folder:")) {
      const path = key.replace("folder:", "");
      if (this.selectedItems.has(key)) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
      } else {
        const descendants = this.getAllDescendants(path);
        const anySelected = descendants.some((d) => this.selectedItems.has(d));
        if (anySelected) {
          checkbox.checked = false;
          checkbox.indeterminate = true;
        } else {
          checkbox.checked = false;
          checkbox.indeterminate = false;
        }
      }
    } else {
      checkbox.checked = this.selectedItems.has(key);
    }
  }
  /**
   * Update parent folder checkboxes recursively
   */
  updateParentCheckboxes(childKey) {
    let parentPath = null;
    if (childKey.startsWith("folder:")) {
      parentPath = this.getParentPath(childKey.replace("folder:", ""));
    } else {
      const bookmark = this.bookmarks.find(
        (b) => `${b.urlWithoutProtocol}:${b.position}` === childKey
      );
      if (bookmark && bookmark.folderPath) {
        parentPath = bookmark.folderPath;
      }
    }
    if (!parentPath) return;
    const parentKey = `folder:${parentPath}`;
    this.updateSingleCheckbox(parentKey);
    this.updateParentCheckboxes(parentKey);
  }
  /**
   * Setup keyboard navigation
   * Reference: ARIA tree view pattern
   */
  setupTreeKeyboardNavigation() {
    this.shadowRoot?.addEventListener("keydown", (e) => {
      const evt = e;
      const target = e.target;
      if (!target.classList.contains("tree-item")) return;
      switch (evt.key) {
        case "ArrowDown":
          evt.preventDefault();
          this.focusNextTreeItem(target);
          break;
        case "ArrowUp":
          evt.preventDefault();
          this.focusPreviousTreeItem(target);
          break;
        case "ArrowRight":
          evt.preventDefault();
          if (target.classList.contains("folder-item")) {
            const path = target.dataset.path;
            this.expandFolder(path);
          }
          break;
        case "ArrowLeft":
          evt.preventDefault();
          if (target.classList.contains("folder-item")) {
            const path = target.dataset.path;
            this.collapseFolder(path);
          }
          break;
        case "Enter":
        case " ":
          evt.preventDefault();
          target.click();
          break;
      }
    });
  }
  focusNextTreeItem(current) {
    const items = Array.from(this.shadowRoot?.querySelectorAll(".tree-item") || []);
    const currentIndex = items.indexOf(current);
    if (currentIndex < items.length - 1) {
      items[currentIndex + 1].focus();
    }
  }
  focusPreviousTreeItem(current) {
    const items = Array.from(this.shadowRoot?.querySelectorAll(".tree-item") || []);
    const currentIndex = items.indexOf(current);
    if (currentIndex > 0) {
      items[currentIndex - 1].focus();
    }
  }
  /**
   * Expand folder (VSCode-style - no re-render)
   */
  async expandFolder(path) {
    if (!this.folderState.isExpanded(path)) {
      this.folderState.toggleExpand(path);
      const folderElement = this.shadowRoot?.querySelector(
        `.folder-item[data-path="${path}"]`
      );
      if (folderElement) {
        folderElement.setAttribute("aria-expanded", "true");
        const icon = folderElement.querySelector(".folder-icon");
        if (icon) {
          icon.textContent = "📂";
        }
        folderElement.classList.add("expanded");
      }
    }
  }
  /**
   * Collapse folder (VSCode-style - no re-render)
   */
  async collapseFolder(path) {
    if (this.folderState.isExpanded(path)) {
      this.folderState.toggleExpand(path);
      const folderElement = this.shadowRoot?.querySelector(
        `.folder-item[data-path="${path}"]`
      );
      if (folderElement) {
        folderElement.setAttribute("aria-expanded", "false");
        const icon = folderElement.querySelector(".folder-icon");
        if (icon) {
          icon.textContent = "📁";
        }
        folderElement.classList.remove("expanded");
      }
    }
  }
  /**
   * Refresh tree view (re-render)
   */
  refreshTreeView() {
    const content = this.shadowRoot?.querySelector(".bookmarks-tab .content");
    if (content) {
      content.innerHTML = this.renderTreeView();
      this.bindTreeEventListeners();
      this.applyCheckboxStates();
    }
  }
  /**
   * Apply checkbox states to DOM elements (Gmail-style)
   * Directly checks selectedItems for accurate state
   */
  applyCheckboxStates() {
    this.shadowRoot?.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      const path = checkbox.dataset.path;
      const folderKey = `folder:${path}`;
      const input = checkbox;
      if (this.selectedItems.has(folderKey)) {
        input.checked = true;
        input.indeterminate = false;
      } else {
        const descendants = this.getAllDescendants(path);
        const anySelected = descendants.some((d) => this.selectedItems.has(d));
        if (anySelected) {
          input.checked = false;
          input.indeterminate = true;
        } else {
          input.checked = false;
          input.indeterminate = false;
        }
      }
    });
    this.shadowRoot?.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
      const key = checkbox.dataset.key;
      checkbox.checked = this.selectedItems.has(key);
    });
  }
  /**
   * Show inline editing for new folder creation
   * Reference: VS Code new folder inline creation
   */
  showCreateFolderInput(parentPath) {
    const name = prompt("Enter folder name:");
    if (!name) return;
    if (name.length > 50) {
      alert("Folder name must be 50 characters or less");
      return;
    }
    if (name.includes("/")) {
      alert('Folder name cannot contain "/"');
      return;
    }
    this.handleCreateFolder(parentPath, name);
  }
  async handleCreateFolder(parentPath, name) {
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    const newDepth = PathUtils.getDepth(newPath);
    if (newDepth > PathUtils.MAX_DEPTH) {
      alert(`❌ Cannot create folder: Maximum folder depth is ${PathUtils.MAX_DEPTH} levels.

Current path would be: ${newPath}
Depth: ${newDepth}

Please create a new root folder or organize within existing folders.`);
      logger$1.warn(`[Folder] Create blocked: depth ${newDepth} exceeds limit (${PathUtils.MAX_DEPTH}) for path: ${newPath}`);
      return;
    }
    const result = await this.folderOpsManager.createFolder(parentPath || "", name);
    if (result.success) {
      this.folders = await FolderStorage.getAll();
      if (parentPath && !this.folderState.isExpanded(parentPath)) {
        this.folderState.toggleExpand(parentPath);
      }
      await this.refreshTreeView();
      logger$1.info(`[Folder] Created successfully`);
    } else {
      alert(`Failed to create folder: ${result.error}`);
      logger$1.error(`[Folder] Create failed:`, result.error);
    }
  }
  /**
   * Show inline editing for folder rename
   * Reference: VS Code inline rename
   */
  showRenameFolderInput(path) {
    const folder = this.folders.find((f) => f.path === path);
    if (!folder) return;
    const folderItems = this.shadowRoot?.querySelectorAll(".folder-item");
    if (!folderItems) return;
    const items = Array.from(folderItems);
    const targetItem = items.find(
      (item) => item.dataset.path === path
    );
    if (!targetItem) return;
    const nameSpan = targetItem.querySelector(".folder-name");
    if (!nameSpan) return;
    const originalName = folder.name;
    const input = document.createElement("input");
    input.type = "text";
    input.value = originalName;
    input.className = "inline-edit-input";
    input.style.cssText = `
            width: 100%;
            padding: 2px 6px;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        `;
    const parent = nameSpan.parentElement;
    if (!parent) return;
    parent.replaceChild(input, nameSpan);
    input.focus();
    input.select();
    const saveEdit = async () => {
      const newName = input.value.trim();
      if (!newName || newName === originalName) {
        parent.replaceChild(nameSpan, input);
        return;
      }
      if (newName.length > 50) {
        alert("Folder name must be 50 characters or less");
        input.focus();
        return;
      }
      if (newName.includes("/")) {
        alert('Folder name cannot contain "/"');
        input.focus();
        return;
      }
      await this.handleRenameFolder(path, newName);
    };
    const cancelEdit = () => {
      parent.replaceChild(nameSpan, input);
    };
    input.addEventListener("blur", saveEdit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    });
  }
  async handleRenameFolder(path, newName) {
    const result = await this.folderOpsManager.renameFolder(path, newName);
    if (result.success) {
      this.folders = await FolderStorage.getAll();
      this.bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
      await this.refreshTreeView();
      logger$1.info(`[Folder] Renamed: ${path} -> ${newName}`);
    } else {
      alert(`Failed to rename folder: ${result.error}`);
      logger$1.error(`[Folder] Rename failed:`, result.error);
    }
  }
  async handleDeleteFolder(path) {
    const hasBookmarks = this.bookmarks.some(
      (b) => b.folderPath === path || b.folderPath?.startsWith(path + "/")
    );
    const hasSubfolders = this.folders.some(
      (f) => f.path.startsWith(path + "/")
    );
    if (hasBookmarks || hasSubfolders) {
      alert("Please remove all items before deleting folder");
      return;
    }
    if (!confirm(`Delete folder "${path}"?`)) {
      return;
    }
    const result = await this.folderOpsManager.deleteFolder(path);
    if (result.success) {
      this.folders = await FolderStorage.getAll();
      await this.refreshTreeView();
      logger$1.info(`[Folder] Deleted: ${path}`);
    } else {
      alert(`Failed to delete folder: ${result.error}`);
      logger$1.error(`[Folder] Delete failed:`, result.error);
    }
  }
  /**
   * Switch tab
   */
  switchTab(tab) {
    this.shadowRoot?.querySelectorAll(".tab-btn").forEach((btn) => {
      if (btn.getAttribute("data-tab") === tab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    this.shadowRoot?.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    const activeContent = this.shadowRoot?.querySelector(`.${tab}-tab`);
    if (activeContent) {
      activeContent.classList.add("active");
    }
  }
  /**
   * Show detail modal
   */
  showDetailModal(url, position) {
    const bookmark = this.filteredBookmarks.find(
      (b) => b.url === url && b.position === position
    );
    if (!bookmark) return;
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "detail-modal-overlay";
    const modal = document.createElement("div");
    modal.className = "detail-modal";
    modal.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    modal.innerHTML = `
            <div class="detail-header">
                <h3>${this.escapeHtml(bookmark.title || bookmark.userMessage.substring(0, 50))}</h3>
                <button class="close-btn">×</button>
            </div>

            <div class="detail-meta">
                <span class="platform-badge ${bookmark.platform?.toLowerCase() || "chatgpt"}">
                    ${this.getPlatformIcon(bookmark.platform)} ${bookmark.platform || "ChatGPT"}
                </span>
                <span class="timestamp">${this.formatTimestamp(bookmark.timestamp)}</span>
            </div>

            <div class="detail-url">
                URL: <a href="${this.escapeHtml(bookmark.url)}" target="_blank">${this.escapeHtml(bookmark.urlWithoutProtocol)}</a>
            </div>

            <div class="detail-content">
                <div class="detail-section">
                    <h4>📝 User Message</h4>
                    <div class="detail-text">${this.escapeHtml(bookmark.userMessage)}</div>
                </div>

                ${bookmark.aiResponse ? `
                    <div class="detail-section">
                        <h4>🤖 AI Response</h4>
                        <div class="detail-text">${this.escapeHtml(bookmark.aiResponse)}</div>
                    </div>
                ` : ""}
            </div>

            <div class="detail-footer">
                <button class="open-conversation-btn" data-url="${this.escapeHtml(bookmark.url)}">
                    Open in Conversation
                </button>
            </div>
        `;
    modalOverlay.appendChild(modal);
    this.shadowRoot?.appendChild(modalOverlay);
    modal.querySelector(".close-btn")?.addEventListener("click", () => {
      modalOverlay.remove();
    });
    modal.querySelector(".open-conversation-btn")?.addEventListener("click", () => {
      window.open(bookmark.url, "_blank");
      modalOverlay.remove();
    });
    modalOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target === modalOverlay) {
        modalOverlay.remove();
      }
    });
    const detailEscHandler = (e) => {
      if (e.key === "Escape") {
        if (modalOverlay.parentNode) {
          e.stopPropagation();
          modalOverlay.remove();
        }
        document.removeEventListener("keydown", detailEscHandler);
      }
    };
    document.addEventListener("keydown", detailEscHandler);
  }
  /**
   * Handle edit
   */
  handleEdit(url, position) {
    const bookmark = this.filteredBookmarks.find(
      (b) => b.url === url && b.position === position
    );
    if (!bookmark) return;
    __vitePreload(async () => { const {BookmarkSaveModal} = await Promise.resolve().then(() => BookmarkSaveModal$1);return { BookmarkSaveModal }},true?void 0:void 0).then(({ BookmarkSaveModal }) => {
      const saveModal = new BookmarkSaveModal();
      saveModal.show({
        mode: "edit",
        defaultTitle: bookmark.title,
        currentFolder: bookmark.folderPath,
        onSave: async (newTitle, newFolderPath) => {
          await SimpleBookmarkStorage.updateBookmark(url, position, {
            title: newTitle,
            folderPath: newFolderPath
          });
          logger$1.info(`[SimpleBookmarkPanel] Updated bookmark: title="${newTitle}", folder="${newFolderPath}"`);
          await this.refresh();
        }
      });
    });
  }
  /**
   * Handle delete
   */
  async handleDelete(url, position) {
    const bookmark = this.filteredBookmarks.find(
      (b) => b.url === url && b.position === position
    );
    if (!bookmark) return;
    const confirmed = confirm(
      `Delete bookmark "${bookmark.title || bookmark.userMessage.substring(0, 50)}"?

Tip: You can export your bookmarks first to create a backup.`
    );
    if (!confirmed) return;
    try {
      await SimpleBookmarkStorage.remove(url, position);
      logger$1.info(`[SimpleBookmarkPanel] Deleted bookmark at position ${position}`);
      await this.refresh();
    } catch (error) {
      logger$1.error("[SimpleBookmarkPanel] Failed to delete bookmark:", error);
    }
  }
  /**
   * Handle batch delete
   */
  /**
   * Get all items (folders + bookmarks) for select-all
   * Task 3.2.1
   */
  getAllItems() {
    const items = [];
    for (const folder of this.folders) {
      items.push(`folder:${folder.path}`);
    }
    for (const bookmark of this.bookmarks) {
      items.push(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
    }
    return items;
  }
  /**
   * Handle select-all checkbox click (smart mode)
   * Task 3.2.2
   */
  handleSelectAllClick(checked) {
    if (checked) {
      const isSearching = this.searchQuery.trim() !== "";
      if (isSearching) {
        this.selectAllVisible();
      } else {
        this.selectAllItems();
      }
    } else {
      this.clearSelection();
    }
  }
  /**
   * Select all items (folders + bookmarks)
   * Task 3.2.3
   */
  selectAllItems() {
    for (const folder of this.folders) {
      this.selectedItems.add(`folder:${folder.path}`);
    }
    for (const bookmark of this.bookmarks) {
      this.selectedItems.add(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
    }
    this.updateBatchActionsBar();
    this.updateAllCheckboxes();
  }
  /**
   * Select all visible items (for search mode)
   * Task 3.2.4
   */
  selectAllVisible() {
    for (const bookmark of this.filteredBookmarks) {
      this.selectedItems.add(`${bookmark.urlWithoutProtocol}:${bookmark.position}`);
    }
    this.updateBatchActionsBar();
    this.updateAllCheckboxes();
  }
  /**
   * Clear all selections
   * Task 3.2.5
   */
  clearSelection() {
    this.selectedItems.clear();
    this.updateBatchActionsBar();
    this.updateAllCheckboxes();
  }
  /**
   * Update all checkboxes in the UI
   * Task 3.2.6
   */
  updateAllCheckboxes() {
    this.shadowRoot?.querySelectorAll(".folder-checkbox").forEach((checkbox) => {
      const path = checkbox.dataset.path;
      if (path) {
        const key = `folder:${path}`;
        checkbox.checked = this.selectedItems.has(key);
      }
    });
    this.shadowRoot?.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
      const key = checkbox.dataset.key;
      if (key) {
        checkbox.checked = this.selectedItems.has(key);
      }
    });
  }
  /**
   * Update batch actions bar visibility and state
   * Task 3.2.7 - Enhanced with CSS classes and checkbox states
   */
  updateBatchActionsBar() {
    const bar = this.shadowRoot?.querySelector(".batch-actions-bar");
    const countSpan = this.shadowRoot?.querySelector(".batch-actions-bar .selected-count");
    const selectAllCheckbox = this.shadowRoot?.querySelector(".select-all-checkbox");
    if (!bar) return;
    const count = this.selectedItems.size;
    if (count > 0) {
      bar.classList.add("visible");
      if (countSpan) {
        const bookmarkCount = this.getSelectedBookmarks().length;
        countSpan.textContent = `${bookmarkCount} bookmarks selected`;
      }
      if (selectAllCheckbox) {
        const allItems = this.getAllItems();
        if (count === allItems.length) {
          selectAllCheckbox.checked = true;
          selectAllCheckbox.indeterminate = false;
        } else {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = true;
        }
      }
    } else {
      bar.classList.remove("visible");
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }
  }
  /**
   * Find bookmark by key
   * Task 3.3.1
   */
  findBookmarkByKey(key) {
    const lastColonIndex = key.lastIndexOf(":");
    if (lastColonIndex === -1) return null;
    const urlWithoutProtocol = key.substring(0, lastColonIndex);
    const position = parseInt(key.substring(lastColonIndex + 1));
    return this.bookmarks.find(
      (b) => b.urlWithoutProtocol === urlWithoutProtocol && b.position === position
    ) || null;
  }
  /**
   * Get selected bookmarks (with recursive folder traversal)
   * Task 3.3.2
   */
  getSelectedBookmarks() {
    const bookmarks = [];
    const seen = /* @__PURE__ */ new Set();
    for (const key of this.selectedItems) {
      if (key.startsWith("folder:")) {
        const path = key.substring(7);
        const folderBookmarks = this.bookmarks.filter(
          (b) => b.folderPath === path || b.folderPath?.startsWith(path + "/")
        );
        for (const bookmark of folderBookmarks) {
          const bookmarkKey = `${bookmark.urlWithoutProtocol}:${bookmark.position}`;
          if (!seen.has(bookmarkKey)) {
            bookmarks.push(bookmark);
            seen.add(bookmarkKey);
          }
        }
      } else {
        const bookmark = this.findBookmarkByKey(key);
        if (bookmark && !seen.has(key)) {
          bookmarks.push(bookmark);
          seen.add(key);
        }
      }
    }
    return bookmarks;
  }
  /**
   * Handle batch export
   * Task 3.3.3
   */
  async handleBatchExport() {
    if (this.selectedItems.size === 0) {
      alert("Please select items to export");
      return;
    }
    const selectedBookmarks = this.getSelectedBookmarks();
    if (selectedBookmarks.length === 0) {
      alert("No bookmarks selected");
      return;
    }
    const preserveStructure = await this.showExportOptionsDialog();
    if (preserveStructure === null) return;
    const bookmarksToExport = preserveStructure ? selectedBookmarks : selectedBookmarks.map((b) => ({ ...b, folderPath: null }));
    const exportData = {
      version: "2.0",
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      bookmarks: bookmarksToExport
    };
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmarks-selected-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logger$1.info(`[Batch Export] Exported ${bookmarksToExport.length} bookmarks (structure: ${preserveStructure})`);
  }
  /**
   * Analyze selected items into categories
   * Task 3.4.1
   */
  analyzeSelection() {
    const folders = [];
    const subfolders = [];
    const bookmarks = [];
    for (const key of this.selectedItems) {
      if (key.startsWith("folder:")) {
        const path = key.substring(7);
        const folder = this.folders.find((f) => f.path === path);
        if (folder) {
          if (folder.depth === 1) {
            folders.push(folder);
          } else {
            subfolders.push(folder);
          }
        }
      } else {
        const bookmark = this.findBookmarkByKey(key);
        if (bookmark) {
          bookmarks.push(bookmark);
        }
      }
    }
    return { folders, subfolders, bookmarks };
  }
  /**
   * Show custom delete confirmation modal
   * Task 3.4.2
   */
  async showBatchDeleteConfirmation(analysis) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
      const modal = document.createElement("div");
      modal.style.cssText = `
                background: white;
                border-radius: 8px;
                box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2),
                            0 24px 38px 3px rgba(0,0,0,0.14),
                            0 9px 46px 8px rgba(0,0,0,0.12);
                max-width: 400px;
                width: 90%;
            `;
      modal.innerHTML = `
                <div style="padding: 24px 24px 20px;">
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                        <span style="font-size: 24px;">⚠️</span>
                        <h3 style="margin: 0; font-size: 20px; font-weight: 500; color: #202124;">
                            Delete Selected Items
                        </h3>
                    </div>
                    <div style="color: #5f6368; font-size: 14px; line-height: 1.5;">
                        <p style="margin: 0 0 16px 0;">This will permanently delete:</p>
                        <ul style="margin: 0; padding-left: 24px;">
                            ${analysis.folders.length > 0 ? `<li>📁 ${analysis.folders.length} root folder${analysis.folders.length > 1 ? "s" : ""}</li>` : ""}
                            ${analysis.subfolders.length > 0 ? `<li>📁 ${analysis.subfolders.length} subfolder${analysis.subfolders.length > 1 ? "s" : ""}</li>` : ""}
                            ${analysis.bookmarks.length > 0 ? `<li>🔖 ${analysis.bookmarks.length} bookmark${analysis.bookmarks.length > 1 ? "s" : ""}</li>` : ""}
                        </ul>
                        <p style="margin: 16px 0 0 0; font-weight: 500; color: #d93025;">
                            This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div style="padding: 8px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e8eaed;">
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: transparent;
                        color: #1a73e8;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">Cancel</button>
                    <button class="delete-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #d93025;
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">Delete</button>
                </div>
            `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const cancelBtn = modal.querySelector(".cancel-btn");
      const deleteBtn = modal.querySelector(".delete-btn");
      cancelBtn.addEventListener("mouseenter", () => {
        cancelBtn.style.background = "#f1f3f4";
      });
      cancelBtn.addEventListener("mouseleave", () => {
        cancelBtn.style.background = "transparent";
      });
      deleteBtn.addEventListener("mouseenter", () => {
        deleteBtn.style.background = "#c5221f";
      });
      deleteBtn.addEventListener("mouseleave", () => {
        deleteBtn.style.background = "#d93025";
      });
      cancelBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(false);
      });
      deleteBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(true);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          overlay.remove();
          document.removeEventListener("keydown", handleEscape);
          resolve(false);
        }
      };
      document.addEventListener("keydown", handleEscape);
    });
  }
  /**
   * Execute batch delete with proper order and error handling
   * Task 3.4.4
   */
  async executeBatchDelete(analysis) {
    const errors = [];
    logger$1.info(`[Batch Delete] Deleting ${analysis.bookmarks.length} bookmarks...`);
    for (const bookmark of analysis.bookmarks) {
      try {
        await SimpleBookmarkStorage.remove(
          bookmark.urlWithoutProtocol,
          bookmark.position
        );
      } catch (error) {
        errors.push(`Failed to delete bookmark: ${bookmark.title}`);
        logger$1.error("[Batch Delete] Bookmark error:", error);
      }
    }
    const allFolders = [...analysis.folders, ...analysis.subfolders];
    const sortedFolders = allFolders.sort((a, b) => b.depth - a.depth);
    logger$1.info(`[Batch Delete] Deleting ${sortedFolders.length} folders (deepest first)...`);
    for (const folder of sortedFolders) {
      try {
        await FolderStorage.delete(folder.path);
      } catch (error) {
        errors.push(`Failed to delete folder: ${folder.name}`);
        logger$1.error("[Batch Delete] Folder error:", error);
      }
    }
    if (errors.length > 0) {
      this.showErrorSummary(errors);
    } else {
      const totalDeleted = analysis.bookmarks.length + sortedFolders.length;
      logger$1.info(`[Batch Delete] Successfully deleted ${totalDeleted} items`);
    }
    this.selectedItems.clear();
    await this.refresh();
  }
  /**
   * Show error summary modal
   * Task 3.4.5
   */
  showErrorSummary(errors) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    const modal = document.createElement("div");
    modal.style.cssText = `
            background: white;
            border-radius: 8px;
            box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2),
                        0 24px 38px 3px rgba(0,0,0,0.14),
                        0 9px 46px 8px rgba(0,0,0,0.12);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;
    modal.innerHTML = `
            <div style="padding: 24px 24px 20px;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                    <span style="font-size: 24px;">⚠️</span>
                    <h3 style="margin: 0; font-size: 20px; font-weight: 500; color: #202124;">
                        Deletion Completed with Errors
                    </h3>
                </div>
                <div style="color: #5f6368; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 0 0 12px 0;">
                        Completed with <strong>${errors.length}</strong> error${errors.length > 1 ? "s" : ""}:
                    </p>
                    <div style="
                        max-height: 300px;
                        overflow-y: auto;
                        background: #f8f9fa;
                        border-radius: 4px;
                        padding: 12px;
                    ">
                        <ul style="margin: 0; padding-left: 20px;">
                            ${errors.map((err) => `<li style="margin-bottom: 8px;">${err}</li>`).join("")}
                        </ul>
                    </div>
                </div>
            </div>
            <div style="padding: 8px; display: flex; justify-content: flex-end; border-top: 1px solid #e8eaed;">
                <button class="ok-btn" style="
                    padding: 8px 24px;
                    border: none;
                    border-radius: 4px;
                    background: #1a73e8;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">OK</button>
            </div>
        `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const okBtn = modal.querySelector(".ok-btn");
    okBtn.addEventListener("mouseenter", () => {
      okBtn.style.background = "#1765cc";
    });
    okBtn.addEventListener("mouseleave", () => {
      okBtn.style.background = "#1a73e8";
    });
    okBtn.addEventListener("click", () => {
      overlay.remove();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }
  /**
   * Handle batch delete (main orchestration)
   * Task 3.4.6
   */
  async handleBatchDelete() {
    if (this.selectedItems.size === 0) return;
    const analysis = this.analyzeSelection();
    const confirmed = await this.showBatchDeleteConfirmation(analysis);
    if (!confirmed) return;
    await this.executeBatchDelete(analysis);
  }
  /**
   * Handle batch move (placeholder)
   * Task 3.5.1
   */
  async handleBatchMove() {
    if (this.selectedItems.size === 0) {
      alert("Please select items to move");
      return;
    }
    alert("Batch move feature coming soon!\n\nThis will allow you to move selected bookmarks to a different folder.");
    logger$1.info("[Batch Move] Feature not yet implemented");
  }
  /**
   * Show export options dialog
   * Returns: true = preserve structure, false = remove structure, null = cancelled
   */
  async showExportOptionsDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
      const modal = document.createElement("div");
      modal.style.cssText = `
                background: white;
                border-radius: 8px;
                box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2),
                            0 24px 38px 3px rgba(0,0,0,0.14),
                            0 9px 46px 8px rgba(0,0,0,0.12);
                max-width: 400px;
                width: 90%;
                padding: 24px;
            `;
      modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 500; color: #202124;">
                    导出选项
                </h3>
                <div style="margin-bottom: 24px;">
                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                        <input type="checkbox" id="preserve-structure" checked 
                               style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 14px; color: #5f6368;">
                            同时保留文件夹结构
                        </span>
                    </label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        color: #5f6368;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">取消</button>
                    <button class="export-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #1a73e8;
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">导出</button>
                </div>
            `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const checkbox = modal.querySelector("#preserve-structure");
      const cancelBtn = modal.querySelector(".cancel-btn");
      const exportBtn = modal.querySelector(".export-btn");
      cancelBtn.addEventListener("mouseenter", () => {
        cancelBtn.style.background = "#f1f3f4";
      });
      cancelBtn.addEventListener("mouseleave", () => {
        cancelBtn.style.background = "white";
      });
      exportBtn.addEventListener("mouseenter", () => {
        exportBtn.style.background = "#1765cc";
      });
      exportBtn.addEventListener("mouseleave", () => {
        exportBtn.style.background = "#1a73e8";
      });
      cancelBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(null);
      });
      exportBtn.addEventListener("click", () => {
        const preserveStructure = checkbox.checked;
        overlay.remove();
        resolve(preserveStructure);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(null);
        }
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          overlay.remove();
          document.removeEventListener("keydown", handleEscape);
          resolve(null);
        }
      };
      document.addEventListener("keydown", handleEscape);
    });
  }
  /**
   * Handle export
   */
  async handleExport() {
    const preserveStructure = await this.showExportOptionsDialog();
    if (preserveStructure === null) return;
    const bookmarksToExport = preserveStructure ? this.bookmarks : this.bookmarks.map((b) => ({ ...b, folderPath: null }));
    const exportData = {
      version: "2.0",
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      bookmarks: bookmarksToExport
    };
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmarks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logger$1.info(`[Export] Exported ${bookmarksToExport.length} bookmarks (structure: ${preserveStructure})`);
  }
  /**
   * Handle import
   */
  async handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const bookmarks = this.validateImportData(data);
        logger$1.info(`[Import] Validated ${bookmarks.length} bookmarks`);
        const analysis = this.analyzeImportData(bookmarks);
        if (analysis.noFolder.length > 0 || analysis.tooDeep.length > 0) {
          const shouldProceed = await this.showImportSummary(analysis);
          if (!shouldProceed) {
            logger$1.info("[Import] User cancelled import");
            return;
          }
          analysis.noFolder.forEach((b) => b.folderPath = "Import");
          analysis.tooDeep.forEach((b) => b.folderPath = "Import");
        }
        const allBookmarks = [...analysis.valid, ...analysis.noFolder, ...analysis.tooDeep];
        const folderPathsNeeded = /* @__PURE__ */ new Set();
        for (const bookmark of allBookmarks) {
          if (bookmark.folderPath && bookmark.folderPath.trim()) {
            folderPathsNeeded.add(bookmark.folderPath);
          }
        }
        logger$1.info(`[Import] Checking ${folderPathsNeeded.size} unique folder paths`);
        for (const folderPath of folderPathsNeeded) {
          const exists = this.folders.some((f) => f.path === folderPath);
          if (!exists) {
            logger$1.info(`[Import] Creating missing folder: ${folderPath}`);
            try {
              await FolderStorage.create(folderPath);
            } catch (error) {
              logger$1.error(`[Import] Failed to create folder ${folderPath}:`, error);
            }
          } else {
            logger$1.info(`[Import] Folder already exists: ${folderPath}`);
          }
        }
        this.folders = await FolderStorage.getAll();
        logger$1.info(`[Import] Loaded ${this.folders.length} folders after creation`);
        const conflicts = await this.detectConflicts(allBookmarks);
        if (conflicts.length > 0) {
          const shouldMerge = await this.showConflictDialog(conflicts, allBookmarks);
          if (!shouldMerge) {
            logger$1.info("[Import] User cancelled import");
            return;
          }
        }
        await this.importBookmarks(allBookmarks, false);
        await this.refresh();
        alert(`✅ Successfully imported ${bookmarks.length} bookmark(s)!`);
        logger$1.info(`[Import] Successfully imported ${bookmarks.length} bookmarks`);
      } catch (error) {
        logger$1.error("[Import] Failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        alert(`❌ Import failed: ${errorMessage}`);
      }
    };
    input.click();
  }
  /**
   * Analyze import data for folder path issues
   * Issue 2: Categorize bookmarks by folder path validity
   */
  analyzeImportData(bookmarks) {
    const valid = [];
    const noFolder = [];
    const tooDeep = [];
    logger$1.info(`[Import Analysis] Analyzing ${bookmarks.length} bookmarks`);
    logger$1.info(`[Import Analysis] MAX_DEPTH = ${PathUtils.MAX_DEPTH}`);
    for (const bookmark of bookmarks) {
      const folderPath = bookmark.folderPath;
      if (!folderPath || folderPath.trim() === "") {
        logger$1.info(`[Import Analysis] No folder: ${bookmark.title?.substring(0, 50)}`);
        noFolder.push(bookmark);
      } else {
        const depth = PathUtils.getDepth(folderPath);
        logger$1.info(`[Import Analysis] Folder "${folderPath}" depth=${depth}, title="${bookmark.title?.substring(0, 50)}"`);
        if (depth > PathUtils.MAX_DEPTH) {
          logger$1.info(`[Import Analysis] Too deep (${depth} > ${PathUtils.MAX_DEPTH}): ${folderPath}`);
          tooDeep.push(bookmark);
        } else {
          valid.push(bookmark);
        }
      }
    }
    logger$1.info(`[Import Analysis] Results: valid=${valid.length}, noFolder=${noFolder.length}, tooDeep=${tooDeep.length}`);
    return { valid, noFolder, tooDeep };
  }
  /**
   * Show import summary dialog
   * Issue 2: Display summary and ask for confirmation
   */
  async showImportSummary(analysis) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
      const modal = document.createElement("div");
      modal.style.cssText = `
                background: white;
                border-radius: 8px;
                box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2),
                            0 24px 38px 3px rgba(0,0,0,0.14),
                            0 9px 46px 8px rgba(0,0,0,0.12);
                max-width: 450px;
                width: 90%;
                padding: 24px;
            `;
      const totalIssues = analysis.noFolder.length + analysis.tooDeep.length;
      modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 500; color: #202124;">
                    📥 导入摘要
                </h3>
                <div style="font-size: 14px; color: #5f6368; line-height: 1.6;">
                    <p style="margin: 0 0 12px 0;">
                        准备导入 <strong>${analysis.valid.length + analysis.noFolder.length + analysis.tooDeep.length}</strong> 个书签：
                    </p>
                    <ul style="margin: 0 0 16px 0; padding-left: 24px;">
                        <li>✅ ${analysis.valid.length} 个书签将正常导入</li>
                        ${analysis.noFolder.length > 0 ? `<li>📁 ${analysis.noFolder.length} 个书签无文件夹 → 将导入到 <strong>Import</strong> 文件夹</li>` : ""}
                        ${analysis.tooDeep.length > 0 ? `<li>⚠️ ${analysis.tooDeep.length} 个书签文件夹层级过深 → 将导入到 <strong>Import</strong> 文件夹</li>` : ""}
                    </ul>
                    ${totalIssues > 0 ? `
                        <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                            <div style="font-weight: 500; color: #856404; margin-bottom: 4px;">ℹ️ 注意</div>
                            <div style="color: #856404; font-size: 13px;">
                                ${analysis.noFolder.length + analysis.tooDeep.length} 个书签将自动归类到 Import 文件夹
                            </div>
                        </div>
                    ` : ""}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        color: #5f6368;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">取消</button>
                    <button class="proceed-btn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        background: #1a73e8;
                        color: white;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                    ">继续导入</button>
                </div>
            `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const cancelBtn = modal.querySelector(".cancel-btn");
      const proceedBtn = modal.querySelector(".proceed-btn");
      cancelBtn.addEventListener("mouseenter", () => {
        cancelBtn.style.background = "#f1f3f4";
      });
      cancelBtn.addEventListener("mouseleave", () => {
        cancelBtn.style.background = "white";
      });
      proceedBtn.addEventListener("mouseenter", () => {
        proceedBtn.style.background = "#1765cc";
      });
      proceedBtn.addEventListener("mouseleave", () => {
        proceedBtn.style.background = "#1a73e8";
      });
      cancelBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(false);
      });
      proceedBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(true);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          overlay.remove();
          document.removeEventListener("keydown", handleEscape);
          resolve(false);
        }
      };
      document.addEventListener("keydown", handleEscape);
    });
  }
  /**
  
      /**
       * Validate import data
       */
  validateImportData(data) {
    let bookmarksArray;
    if (Array.isArray(data)) {
      bookmarksArray = data;
      logger$1.info("[Import] Detected old format (direct array)");
    } else if (data && typeof data === "object" && Array.isArray(data.bookmarks)) {
      bookmarksArray = data.bookmarks;
      logger$1.info(`[Import] Detected new format (version: ${data.version || "unknown"})`);
    } else {
      throw new Error("Invalid format: expected an array of bookmarks or an object with bookmarks field");
    }
    const validBookmarks = [];
    const errors = [];
    bookmarksArray.forEach((item, index) => {
      if (SimpleBookmarkStorage.validateBookmark(item)) {
        validBookmarks.push(item);
      } else {
        errors.push(`Invalid bookmark at index ${index}`);
        logger$1.warn(`[Import] Invalid bookmark at index ${index}:`, item);
      }
    });
    if (errors.length > 0) {
      logger$1.warn(`[Import] ${errors.length} invalid bookmarks skipped`);
    }
    if (validBookmarks.length === 0) {
      throw new Error("No valid bookmarks found in file");
    }
    return validBookmarks;
  }
  /**
   * Detect conflicts (existing bookmarks with same url+position)
   */
  async detectConflicts(bookmarks) {
    const conflicts = [];
    for (const bookmark of bookmarks) {
      const exists = await SimpleBookmarkStorage.isBookmarked(
        bookmark.url,
        bookmark.position
      );
      if (exists) {
        conflicts.push(bookmark);
      }
    }
    return conflicts;
  }
  /**
   * Show conflict resolution dialog
   * Returns: true (merge) or false (cancel)
   */
  async showConflictDialog(conflicts, allBookmarks) {
    return new Promise((resolve) => {
      const modalOverlay = document.createElement("div");
      modalOverlay.className = "conflict-dialog-overlay";
      const modal = document.createElement("div");
      modal.className = "conflict-dialog";
      modal.innerHTML = `
                <div class="conflict-header">
                    <h3>⚠️ Duplicate Bookmarks Detected</h3>
                </div>

                <div class="conflict-body">
                    <p>Found <strong>${conflicts.length}</strong> bookmark(s) that already exist.</p>
                    <p>Total bookmarks to import: <strong>${allBookmarks.length}</strong></p>
                    <p style="margin-top: 16px; color: #6b7280;">Click <strong>Merge</strong> to import all bookmarks (duplicates will be overwritten).</p>

                    <div class="conflict-list">
                        ${conflicts.slice(0, 5).map((b) => `
                            <div class="conflict-item">
                                <span class="platform-badge ${b.platform?.toLowerCase() || "chatgpt"}">
                                    ${this.getPlatformIcon(b.platform)} ${b.platform || "ChatGPT"}
                                </span>
                                <span class="conflict-title">${this.escapeHtml(this.truncate(b.title || b.userMessage, 50))}</span>
                            </div>
                        `).join("")}
                        ${conflicts.length > 5 ? `<div class="conflict-more">... and ${conflicts.length - 5} more</div>` : ""}
                    </div>
                </div>

                <div class="conflict-footer">
                    <button class="conflict-btn cancel-btn">Cancel</button>
                    <button class="conflict-btn merge-btn">Merge</button>
                </div>
            `;
      modalOverlay.appendChild(modal);
      this.shadowRoot?.appendChild(modalOverlay);
      modal.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      modal.querySelector(".merge-btn")?.addEventListener("click", () => {
        modalOverlay.remove();
        resolve(true);
      });
      modal.querySelector(".cancel-btn")?.addEventListener("click", () => {
        modalOverlay.remove();
        resolve(false);
      });
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          modalOverlay.remove();
          resolve(false);
        }
      });
    });
  }
  /**
   * Import bookmarks (batch save)
   */
  async importBookmarks(bookmarks, skipDuplicates) {
    const promises = [];
    for (const bookmark of bookmarks) {
      if (skipDuplicates) {
        const exists = await SimpleBookmarkStorage.isBookmarked(
          bookmark.url,
          bookmark.position
        );
        if (exists) {
          logger$1.debug(`[Import] Skipping duplicate: ${bookmark.url}:${bookmark.position}`);
          continue;
        }
      }
      promises.push(
        SimpleBookmarkStorage.save(
          bookmark.url,
          bookmark.position,
          bookmark.userMessage,
          bookmark.aiResponse,
          bookmark.title,
          bookmark.platform,
          bookmark.timestamp
          // Preserve original timestamp from JSON
        )
      );
    }
    await Promise.all(promises);
    logger$1.info(`[Import] Imported ${promises.length} bookmarks`);
  }
  /**
   * Setup storage change listener - AITimeline pattern
   */
  setupStorageListener() {
    if (this.storageListener) return;
    this.storageListener = (changes, areaName) => {
      if (areaName === "local") {
        const bookmarkChanged = Object.keys(changes).some(
          (key) => key.startsWith("bookmark:")
        );
        if (bookmarkChanged && this.overlay?.style.display !== "none") {
          this.refresh();
          logger$1.debug("[SimpleBookmarkPanel] Auto-refreshed due to storage change");
        }
      }
    };
    chrome.storage.onChanged.addListener(this.storageListener);
    logger$1.info("[SimpleBookmarkPanel] Storage listener setup");
  }
  /**
   * Smooth scroll to target element - EXACT AITimeline implementation
   */
  smoothScrollTo(targetElement) {
    if (!targetElement) return;
    console.log("[smoothScrollTo] Scrolling to element:", targetElement);
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    setTimeout(() => {
      this.highlightElement(targetElement);
    }, 100);
  }
  /**
   * Highlight element briefly
   */
  highlightElement(element) {
    console.log("[highlightElement] Adding highlight to element:", element);
    element.classList.add("bookmark-highlight");
    setTimeout(() => {
      console.log("[highlightElement] Removing highlight from element");
      element.classList.remove("bookmark-highlight");
    }, 3e3);
  }
  /**
   * Handle bookmark navigation - Go To
   */
  async handleGoTo(url, position) {
    console.log(`[handleGoTo] Starting navigation to ${url} position ${position}`);
    const currentUrl = window.location.href;
    const targetUrl = url;
    const isCurrentPage = this.isSamePage(currentUrl, targetUrl);
    console.log(`[handleGoTo] isCurrentPage: ${isCurrentPage}`);
    if (isCurrentPage) {
      console.log("[handleGoTo] Same page - closing panel and scrolling");
      this.hide();
      await this.smoothScrollToPosition(position);
      console.log(`[handleGoTo] Scrolled to position ${position} on current page`);
    } else {
      console.log("[handleGoTo] Cross-page - navigating with window.location.href");
      await this.setNavigateData("targetPosition", position);
      window.location.href = targetUrl;
      console.log(`[handleGoTo] Navigating to ${targetUrl} with target position ${position}`);
    }
  }
  /**
   * Check if two URLs are the same page
   */
  isSamePage(url1, url2) {
    const normalize = (url) => {
      return url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/#.*$/, "").replace(/\?.*$/, "");
    };
    return normalize(url1) === normalize(url2);
  }
  /**
   * Smooth scroll to bookmark position
   */
  async smoothScrollToPosition(position) {
    console.log(`[smoothScrollToPosition] Starting scroll to position ${position}`);
    const isGemini = window.location.href.includes("gemini.google.com");
    const isChatGPT = window.location.href.includes("chatgpt.com");
    let messageSelector;
    if (isGemini) {
      messageSelector = "model-response";
      console.log("[smoothScrollToPosition] Platform: Gemini");
    } else if (isChatGPT) {
      messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
      console.log("[smoothScrollToPosition] Platform: ChatGPT");
    } else {
      console.error("[smoothScrollToPosition] Unknown platform");
      return;
    }
    console.log(`[smoothScrollToPosition] Using selector: ${messageSelector}`);
    const messages = document.querySelectorAll(messageSelector);
    console.log(`[smoothScrollToPosition] Found ${messages.length} messages`);
    const targetIndex = position - 1;
    if (targetIndex >= 0 && targetIndex < messages.length) {
      const targetElement = messages[targetIndex];
      console.log("[smoothScrollToPosition] Target element found, starting smooth scroll");
      this.smoothScrollTo(targetElement);
    } else {
      console.error(`[smoothScrollToPosition] Invalid position: ${position} (messages: ${messages.length})`);
    }
  }
  /**
   * Storage helpers - AITimeline pattern
   */
  // @ts-ignore - Used in handleGoTo
  async setNavigateData(key, value) {
    try {
      const storageKey = `bookmarkNavigate:${key}`;
      await chrome.storage.local.set({ [storageKey]: value });
      console.log(`[setNavigateData] Set ${storageKey} = ${value}`);
    } catch (error) {
      console.error("[setNavigateData] Error:", error);
    }
  }
  async getNavigateData(key) {
    try {
      const storageKey = `bookmarkNavigate:${key}`;
      const result = await chrome.storage.local.get(storageKey);
      const value = result[storageKey];
      if (value !== void 0) {
        await chrome.storage.local.remove(storageKey);
        console.log(`[getNavigateData] Got ${storageKey} = ${value}`);
        return value;
      }
      return null;
    } catch (error) {
      console.error("[getNavigateData] Error:", error);
      return null;
    }
  }
  /**
   * Check for navigation target on page load - AITimeline pattern
   */
  async checkNavigationTarget() {
    console.log("=== [checkNavigationTarget] START ===");
    try {
      const targetPosition = await this.getNavigateData("targetPosition");
      console.log("[checkNavigationTarget] targetPosition from storage:", targetPosition);
      if (targetPosition !== null) {
        console.log(`[checkNavigationTarget] Found target position: ${targetPosition}`);
        requestAnimationFrame(async () => {
          console.log("[checkNavigationTarget] In requestAnimationFrame callback");
          const isGemini = window.location.href.includes("gemini.google.com");
          const isChatGPT = window.location.href.includes("chatgpt.com");
          let messageSelector;
          if (isGemini) {
            messageSelector = "model-response";
            console.log("[checkNavigationTarget] Platform: Gemini");
          } else if (isChatGPT) {
            messageSelector = 'article[data-turn="assistant"], [data-message-author-role="assistant"]:not(article [data-message-author-role="assistant"])';
            console.log("[checkNavigationTarget] Platform: ChatGPT");
          } else {
            console.error("[checkNavigationTarget] Unknown platform");
            return;
          }
          console.log("[checkNavigationTarget] Using selector:", messageSelector);
          const messages = document.querySelectorAll(messageSelector);
          console.log("[checkNavigationTarget] Found messages:", messages.length);
          const targetIndex = targetPosition - 1;
          console.log("[checkNavigationTarget] Target index (0-based):", targetIndex);
          if (targetIndex >= 0 && targetIndex < messages.length) {
            const targetElement = messages[targetIndex];
            console.log("[checkNavigationTarget] Target element:", targetElement);
            if (targetElement) {
              console.log(`[checkNavigationTarget] Calling smoothScrollTo for position ${targetPosition}`);
              this.smoothScrollTo(targetElement);
            } else {
              console.error("[checkNavigationTarget] Target element is null");
            }
          } else {
            console.error(`[checkNavigationTarget] Invalid position: ${targetPosition} (messages: ${messages.length})`);
          }
          console.log("=== [checkNavigationTarget] END ===");
        });
      } else {
        console.log("[checkNavigationTarget] No navigation target found in storage");
      }
    } catch (error) {
      console.error("[checkNavigationTarget] Error:", error);
    }
  }
  /**
   * Cleanup
   */
  destroy() {
    if (this.storageListener) {
      chrome.storage.onChanged.removeListener(this.storageListener);
      this.storageListener = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.shadowRoot = null;
    }
  }
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  /**
   * Get panel styles
   */
  getStyles() {
    return `
            :host {
                all: initial;
            }

            * {
                box-sizing: border-box;
            }

            .panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(800px, 90vw);
                max-width: 800px;
                height: min(800px, 80vh);
                max-height: 800px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                display: flex;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                overflow: hidden;
            }

            .toolbar {
                display: flex;
                gap: 8px;
                padding: 12px;
                background: #f9fafb;
                border-bottom: 1px solid #e5e7eb;
                align-items: center;
                flex-wrap: wrap;
            }

            .toolbar-divider {
                width: 1px;
                height: 24px;
                background: #d1d5db;
                margin: 0 4px;
            }

            .new-folder-btn,
            .export-btn,
            .import-btn {
                padding: 6px 12px;
                border: 1px solid #d1d5db;
                background: white;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
            }

            .new-folder-btn:hover,
            .export-btn:hover,
            .import-btn:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
            }

            .new-folder-btn {
                font-weight: 500;
                color: #3b82f6;
                border-color: #3b82f6;
            }

            .new-folder-btn:hover {
                background: #eff6ff;
            }

            /* Sidebar */
            .sidebar {
                width: 120px;
                background: #f9fafb;
                border-right: 1px solid #e5e7eb;
                display: flex;
                flex-direction: column;
                padding: 16px 0;
            }

            .tab-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 16px 12px;
                border: none;
                background: transparent;
                cursor: pointer;
                transition: all 0.2s;
                color: #6b7280;
                font-size: 12px;
            }

            .tab-btn:hover {
                background: #f3f4f6;
                color: #111827;
            }

            .tab-btn.active {
                background: white;
                color: #3b82f6;
                font-weight: 500;
            }

            .tab-icon {
                font-size: 24px;
            }

            .tab-label {
                text-align: center;
                line-height: 1.2;
            }

            /* Main content */
            .main {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .header h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #111827;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 28px;
                color: #6b7280;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s;
            }

            .close-btn:hover {
                background: #f3f4f6;
                color: #111827;
            }

            /* Tab content */
            .tab-content {
                display: none;
                flex: 1;
                flex-direction: column;
                overflow: hidden;
            }

            .tab-content.active {
                display: flex;
            }

            /* Toolbar */
            .toolbar {
                padding: 12px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                gap: 12px;
                align-items: center;
            }

            .search-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                font-family: inherit;
            }

            .search-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .platform-filter {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                background: white;
                cursor: pointer;
            }

            .export-btn {
                padding: 8px 16px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .export-btn:hover {
                background: #2563eb;
            }

            /* Content */
            .content {
                flex: 1;
                overflow-y: auto;
                padding: 16px 24px;
            }

            .empty {
                text-align: center;
                padding: 60px 20px;
                color: #6b7280;
                font-size: 15px;
            }

            /* Bookmark list */
            .bookmark-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .bookmark-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .bookmark-item:hover {
                background: #f3f4f6;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
            }

            .platform-badge {
                flex-shrink: 0;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                min-width: 90px;
                text-align: center;
            }

            .platform-badge.chatgpt {
                background: #d1fae5;
                color: #065f46;
            }

            .platform-badge.gemini {
                background: #dbeafe;
                color: #1e40af;
            }

            .title {
                flex: 2;
                font-size: 14px;
                font-weight: 500;
                color: #111827;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .response {
                flex: 3;
                font-size: 13px;
                color: #6b7280;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .notes {
                flex: 1;
                font-size: 13px;
                color: #9ca3af;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .time {
                flex-shrink: 0;
                font-size: 12px;
                color: #9ca3af;
                min-width: 40px;
            }

            .actions {
                flex-shrink: 0;
                display: flex;
                gap: 4px;
            }

            .action-btn {
                width: 24px;
                height: 24px;
                border: none;
                background: transparent;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: all 0.2s ease;
            }

            .action-btn:hover {
                background: rgba(0, 0, 0, 0.05);
                transform: scale(1.1);
            }

            .delete-btn:hover {
                background: rgba(220, 38, 38, 0.1);
            }

            /* Settings content */
            .settings-content,
            .support-content {
                padding: 40px;
                text-align: center;
            }

            .settings-content h3,
            .support-content h3 {
                margin: 0 0 16px 0;
                font-size: 18px;
                color: #111827;
            }

            .settings-content p,
            .support-content p {
                color: #6b7280;
                margin: 0 0 24px 0;
            }
            /* Support button */
            .support-btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                transition: transform 0.2s ease;
            }

            .support-btn:hover {
                transform: translateY(-2px);
            }

            /* Conflict Dialog Styles */
            .conflict-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483648;
            }

            .conflict-dialog {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .conflict-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                background: #fef3c7;
            }

            .conflict-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #92400e;
            }

            .conflict-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            }

            .conflict-body p {
                margin: 0 0 16px 0;
                color: #374151;
                font-size: 14px;
            }

            .conflict-list {
                margin-top: 16px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
            }

            .conflict-item {
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .conflict-item:last-child {
                border-bottom: none;
            }

            .conflict-title {
                flex: 1;
                font-size: 13px;
                color: #374151;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .conflict-more {
                padding: 12px;
                text-align: center;
                font-size: 13px;
                color: #6b7280;
                font-style: italic;
            }

            .conflict-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                background: #f9fafb;
            }

            .toolbar button {
                padding: 8px 12px;
                border: 1px solid #e5e7eb;
                background: #f3f4f6;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
            }

            .toolbar button:hover {
                background: #e5e7eb;
                border-color: #9ca3af;
                color: #374151;
            }

            .toolbar button svg {
                display: block;
            }

            .merge-btn {
                background: #3b82f6;
                color: white;
            }

            .merge-btn:hover {
                background: #2563eb;
            }

            .cancel-btn {
                background: #e5e7eb;
                color: #374151;
            }

            .cancel-btn:hover {
                background: #d1d5db;
            }

            /* Detail Modal */
            .detail-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483648;
            }

            .detail-modal {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 700px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }

            .detail-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .detail-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }

            .detail-meta {
                padding: 12px 24px;
                background: #f9fafb;
                display: flex;
                gap: 16px;
                align-items: center;
            }

            .detail-url {
                padding: 12px 24px;
                font-size: 13px;
                color: #6b7280;
            }

            .detail-url a {
                color: #3b82f6;
                text-decoration: none;
            }

            .detail-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }

            .detail-section {
                margin-bottom: 24px;
            }

            .detail-section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #374151;
            }

            .detail-text {
                line-height: 1.6;
                color: #111827;
                white-space: pre-wrap;
                word-break: break-word;
            }

            .detail-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
            }

            .open-conversation-btn {
                padding: 10px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }

            .open-conversation-btn:hover {
                background: #2563eb;
            }

            /* ============================================================================
               Batch Actions Bar (Gmail-style)
               ============================================================================ */
            
            .batch-actions-bar {
                position: fixed;
                bottom: 0;
                left: 80px;
                right: 0;
                z-index: 100;
                
                background: #fff3cd;
                border-top: 1px solid #ffc107;
                box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
                
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 24px;
                
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                opacity: 0;
                pointer-events: none;
            }
            
            .batch-actions-bar.visible {
                transform: translateY(0);
                opacity: 1;
                pointer-events: auto;
            }
            
            .batch-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .select-all-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
                margin: 0;
            }
            
            .batch-actions-bar .selected-count {
                font-size: 14px;
                font-weight: 500;
                color: #333;
            }
            
            .batch-buttons {
                display: flex;
                gap: 8px;
            }
            
            .batch-buttons button {
                padding: 8px 16px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .batch-buttons button:hover {
                background: #f0f0f0;
            }
            
            .batch-delete-btn:hover {
                background: #dc3545 !important;
                color: white !important;
                border-color: #dc3545 !important;
            }
            
            .batch-move-btn:hover {
                background: #007bff !important;
                color: white !important;
                border-color: #007bff !important;
            }
            
            .batch-export-btn:hover {
                background: #28a745 !important;
                color: white !important;
                border-color: #28a745 !important;
            }
            
            .batch-clear-btn:hover {
                background: #6c757d !important;
                color: white !important;
                border-color: #6c757d !important;
            }
            
            .bookmarks-tab .content {
                padding-bottom: 70px;
            }

            /* ============================================================================
               Tree View Styles
               ============================================================================ */

            /* Tree Container */
            .tree-view {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                background: white;
            }

            /* Custom Scrollbar (macOS-style) */
            .tree-view::-webkit-scrollbar {
                width: 8px;
            }

            .tree-view::-webkit-scrollbar-track {
                background: transparent;
            }

            .tree-view::-webkit-scrollbar-thumb {
                background: #d1d5db;
                border-radius: 4px;
            }

            .tree-view::-webkit-scrollbar-thumb:hover {
                background: #9ca3af;
            }

            /* Tree Item Base */
            .tree-item {
                display: flex;
                align-items: center;
                min-height: 36px;
                padding: 6px 12px;
                border-bottom: 1px solid #f3f4f6;
                position: relative;
                cursor: pointer;
                transition: background-color 0.15s ease;
                user-select: none;
            }

            .tree-item:hover {
                background: #f9fafb;
            }

            .tree-item:focus {
                outline: 2px solid #3b82f6;
                outline-offset: -2px;
                z-index: 1;
            }

            .tree-item:focus:not(:focus-visible) {
                outline: none;
            }

            /* Folder Styles */
            .folder-item {
                font-weight: 500;
                background: #fafafa;
            }

            .folder-item.selected {
                background: #eff6ff;
                border-left: 3px solid #3b82f6;
            }

            .folder-toggle {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                margin-right: 4px;
                font-size: 10px;
                color: #5f6368;
                cursor: pointer;
                user-select: none;
                flex-shrink: 0;
                transition: transform 0.15s ease;
                transform: rotate(0deg);
            }

            .folder-toggle.expanded {
                transform: rotate(90deg);
            }

            .folder-toggle:hover {
                color: #202124;
            }

            .folder-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .folder-name {
                flex: 1;
                font-weight: 500;
                color: #202124;
                user-select: none;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .folder-count {
                margin-left: 6px;
                font-size: 12px;
                color: #5f6368;
                font-weight: 400;
                user-select: none;
            }

            /* VSCode-style folder children visibility */
            .folder-children {
                overflow: hidden;
            }

            /* Hide children when folder is collapsed */
            .folder-item[aria-expanded="false"] + .folder-children {
                display: none;
            }

            /* Show children when folder is expanded */
            .folder-item[aria-expanded="true"] + .folder-children {
                display: block;
            }


            /* Bookmark Styles */
            .bookmark-item {
                background: white;
            }

            .platform-icon {
                font-size: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .bookmark-title {
                flex: 1;
                font-size: 13px;
                color: #374151;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 220px; /* Reserve space for timestamp + actions */
            }

            .bookmark-timestamp {
                position: absolute;
                right: 120px; /* Space for action buttons */
                font-size: 11px;
                color: #9ca3af;
                pointer-events: none;
                white-space: nowrap;
            }

            /* Checkboxes */
            .item-checkbox {
                margin-right: 8px;
                cursor: pointer;
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }

            .item-checkbox:focus {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
            }

            /* Action Buttons */
            .item-actions {
                display: none;
                gap: 4px;
                margin-left: auto;
                flex-shrink: 0;
            }

            .tree-item:hover .item-actions {
                display: flex;
            }

            .action-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
                font-size: 14px;
                transition: background-color 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }

            .action-btn:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .action-btn:focus {
                outline: 2px solid #3b82f6;
                outline-offset: -2px;
            }

            .action-btn.delete-folder:hover,
            .action-btn.delete-bookmark:hover {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }

            /* Empty State */
            .tree-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 64px 32px;
                text-align: center;
                color: #6b7280;
            }

            .empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .tree-empty h3 {
                margin: 0 0 8px 0;
                font-size: 16px;
                font-weight: 600;
                color: #374151;
            }

            .tree-empty p {
                margin: 0 0 24px 0;
                font-size: 14px;
                color: #6b7280;
            }

            .btn-primary,
            .create-first-folder {
                padding: 10px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.15s ease;
            }

            .btn-primary:hover,
            .create-first-folder:hover {
                background: #2563eb;
            }

            /* Responsive & Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .tree-item,
                .action-btn,
                .create-first-folder {
                    transition: none;
                }
            }

            @media (prefers-contrast: high) {
                .tree-item {
                    border: 1px solid transparent;
                }
                
                .tree-item:hover {
                    border-color: currentColor;
                }
                
                .tree-item.selected {
                    border: 2px solid #3b82f6;
                }
            }

            /* Loading State */
            .tree-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
                color: #6b7280;
            }

            .tree-loading::before {
                content: '⏳';
                font-size: 24px;
                margin-right: 8px;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Fade in animation for tree items */
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tree-item {
                animation: fadeIn 0.2s ease-out;
            }

            @media (prefers-color-scheme: dark) {
                .panel {
                    background: #1f2937;
                }

                .sidebar {
                    background: #111827;
                    border-color: #374151;
                }

                .tab-btn.active {
                    background: #1f2937;
                }

                .header {
                    border-color: #374151;
                }

                .header h2 {
                    color: #f9fafb;
                }

                .close-btn {
                    color: #9ca3af;
                }

                .close-btn:hover {
                    background: #374151;
                    color: #f9fafb;
                }

                .toolbar {
                    border-color: #374151;
                }

                .search-input,
                .platform-filter {
                    background: #111827;
                    border-color: #374151;
                    color: #f9fafb;
                }

                .bookmark-item {
                    background: #111827;
                    border-color: #374151;
                }

                .bookmark-item:hover {
                    background: #1f2937;
                    border-color: #4b5563;
                }

                .title {
                    color: #f9fafb;
                }

                .response {
                    color: #9ca3af;
                }

                .detail-modal {
                    background: #1f2937;
                }

                .detail-header {
                    border-color: #374151;
                }

                .detail-header h3 {
                    color: #f9fafb;
                }

                .detail-meta {
                    background: #111827;
                }

                .detail-text {
                    color: #f9fafb;
                }

                .detail-footer {
                    border-color: #374151;
                }
            }
        `;
  }
}
const simpleBookmarkPanel = new SimpleBookmarkPanel();

const SimpleBookmarkPanel$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  SimpleBookmarkPanel,
  simpleBookmarkPanel
}, Symbol.toStringTag, { value: 'Module' }));

class PageHeaderIcon {
  button = null;
  observer = null;
  /**
   * Initialize and inject the header icon
   */
  init() {
    this.injectButton();
    this.startObserver();
    logger$1.info("[PageHeaderIcon] Initialized");
  }
  /**
   * Inject bookmark button into header
   */
  injectButton() {
    const header = document.querySelector("#page-header");
    if (!header) {
      logger$1.debug("[PageHeaderIcon] Header not found, will retry");
      return;
    }
    const actionsContainer = header.querySelector("#conversation-header-actions");
    if (!actionsContainer) {
      logger$1.debug("[PageHeaderIcon] Actions container not found");
      return;
    }
    if (document.querySelector("#ai-copy-enhance-bookmark-btn")) {
      return;
    }
    this.button = this.createButton();
    actionsContainer.insertBefore(this.button, actionsContainer.firstChild);
    logger$1.info("[PageHeaderIcon] Button injected into header");
  }
  /**
   * Create the archive button element matching ChatGPT style
   */
  createButton() {
    const button = document.createElement("button");
    button.id = "ai-copy-enhance-bookmark-btn";
    button.className = "text-token-text-primary no-draggable hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover touch:h-10 touch:w-10 flex h-9 w-9 items-center justify-center rounded-lg focus:outline-none disabled:opacity-50";
    button.setAttribute("aria-label", "View Archive");
    button.setAttribute("type", "button");
    button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon">
                <path d="M3 5C3 3.89543 3.89543 3 5 3H15C16.1046 3 17 3.89543 17 5V6H3V5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 6H17V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 10H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    button.addEventListener("click", () => this.handleClick());
    return button;
  }
  /**
   * Handle button click
   */
  async handleClick() {
    try {
      await simpleBookmarkPanel.toggle();
    } catch (error) {
      logger$1.error("[PageHeaderIcon] Failed to open panel:", error);
    }
  }
  /**
   * Start observing for header changes
   */
  startObserver() {
    this.observer = new MutationObserver(() => {
      if (!document.querySelector("#ai-copy-enhance-bookmark-btn")) {
        this.injectButton();
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  /**
   * Remove the button and stop observing
   */
  destroy() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
const pageHeaderIcon = new PageHeaderIcon();

class GeminiPanelButton {
  button = null;
  observer = null;
  /**
   * Initialize and inject the header button
   */
  init() {
    logger$1.info("[GeminiPanelButton] Initializing...");
    if (!this.injectButton()) {
      this.retryInjection();
    }
    this.startObserver();
  }
  /**
   * Retry injection with exponential backoff
   */
  retryInjection(attempt = 1, maxAttempts = 10) {
    if (attempt > maxAttempts) {
      logger$1.error("[GeminiPanelButton] Failed to inject after maximum attempts");
      return;
    }
    const delay = Math.min(1e3 * attempt, 5e3);
    logger$1.debug(`[GeminiPanelButton] Retrying injection in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
    setTimeout(() => {
      if (!this.injectButton()) {
        this.retryInjection(attempt + 1, maxAttempts);
      }
    }, delay);
  }
  /**
   * Inject bookmark panel button into Gemini header
   * @returns true if injection succeeded, false otherwise
   */
  injectButton() {
    const logoContainer = document.querySelector("span.bard-logo-container.logo-only");
    if (!logoContainer) {
      logger$1.debug("[GeminiPanelButton] Logo container not found");
      return false;
    }
    if (document.querySelector("#gemini-bookmark-panel-btn")) {
      logger$1.debug("[GeminiPanelButton] Button already exists");
      return true;
    }
    this.button = this.createButton();
    logoContainer.appendChild(this.button);
    logger$1.info("[GeminiPanelButton] Button injected successfully");
    return true;
  }
  /**
   * Create the bookmark panel button matching Gemini Material Design style
   */
  createButton() {
    const button = document.createElement("button");
    button.id = "gemini-bookmark-panel-btn";
    button.className = "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base";
    button.setAttribute("aria-label", "View Bookmarks");
    button.setAttribute("type", "button");
    button.style.cssText = "margin-left: 12px; color: var(--gem-sys-color--on-surface);";
    button.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
            <mat-icon role="img" class="mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color" 
                      aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="bookmark" 
                      fonticon="bookmark"></mat-icon>
            <span class="mat-focus-indicator"></span>
            <span class="mat-mdc-button-touch-target"></span>
        `;
    button.addEventListener("click", () => this.handleClick());
    return button;
  }
  /**
   * Handle button click - open bookmark panel
   */
  async handleClick() {
    try {
      await simpleBookmarkPanel.toggle();
    } catch (error) {
      logger$1.error("[GeminiPanelButton] Failed to open panel:", error);
    }
  }
  /**
   * Start observing for header changes
   */
  startObserver() {
    this.observer = new MutationObserver(() => {
      if (!document.querySelector("#gemini-bookmark-panel-btn")) {
        this.injectButton();
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  /**
   * Remove the button and stop observing
   */
  destroy() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
const geminiPanelButton = new GeminiPanelButton();

class ContentScript {
  observer = null;
  injector = null;
  markdownParser;
  mathClickHandler;
  reRenderPanel;
  deepResearchHandler;
  // Simple Set-based bookmark state tracking - AITimeline pattern
  bookmarkedPositions = /* @__PURE__ */ new Set();
  // Navigation check flag - AITimeline pattern
  navigationChecked = false;
  constructor() {
    logger$1.setLevel(LogLevel.INFO);
    this.markdownParser = new MarkdownParser();
    this.mathClickHandler = new MathClickHandler();
    this.reRenderPanel = new ReRenderPanel();
    logger$1.info("AI Copy Enhance initialized");
  }
  /**
   * Start the extension
   */
  start() {
    if (!adapterRegistry.isSupported()) {
      logger$1.warn("Current page is not supported");
      return;
    }
    const adapter = adapterRegistry.getAdapter();
    if (!adapter) {
      logger$1.error("Failed to get adapter");
      return;
    }
    logger$1.info("Starting extension on supported page");
    this.injector = new ToolbarInjector(adapter);
    this.observer = new MessageObserver(adapter, (messageElement) => {
      this.handleNewMessage(messageElement);
    });
    if ("isGemini" in adapter && typeof adapter.isGemini === "function" && adapter.isGemini()) {
      logger$1.info("Enabling Deep Research handler for Gemini");
      this.deepResearchHandler = new DeepResearchHandler();
      this.deepResearchHandler.enable();
      geminiPanelButton.init();
    } else {
      pageHeaderIcon.init();
    }
    this.loadBookmarks();
    this.observer.start();
  }
  /**
   * Load bookmarked positions for current page
   */
  async loadBookmarks() {
    try {
      const url = window.location.href;
      this.bookmarkedPositions = await SimpleBookmarkStorage.loadAllPositions(url);
      logger$1.info(`[ContentScript] Loaded ${this.bookmarkedPositions.size} bookmarks for current page`);
    } catch (error) {
      logger$1.error("[ContentScript] Failed to load bookmarks:", error);
    }
  }
  /**
   * Check for cross-page bookmark navigation - AITimeline pattern
   */
  async checkBookmarkNavigation() {
    const { simpleBookmarkPanel } = await __vitePreload(async () => { const { simpleBookmarkPanel } = await Promise.resolve().then(() => SimpleBookmarkPanel$1);return { simpleBookmarkPanel }},true?void 0:void 0);
    await simpleBookmarkPanel.checkNavigationTarget();
  }
  /**
   * Handle new message detected
   */
  handleNewMessage(messageElement) {
    logger$1.debug("Handling new message");
    if (!this.navigationChecked) {
      this.navigationChecked = true;
      logger$1.info("[ContentScript] First message detected, checking bookmark navigation");
      this.checkBookmarkNavigation();
    }
    if (messageElement.querySelector(".aicopy-toolbar-container")) {
      logger$1.debug("Toolbar already exists, skipping");
      return;
    }
    const callbacks = {
      onCopyMarkdown: async () => {
        return this.getMarkdown(messageElement);
      },
      onViewSource: () => {
        this.showSourceModal(messageElement);
      },
      onReRender: () => {
        this.showReRenderPanel(messageElement);
      },
      onBookmark: async () => {
        await this.handleBookmark(messageElement);
      }
    };
    const toolbar = new Toolbar(callbacks);
    if (this.injector) {
      this.injector.inject(messageElement, toolbar.getElement());
    }
    const toolbarContainer = messageElement.querySelector(".aicopy-toolbar-container");
    if (toolbarContainer) {
      toolbarContainer.__toolbar = toolbar;
    }
    const position = this.getMessagePosition(messageElement);
    const isBookmarked = this.bookmarkedPositions.has(position);
    toolbar.setBookmarkState(isBookmarked);
    this.mathClickHandler.enable(messageElement);
  }
  /**
   * Get Markdown from message element
   */
  getMarkdown(messageElement) {
    const adapter = adapterRegistry.getAdapter();
    if (!adapter) return "";
    if (messageElement.tagName.toLowerCase() === "article") {
      logger$1.debug("[getMarkdown] Article element detected, parsing entire article");
      return this.markdownParser.parse(messageElement);
    }
    const contentSelector = adapter.getMessageContentSelector();
    if (!contentSelector) return "";
    const contentElement = messageElement.querySelector(contentSelector);
    if (!contentElement || !(contentElement instanceof HTMLElement)) {
      logger$1.debug("[getMarkdown] Content element not found");
      return "";
    }
    return this.markdownParser.parse(contentElement);
  }
  /**
   * Show source code modal
   */
  showSourceModal(messageElement) {
    const markdown = this.getMarkdown(messageElement);
    const modal = new Modal();
    modal.show(markdown, "Markdown Source Code");
  }
  /**
   * Show re-render preview panel
   */
  showReRenderPanel(messageElement) {
    const markdown = this.getMarkdown(messageElement);
    this.reRenderPanel.show(markdown);
  }
  /**
   * Handle bookmark toggle - AITimeline pattern with edit modal
   */
  async handleBookmark(messageElement) {
    const url = window.location.href;
    const position = this.getMessagePosition(messageElement);
    if (position === -1) {
      logger$1.error("[handleBookmark] Failed to get message position");
      return;
    }
    try {
      if (this.bookmarkedPositions.has(position)) {
        await SimpleBookmarkStorage.remove(url, position);
        this.bookmarkedPositions.delete(position);
        this.updateToolbarState(messageElement, false);
        logger$1.info(`[handleBookmark] Removed bookmark at position ${position}`);
      } else {
        const userMessage = this.getUserMessage(messageElement);
        if (!userMessage) {
          logger$1.error("[handleBookmark] Failed to extract user message");
          return;
        }
        const adapter = adapterRegistry.getAdapter();
        const platform = adapter && "isGemini" in adapter && typeof adapter.isGemini === "function" && adapter.isGemini() ? "Gemini" : "ChatGPT";
        const aiResponse = this.getAiResponse(messageElement);
        const defaultTitle = userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
        const lastUsedFolder = localStorage.getItem("lastUsedFolder") || "Import";
        const saveModal = new BookmarkSaveModal();
        saveModal.show({
          defaultTitle,
          lastUsedFolder,
          onSave: async (title, folderPath) => {
            await SimpleBookmarkStorage.save(
              url,
              position,
              userMessage,
              aiResponse,
              title,
              platform,
              Date.now(),
              folderPath
            );
            this.bookmarkedPositions.add(position);
            this.updateToolbarState(messageElement, true);
            localStorage.setItem("lastUsedFolder", folderPath);
            logger$1.info(`[handleBookmark] Saved "${title}" to "${folderPath}"`);
          }
        });
      }
    } catch (error) {
      logger$1.error("[handleBookmark] Failed to toggle bookmark:", error);
    }
  }
  /**
   * Get message position in conversation (1-indexed)
   */
  getMessagePosition(messageElement) {
    const adapter = adapterRegistry.getAdapter();
    if (!adapter) return -1;
    const messageSelector = adapter.getMessageSelector();
    const allMessages = Array.from(document.querySelectorAll(messageSelector));
    const index = allMessages.indexOf(messageElement);
    return index === -1 ? -1 : index + 1;
  }
  /**
   * Get user message text from message element
   */
  getUserMessage(messageElement) {
    const adapter = adapterRegistry.getAdapter();
    if (!adapter) return "";
    const messageSelector = adapter.getMessageSelector();
    const contentSelector = adapter.getMessageContentSelector();
    if (!contentSelector) return "";
    const currentContent = messageElement.querySelector(contentSelector);
    if (currentContent) {
      const text = currentContent.textContent?.trim() || "";
      if (text && text.length < 5e3) {
        return text;
      }
    }
    const allMessages = Array.from(document.querySelectorAll(messageSelector));
    const currentIndex = allMessages.indexOf(messageElement);
    if (currentIndex <= 0) return "";
    const prevMessage = allMessages[currentIndex - 1];
    const prevContent = prevMessage.querySelector(contentSelector);
    if (!prevContent) return "";
    return prevContent.textContent?.trim() || "";
  }
  /**
   * Get AI response text from message element
   */
  getAiResponse(messageElement) {
    const adapter = adapterRegistry.getAdapter();
    if (!adapter) return "";
    const contentSelector = adapter.getMessageContentSelector();
    if (!contentSelector) return "";
    const content = messageElement.querySelector(contentSelector);
    if (!content) return "";
    return content.textContent?.trim() || "";
  }
  /**
   * Update toolbar bookmark state
   */
  updateToolbarState(messageElement, isBookmarked) {
    const toolbarContainer = messageElement.querySelector(".aicopy-toolbar-container");
    if (toolbarContainer) {
      const toolbar = toolbarContainer.__toolbar;
      if (toolbar && typeof toolbar.setBookmarkState === "function") {
        toolbar.setBookmarkState(isBookmarked);
      }
    }
  }
  /**
   * Stop the extension
   */
  stop() {
    if (this.observer) {
      this.observer.stop();
      this.observer = null;
    }
    if (this.deepResearchHandler) {
      this.deepResearchHandler.disable();
      this.deepResearchHandler = void 0;
    }
    logger$1.info("Extension stopped");
  }
}
function initExtension() {
  logger$1.info("Initializing AI Copy Enhance extension");
  logger$1.debug("Document readyState:", document.readyState);
  logger$1.debug("Current URL:", window.location.href);
  let contentScript = new ContentScript();
  contentScript.start();
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      logger$1.info("URL changed, reinitializing:", currentUrl);
      setTimeout(() => {
        contentScript?.stop();
        contentScript = new ContentScript();
        contentScript.start();
      }, 500);
    }
  }).observe(document.body, { subtree: true, childList: true });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initExtension);
} else {
  initExtension();
}
