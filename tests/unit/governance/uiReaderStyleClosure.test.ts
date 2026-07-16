import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { collectUiStyleSources } from '../../support/uiStyleInventory';
import { auditUiStyleValues } from '../../support/uiStyleValueGovernance';

const READER_STYLE_SOURCES = new Set([
    'src/services/renderer/markdownTheme.ts',
    'src/ui/content/reader/ReaderCommentPopover.ts',
    'src/ui/content/reader/readerPanelTemplate.ts',
]);

describe('Reader style-value closure', () => {
    it('keeps the Reader family on canonical and private tokens without migration debt', () => {
        const repoRoot = path.resolve(__dirname, '../../..');
        const sources = collectUiStyleSources(repoRoot)
            .filter(({ relativePath }) => READER_STYLE_SOURCES.has(relativePath));
        const violations = auditUiStyleValues(sources).violations;

        expect(violations).toEqual([]);
    });
});
