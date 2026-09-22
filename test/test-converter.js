/**
 * ============================================================================
 * UNIT & INTEGRATION TESTS FOR DESIGN TOKENS CONVERTER
 * ============================================================================
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { convertDesignTokens, normalizeColor, normalizeShadeKey, slugify, TokenRegistry } from '../convert-tokens.js';

console.log('🧪 Running Test Suite for Design Tokens Converter...\n');

// 1. Test Utility Helpers
console.log('▶ Testing utility helpers...');
assert.strictEqual(slugify('primary color palette'), 'primary-color-palette');
assert.strictEqual(slugify('neutral variant key color'), 'neutral-variant-key-color');
assert.strictEqual(slugify('display large'), 'display-large');
assert.strictEqual(normalizeShadeKey('primary80'), 'primary-80');
assert.strictEqual(normalizeShadeKey('neutralvariant50'), 'neutral-variant-50');
assert.strictEqual(normalizeShadeKey('neutral0 100'), 'neutral-100');
assert.strictEqual(normalizeColor('#000000ff'), '#000000');
assert.strictEqual(normalizeColor('#e76305ff'), '#e76305');
assert.strictEqual(normalizeColor('#00000052'), '#00000052');
console.log('  ✔ Slugify, normalizeShadeKey, and normalizeColor passed.');

// 2. Test Full Conversion
console.log('▶ Testing token conversion from JSON file...');
const result = convertDesignTokens('./design-tokens.tokens.json');

// Assert CSS string generation
assert(result.css.length > 0, 'CSS output should not be empty');
assert(result.utilitiesCss.length > 0, 'Utilities CSS output should not be empty');

// Assert Primitives
const primitiveNames = result.parsedData.primitives.map(p => p.name);
assert(primitiveNames.includes('--color-primitive-key-primary'), 'Must include primary key color');
assert(primitiveNames.includes('--color-primitive-primary-80'), 'Must include primary-80');
assert(primitiveNames.includes('--color-primitive-neutral-10'), 'Must include neutral-10');
assert(primitiveNames.includes('--color-primitive-error-50'), 'Must include error-50');
console.log(`  ✔ Verified ${result.parsedData.primitives.length} Primitive Color Tokens.`);

// Assert Spacing
const spacingNames = result.parsedData.spacing.map(s => s.name);
assert(spacingNames.includes('--spacing-base'), 'Must include --spacing-base');
assert(spacingNames.includes('--spacing-xs'), 'Must include --spacing-xs');
console.log(`  ✔ Verified ${result.parsedData.spacing.length} Spacing Tokens.`);

// Assert Shadows
const shadowNames = result.parsedData.effects.map(e => e.name);
assert(shadowNames.includes('--shadow-hard'), 'Must include --shadow-hard');
assert(shadowNames.includes('--shadow-medium'), 'Must include --shadow-medium');
assert(shadowNames.includes('--shadow-soft'), 'Must include --shadow-soft');
console.log(`  ✔ Verified ${result.parsedData.effects.length} Shadow Tokens.`);

// Assert Typography
const typographyNames = result.parsedData.typography.map(t => t.name);
assert(typographyNames.includes('--typography-display-large'), 'Must include composite --typography-display-large');
assert(typographyNames.includes('--typography-display-large-font-size'), 'Must include font-size property');
assert(typographyNames.includes('--typography-body-large-line-height'), 'Must include line-height property');
console.log(`  ✔ Verified ${result.parsedData.typography.length} Typography Tokens.`);

// Assert Color Roles & Alias Resolution
const lightRoleNames = result.parsedData.lightRoles.map(r => r.name);
assert(lightRoleNames.includes('--color-primary'), 'Must include --color-primary in light roles');
assert(lightRoleNames.includes('--color-surface-color'), 'Must include --color-surface-color in light roles');
assert(lightRoleNames.includes('--color-on-primary'), 'Must include --color-on-primary in light roles');

// Check that light primary references key color
const lightPrimary = result.parsedData.lightRoles.find(r => r.name === '--color-primary');
assert.strictEqual(lightPrimary.value, 'var(--color-primitive-key-primary)');

// Check that dark primary references primary80
const darkPrimary = result.parsedData.darkRoles.find(r => r.name === '--color-primary');
assert.strictEqual(darkPrimary.value, 'var(--color-primitive-primary-80)');

console.log('  ✔ Verified Light & Dark Semantic Color Roles and Alias Referencing.');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
