# Plan: Subscribable Workout Calendar Feed (`/calendar.ics`)

**Status:** Design / planning only — nothing implemented.
**Author:** drafted 2026-08-17
**Goal:** Publish an iCalendar feed of MHR practices, generated from `data/workouts.json`, that Apple Calendar, Google Calendar and Outlook can *subscribe* to (auto-refreshing), surfaced from a subscribe UI on `calendar.html`.

---

## 1. What the repo actually is (verified, not assumed)

### 1.1 Hosting and deploy path

| Fact | Evidence |
|---|---|
| Production is **GitHub Pages**, legacy (branch-served) build, `main` branch, repo root as the doc root | `gh api repos/daudt/mhr-website/pages` → `"build_type":"legacy"`, `"source":{"branch":"main","path":"/"}`, `"cname":"milehighrunners.com"`, `"https_enforced":true` |
| Live responses come from GitHub, not Cloudflare | `curl -I https://milehighrunners.com/` → `server: GitHub.com`, `x-github-request-id`, no `cf-ray` |
| No build step, no SSG, no backend in this repo | `README.md`, plain `*.html` + `styles.css` + `main.js` at repo root; no `_config.yml`, no bundler |
| `wrangler.jsonc` exists but is **dormant** | Added once in `2068679 Add Cloudflare Workers configuration (#18)`; never touched again; no deploy workflow references it; production headers prove it isn't serving |
| GitHub Pages already serves `.ics` with the right MIME type | `curl -I https://milehighrunners.com/data/races.ics` → `content-type: text/calendar`, `cache-control: max-age=600`, `access-control-allow-origin: *` |

**Consequence:** the site is *purely static*. There is no place in this repo to run a request-time handler. Any `.ics` must be a **file committed to `main`**.

### 1.2 Who writes the data

`data/workouts.json` is not hand-edited. Two external systems commit into this repo:

- **`admin.html`** (client-side admin console) posts to a **GCP Cloud Function**: `API_BASE_URL = https://us-central1-mhr-processor.cloudfunctions.net/mhr-admin-api` (`admin.html:831`). `saveWorkouts()` → `POST /workouts`; `cancelWorkout()` → `POST /workouts/cancel` (`admin.html:1325`). The admin only sends `{date, time, location_name, description}` — the function derives `location{name,address,map_link}`, `google_calendar_link` and `apple_calendar_link` and commits `data/workouts.json`. **This function's source is not in this repo.** Its commits are the `Update MHR data from email` ones.
- **`mhr-race-agent`** (`/Users/rafael/code/mhr-race-agent`), a homelab Talos/ArgoCD `CronJob` (`k8s/cronjob.yaml`, `schedule: "0 6 * * 0"`) that writes `data/races.json` **and generates `data/races.ics`** in `src/website_sync.py::generate_combined_ics()`, pushing via the GitHub Git Data API (`website_sync.py:127`). Its commits are `Update race calendar data (...)`.

**This is the key precedent: a subscribable `.ics` already exists on this site** (`data/races.ics`, 2076 lines), already has a subscribe UI (`races.html:82-100`, `.calendar-subscribe-bar` styles at `styles.css:1392-1440` + mobile at `styles.css:1819-1836`). The workouts feed should mirror it — and fix the things it gets wrong (§3.6).

### 1.3 How the schedule page works today

`calendar.html` fetches `data/workouts.json` client-side (inline `loadWorkouts()`), sorts by date, and renders cards. `index.html` has a near-identical copy of the same renderer.

Event shape as it exists **on `origin/main` today**:

```json
{
  "date": "2026-08-18",
  "time": "5:00 AM",
  "location": { "name": "Erie Middle School",
                "address": "650 Main Street, Erie, CO 80516",
                "map_link": "https://maps.google.com/?q=..." },
  "location_link": null,
  "description": "1-mile easy jog warmup, drills, ...",
  "google_calendar_link": "https://calendar.google.com/calendar/render?...",
  "apple_calendar_link": "data:text/calendar;base64,...",
  "cancelled": true,                      // optional
  "cancellation_reason": "Rain"           // optional
}
```

The `cancelled` flag **is** supported by the renderer on `origin/main` — `const isCancelled = workout.cancelled === true;` adds a `.cancelled-banner` and suppresses the per-event add-to-calendar links. (Note: it is **not** in the local working-tree checkout, which is ~4 months behind `origin/main`; see §8.)

