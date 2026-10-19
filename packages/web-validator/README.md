# OpenWaymark browser validator

A web page that checks and packs OpenWaymark bundles **in your browser**. It
uses the same engine as the command-line tool, inside a Web Worker, so the
page stays responsive. Your files never leave your device.

That promise is enforced by the browser, not just by this page's code. The
built page carries a Content Security Policy with `connect-src 'none'`, which
makes the browser refuse any network request the page or its worker might
try. The browser tests check this.

## Try it

```bash
pnpm install
pnpm build                                         # build the engine
pnpm --filter @automatethecloud/openwaymark-web-validator dev       # open the printed address
```

## How it works

| File                 | Role                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | The page: two file pickers and a results area                                                                                                                        |
| `src/main.ts`        | Sends the chosen files to the worker and shows the report. It builds the results with `textContent`, never `innerHTML`, because messages quote the bundle's own text |
| `src/worker.ts`      | Runs the engine. It reads files in pieces with `Blob.slice`, and decodes images with the browser's `createImageBitmap`                                               |
| `vite.config.ts`     | Builds the page, and adds the Content Security Policy                                                                                                                |
| `e2e/parity.spec.ts` | Runs every conformance fixture in Chromium, Firefox, and WebKit, and requires the same verdict as in Node                                                            |

## A lesson from the browser tests

The first browser run found that Firefox and WebKit can draw a PNG with
damaged pixel data without reporting an error, while Node's decoder rejects
it. A browser-based validator would have accepted a bundle the command line
rejects. The fix lives in the engine: it checks PNG chunk checksums and the
size of the decompressed pixel data, and JPEG end markers, itself. Every
platform therefore enforces the same rules, whatever its image decoder.

## Testing

```bash
pnpm test:browser   # from the repository root: builds, then runs Playwright
```

The first time, install the browsers with
`pnpm --filter @automatethecloud/openwaymark-web-validator exec playwright install`.

Playwright's WebKit is close to Safari, but it is not Safari on an iPhone.
Tests here do not stand in for checks on real devices.
