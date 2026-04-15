

# Tech Debt & Dead Code Cleanup

## Summary
Clean up leftover vibe/Elly references, dead files, stale notification code, and outdated memory files across the codebase.

## 1. Delete Dead Files
- `src/pages/Index.tsx` — unused placeholder page, never routed
- `src/lib/constants.ts` — only contains `ELLY_USER_ID`, no longer imported

## 2. Remove Vibe Code from Notifications

**`src/hooks/useNotifications.ts`**:
- Remove `unreadVibesCount` from shared state (line 25)
- Remove `fetchUnreadVibes` callback (lines 126-138)
- Remove from useEffect calls (line 158), realtime subscription (lines 186-189), deps (line 199)
- Remove `dismissedVibeCount` / `effectiveVibeCount` (lines 217, 226)
- Remove from `totalNotifications` sum (line 229)
- Remove `refetchUnreadVibes` from return (line 259)

**`src/pages/Notifications.tsx`**:
- Remove `IncomingVibe` interface (lines 69-77)
- Remove `incomingVibes` / `vibesLoading` state (lines 123-124)
- Remove `refetchUnreadVibes` from destructured hook (line 107)
- Remove `fetchIncomingVibes()` call (line 154) and function definition (lines 220-268)
- Remove `handleDismissVibe` function (lines 323-331)
- Remove `visibleVibes` filtering (line 663) and from `totalVisible` / `isEmpty` checks (lines 667-668)
- Remove entire "Incoming Vibes Section" render block (lines 919-982)
- Remove `Sparkles` from icon imports (line 10) if not used elsewhere in file

## 3. Remove Elly Toggle from Onboarding

**`src/components/onboarding/OnboardingWizard.tsx`**:
- Remove `allowEllyHangouts` from `OnboardingData` interface (line 47)
- Remove from initial state (line 92)
- Remove `allow_elly_hangouts` from profile update (line 166)

**`src/components/onboarding/steps/NotificationsPrivacyStep.tsx`**:
- Remove the `allowEllyHangouts` toggle object from `privacyToggles` array (lines 43-48)
- Remove `Bot` from lucide imports (line 6)

## 4. Update EllyWalkthrough Steps

**`src/components/onboarding/EllyWalkthrough.tsx`**:
- Replace step 3 ("Sending Vibes") with content about sharing availability / setting your weekly intentions
- Replace step 4 ("Meet Elly") with content about trips & travel planning
- Remove `MessageCircle` and `Heart` from imports, add relevant replacements (e.g. `Globe`, `Users`)

## 5. Fix Empty State Copy

**`src/components/dashboard/UpcomingPlans.tsx`** (line 454):
- Change `"Create a new plan or chat with Elly!"` to `"Make a plan to get started!"`

**`src/components/dashboard/UpcomingPlansWidget.tsx`** (line 302):
- Same copy fix

## 6. Remove `vibe-media` from Storage Buckets

**`src/lib/storage.ts`** (line 5):
- Change `['plan-photos', 'vibe-media']` to `['plan-photos']`

## 7. Remove Debug console.log Statements

**`src/hooks/useFriendRequestNotifications.ts`**: Remove 4 console.log calls (lines ~14, 28, 42, 47)

**`src/stores/plannerStore.ts`**: Remove "Friendship already exists" console.log

**`src/pages/ResetPassword.tsx`**: Remove `console.log('Auth event:', event)` (line ~47)

## 8. Clean Up Memory Files

Delete stale memory files and update index:
- Delete `mem://features/elly-ai-assistant`
- Delete `mem://features/friends-and-chat-integration`
- Delete `mem://integrations/giphy-support`
- Delete `mem://tech/storage-security-architecture` (references deleted buckets)
- Update `mem://style/dialog-layout-patterns` to remove Send Vibe references
- Update `mem://features/vibe-system-ui` to remove send/receive aspects
- Update `mem://index.md` to remove stale entries