> ⚠️ **Correction to the brief:** the schedule page is `calendar.html`, not a page at `/schedule`. And the local checkout at `/Users/rafael/code/mhr-website` is stale — `git log HEAD..origin/main` shows ~30 commits ahead, including the entire `cancelled` feature, the vitest/playwright test setup, and `wrangler.jsonc`. **Pull before implementing.**

### 1.4 The one hard constraint nobody has noticed yet

`data/workouts.json` is **fully replaced every week with only the current week's practices**:

```
48185bb: [2026-08-18, 2026-08-18, 2026-08-20, 2026-08-20, 2026-08-22]
d156e2f: [2026-08-11, 2026-08-11, 2026-08-13, 2026-08-13, 2026-08-15]
ceb260b: [2026-08-01, 2026-08-04, 2026-08-04, 2026-08-06, 2026-08-06, 2026-08-08]
```

For a **one-time import** that is harmless. For a **subscription** it is not: a subscribed client treats the feed as the complete truth, so every Sunday **last week's five events silently vanish from every subscriber's calendar**. Subscribers would end up with a calendar that only ever shows the current week and no history.

This is the single most important design decision in this plan, and it is handled in §2.3.

Two secondary facts from the same data:
- Two practices can share a date at different times (5:00 AM and 5:20 AM groups) → **UID must include the time**, not just the date.
- The existing backend already converts local→UTC correctly across DST (Aug 18 5:00 AM MDT → `20260818T110000Z`). We will *not* rely on that; we generate from `date` + `time` ourselves with an explicit `America/Denver` timezone (§3.2).

---

## 2. Architecture decision

### 2.1 Options

| Option | How | Verdict |
|---|---|---|
| **A. Dynamic endpoint** (Cloudflare Worker / GCP function serving `/calendar.ics` at request time) | Activate `wrangler.jsonc`, or add a route to `mhr-admin-api` | ❌ Rejected. Requires migrating the domain off GitHub Pages (or splitting DNS), introduces a runtime dependency and a second deploy path for a file that changes ~once a week. Buys nothing: no personalization, no auth, no per-request logic. |
| **B. Generated by the Cloud Function** at write time, committed alongside `workouts.json` | Add ICS emission to `mhr-admin-api` | ❌ Rejected as primary. Source lives in a separate GCP project outside this repo, is not covered by this repo's vitest/playwright suites, and can't be code-reviewed or tested here. High coupling, low visibility. |
| **C. GitHub Actions job in this repo**, triggered on pushes to `data/workouts.json`, regenerating and auto-committing `calendar.ics` | New `.github/workflows/calendar_ics.yml` + `scripts/generate_workouts_ics.js` | ✅ **Recommended.** |
| **D. Committed by hand** | — | ❌ Rejected. Data is machine-written weekly; a manual step would go stale within one week. |

### 2.2 Why C

- **Exact precedent already in the repo.** `.github/workflows/gallery_update.yml` does precisely this shape: `on: push: paths: ['images/gallery/**']` → `runs-on: mhr-website-runner` → `node scripts/update_gallery.js` → `stefanzweifel/git-auto-commit-action@v7` with `file_pattern: data/gallery.json` and `[skip ci]`. Copy that file and change three lines.
- **The generator is versioned and testable here.** `origin/main` already has `vitest` + `tests/` (`tests/update-gallery.test.ts`, `tests/gallery.test.ts`) and a `tests.yml` CI workflow. The ICS generator gets real unit tests in the same suite — which the race-agent generator never had.
- **Zero new infrastructure.** No Cloudflare migration, no new GCP surface, no ArgoCD app. Publishing is `git push` → Pages, same as everything else on this site.
- **Works no matter who writes the JSON.** Triggering on the *file path* means it fires for admin-console saves, cancellations, and any future writer, without those systems knowing the feed exists.
- **Cost of staleness is bounded.** Pages rebuild is ~30-60s after the workflow's commit; calendar clients poll on the order of hours anyway (§5).

Trade-off accepted: the feed lags the JSON by one CI run (seconds to a couple of minutes), and one extra bot commit lands per data update. Both are invisible to subscribers.

### 2.3 Feed history: the accumulating-archive requirement

Because `workouts.json` is a one-week rolling window, the generator must **not** emit only what's in the current JSON. Design:

