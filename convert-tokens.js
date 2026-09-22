/**
 * ============================================================================
 * DESIGN TOKENS TO CSS VARIABLES CONVERTER
 * ============================================================================
 *
 * @description
 * Parses W3C / Figma Design Tokens JSON and compiles them into standard,
 * production-ready CSS custom properties (variables) with full support for:
 *   - Primitive Palette Foundations (Raw, non-UI tokens)
 *   - Semantic Color Roles (Light & Dark mode themes)
 *   - Typography Systems (Individual properties & composite shorthands)
 *   - Spacing Scales (Standard px & rem scales)
 *   - Shadow & Elevation Effects (W3C custom-shadow to CSS box-shadow)
 *   - Flexible Token Alias Resolution ({path.to.token} -> var(--...))
 *
 * @version 1.0.0
 * @license MIT
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ============================================================================
// CONFIGURATION & DEFAULT OPTIONS
// ============================================================================

/**
 * Default conversion options
 */
export const DEFAULT_OPTIONS = {
  // Input and output paths
  inputFile: './design-tokens.tokens.json',
  outputDir: './dist',
  outputFile: './tokens.css',

  // Variable prefixing
  prefix: '', // Global prefix (e.g. 'sys-' or empty)
  useRemSpacing: false, // Output rem alongside px for spacing
  remBase: 16, // Base font-size for rem calculation (16px)

  // Alias Resolution Strategy:
  // 'css-var': references are compiled to var(--color-primitive-...)
  // 'value': references are resolved to raw hex values
  // 'both': generates both css-var references with fallback values
  aliasMode: 'css-var',

  // Theming output strategy:
  // 'all': Generates :root (light), [data-theme="light"], [data-theme="dark"], and @media (prefers-color-scheme: dark)
  // 'data-theme': Only [data-theme="light"] and [data-theme="dark"]
  // 'media-query': :root and @media (prefers-color-scheme: dark)
  themeStrategy: 'all',

  // Split into modular files (tokens.primitives.css, tokens.semantic.css, tokens.typography.css, etc.)
  generateModularFiles: true,

  // Indentation
  indent: '  ',
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Converts any arbitrary token path or name to a clean, standardized kebab-case slug.
 * Handles spaces, underscores, camelCase, numbers, and multiple delimiters.
 *
 * @param {string} str - Raw token string
 * @returns {string} Standardized kebab-case string
 *
 * @example
 * slugify('primary color palette') => 'primary'
 * slugify('neutral variant key color') => 'neutral-variant'
 * slugify('neutral0 100') => 'neutral-100'
 */
export function slugify(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
    .replace(/[_\s/.]+/g, '-') // spaces, dots, slashes, underscores to hyphens
    .replace(/[^a-zA-Z0-9-]/g, '') // strip any invalid characters
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-|-$/g, '') // trim leading and trailing hyphens
    .toLowerCase();
}

/**
 * Normalizes token shade keys like "primary0", "primary10", "neutral0 100", "neutralvariant50"
 * into a clean name like "primary-0", "neutral-100", "neutral-variant-50".
 *
 * @param {string} key - The token key name
 * @returns {string} Clean shade identifier
 */
export function normalizeShadeKey(key) {
  let cleaned = key.trim().toLowerCase();

  // Special fix for Figma export artifact "neutral0 100" -> "neutral100"
  if (cleaned.includes('0 100')) {
    cleaned = cleaned.replace('0 100', '100');
  }

  // Handle "neutralvariant" -> "neutral-variant"
  cleaned = cleaned.replace(/^neutralvariant/, 'neutral-variant-');

  // Insert hyphen before numbers: e.g. "primary80" -> "primary-80", "error0" -> "error-0"
  cleaned = cleaned.replace(/([a-zA-Z])(\d+)/, '$1-$2');

  return slugify(cleaned);
}

/**
 * Normalizes hex color strings (e.g. 8-digit hex with alpha #rrggbbaa -> standard #rrggbb if aa is ff).
 *
 * @param {string} hex - Hex color string
 * @returns {string} Formatted hex string
 */
