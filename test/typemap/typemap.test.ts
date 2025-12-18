import { readFileSync } from "fs";
import { join } from "path";
import { expectEmit } from "../helpers/wrapper";

const prepareContents = (s: string): string => {
  let ret = s;
  ret = ret
    .replaceAll("// WARN this file may be broken by auto formatting.", "")
    .replaceAll("// WARN by default in vscode, save: Ctrl+K , Ctrl+Shift+S", "")
    .replaceAll("\r\n", "\n");
  return `/* eslint-disable */${ret}`;
};

expectEmit(
  "routed typemap",
  {
    ["main.tsp"]: readFileSync(
      join(__dirname, "..", "helpers", "integrationTest.tsp"),
      "utf8",
    ),
  },
  {
    "routedTypemap_test.ts": prepareContents(
      readFileSync(join(__dirname, "typemap.target.ts"), "utf8"),
    ),
  },
  { "enable-routed-typemap": true },
);

expectEmit(
  "routed typemap - no visibility",
  {
    ["main.tsp"]: readFileSync(
      join(__dirname, "..", "helpers", "integrationTest-novis.tsp"),
      "utf8",
    ),
  },
  {
    "routedTypemap_test.ts": prepareContents(
      readFileSync(join(__dirname, "typemap-novis.target.ts"), "utf8"),
    ),
  },
  { "enable-routed-typemap": true },
);