- Maintain **`data/workouts-archive.json`** — an append-only, UID-keyed store of every practice ever published.
- On each run the generator:
  1. reads `data/workouts.json` (the authoritative *current* week),
  2. merges each event into the archive by UID — **upsert**, so an edit to a still-future practice updates in place,
  3. **never deletes** an archive entry merely because it fell out of the current window,
  4. emits `calendar.ics` from `archive ∪ current`, optionally trimming events older than a retention horizon (recommend **13 months**, so a year of history stays visible and the file stays small).
- **Absence ≠ cancellation.** Only an explicit `"cancelled": true` produces `STATUS:CANCELLED`. An event disappearing from `workouts.json` is normal weekly rollover and must leave the archived event untouched.

This preserves the guarantee subscribers expect: past practices stay on their calendar, edits apply in place, and a real cancellation propagates as a cancellation.

> Alternative if the club decides history is unwanted: skip the archive and accept that the calendar only ever holds the current week. That is a legitimate product choice but should be *chosen*, not stumbled into — and it makes the subscription much less valuable than a one-time import. Flagged in §9.

### 2.4 URL

Serve at **`https://milehighrunners.com/calendar.ics`** (repo-root file `calendar.ics`).

- Root path, not `data/`, because it's a public-facing product URL people paste into calendar apps and read aloud.
- Do **not** name it `workouts.ics` unless you want to explain the difference from `races.ics` in every support conversation; `calendar.ics` matches the page it lives on (`calendar.html`) and the nav item ("Calendar").
- `data/races.ics` stays where it is. Optionally add `races.ics` at root later as a redirect-free duplicate; out of scope here.
- Also add the file to `sitemap.xml`? **No** — sitemaps are for HTML. Skip.

---

## 3. Feed specification

