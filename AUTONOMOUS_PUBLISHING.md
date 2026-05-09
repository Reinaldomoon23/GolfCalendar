# Autonomous Publishing Guide

This project can be published autonomously when GitHub credentials and local build tools are available. Do not paste or commit secrets in this file.

## Current Repository

- GitHub repo: `Reinaldomoon23/GolfCalendar`
- Main branch: `main`
- Vercel project: `golf-calendar-v3`
- Vercel project id: `prj_13iKD9uvOU1e2nyN9vxT9xDR7rCd`
- Vercel org id: `team_SUF3caTf642UMgmYsaknfd0f`
- Production app base path: `/GolfTeam/`
- Primary production deploy trigger: `git push origin main`

## Mandatory Start Protocol

Before editing code, read:

1. `LEADERBOARD_PROGRESS.log`
2. `LEADERBOARD_ROADMAP.md`

Before each implementation step, state:

1. Roadmap step being implemented
2. Files that will be touched
3. Expected result

At the end of a coding session:

1. Update `LEADERBOARD_PROGRESS.log` when the leaderboard roadmap state changes.
2. Run focused validation.
3. Commit locally.
4. Push to GitHub.

## GitHub Publishing

Preferred flow:

```bash
git status --short --branch
git add <changed-files>
git commit -m "Clear change summary"
git push origin main
```

If the local `origin` remote cannot authenticate, use a GitHub Personal Access Token only for the push command:

```bash
GITHUB_TOKEN='<temporary-token>'
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/Reinaldomoon23/GolfCalendar.git" main
git remote set-url origin https://github.com/Reinaldomoon23/GolfCalendar.git
git fetch origin main
git status --short --branch
```

Token requirements:

- Classic PAT: `repo` scope for private repos, or enough repo contents access for public repos.
- Fine-grained PAT:
  - Resource owner: `Reinaldomoon23`
  - Repository: `GolfCalendar`
  - Repository permissions: `Contents: Read and write`

Never leave a PAT embedded in `git remote -v`.

## Vercel Publishing

Normal production path:

1. Push to `main`.
2. Vercel automatically builds and deploys the commit.
3. Check Vercel project `golf-calendar-v3` for the new deployment.

Manual Vercel deploy requires:

```bash
npx vercel login
npx vercel --prod --yes
```

The root `.vercel/project.json` links the local project to Vercel. `vercel.json` keeps React Router SPA routes working and routes `/api/*` to Vercel serverless functions.

## Full Deploy Command

When local Node/npm dependencies are healthy:

```bash
npm run deploy:all
```

This runs:

1. `npm run build`
2. `npx vercel --prod --yes`
3. `node deploy_ftp_root.cjs`

Use this only when:

- `npm` and `npx` are available in PATH.
- `npm run build` succeeds.
- Vercel CLI is authenticated.
- FTP credentials in `deploy_ftp_root.cjs` are current.

## Hostinger FTP

Hostinger keeps `reinaldomoon.top` and deep links alive.

Config lives in:

- `deploy_ftp_root.cjs`

Operational notes:

- Remote target is the Golf app folder under Hostinger public HTML.
- The script manages `.htaccess` behavior for app routes.
- The script also handles service worker cache reset behavior where configured.

Do not copy FTP passwords into docs or commits. Rotate FTP credentials if they were exposed in chat, logs, screenshots, or terminal history.

## Firebase

Frontend Firebase config lives in:

- `src/firebase.js`

Firestore rules live in:

- `firestore.rules`

Deploy rules only when rules changed:

```bash
firebase deploy --only firestore:rules
```

Manual fallback:

1. Open Firebase Console.
2. Project: `golfscorings-e4338`
3. Firestore Database > Rules
4. Paste `firestore.rules`
5. Publish

## Cloudflare R2 and Sentry

Environment variables live locally in `.env*` files and in Vercel environment settings.

Important variables include:

- `VITE_R2_ACCESS_KEY_ID`
- `VITE_R2_SECRET_ACCESS_KEY`
- `VITE_R2_ENDPOINT`
- `VITE_R2_PUBLIC_URL`
- `VITE_SENTRY_DSN`

Never commit `.env.local` or `.env.production`. Rotate R2 keys if they were exposed.

## Validation Checklist

Before publishing:

```bash
git status --short --branch
git diff --check
```

Run focused lint for changed files when possible:

```bash
/Applications/Codex.app/Contents/Resources/node node_modules/eslint/bin/eslint.js <changed-files>
```

Run full build when local dependencies work:

```bash
npm run build
```

Known local issue from 2026-05-09:

- `npm` was not available in PATH in the Codex desktop shell.
- Direct Vite build was blocked by Rollup native optional dependency/code-signing failure in `node_modules`.
- GitHub push still worked by using a valid PAT in the push URL.

## Production Smoke Test

After deploy:

1. Open the production app.
2. Log in as a test player.
3. Join a shared tournament.
4. Confirm the player appears in `Clasificación` as pending.
5. Save strokes.
6. Confirm the internal leaderboard updates live.
7. Open `/leaderboard/:id`.
8. Confirm the public leaderboard reads the same centralized data.
9. If a mobile user does not see changes, ask them to fully close the PWA from multitasking and reopen it.

## Security Rules

- Do not paste secrets into chat unless absolutely necessary.
- If a secret was pasted, treat it as exposed and rotate it.
- After using a token in a one-off command, unset it or let the shell session end.
- Keep `origin` clean:

```bash
git remote set-url origin https://github.com/Reinaldomoon23/GolfCalendar.git
```

