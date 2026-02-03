import { logger } from '../../utils/logger';

/**
 * Dot Pagination Controller - Fully Modular
 * 
 * Manages dot-based pagination UI with adaptive sizing.
 * Zero dependencies on specific DOM structures or parent components.
 * 
 * @example
 * const controller = new DotPaginationController(container, {
 *   totalItems: 10,
 *   currentIndex: 0,
 *   onNavigate: (index) => logger.debug(index)
 * });
 * controller.render();
 * controller.setActiveIndex(5);
 * controller.destroy();
 */

export interface DotPaginationConfig {
    totalItems: number;
    currentIndex: number;
    containerWidth?: number;
    onNavigate?: (index: number) => void;
    bookmarkedPositions?: Set<number>;
}

export interface DotSizeConfig {
    size: number;
    gap: number;
}

export class DotPaginationController {
    private container: HTMLElement;
    private config: DotPaginationConfig;
    private dots: HTMLElement[] = [];
    private destroyed: boolean = false;

    constructor(container: HTMLElement, config: DotPaginationConfig) {
        this.container = container;
        this.config = config;
    }

    /**
     * Calculate adaptive dot sizing based on item count
     */
    calculateDotSize(): DotSizeConfig {
        const count = this.config.totalItems;
        const containerWidth = this.config.containerWidth || this.container.clientWidth;
        const maxWidth = containerWidth * 0.8;

        const tiers = [
            { maxCount: 10, size: 12, gap: 10 },
            { maxCount: 20, size: 10, gap: 8 },
            { maxCount: 35, size: 8, gap: 6 },
            { maxCount: 50, size: 6, gap: 4 },
        ];

        for (const tier of tiers) {
            const totalWidth = count * (tier.size + tier.gap);
            if (totalWidth <= maxWidth || tier.size === 6) {
                return { size: tier.size, gap: tier.gap };
            }
        }

        return { size: 6, gap: 4 };
    }

    /**
     * Render pagination dots
     */
    render(): void {
        if (this.destroyed) {
            logger.warn('[DotPaginationController] Cannot render: controller is destroyed');
            return;
        }

        // Clear existing dots
        this.container.innerHTML = '';
        this.dots = [];

        // Calculate sizing
        const sizing = this.calculateDotSize();
        logger.debug('[DotPaginationController] Calculated dot size:', sizing);

        // Apply CSS variables to container
        this.container.style.setProperty('--dot-size', `${sizing.size}px`);
        this.container.style.setProperty('--dot-gap', `${sizing.gap}px`);

        // Create dots
        for (let i = 0; i < this.config.totalItems; i++) {
            const dot = this.createDot(i);
            this.dots.push(dot);
            this.container.appendChild(dot);
        }

        logger.debug(`[DotPaginationController] Created ${this.dots.length} dots`);
        this.updateActiveDot();
    }

    /**
     * Create a single dot element
     */
    private createDot(index: number): HTMLElement {
        const dot = document.createElement('div');
        dot.className = 'aicopy-dot';
        dot.dataset.index = index.toString();

        const position = index + 1;
        if (this.config.bookmarkedPositions?.has(position)) {
            dot.classList.add('bookmarked');
        }

        // Click handler
        dot.addEventListener('click', () => {
            if (this.config.onNavigate) {
                this.config.onNavigate(index);
            }
            this.setActiveIndex(index);
        });

        return dot;
    }

    /**
     * Set active index and update UI
     */
    setActiveIndex(index: number): void {
        if (index < 0 || index >= this.config.totalItems) {
            return;
        }

        this.config.currentIndex = index;
        this.updateActiveDot();
    }

    /**
     * Update active dot styling
     */
    private updateActiveDot(): void {
        this.dots.forEach((dot, i) => {
            if (i === this.config.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    /**
     * Get all dot elements (for external tooltip attachment)
     */
    getDots(): HTMLElement[] {
        return this.dots;
    }

    /**
     * Navigate to next item
     */
    next(): boolean {
        if (this.config.currentIndex < this.config.totalItems - 1) {
            this.setActiveIndex(this.config.currentIndex + 1);
            if (this.config.onNavigate) {
                this.config.onNavigate(this.config.currentIndex);
            }
            return true;
        }
        return false;
    }

    /**
     * Navigate to previous item
     */
    previous(): boolean {
        if (this.config.currentIndex > 0) {
            this.setActiveIndex(this.config.currentIndex - 1);
            if (this.config.onNavigate) {
                this.config.onNavigate(this.config.currentIndex);
            }
            return true;
        }
        return false;
    }

    /**
     * Get current index
     */
    getCurrentIndex(): number {
        return this.config.currentIndex;
    }

    /**
     * Get total items count
     */
    getTotalItems(): number {
        return this.config.totalItems;
    }

    /**
     * Update total items and add new dots incrementally
     * Used for dynamic pagination updates (e.g., new messages)
     * Note: Only adds new dots, does not re-render to preserve other UI elements
     */
    updateTotalItems(newTotal: number): void {
        if (newTotal === this.config.totalItems || newTotal < 1) {
            return;
        }

        this.config.totalItems = newTotal;

        // Check if index adjustment is needed before render
        if (this.config.currentIndex >= newTotal) {
            this.config.currentIndex = newTotal - 1;
        }

        // Dedicated container allows full re-render safely
        this.render();
    }

    /**
     * Set bookmark state for a specific dot
     * Used for real-time sync when user toggles bookmark
     */
    setBookmarked(index: number, isBookmarked: boolean): void {
        const dot = this.dots[index];
        if (!dot) return;
        dot.classList.toggle('bookmarked', isBookmarked);
    }

    /**
     * Update bookmarked positions and refresh all dots
     */
    updateBookmarkedPositions(positions: Set<number>): void {
        this.config.bookmarkedPositions = positions;
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('bookmarked', positions.has(i + 1)); // positions are 1-indexed
        });
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.destroyed) return;

        this.container.innerHTML = '';
        this.dots = [];
        this.destroyed = true;
    }
}
