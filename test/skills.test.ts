// Copyright 2026 Automate the Cloud Inc.
// SPDX-License-Identifier: Apache-2.0

// The study-bundles skill carries its own copy of the AI authoring
// instructions, so that it works when installed outside this repository. The
// copy must not drift from the original in spec/.

import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

it("the skill's authoring rules are an exact copy of spec/ai-authoring.md", () => {
  expect(read("skills/openwaymark-study-bundles/references/authoring-rules.md")).toBe(
    read("spec/ai-authoring.md"),
  );
});
