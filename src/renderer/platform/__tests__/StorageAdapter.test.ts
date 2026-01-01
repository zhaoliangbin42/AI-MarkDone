import { describe, test, expect, beforeEach } from 'vitest';
import { MockStorageAdapter } from '../MockStorageAdapter';
import { ChromeStorageAdapter } from '../ChromeStorageAdapter';

describe('MockStorageAdapter', () => {
    let adapter: MockStorageAdapter;

    beforeEach(() => {
        adapter = new MockStorageAdapter();
    });

    test('基本get/set操作', async () => {
        await adapter.set('test', { foo: 'bar' });
        const result = await adapter.get('test');
        expect(result).toEqual({ foo: 'bar' });
    });

    test('触发change监听器', async () => {
        let receivedChanges: any = null;

        adapter.onChanged((changes) => {
            receivedChanges = changes;
        });

        await adapter.set('key', 'value');

        expect(receivedChanges).toBeDefined();
        expect(receivedChanges.key.newValue).toBe('value');
    });

    test('clear清空存储', async () => {
        await adapter.set('a', 1);
        await adapter.set('b', 2);
        adapter.clear();

        expect(await adapter.get('a')).toBeUndefined();
        expect(await adapter.get('b')).toBeUndefined();
    });
});