### 3.1 Calendar-level properties

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mile High Runners//Workout Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Mile High Runners Practices
X-WR-CALDESC:Weekly group workouts for Mile High Runners — Erie, Colorado
X-WR-TIMEZONE:America/Denver
NAME:Mile High Runners Practices
DESCRIPTION:Weekly group workouts for Mile High Runners — Erie, Colorado
REFRESH-INTERVAL;VALUE=DURATION:PT4H
X-PUBLISHED-TTL:PT4H
SOURCE;VALUE=URI:https://milehighrunners.com/calendar.ics
COLOR:darkblue
...VTIMEZONE...
...VEVENTs...
END:VCALENDAR
```

Notes:
- `REFRESH-INTERVAL` (RFC 7986) and `X-PUBLISHED-TTL` (Microsoft/Apple) are both **hints**; every client is free to ignore them. `PT4H` is a reasonable ask — data changes weekly, so anything shorter is pointless load, anything longer risks missing a same-week cancellation.
- `NAME`/`DESCRIPTION` are the RFC 7986 standard forms; `X-WR-*` are the legacy forms Apple/Google actually honor. Emit both.
- `SOURCE` lets a client re-resolve the feed URL.
- `METHOD:PUBLISH` matters for Outlook. Keep it.

### 3.2 VTIMEZONE — America/Denver

Emit **floating-free, TZID-qualified** local times rather than `Z`-suffixed UTC:

```
DTSTART;TZID=America/Denver:20260818T050000
DTEND;TZID=America/Denver:20260818T060000
```

with a `VTIMEZONE` block for `America/Denver` (MST −0700 / MDT −0600, US DST rules — second Sunday in March, first Sunday in November, both at 02:00 local):

```
BEGIN:VTIMEZONE
TZID:America/Denver
X-LIC-LOCATION:America/Denver
BEGIN:DAYLIGHT
TZOFFSETFROM:-0700
TZOFFSETTO:-0600
TZNAME:MDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0600
TZOFFSETTO:-0700
TZNAME:MST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
```

Why not just UTC (what `races.ics` does)? Because a UTC instant is *correct but brittle*: it bakes the offset in at generation time, so any future change to how the time is computed, or a re-render across a DST boundary, silently shifts a 5:00 AM practice by an hour. TZID + VTIMEZONE says "5:00 in Denver," which is what the club actually means, and lets the client resolve the offset.

Parse `time` from the human string (`"5:00 AM"`, `"6:30 AM"`, occasionally custom via the admin's `prompt()`), so the parser must tolerate `H:MM AM/PM` with and without leading zero, and fall back safely (log + skip the event rather than emit a garbage `DTSTART`).

### 3.3 Per-event VEVENT

```
BEGIN:VEVENT
UID:<sha1(summary|date|time)>@milehighrunners.com
DTSTAMP:<generation time, UTC>
SEQUENCE:<bump on change>
DTSTART;TZID=America/Denver:20260818T050000
DTEND;TZID=America/Denver:20260818T060000
SUMMARY:MHR Practice — Erie Middle School
DESCRIPTION:<workout text>\n\nDetails: https://milehighrunners.com/calendar.html
LOCATION:Erie Middle School\, 650 Main Street\, Erie\, CO 80516
GEO / URL:<location.map_link>          (URL only; skip GEO, we have no coordinates)
STATUS:CONFIRMED
TRANSP:OPAQUE
CATEGORIES:Running,Practice
BEGIN:VALARM
TRIGGER:-PT45M
ACTION:DISPLAY
DESCRIPTION:MHR practice in 45 minutes
END:VALARM
END:VEVENT
```

**UID.** `sha1(summary + "|" + date + "|" + time)`, hex, `@milehighrunners.com`. Must include `time` — two practices share a date (5:00/5:20 groups). Must be **stable across regenerations**: this is what makes an edit apply *in place* instead of creating a duplicate. Deliberately **excludes** location and description so that fixing a typo in the workout text, or moving the venue, updates the existing event rather than orphaning it and creating a new one. (Consequence: changing the *time* of a practice creates a new UID — the old event must be emitted as `STATUS:CANCELLED` to retire it. Handle this in the archive merge: if an archived UID for the same date is superseded by a different-time event in the current week, mark the old one cancelled. Flagged as an open question in §9.)

**Duration.** No end time exists in the data. Default **60 minutes**; the Saturday 6:30/7:00 AM long run is realistically longer — recommend **90 minutes for Saturday** events, or add an optional `duration_minutes` field to the data model later. Do not copy the race agent's `+4 hours` heuristic (`website_sync.py:257`).

**SUMMARY.** `MHR Practice — <location.name>` reads far better in a month grid than the current backend's `MHR Workout: EMS`. Keep it short; the grid truncates.

**DESCRIPTION.** Full workout text, escaped per RFC 5545 (`\` → `\\`, `;` → `\;`, `,` → `\,`, newline → `\n`). Append a link back to `calendar.html`. Optionally also emit `X-ALT-DESC;FMTTYPE=text/html` for Outlook rich text — nice-to-have, not required.

**VALARM.** Include one `-PT45M` display alarm. Note the gotcha: **Google Calendar ignores VALARM in subscribed feeds** (subscribers set their own notification defaults); Apple honors it. Harmless either way, mildly useful for Apple users at a 5:00 AM practice.

**Cancellations.** When `workout.cancelled === true`:
```
STATUS:CANCELLED
SUMMARY:CANCELLED — MHR Practice — Erie Middle School
DESCRIPTION:<cancellation_reason>\n\n<original workout text if any>
```
Setting `STATUS:CANCELLED` **and** prefixing the summary is belt-and-braces: Apple greys/strikes the event, Google's handling of `STATUS:CANCELLED` in subscribed (non-invite) feeds is inconsistent, and the summary prefix guarantees the user sees it regardless. Also bump `SEQUENCE`. Keep the event in the feed — **removing** it is worse, because a client that already fetched it may keep a stale confirmed copy.

**SEQUENCE.** Store a per-UID `sequence` integer in `workouts-archive.json`; increment whenever any emitted field for that UID changes. Some clients use it to decide whether an update is newer.

### 3.4 Line folding and encoding

RFC 5545 requires lines ≤ 75 **octets**, folded with CRLF + single leading space, and CRLF line endings throughout. Workout descriptions here run 200–400 characters with en-dashes and other non-ASCII — folding must count **bytes, not characters**, and must never split a multi-byte UTF-8 sequence. This is exactly the kind of thing to get from a library rather than hand-roll (§4.1). Note `data/races.ics` is **not** folded at all (`DESCRIPTION` lines run 200+ chars) — technically non-conformant, tolerated by major clients, but not a pattern to copy.

### 3.5 Headers and caching

On GitHub Pages headers are **not configurable**. What we get, verified on `data/races.ics`:

```
content-type: text/calendar          ✅ correct (charset not stated; clients default to UTF-8 and the file is UTF-8)
cache-control: max-age=600           ✅ 10 min — well under our 4h refresh hint, so never a staleness problem
access-control-allow-origin: *       ✅ allows a future browser-side fetch
etag / last-modified                 ✅ conditional GETs work; polling clients get cheap 304s
https_enforced: true                 ✅ required by Google
```

Nothing to do. If the site ever moves to Cloudflare (`wrangler.jsonc`), add `_headers` with `Content-Type: text/calendar; charset=utf-8` explicitly.

### 3.6 Deltas from the existing `races.ics` (things to do better)

| `races.ics` today | This feed |
|---|---|
| UTC `Z` times, no `VTIMEZONE` | `TZID=America/Denver` + `VTIMEZONE` |
| No `REFRESH-INTERVAL` / `X-PUBLISHED-TTL` | Both, `PT4H` |
| No line folding | RFC-conformant folding |
| Only `,` escaped in `LOCATION`; `;` and `\` unescaped | Full RFC 5545 escaping |
| `DTSTAMP` = midnight of generation day | True generation timestamp |
| All events `STATUS:CONFIRMED`, no cancellation path | `STATUS:CANCELLED` propagation |
| No `SEQUENCE` | Per-UID `SEQUENCE` |
| Hand-built f-strings | Library-generated + unit-tested |

Once this feed is proven, consider backporting the same generator to `mhr-race-agent`. Out of scope here; worth a follow-up issue.

---

## 4. Implementation shape

### 4.1 `scripts/generate_workouts_ics.js`

Node 20 (matches `gallery_update.yml`'s `actions/setup-node@v6` with `node-version: '20'`), CommonJS or ESM to match `scripts/update_gallery.js`.

Library choice: **`ical-generator`** (actively maintained, correct folding/escaping, native `VTIMEZONE` support via `@touch4it/ical-timezones` or a `timezone` callback, TypeScript types). Alternative `ics` is simpler but weaker on VTIMEZONE. Adding a dependency is acceptable — `package.json` already exists on `origin/main` with a real dependency tree.

Shape:

```
readJson('data/workouts.json')            -> current[]
readJson('data/workouts-archive.json')    -> archive{uid: event}   (create if absent)
for e in current: uid = sha1(summary|date|time)
                  upsert into archive, bump sequence if changed
