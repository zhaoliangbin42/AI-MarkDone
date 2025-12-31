const LATEX_ATTRIBUTE_KEYS = ['data-latex-source', 'data-math'];

const looksLikeLatex = (value: string): boolean => /\\[a-zA-Z]+/.test(value) || /\\[^\s]/.test(value);

const getAttributeLatex = (element: Element): string | null => {
  for (const key of LATEX_ATTRIBUTE_KEYS) {
    const value = element.getAttribute(key);
    if (value && value.trim()) {
      return value.trim();
    }
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

const getAnnotationLatex = (element: Element): string | null => {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation?.textContent) {
    return annotation.textContent.trim();
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

  if (!looksLikeLatex(text)) {
    return null;
  }

  return text;
};

export const extractLatexSource = (element: Element | null): string | null => {
  if (!element) {
    return null;
  }

  const attributeLatex = getClosestAttributeLatex(element);
  if (attributeLatex) {
    return attributeLatex;
  }

  const annotationLatex = getAnnotationLatex(element);
  if (annotationLatex) {
    return annotationLatex;
  }

  return getKatexErrorLatex(element);
};

