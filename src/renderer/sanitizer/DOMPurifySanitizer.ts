import DOMPurify from 'dompurify';
import { ISanitizer } from './ISanitizer';
import { logger } from '../../utils/logger';

/**
 * DOMPurify-based HTML sanitizer
 * ⚡ Performance optimized: 294ms → <10ms
 */
export class DOMPurifySanitizer implements ISanitizer {
    sanitize(html: string): string {
        const t0 = performance.now();

        // Why: keep sanitizer minimal for performance; rely on marked output and forbid only dangerous tags/attrs.
        const result = DOMPurify.sanitize(html, {
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick'],
            WHOLE_DOCUMENT: false,
            RETURN_DOM: false,
            RETURN_DOM_FRAGMENT: false,
        });

        const t1 = performance.now();
        logger.debug(`[AI-MarkDone][DOMPurify] sanitize: ${(t1 - t0).toFixed(2)}ms (${html.length} chars)`);

        return result;
    }
}
