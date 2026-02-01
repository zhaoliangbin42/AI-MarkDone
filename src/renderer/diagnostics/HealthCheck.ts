import { LRUCache } from '../utils/LRUCache';
import { logger } from '../../utils/logger';

/**
 * Health check and diagnostics for production monitoring
 * Usage: window.aiMarkDoneHealth.getStatus()
 */
export class HealthCheck {
    /**
     * Get system status
     */
    static getStatus(): {
        cacheSize: number;
        memoryMB?: number;
    } {
        const mem = (performance as any).memory?.usedJSHeapSize;
        return {
            cacheSize: LRUCache.getTotalSize(),
            memoryMB: mem ? parseFloat((mem / 1e6).toFixed(2)) : undefined,
        };
    }

    /**
     * Force cleanup all resources
     */
    static reset(): void {
        logger.warn('[HealthCheck] Forcing resource cleanup...');
        LRUCache.clearAll();
        logger.info('[HealthCheck] Cleanup complete');
    }

    /**
     * Run diagnostics
     */
    static diagnose(): string[] {
        const issues: string[] = [];
        const status = this.getStatus();

        if (status.cacheSize > 100) {
            issues.push(`Cache too large: ${status.cacheSize} items`);
        }

        if (status.memoryMB && status.memoryMB > 100) {
            issues.push(`High memory usage: ${status.memoryMB}MB`);
        }

        return issues;
    }
}

// Expose to global for production debugging
if (typeof window !== 'undefined') {
    (window as any).aiMarkDoneHealth = HealthCheck;
}
