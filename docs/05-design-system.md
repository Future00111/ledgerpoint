# 05 — UI / UX Design System

Ensure every screen looks and behaves consistently. Ledgerly draws inspiration from Linear, Notion, Stripe Dashboard, GitHub and Figma.

---

## Colours

Defined as CSS variables in `src/index.css` and mapped in `tailwind.config.js`. Always use token classes (`bg-primary`, `text-muted-foreground`); never hardcode hex values.

| Token | Use |
|-------|-----|
| `--background` / `--foreground` | Page background and text |
| `--card` / `--card-foreground` | Cards and surfaces |
| `--primary` / `--primary-foreground` | Primary actions, links |
| `--secondary` | Secondary surfaces |
| `--muted` / `--muted-foreground` | Muted backgrounds and helper text |
| `--accent` / `--accent-foreground` | Hover/active surfaces |
| `--destructive` / `--destructive-foreground` | Destructive actions and errors |
| `--border` / `--input` / `--ring` | Borders, inputs, focus ring |
| `--chart-1` … `--chart-5` | Charts |

Chart palette: chart-1 blue, chart-2 green, chart-3 orange, chart-4 purple, chart-5 pink.

## Typography

- **Font:** Inter (loaded in `src/index.css`).
- **Roles:** `font-heading`, `font-body`, `font-display` (all Inter), `font-mono` for code/IDs (developer mode only).
- **Scale:** use Tailwind text sizes; body defaults to `text-sm`/`text-base`; headings `font-semibold`.

## Spacing

- Use Tailwind spacing scale. Generous padding: cards `p-6`, content areas `p-4 lg:p-6`.
- Radius: `--radius: 0.5rem`; cards use `rounded-xl`, inputs `rounded-md`.
- Subtle shadows; borders are light (`border`).

## Buttons

- Component: `src/components/ui/button.jsx`.
- Variants: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`.
- Sizes: `default` (`h-9`), `sm`, `lg`, `icon`.
- One primary action per screen; secondary actions use `outline` or `ghost`.

## Forms

- Inputs: `src/components/ui/input.jsx`, `Label`, `Select`, `Textarea`, `Switch`, `Checkbox`, `RadioGroup`.
- Errors appear inline, in plain business language (never technical).
- Required fields are marked; submit is disabled while in-flight.
- Use `react-hook-form` for complex forms.

## Tables

- Component: `src/components/ui/table.jsx`.
- UK date format (`DD MMM YYYY`) and GBP currency (£) via `src/lib/format.js`.
- Right-align money columns. Use badges for statuses.

## Cards

- Component: `src/components/ui/card.jsx`.
- Cards: `rounded-xl border bg-card shadow`.
- Use for KPIs, summaries, widget containers.

## Icons

- **Library:** `lucide-react` only. Only icons that exist; never invent names.
- Import icons used per page; alias when a name collides with a component (e.g. `Home as HomeIcon`).

## Navigation

- Sidebar: `src/components/layout/Sidebar.jsx` driven by `navConfig.js` (single source of truth).
- Top header with Ask trigger, notifications, quick-create, company switcher.
- Breadcrumbs under the header.
- Collapsible on tablet; drawer on mobile.

## Empty States

Never "No data". Each empty state explains:
1. What the feature does.
2. Why it matters.
3. How to get started (primary action).
4. An Ask shortcut.

## Notifications

- Toasts: `NotificationStack.jsx` (auto-dismiss, hover to pause).
- History: `NotificationCentre.jsx` (bell icon).
- Types: `success`, `info`, `warning`, `error`.
- All notifications are sanitised by Customer Safe Mode — no JSON, IDs or technical text for non-developers.

## Modals

- `Dialog` (`src/components/ui/dialog.jsx`) and `Sheet`/`Drawer` for panels.
- Title + description, clear primary action, cancel. Esc to close. Focus trap.

## Loading States

- Spinner (`border-t-primary animate-spin`) for full-area loads.
- `Skeleton` (`src/components/ui/skeleton.jsx`) for content placeholders.
- Widgets load independently and never block the dashboard.

## Animations

- Tailwind + `tailwindcss-animate`; framer-motion for toasts and transitions.
- Keep motion subtle and fast (≤200ms). Respect reduced-motion.

## Accessibility

- Keyboard navigable; visible focus rings (`outline-ring/50`).
- Semantic HTML and ARIA via shadcn primitives.
- Colour contrast meets WCAG AA; never rely on colour alone.
- Responsive layouts across mobile, tablet, desktop.