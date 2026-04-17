
The user wants to remove the post-signup notification prompt. Looking at the code, `PushNotificationPrompt` renders on the Dashboard and shows a dialog 1.5s after load (gated by localStorage). Removing it from `Dashboard.tsx` and deleting the component file is the cleanest approach. The `NotificationsStep` in onboarding is separate — user said "trigger after first creates account", which matches the dashboard prompt, not the onboarding step. I'll confirm by leaving the onboarding step in place since it's a deliberate user-driven step, not an automatic trigger.

## Plan

Remove the automatic push-notification prompt that appears on the dashboard shortly after a new user lands.

### Changes

1. **`src/pages/Dashboard.tsx`** — Remove the `<PushNotificationPrompt />` render and its import.
2. **`src/components/dashboard/PushNotificationPrompt.tsx`** — Delete the file (no other consumers).

Users can still enable push notifications via Settings (`PushNotificationsToggle`) and the onboarding flow's `NotificationsStep` remains untouched since it's a deliberate user-driven step rather than an automatic trigger.
