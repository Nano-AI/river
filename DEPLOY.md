# Publishing River

River builds to a static `dist/` directory. There is no backend, database, API key, or runtime environment variable.

## GitHub Pages

The repository includes a manually triggered publishing workflow.

1. Open **Settings → Pages** in `Nano-AI/river`.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Open **Actions → Publish to GitHub Pages → Run workflow** and choose `main`.
4. Wait for the `build` and `deploy` jobs to succeed. The deployment job links to the published site.

The expected project URL is **https://nano-ai.github.io/river/**. It becomes available only after Pages is enabled and deployment succeeds. The workflow does not publish on push. Run it again when you want to release a newer commit.

The separate **CI** workflow runs the production build, Node/math tests, and Chromium/WebKit browser suite on pushes to `main` and pull requests. A successful run includes a downloadable **river-site** artifact containing `dist/`.

## Other static hosts

| Setting | Value |
| --- | --- |
| Node version | 24 or newer |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| HTTPS | Required for installation and offline service workers |
| Backend / functions | None |

Upload the **contents** of `dist/` to your host. Root paths and subdirectories both work. Keep the trailing slash on directory URLs, such as `/river/`. Navigation uses hashes; no SPA rewrite is needed.

Serve `.js` as JavaScript, `.webmanifest` as `application/manifest+json`, and `.ttf` as `font/ttf`. Do not rewrite missing assets to HTML. Prefer `Cache-Control: no-cache` for `sw.js`, `index.html`, and the manifest. Asset filenames are stable, so avoid an immutable cache policy.

## Verify before publishing

```sh
npm ci
npx playwright install chromium webkit
npm run verify
```

After changing the engine, mental rules, or audit corpus:

```sh
npm run math:audit
npm run verify
```

For a local production preview:

```sh
npm run preview
```

Open **http://127.0.0.1:4173**. Use `PORT=8080 npm run preview` if another server uses that port.

To preview a project subdirectory:

```sh
BASE_PATH=/river/ PORT=8080 npm run preview
```

Open **http://127.0.0.1:8080/river/**. The test suite also verifies subpath routing and offline operation at `/poker/`.

## Offline installation and updates

One complete online visit precaches all 69 spots, rule data, fonts, and app assets. The footer shows **Ready offline** after setup. On iPhone, use **Safari → Share → Add to Home Screen**. Other compatible browsers expose an install action.

Each build derives its cache version from the asset contents. A new version waits until existing River tabs and installed windows close before activating. **Close all River windows and reopen** after an update. This avoids mixing old code with new data.

Practice history is stored separately in localStorage and survives app-cache updates. Clearing site data removes that history. Moving to another origin does not transfer it.

## Final device check

Before announcing a release, try the published URL on a physical phone: answer a drill, view the out-card equations, switch themes, try reduced motion, install the app, and reopen it offline. Automated browser checks do not establish physical-device frame rate or screen-reader behavior.
