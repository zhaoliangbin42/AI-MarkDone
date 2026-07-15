import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SOURCE_COMMIT = 'd4b1410b82cc634fef18989dfc53db58a55484c9';
const SOURCE_ROOT = `https://raw.githubusercontent.com/James-Yu/LaTeX-Workshop/${SOURCE_COMMIT}/data`;
const OUTPUT_PATH = resolve(process.cwd(), 'public/vendor/latex-workshop/formula-snippets.json');

const PACKAGES = [
    'tex',
    'amsmath',
    'amsfonts',
    'amssymb',
    'amsopn',
    'amsbsy',
    'mathtools',
    'mhchem',
    'physics',
    'braket',
    'cancel',
    'cases',
    'color',
    'empheq',
    'textcomp',
    'units',
    'upgreek',
] as const;

const FORMULA_ENVIRONMENTS = new Set([
    'array',
    'subarray',
    'split',
    'gathered',
    'aligned',
    'alignedat',
    'matrix',
    'bmatrix',
    'Bmatrix',
    'pmatrix',
    'vmatrix',
    'Vmatrix',
    'smallmatrix',
    'cases',
]);

const DOCUMENT_COMMANDS = new Set([
    'begin', 'end', 'documentclass', 'usepackage', 'RequirePackage', 'include', 'includeonly',
    'input', 'includegraphics', 'graphicspath', 'label', 'ref', 'pageref', 'eqref', 'cite',
    'nocite', 'bibitem', 'bibliography', 'bibliographystyle', 'index', 'glossary', 'footnote',
    'footnotemark', 'footnotetext', 'marginpar', 'part', 'chapter', 'section', 'subsection',
    'subsubsection', 'paragraph', 'subparagraph', 'title', 'author', 'date', 'maketitle',
    'tableofcontents', 'listoffigures', 'listoftables', 'appendix', 'item', 'caption',
    'linebreak', 'newline', 'pagebreak', 'newpage', 'clearpage', 'cleardoublepage',
    'newcommand', 'renewcommand', 'providecommand', 'DeclareMathOperator', 'def', 'gdef', 'edef',
    'let', 'futurelet', 'newenvironment', 'renewenvironment', 'newtheorem', 'protect', 'write',
    'openout', 'closeout', 'message', 'errmessage', 'special', 'shipout', 'jobname', 'inputlineno',
]);

const COMMON_PRIORITY = new Map<string, number>([
    ['frac', 1000], ['sqrt', 990], ['sum', 980], ['prod', 970], ['int', 960],
    ['lim', 950], ['infty', 940], ['alpha', 930], ['beta', 920], ['gamma', 910],
    ['theta', 900], ['lambda', 890], ['pi', 880], ['times', 870], ['cdot', 860],
    ['leq', 850], ['geq', 840], ['neq', 830], ['approx', 820], ['rightarrow', 810],
    ['leftarrow', 800], ['partial', 790], ['nabla', 780], ['mathbf', 770], ['mathrm', 760],
]);

const CORE_MATH_COMMANDS = new Set(`
left text sqrt frac bar alpha beta chi delta epsilon varepsilon eta gamma iota kappa lambda mu nu omega
phi varphi pi varpi psi rho varrho sigma varsigma tau theta vartheta upsilon xi zeta Delta Gamma Lambda
Omega Phi Pi Psi Sigma Theta Upsilon Xi exists in notin subset supset leftarrow Leftarrow Leftrightarrow
rightarrow Rightarrow infty div approx mid neg setminus sum prime geq partial pm times cap bigcap cup bigcup
vee prod circ wedge neq forall leq equiv dot ddot acute breve check grave hat widehat tilde widetilde vec cdot
cdots ldots ddots underbrace overbrace overline stackrel mathbb mathbf mathcal mathds mathit mathnormal mathrm
mathscr mathsf mathtt displaystyle
`.trim().split(/\s+/));

type UpstreamMacro = {
    name?: unknown;
    arg?: { snippet?: unknown };
    detail?: unknown;
    doc?: unknown;
    unusual?: unknown;
};

type UpstreamPackage = { macros?: UpstreamMacro[] };
type UpstreamEnvironment = { name?: unknown; arg?: { snippet?: unknown } };

type OutputItem = {
    id: string;
    label: string;
    insertText: string;
    detail: string;
    category: string;
    priority: number;
};

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.json() as Promise<T>;
}