export function normalizeColor(hex) {
  if (!hex || typeof hex !== 'string') return hex;
  const trimmed = hex.trim();

  // If 8-character hex ending with 'ff' (100% opacity), trim down to 6-character hex for cleanliness
  if (/^#([0-9a-fA-F]{6})ff$/i.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }

  return trimmed.toLowerCase();
}

/**
 * Converts a px number to rem string.
 *
 * @param {number} px - Pixel value
 * @param {number} base - Root pixel base (default: 16)
 * @returns {string} Rem representation
 */
export function pxToRem(px, base = 16) {
  if (px === 0) return '0';
  const rem = px / base;
  return `${Number(rem.toFixed(4))}rem`;
}

// ============================================================================
// TOKEN PARSERS & TOKEN REGISTRY
// ============================================================================

/**
 * TokenRegistry stores parsed tokens, maps their original path references
 * to CSS variable names, and provides fast alias resolution.
 */
export class TokenRegistry {
  constructor() {
    /** @type {Map<string, { varName: string, rawValue: any, cssValue: string, category: string, description?: string }>} */
    this.tokens = new Map();
  }

  /**
   * Registers a token with its dot-notation reference path, generated CSS variable name, and values.
   *
   * @param {string} tokenPath - e.g. "primitives colors.primary color palette.primary80"
   * @param {string} varName - e.g. "--color-primitive-primary-80"
   * @param {any} rawValue - Raw token value from JSON
   * @param {string} cssValue - Prepared CSS representation
   * @param {string} category - "primitive-color", "semantic-color", "spacing", "typography", "shadow"
   * @param {string} [description] - Optional documentation string
   */
  register(tokenPath, varName, rawValue, cssValue, category, description = '') {
    this.tokens.set(tokenPath, {
      varName,
      rawValue,
      cssValue,
      category,
      description,
    });
  }

  /**
   * Finds a registered token by path. Supports fuzzy matching if keys contain slight formatting differences.
   *
   * @param {string} pathStr - Token reference path
   * @returns {object|undefined}
   */
  get(pathStr) {
    if (this.tokens.has(pathStr)) {
      return this.tokens.get(pathStr);
    }

    // Try normalized match
    const normalizedTarget = pathStr.toLowerCase().replace(/[\s._-]+/g, '');
    for (const [key, token] of this.tokens.entries()) {
      const normalizedKey = key.toLowerCase().replace(/[\s._-]+/g, '');
      if (normalizedKey === normalizedTarget) {
        return token;
      }
    }
    return undefined;
  }

  /**
   * Resolves token reference strings like "{primitives colors.primary color palette.primary80}"
   * into a CSS value or CSS variable reference.
   *
   * @param {string} valueStr - Token value that may contain a reference
   * @param {'css-var'|'value'|'both'} mode - Resolution mode
   * @returns {string} Resolved CSS string
   */
  resolveReference(valueStr, mode = 'css-var') {
    if (typeof valueStr !== 'string') return String(valueStr);

    const match = valueStr.match(/^\{([^}]+)\}$/);
    if (!match) return valueStr;

    const refPath = match[1].trim();
    const targetToken = this.get(refPath);

    if (!targetToken) {
      console.warn(`[Token Warning] Could not resolve token alias: "${refPath}"`);
      return valueStr; // fallback to unresolved
    }

    if (mode === 'value') {
      return targetToken.cssValue;
    }

    if (mode === 'both') {
      return `var(${targetToken.varName}, ${targetToken.cssValue})`;
    }

    // Default: 'css-var'
    return `var(${targetToken.varName})`;
  }
}

// ============================================================================
// TOKEN PROCESSORS
// ============================================================================

