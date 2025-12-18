// Test DesignTokenManager output
import { DesignTokenManager } from './src/utils/design-token-manager';

console.log('=== Testing DesignTokenManager ===\n');

const output = DesignTokenManager.generateCategorizedInjectionCSS();

console.log('Output length:', output.length);
console.log('\nFirst 500 characters:');
console.log(output.substring(0, 500));
console.log('\n...\n');
console.log('Last 200 characters:');
console.log(output.substring(output.length - 200));
