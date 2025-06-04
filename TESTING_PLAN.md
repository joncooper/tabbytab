# Proposed Test Strategy for TabbyTab Chrome Extension

This document outlines how automated tests could be organized for the project.
It explains tools that work with Chrome extensions and how to run the tests.

Currently `npm test` runs a small smoke test (`tests/smoke.test.cjs`) to verify
that the test runner works. More comprehensive Jest-based tests can be added
later.

## 1. Unit tests

* **Framework**: [Jest](https://jestjs.io/) with `ts-jest` for TypeScript.
* **DOM utilities**: [`@testing-library/preact`](https://testing-library.com/docs/preact-testing-library/intro/)
  for rendering components.
* **Chrome API stubs**: [`jest-chrome`](https://github.com/fredrikaverpil/jest-chrome)
  provides mocks for the `chrome.*` APIs so that background code can run in Jest.

### What to cover

* Utility functions in `src/background/index.ts` such as
  `generatePageSummary` and `storeTabHistory`.
* Component behaviour in `src/components` and `src/popup` – for example,
  verifying that `TabsView` groups tabs correctly when the `groupBy` setting changes.
* Any future helper modules that contain business logic.

### Example command

```bash
npm install --save-dev jest ts-jest @testing-library/preact jest-chrome
npx jest
```

## 2. Integration / end‑to‑end tests

For higher level testing the extension can be loaded into a real browser and
interacted with programmatically.

* **Runner**: [Playwright](https://playwright.dev/) or
  [Puppeteer](https://pptr.dev/).
* **Approach**:
  1. Build the extension using `./build-fixed.sh` so the output resides in
     `dist/`.
  2. Launch Chromium with the extension loaded:
     ```bash
     npx playwright chromium --load-extension=dist
     ```
  3. Use the browser automation API to open the popup page via the
     `chrome-extension://` URL and perform interactions (click buttons,
     close tabs, etc.).

This allows automated regression tests for user flows such as closing a group of
tabs or viewing history.

## 3. Continuous integration

* Add an npm script such as `"test": "jest"` and `"test:e2e": "playwright test"`.
* Configure a CI workflow (GitHub Actions or similar) that runs unit tests on
  every push and optionally the end‑to‑end suite on main or nightly.

## 4. Manual testing

While automated tests cover most cases, Chrome extensions often require manual
checks as well:

1. Build the extension (`./build-fixed.sh`).
2. Load it in `chrome://extensions` using “Load unpacked”.
3. Exercise the popup and history views to make sure they behave as expected.

## Further reading

The [Chrome Extension docs](https://developer.chrome.com/docs/extensions/mv3/) and
Playwright’s [guide for testing extensions](https://playwright.dev/docs/chrome-extensions)
contain useful examples.