prune archive entries older than 13 months
emit calendar.ics from archive (sorted by start)
write data/workouts-archive.json
```

Deterministic output is important: **do not** write a fresh `DTSTAMP` when nothing else changed, or every run produces a diff and a pointless commit. Either keep a per-UID `dtstamp` in the archive and only bump it on change, or have the workflow's `git-auto-commit-action` treat a DTSTAMP-only diff as a no-op (harder). Prefer the former.

### 4.2 `.github/workflows/calendar_ics.yml`

Clone of `gallery_update.yml`:

```yaml
on:
  push:
    paths: ['data/workouts.json']
  workflow_dispatch:
jobs:
  build-ics:
    runs-on: mhr-website-runner        # existing self-hosted runner
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/generate_workouts_ics.js
      - uses: stefanzweifel/git-auto-commit-action@v7
        with:
          commit_message: "Auto-update calendar.ics [skip ci]"
          file_pattern: "calendar.ics data/workouts-archive.json"
```

`[skip ci]` in the message prevents a loop. Note the workflow runs on `mhr-website-runner`, a self-hosted runner in the homelab cluster — confirm it has network egress for `npm ci` (the gallery job doesn't install anything, so this is genuinely unverified; §9).

### 4.3 Subscribe UI on `calendar.html`

Reuse the existing, already-styled `.calendar-subscribe-bar` component from `races.html:82-100` (`styles.css:1392-1440`, mobile `styles.css:1819-1836`) — no new CSS needed beyond a small addition for the copy button. Place it directly under `<h2>Upcoming Events</h2>` in the `.calendar-section` block, above `#workouts-container`.

```html
<div class="calendar-subscribe-bar">
  <div class="subscribe-info">
    <i class="fas fa-calendar-alt"></i>
    <span>Subscribe to get every practice on your calendar automatically</span>
  </div>
  <div class="subscribe-buttons">
    <a href="webcal://milehighrunners.com/calendar.ics"
       class="subscribe-btn apple-btn"><i class="fab fa-apple"></i> Apple Calendar</a>
    <a href="https://calendar.google.com/calendar/r?cid=https%3A%2F%2Fmilehighrunners.com%2Fcalendar.ics"
       target="_blank" rel="noopener"
       class="subscribe-btn google-btn"><i class="fab fa-google"></i> Google Calendar</a>
    <button type="button" class="subscribe-btn copy-btn"
            data-feed="https://milehighrunners.com/calendar.ics">
      <i class="fas fa-link"></i> Copy feed URL</button>
    <a href="calendar.ics" download="mhr-practices.ics"
       class="subscribe-btn ics-btn"><i class="fas fa-download"></i> Download .ics</a>
  </div>
</div>
<details class="subscribe-help">…per-client instructions…</details>
```

