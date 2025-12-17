# AI-Markdone Design System

**Version**: 1.0.0  
**Last Updated**: 2025-12-16  
**Status**: Living Document  
**Owner**: Design Team

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Design Principles](#design-principles)
3. [Brand Identity](#brand-identity)
4. [Visual Foundation](#visual-foundation)
5. [Components](#components)
6. [Patterns](#patterns)
7. [Accessibility](#accessibility)
8. [Implementation](#implementation)
9. [Resources](#resources)

---

## 🎯 Introduction

### About This Design System

The AI-Markdone Design System is a comprehensive collection of reusable components, design tokens, and guidelines that ensure consistency across the entire product. It serves as the single source of truth for designers and developers.

### Goals

1. **Consistency**: Ensure visual and interaction consistency across all features
2. **Efficiency**: Speed up design and development through reusable components
3. **Quality**: Maintain high standards of usability and accessibility
4. **Scalability**: Support future product growth and iterations

### Who Should Use This

- Product Designers
- Frontend Engineers
- Product Managers
- QA Engineers
- Anyone contributing to the product

---

## 💡 Design Principles

Our design philosophy is rooted in modern minimalism, inspired by leading products like Linear, Notion, and Figma.

### 1. Clarity Over Cleverness

**We prioritize clear, straightforward design over decorative elements.**

- Use simple, direct language
- Avoid unnecessary visual flourishes
- Make actions and outcomes predictable
- Present information in digestible chunks

✅ **Do**: Use clear button labels ("Save", "Delete", "Cancel")  
❌ **Don't**: Use vague labels ("OK", "Done", "Submit")

### 2. Consistency Builds Trust

**Every interaction should feel familiar and predictable.**

- Maintain consistent spacing, colors, and typography
- Use established patterns for common actions
- Keep similar elements visually similar
- Document exceptions and explain why

✅ **Do**: Use the same button style for all primary actions  
❌ **Don't**: Create unique button styles for each feature

### 3. Progressive Disclosure

**Show only what's necessary, when it's necessary.**

- Start with essentials, reveal complexity gradually
- Use collapsible sections for advanced options
- Provide contextual help where needed
- Don't overwhelm users with choices

✅ **Do**: Hide advanced filters behind a "More filters" button  
❌ **Don't**: Display all 20 filter options at once

### 4. Speed Matters

**Every interaction should feel instant and effortless.**

- Optimize for 60fps animations
- Provide immediate visual feedback
- Use optimistic UI updates
- Minimize loading states

✅ **Do**: Show button press immediately, then process  
❌ **Don't**: Disable buttons for 2 seconds while processing

### 5. Accessible by Default

**Design for everyone from the start.**

- Ensure sufficient color contrast (WCAG AA minimum)
- Support keyboard navigation fully
- Provide meaningful alt text
- Test with screen readers

---

## 🎨 Brand Identity

### Logo Usage

Our logo represents the enhancement of AI copy experiences. Use it consistently across all touchpoints.

**Clear Space**: Maintain a minimum clear space equal to the height of the logo's icon on all sides.

**Minimum Size**: 
- Digital: 24px height
- Print: 0.5 inches height

**Color Variations**:
- Primary: Full color on light backgrounds
- Reversed: White on dark backgrounds
- Monochrome: When color is not available

### Brand Colors

Our brand uses a purple-to-pink gradient as the primary identifier.

```css
--brand-gradient-start: #ad5389;
--brand-gradient-end: #3c1053;
--brand-gradient: linear-gradient(135deg, #ad5389 0%, #3c1053 100%);
```

**Usage**:
- Accent elements
- Hover states for bookmarked items
- Loading indicators
- Branding moments

---

## 🎨 Visual Foundation

### Color System

#### Neutral Colors

Our neutral palette forms the foundation of the interface.

| Token | Hex | Usage |
|-------|-----|-------|
| `gray-50` | `#F9FAFB` | Backgrounds, subtle dividers |
| `gray-100` | `#F3F4F6` | Hover states, disabled backgrounds |
| `gray-200` | `#E5E7EB` | Borders, dividers |
| `gray-300` | `#D1D5DB` | Inactive borders |
| `gray-400` | `#9CA3AF` | Placeholder text, icons |
| `gray-500` | `#6B7280` | Secondary text, default icons |
| `gray-600` | `#4B5563` | Primary text hover |
| `gray-700` | `#374151` | Headings, emphasized text |
| `gray-800` | `#1F2937` | High contrast backgrounds |
| `gray-900` | `#111827` | Primary text, headings |

**Guidelines**:
- Use `gray-900` for primary text (body copy, headings)
- Use `gray-500` for secondary text (captions, metadata)
- Use `gray-400` for tertiary text (placeholders)
- Use `gray-200` for borders and dividers
- Use `gray-50` or `gray-100` for backgrounds

#### Primary Colors (Blue)

Used for interactive elements and primary actions.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#EFF6FF` | Selected backgrounds |
| `primary-100` | `#DBEAFE` | Hover backgrounds |
| `primary-500` | `#3B82F6` | Primary buttons, links |
| `primary-600` | `#2563EB` | Hover states |
| `primary-700` | `#1D4ED8` | Active states |

#### Semantic Colors

**Success** (Green):
```css
--success-50: #F0FDF4;
--success-500: #22C55E;
--success-600: #16A34A;
```

**Warning** (Amber):
```css
--warning-50: #FFFBEB;
--warning-500: #F59E0B;
--warning-600: #D97706;
```

**Danger** (Red):
```css
--danger-50: #FEF2F2;
--danger-500: #EF4444;
--danger-600: #DC2626;
```

#### Platform Colors

**ChatGPT**:
```css
--chatgpt-light: #D1FAE5;
--chatgpt-dark: #065F46;
--chatgpt-icon: #10A37F;
```

**Gemini**:
```css
--gemini-light: #DBEAFE;
--gemini-dark: #1E40AF;
--gemini-icon: #4285F4;
```

#### Color Contrast

All color combinations must meet WCAG AA standards for accessibility:
- **Normal text**: Minimum contrast ratio of 4.5:1
- **Large text** (18px+ or 14px+ bold): Minimum contrast ratio of 3:1
- **UI components**: Minimum contrast ratio of 3:1

✅ **Do**: `gray-900` text on white background (14.1:1)  
❌ **Don't**: `gray-400` text on white background (2.6:1)

---

### Typography

#### Font Family

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
             "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", 
             "Courier New", monospace;
```

**Rationale**: System fonts provide the best performance, native feel, and consistent rendering across platforms.

#### Type Scale

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px (1.33) | Captions, footnotes, badges |
| `text-sm` | 13px | 18px (1.38) | Secondary text, labels |
| `text-base` | 14px | 20px (1.43) | Body text, default |
| `text-lg` | 16px | 24px (1.5) | Large body text |
| `text-xl` | 18px | 28px (1.56) | Subheadings |
| `text-2xl` | 20px | 28px (1.4) | Section headings |
| `text-3xl` | 24px | 32px (1.33) | Page titles |

#### Font Weight

```css
--font-normal: 400;    /* Body text */
--font-medium: 500;    /* Emphasis, labels */
--font-semibold: 600;  /* Subheadings, buttons */
--font-bold: 700;      /* Headings, strong emphasis */
```

#### Line Height

```css
--leading-tight: 1.25;     /* Headings */
--leading-normal: 1.5;     /* Body text */
--leading-relaxed: 1.75;   /* Long-form content */
```

#### Typography Guidelines

**Headings**:
```css
h1: text-3xl, font-bold, leading-tight
h2: text-2xl, font-semibold, leading-tight
h3: text-xl, font-semibold, leading-normal
```

**Body Text**:
```css
p: text-base, font-normal, leading-normal
small: text-sm, font-normal, leading-normal
```

**UI Text**:
```css
buttons: text-sm, font-medium
labels: text-sm, font-medium
inputs: text-base, font-normal
```

✅ **Do**: Use consistent font sizes from the type scale  
❌ **Don't**: Create custom font sizes (e.g., 15px, 17px)

---

### Spacing System

We use an 8px base grid system for consistent spacing.

#### Spacing Scale

```css
--space-0: 0px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

#### Spacing Guidelines

**Component Internal Spacing**:
- Buttons: `padding: var(--space-2) var(--space-4)` (8px 16px)
- Input fields: `padding: var(--space-3)` (12px)
- Cards: `padding: var(--space-4)` to `var(--space-6)` (16px-24px)

**Element Spacing**:
- Related items: `gap: var(--space-2)` (8px)
- Grouped items: `gap: var(--space-3)` (12px)
- Sections: `gap: var(--space-6)` to `var(--space-8)` (24px-32px)

**Layout Spacing**:
- Section margins: `var(--space-8)` to `var(--space-12)` (32px-48px)
- Page margins: `var(--space-6)` to `var(--space-10)` (24px-40px)

✅ **Do**: Use values from the spacing scale  
❌ **Don't**: Use arbitrary values like 13px or 27px

---

### Border Radius

```css
--radius-none: 0px;
--radius-sm: 6px;      /* Buttons, inputs, small cards */
--radius-md: 8px;      /* Cards, list items */
--radius-lg: 12px;     /* Modals, panels */
--radius-xl: 16px;     /* Large containers */
--radius-full: 9999px; /* Pills, avatars, badges */
```

#### Radius Guidelines

- **Interactive elements** (buttons, inputs): `--radius-sm` (6px)
- **Content containers** (cards, items): `--radius-md` (8px)
- **Elevated surfaces** (modals, panels): `--radius-lg` (12px)
- **Circular elements** (avatars, dot indicators): `--radius-full`

✅ **Do**: Apply consistent radius to all corners of an element  
❌ **Don't**: Mix different radius values on the same element

---

### Shadows

```css
/* Subtle elevation */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Hover states */
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 
             0 1px 2px 0 rgba(0, 0, 0, 0.06);

/* Cards, dropdowns */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
             0 2px 4px -1px rgba(0, 0, 0, 0.06);

/* Modals, popovers */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 
             0 4px 6px -2px rgba(0, 0, 0, 0.05);

/* Main panels */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 
             0 10px 10px -5px rgba(0, 0, 0, 0.04);

/* Maximum elevation */
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

#### Shadow Guidelines

| Elevation | Shadow | Usage |
|-----------|--------|-------|
| Flat | `none` | Default state |
| Raised | `shadow-sm` | Hover states |
| Floating | `shadow-md` | Dropdowns, tooltips |
| Dialog | `shadow-lg` | Modals, popovers |
| Panel | `shadow-xl` | Main panels, sheets |

✅ **Do**: Use shadows to indicate elevation hierarchy  
❌ **Don't**: Use shadows for decoration only

---

### Icons

#### Icon Library

**Primary**: [Lucide Icons](https://lucide.dev/)

**Rationale**:
- Consistent 24x24px grid system
- Stroke-based design matches our aesthetic
- Open source (ISC License)
- Comprehensive set (1000+ icons)
- Well-maintained and documented

#### Icon Sizes

```css
--icon-xs: 14px;  /* Inline with text */
--icon-sm: 16px;  /* Default buttons, list items */
--icon-md: 20px;  /* Large buttons, prominent actions */
--icon-lg: 24px;  /* Headers, feature icons */
--icon-xl: 32px;  /* Large feature highlights */
```

#### Icon Colors

- **Default**: `--gray-500` (secondary)
- **Hover**: `--gray-700` (emphasized)
- **Active**: `--primary-600` (branded)
- **Disabled**: `--gray-300` (muted)
- **Danger**: `--danger-600` (destructive)

#### Icon Guidelines

**Sizing**:
- Use icon sizes from the defined scale
- Match icon size to adjacent text (e.g., 16px icon with 14px text)
- Maintain consistent stroke width (2px for most icons)

**Spacing**:
- Icon + text: `gap: var(--space-2)` (8px)
- Icon buttons: Use padding to create 32px or 36px hit target

**Usage**:
- Use icons to reinforce actions, not replace them
- Provide tooltips for icon-only buttons
- Use consistent icons for the same actions across the product

✅ **Do**: Pair icons with labels for clarity  
❌ **Don't**: Use icons alone without tooltips

---

### Animation & Motion

#### Timing Functions

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

#### Duration

```css
--duration-fast: 150ms;    /* Micro-interactions */
--duration-base: 200ms;    /* Standard transitions */
--duration-slow: 300ms;    /* Complex animations */
--duration-slower: 500ms;  /* Large movements */
```

#### Animation Guidelines

**Principles**:
1. **Purposeful**: Every animation serves a function
2. **Subtle**: Animations should feel natural, not distracting
3. **Performant**: Target 60fps, use GPU-accelerated properties
4. **Respectful**: Honor `prefers-reduced-motion`

**What to Animate**:
- ✅ `opacity`
- ✅ `transform` (translate, scale, rotate)
- ✅ `color`, `background-color`
- ❌ Avoid: `width`, `height`, `left`, `top` (causes layout reflow)

**Common Patterns**:

```css
/* Fade in */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Slide up */
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Scale in */
@keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
```

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## 🧩 Components

### Buttons

Buttons trigger actions and guide users through workflows.

#### Variants

**Primary** - Main call-to-action:
```css
.btn-primary {
    background: var(--primary-600);
    color: white;
    border: none;
    font-weight: var(--font-medium);
}

.btn-primary:hover {
    background: var(--primary-700);
}

.btn-primary:active {
    background: var(--primary-800);
    transform: scale(0.98);
}
```

**Secondary** - Alternative actions:
```css
.btn-secondary {
    background: white;
    color: var(--gray-700);
    border: 1px solid var(--gray-300);
    font-weight: var(--font-medium);
}

.btn-secondary:hover {
    background: var(--gray-50);
    border-color: var(--gray-400);
}
```

**Ghost** - Subtle actions:
```css
.btn-ghost {
    background: transparent;
    color: var(--gray-700);
    border: none;
}

.btn-ghost:hover {
    background: var(--gray-100);
}
```

**Danger** - Destructive actions:
```css
.btn-danger {
    background: var(--danger-600);
    color: white;
    border: none;
}

.btn-danger:hover {
    background: var(--danger-700);
}
```

#### Sizes

```css
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-sm); }
.btn-md { padding: var(--space-2) var(--space-4); font-size: var(--text-base); }
.btn-lg { padding: var(--space-3) var(--space-6); font-size: var(--text-lg); }
```

#### States

- **Default**: Normal appearance
- **Hover**: Darker background, pointer cursor
- **Active**: Slightly scaled down (0.98)
- **Focus**: Blue outline (`outline: 2px solid var(--primary-500)`)
- **Disabled**: 50% opacity, not-allowed cursor

#### Button Guidelines

✅ **Do**:
- Use clear, action-oriented labels ("Save Bookmark", "Delete")
- Limit to one primary button per screen section
- Provide adequate touch target (min 32px height)
- Show loading state for async actions

❌ **Don't**:
- Use vague labels ("OK", "Submit")
- Place destructive actions first
- Stack too many buttons
- Use all-caps text

---

### Form Inputs

#### Text Input

```css
.input {
    padding: var(--space-3);
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius-sm);
    font-size: var(--text-base);
    transition: all var(--duration-fast);
}

.input:hover {
    border-color: var(--gray-300);
}

.input:focus {
    outline: none;
    border-color: var(--primary-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input.error {
    border-color: var(--danger-500);
}

.input:disabled {
    background: var(--gray-50);
    color: var(--gray-400);
    cursor: not-allowed;
}
```

#### Checkbox

Custom checkbox replacing native appearance:

```css
.checkbox {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--gray-300);
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--duration-fast);
    position: relative;
}

.checkbox:hover {
    border-color: var(--primary-500);
}

.checkbox:checked {
    background: var(--primary-600);
    border-color: var(--primary-600);
}

.checkbox:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.checkbox:indeterminate {
    background: var(--primary-100);
    border-color: var(--primary-500);
}

.checkbox:indeterminate::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 6px;
    width: 8px;
    height: 2px;
    background: var(--primary-600);
}
```

#### Select Dropdown

Styled select dropdown:

```css
.select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-sm);
    background: white;
    font-size: var(--text-sm);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,..."); /* Chevron down */
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 32px;
}
```

#### Form Guidelines

✅ **Do**:
- Show field label above input
- Provide helpful placeholder text
- Show validation errors inline
- Allow tab navigation between fields
- Support autofill

❌ **Don't**:
- Use placeholder as label
- Validate on every keystroke (debounce)
- Disable paste functionality
- Use non-standard form controls

---

### Modals

Modals interrupt the user flow for critical decisions or information.

#### Structure

```html
<div class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">
            <h2 class="modal-title">Modal Title</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <!-- Content -->
        </div>
        <div class="modal-footer">
            <button class="btn-secondary">Cancel</button>
            <button class="btn-primary">Confirm</button>
        </div>
    </div>
</div>
```

#### Styling

```css
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.modal-container {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 560px;
    width: 90%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp var(--duration-base) var(--ease-out);
}

.modal-header {
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--gray-200);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-body {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--gray-200);
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
}
```

#### Modal Guidelines

✅ **Do**:
- Use for critical decisions that require focus
- Provide clear title describing purpose
- Include close button (X) in header
- Allow Escape key to close
- Prevent background scroll
- Trap focus within modal

❌ **Don't**:
- Nest modals (modal within modal)
- Auto-open modals on page load
- Use for non-essential information
- Make close action ambiguous

---

### Tooltips

Tooltips provide contextual information on hover or focus.

```css
.tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: var(--space-1) var(--space-2);
    background: var(--gray-900);
    color: white;
    font-size: var(--text-xs);
    white-space: nowrap;
    border-radius: var(--radius-sm);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast);
    z-index: 1000;
}

