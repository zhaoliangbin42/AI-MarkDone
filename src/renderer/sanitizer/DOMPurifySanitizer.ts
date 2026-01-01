import DOMPurify from 'dompurify';
import { ISanitizer } from './ISanitizer';

/**
 * DOMPurify-based HTML sanitizer
 */
export class DOMPurifySanitizer implements ISanitizer {
    sanitize(html: string): string {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'div', 'span', 'br', 'hr',
                'strong', 'em', 'code', 'pre',
                'ul', 'ol', 'li',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'img',
                'blockquote',
                // KaTeX generated tags
                'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt',
                'annotation',
            ],
            ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title', 'style'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        });
    }
}