Details:
- **Apple** → `webcal://`. macOS/iOS register the scheme and open Calendar's "Subscribe to Calendar" sheet directly. One click.
- **Google** → `https://calendar.google.com/calendar/r?cid=<url-encoded **https** URL>`. **Important fix vs. `races.html`:** that page passes `cid=webcal://...` **unencoded** (`races.html:88`). Google's add-by-URL flow wants an encoded `https` URL; the `webcal` scheme there is at best undocumented behavior. Use `cid=https%3A%2F%2F…`.
- **Copy button** → `navigator.clipboard.writeText(...)` with a toast/label swap ("Copied!"), and a `document.execCommand('copy')` textarea fallback for non-secure contexts. `admin.html:1674` already has a working clipboard + toast pattern to copy from. The raw URL should also be visible as selectable text (`<code>`) for anyone whose clipboard API is blocked.
- **`<details>` help block** with three short, literal walkthroughs (Google: *Other calendars → + → From URL → paste → Add calendar*; Apple: *File → New Calendar Subscription*, or just tap the button; Outlook: *Add calendar → Subscribe from web*). Include the "Google can take up to ~24h to pick up changes" caveat right there, because that's the #1 support question this feature will generate.
- Mirror onto `index.html` only if the homepage schedule block should also offer it — recommend **no**, keep one canonical place.
- Keep the existing per-event Google/Apple one-off links; they serve a different need (adding a single session).

---

## 5. Cross-client compatibility

| Client | How to subscribe | Refresh cadence | Gotchas |
|---|---|---|---|
| **Apple Calendar** (macOS/iOS) | `webcal://` one-click, or paste `https://` into *File → New Calendar Subscription* | User-configurable per calendar: Every 5 min / 15 min / hour / day. Default often **daily** | Honors `VALARM` but iOS asks whether to keep alerts on subscribe. `X-WR-CALNAME` sets the calendar name. Handles `TZID` + `VTIMEZONE` correctly. `STATUS:CANCELLED` renders greyed/struck. |
| **Google Calendar** | *Other calendars → + → From URL → paste `https://…` → Add calendar*. The `?cid=` link is a shortcut to the same flow | **Google's own schedule, not ours. Typically 8–24 hours, occasionally longer.** `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` are **ignored**. There is no way to force a refresh | **Must be a public, internet-reachable `https://` URL with no auth** — Google's fetchers are anonymous and won't follow a login. ✅ `milehighrunners.com` qualifies (Pages, `https_enforced`, no auth). **No `webcal://` support** in the add-by-URL box. **Ignores `VALARM`** in subscribed feeds. Aggressively caches — a same-day cancellation will *not* reliably reach Google subscribers, which the UI copy must say. Also strips/ignores `COLOR`. |
| **Outlook.com / Microsoft 365** | *Add calendar → Subscribe from web → paste `https://…`* | Server-side, ~3–24h, not user-controllable | Honors `X-PUBLISHED-TTL` loosely. `METHOD:PUBLISH` should be present. Wants strict RFC line folding — sloppy folding is where Outlook breaks first (another reason for §3.4). Renders `X-ALT-DESC` HTML if present. |
| **Outlook desktop (classic)** | *Open Calendar → From Internet* | Follows `X-PUBLISHED-TTL` | Same folding sensitivity. |
| **Thunderbird / Android (via Google)** | Standard ICS URL | Thunderbird configurable, often 30 min | Android has no native ICS subscription — it goes through the Google account, so Google's cadence applies. |

**Design consequence:** because the slowest common client refreshes on the order of a day, the feed is excellent for "what's the plan this week" and **unreliable for same-morning cancellations**. Cancellations must continue to be communicated by the club's existing channels (email/Facebook) and the website banner; the calendar feed is a best-effort mirror. State this plainly in the UI copy.

---

## 6. Testing and validation

