# Game Diary Project Instructions (TweakCN/shadcn Style)

This project uses a modern design system architecture inspired by shadcn/ui (TweakCN), utilizing CSS variables for theme-ability and a strict layout grid.

## Core Design Principles

### 1. Color System (HEX Based)
The system uses HEX variables mapped to Tailwind via `@theme inline`.

- **Primary:** `--primary` (#e94a44) - The main brand color (Vibrant Warm Red).
- **Sub Color:** `#f7ced1` - Soft pinkish-peach accent.
- **Background:** `--background` (#e8ebed) - High-contrast light grey.
- **Card/Popover:** `--card`, `--popover` (#ffffff) - Standard container backgrounds.
- **Accent/Sidebar:** `--accent` (#d6e4f0), `--sidebar` (#dddfe2).
- **Foregrounds:** `--foreground` (#333333), `--primary-foreground` (#ffffff).

### 2. Typography
- **Sans:** `var(--font-sans)` (Inter, sans-serif) - Global UI.
- **Mono:** `var(--font-mono)` (JetBrains Mono, monospace) - Data/Time.
- **Serif:** `var(--font-serif)` (Source Serif 4, serif).
- **Scale:** Base `1rem` (16px), `line-height: 1.5`.

### 3. Base Reset (TweakCN Style)
- All borders use `hsl(var(--border))` (mapped via variables).
- Box-sizing is set to `border-box` for all elements.
- Text rendering is optimized for legibility (`optimizeLegibility`).

### 4. Layout Constraints (Toss Developer Center Spec)
- **Max Width:** Main content area max-width is `1192px`.
- **Horizontal Padding:** Standard container padding is `72px`.
- **Radius:** Global radius is `0.75rem` (12px).
- **Main Sidebar Width:** `312px` (Toss-style 2-column layout).

## UI Components
- **Bento Grid:** Use large radius cards with subtle shadows for the dashboard.
- **Glassmorphism:** Apply `backdrop-blur-2xl` on sidebars and floating headers.
