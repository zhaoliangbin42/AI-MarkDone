# AI Copy Enhance - AI Coding Agent Instructions

## Project Overview
Chrome Extension (Manifest V3) that enhances ChatGPT/Gemini with robust Markdown export. Extracts LaTeX from KaTeX, handles rendering failures, converts tables/code to Markdown, and provides click-to-copy math formulas.

## Architecture Patterns

### Adapter Pattern for Multi-Platform Support
- **Registry**: `src/content/adapters/registry.ts` manages platform adapters
- **Base**: `SiteAdapter` abstract class defines interface (selectors, HTML extraction, streaming detection)
- **Implementations**: `ChatGPTAdapter`, `GeminiAdapter` (each 100 lines)
- **Critical**: New platforms extend `SiteAdapter` and register in `AdapterRegistry` constructor
- Adapters provide **DOM selectors** specific to each platform's structure

### Shadow DOM Isolation
- **All UI components** use Shadow DOM to avoid CSS conflicts with host pages
- See `src/content/components/toolbar.ts`, `modal.ts` - each creates shadow root and injects styles
- Styles defined in `src/styles/*.css.ts` as template literals for Shadow DOM injection
- **Toolbar**: Icon-only buttons with hover tooltips, auto-updating word/char count on right
- **Never use global CSS** - it won't reach Shadow DOM components

### Parser Pipeline Architecture
`MarkdownParser` orchestrates specialized extractors in sequence:
1. **CodeExtractor**: `<pre><code>` → fenced code blocks with language tags
2. **TableParser**: HTML tables → Markdown pipes
3. **Turndown**: HTML → Markdown (with custom rules for KaTeX)
4. **Post-processing**: Cleanup and normalization

**Critical**: Math formulas are handled by Turndown rules that extract LaTeX from `<annotation encoding="application/x-tex">` tags.

### MutationObserver Pattern
- `src/observers/mutation-observer.ts` watches for new messages with 200ms debounce
- Uses `WeakSet` to track processed messages (avoid duplicate toolbars)
- Container selection: tries multiple selectors (`main`, `main > div`, etc.) - see `getObserverContainer()`

## Build & Development Workflow

```bash
npm run dev      # Vite HMR (reload extension manually in chrome://extensions/)
npm run build    # Build to dist/ (postbuild copies manifest + icons)
npm run type-check  # TypeScript validation
```

**Extension loading**: Load `dist/` folder (not root) in `chrome://extensions/` with Developer Mode enabled.

**Vite config**: Uses `rollupOptions.input` to create separate `content.js` and `background.js` bundles (no @crxjs plugin).

## Critical Implementation Details

### Math Handling
- **Turndown Rules**: Custom rules for `.katex-display` (block) and `.katex` (inline)
  - Structure: `<span class="katex-display"><span class="katex">...</span></span>`
  - Block rule processes `.katex-display`, inline rule processes `.katex` (not inside display)
- **LaTeX Extraction**: From `<annotation encoding="application/x-tex">` tags
- **Cleaning**: Simple whitespace normalization: `replace(/\s+/g, ' ')`
- **Output**: `$inline$` and `$$\nblock\n$$` for Typora compatibility
- **Fallback**: `MathExtractor` handles raw `\[...\]`, `\(...\)` patterns (ChatGPT-Fail scenario)
- **Click-to-copy**: `MathClickHandler` adds listeners to `.katex` elements

### Deep Research Messages
- Detected by `isDeepResearch()` - checks for nested `<article>` tags
- Custom recursive parser extracts headings/paragraphs from each `<article>`
- See `parseDeepResearch()` in `markdown-parser.ts`

### Word Count (CJK vs Latin)
- `WordCounter` counts **CJK characters** separately from **Latin words**
- Excludes code blocks and math formulas from count
- Uses Unicode ranges: `\u4e00-\u9fa5` (Chinese), `\u3040-\u30ff` (Japanese), `\uac00-\ud7af` (Korean)

### Logging
- Set level in `src/content/index.ts` constructor: `logger.setLevel(LogLevel.DEBUG)`
- Prefix: `[CopyLLM]`
- Use `logger.debug()` for detailed traces, `logger.info()` for major events

## Coding Conventions
- **TypeScript**: Strict mode, explicit return types on public methods
- **Comments**: Follow `.agent/rules/commenting.md` (prefer Why/constraints + public API JSDoc; avoid “what” comments)
- **Shadow DOM components**: Always create `shadowRoot`, inject styles first, then HTML
- **Adapter methods**: Return `null` when element not found (defensive programming)
- **Cloning before parsing**: Clone DOM elements before modification (see `parse()` method)
- **SVG icons**: Use inline SVG with stroke (not fill) for consistency
- **Placeholder pattern**: Math/code use placeholders during Turndown, then restore (see `MathExtractor.generatePlaceholder()`)

## Testing Scenarios
Reference HTML files in root (`ChatGPT-Success.html`, `ChatGPT-Fail.html`, `ChatGPT-DeepResearch.html`) show:
- **Success**: Rendered KaTeX with `data-latex-source`
- **Fail**: Raw LaTeX `\[`, `\(` in DOM (test fallback extraction)
- **DeepResearch**: Nested `<article>` structures (test recursive parser)

## Common Tasks

**Add new platform**: 
1. Create `src/content/adapters/newplatform.ts` extending `SiteAdapter`
2. Implement all abstract methods (especially selectors)
3. Register in `AdapterRegistry` constructor

**Add new parser**:
1. Create in `src/content/parsers/`
2. Integrate into `MarkdownParser.parse()` pipeline (order matters!)
3. Use placeholder pattern if conflicts with Turndown

**Modify UI components**:
1. Update `src/components/*.ts` (Shadow DOM creation)
2. Update `src/styles/*.css.ts` (CSS-in-JS)
3. Test style isolation on actual ChatGPT/Gemini pages
