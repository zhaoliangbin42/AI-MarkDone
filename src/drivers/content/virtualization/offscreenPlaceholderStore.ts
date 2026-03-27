type TrimRequest = {
    groupId: string;
    nodes: HTMLElement[];
    height: number;
    onRestore?: () => void;
};

type TrimRecord = {
    groupId: string;
    nodes: HTMLElement[];
    placeholder: HTMLElement;
};

declare global {
    interface Window {
        __AIMD_OFFSCREEN_PLACEHOLDER_STORE__?: OffscreenPlaceholderStore;
    }
}

export class OffscreenPlaceholderStore {
    private records = new Map<string, TrimRecord>();

    trim(request: TrimRequest): HTMLElement {
        const existing = this.records.get(request.groupId);
        if (existing) return existing.placeholder;
        if (request.nodes.length === 0) {
            throw new Error(`Cannot virtualize empty group: ${request.groupId}`);
        }

        const firstNode = request.nodes[0]!;
        const parent = firstNode.parentElement;
        if (!parent) {
            throw new Error(`Virtualized group has no parent: ${request.groupId}`);
        }

        const placeholder = document.createElement('div');
        placeholder.dataset.aimdVirtualizedGroupId = request.groupId;
        placeholder.className = 'aimd-conversation-placeholder';
        placeholder.style.minHeight = `${Math.max(1, Math.round(request.height))}px`;
        placeholder.setAttribute('aria-hidden', 'true');

        parent.insertBefore(placeholder, firstNode);
        for (const node of request.nodes) node.remove();

        this.records.set(request.groupId, { groupId: request.groupId, nodes: [...request.nodes], placeholder });
        return placeholder;
    }

    restore(groupId: string): void {
        const record = this.records.get(groupId);
        if (!record) return;
        const parent = record.placeholder.parentElement;
        if (!parent) {
            this.records.delete(groupId);
            return;
        }
        for (const node of record.nodes) {
            parent.insertBefore(node, record.placeholder);
        }
        record.placeholder.remove();
        this.records.delete(groupId);
    }

    restoreAll(): void {
        for (const groupId of Array.from(this.records.keys())) {
            this.restore(groupId);
        }
    }

    isTrimmed(groupId: string): boolean {
        return this.records.has(groupId);
    }

    getPlaceholder(groupId: string): HTMLElement | null {
        return this.records.get(groupId)?.placeholder ?? null;
    }
}

export function getSharedOffscreenPlaceholderStore(): OffscreenPlaceholderStore {
    if (!window.__AIMD_OFFSCREEN_PLACEHOLDER_STORE__) {
        window.__AIMD_OFFSCREEN_PLACEHOLDER_STORE__ = new OffscreenPlaceholderStore();
    }
    return window.__AIMD_OFFSCREEN_PLACEHOLDER_STORE__;
}
