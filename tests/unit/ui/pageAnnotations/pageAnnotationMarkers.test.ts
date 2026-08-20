import { beforeEach, describe, expect, it } from 'vitest';
import { PageAnnotationMarkers } from '@/ui/content/pageAnnotations/PageAnnotationMarkers';
import { createAppearanceSnapshot } from '@/style/appearance';

function mountRoot(): HTMLElement {
    const message = document.createElement('div');
    message.innerHTML = '<div class="markdown prose"><p>Hello world</p></div>';
    document.body.appendChild(message);
    return message.querySelector('.markdown.prose') as HTMLElement;
}

describe('PageAnnotationMarkers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders highlights and anchors inside the message root and scrolls with it', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        const onOpen = () => undefined;

        markers.render([{
            root,
            highlights: [{ left: 4, top: 6, width: 80, height: 18 }],
            anchors: [{ id: 'c1', left: 92, top: 7, active: false, label: 'Open annotation', onOpen }],
        }]);

        const host = root.querySelector<HTMLElement>('[data-aimd-role="chatgpt-page-annotation-markers"]');
        expect(host).toBeTruthy();
        expect(host!.isConnected).toBe(true);
        const shadow = host!.shadowRoot!;
        expect(shadow.querySelectorAll('.reader-comment-highlight')).toHaveLength(1);
        expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);
        const anchor = shadow.querySelector<HTMLButtonElement>('.reader-comment-anchor');
        expect(anchor?.getAttribute('aria-label')).toBe('Open annotation');
        expect(anchor?.getAttribute('title')).toBe('Open annotation');
        markers.dispose();
    });

    it('never duplicates markers when re-rendered repeatedly (scroll/refresh safety)', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));

        for (let index = 0; index < 5; index += 1) {
            markers.render([{
                root,
                highlights: [{ left: 4, top: 6, width: 80, height: 18 }],
                anchors: [{ id: 'c1', left: 92, top: 7, active: false, onOpen: () => undefined }],
            }]);
        }

        const hosts = root.querySelectorAll<HTMLElement>('[data-aimd-role="chatgpt-page-annotation-markers"]');
        expect(hosts).toHaveLength(1);
        expect(hosts[0]!.shadowRoot!.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);
        expect(hosts[0]!.shadowRoot!.querySelectorAll('.reader-comment-highlight')).toHaveLength(1);
        markers.dispose();
    });

    it('removes the host when a root no longer has annotations', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        markers.render([{
            root,
            highlights: [],
            anchors: [{ id: 'c1', left: 10, top: 10, active: false, onOpen: () => undefined }],
        }]);
        expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeTruthy();

        markers.render([]);
        expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeNull();
        markers.dispose();
    });
});
