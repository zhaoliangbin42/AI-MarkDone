import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

describe('shared surface profile governance', () => {
    it('routes ReaderPanel production callers through named profiles instead of low-level chrome flags', () => {
        const toolbarSource = fs.readFileSync(
            path.join(repoRoot, 'src/ui/content/controllers/MessageToolbarOrchestrator.ts'),
            'utf8'
        );
        const bookmarksSource = fs.readFileSync(
            path.join(repoRoot, 'src/ui/content/bookmarks/ui/tabs/bookmarksTabActions.ts'),
            'utf8'
        );

        expect(toolbarSource).toContain("profile: 'conversation-reader'");
        expect(toolbarSource).not.toContain('showOpenConversation: false');
        expect(toolbarSource).not.toContain("initialView: 'render'");

        expect(bookmarksSource).toContain("profile: 'bookmark-preview'");
        expect(bookmarksSource).not.toContain('showOpenConversation: true');
        expect(bookmarksSource).not.toContain("dotStyle: 'plain'");
    });
});