/**
 * Processes Primitive Color tokens.
 *
 * Primitive colors are foundations (Key Colors and Palettes 0-100) and represent
 * the absolute color scales. THEY ARE NOT TO BE APPLIED DIRECTLY TO UI ELEMENTS.
 *
 * @param {object} primitivesObj - Raw "primitives colors" section from JSON
 * @param {TokenRegistry} registry - Token registry for alias tracking
 * @param {object} options - Generation options
 * @returns {Array<{ name: string, value: string, comment?: string, group: string }>}
 */
export function processPrimitiveColors(primitivesObj, registry, options) {
  const result = [];
  if (!primitivesObj || typeof primitivesObj !== 'object') return result;

  // 1. Process Key Color Group (Base seeds of the design system)
  if (primitivesObj['key color group']) {
    const keyColors = primitivesObj['key color group'];
    for (const [keyName, token] of Object.entries(keyColors)) {
      if (!token || typeof token !== 'object') continue;

      const rawVal = token.value;
      const normalizedVal = normalizeColor(rawVal);
      // Clean name: "primary key color" -> "key-primary"
      const cleanKey = keyName.replace(/key color/i, '').trim();
      const varName = `--color-primitive-key-${slugify(cleanKey)}`;

      const tokenPath = `primitives colors.key color group.${keyName}`;
      registry.register(tokenPath, varName, rawVal, normalizedVal, 'primitive-color', token.description || '');

      result.push({
        name: varName,
        value: normalizedVal,
        group: 'Key Colors (Palette Seeds)',
        comment: `Seed anchor for ${cleanKey} color range`,
      });
    }
  }

  // 2. Process Palette Ranges (primary, secondary, tertiary, neutral, neutral variant, error)
  const paletteKeys = [
    'primary color palette',
    'secondary color palette',
    'tertiary color palette',
    'neutral color palette',
    'neutral variant color palette',
    'error color palette',
  ];

  for (const paletteKey of paletteKeys) {
    if (!primitivesObj[paletteKey]) continue;

    const palette = primitivesObj[paletteKey];
    // Clean group label: "primary color palette" -> "Primary Palette"
    const groupName = paletteKey
      .replace('color palette', 'Palette')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    for (const [shadeKey, token] of Object.entries(palette)) {
      if (!token || typeof token !== 'object') continue;

      const rawVal = token.value;
      const normalizedVal = normalizeColor(rawVal);
      const cleanShade = normalizeShadeKey(shadeKey);
      const varName = `--color-primitive-${cleanShade}`;

      const tokenPath = `primitives colors.${paletteKey}.${shadeKey}`;
      registry.register(tokenPath, varName, rawVal, normalizedVal, 'primitive-color', token.description || '');

      result.push({
        name: varName,
        value: normalizedVal,
        group: groupName,
      });
    }
  }

  return result;
}

/**
 * Processes Semantic Color Roles (Light or Dark).
 *
 * Color roles represent intent and context on the UI (e.g., surface, on-surface, primary, on-primary).
 * THESE ARE THE TOKENS THAT MUST BE APPLIED DIRECTLY TO UI COMPONENTS.
 *
 * @param {object} rolesObj - Raw "color roles" or "color roles dark" section
 * @param {TokenRegistry} registry - Token registry
 * @param {object} options - Options
 * @param {string} themeName - "light" or "dark"
 * @returns {Array<{ name: string, value: string, resolvedValue: string, comment?: string }>}
 */
export function processColorRoles(rolesObj, registry, options, themeName = 'light') {
  const result = [];
  if (!rolesObj || typeof rolesObj !== 'object') return result;

  for (const [roleName, token] of Object.entries(rolesObj)) {
    if (!token || typeof token !== 'object') continue;

    const rawVal = token.value;
    const cleanRole = slugify(roleName);
    const varName = `--color-${cleanRole}`;

    // Resolve reference
    const cssValue = registry.resolveReference(rawVal, options.aliasMode);
    const resolvedRawValue = registry.resolveReference(rawVal, 'value');

    const tokenPath = `color roles${themeName === 'dark' ? ' dark' : ''}.${roleName}`;
    registry.register(tokenPath, varName, rawVal, cssValue, 'semantic-color', token.description || '');

    result.push({
      name: varName,
      value: cssValue,
      resolvedValue: resolvedRawValue,
      comment: token.description || `UI role for ${roleName}`,
    });
  }

  return result;
}

