import { logger } from '../../utils/logger';
import { createMarkdownParser } from '../../parser-example';

/**
 * MarkdownParser - Uses new v3 high-performance parser
 * 
 * Old unified pipeline has been removed to reduce bundle size (~1.5MB savings)
 */
export class MarkdownParser {
    private parser = createMarkdownParser({
        enablePerformanceLogging: true,
    });

    parse(element: HTMLElement): string {
        logger.debug('[MarkdownParser] Using v3 parser');
        const startTime = performance.now();

        const markdown = this.parser.parse(element);
        const elapsed = performance.now() - startTime;

        logger.debug(`[MarkdownParser] Parsed in ${elapsed.toFixed(2)}ms`);
        return markdown;
    }
}
