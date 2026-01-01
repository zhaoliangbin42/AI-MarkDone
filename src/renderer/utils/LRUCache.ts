class Node<K, V> {
    constructor(
        public key: K,
        public value: V,
        public prev: Node<K, V> | null = null,
        public next: Node<K, V> | null = null
    ) { }
}

/**
 * LRU Cache implementation with O(1) get/set
 * Uses Map + doubly-linked list
 */
export class LRUCache<K, V> {
    private static totalCaches: LRUCache<any, any>[] = [];

    private map: Map<K, Node<K, V>> = new Map();
    private head: Node<K, V> | null = null;
    private tail: Node<K, V> | null = null;
    private currentSize: number = 0;

    constructor(private capacity: number) {
        if (capacity <= 0) {
            throw new Error('Capacity must be > 0');
        }
        LRUCache.totalCaches.push(this);
    }

    /**
     * Get value (O(1))
     */
    get(key: K): V | undefined {
        const node = this.map.get(key);
        if (!node) return undefined;

        // Move to head (most recently used)
        this.moveToHead(node);
        return node.value;
    }

    /**
     * Set value (O(1))
     */
    set(key: K, value: V): void {
        const existing = this.map.get(key);

        if (existing) {
            // Update and move to head
            existing.value = value;
            this.moveToHead(existing);
        } else {
            // New key
            const newNode = new Node(key, value);
            this.map.set(key, newNode);
            this.addToHead(newNode);
            this.currentSize++;

            // Evict LRU if over capacity
            if (this.currentSize > this.capacity) {
                const removed = this.removeTail();
                if (removed) {
                    this.map.delete(removed.key);
                    this.currentSize--;
                }
            }
        }
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.map.clear();
        this.head = null;
        this.tail = null;
        this.currentSize = 0;
    }

    /**
     * Get current size
     */
    size(): number {
        return this.currentSize;
    }

    /**
     * Destroy and remove from global tracking
     */
    destroy(): void {
        this.clear();
        const index = LRUCache.totalCaches.indexOf(this);
        if (index > -1) {
            LRUCache.totalCaches.splice(index, 1);
        }
    }

    // ---- Private methods ----

    private moveToHead(node: Node<K, V>): void {
        this.removeNode(node);
        this.addToHead(node);
    }

    private addToHead(node: Node<K, V>): void {
        node.next = this.head;
        node.prev = null;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    private removeNode(node: Node<K, V>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
    }

    private removeTail(): Node<K, V> | null {
        const node = this.tail;
        if (node) {
            this.removeNode(node);
        }
        return node;
    }

    // ---- Static methods for health check ----

    static getTotalSize(): number {
        return this.totalCaches.reduce((sum, cache) => sum + cache.size(), 0);
    }

    static clearAll(): void {
        this.totalCaches.forEach(cache => cache.clear());
    }
}