/**
 * Processes Spacing Collection tokens.
 *
 * @param {object} spacingObj - Raw "spacing collection" section
 * @param {TokenRegistry} registry - Token registry
 * @param {object} options - Options
 * @returns {Array<{ name: string, value: string, comment?: string }>}
 */
export function processSpacing(spacingObj, registry, options) {
  const result = [];
  if (!spacingObj || typeof spacingObj !== 'object') return result;

  // Semantic naming mapping for standard spacing
  const semanticAliases = {
    'no spacing': 'none',
    'extra small spacing': 'xs',
    'small spacing': 'sm',
    'medium spacing': 'md',
    'base spacing': 'base',
    'large spacing': 'lg',
    'extra large spacing': 'xl',
    'very large spacing': '2xl',
  };

  for (const [keyName, token] of Object.entries(spacingObj)) {
    if (!token || typeof token !== 'object') continue;

    const rawVal = token.value; // number, e.g. 16
    const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
    const pxValue = `${numVal}px`;
    const cleanSlug = slugify(keyName.replace(/spacing/i, '').trim());
    const aliasSlug = semanticAliases[keyName.toLowerCase().trim()];

    const primaryVarName = aliasSlug ? `--spacing-${aliasSlug}` : `--spacing-${cleanSlug}`;
    const tokenPath = `spacing collection.${keyName}`;

    registry.register(tokenPath, primaryVarName, rawVal, pxValue, 'spacing');

    let cssValue = pxValue;
    if (options.useRemSpacing && numVal > 0) {
      cssValue = pxToRem(numVal, options.remBase);
    }

    result.push({
      name: primaryVarName,
      value: cssValue,
      comment: `${numVal}px (${keyName})`,
    });

    // Also provide the full descriptive alias if different
    const descriptiveVarName = `--spacing-${cleanSlug || '0'}`;
    if (descriptiveVarName !== primaryVarName && cleanSlug) {
      result.push({
        name: descriptiveVarName,
        value: `var(${primaryVarName})`,
        comment: `Alias for ${primaryVarName}`,
      });
    }
  }

  return result;
}

/**
 * Processes Shadow / Elevation Effect tokens.
 *
 * @param {object} effectObj - Raw "effect" section
 * @param {TokenRegistry} registry - Token registry
 * @param {object} options - Options
 * @returns {Array<{ name: string, value: string, comment?: string }>}
 */
export function processEffects(effectObj, registry, options) {
  const result = [];
  if (!effectObj || typeof effectObj !== 'object') return result;

  for (const [effectName, token] of Object.entries(effectObj)) {
    if (!token || typeof token !== 'object') continue;

    const val = token.value;
    if (!val || typeof val !== 'object') continue;

    // custom-shadow: { shadowType, radius, color, offsetX, offsetY, spread }
    const offsetX = `${val.offsetX ?? 0}px`;
    const offsetY = `${val.offsetY ?? 0}px`;
    const radius = `${val.radius ?? 0}px`;
    const spread = `${val.spread ?? 0}px`;
    const color = normalizeColor(val.color || '#000000');

    // CSS box-shadow: offsetX offsetY blur-radius spread-radius color
    const shadowCss = `${offsetX} ${offsetY} radius ${spread} ${color}`.replace('radius', radius);
    const cleanSlug = slugify(effectName.replace(/shadow/i, '').trim());
    const varName = `--shadow-${cleanSlug || 'default'}`;

    const tokenPath = `effect.${effectName}`;
    registry.register(tokenPath, varName, val, shadowCss, 'shadow');

    result.push({
      name: varName,
      value: shadowCss,
      comment: effectName,
    });
  }

  return result;
}

