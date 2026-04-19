export type BookmarksDocLocale = 'en' | 'zh_CN';

export type BookmarksDocBlock =
    | {
          type: 'paragraph';
          text: string;
      }
    | {
          type: 'list';
          items: string[];
      }
    | {
          type: 'image';
          alt: string;
          src: string;
      };

export type BookmarksDocSection = {
    heading: string;
    blocks: BookmarksDocBlock[];
};

export type ParsedBookmarksDoc = {
    title: string;
    leadBlocks: BookmarksDocBlock[];
    sections: BookmarksDocSection[];
};

export type ParsedFaqItem = {
    question: string;
    blocks: BookmarksDocBlock[];
};

export type ParsedFaqDoc = {
    title: string;
    leadBlocks: BookmarksDocBlock[];
    items: ParsedFaqItem[];
};

export type ParsedChangelogEntry = {
    version: string;
    date: string;
    leadBlocks: BookmarksDocBlock[];
    highlights: string[];
};

export type ParsedChangelogDoc = {
    title: string;
    entries: ParsedChangelogEntry[];
};
