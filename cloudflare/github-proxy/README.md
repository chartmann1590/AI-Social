# github-proxy

Cloudflare Worker that proxies the in-app "Support & Feedback" bug reporter's
calls to the GitHub REST API. The GitHub PAT lives only as a Worker secret —
it is never shipped inside the Android app. The app authenticates to this
worker instead with a lightweight shared secret (`X-App-Secret`), which is
far cheaper to rotate than a repo-scoped GitHub token if it ever leaks from a
decompiled APK.

Only a narrow allowlist of routes is forwarded to `api.github.com`, and only
for the configured `ALLOWED_OWNER`/`ALLOWED_REPO`. **These two vars (set via
`wrangler.jsonc`/`wrangler deploy`) and the app's `github.repo.owner`/
`github.repo.name` (set via `android/local.properties` locally, or the
`GH_REPO_OWNER`/`GH_REPO_NAME` GitHub Actions repo variables in CI) are the
same fact configured in two independent places with nothing tying them
together.** If the repo is ever renamed, update both — a mismatch makes
every feedback-tool call 404 against this Worker with no indication why.

- `POST /repos/{owner}/{repo}/issues` — create a bug report
- `GET /repos/{owner}/{repo}/issues/{number}` — poll issue status
- `GET /repos/{owner}/{repo}/issues/{number}/comments` — load replies
- `POST /repos/{owner}/{repo}/issues/{number}/comments` — post a reply
- `PUT /repos/{owner}/{repo}/contents/feedback-assets/*` — attach a screenshot

Everything else returns 403/404.

## Deploy

```bash
npm install
npx wrangler secret put GITHUB_TOKEN         # a GitHub PAT with repo issue access
npx wrangler secret put APP_SHARED_SECRET    # random string the app also holds
npx wrangler deploy
```

The Android app reads the deployed URL and the shared secret from
`android/local.properties` (gitignored) at build time:

```properties
github.proxy.base_url=https://<your-worker>.workers.dev
app.proxy.secret=<same value as APP_SHARED_SECRET>
github.repo.owner=<owner>
github.repo.name=<repo>
```

See `plugins/withFeedback.js` for how these get wired into `BuildConfig`.
