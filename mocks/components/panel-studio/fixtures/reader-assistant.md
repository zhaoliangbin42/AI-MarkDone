# {{TITLE}}

This reader preview renders a real markdown document inside the mock so layout, spacing, and code styles can be evaluated before the UI is merged.

## Key takeaways

- Platform: **{{PLATFORM}}**
- Bookmark folder: `{{FOLDER_PATH}}`
- Goal: keep the reader dense, legible, and visually stable in both light and dark themes.

> The reader should feel like a focused reading surface, not a modal full of unrelated chrome.

### Checklist

- [x] Render headings, lists, blockquotes, tables, and fenced code
- [x] Keep code blocks highlighted
- [x] Cap the readable width so long answers remain comfortable

### Comparison

| Surface | Why it matters | Constraint |
| --- | --- | --- |
| Toolbar | Repeated many times | Must stay lightweight |
| Reader | Single focused surface | Can afford richer typography |
| Source panel | Raw markdown only | No extra framing |

### Formula preview

Inline math should render cleanly, for example $E = mc^2$ and $\alpha + \beta \rightarrow \gamma$.

Block math should also be readable:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

More complex expressions should still feel balanced:

$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0},
\qquad
\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
$$

$$
\hat{\beta} = \arg\min_{\beta \in \mathbb{R}^p} \left(
\frac{1}{2n}\lVert y - X\beta \rVert_2^2 + \lambda \lVert \beta \rVert_1
\right)
$$

$$
\mathbf{P}(A \mid B) = \frac{\mathbf{P}(B \mid A)\mathbf{P}(A)}{\mathbf{P}(B)},
\qquad
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

### Example code

```ts
type ReaderSection = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildReaderSections(userPrompt: string, markdown: string): ReaderSection[] {
  return [
    { role: 'user', content: userPrompt.trim() },
    { role: 'assistant', content: markdown.trim() },
  ];
}
```

### Sample JSON

```json
{
  "title": "{{TITLE}}",
  "platform": "{{PLATFORM}}",
  "position": {{POSITION}}
}
```

### Closing note

{{SUMMARY}}
