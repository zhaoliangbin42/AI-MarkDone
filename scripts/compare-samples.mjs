import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import ts from 'typescript';

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, '.tmp-test-mods');

const compileToTemp = (relativePath, filename, replacements = []) => {
  const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const finalSource = replacements.reduce(
    (acc, [from, to]) => acc.replace(from, to),
    compiled
  );
  const outPath = path.join(tempDir, filename);
  return [outPath, finalSource];
};

const ensureTempModules = async () => {
  await import('node:fs').then((fs) => fs.promises.mkdir(tempDir, { recursive: true }));
  const fs = await import('node:fs');
  const [mathPath, mathSource] = compileToTemp('src/utils/markdown/math-core.ts', 'math-core.mjs');
  await fs.promises.writeFile(mathPath, mathSource, 'utf8');
  const [pipelinePath, pipelineSource] = compileToTemp(
    'src/utils/markdown/pipeline.ts',
    'pipeline.mjs',
    [[new RegExp('\\./math-core', 'g'), './math-core.mjs']]
  );
  await fs.promises.writeFile(pipelinePath, pipelineSource, 'utf8');
  await fs.promises.writeFile(
    path.join(tempDir, 'markdown.mjs'),
    "export { htmlToMarkdown } from './pipeline.mjs';",
    'utf8'
  );
};

const htmlToMarkdown = async () => {
  await ensureTempModules();
  const module = await import(pathToFileURL(path.join(tempDir, 'pipeline.mjs')).href);
  return module.htmlToMarkdown;
};

const extractSnippet = (html, startMarker, endMarker) => {
  const start = html.indexOf(startMarker);
  if (start === -1) return '';
  const startAt = start + startMarker.length;
  const end = html.indexOf(endMarker, startAt);
  if (end === -1) return '';
  return html.slice(startAt, end);
};

const run = async () => {
  const toMarkdown = await htmlToMarkdown();

  const chatHtml = readFileSync(path.join(repoRoot, 'mocks/ChatGPT-Sample.html'), 'utf8');
  const chatSnippet = extractSnippet(chatHtml, '<div class="whitespace-pre-wrap">', '</div>');
  const chatDoc = parseHTML(`<div id="root">${chatSnippet}</div>`).window.document;
  const chatOutput = toMarkdown(chatDoc.querySelector('#root').innerHTML).trim();

  const geminiHtml = readFileSync(path.join(repoRoot, 'mocks/Gemini-Sample.html'), 'utf8');
  const gemDoc = parseHTML(geminiHtml).window.document;
  const gemRoot =
    gemDoc.querySelector('.model-response-text .markdown') ||
    gemDoc.querySelector('#extended-response-markdown-content') ||
    gemDoc.querySelector('.markdown') ||
    gemDoc.querySelector('message-content') ||
    gemDoc.body;
  const gemOutput = toMarkdown(gemRoot.innerHTML).trim();

  const expected = readFileSync(path.join(repoRoot, 'mocks/Sample.md'), 'utf8').trim();

  return { chatOutput, gemOutput, expected };
};

run().then(({ chatOutput, gemOutput, expected }) => {
  console.log('--- ChatGPT ---');
  console.log(chatOutput);
  console.log('\n--- Gemini ---');
  console.log(gemOutput);
  console.log('\n--- Expected ---');
  console.log(expected);
});
