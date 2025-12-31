const isSingleOperatorLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.length === 1 && ['=', '+', '-', '*', '/'].includes(trimmed);
};

const extractExplicitMathFromText = (text: string): string | null => {
  const blockMatch = text.match(/\$\$([\s\S]+?)\$\$/);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }

  const inlineMatch = text.match(/\$([^$]+?)\$/);
  if (inlineMatch?.[1]) {
    return inlineMatch[1].trim();
  }

  return null;
};

const getAnnotationLatex = (element: Element): string | null => {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation?.textContent) {
    return annotation.textContent.trim();
  }

  return null;
};

const getAttributeLatex = (element: Element): string | null => {
  const value = element.getAttribute('data-latex-source') || element.getAttribute('data-math');
  if (value && value.trim()) {
    return value.trim();
  }
  return null;
};

const getClosestAttributeLatex = (element: Element | null): string | null => {
  let current: Element | null = element;
  while (current) {
    const value = getAttributeLatex(current);
    if (value) {
      return value;
    }
    current = current.parentElement;
  }
  return null;
};

const getKatexErrorLatex = (element: Element): string | null => {
  const errorElement = element.classList.contains('katex-error')
    ? element
    : element.querySelector('.katex-error');

  if (!errorElement) {
    return null;
  }

  const text = errorElement.textContent?.trim() || '';
  if (!text) {
    return null;
  }

  return extractExplicitMathFromText(text);
};

export const extractLatexSource = (element: Element | null): string | null => {
  if (!element) {
    return null;
  }

  const annotationLatex = getAnnotationLatex(element);
  if (annotationLatex) {
    return annotationLatex;
  }

  const attributeLatex = getClosestAttributeLatex(element);
  if (attributeLatex) {
    return attributeLatex;
  }

  return getKatexErrorLatex(element);
};

export const formatInlineMath = (latex: string): string => `$${latex}$`;

export const formatBlockMath = (latex: string): string | null => {
  const trimmed = latex.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.some(isSingleOperatorLine)) {
    return null;
  }

  return `$$\n${trimmed}\n$$`;
};

export const normalizeInlineMathSpacing = (text: string): string => {
  const before = text.replace(/([A-Za-z0-9])\$([^$]+)\$/g, (_m, lead, body) => {
    return `${lead} $${body}$`;
  });
  return before.replace(/\$([^$]+)\$([A-Za-z0-9])/g, (_m, body, tail) => {
    return `$${body}$ ${tail}`;
  });
};

export const escapeUnbalancedDelimiters = (text: string): string => {
  const tokens: string[] = [];
  let inInline = false;
  let inBlock = false;
  let inlineIndex: number | null = null;
  let blockIndex: number | null = null;

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '$') {
      if (text[i + 1] === '$') {
        if (inInline) {
          tokens.push('\\$\\$');
        } else if (inBlock) {
          tokens.push('$$');
          inBlock = false;
          blockIndex = null;
        } else {
          tokens.push('$$');
          inBlock = true;
          blockIndex = tokens.length - 1;
        }
        i += 1;
        continue;
      }

      if (inBlock) {
        tokens.push('$');
        continue;
      }

      if (inInline) {
        tokens.push('$');
        inInline = false;
        inlineIndex = null;
      } else {
        tokens.push('$');
        inInline = true;
        inlineIndex = tokens.length - 1;
      }
      continue;
    }

    tokens.push(text[i]);
  }

  if (inInline && inlineIndex !== null) {
    tokens[inlineIndex] = '\\$';
  }
  if (inBlock && blockIndex !== null) {
    tokens[blockIndex] = '\\$\\$';
  }

  return tokens.join('');
};
