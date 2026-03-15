import { mountOverlayThemeProbe } from '../../../src/ui/content/overlay/mock/OverlayThemeProbe';

const stage = document.getElementById('overlay-mock-stage');

if (stage) {
    mountOverlayThemeProbe(stage, 'light');
    mountOverlayThemeProbe(stage, 'dark');
}
