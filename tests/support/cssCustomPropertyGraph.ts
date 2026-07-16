import type { UiStyleSource } from './uiStyleInventory';

export type CssCustomPropertyOccurrence = {
    token: string;
    file: string;
    line: number;
};

export type CssCustomPropertyGraph = {
    definitions: Map<string, CssCustomPropertyOccurrence[]>;
    references: Map<string, CssCustomPropertyOccurrence[]>;
    dependencies: Map<string, Set<string>>;
};

const GLOBAL_TOKEN = '--aimd-[A-Za-z0-9_-]+';

function collectMatches(
    target: Map<string, CssCustomPropertyOccurrence[]>,
    source: UiStyleSource,
    pattern: RegExp,
): void {
    for (const match of source.source.matchAll(pattern)) {
        const token = match[1];
        if (!token || match.index === undefined) continue;
        const line = source.source.slice(0, match.index).split('\n').length;
        const occurrences = target.get(token) ?? [];
        occurrences.push({ token, file: source.relativePath, line });
        target.set(token, occurrences);
    }
}

/** Parses global product tokens. Surface-private `--_*` properties are intentionally outside this graph. */
export function buildCssCustomPropertyGraph(sources: readonly UiStyleSource[]): CssCustomPropertyGraph {
    const definitions = new Map<string, CssCustomPropertyOccurrence[]>();
    const references = new Map<string, CssCustomPropertyOccurrence[]>();
    const dependencies = new Map<string, Set<string>>();

    for (const source of sources) {
        collectMatches(definitions, source, new RegExp(`(${GLOBAL_TOKEN})\\s*:`, 'g'));
        collectMatches(definitions, source, new RegExp(`\\.setProperty\\(\\s*['\"\`](${GLOBAL_TOKEN})['\"\`]`, 'g'));
        collectMatches(references, source, new RegExp(`var\\(\\s*(${GLOBAL_TOKEN})`, 'g'));

        for (const declaration of source.source.matchAll(new RegExp(`(${GLOBAL_TOKEN})\\s*:\\s*([^;]+);`, 'g'))) {
            const token = declaration[1];
            const value = declaration[2] ?? '';
            if (!token) continue;
            const tokenDependencies = dependencies.get(token) ?? new Set<string>();
            for (const reference of value.matchAll(new RegExp(`var\\(\\s*(${GLOBAL_TOKEN})`, 'g'))) {
                if (reference[1]) tokenDependencies.add(reference[1]);
            }
            dependencies.set(token, tokenDependencies);
        }
    }

    return { definitions, references, dependencies };
}

export function findUndefinedCssCustomProperties(graph: CssCustomPropertyGraph): CssCustomPropertyOccurrence[] {
    return [...graph.references.entries()]
        .filter(([token]) => !graph.definitions.has(token))
        .flatMap(([, occurrences]) => occurrences)
        .sort((left, right) => left.token.localeCompare(right.token) || left.file.localeCompare(right.file) || left.line - right.line);
}

export function findCssCustomPropertyCycles(graph: CssCustomPropertyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const active = new Set<string>();
    const path: string[] = [];

    const visit = (token: string): void => {
        if (active.has(token)) {
            const cycleStart = path.indexOf(token);
            if (cycleStart >= 0) cycles.push([...path.slice(cycleStart), token]);
            return;
        }
        if (visited.has(token)) return;

        visited.add(token);
        active.add(token);
        path.push(token);
        for (const dependency of graph.dependencies.get(token) ?? []) visit(dependency);
        path.pop();
        active.delete(token);
    };

    for (const token of graph.dependencies.keys()) visit(token);
    return cycles;
}

export function findDuplicateCssCustomPropertyOwners(
    graph: CssCustomPropertyGraph,
    isIsolatedOwner: (file: string) => boolean,
): Array<{ token: string; files: string[] }> {
    return [...graph.definitions.entries()]
        .map(([token, occurrences]) => ({
            token,
            files: [...new Set(occurrences.map(({ file }) => file).filter((file) => !isIsolatedOwner(file)))].sort(),
        }))
        .filter(({ files }) => files.length > 1)
        .sort((left, right) => left.token.localeCompare(right.token));
}

export function findUnconsumedPublicTokens(
    graph: CssCustomPropertyGraph,
    publicOwnerFile: string,
): string[] {
    return [...graph.definitions.entries()]
        .filter(([token, occurrences]) => token.startsWith('--aimd-')
            && !token.startsWith('--aimd-ref-')
            && !token.startsWith('--aimd-sys-')
            && occurrences.some(({ file }) => file === publicOwnerFile))
        .filter(([token]) => !(graph.references.get(token) ?? []).some(({ file }) => file !== publicOwnerFile))
        .map(([token]) => token)
        .sort();
}

/** Finds token-layer definitions with no path from shipped non-token CSS consumers. */
export function findUnreachableTokenDefinitions(
    graph: CssCustomPropertyGraph,
    tokenOwnerFiles: readonly string[],
): string[] {
    const owners = new Set(tokenOwnerFiles);
    const reachable = new Set<string>();
    const visit = (token: string): void => {
        if (reachable.has(token)) return;
        reachable.add(token);
        for (const dependency of graph.dependencies.get(token) ?? []) visit(dependency);
    };

    for (const [token, occurrences] of graph.references) {
        if (occurrences.some(({ file }) => !owners.has(file))) visit(token);
    }

    return [...graph.definitions.entries()]
        .filter(([, occurrences]) => occurrences.some(({ file }) => owners.has(file)))
        .map(([token]) => token)
        .filter((token) => !reachable.has(token))
        .sort();
}
