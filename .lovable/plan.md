
Investigation outcome

Do I know what the issue is? Yes.

The Google Calendar problem is starting before the actual sync step: the connect callback is failing with a non-2xx response while trying to save the Google tokens, so the initial sync never gets a clean chance to run.

Confirmed root causes

1. Database contract drift on `calendar_connections`
- Migration `20260223204252...` converted `access_token` / `refresh_token` to `text`.
- The calendar RPC layer (`encrypt_calendar_token`, `get_calendar_tokens`, `upsert_calendar_connection`, `update_calendar_access_token`) was built for encrypted `bytea`.
- The later April migration switched those columns back to `bytea`, which fixed one mismatch but exposed the next failure.

2. Broken encryption permission path
- The latest callback logs show: `permission denied for function crypto_aead_det_encrypt`.
- That means `google-calendar-callback` reaches `upsert_calendar_connection`, but the security-definer chain that performs encryption is owned or permissioned incorrectly for pgsodium encryption.
- Result: callback returns 500 while saving tokens, so the user completes Google’s consent flow but the app ends in failure.

3. Inconsistent storage usage across calendar providers
- Google code now mostly uses token RPCs.
- iCal code still reads/writes `calendar_connections.access_token` directly.
- Google disconnect also reads `access_token` directly.
- After the bytea migration, those direct-access paths are no longer a safe/consistent contract.

Implementation plan

1. Rebuild the calendar token database layer in one migration
- Recreate `encrypt_calendar_token`, `decrypt_calendar_token`, `get_calendar_tokens`, `upsert_calendar_connection`, and `update_calendar_access_token`.
- Ensure they run under the correct privileged owner and remain `SECURITY DEFINER`.
- Add explicit guards for missing key material and keep OAuth tokens stored as encrypted `bytea`.

2. Separate iCal URL storage from encrypted OAuth token storage
- Add a dedicated plain-text field for iCal subscription URLs.
- Stop reusing encrypted OAuth token columns for iCal feed URLs.
- Safely migrate any existing iCal records.

3. Align all calendar functions to the same contract
- Google: `google-calendar-callback`, `google-calendar-events`, `google-calendar-sync`, `calendar-sync-worker`, `google-calendar-disconnect`
- iCal: `ical-connect`, `ical-sync`, `ical-disconnect`
- Remove remaining direct reads of encrypted token columns where decrypted RPC access is required.

4. Add regression tests
- Successful Google callback token save
- Expired-token refresh path
- Connected vs disconnected responses
- iCal connect/sync after schema cleanup so Google and iCal no longer conflict

Validation plan after approval

1. Apply the migration and redeploy affected functions.
2. Reconnect Google Calendar from the app.
3. Verify `google-calendar-callback` returns 2xx and writes a valid connection row.
4. Verify background sync runs and `google-calendar-events` returns `connected: true`.
5. Trigger manual sync and confirm plans/availability import without 500s.
6. Confirm logs no longer show either:
- `COALESCE types bytea and text cannot be matched`
- `permission denied for function crypto_aead_det_encrypt`

Technical details

- The latest logs identify `google-calendar-callback` as the immediate failure point.
- The earlier `COALESCE bytea/text` error was real, but it was only the first visible bug.
- Once that mismatch was addressed, the deeper encryption-permission issue surfaced.
- The stable fix is not another one-line patch; it requires correcting both the DB function privilege chain and the mixed storage contract across Google and iCal.
