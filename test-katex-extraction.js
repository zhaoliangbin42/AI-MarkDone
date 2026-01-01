#!/usr/bin/env node
/**
 * 独立测试脚本:调试GeminiAdapter KaTeX提取问题
 * 
 * 目标:复现插件中的GeminiAdapter逻辑,找出为什么触发fallback
 * 测试文件: mocks/Gemini-Katex-error.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== 复现GeminiAdapter的验证逻辑 ==========

function validateLatex(latex) {
    if (!latex || latex.trim().length === 0) return false;
    if (latex.length > 50000) {
        console.warn(`LaTeX too long (${latex.length} chars)`);
        return false;
    }
    if (latex.includes('<script>') || latex.includes('javascript:') ||
        latex.includes('onerror=') || latex.includes('onload=')) {
        console.error('XSS attempt detected');
        return false;
    }
    return true;
}

function isBlockMath(mathNode) {
    if (mathNode.classList.contains('math-block')) return true;
    if (mathNode.classList.contains('katex-display')) return true;
    if (mathNode.querySelector('.katex-display')) return true;
    return false;
}

// ========== 复现提取策略 ==========

function extractFromDataMath(mathNode) {
    const dataMath = mathNode.getAttribute('data-math');

    if (dataMath && validateLatex(dataMath)) {
        return {
            latex: dataMath,
            isBlock: isBlockMath(mathNode),
        };
    }
    return null;
}

function extractFromKatexHtml(mathNode) {
    const katexHtml = mathNode.querySelector('.katex-html');

    if (katexHtml) {
        const textContent = katexHtml.textContent?.trim();

        if (textContent && validateLatex(textContent)) {
            console.warn('[FALLBACK] ⚠️ Extracted from .katex-html (data-math missing)');
            console.warn('  mathNode.className:', mathNode.className);
            console.warn('  hasAttribute(data-math):', mathNode.hasAttribute('data-math'));
            console.warn('  textContent length:', textContent.length);
            console.warn('  outerHTML:', mathNode.outerHTML.substring(0, 200));

            return {
                latex: textContent,
                isBlock: isBlockMath(mathNode),
            };
        }
    }

    return null;
}

function extractLatex(mathNode, index) {
    // Strategy 1
    const result1 = extractFromDataMath(mathNode);
    if (result1) return result1;

    // Strategy 2
    const result2 = extractFromKatexHtml(mathNode);
    if (result2) return result2;

    // Strategy 3: Fallback
    console.warn(`[Node ${index}] All strategies failed`);
    return {
        latex: mathNode.outerHTML,
        isBlock: isBlockMath(mathNode),
    };
}

// ========== 主测试逻辑 ==========

function runTest() {
    const htmlPath = path.join(__dirname, 'mocks', 'Gemini-Katex-error.html');

    console.log('📄 Loading test file:', htmlPath);
    const html = fs.readFileSync(htmlPath, 'utf-8');

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 复现selectMathNodes逻辑
    console.log('\n📌 Selecting math nodes...');
    const mathInline = Array.from(document.querySelectorAll('.math-inline[data-math]'));
    const mathBlock = Array.from(document.querySelectorAll('.math-block[data-math]'));
    const katexNodes = Array.from(document.querySelectorAll('.katex:not(.math-inline .katex):not(.math-block .katex)'));
    const katexDisplayNodes = Array.from(document.querySelectorAll('.katex-display:not(.math-block .katex-display)'));

    const allMathNodes = [...mathInline, ...mathBlock, ...katexNodes, ...katexDisplayNodes];

    console.log(`\n✅ Found ${allMathNodes.length} math nodes:`);
    console.log(`  - .math-inline[data-math]: ${mathInline.length}`);
    console.log(`  - .math-block[data-math]: ${mathBlock.length}`);
    console.log(`  - .katex (standalone): ${katexNodes.length}`);
    console.log(`  - .katex-display (standalone): ${katexDisplayNodes.length}`);

    // 测试每个math node
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Testing extraction...\n');

    let fallbackCount = 0;
    const fallbackExamples = [];

    allMathNodes.forEach((node, index) => {
        const result = extractLatex(node, index + 1);

        // 检查是否走了fallback
        if (result && !node.getAttribute('data-math')) {
            if (node.querySelector('.katex-html')) {
                fallbackCount++;
                if (fallbackExamples.length < 3) {
                    fallbackExamples.push({
                        index: index + 1,
                        className: node.className,
                        outerHTML: node.outerHTML.substring(0, 200),
                    });
                }
            }
        }
    });

    // 总结
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total math nodes: ${allMathNodes.length}`);
    console.log(`✅ With data-math: ${mathInline.length + mathBlock.length}`);
    console.log(`⚠️ Fallback triggered: ${fallbackCount} times`);
    console.log(`  (${(fallbackCount / allMathNodes.length * 100).toFixed(1)}% of total)`);

    if (fallbackExamples.length > 0) {
        console.log('\n⚠️ EXAMPLE FALLBACK NODES:');
        fallbackExamples.forEach(node => {
            console.log(`\n[Node ${node.index}]`);
            console.log('  className:', node.className);
            console.log('  outerHTML:', node.outerHTML);
        });
    }
}

// 运行测试
try {
    runTest();
} catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
}