/**
 * Processes Typography tokens into both granular and composite CSS variables.
 *
 * @param {object} typographyObj - Raw "typography" section
 * @param {TokenRegistry} registry - Token registry
 * @param {object} options - Options
 * @returns {Array<{ name: string, value: string, comment?: string, isGroupHeader?: boolean }>}
 */
export function processTypography(typographyObj, registry, options) {
  const result = [];
  if (!typographyObj || typeof typographyObj !== 'object') return result;

  for (const [styleName, tokenProps] of Object.entries(typographyObj)) {
    if (!tokenProps || typeof tokenProps !== 'object') continue;

    const styleSlug = slugify(styleName);

    // Extract sub-properties
    const fontSize = tokenProps.fontSize?.value ? `${tokenProps.fontSize.value}px` : '16px';
    const rawFontFamily = tokenProps.fontFamily?.value || 'sans-serif';
    const fontFamily = rawFontFamily.includes(' ') ? `"${rawFontFamily}", sans-serif` : `${rawFontFamily}, sans-serif`;
    const fontWeight = tokenProps.fontWeight?.value ?? 400;
    const fontStyle = tokenProps.fontStyle?.value || 'normal';
    const lineHeight = tokenProps.lineHeight?.value ? `${tokenProps.lineHeight.value}px` : 'normal';
    const letterSpacing = tokenProps.letterSpacing?.value !== undefined ? `${tokenProps.letterSpacing.value}px` : '0px';
    const textDecoration = tokenProps.textDecoration?.value || 'none';
    const textCase = tokenProps.textCase?.value || 'none';

    // 1. Composite font shorthand: font-style font-weight font-size/line-height font-family
    const compositeFont = `${fontStyle === 'normal' ? '' : fontStyle + ' '}${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`.trim();

    const compositeVar = `--typography-${styleSlug}`;
    registry.register(`typography.${styleName}`, compositeVar, tokenProps, compositeFont, 'typography');

    result.push({
      name: compositeVar,
      value: compositeFont,
      comment: `Composite shorthand for ${styleName}`,
      isGroupHeader: true,
    });

    // 2. Granular sub-properties for maximum flexibility
    result.push({
      name: `--typography-${styleSlug}-font-size`,
      value: fontSize,
    });
    result.push({
      name: `--typography-${styleSlug}-line-height`,
      value: lineHeight,
    });
    result.push({
      name: `--typography-${styleSlug}-font-family`,
      value: fontFamily,
    });
    result.push({
      name: `--typography-${styleSlug}-font-weight`,
      value: String(fontWeight),
    });
    result.push({
      name: `--typography-${styleSlug}-letter-spacing`,
      value: letterSpacing,
    });

    if (textDecoration !== 'none') {
      result.push({
        name: `--typography-${styleSlug}-text-decoration`,
        value: textDecoration,
      });
    }

    if (textCase !== 'none') {
      result.push({
        name: `--typography-${styleSlug}-text-transform`,
        value: textCase === 'uppercase' ? 'uppercase' : textCase === 'lowercase' ? 'lowercase' : textCase === 'capitalize' ? 'capitalize' : 'none',
      });
    }
  }

  return result;
}

// ============================================================================
// CSS CODE GENERATOR & FORMATTER
// ============================================================================

/**
 * Formats an array of token declarations into a clean CSS block with comments.
 *
 * @param {Array<{ name: string, value: string, comment?: string, group?: string, isGroupHeader?: boolean }>} items
 * @param {string} indent
 * @returns {string}
 */
export function formatCssDeclarations(items, indent = '  ') {
  let output = '';
  let currentGroup = '';

  for (const item of items) {
    if (item.group && item.group !== currentGroup) {
      currentGroup = item.group;
      output += `\n${indent}/* ── ${currentGroup} ── */\n`;
    } else if (item.isGroupHeader) {
      output += `\n`;
    }

    const comment = item.comment ? ` /* ${item.comment} */` : '';
    output += `${indent}${item.name}: ${item.value};${comment}\n`;
  }

  return output;
}

