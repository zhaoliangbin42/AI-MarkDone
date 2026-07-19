export function getChatGPTConversationId(url: string): string | null {
    try {
        const pathname = new URL(url).pathname;
        return pathname.match(/(?:^|\/)(?:c|conversation)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    } catch {
        return url.match(/(?:^|\/)(?:c|conversation)\/([0-9a-f-]{8,})/i)?.[1] ?? null;
    }
}

export function isChatGPTConversationPage(url: string): boolean {
    return getChatGPTConversationId(url) !== null;
}