**Unit (vitest, `tests/generate-workouts-ics.test.ts`)** — fits the existing suite on `origin/main`:
1. Fixture week → snapshot of full ICS output.
2. UID stability: same event, two runs → identical UID; same date different time → different UIDs.
3. Same-day 5:00 / 5:20 pair both present and distinct.
4. `cancelled: true` → `STATUS:CANCELLED` + `CANCELLED —` prefix + bumped `SEQUENCE`.
5. Archive merge: event drops out of `workouts.json` → **still in** `calendar.ics`, still `CONFIRMED`.
6. Archive merge: description edited on a still-current event → same UID, updated `DESCRIPTION`, `SEQUENCE` +1.
7. Escaping: description containing `,` `;` `\` and a newline round-trips.
8. Folding: no output line exceeds 75 octets; UTF-8 (en-dash) not split mid-sequence.
9. DST: a March and a November practice both resolve to the correct wall-clock local time.
10. Malformed `time` string → event skipped, non-zero warning, no crash and no corrupt `DTSTART`.
11. Determinism: two consecutive runs on unchanged input produce a byte-identical file (no spurious commits).

**Parser validation (CI step, not eyeballing):**
- Parse the generated file with an independent implementation — `node-ical` or Python `icalendar` — and assert event count, summaries, and resolved UTC instants. Using a *different* library than the generator is the point.
- Run it through a public validator (`icalendar.org/validator.html`, or `icalvalidator`) once during development; optionally wire `npx ical-validator` into CI.

**End-to-end, manual, once before announcing:**
1. Subscribe in **Apple Calendar** (macOS) via the `webcal://` button; set refresh to 15 min; confirm name, times, location, alarm.
2. Subscribe in **Google Calendar** via *From URL*; confirm it accepts the URL and events appear (allow up to 24h for the first sync).
3. Subscribe in **Outlook.com** via *Subscribe from web*.
4. **Update test:** edit a description via the admin console → confirm the workflow ran, `calendar.ics` changed, and the Apple subscription shows the new text after a forced refresh **on the same event** (no duplicate created).
5. **Cancellation test:** cancel a practice via the admin console → confirm `STATUS:CANCELLED` in the raw file and that Apple shows it struck through. Record what Google actually does — this is the compatibility claim most likely to differ from the docs.
6. **Rollover test:** wait for (or simulate) the weekly JSON replacement → confirm the prior week's events are **still present** in the feed and still on the subscribed calendar. This is the regression that would quietly ruin the feature.
7. Verify live headers: `curl -I https://milehighrunners.com/calendar.ics` → `content-type: text/calendar`, 200.

---

## 7. Phased implementation checklist

**Phase 0 — prep**
- [ ] `git pull` — local checkout is ~30 commits behind `origin/main` (§8).
- [ ] Confirm `mhr-website-runner` can reach the npm registry (`npm ci` in a scratch workflow).
- [ ] Decide the archive question (§2.3) and the Saturday-duration question (§3.3) with Doug.

**Phase 1 — generator**
- [ ] Add `ical-generator` to `package.json`.
- [ ] Write `scripts/generate_workouts_ics.js` (parse, UID, archive merge, prune, emit).
- [ ] Write `tests/generate-workouts-ics.test.ts` (§6 cases 1–11).
- [ ] Seed `data/workouts-archive.json` — either empty, or backfilled by replaying `git log` over `data/workouts.json` (nice-to-have; gives subscribers real history from day one).

**Phase 2 — automation**
- [ ] Add `.github/workflows/calendar_ics.yml`.
- [ ] Trigger via `workflow_dispatch`; verify `calendar.ics` lands on `main` and `[skip ci]` prevents a loop.
- [ ] Confirm `https://milehighrunners.com/calendar.ics` serves 200 + `text/calendar`.
- [ ] Validate the live file with an independent parser.

**Phase 3 — UI**
- [ ] Add `.calendar-subscribe-bar` block to `calendar.html`.
- [ ] Add copy-to-clipboard handler (+ minimal `.copy-btn` CSS) and the `<details>` per-client instructions.
- [ ] Fix `races.html:88` to use an encoded `https` `cid` while in there.
- [ ] Playwright spec: buttons render, `webcal://` and `cid=` hrefs are correct, copy button writes the expected URL.

**Phase 4 — validate & launch**
- [ ] Manual subscribe in Apple, Google, Outlook (§6 e2e 1–3).
- [ ] Update + cancellation + rollover propagation tests (§6 e2e 4–6).
- [ ] Announce to the club; add a line to `README.md`.

