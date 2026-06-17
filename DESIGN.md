---
version: alpha
name: Jagad
description: A dual-mode (dark/light) developer-tools design system built on a signature teal accent — database-backup infrastructure that feels precise, trustworthy, and modern.
colors:
  # Brand
  primary: "#0d9488"
  primary-hover: "#0f766e"
  primary-soft: "rgba(13,148,136,0.12)"
  brand-bright: "#06b6d4"

  # Dark mode surfaces
  dark-canvas: "#0a0a0b"
  dark-surface-1: "#121214"
  dark-surface-2: "#1a1a1e"
  dark-surface-3: "#242429"
  dark-ink: "#f1f1f3"
  dark-body: "#a1a1aa"
  dark-muted: "#6b6b76"
  dark-hairline: "#2c2c33"
  dark-hairline-soft: "#1e1e23"

  # Light mode surfaces
  light-canvas: "#fafafa"
  light-surface-1: "#ffffff"
  light-surface-2: "#f4f4f5"
  light-surface-3: "#e9e9ec"
  light-ink: "#18181b"
  light-body: "#3f3f46"
  light-muted: "#71717a"
  light-hairline: "#e4e4e7"
  light-hairline-soft: "#efeff0"

  # Semantic
  success: "#22c55e"
  success-soft: "rgba(34,197,94,0.12)"
  warning: "#f59e0b"
  warning-soft: "rgba(245,158,11,0.12)"
  error: "#ef4444"
  error-soft: "rgba(239,68,68,0.12)"
  info: "#3b82f6"
  info-soft: "rgba(59,130,246,0.12)"

  # Chart accents
  accent-purple: "#a855f7"
  accent-amber: "#f59e0b"
  accent-rose: "#f43f5e"
  accent-cyan: "#22d3ee"

  # Theme-aliased tokens (resolved at build time from dark/light prefix)
  canvas: "#0a0a0b"
  surface-1: "#121214"
  surface-2: "#1a1a1e"
  surface-3: "#242429"
  ink: "#f1f1f3"
  body: "#a1a1aa"
  muted: "#6b6b76"
  hairline: "#2c2c33"
  hairline-soft: "#1e1e23"
  code-bg: "#1a1a1e"
  code-text: "#e4e4e7"
  on-primary: "#ffffff"
  on-success: "#ffffff"
  on-warning: "#ffffff"
  on-error: "#ffffff"

typography:
  display-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  heading-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  heading-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  mono:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px 20px
    typography: "{typography.body-md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 10px 20px
    typography: "{typography.body-md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: 8px 16px
    typography: "{typography.body-md}"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
    padding: 20px
  card-hover:
    backgroundColor: "{colors.surface-2}"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 10px 14px
    typography: "{typography.body-md}"
  input-focus:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  badge:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 2px 10px
    typography: "{typography.body-sm}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
  badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
  status-dot:
    backgroundColor: "{colors.primary}"
    size: 8px
    rounded: "{rounded.full}"
  sidebar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    width: 240px
  table-header:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: 10px 16px
  table-cell:
    padding: 12px 16px
    typography: "{typography.body-md}"
  toast:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  modal:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 24px
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
    padding: 6px 10px
    typography: "{typography.body-sm}"
  progress-bar:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.full}"
    height: 6px
  progress-bar-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
  toggle:
    backgroundColor: "{colors.surface-3}"
    size: 24px
    rounded: "{rounded.full}"
  toggle-active:
    backgroundColor: "{colors.primary}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    typography: "{typography.body-md}"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
---

## Overview

Jagad is a database backup management tool for sysadmins, DevOps engineers, and developers. The design system reflects its purpose: **precise, trustworthy, and modern**. The teal accent evokes data flow, reliability, and technical confidence — like a calm monitoring dashboard where every status indicator tells you exactly what you need to know.

The system supports full dark and light modes. Dark mode is the default — a near-black canvas (`#0a0a0b`) that feels like a terminal or server console. Light mode uses a warm-white canvas (`#fafafa`) for environments where readability in bright conditions matters.

## Colors

### Brand Accent

