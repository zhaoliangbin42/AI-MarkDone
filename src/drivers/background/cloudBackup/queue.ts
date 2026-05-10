class SerialQueue {
    private running = false;

    async run<T>(task: () => Promise<T>): Promise<T> {
        if (this.running) {
            throw new Error('Cloud backup task is already running');
        }
        this.running = true;
        try {
            return await task();
        } finally {
            this.running = false;
        }
    }
}

export const cloudBackupQueue = new SerialQueue();
