import { afterEach, expect, it, vi } from 'vitest';
import { browserInfo } from '@/drivers/shared/browser';
import { createSupportContactCard } from '@/ui/content/bookmarks/ui/tabs/supportContactCard';

afterEach(() => vi.restoreAllMocks());

it.each([
    ['chrome', 'AI-MarkDone | Chrome Feedback'],
    ['firefox', 'AI-MarkDone | Firefox Feedback'],
    ['unknown', 'AI-MarkDone Feedback'],
] as const)('addresses feedback to the maintainer and identifies %s without guessing', (target, subject) => {
    vi.spyOn(browserInfo, 'target', 'get').mockReturnValue(target);
    const card = createSupportContactCard();
    const link = card.querySelector<HTMLAnchorElement>('.support-contact-card__button--email')!;
    const mailto = new URL(link.href);
    expect(mailto.protocol).toBe('mailto:');
    expect(mailto.pathname).toBe('zhaoliangbin42@gmail.com');
    expect(mailto.searchParams.get('subject')).toBe(subject);
    expect(mailto.searchParams.has('body')).toBe(false);
    expect(mailto.searchParams.get('subject')).not.toMatch(/Safari|ChatGPT/);
    expect(card.querySelector('[data-action="copy-support-email"]')).toBeTruthy();
});
