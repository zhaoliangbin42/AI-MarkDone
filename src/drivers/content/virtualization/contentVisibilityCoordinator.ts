type VisibilityRecord = {
    elements: Array<{
        element: HTMLElement;
        contentVisibility: string;
        containIntrinsicSize: string;
    }>;
};

export class ContentVisibilityCoordinator {
    private records = new Map<string, VisibilityRecord>();

    apply(groupId: string, elements: HTMLElement[]): void {
        if (elements.length === 0) return;
        if (this.records.has(groupId)) return;

        const record: VisibilityRecord = {
            elements: elements.map((element) => {
                const previous = {
                    element,
                    contentVisibility: element.style.contentVisibility,
                    containIntrinsicSize: element.style.containIntrinsicSize,
                };
                const intrinsicHeight = Math.max(1, Math.round(element.offsetHeight || 1));
                element.style.contentVisibility = 'auto';
                element.style.containIntrinsicSize = `auto ${intrinsicHeight}px`;
                return previous;
            }),
        };

        this.records.set(groupId, record);
    }

    restore(groupId: string): void {
        const record = this.records.get(groupId);
        if (!record) return;
        for (const entry of record.elements) {
            entry.element.style.contentVisibility = entry.contentVisibility;
            entry.element.style.containIntrinsicSize = entry.containIntrinsicSize;
        }
        this.records.delete(groupId);
    }

    restoreAll(): void {
        for (const groupId of Array.from(this.records.keys())) {
            this.restore(groupId);
        }
    }

    isApplied(groupId: string): boolean {
        return this.records.has(groupId);
    }
}