.tooltip-trigger:hover .tooltip,
.tooltip-trigger:focus .tooltip {
    opacity: 1;
}
```

#### Tooltip Guidelines

✅ **Do**:
- Keep text brief (max 2-3 words)
- Show on hover AND keyboard focus
- Position to avoid covering content
- Use for icon-only buttons

❌ **Don't**:
- Include interactive content
- Use for critical information
- Show on mobile (no hover state)

---

## 🔄 Patterns

### Loading States

#### Spinner

```css
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--gray-200);
    border-top-color: var(--primary-600);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}
```

#### Skeleton

```css
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.skeleton {
    background: linear-gradient(
        90deg,
        var(--gray-100) 0%,
        var(--gray-200) 50%,
        var(--gray-100) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
}
```

### Empty States

Show when no data exists or query returns no results.

```html
<div class="empty-state">
    <div class="empty-icon">📭</div>
    <h3 class="empty-title">No bookmarks yet</h3>
    <p class="empty-description">
        Start bookmarking your favorite AI conversations
    </p>
    <button class="btn-primary">Create First Bookmark</button>
</div>
```

```css
.empty-state {
    text-align: center;
    padding: var(--space-16);
}

.empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-4);
}

.empty-title {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--gray-900);
    margin-bottom: var(--space-2);
}

