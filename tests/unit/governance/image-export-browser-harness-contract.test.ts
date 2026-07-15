import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('image export browser harness contract', () => {
    it('drives the real renderer in both browser engines without remote resources', () => {
        const source = readFileSync(resolve('scripts/harness-image-export.ts'), 'utf8');
        const fixture = JSON.parse(readFileSync(
            resolve('tests/fixtures/image-export/message-export-corpus.json'),
            'utf8',
        ));

        expect(source).toContain('export-renderer.html');
        expect(source).toContain('new MessageChannel()');
        expect(source).toContain("name: 'chromium'");
        expect(source).toContain("name: 'firefox'");
        expect(source).toContain('remoteRequests');
        expect(source).toContain('channelTolerance: 8');
        expect(source).toContain('maxChangedPixelRatio: 0.005');
        expect(source).toContain('--update-goldens');
        expect(source).toContain('--long-repeat=');
        expect(source).toContain('nonWhitePixelCount');
        expect(source).toContain('artifact.nonWhitePixelCount > 0');
        expect(source).toContain("runJob('formula-png'");
        expect(source).toContain('\\ce{H2O + CO2}');
        expect(source).toContain('\\underbrace');
        expect(fixture.short.sections[0].assistantMarkdown).toContain('| Feature | Value |');
        expect(fixture.short.sections[0].assistantMarkdown).toContain('underbrace');
        expect(fixture.short.sections[0].assistantMarkdown).toContain('broken-image.png');
        expect(fixture.long.repeat).toBeGreaterThan(1);
    });

    it('keeps the slow harness opt-in and exposes an explicit golden update command', () => {
        const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

        expect(packageJson.scripts['harness:image-export']).toBe('tsx scripts/harness-image-export.ts');
        expect(packageJson.scripts['benchmark:image-export']).toBe('tsx scripts/harness-image-export.ts');
        expect(packageJson.scripts['harness:image-export:update-goldens']).toBe(
            'npm run harness:image-export -- --update-goldens',
        );
        expect(packageJson.scripts['test:core']).not.toContain('harness-image-export');
    });
});
