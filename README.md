# 🎨 Design Tokens to CSS Variables Converter

A high-performance, zero-dependency JavaScript converter that transforms W3C / Figma Design Tokens ([`design-tokens.tokens.json`](./design-tokens.tokens.json)) into clean, standardized, production-ready CSS Custom Properties (Variables).

---

## 🏛️ Color System Architecture: Primitives vs. Color Roles

This design system is built upon a strict **two-tier color token hierarchy** inspired by modern design system architectures (such as Material Design 3 and W3C Design Tokens Community Group):

```
┌────────────────────────────────────────────────────────┐
│             1. FOUNDATIONS / PRIMITIVES                │
│    (Raw palettes 0–100, seed keys: #e76305, etc.)      │
│  ⚠️ NEVER USE DIRECTLY IN UI COMPONENT STYLES ⚠️       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ Aliased & Mapped
                           ▼
┌────────────────────────────────────────────────────────┐
│             2. COLOR ROLES (SEMANTIC TOKENS)           │
│  (Intent-based: --color-primary, --color-surface, etc.)│
│   APPLY THESE DIRECTLY TO UI COMPONENTS                │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [data-theme="light"]        [data-theme="dark"]
   Primary  -> Key Seed        Primary  -> Primary-80
   Surface  -> Neutral-98      Surface  -> Neutral-10
   OnSurface-> Neutral-10      OnSurface-> Neutral-90
```

### 1. 🛑 Primitive Colors (`--color-primitive-*`)
- **What they are**: Raw color palette values ranging from `0` (darkest/black) to `100` (lightest/white), plus key seed colors (`primary`, `secondary`, `tertiary`, `neutral`, `neutral-variant`, `error`).
- **Purpose**: Serve as the system's foundational palette and single source of truth.
- **Rule**: **DO NOT apply primitive colors directly to UI components.** If a developer uses `--color-primitive-primary-50` directly on a card or button, the UI will break when switching between Light and Dark themes.

### 2. ✅ Color Roles (`--color-*`)
- **What they are**: Semantic, contextual tokens describing *how* and *where* a color is used on the UI (e.g., `--color-primary`, `--color-on-primary`, `--color-surface-color`, `--color-on-surface`, `--color-surface-container`).
- **Purpose**: Create meaningful visual hierarchy, accessibility contrasts, and dynamic theming.
- **Rule**: **ALWAYS use Color Roles when styling buttons, text, cards, backgrounds, and borders.** Color roles automatically switch their underlying primitive references depending on whether the user is in Light or Dark mode.

---

## 🚀 Getting Started & Usage

### 1. Run via CLI

Convert the tokens with a single command:

```bash
# Build unified tokens.css and modular dist/ files
node convert-tokens.js

# Or with npm script
npm run build:tokens
```

#### CLI Options & Flags
| Flag | Short | Default | Description |
|---|---|---|---|
| `--input` | `-i` | `./design-tokens.tokens.json` | Path to source design tokens JSON |
| `--output` | `-o` | `./tokens.css` | Path for generated unified CSS file |
| `--outdir` | `-d` | `./dist` | Directory for modular CSS token files |
| `--rem` | | `false` | Convert spacing values to `rem` units (base 16px) |
| `--alias-mode`| | `css-var` | `css-var` (`var(...)`), `value` (raw hex), or `both` |
| `--help` | `-h` | | Display CLI help menu |

**Examples:**
```bash
# Custom input and output locations:
node convert-tokens.js -i ./my-tokens.json -o ./styles/theme.css

# Spacing in rem units:
node convert-tokens.js --rem
```

---

### 2. Programmatic JavaScript / Node.js API

You can import and execute the converter directly inside your Node.js build pipelines (e.g., Vite, Webpack, Next.js, Rollup):

```javascript
import { convertDesignTokens } from './convert-tokens.js';

const result = convertDesignTokens('./design-tokens.tokens.json', {
  useRemSpacing: true,
  aliasMode: 'css-var',
});

// Access the compiled CSS string
console.log(result.css);

// Access ready-to-use utility classes
console.log(result.utilitiesCss);

// Access parsed token data structured by category
console.log(result.parsedData.lightRoles);
console.log(result.parsedData.darkRoles);
```

---

## 📂 Output File Structure

When you run the script, the following files are produced:

```
├── tokens.css                  # Unified CSS file with all tokens & themes
└── dist/
    ├── tokens.primitives.css   # Primitive palette foundations
    ├── tokens.semantic.css     # Semantic light & dark color roles
    ├── tokens.spacing.css      # Spacing scales (none, xs, sm, md, base, lg, xl, 2xl)
    ├── tokens.typography.css   # Typography scales & composite shorthands
    ├── tokens.effects.css      # Box-shadow & elevation effects
    └── tokens.utilities.css    # Pre-built utility classes (.text-headline-large, etc.)
```

---

## 🌓 Dark Mode & Theming Guide

The generated CSS supports both **explicit theme toggling** and **system preferences** out of the box:

### 1. HTML Attribute / Class Toggle (Recommended)

Add `data-theme="dark"` or `class="dark"` to your `<html>` or `<body>` element:

