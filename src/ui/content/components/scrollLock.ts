type SavedOverflow = {
    htmlOverflow: string;
    bodyOverflow: string;
};

let refCount = 0;
let saved: SavedOverflow | null = null;

export type ScrollLockHandle = { release(): void };

export function acquireScrollLock(): ScrollLockHandle {
    if (refCount === 0) {
        saved = {
            htmlOverflow: document.documentElement.style.overflow || '',
            bodyOverflow: document.body.style.overflow || '',
        };
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }
    refCount += 1;

    let released = false;
    return {
        release() {
            if (released) return;
            released = true;

            refCount = Math.max(0, refCount - 1);
            if (refCount !== 0) return;

            if (saved) {
                document.documentElement.style.overflow = saved.htmlOverflow;
                document.body.style.overflow = saved.bodyOverflow;
            }
            saved = null;
        },
    };
}

