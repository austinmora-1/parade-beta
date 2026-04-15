

# Remove Chat Messaging, Vibe Sending, and Elly Chat

## Summary
Remove all peer-to-peer chat, vibe sending/receiving, Elly AI chat, and the /chat route. Keep the VibeSelector (personal vibe status on dashboard) and GifPicker (used by VibeSelector).

## Files to Delete

**Components:**
- `src/components/chat/ChatView.tsx`
- `src/components/chat/ChatAttachMenu.tsx`
- `src/components/chat/ChatImageUpload.tsx`
- `src/components/chat/ConversationList.tsx`
- `src/components/chat/EllyChatView.tsx`
- `src/components/chat/MessageActions.tsx`
- `src/components/chat/MessageReactions.tsx`
- `src/components/chat/NewChatDialog.tsx`
- `src/components/chat/ReplyPreview.tsx`
- `src/components/vibes/SendVibeDialog.tsx`
- `src/components/vibes/VibeComments.tsx`
- `src/components/vibes/VibeDetailDialog.tsx`
- `src/components/vibes/VibeLocationInput.tsx`
- `src/components/vibes/VibeReactions.tsx`
- `src/components/dashboard/ReceivedVibes.tsx`
- `src/components/dashboard/SentVibes.tsx`
- `src/components/dashboard/EllyWidget.tsx`
- `src/components/friends/SharedVibeHistory.tsx`

**Hooks:**
- `src/hooks/useChat.ts`
- `src/hooks/useVibes.ts`
- `src/hooks/useEllyChat.ts`

**Utils:**
- `src/lib/vibeNotifications.ts`

**Pages:**
- `src/pages/Chat.tsx`

**Edge Functions (delete code + deployed functions):**
- `supabase/functions/chat-with-elly/`
- `supabase/functions/elly-conversation-assist/`
- `supabase/functions/giphy-search/`

## Files to Modify

1. **`src/App.tsx`** — Remove `Chat` import and `/chat` route.

2. **`src/components/layout/MobileHeader.tsx`** — Remove `useConversations` import, `unreadChats` calculation, and chat count from `inboxCount`. Remove the chat icon/link if present.

3. **`src/components/dashboard/VibeSelector.tsx`** — Remove `SendVibeDialog` import and the "Send Vibe" button/dialog. Keep the personal vibe status selector. Remove `GifPicker` import if only used for vibe sending (check: it's used for personal vibe GIF — keep it).

4. **`src/components/feed/FeedView.tsx`** — Remove vibe-related imports (`useVibes`, `VibeReactions`, `VibeDetailDialog`) and all vibe rendering logic from the feed. Keep plan-based feed items.

5. **`src/components/friends/FriendPanel.tsx`** — Remove the "chat" tab, `ChatView` import, `useConversations` import, and `ChatEmptyState`. Panel becomes profile-only.

6. **`src/components/friends/PodPanel.tsx`** — Remove `ChatView` import, `useConversations`, and chat tab/view. Keep pod member management.

7. **`src/components/friends/FriendProfileContent.tsx`** — Remove "Message" button and `SharedVibeHistory` section.

8. **`src/components/friends/FriendListRow.tsx`** — Remove `conversation` prop and unread badge logic tied to chat.

9. **`src/pages/Friends.tsx`** — Remove `useConversations` import, `dmByFriendUserId` lookup, and conversation props passed to `FriendListRow` and `FriendPanel`.

10. **`src/pages/FriendProfile.tsx`** — Remove `useConversations` import, `createDM`, and `onMessageClick` handler.

11. **`src/pages/PlanDetail.tsx`** — Remove group chat creation flow from plan detail (navigate to `/interact`).

12. **`src/components/feedback/FloatingFeedbackButton.tsx`** — Remove `SendVibeDialog` import and "Send Vibe" action from the FAB menu.

13. **`src/hooks/useNotifications.ts`** — Remove vibe-related notification counting (`vibe_send_recipients` queries and realtime subscriptions).

14. **`src/components/dashboard/HomeTabs.tsx`** — Check if it references vibes/chat; remove if so.

15. **`src/lib/storage.ts`** — Remove `'chat-images'` from `PRIVATE_BUCKETS` (keep `'vibe-media'` only if still needed for personal vibe GIFs, otherwise remove too).

## Components to Keep
- `src/components/chat/GifPicker.tsx` — Still used by VibeSelector for personal vibe GIFs
- `src/components/chat/EmojiPicker.tsx` — May be used elsewhere; keep if referenced outside chat
- `src/components/dashboard/VibeSelector.tsx` — Personal vibe status (stripped of send-vibe)
- `src/components/dashboard/FriendVibeStrip.tsx` — Shows friend vibe statuses on dashboard

## Technical Notes
- The `EmojiPicker` is only used by `EllyChatView` and `ChatAttachMenu` (both being deleted). It can be deleted too.
- Edge functions will be deleted from both code and deployed state using the delete tool.
- No database migrations needed — tables remain but are simply unused.
- The plannerStore vibe state (`currentVibe`, `setVibe`, `addCustomVibe`, `removeCustomVibe`) stays since the VibeSelector is kept.