```html
<!-- Light Theme -->
<html data-theme="light">
  <body>...</body>
</html>

<!-- Dark Theme -->
<html data-theme="dark">
  <body>...</body>
</html>
```

### 2. Toggle via JavaScript

```javascript
function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
}

// Example: Switch to dark mode
setTheme('dark');
```

### 3. Automatic OS Preference Fallback

If no explicit `data-theme` attribute is set, the CSS automatically applies the dark theme when the user's operating system is set to dark mode using:
```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-primary: var(--color-primitive-primary-80);
    --color-surface-color: var(--color-primitive-neutral-10);
    /* ... */
  }
}
```

---

## 📋 Token Categories & Naming Conventions

### 1. Color Roles (UI Tokens)
| Token Variable | Description | Light Value | Dark Value |
|---|---|---|---|
| `--color-primary` | High-emphasis UI elements & primary actions | `key-primary` | `primary-80` |
| `--color-on-primary` | Text/icons on top of primary color | `primary-100` (`#fff`) | `primary-20` |
| `--color-primary-container` | Lower-emphasis container surfaces | `primary-90` | `primary-30` |
| `--color-on-primary-container`| Text/icons on primary container | `primary-30` | `primary-90` |
| `--color-secondary` | Secondary brand / UI actions | `key-secondary` | `secondary-80` |
| `--color-tertiary` | Accents and complementary highlights | `key-tertiary` | `tertiary-80` |
| `--color-error` | Validation errors and destructive actions | `key-error` | `error-80` |
| `--color-surface-color` | Base page/screen background | `neutral-98` | `neutral-10` |
| `--color-on-surface` | Primary body text on surface | `neutral-10` | `neutral-90` |
| `--color-surface-variant` | Component cards, chips, input backgrounds | `neutral-variant-90` | `neutral-variant-30` |
| `--color-on-surface-variant` | Subtle secondary text | `neutral-variant-30` | `neutral-variant-80` |
| `--color-surface-container-*`| Layered elevation surfaces (lowest -> highest)| `neutral-100` -> `neutral-90` | `neutral-10` -> `neutral-30` |

### 2. Spacing Scale
| Token Variable | Value | Description |
|---|---|---|
| `--spacing-none` | `0px` | No spacing |
| `--spacing-xs` | `4px` | Extra Small Spacing |
| `--spacing-sm` | `8px` | Small Spacing |
| `--spacing-md` | `12px` | Medium Spacing |
| `--spacing-base` | `16px` | Base Spacing |
| `--spacing-lg` | `20px` | Large Spacing |
| `--spacing-xl` | `24px` | Extra Large Spacing |
| `--spacing-2xl` | `32px` | Very Large Spacing |

### 3. Shadows & Elevation
| Token Variable | CSS Value |
|---|---|
| `--shadow-soft` | `2px 2px 20px 0px #0000001f` |
| `--shadow-medium` | `2px 4px 6px 0px #00000047` |
| `--shadow-hard` | `4px 6px 8px 0px #00000052` |

### 4. Typography System
Each typography token provides both a **composite shorthand** and **granular variables**:
- **Display**: `display-large` (64px), `display-medium` (50px), `display-small` (40px)
- **Headline**: `headline-large` (32px), `headline-medium` (28px), `headline-small` (24px)
- **Title**: `title-large` (22px), `title-medium` (16px), `title-small` (14px)
- **Body**: `body-large` (16px), `body-medium` (14px), `body-small` (12px)
- **Label**: `label-large` (14px), `label-medium` (12px), `label-small` (11px)

**Usage Example:**
```css
/* Using Granular Sub-properties */
.card-heading {
  font-family: var(--typography-headline-medium-font-family);
  font-size: var(--typography-headline-medium-font-size);
  font-weight: var(--typography-headline-medium-font-weight);
  line-height: var(--typography-headline-medium-line-height);
  letter-spacing: var(--typography-headline-medium-letter-spacing);
}

/* Or using Composite Shorthand */
.card-heading-shorthand {
  font: var(--typography-headline-medium);
}
```

---

## 💻 UI Component Examples

### 1. Button Component
```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-base);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--spacing-xs);
  font-size: var(--typography-label-large-font-size);
  font-weight: var(--typography-label-large-font-weight);
  box-shadow: var(--shadow-soft);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;
}

.btn-primary:hover {
  opacity: 0.92;
  box-shadow: var(--shadow-medium);
}
```

### 2. Card Container
```css
.card {
  background-color: var(--color-surface-container);
  color: var(--color-on-surface);
  border: 1px solid var(--color-surface-variant);
  border-radius: var(--spacing-sm);
  padding: var(--spacing-base);
  box-shadow: var(--shadow-soft);
}

.card__title {
  font-size: var(--typography-title-large-font-size);
  font-weight: var(--typography-title-large-font-weight);
  color: var(--color-on-surface);
  margin-bottom: var(--spacing-xs);
}

.card__description {
  font-size: var(--typography-body-medium-font-size);
  color: var(--color-on-surface-variant);
}
```

---

## 🧪 Testing

Run the automated test suite to verify token parsing, alias resolution, and CSS outputs:

```bash
npm test
```