/**
 * Compiles the entire parsed token data into a comprehensive CSS document.
 *
 * @param {object} parsedData
 * @param {object} options
 * @returns {string} Formatted CSS string
 */
export function generateUnifiedCss(parsedData, options = DEFAULT_OPTIONS) {
  const { indent = '  ' } = options;

  return `/**
 * ============================================================================
 * DESIGN SYSTEM TOKENS - CSS VARIABLES
 * ============================================================================
 * Generated automatically from design-tokens.tokens.json
 * Generation Date: ${new Date().toISOString()}
 *
 * ⚠️ ARCHITECTURAL COLOR USAGE GUIDELINES:
 * 
 * 1. 🛑 PRIMITIVE COLORS (--color-primitive-*):
 *    These are the raw foundational palettes (0-100 scales & seed keys).
 *    DO NOT use primitive colors directly in UI component styles.
 *    They exist strictly as foundations to be referenced by Semantic Color Roles.
 *
 * 2.  COLOR ROLES (--color-*):
 *    These are semantic tokens expressing UI intent (e.g. primary, surface,
 *    on-surface, error, etc.).
 *    ALWAYS use these semantic tokens when styling components.
 *    They automatically adapt across Light and Dark themes.
 * ============================================================================
 */

/* ==========================================================================
   1. FOUNDATIONAL PRIMITIVES (DO NOT APPLY DIRECTLY TO UI)
   ========================================================================== */
:root {
${formatCssDeclarations(parsedData.primitives, indent)}}

/* ==========================================================================
   2. SPACING SCALE
   ========================================================================== */
:root {
${formatCssDeclarations(parsedData.spacing, indent)}}

/* ==========================================================================
   3. ELEVATION & SHADOW EFFECTS
   ========================================================================== */
:root {
${formatCssDeclarations(parsedData.effects, indent)}}

/* ==========================================================================
   4. TYPOGRAPHY SYSTEM
   ========================================================================== */
:root {
${formatCssDeclarations(parsedData.typography, indent)}}

/* ==========================================================================
   5. SEMANTIC COLOR ROLES - LIGHT THEME (DEFAULT)
   ========================================================================== */
:root,
[data-theme="light"] {
${formatCssDeclarations(parsedData.lightRoles, indent)}}

/* ==========================================================================
   6. SEMANTIC COLOR ROLES - DARK THEME
   ========================================================================== */
/* Explicit Dark Theme via data-theme attribute or .dark class */
[data-theme="dark"],
.dark {
${formatCssDeclarations(parsedData.darkRoles, indent)}}

/* Automatic OS Preference Dark Theme fallback */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${formatCssDeclarations(parsedData.darkRoles, indent + indent)}  }
}
`;
}

/**
 * Generates a CSS utility class file with ready-to-use typography and surface classes.
 *
 * @param {object} parsedData
 * @param {object} options
 * @returns {string}
 */
