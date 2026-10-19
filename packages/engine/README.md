# @automatethecloud/openwaymark-engine

The reference validation engine for
[OpenWaymark](https://github.com/AutomateTheCloud/openwaymark) study bundles.
It checks a bundle against the
[specification](https://github.com/AutomateTheCloud/openwaymark/blob/master/spec/openwaymark.md),
runs the recommended lint checks, describes what a bundle contains, and packs
a folder of files into a bundle.

The engine uses only standard JavaScript, so the same code runs in Node and in
a browser Web Worker. It reads nothing from disk and sends nothing anywhere:
you hand it the bytes.

> Looking for a command to run in a terminal? Install
> [`@automatethecloud/openwaymark`](https://www.npmjs.com/package/@automatethecloud/openwaymark),
> the command-line tool built on this engine.

## Install

```bash
npm install @automatethecloud/openwaymark-engine
```

Requires Node 24 or a current browser. The format is a working draft, so
expect breaking changes in 0.x releases.

## Validate a bundle

```js
import { readFile } from "node:fs/promises";
import { bytesSource, validateBundle } from "@automatethecloud/openwaymark-engine";

const bytes = new Uint8Array(await readFile("capitals.waymark"));
const { report, bundle } = await validateBundle(bytesSource(bytes), { lint: true });

console.log(report.conformance); // "conforming", "incomplete", or "not-conforming"
for (const d of report.diagnostics) {
  console.log(`${d.severity} ${d.rule}: ${d.message}`);
}
```

`bundle` (the parsed manifest and its assets) is present only when the bundle
conforms, so an application can import it straight away.

### Why "incomplete"?

Fully decoding images is a required check (`OWM-IMG-009`), and decoding is
platform work the engine leaves to you. Without an `imageDecoder`, a bundle
with no errors is reported as `"incomplete"`, never `"conforming"`. Supply one
that suits your platform:

```js
const imageDecoder = {
  name: "my decoder",
  async decode(bytes, format) {
    // Decode fully, and throw if the image is damaged.
    return { width, height };
  },
};
await validateBundle(bytesSource(bytes), { imageDecoder });
```

The CLI uses [sharp](https://sharp.pixelplumbing.com/); the browser validator
uses `createImageBitmap`.

## What a passing result means

A conforming bundle follows the format. That does **not** mean its answers are
right, and it does not mean the file is safe: no check can prove a file
harmless.

## Other exports

`packBundle` builds a bundle from files, `gradeResponse` grades an answer the
way the specification describes, `contentFingerprint` identifies a bundle's
content, and `LIMITS` holds the resource limits the engine enforces. The type
declarations ship with the package.

## License

[Apache License 2.0](https://github.com/AutomateTheCloud/openwaymark/blob/master/LICENSE).
Copyright 2026 Automate the Cloud Inc. The Waymark name is not licensed.
