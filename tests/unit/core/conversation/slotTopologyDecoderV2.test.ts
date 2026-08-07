import { describe, expect, it } from 'vitest';
import {
    decodeSlotTopologyV2,
    type SlotMarkerEvidenceV2,
} from '@/core/conversation/slotTopologyDecoderV2';

function createCohort(count: number, options: { leadingSentinel?: boolean; roles?: boolean } = {}) {
    const root = document.createElement('main');
    const records: SlotMarkerEvidenceV2[] = [];
    for (let index = 0; index < count; index += 1) {
        const element = document.createElement('div');
        element.dataset.turnIdContainer = index === 0 && options.leadingSentinel
            ? 'client-created-root'
            : `slot-${index}`;
        root.appendChild(element);
        const isLeadingSentinel = index === 0 && options.leadingSentinel;
        const role = options.roles && !isLeadingSentinel
            ? ((index - (options.leadingSentinel ? 1 : 0)) % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant'
            : null;
        if (role) {
            const message = document.createElement('section');
            message.setAttribute('data-message-author-role', role);
            element.appendChild(message);
        }
        records.push({
            key: element.getAttribute('data-turn-id-container')!,
            element,
            parent: root,
            role,
            sentinel: isLeadingSentinel,
            estimatedHeightPx: 100 + index,
        });
    }
    return { root, records };
}

describe('decodeSlotTopologyV2', () => {
    it('decodes a complete shell cohort with one leading sentinel', () => {
        const { records } = createCohort(37, { leadingSentinel: true });
        const result = decodeSlotTopologyV2('epoch-1', records);

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.topology.rounds).toHaveLength(18);
        expect(result.topology.leadingUnpairedSlots).toBe(1);
        expect(result.topology.trailingUnpairedSlots).toBe(0);
        expect(result.topology.rounds[0]?.ordinal).toBe(1);
        expect(result.topology.rounds[17]?.ordinal).toBe(18);
        expect(result.topology.rounds[0]?.userSlotKey).toBe('slot-1');
        expect(result.topology.rounds[0]?.assistantSlotKey).toBe('slot-2');
    });

    it('uses hydrated role facts to resolve phase without reading body text', () => {
        const { records } = createCohort(8, { roles: true });
        const result = decodeSlotTopologyV2('epoch-1', records);

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.topology.rounds).toHaveLength(4);
        expect(result.topology.leadingUnpairedSlots).toBe(0);
    });

    it('removes nested duplicate markers and preserves the maximal sibling cohort', () => {
        const { root, records } = createCohort(4, { roles: true });
        const nested = document.createElement('div');
        nested.setAttribute('data-turn-id-container', 'nested');
        records[0]!.element.appendChild(nested);
        records.push({
            key: 'nested',
            element: nested,
            parent: records[0]!.element,
            role: null,
        });
        root.appendChild(document.createElement('span'));

        const result = decodeSlotTopologyV2('epoch-1', records);
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.topology.markerKeys).not.toContain('nested');
        expect(result.topology.rounds).toHaveLength(2);
    });

    it('normalizes a hydrated wrapper and its inner section when they share one slot key', () => {
        const { records } = createCohort(4, { roles: true });
        const outer = records[0]!;
        const inner = document.createElement('section');
        inner.setAttribute('data-turn-id-container', outer.key);
        inner.setAttribute('data-message-author-role', outer.role!);
        outer.element.appendChild(inner);
        records.push({
            key: outer.key,
            element: inner,
            parent: outer.element,
            role: outer.role,
        });

        const result = decodeSlotTopologyV2('epoch-1', records);

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.topology.markerKeys).not.toContain('nested');
        expect(result.topology.markerKeys.filter((key) => key === outer.key)).toHaveLength(1);
        expect(result.topology.rounds).toHaveLength(2);
    });

    it('fails closed when an all-shell cohort has no proof of phase', () => {
        const { records } = createCohort(4);
        expect(decodeSlotTopologyV2('epoch-1', records)).toEqual({
            kind: 'unavailable',
            reason: 'ambiguous',
        });
    });

    it('fails closed for two equally sized sibling cohorts', () => {
        const first = createCohort(4);
        const second = createCohort(4);
        second.records.forEach((record, index) => {
            record.element.setAttribute('data-turn-id-container', `other-slot-${index}`);
        });
        document.body.append(first.root, second.root);
        const records = [
            ...first.records,
            ...second.records.map((record, index) => ({ ...record, key: `other-slot-${index}` })),
        ];
        expect(decodeSlotTopologyV2('epoch-1', records)).toEqual({
            kind: 'unavailable',
            reason: 'ambiguous',
        });
    });

    it('rejects a role cycle that contradicts the resolved phase', () => {
        const { records } = createCohort(4, { roles: true });
        records[1] = { ...records[1]!, role: 'user' };
        expect(decodeSlotTopologyV2('epoch-1', records)).toEqual({
            kind: 'unavailable',
            reason: 'invalid-role-cycle',
        });
    });
});