**Phase 5 — follow-ups (separate issues)**
- [ ] Backport the conformant generator to `mhr-race-agent`'s `generate_combined_ics()`.
- [ ] Optional combined feed (practices + races) at `/all.ics`.
- [ ] Optional `duration_minutes` field in the workout data model.

---

## 8. Assumptions

1. **Production stays on GitHub Pages.** If the domain moves to the dormant Cloudflare Worker config, §2's recommendation still works unchanged (the file is just a static asset there too) — only §3.5 gains a `_headers` file.
2. **`data/workouts.json` remains the single source of truth** and keeps its current shape (`date`, `time`, `location{}`, `description`, `cancelled`, `cancellation_reason`). The feed never diverges from the schedule page because both read the same file.
3. **The GCP Cloud Function keeps committing to `main`** — the trigger is a push path, so the workflow fires regardless of which system writes the file.
4. **The local checkout is stale.** `/Users/rafael/code/mhr-website` is at `8718c32` (Apr 11); `origin/main` is at `48185bb` (Aug 16) with ~30 commits including the whole `cancelled` feature, `package.json`/vitest/playwright, `wrangler.jsonc`, and `tests.yml`. Every file reference in this plan is to **`origin/main`**.
5. Practices are ~1 hour on weekdays; Saturdays are longer (see open questions).
6. Feed volume stays trivial — ~5 events/week, ~260/year; a 13-month window is well under 100 KB even unfolded.

## 9. Open questions

1. **Do subscribers want history?** (§2.3) Archive + accumulate (recommended) vs. current-week-only. This changes whether `data/workouts-archive.json` exists at all, and it's a club decision, not a technical one.
2. **Event durations.** 60 min for weekday speed sessions and 90 min for the Saturday long run is a guess. Ask Doug for real numbers, or add `duration_minutes` to the admin form.
3. **Time changes.** If a practice moves from 5:20 AM to 5:00 AM, the sha1-based UID changes. Should the generator detect "same date, time changed" and emit the old UID as `STATUS:CANCELLED`? (Recommended — otherwise subscribers keep a ghost event.) Adds real complexity to the archive merge; confirm it's worth it.
4. **Does `mhr-website-runner` have npm-registry egress?** Nothing in the repo currently runs `npm ci` on that runner. If it doesn't, either vendor the dependency, hand-roll the ICS writer (adds the folding/escaping burden of §3.4 back), or run the job on `ubuntu-latest`.
5. **Backfill the archive from git history?** Replaying every historical `data/workouts.json` from `git log` would give subscribers a year of past practices on day one. Cheap and one-off — worth doing, but confirm the historical entries are clean enough (the schema drifted: older entries lack `location_link`, and the very old ones may differ further).
6. **Two groups, one feed.** The 5:00 AM and 5:20 AM sessions are different pace groups. Should there be one feed (both events, both appear) or two (`/calendar-500.ics`, `/calendar-520.ics`)? One feed is the right start; note that subscribers will see two events every practice day and may find that noisy.
7. **Should the feed include races too?** Some members will assume "the MHR calendar" means everything. Keeping them separate matches the current site structure; a combined `/all.ics` is a cheap follow-up.
8. **`X-WR-CALNAME` wording.** "Mile High Runners Practices" vs. "MHR Workouts" vs. "MHR Training" — this string becomes the calendar name in every subscriber's sidebar, so it's worth 30 seconds of thought.

---

## Appendix: file map

| Path (on `origin/main`) | Role | Change |
|---|---|---|
| `data/workouts.json` | source of truth, machine-written weekly | none |
| `data/workouts-archive.json` | accumulating UID-keyed history | **new** |
| `calendar.ics` | published feed | **new (generated)** |
| `scripts/generate_workouts_ics.js` | generator | **new** |
| `tests/generate-workouts-ics.test.ts` | unit tests | **new** |
| `.github/workflows/calendar_ics.yml` | regenerate + auto-commit | **new** |
| `calendar.html` | schedule page + subscribe UI | **edit** |
| `styles.css` | `.calendar-subscribe-bar` (exists), `.copy-btn` | **small edit** |
| `races.html:88` | `cid=webcal://` bug | **fix in passing** |
| `package.json` | add `ical-generator` | **edit** |
| `admin.html:831,1325` | Cloud Function writer, cancel flow | none (reference) |
| `.github/workflows/gallery_update.yml` | template for the new workflow | none (reference) |
| `/Users/rafael/code/mhr-race-agent/src/website_sync.py:336` | existing ICS generator | none (reference / later backport) |
