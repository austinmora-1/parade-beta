

## Brand Revamp Plan — Parade Brand Guide V1.0

### Summary

Overhaul the app's visual identity to match the new brand guide: swap the color palette from forest green to a coral-led warm palette, replace Cal Sans with Fraunces for display type, and update component styles across the app.

---

### Brand Guide Key Specs

| Element | Current | New (Brand Guide) |
|---|---|---|
| **Primary color** | Forest green `hsl(150 45% 36%)` | Parade Green `#3D8C6C` |
| **Accent** | Green-based | Parade Coral `#FF6B5B` |
| **Background** | White `hsl(0 0% 100%)` | Warm Cream `#FFF8F2` |
| **Secondary colors** | Blue `hsl(200 40% 35%)` | Sunset Peach `#FFAD9E`, Open Sky `#9DD4F0`, Go Mint `#A8E6CF`, Sunshine `#FFE156`, Meadow Green `#72C4A2` |
| **Display font** | Cal Sans 600 | Fraunces 900, tracking -0.02em, leading 110% |
| **Body font** | Lexend 300 | Lexend 300 (same — keep) |
| **Corners** | Rounded | Rounded (keep, already aligned) |

**Color distribution**: Cream/white ~70%, Coral ~15% (hero/CTAs), accent colors ~15% (celebrations, badges, highlights).

---

### Implementation Steps

#### Step 1: Update CSS variables and Tailwind config (`src/index.css`, `tailwind.config.ts`)

- Replace `:root` CSS custom properties with new hex values converted to HSL:
  - `--background` → Warm Cream `#FFF8F2`
  - `--primary` → Parade Green `#3D8C6C`
  - `--primary-glow` → Meadow Green `#72C4A2`
  - `--secondary` → Parade Coral `#FF6B5B`
  - `--accent` → light coral tint
  - `--foreground` → dark warm neutral
  - `--card` → slightly warm white
  - `--muted` → warm cream variant
- Add new brand tokens: `--coral`, `--sunset-peach`, `--open-sky`, `--go-mint`, `--sunshine`, `--meadow-green`
- Update gradient variables to use coral → peach → green transitions
- Update shadow tints from green to warm coral/peach
- Update dark mode palette correspondingly (darker warm tones)
- Update sidebar colors to match warm cream palette

#### Step 2: Swap display font from Cal Sans to Fraunces

- Replace Cal Sans `@font-face` in `src/index.css` with Fraunces (Google Font, weight 900)
- Add Fraunces to `index.html` `<link>` tags
- Update `tailwind.config.ts` font-family `display` from `'Cal Sans'` to `'Fraunces'`
- Update base styles: `h1-h6, .font-display` to use `font-weight: 900`, `letter-spacing: -0.02em`, `line-height: 1.1`

#### Step 3: Update the ParadeWordmark component

- Update `ParadeWordmark.tsx` colors to use Parade Green or coral instead of the current green/white logic
- Keep Bungee Shade font for wordmark (brand identity element)

#### Step 4: Update button and component accent colors

- `button.tsx`: Update `gradient` variant to use coral-to-peach gradient; update `default` variant glow to coral tint
- `card.tsx`: Ensure card backgrounds use the warm cream token
- `input.tsx`: Update focus ring to Parade Green

#### Step 5: Update activity, availability, and vibe colors

- Map activity colors to brand palette where possible (coral, peach, mint, sky, sunshine)
- Update vibe colors: social → Coral, chill → Open Sky, athletic → Go Mint

#### Step 6: Update confetti and celebration moments

- Update `ConfettiBackground.tsx` to use the brand palette (coral, peach, mint, sunshine, sky)
- Ensure plan-confirmed confetti uses the full accent palette per brand guide

#### Step 7: Landing page and key screens

- Update hero gradients on Landing page to warm cream → coral → green
- Update onboarding screens to reflect new palette
- Update login/signup pages

#### Step 8: Dark mode pass

- Derive dark mode from the new palette: deep warm backgrounds, muted coral/green accents
- Ensure sufficient contrast for all text on dark backgrounds

---

### What stays the same
- Lexend body font (already matches brand guide)
- Rounded corners / border-radius system
- Component architecture and layout
- Bungee Shade wordmark font
- Ellie mascot usage

### Estimated scope
- ~3 core files heavily modified (index.css, tailwind.config.ts, index.html)
- ~5-8 component files with color/font tweaks
- Dark mode calibration pass

