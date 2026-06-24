# Familjebudget

A small, self-contained web app for planning a household budget one month at a time:
enter your income and expenses, group related items together, and see your balance,
savings rate, and where the money goes at a glance.

It is a single static page with no backend, no framework, and no build step. Your data
lives in your own OneDrive and syncs across devices when you sign in with a personal
Microsoft account. The interface is in Swedish.

## What it is for

It is meant for a couple or family who want a shared, no-fuss monthly budget that works
the same on a laptop and a phone. You plan each month (often by copying the previous one),
adjust the numbers as life changes, and keep an eye on whether you are spending less than
you earn. No spreadsheets, no accounts to manage, no data leaving your own OneDrive.

## Features

- **Month-by-month planning** — a horizontal month rail at the top; create a new month
  (optionally copying the current one), switch by tapping or swiping, and delete months
  you no longer need.
- **Income and expenses** — simple name-and-amount rows for each month.
- **Groups with sub-entries** — turn a row into a group (for example "Lån") and nest the
  individual items under it; the group shows the combined total and collapses to de-clutter.
- **Reorder and undo** — drag rows to reorder them; deleting a row or group shows an
  "Ångra" (undo) toast so a mistap is never destructive.
- **At-a-glance summary** — totals for income, expenses, and balance, a savings-rate pill,
  a spent-vs-income flow bar, and a per-expense bar showing each cost's share of the total.
- **Browse vs edit mode** — a toggle that locks the view into a clean, read-only list.
  It defaults to locked on phones so scrolling the budget never triggers an accidental edit.
- **Automatic light/dark theme** — follows your operating system setting; no manual switch.
- **Add to home screen** — installs as a standalone, full-screen app on mobile and desktop.

## How data and sync work

- **Storage:** signing in with OneDrive saves one `budget.json` inside the app's own
  OneDrive folder (`Apps/Familjebudget/`) via the Microsoft Graph API. A copy is mirrored
  in the browser's local storage so the app stays responsive and works while offline.
- **Multi-device sync:** each month carries a timestamp, and saves do a
  read-merge-write — so two people editing different months both keep their changes, and
  the app does not blindly overwrite the cloud copy. Conditional writes guard against two
  saves landing at the same instant.
- **Scope:** the app can only read and write that single `budget.json`; the OneDrive
  permission it requests does not grant access to anything else in your drive.

## Project structure

No bundler or package manager is involved. The files are served exactly as they are.

```
index.html            Markup and the page shell
styles/               CSS, split by concern and using native CSS nesting
  base.css            Design tokens (colors, spacing), reset, light/dark variables
  layout.css          Page grid and side cards
  components.css      Month rail, buttons, cards, rows, inputs, groups
  overlays.css        Toasts and dialogs
  modes.css           Browse/edit (locked) mode
  responsive.css      Mobile breakpoints
scripts/              Plain JavaScript, loaded in order (classic scripts, not modules)
  helpers.js          Constants and pure helpers (formatting, month math, totals)
  state.js            App state, local storage, save/debounce
  render.js           Rendering, row building, drag-to-reorder
  actions.js          Add/delete/months, browse-vs-edit and theme
  sync.js             OneDrive sign-in and the merge sync
  toast.js            Toast notifications
  main.js             Event wiring and startup
```

The only external dependency is the Microsoft Authentication Library (MSAL), loaded from a
CDN for sign-in. ES modules are deliberately avoided so the page also opens directly from
the filesystem (`file://`) for quick local viewing.

## Running it

- **Hosted:** open the GitHub Pages URL and sign in with OneDrive to enable sync.
- **Locally:** open `index.html` in a Chromium-based desktop browser. The interface works
  from `file://`, but OneDrive sign-in does not (it needs a real https origin), so local
  viewing is best for trying out the UI rather than editing synced data.

## Deploying your own copy

1. Host the static files anywhere (GitHub Pages works well).
2. Create a Microsoft Entra (Azure AD) app registration:
   - Platform: Single-page application
   - Authority: consumers (personal Microsoft accounts)
   - Delegated permission: `Files.ReadWrite.AppFolder`
   - Redirect URI: your exact deployment URL (it must match `location.origin + location.pathname`)
3. Put that registration's client ID in `scripts/sync.js`.

The client ID is a public identifier and is safe to commit; there is no client secret. What
protects the app is the redirect-URI allowlist on the registration.

## Privacy

Your budget figures stay between your browser and your own OneDrive. `budget.json` is your
personal data and is not part of this repository (it is git-ignored). There is no server,
database, or analytics of any kind.

## Credits

Created by Deansie. Co-authored with Claude (Anthropic).
