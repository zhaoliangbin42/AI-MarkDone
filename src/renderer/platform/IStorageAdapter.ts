// Platform-agnostic storage interface
export interface IStorageAdapter {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    onChanged(callback: (changes: any) => void): void;
}
