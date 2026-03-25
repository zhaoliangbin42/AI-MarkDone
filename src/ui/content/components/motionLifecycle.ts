type MotionState = 'opening' | 'open' | 'closing';

type FrameScheduler = (callback: FrameRequestCallback) => number;
type FrameCanceler = (id: number) => void;
type MotionFamily = 'overlay' | 'panel' | 'modal';
type MotionSpec = {
    duration: number;
    easing: string;
    fromOpacity: string;
    toOpacity: string;
    fromTransform: string;
    toTransform: string;
};

type OpeningMotionJob = {
    frameIds: number[];
    timer: number | null;
};

const activeOpeningJobs = new WeakMap<HTMLElement, OpeningMotionJob>();
type CloseMotionJob = {
    onAnimationEnd: (event: Event) => void;
    timer: number;
};
const activeClosingJobs = new WeakMap<HTMLElement, CloseMotionJob>();

function setMotionState(element: HTMLElement | null | undefined, state: MotionState): void {
    if (!element) return;
    element.dataset.motionState = state;
}

function getFrameScheduler(): FrameScheduler {
    if (typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame.bind(window);
    }
    return ((callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16)) as FrameScheduler;
}

function getFrameCanceler(): FrameCanceler {
    if (typeof window.cancelAnimationFrame === 'function') {
        return window.cancelAnimationFrame.bind(window);
    }
    return (id: number) => window.clearTimeout(id);
}

function getEnterMotionFamily(element: HTMLElement): MotionFamily | null {
    if (element.classList.contains('panel-stage__overlay') || element.classList.contains('mock-modal-overlay') || element.classList.contains('aimd-panel-overlay')) {
        return 'overlay';
    }
    if (element.classList.contains('mock-modal') || element.classList.contains('dialog')) {
        return 'modal';
    }
    if (element.classList.contains('panel-window') || element.classList.contains('aimd-panel')) {
        return 'panel';
    }
    return null;
}

function getEnterMotionSpec(element: HTMLElement): MotionSpec | null {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const family = getEnterMotionFamily(element);
    if (!family) return null;

    if (family === 'overlay') {
        return {
            duration: reducedMotion ? 80 : 180,
            easing: reducedMotion ? 'linear' : 'var(--aimd-ease-out)',
            fromOpacity: '0',
            toOpacity: '1',
            fromTransform: 'none',
            toTransform: 'none',
        };
    }

    if (family === 'modal') {
        return {
            duration: reducedMotion ? 80 : 280,
            easing: reducedMotion ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
            fromOpacity: '0',
            toOpacity: '1',
            fromTransform: reducedMotion ? 'scale(1)' : 'scale(0.92)',
            toTransform: 'scale(1)',
        };
    }

    return {
        duration: reducedMotion ? 80 : 300,
        easing: reducedMotion ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
        fromOpacity: '0',
        toOpacity: '1',
        fromTransform: reducedMotion ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.95)',
        toTransform: 'translate(-50%, -50%) scale(1)',
    };
}

export function getSurfaceOpenDuration(element: HTMLElement | null | undefined): number {
    if (!element) return 0;
    return getEnterMotionSpec(element)?.duration ?? 0;
}

function clearOpeningMotion(element: HTMLElement): void {
    const job = activeOpeningJobs.get(element);
    if (job) {
        const cancelFrame = getFrameCanceler();
        for (const frameId of job.frameIds) {
            cancelFrame(frameId);
        }
        if (typeof job.timer === 'number') {
            window.clearTimeout(job.timer);
        }
        activeOpeningJobs.delete(element);
    }
    delete element.dataset.motionRuntime;
    element.style.removeProperty('transition');
    element.style.removeProperty('opacity');
    element.style.removeProperty('transform');
}

export function setSurfaceMotionOpening(elements: Array<HTMLElement | null | undefined>): void {
    const connectedElements = elements.filter((element): element is HTMLElement => Boolean(element?.isConnected));
    if (connectedElements.length === 0) return;

    for (const element of connectedElements) {
        setMotionState(element, 'opening');
    }

    const scheduleFrame = getFrameScheduler();
    for (const element of connectedElements) {
        const spec = getEnterMotionSpec(element);
        if (!spec) continue;

        clearOpeningMotion(element);
        const job: OpeningMotionJob = { frameIds: [], timer: null };
        activeOpeningJobs.set(element, job);
        element.dataset.motionRuntime = 'inline';
        element.style.transition = 'none';
        element.style.opacity = spec.fromOpacity;
        element.style.transform = spec.fromTransform;

        const firstFrame = scheduleFrame(() => {
            if (!element.isConnected || element.dataset.motionState !== 'opening') return;

            const secondFrame = scheduleFrame(() => {
                if (!element.isConnected || element.dataset.motionState !== 'opening') return;

                void element.offsetWidth;
                element.style.transition = `opacity ${spec.duration}ms ${spec.easing}, transform ${spec.duration}ms ${spec.easing}`;
                element.style.opacity = spec.toOpacity;
                element.style.transform = spec.toTransform;
                setMotionState(element, 'open');

                job.timer = window.setTimeout(() => {
                    clearOpeningMotion(element);
                }, spec.duration + 34);
            });
            job.frameIds.push(secondFrame);
        });
        job.frameIds.push(firstFrame);
    }
}

export function beginSurfaceMotionClose(params: {
    shell: HTMLElement | null | undefined;
    backdrop?: HTMLElement | null | undefined;
    onClosed: () => void;
    fallbackMs?: number;
}): boolean {
    const shell = params.shell ?? null;
    if (!shell) {
        params.onClosed();
        return false;
    }

    if (shell.dataset.motionState === 'closing') {
        return false;
    }

    const backdrop = params.backdrop ?? null;
    clearOpeningMotion(shell);
    if (backdrop) clearOpeningMotion(backdrop);
    setMotionState(backdrop, 'closing');
    setMotionState(shell, 'closing');

    const activeJob = activeClosingJobs.get(shell);
    if (activeJob) {
        shell.removeEventListener('animationend', activeJob.onAnimationEnd);
        shell.removeEventListener('animationcancel', activeJob.onAnimationEnd);
        window.clearTimeout(activeJob.timer);
        activeClosingJobs.delete(shell);
    }

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        shell.removeEventListener('animationend', onAnimationEnd);
        shell.removeEventListener('animationcancel', onAnimationEnd);
        window.clearTimeout(timer);
        activeClosingJobs.delete(shell);
        params.onClosed();
    };

    const onAnimationEnd = (event: Event) => {
        if (event.target !== shell) return;
        finish();
    };

    shell.addEventListener('animationend', onAnimationEnd);
    shell.addEventListener('animationcancel', onAnimationEnd);
    const timer = window.setTimeout(finish, params.fallbackMs ?? 720);
    activeClosingJobs.set(shell, { onAnimationEnd, timer });
    return true;
}

export function cancelSurfaceMotionClose(params: {
    shell: HTMLElement | null | undefined;
    backdrop?: HTMLElement | null | undefined;
}): boolean {
    const shell = params.shell ?? null;
    if (!shell) return false;

    const job = activeClosingJobs.get(shell);
    if (!job) return false;

    shell.removeEventListener('animationend', job.onAnimationEnd);
    shell.removeEventListener('animationcancel', job.onAnimationEnd);
    window.clearTimeout(job.timer);
    activeClosingJobs.delete(shell);

    setMotionState(shell, 'open');
    if (params.backdrop) {
        setMotionState(params.backdrop, 'open');
    }
    return true;
}
