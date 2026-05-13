## Goal
Adopt the new Parade brand palette across the app via design tokens only — no per-component color edits. All components already consume semantic tokens (`primary`, `background`, etc.) so updating CSS variables in `src/index.css` (plus a few brand-token references) propagates everywhere.

## New palette → token mapping

**Primary brand**
- `--primary` = Parade Green `#23744D` → `hsl(152 54% 30%)`
- `--primary-glow` = Faded Mint `#67B28E` → `hsl(150 33% 55%)`
- `--secondary` = Ember `#D46549` → `hsl(11 60% 56%)` (warm accent, replaces old coral role)
- `--accent` = Custard tint `hsl(40 60% 92%)` with `--accent-foreground` Dark Forest `hsl(150 22% 24%)`
- `--ring` follows `--primary`

**Light mode surfaces**
- `--background` = Custard `#F8F0E0` → `hsl(40 67% 93%)`
- `--foreground` = Sea Floor `#020620` → `hsl(231 88% 6%)`
- `--card` / `--popover` = Pearl top `#FFFFFF` → `hsl(0 0% 100%)`
- `--muted` = warm cream `hsl(40 50% 89%)`, `--muted-foreground` Elephant Gray `#95979D` → `hsl(225 4% 60%)`
- `--border` / `--input` = subtle warm `hsl(40 30% 84%)`
- Sidebar tokens follow Custard family

**Dark mode surfaces**
- `--background` = Sea Floor `#020620` → `hsl(231 88% 6%)`
- `--foreground` = Custard `hsl(40 67% 93%)`
- `--card` = slightly lifted navy `hsl(231 50% 10%)`
- `--popover` = `hsl(231 55% 8%)`
- `--muted` = `hsl(231 30% 16%)`, `--muted-foreground` `hsl(225 8% 65%)`
- `--border` / `--input` = `hsl(231 30% 18%)`
- `--primary` brightens to Faded Mint `hsl(150 33% 55%)` for contrast on Sea Floor; `--primary-glow` `hsl(150 40% 70%)`
- `--secondary` Ember stays `hsl(11 60% 56%)`
- `--accent` deep forest `hsl(150 22% 18%)`, `--accent-foreground` `hsl(150 33% 75%)`

**Brand accent tokens** (`src/index.css`)
- `--coral` → Ember `hsl(11 60% 56%)` (keep variable name to avoid component churn; document the rename)
- `--sunset-peach` → Butter `#F3D67E` → `hsl(43 84% 72%)`
- `--open-sky` → Denim `#6E92C2` → `hsl(214 41% 60%)`
- `--go-mint` → Faded Mint `hsl(150 33% 55%)`
- `--sunshine` → Marigold `#DDA73A` → `hsl(42 71% 55%)`
- `--meadow-green` → Parade Green light `hsl(152 39% 50%)`
- Add new optional tokens: `--dark-forest`, `--dark-ember`, `--sea-floor`, `--custard`, `--elephant-gray`, `--pearl-gradient` for future use

**Gradients**
- `--gradient-primary` = Parade Green → Faded Mint
- `--gradient-secondary` = Ember → Butter
- `--gradient-hero` = Parade Green → Faded Mint → Denim
- `--gradient-wordmark` = Parade Green → Faded Mint → Butter → Marigold → Ember → Denim → Deep Sea
- `--gradient-card` light = white → Custard; dark = Sea Floor → `hsl(231 50% 9%)`
- Add `--gradient-pearl` = `linear-gradient(135deg, #FFFFFF, #E8E8EA)` for special surfaces

**Conservative scope (per your choice)**
- `availability-*`, `vibe-*`, and `activity-*` tokens stay untouched in this pass. We only swap the brand/surface/gradient layer. A follow-up can remap those once you've lived with the new shell.

## Theme toggle (`useColorScheme`)
Today there are two schemes: `coral` (primary=coral) and `green` (primary=green). The new palette has Green as the canonical primary and no true coral.

Approach:
- Keep the toggle component and storage key for backward compatibility, but rebuild both schemes:
  - `coral` scheme → "Warm" preset: Ember primary + Butter glow (warm-led look)
  - `green` scheme → "Default" Parade Green primary (matches base tokens)
- Update the swatch chips in `AppearanceQuickToggles.tsx` to reflect Ember (`hsl(11 60% 56%)`) and Parade Green (`hsl(152 54% 30%)`).
- Default new users to `green` (currently `coral`).

## ParadeWordmark
- Update hardcoded `hsl(5 100% 68%)` fallbacks to Parade Green `hsl(152 54% 30%)` (and the dark-mode override).

## Files touched
1. `src/index.css` — rewrite `:root`, `.dark`, `:root.theme-green`, `.dark.theme-green` blocks; update `.parade-wordmark` color rules
2. `src/components/ui/ParadeWordmark.tsx` — update inline fallback color
3. `src/components/profile/AppearanceQuickToggles.tsx` — update swatch hex values and labels
4. `src/hooks/useColorScheme.tsx` — flip default from `coral` → `green`
5. Memory updates:
   - Update `mem://index.md` Core line (palette HEXes)
   - Update `mem://style/visual-identity-and-branding`

## Out of scope (explicit)
- No component color rewrites
- No availability / vibe / activity color changes (deferred follow-up)
- No PWA icon, OG image, or marketing asset regeneration
- No Tailwind config changes (semantic tokens already wired)
- No edge-function email template color changes

## Verification
- Visual sweep in preview: dashboard, plan detail, friends, settings, login, dark mode toggle, color-scheme toggle
- Confirm WCAG AA contrast for Parade Green on Custard (passes ~7:1) and Faded Mint on Sea Floor (passes ~6:1)
- Build check via harness
