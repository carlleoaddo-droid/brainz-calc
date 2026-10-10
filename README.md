# NexNum

NexNum is an offline-first progressive web app with a length converter, a basic
calculator, and a large-format print cost calculator.

## Features

- Convert between 11 metric and imperial length units.
- Keep recent conversions in browser storage.
- Use a calculator with persistent calculator history.
- Estimate print costs by dimensions, material, and quantity.
- Customize material rates, display name, and profile photo in Settings.
- Choose a theme, decimal precision, and default conversion units.
- Work offline after the app has loaded once, and install it as a PWA.

Settings, profile information, and histories are stored locally in the browser.

## Run locally

Serve this directory from localhost (for example, with the VS Code Live Server
extension). Service workers require localhost or HTTPS; opening `index.html`
directly with `file://` does not enable offline caching.

## Publish

The workflow in `.github/workflows/deploy-pages.yml` publishes the repository
root to GitHub Pages. In repository settings, choose **Pages → Build and
deployment → Source → GitHub Actions**. Every push to `main` deploys
automatically.

Published app: https://carlleoaddo-droid.github.io/brainz-calc/
