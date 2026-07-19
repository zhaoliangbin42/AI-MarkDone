export const CHATGPT_HOST_PATTERNS = [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
] as const;

export const SUPPORTED_HOST_PATTERNS = [
    ...CHATGPT_HOST_PATTERNS,
    'https://gemini.google.com/*',
    'https://claude.ai/*',
    'https://chat.deepseek.com/*',
] as const;