.empty-description {
    font-size: var(--text-base);
    color: var(--gray-500);
    margin-bottom: var(--space-6);
}
```

### Search & Filter

#### Search Input

```html
<div class="search-wrapper">
    <lucide-search class="search-icon"></lucide-search>
    <input type="text" class="search-input" placeholder="Search..." />
</div>
```

```css
.search-wrapper {
    position: relative;
}

.search-icon {
    position: absolute;
    left: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    width: var(--icon-sm);
    color: var(--gray-400);
    pointer-events: none;
}

.search-input {
    padding-left: var(--space-8);
    /* Other input styles */
}
```

---

## ♿ Accessibility

### Color Contrast

All text and interactive elements must meet WCAG AA standards:

**Minimum Contrast Ratios**:
- Normal text (< 18px): 4.5:1
- Large text (≥ 18px): 3:1
- UI components: 3:1

**Tools**:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools Color Picker

### Keyboard Navigation

All interactive elements must be keyboard accessible:

**Tab Order**:
- Follow logical reading order (top-to-bottom, left-to-right)
- Skip hidden or collapsed elements
- Trap focus in modals

**Focus Indicators**:
```css
*:focus {
    outline: 2px solid var(--primary-500);
    outline-offset: 2px;
}
```

**Keyboard Shortcuts**:
- `Tab` / `Shift+Tab`: Navigate forward/backward
- `Enter` / `Space`: Activate buttons
- `Escape`: Close modals, cancel actions
- `Arrow keys`: Navigate lists, select options

### Screen Readers

**ARIA Labels**:
```html
<!-- Icon-only button -->
<button aria-label="Close modal">×</button>

