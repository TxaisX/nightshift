# Built-in browser commands

Use a snapshot-interact-re-snapshot loop:

```text
NIGHTSHIFT goto --url https://example.com --json
NIGHTSHIFT snapshot --json
NIGHTSHIFT click --element @e3 --json
NIGHTSHIFT snapshot --json
```

Common commands:

```text
NIGHTSHIFT goto --url <url> --json
NIGHTSHIFT back --json
NIGHTSHIFT reload --json
NIGHTSHIFT snapshot --json
NIGHTSHIFT screenshot --json
NIGHTSHIFT full-screenshot --json
NIGHTSHIFT pdf --json
NIGHTSHIFT click --element <ref> --json
NIGHTSHIFT fill --element <ref> --value <text> --json
NIGHTSHIFT type --input <text> --json
NIGHTSHIFT select --element <ref> --value <value> --json
NIGHTSHIFT check --element <ref> --json
NIGHTSHIFT scroll --direction down --amount 1000 --json
NIGHTSHIFT hover --element <ref> --json
NIGHTSHIFT focus --element <ref> --json
NIGHTSHIFT keypress --key Enter --json
NIGHTSHIFT upload --element <ref> --files <paths> --json
NIGHTSHIFT wait --text <text> --json
NIGHTSHIFT wait --url <substring> --json
NIGHTSHIFT wait --selector <css> --json
NIGHTSHIFT wait --load networkidle --json
NIGHTSHIFT eval --expression <js> --json
NIGHTSHIFT tab list --json
NIGHTSHIFT tab create --url <url> --json
NIGHTSHIFT tab switch --index <n> --json
NIGHTSHIFT tab close --index <n> --json
NIGHTSHIFT cookie get --json
NIGHTSHIFT capture start --json
NIGHTSHIFT console --limit 50 --json
NIGHTSHIFT network --limit 50 --json
NIGHTSHIFT exec --command "help" --json
```

Browser rules:

- Re-snapshot after navigation, tab switches, clicks that change the page, and any `browser_stale_ref`.
- Refs like `@e1` are assigned by `snapshot`, scoped to one tab, and invalidated by navigation or tab switch.
- Browser commands default to the current worktree and its active tab. Use `--worktree all` only intentionally.
- For concurrent browser work, run `NIGHTSHIFT tab list --json`, read `tabs[].browserPageId`, and pass `--page <browserPageId>` on later commands.
- Use typed tab commands (`NIGHTSHIFT tab list/create/close/switch`), not `NIGHTSHIFT exec --command "tab ..."`, so Nightshift keeps UI state synchronized.
- Prefer `wait --text`, `--url`, `--selector`, or `--load` after async page changes instead of bare timeouts.
- Anything not listed above goes through `NIGHTSHIFT exec --command "<agent-browser command>"`.
- If `fill` or `type` fails on a custom input, try `NIGHTSHIFT focus --element @e1 --json` then `NIGHTSHIFT inserttext --text "text" --json`.
- A client-hosted page renders in the paired desktop's browser engine, so every command against it needs that desktop online and returns `browser_host_unavailable` while it is closed, asleep, or disconnected. Server-hosted pages run with no desktop attached; prefer them for long or unattended automation.

Common recoveries:

- `browser_no_tab`: open a tab with `NIGHTSHIFT tab create --url <url> --json`.
- `browser_stale_ref`: run `NIGHTSHIFT snapshot --json` and retry with fresh refs.
- `browser_tab_not_found`: run `NIGHTSHIFT tab list --json` before switching or closing.
- `browser_host_unavailable`: the desktop hosting the page is offline. Bring it back, or recreate the page with server placement if the work must outlive the desktop session.
