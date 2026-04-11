# Playwright QA

This app now has a small Playwright suite for the outage-focused resilience checks that were validated manually in the interactive browser session.

The suite also covers the first set of deterministic happy-path UI checks so the app is not only tested for failure states.

## What it covers

- Demo sign-in keeps the callback on the local `127.0.0.1` origin.
- Protected pages render explicit unavailable states instead of misleading empty states.
- The workspace and settings pages keep `no_team` distinct from backend-unavailable handling.
- The instructor page does not confuse backend failure with instructor-only access control.
- The instructor page keeps `instructor_required` distinct from backend-unavailable handling.
- The settings page does not fall back to placeholder team data.
- The workspace patient selector shows a fetch failure state instead of `No patients found`.
- Login and workspace-unavailable states fit a `390x844` viewport without horizontal overflow.
- Workspace ready state renders team context and patient selection behavior.
- Settings ready state renders real members and saved configs.
- Create-team and join-team flows are validated with deterministic API stubs.

## Commands

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:debug`

## Notes

- The suite starts the local Next dev server on `http://127.0.0.1:3117`.
- `.env.local` is still loaded, but the outage checks are network-stubbed so they stay deterministic whether Supabase is healthy or down.
- If Chromium is missing on a new machine, run `npx playwright install chromium` once.