<!-- Loading state -->
<div role="status" aria-live="polite">Loading...</div>

<!-- Error message -->
<div role="alert" aria-live="assertive">Error saving bookmark</div>
```

**Semantic HTML**:
- Use `<button>` for actions, not `<div onclick>`
- Use `<a>` for navigation, not `<span onclick>`
- Use proper heading hierarchy (`<h1>`, `<h2>`, `<h3>`)
- Use `<nav>`, `<main>`, `<article>`, `<aside>` landmarks

### Reduced Motion

Respect user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## 💻 Implementation

### CSS Variables

Define all design tokens as CSS custom properties:

```css
:root {
    /* Colors */
    --gray-50: #F9FAFB;
    --gray-100: #F3F4F6;
    /* ... */
    
    /* Spacing */
    --space-1: 4px;
    --space-2: 8px;
    /* ... */
    
    /* Typography */
    --text-xs: 12px;
    --text-sm: 13px;
    /* ... */
    
    /* Radius */
    --radius-sm: 6px;
    --radius-md: 8px;
    /* ... */
    
    /* Shadows */
    --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    /* ... */
    
    /* Transitions */
    --duration-fast: 150ms;
    --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### TypeScript Types

```typescript
// design-tokens.ts
export const spacing = {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    // ...
} as const;

export const colors = {
    gray: {
        50: '#F9FAFB',
        100: '#F3F4F6',
        // ...
    },
    primary: {
        500: '#3B82F6',
        600: '#2563EB',
        // ...
    },
} as const;

export type Spacing = keyof typeof spacing;
export type Color = keyof typeof colors;
```

### Component Template

```typescript
// Example component following design system
export class Button {
    constructor(
        private text: string,
        private variant: 'primary' | 'secondary' | 'ghost' = 'primary',
        private size: 'sm' | 'md' | 'lg' = 'md'
    ) {}
    
    render(): string {
        return `
            <button class="btn btn-${this.variant} btn-${this.size}">
                ${this.text}
            </button>
        `;
    }
}
```

---

## 📚 Resources

### Design Tools

- **Figma**: [Design System Component Library]
- **Color Palette**: [Coolors color scheme]
- **Icons**: [Lucide Icons Library](https://lucide.dev)

### Development Tools

- **CSS Variables**: Design tokens file
- **TypeScript Types**: Type definitions for design tokens
- **Storybook**: Component documentation and testing

### External References

- [Material Design 3](https://m3.material.io/)
- [Linear Design Principles](https://linear.app)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-16 | Initial design system documentation |

---

## 🤝 Contributing

This is a living document. To propose changes:

1. Review current guidelines thoroughly
2. Document rationale for proposed change
3. Provide visual examples or code samples
4. Submit for design team review
5. Update this document after approval

---

## 📄 License

This design system is proprietary to AI-Markdone.

---

**For questions or feedback, contact the Design Team.**

