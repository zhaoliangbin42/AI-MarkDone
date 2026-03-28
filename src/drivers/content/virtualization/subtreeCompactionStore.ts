type CompactionEntry = {
    original: HTMLElement;
    placeholder: HTMLElement;
};

export class SubtreeCompactionStore {
    private records = new Map<string, CompactionEntry[]>();

    compact(groupId: string, targets: HTMLElement[]): void {
        if (targets.length === 0 || this.records.has(groupId)) return;

        const entries: CompactionEntry[] = [];
        for (const target of targets) {
            const parent = target.parentElement;
            if (!parent) continue;

            const placeholderTag = target.matches('pre') ? 'div' : 'span';
            const placeholder = document.createElement(placeholderTag);
            placeholder.className = 'aimd-heavy-subtree-placeholder';
            placeholder.setAttribute('aria-hidden', 'true');
            placeholder.style.visibility = 'hidden';
            placeholder.style.pointerEvents = 'none';
            placeholder.style.minHeight = `${Math.max(1, Math.round(target.offsetHeight || 1))}px`;
            placeholder.style.minWidth = `${Math.max(1, Math.round(target.offsetWidth || 1))}px`;
            placeholder.style.display = placeholderTag === 'div' ? 'block' : 'inline-block';

            parent.insertBefore(placeholder, target);
            target.remove();
            entries.push({ original: target, placeholder });
        }

        if (entries.length > 0) {
            this.records.set(groupId, entries);
        }
    }

    restore(groupId: string): void {
        const entries = this.records.get(groupId);
        if (!entries) return;

        for (const entry of entries) {
            const parent = entry.placeholder.parentElement;
            if (!parent) continue;
            parent.insertBefore(entry.original, entry.placeholder);
            entry.placeholder.remove();
        }

        this.records.delete(groupId);
    }

    restoreAll(): void {
        for (const groupId of Array.from(this.records.keys())) {
            this.restore(groupId);
        }
    }

    isCompacted(groupId: string): boolean {
        return this.records.has(groupId);
    }
}