The primary brand color is a deep teal (`#0d9488`) with a brighter variant (`#06b6d4`) for decorative and highlight usage.

- **primary (`#0d9488`)** — All interactive elements: buttons, links, active states, selected items. Chosen for WCAG AA compliance with white text (4.5:1+ on large text).
- **brand-bright (`#06b6d4`)** — Decorative highlights, glow effects, loading spinners, gradient accents. Not used for text-critical elements.
- **primary-hover (`#0f766e`)** — Hover state for primary buttons.
- **primary-soft (rgba 12%)** — Background fill for badges, selected nav items, pill tags.

**Usage rules:**
- `primary` is the sole interaction driver
- `brand-bright` is for visual accent only — never for text or interactive elements
- `primary-soft` for backgrounds that need a teal tint

### Surface Ladder — Dark Mode

| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#0a0a0b` | Page background — deepest surface |
| `surface-1` | `#121214` | Cards, panels, sidebar |
| `surface-2` | `#1a1a1e` | Elevated surfaces, input backgrounds |
| `surface-3` | `#242429` | Hover states, dropdowns, modals |
| `ink` | `#f1f1f3` | Primary text — highest emphasis |
| `body` | `#a1a1aa` | Body text — comfortable readability |
| `muted` | `#6b6b76` | Secondary text, timestamps, metadata |
| `hairline` | `#2c2c33` | Borders, dividers, table lines |
| `hairline-soft` | `#1e1e23` | Subtle separators |

### Surface Ladder — Light Mode

| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#fafafa` | Page background |
| `surface-1` | `#ffffff` | Cards, panels, sidebar |
| `surface-2` | `#f4f4f5` | Elevated surfaces, input backgrounds |
| `surface-3` | `#e9e9ec` | Hover states, dropdowns |
| `ink` | `#18181b` | Primary text |
| `body` | `#3f3f46` | Body text |
| `muted` | `#71717a` | Secondary text |
| `hairline` | `#e4e4e7` | Borders, dividers |
| `hairline-soft` | `#efeff0` | Subtle separators |

The theme-aliased tokens (`canvas`, `surface-1`, etc.) in the YAML front matter default to dark mode values. In the implementation, these resolve at build time to either the `dark-*` or `light-*` prefix based on the user's theme selection. CSS custom properties are the recommended mechanism:

```css
:root { /* dark defaults from {colors.dark-*} above */ }
:root[data-theme="light"] { /* light overrides from {colors.light-*} above */ }
```

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `success` | `#22c55e` | Backup completed, healthy status |
| `warning` | `#f59e0b` | Partial failure, attention needed |
| `error` | `#ef4444` | Backup failed, connection lost |
| `info` | `#3b82f6` | Running, in-progress, informational |

Status indicators combine a status dot icon + soft background badge:
- 🟢 `success` + `success-soft` → "Last backup: OK"
- 🟡 `warning` + `warning-soft` → "Retrying..."
- 🔴 `error` + `error-soft` → "Backup failed"

## Typography

**Inter** for all UI text — the de facto standard for developer tools. Clean, readable, with excellent screen rendering.

**JetBrains Mono** for code blocks, database queries, and configuration YAML — distinct from UI text, optimized for code readability.

| Style | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| `display-xl` | 48px | 700 | -0.03em | Page title (Dashboard) |
| `display-lg` | 36px | 600 | -0.02em | Section title (Backups) |
| `display-md` | 28px | 600 | -0.01em | Card/panel title |
| `heading-lg` | 20px | 600 | — | Section heading |
| `heading-md` | 16px | 600 | — | Card heading |
| `body-lg` | 16px | 400 | — | Lead paragraph |
| `body-md` | 14px | 400 | — | UI text (default) |
| `body-sm` | 12px | 400 | — | Helper, timestamps |
| `label` | 12px/600 | — | 0.06em | Table header, meta |
| `mono` | 13px | 400 | — | Code, config, DB output |

## Layout & Spacing

