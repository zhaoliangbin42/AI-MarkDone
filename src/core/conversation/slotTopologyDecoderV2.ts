import type {
    HostEntryKeyV2,
    HostRoundSlotV2,
} from '../../contracts/conversationDiscoveryV2';

export type SlotMarkerEvidenceV2 = Readonly<{
    key: string;
    element: HTMLElement;
    parent: HTMLElement;
    role: 'user' | 'assistant' | null;
    sentinel?: boolean;
    estimatedHeightPx?: number | null;
}>;

export type SlotTopologyV2 = Readonly<{
    token: string;
    rounds: readonly HostRoundSlotV2[];
    leadingUnpairedSlots: number;
    trailingUnpairedSlots: number;
    markerKeys: readonly string[];
}>;

export type SlotTopologyDecodeResultV2 =
    | Readonly<{ kind: 'ready'; topology: SlotTopologyV2 }>
    | Readonly<{
        kind: 'unavailable';
        reason: 'empty' | 'duplicate-key' | 'ambiguous' | 'invalid-role-cycle';
    }>;

/**
 * Decodes a host-supplied marker cohort into logical user/assistant rounds.
 *
 * The decoder never reads text, classes, DOM indexes as identity, or layout
 * state as content.  The element order is used only as the host's topology
 * order after the Adapter has supplied one maximal sibling cohort.
 */
export function decodeSlotTopologyV2(
    epochId: string,
    input: readonly SlotMarkerEvidenceV2[],
): SlotTopologyDecodeResultV2 {
    if (!epochId.trim() || input.length === 0) {
        return { kind: 'unavailable', reason: 'empty' };
    }

    // ChatGPT renders a hydrated turn as an outer virtualization wrapper and
    // an inner role section.  Both can carry the same slot marker.  Remove
    // nested marker observations before enforcing key uniqueness; otherwise a
    // valid hydrated slot is rejected before the topology normalizer gets a
    // chance to collapse it.  Unrelated sibling duplicates remain rejected.
    const normalizedInput = removeNestedMarkers(input);
    const uniqueKeys = new Set<string>();
    for (const record of normalizedInput) {
        const key = record.key.trim();
        if (!key || uniqueKeys.has(key)) {
            return { kind: 'unavailable', reason: 'duplicate-key' };
        }
        uniqueKeys.add(key);
    }

    const cohort = chooseMaximalSiblingCohort(normalizedInput);
    if (!cohort || cohort.length === 0) {
        return { kind: 'unavailable', reason: 'ambiguous' };
    }
    if (!cohort.some((record) => record.role !== null) && !cohort.some((record) => record.sentinel === true)) {
        return { kind: 'unavailable', reason: 'ambiguous' };
    }

    const candidates = [0, 1]
        .map((userParity) => solvePhase(epochId, cohort, userParity))
        .filter((candidate): candidate is SlotTopologyV2 => candidate !== null);

    if (candidates.length !== 1) {
        return {
            kind: 'unavailable',
            reason: candidates.length === 0 ? 'invalid-role-cycle' : 'ambiguous',
        };
    }
    return { kind: 'ready', topology: candidates[0]! };
}

function removeNestedMarkers(input: readonly SlotMarkerEvidenceV2[]): SlotMarkerEvidenceV2[] {
    const markerElements = new Set(input.map((record) => record.element));
    return input.filter((record) => {
        let parent = record.element.parentElement;
        while (parent) {
            if (markerElements.has(parent)) return false;
            parent = parent.parentElement;
        }
        return true;
    });
}

function chooseMaximalSiblingCohort(input: readonly SlotMarkerEvidenceV2[]): SlotMarkerEvidenceV2[] | null {
    const byParent = new Map<HTMLElement, SlotMarkerEvidenceV2[]>();
    for (const record of input) {
        const group = byParent.get(record.parent) ?? [];
        group.push(record);
        byParent.set(record.parent, group);
    }

    let winner: SlotMarkerEvidenceV2[] | null = null;
    for (const group of byParent.values()) {
        const ordered = [...group].sort((a, b) => siblingIndex(a.element) - siblingIndex(b.element));
        if (!winner || ordered.length > winner.length) {
            winner = ordered;
            continue;
        }
        if (ordered.length === winner.length && ordered.length > 0) {
            // Two equally sized cohorts mean the Adapter did not identify a
            // unique conversation root.  Failing closed is safer than
            // inventing a total count from an unrelated subtree.
            winner = null;
        }
    }
    return winner;
}

function solvePhase(
    epochId: string,
    cohort: readonly SlotMarkerEvidenceV2[],
    userParity: number,
): SlotTopologyV2 | null {
    const leading = userParity;
    if (leading > cohort.length) return null;
    const trailing = (cohort.length - leading) % 2;
    if (trailing > 1) return null;

    const pairedEnd = cohort.length - trailing;
    for (let index = leading; index < pairedEnd; index += 1) {
        const record = cohort[index]!;
        const expectedRole = (index - leading) % 2 === 0 ? 'user' : 'assistant';
        if (record.role !== null && record.role !== expectedRole) return null;
    }

    for (let index = 0; index < leading; index += 1) {
        if (cohort[index]!.role !== null || cohort[index]!.sentinel !== true) return null;
    }
    for (let index = pairedEnd; index < cohort.length; index += 1) {
        if (cohort[index]!.role !== null && cohort[index]!.role !== 'user') return null;
        if (cohort[index]!.role === null && cohort[index]!.sentinel !== true) return null;
    }

    const rounds: HostRoundSlotV2[] = [];
    for (let index = leading; index < pairedEnd; index += 2) {
        const user = cohort[index]!;
        const assistant = cohort[index + 1]!;
        const slotKey = `round:${hash(`${user.key}\0${assistant.key}`)}`;
        const entry: HostEntryKeyV2 = Object.freeze({ epochId, slotKey });
        rounds.push(Object.freeze({
            entry,
            ordinal: rounds.length + 1,
            userSlotKey: user.key,
            assistantSlotKey: assistant.key,
            estimatedHeightPx: Object.freeze({
                user: normalizeHeight(user.estimatedHeightPx),
                assistant: normalizeHeight(assistant.estimatedHeightPx),
            }),
        }));
    }

    if (rounds.length === 0) return null;
    const markerKeys = cohort.map((record) => record.key);
    return Object.freeze({
        token: `topology:${hash(markerKeys.join('\0'))}`,
        rounds: Object.freeze(rounds),
        leadingUnpairedSlots: leading,
        trailingUnpairedSlots: trailing,
        markerKeys: Object.freeze(markerKeys),
    });
}

function siblingIndex(element: HTMLElement): number {
    let index = 0;
    let current: Element | null = element;
    while ((current = current.previousElementSibling)) index += 1;
    return index;
}

function normalizeHeight(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function hash(value: string): string {
    let hashValue = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hashValue ^= value.charCodeAt(index);
        hashValue = Math.imul(hashValue, 16777619);
    }
    return (hashValue >>> 0).toString(16).padStart(8, '0');
}
