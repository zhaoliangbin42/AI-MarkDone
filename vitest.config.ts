import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'tests/unit/markdown-ast-pipeline.test.js',
            'tests/unit/markdown-math-core.test.js',
            'tests/unit/markdown-parser.test.js',
            'tests/unit/markdown-sample-baseline.test.js',
            'tests/unit/math-extraction.test.js',
            'tests/unit/toolbar-reconcile-strict.test.js',
            'tests/unit/toolbar-wrapper-root.test.js',
            'tests/unit/word-counter.test.js',
            'tests/unit/gemini-adapter.test.js',
            'tests/unit/latex-extractor.test.js',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/',
                '**/*.test.ts',
                '**/*.spec.ts',
                'dist-chrome/',
                'dist-firefox/'
            ]
        },
        mockReset: true,
        restoreMocks: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