function cleanSnippet(snippet: string): string {
    return snippet.replace(/%:translatable/g, '');
}

function cleanDetail(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    return value
        .replace(/,?\s*shortcuts?\s+@[^,;]*/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || fallback;
}

function categoryFor(name: string, packageName: string, hasArguments: boolean): string {
    if (/^(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega)$/i.test(name)) return 'greek';
    if (/(?:arrow|leftright|mapsto|harpoon|hook)/i.test(name)) return 'arrow';
    if (/^(?:eq|neq|sim|approx|cong|subset|supset|prec|succ|leq|geq|in|notin|ni|mid|parallel|perp|propto|equiv)$/i.test(name)) return 'relation';
    if (/^(?:sum|prod|coprod|int|iint|iiint|oint|lim|log|ln|exp|sin|cos|tan|min|max|det|gcd|Pr|operatorname)/.test(name)) return 'operator';
    if (hasArguments) return 'structure';
    return packageName === 'tex' ? 'symbol' : packageName;
}

function shouldIncludeMacro(macro: UpstreamMacro): macro is UpstreamMacro & { name: string } {
    if (macro.unusual === true || typeof macro.name !== 'string' || !macro.name) return false;
    if (macro.name.includes('@') || DOCUMENT_COMMANDS.has(macro.name)) return false;
    return /^[A-Za-z]+\*?$/.test(macro.name) || /^(?:[!#%&,:;<=>?`|~]+)$/.test(macro.name);
}

async function createCatalog(): Promise<{ version: 1; source: Record<string, unknown>; items: OutputItem[] }> {
    const output = new Map<string, OutputItem>();
    const addMacro = (macro: UpstreamMacro & { name: string }, packageName: string): void => {
        const snippet = typeof macro.arg?.snippet === 'string'
            ? cleanSnippet(macro.arg.snippet)
            : macro.name;
        const insertText = `\\${snippet}`;
        const key = `${macro.name}\u0000${insertText}`;
        if (output.has(key)) return;
        output.set(key, {
            id: `${packageName}:${macro.name}:${output.size}`,
            label: `\\${macro.name}`,
            insertText,
            detail: cleanDetail(macro.detail ?? macro.doc, packageName),
            category: categoryFor(macro.name, packageName, Boolean(macro.arg?.snippet)),
            priority: COMMON_PRIORITY.get(macro.name) ?? (packageName === 'core' ? 500 : packageName === 'tex' ? 300 : 200),
        });
    };

    const coreMacros = await fetchJson<UpstreamMacro[]>(`${SOURCE_ROOT}/macros.json`);
    for (const macro of coreMacros) {
        if (!shouldIncludeMacro(macro) || !CORE_MATH_COMMANDS.has(macro.name)) continue;
        addMacro(macro, 'core');
    }

    for (const packageName of PACKAGES) {
        const data = await fetchJson<UpstreamPackage>(`${SOURCE_ROOT}/packages/${packageName}.json`);
        for (const macro of data.macros ?? []) {
            if (!shouldIncludeMacro(macro)) continue;
            addMacro(macro, packageName);
        }
    }

    const environments = await fetchJson<UpstreamEnvironment[]>(`${SOURCE_ROOT}/environments.json`);
    for (const environment of environments) {
        if (typeof environment.name !== 'string' || !FORMULA_ENVIRONMENTS.has(environment.name)) continue;
        const argument = typeof environment.arg?.snippet === 'string' ? cleanSnippet(environment.arg.snippet) : '';
        const insertText = `\\begin{${environment.name}}${argument}\n\t\${1:formula}\n\\end{${environment.name}}$0`;
        output.set(`environment\u0000${environment.name}`, {
            id: `environment:${environment.name}`,
            label: `\\begin{${environment.name}}`,
            insertText,
            detail: `${environment.name} formula environment`,
            category: 'environment',
            priority: 250,
        });
    }

    const items = [...output.values()].sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
    return {
        version: 1,
        source: {
            project: 'LaTeX Workshop',
            repository: 'https://github.com/James-Yu/LaTeX-Workshop',
            commit: SOURCE_COMMIT,
            files: ['data/macros.json', ...PACKAGES.map((name) => `data/packages/${name}.json`), 'data/environments.json'],
            license: 'MIT; package completion data is generated upstream from TeXStudio CWL files',
        },
        items,
    };
}

const catalog = await createCatalog();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${catalog.items.length} formula snippets to ${OUTPUT_PATH}`);
