import { createSupportContactCard } from './supportContactCard';
import { createWebsiteCard } from './websiteCard';
import { t } from '../../../components/i18n';

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

export class FeedbackTabView {
    private root: HTMLElement;

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-feedback';
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const shell = document.createElement('div');
        shell.className = 'info-shell feedback-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--feedback';
        hero.innerHTML = `
          <h3 class="info-hero__title">${tr('tabFeedback', 'Feedback')}</h3>
        `;

        shell.append(hero, createSupportContactCard(), createWebsiteCard());
        this.root.replaceChildren(shell);
    }
}