export function generateUtilityCss(parsedData, options = DEFAULT_OPTIONS) {
  let css = `/**
 * ============================================================================
 * DESIGN SYSTEM - UTILITY CLASSES & MIXINS
 * ============================================================================
 * Pre-composed utility classes built upon the design token variables.
 * ============================================================================
 */\n\n`;

  // Typography utilities
  css += `/* ── Typography Utilities ── */\n`;
  const typographyKeys = [
    'display-large', 'display-medium', 'display-small',
    'headline-large', 'headline-medium', 'headline-small',
    'title-large', 'title-medium', 'title-small',
    'body-large', 'body-medium', 'body-small',
    'label-large', 'label-medium', 'label-small'
  ];

  for (const key of typographyKeys) {
    css += `.text-${key} {\n`;
    css += `  font-family: var(--typography-${key}-font-family);\n`;
    css += `  font-size: var(--typography-${key}-font-size);\n`;
    css += `  line-height: var(--typography-${key}-line-height);\n`;
    css += `  font-weight: var(--typography-${key}-font-weight);\n`;
    css += `  letter-spacing: var(--typography-${key}-letter-spacing);\n`;
    css += `}\n\n`;
  }

  // Shadow utilities
  css += `/* ── Shadow Utilities ── */\n`;
  css += `.shadow-soft {\n  box-shadow: var(--shadow-soft);\n}\n\n`;
  css += `.shadow-medium {\n  box-shadow: var(--shadow-medium);\n}\n\n`;
  css += `.shadow-hard {\n  box-shadow: var(--shadow-hard);\n}\n\n`;

  // Color role surface utilities
  css += `/* ── Surface Role Helpers ── */\n`;
  css += `.bg-surface {\n  background-color: var(--color-surface-color);\n  color: var(--color-on-surface);\n}\n\n`;
  css += `.bg-surface-variant {\n  background-color: var(--color-surface-variant);\n  color: var(--color-on-surface-variant);\n}\n\n`;
  css += `.bg-primary {\n  background-color: var(--color-primary);\n  color: var(--color-on-primary);\n}\n\n`;
  css += `.bg-primary-container {\n  background-color: var(--color-primary-container);\n  color: var(--color-on-primary-container);\n}\n\n`;
  css += `.bg-error {\n  background-color: var(--color-error);\n  color: var(--color-on-error);\n}\n`;

  return css;
}

// ============================================================================
// MAIN CONVERSION CONTROLLER & API
// ============================================================================

/**
 * Main function that accepts raw JSON or file path, parses tokens, and outputs generated CSS.
 *
 * @param {string|object} input - File path string or token JSON object
 * @param {object} customOptions - User configuration options
 * @returns {{ css: string, utilitiesCss: string, registry: TokenRegistry, parsedData: object }}
 */
export function convertDesignTokens(input, customOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };

  // 1. Load JSON tokens
  let tokensData;
  if (typeof input === 'string') {
    const rawContent = fs.readFileSync(path.resolve(input), 'utf-8');
    tokensData = JSON.parse(rawContent);
  } else if (typeof input === 'object' && input !== null) {
    tokensData = input;
  } else {
    throw new Error('Invalid input: Expected a file path string or token JSON object');
  }

  const registry = new TokenRegistry();

  // 2. Process token groups in architectural order
  // A. Primitive colors MUST be processed first to populate registry aliases
  const primitives = processPrimitiveColors(tokensData['primitives colors'], registry, options);

  // B. Spacing, Effects, Typography
  const spacing = processSpacing(tokensData['spacing collection'], registry, options);
  const effects = processEffects(tokensData['effect'], registry, options);
  const typography = processTypography(tokensData['typography'], registry, options);

  // C. Semantic Color Roles (Light & Dark)
  const lightRoles = processColorRoles(tokensData['color roles'], registry, options, 'light');
  const darkRoles = processColorRoles(tokensData['color roles dark'], registry, options, 'dark');

  const parsedData = {
    primitives,
    spacing,
    effects,
    typography,
    lightRoles,
    darkRoles,
  };

  // 3. Generate CSS output strings
  const css = generateUnifiedCss(parsedData, options);
  const utilitiesCss = generateUtilityCss(parsedData, options);

  return {
    css,
    utilitiesCss,
    registry,
    parsedData,
  };
}

/**
 * CLI execution entrypoint
 */
