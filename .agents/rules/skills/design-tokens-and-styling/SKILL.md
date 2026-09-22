---
name: design-tokens-and-styling
description: >-
  Parse, convert, and manage design tokens (design-tokens.tokens.json) into CSS custom properties.
  Enforce the architectural distinction between Primitive Colors (foundations) and Color Roles (UI semantic tokens),
  and handle light and dark mode CSS generation.
  Use when updating design system tokens, compiling tokens.css, or styling client UI components.
---

# Design Tokens & CSS Styling Workflow

This skill guides the agent in working with the design token system, generating CSS variables, and applying them correctly across UI components.

---

## 1. Two-Tier Color System Rules

1. **🛑 Primitive Colors (`--color-primitive-*`):**
   - Raw color palettes (0–100) and key seed colors.
   - **NEVER use directly in UI component styles.**

2. **✅ Color Roles (`--color-*`):**
   - Semantic tokens (`--color-primary`, `--color-surface-color`, `--color-on-surface`, `--color-primary-container`, etc.).
   - **ALWAYS use these in UI component styling.**
   - Automatically adapt to active theme (`[data-theme="light"]` vs `[data-theme="dark"]`).

---

## 2. Compiling Tokens to CSS Variables

To regenerate the CSS variables after updating `design-tokens.tokens.json`:

```bash
# Run the token converter script
npm run build:tokens

# Or convert spacing values to rem
npm run build:tokens:rem
```

---

## 3. Applying Tokens in Components

### Button Example
```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-base);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--spacing-xs);
  font: var(--typography-label-large);
  box-shadow: var(--shadow-soft);
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.92;
  box-shadow: var(--shadow-medium);
}
```

### Card Component Example
```css
.restaurant-card {
  background-color: var(--color-surface-container);
  color: var(--color-on-surface);
  border: 1px solid var(--color-surface-variant);
  border-radius: var(--spacing-sm);
  padding: var(--spacing-base);
  box-shadow: var(--shadow-soft);
}

.restaurant-card__title {
  font-family: var(--typography-title-large-font-family);
  font-size: var(--typography-title-large-font-size);
  font-weight: var(--typography-title-large-font-weight);
  color: var(--color-on-surface);
}
```
