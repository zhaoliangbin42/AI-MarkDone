import { getEffectiveLocale } from '../../components/i18n';
import type { BookmarksDocLocale } from './types';

import changelogEn from './changelog.en.md?raw';
import changelogZh from './changelog.zh.md?raw';
import aboutEn from './about.en.md?raw';
import aboutZh from './about.zh.md?raw';
import faqEn from './faq.en.md?raw';
import faqZh from './faq.zh.md?raw';

type BookmarksDocKind = 'changelog' | 'about' | 'faq';

const docCatalog: Record<BookmarksDocKind, Record<BookmarksDocLocale, string>> = {
    changelog: {
        en: changelogEn,
        zh_CN: changelogZh,
    },
    about: {
        en: aboutEn,
        zh_CN: aboutZh,
    },
    faq: {
        en: faqEn,
        zh_CN: faqZh,
    },
};

function resolveBookmarksDocLocale(): BookmarksDocLocale {
    return getEffectiveLocale() === 'zh_CN' ? 'zh_CN' : 'en';
}

export function loadBookmarksDoc(kind: BookmarksDocKind, locale = resolveBookmarksDocLocale()): string {
    return docCatalog[kind][locale];
}
