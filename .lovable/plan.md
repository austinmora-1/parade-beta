

## Weekly Social Intentions & Sunday Nudge

### Overview
Add a "Weekly Intentions" feature that lets users set their social goals and vibes for the upcoming week. On Sunday afternoons, a push notification nudges users to complete their weekly planning ritual.

### Database Changes

**New table: `weekly_intentions`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `week_start` (date, NOT NULL) — Monday of the target week
- `social_energy` (text) — e.g. "high", "medium", "low"
- `target_hangouts` (integer) — how many times they want to hang out
- `vibes` (text[]) — vibes they're feeling for the week (social, chill, athletic, productive)
- `notes` (text) — free-form intention text
- `created_at`, `updated_at` (timestamptz)
- UNIQUE(user_id, week_start)
- RLS: users can CRUD their own rows

### Frontend Components

**1. `WeeklyIntentionsSheet` (new component)**
A bottom sheet / dialog that guides users through setting their week:
- **Social energy level**: Low / Medium / High slider or 3-option selector
- **Target hangouts**: "How many times do you want to see friends?" (1-5+ selector)
- **Weekly vibes**: Multi-select from existing vibe types (social, chill, athletic, productive)
- **Optional note**: Free-text field for personal intention ("Try a new restaurant", "Catch up with college friends")
- Save button persists to `weekly_intentions` table

**2. Dashboard integration**
- On the Dashboard, if it's Sunday-Thursday and no intention is set for the current/upcoming week, show a subtle card below the greeting: "Set your intentions for the week →"
- Once set, show a compact summary widget: "This week: 🔥 High energy · 3 hangouts · Social, Athletic"
- Tapping the summary reopens the sheet to edit

**3. Sunday afternoon push nudge**
- New edge function `weekly-intention-nudge` triggered via cron every Sunday at 2 PM UTC (adjustable)
- Queries users who haven't set intentions for the upcoming week (next Monday's week_start)
- Sends a push notification: "Plan your week! Set your social intentions for the week ahead 🗓️"
- Respects user notification preferences (reuse `plan_reminders` preference or add a new one)
- Links to open the intentions sheet on tap

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `weekly_intentions` table with RLS |
| `src/hooks/useWeeklyIntentions.ts` | Hook: fetch/upsert current week's intentions |
| `src/components/dashboard/WeeklyIntentionsSheet.tsx` | The planning UI sheet |
| `src/components/dashboard/WeeklyIntentionsSummary.tsx` | Compact dashboard widget |
| `src/pages/Dashboard.tsx` | Add intention card/summary to dashboard |
| `supabase/functions/weekly-intention-nudge/index.ts` | Sunday push notification edge function |
| Cron job SQL (via insert tool) | Schedule the Sunday nudge |

### Technical Details
- Week starts on Monday (consistent with existing `startOfWeek` usage with `weekStartsOn: 1`)
- The intentions sheet uses existing UI primitives (Sheet, Button, Badge)
- Vibe selection reuses `VIBE_CONFIG` and `VIBE_CHIP_STYLES` from the existing vibe system
- Push notifications use the existing `web-push` infrastructure from `send-push-notification`
- The cron job runs at ~2 PM UTC on Sundays; the edge function checks each user's timezone to only nudge during their local afternoon window (1-5 PM)