Spacing follows a 4px baseline scale:

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tight inner padding |
| `sm` | 8px | Element-to-element gap |
| `md` | 12px | Intra-component spacing |
| `lg` | 16px | Inter-component spacing |
| `xl` | 24px | Section padding |
| `xxl` | 32px | Large gaps |
| `section` | 48px | Page section separation |

**Page layout:**
- Sidebar: 240px fixed width, full viewport height
- Content area: max-width 1200px, centered with `xl` padding
- Status bar: 48px height, fixed to bottom

## Elevation & Depth

**Dark mode** uses colored borders (hairlines) for surface separation — no box-shadows. This is the modern dev-tool approach (Linear, Vercel, Raycast pattern). Cards have a `1px solid {hairline}` border. Elevated surfaces (modals, dropdowns) layer on top with `surface-3` background.

**Light mode** can use subtle shadows for depth: `0 1px 3px rgba(0,0,0,0.06)` on cards, `0 4px 20px rgba(0,0,0,0.1)` on modals.

Teal glow (`{primary-soft}`) frames the active/focused element — used on input focus states and selected cards.

## Shapes

| Token | Value | Usage |
|---|---|---|
| `sm` | 4px | Inputs, badges, small elements |
| `md` | 6px | Buttons |
| `lg` | 8px | Cards, panels |
| `xl` | 12px | Large containers, modals |
| `full` | 9999px | Status dots, pill badges, toggles |

Developer tools feel precise — corners are modest. Pill shapes (`full`) are reserved for status indicators and toggles only.

## Components

### button-primary
The single call-to-action per page view. Teal fill with white label. Used for: create backup, test connection, save configuration. Hover state darkens to `primary-hover`.

### button-secondary
Outline variant with teal text and border. Used for: cancel, restore, secondary actions.

### button-ghost
No border or fill — muted text. Used in table action rows (view logs, delete, retry).

### card
Default surface for grouped content: backup list, DB connection detail, schedule info. `surface-1` background with `hairline` border. On hover, background shifts to `surface-2` and optional teal left accent bar appears.

### badge
Pill-shaped status indicators. `badge` (teal) for "Active", `badge-success` for "Completed", `badge-error` for "Failed", `badge-warning` for "Retrying". Soft background + matching text color.

### status-dot
8px filled circle with semantic color. Placed left of status labels. Animated pulse on "in progress" states.

### table-header
`surface-2` background with `label` typography. Uppercase, muted, compact.

### table-cell
`body-md` typography, `hairline-soft` bottom border between rows.

### sidebar
240px fixed sidebar with `canvas` background. Active nav item gets `primary-soft` background + `primary` text color + 3px teal left border. Nav items have `md` rounded corners.

### toast
Appears top-right, stacks vertically. Small icon + message, auto-dismiss after 5s (success) or sticky (error). `surface-3` background with `hairline` border.

### modal
Centered overlay with translucent backdrop. Title `heading-lg`, body `body-md`. Footer has aligned-right action buttons (secondary + primary).

### progress-bar
6px pill track with `surface-2` background. Fill animates with `primary` color. Used during backup operations and restore progress.

### toggle
24px toggle switch with `surface-3` track background. Active state fills with `primary`. Used in settings: schedule enable/disable, theme toggle, notification prefs.

## Do's and Don'ts

- **Do** use `{colors.primary}` for all interactive elements — this is the single interaction driver
- **Do** use `{colors.brand-bright}` sparingly for decorative highlights only — never for text or interactive elements
- **Do** use semantic colors (`success`, `warning`, `error`) for status — never repurpose `primary`
- **Do** keep the surface ladder consistent: `canvas` → `surface-1` → `surface-2` → `surface-3`
- **Do** use `hairline` borders for surface separation in dark mode (avoid box-shadows)
- **Do** use CSS custom properties for theme switching (`:root` + `[data-theme="light"]`)
- **Don't** introduce colors outside this palette — extend the palette first
- **Don't** use `primary` (teal) for success states — `success` (green) exists for that
- **Don't** use emoji as icons — use Lucide icons (MIT, feather-style SVG)
- **Don't** mix dark and light surface tokens — always resolve through CSS variables
- **Don't** use box-shadows in dark mode — hairlines handle surface separation
