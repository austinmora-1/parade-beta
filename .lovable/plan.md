## Add Pods to the friend selection step

In `src/components/plans/GuidedPlanSheet.tsx`, the "Who are we planning with?" step (`step === 'friends'`) currently shows a search input, selected chips, an off-Parade invite block, and a 3-column grid of friend avatars. Pods are not surfaced anywhere, so users have to re-select the same group every time.

### What to add

A new "Pods" section rendered just above the friend avatar grid (after the off-Parade invite block, before the `grid grid-cols-3` of friends), only shown when the user has at least one pod.

Each pod is rendered as a tile in a horizontally scrollable row (or 2-column grid on narrow widths) with:
- A small overlapping avatar stack (up to 3 member avatars + "+N" overflow), built using the same `Avatar` + `getElephantAvatar` pattern already used in the friend grid and in the post-step strip (lines 953–960).
- The pod emoji and name (matching `PodPanel.tsx` styling: `text-lg` emoji, `text-sm font-semibold`).
- A member count (`text-xs text-muted-foreground`) like `(4)`.
- A selected state ring matching the friend tile (`ring-[3px] ring-primary ring-offset-2 ring-offset-background`) and a `Check` badge in the corner when all members are currently chosen.

### Selection behavior

Tapping a pod toggles its members in `chosenFriends` via the existing `toggleFriend` helper:
- If every connected pod member is already chosen → remove all of them.
- Otherwise → add any pod members that are connected friends and not yet chosen.
- Pod members who are not in the user's friends list (or not `connected`) are skipped silently.

The pod's "selected" visual state is derived as: `pod.memberUserIds.filter(id is connected friend).every(id => chosenFriends has id)`.

### Data wiring

- Import and call `usePods()` from `@/hooks/usePods` at the top of the component.
- Build a memoized `connectedFriendsByUserId` map from the existing `friends` prop for O(1) lookups when resolving pod members to avatars/names and when toggling.
- Hide the section entirely if `pods.length === 0` so users without pods see the existing UI unchanged.

### Files touched

- `src/components/plans/GuidedPlanSheet.tsx` — only file changed. Add the import, the pods row JSX, and the toggle handler.

No new components, no schema changes, no new routes.
