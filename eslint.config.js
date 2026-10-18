// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/", "**/dist-test/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.ts", "tools/*.mjs", "tools/*.d.mts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers in messages ("is 12 bytes") are clear; other non-strings still need String().
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // Plain JavaScript tooling has no type information to check against.
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  {
    // The engine must run in a browser Web Worker as well as in Node.
    files: ["packages/engine/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^node:",
              message: "The engine must not use Node built-ins; it also runs in browsers.",
            },
          ],
          paths: [
            "assert",
            "buffer",
            "child_process",
            "crypto",
            "events",
            "fs",
            "fs/promises",
            "http",
            "https",
            "net",
            "os",
            "path",
            "process",
            "stream",
            "url",
            "util",
            "worker_threads",
            "zlib",
          ].map((name) => ({
            name,
            message: "The engine must not use Node built-ins; it also runs in browsers.",
          })),
        },
      ],
    },
  },
);