export function runCli() {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_OPTIONS };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      options.inputFile = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputFile = args[++i];
    } else if (arg === '--outdir' || arg === '-d') {
      options.outputDir = args[++i];
    } else if (arg === '--rem') {
      options.useRemSpacing = true;
    } else if (arg === '--alias-mode') {
      options.aliasMode = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  console.log('🎨 [Design Tokens Converter] Starting conversion...');
  console.log(`📖 Input File: ${options.inputFile}`);

  try {
    const startTime = performance.now();
    const result = convertDesignTokens(options.inputFile, options);

    // Ensure output directories exist
    const outputFilePath = path.resolve(options.outputFile);
    const outputDirPath = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    // Write unified tokens.css
    fs.writeFileSync(outputFilePath, result.css, 'utf-8');
    console.log(`✅ Generated Unified CSS: ${outputFilePath}`);

    // If modular files are requested, write individual modular CSS files
    if (options.generateModularFiles) {
      const distDir = path.resolve(options.outputDir);
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      // 1. Primitives only
      const primitivesCss = `/* Design Tokens - Primitive Colors (Foundations) */\n:root {\n${formatCssDeclarations(result.parsedData.primitives, options.indent)}}\n`;
      fs.writeFileSync(path.join(distDir, 'tokens.primitives.css'), primitivesCss, 'utf-8');

      // 2. Semantic roles (Light & Dark)
      const semanticCss = `/* Design Tokens - Semantic Color Roles */\n:root, [data-theme="light"] {\n${formatCssDeclarations(result.parsedData.lightRoles, options.indent)}}\n\n[data-theme="dark"], .dark {\n${formatCssDeclarations(result.parsedData.darkRoles, options.indent)}}\n`;
      fs.writeFileSync(path.join(distDir, 'tokens.semantic.css'), semanticCss, 'utf-8');

      // 3. Spacing
      const spacingCss = `/* Design Tokens - Spacing Scale */\n:root {\n${formatCssDeclarations(result.parsedData.spacing, options.indent)}}\n`;
      fs.writeFileSync(path.join(distDir, 'tokens.spacing.css'), spacingCss, 'utf-8');

      // 4. Typography
      const typographyCss = `/* Design Tokens - Typography */\n:root {\n${formatCssDeclarations(result.parsedData.typography, options.indent)}}\n`;
      fs.writeFileSync(path.join(distDir, 'tokens.typography.css'), typographyCss, 'utf-8');

      // 5. Effects / Shadows
      const effectsCss = `/* Design Tokens - Elevation & Shadows */\n:root {\n${formatCssDeclarations(result.parsedData.effects, options.indent)}}\n`;
      fs.writeFileSync(path.join(distDir, 'tokens.effects.css'), effectsCss, 'utf-8');

      // 6. Utility classes
      fs.writeFileSync(path.join(distDir, 'tokens.utilities.css'), result.utilitiesCss, 'utf-8');

      console.log(`📁 Generated Modular Token Files in: ${distDir}/`);
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✨ Successfully converted design tokens in ${duration}ms!`);

    // Summary report
    console.log(`\n📊 Conversion Summary:`);
    console.log(`   - Primitive Color Tokens : ${result.parsedData.primitives.length}`);
    console.log(`   - Semantic Light Roles   : ${result.parsedData.lightRoles.length}`);
    console.log(`   - Semantic Dark Roles    : ${result.parsedData.darkRoles.length}`);
    console.log(`   - Spacing Tokens         : ${result.parsedData.spacing.length}`);
    console.log(`   - Typography Tokens      : ${result.parsedData.typography.length}`);
    console.log(`   - Shadow / Effect Tokens : ${result.parsedData.effects.length}`);
    console.log(`\n💡 Tip: Check out README.md for design system integration guidelines.`);
  } catch (err) {
    console.error('❌ [Conversion Error]:', err.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Design Tokens to CSS Variables Converter
Usage: node convert-tokens.js [options]

Options:
  -i, --input <file>        Input JSON tokens file (default: ./design-tokens.tokens.json)
  -o, --output <file>       Output unified CSS file (default: ./tokens.css)
  -d, --outdir <dir>        Output directory for modular CSS files (default: ./dist)
  --rem                     Convert spacing px values to rem
  --alias-mode <mode>       Alias resolution: 'css-var' | 'value' | 'both' (default: 'css-var')
  -h, --help                Display this help message
`);
}

// Auto-run when executed directly via CLI
if (process.argv[1] && (process.argv[1].endsWith('convert-tokens.js') || process.argv[1].endsWith('convert-tokens.mjs'))) {
  runCli();
}
