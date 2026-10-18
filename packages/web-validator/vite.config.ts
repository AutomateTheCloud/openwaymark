// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import { defaultClientConditions, defineConfig, type Plugin } from "vite";

/**
 * Content Security Policy for the built page. `connect-src 'none'` means the
 * browser itself refuses any network request from the page or its worker, so
 * "your files never leave this device" is enforced, not just promised. It is
 * added only to the production build, because the development server needs a
 * live connection for reloading.
 */
const contentSecurityPolicy: Plugin = {
  name: "openwaymark-csp",
  apply: "build",
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "worker-src 'self'",
      "style-src 'self'",
      "img-src 'self' blob:",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ");
    return html.replace(
      '<meta charset="utf-8" />',
      `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
    );
  },
};

export default defineConfig({
  base: "./",
  plugins: [contentSecurityPolicy],
  // The engine runs in a Web Worker, which has no `document`. Some packages
  // ship a "browser" build that uses the DOM and a "worker" build that does
  // not (decode-named-character-reference, used by the Markdown parser), so
  // "worker" takes precedence.
  resolve: { conditions: ["worker", ...defaultClientConditions] },
  build: { target: "es2022" },
  worker: { format: "es" },
});
