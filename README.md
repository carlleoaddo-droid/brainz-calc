# Brainz Calc

A lightweight, offline-first progressive web app with an instant length converter and a large-format print cost calculator.

## Use the published app

Once GitHub Pages deployment is enabled and completed, open:

https://carlleoaddo-droid.github.io/brainz-calc/

## Features

- Convert between 11 metric and imperial length units.
- Calculate large-format print costs from dimensions: Flexy at GHS 2.50/sq ft and SAV at GHS 2.30/sq ft.
- Keep recent conversions and preferences in browser storage.
- Work offline after the app has been loaded once.
- Install as a PWA on supported browsers and devices.

## Run locally

Serve this directory from localhost (for example, with the VS Code Live Server extension). Service workers require localhost or HTTPS; opening `index.html` directly with `file://` does not enable offline caching.

## Publish

The workflow in `.github/workflows/deploy-pages.yml` publishes the repository root to GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** once, then pushes to `main` deploy automatically.
