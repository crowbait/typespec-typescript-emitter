import { readFileSync } from "fs";
import { join } from "path";
import { expectEmit } from "../helpers/wrapper";

const files: Record<string, string> = {
  ["main.tsp"]: readFileSync(
    join(__dirname, "..", "helpers", "integrationTest.tsp"),
    "utf8",
  ),
};

expectEmit(
  "route object",
  files,
  {
    "routes_test.ts": `/* eslint-disable */${readFileSync(
      join(__dirname, "routes.target.ts"),
      "utf8",
    ).replaceAll("\r\n", "\n")}`,
  },
  { "enable-routes": true },
);
