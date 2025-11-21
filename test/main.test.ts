import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { expect, it } from "vitest";
import { runner } from "./runner.js";

const tests = ["simple-routes", "enum", "pr8", "union", "visibility"];

const getTestData = (
  testName: (typeof tests)[number],
): {
  input: string;
  output: {
    ts: string;
    routes: string;
    routedTypes: string;
  };
} => {
  const targetsFolder = "targets";
  return {
    input: readFileSync(join(__dirname, `${targetsFolder}/${testName}.tsp`), {
      encoding: "utf8",
    }),
    output: {
      ts: readFileSync(
        join(__dirname, `${targetsFolder}/${testName}.target.ts`),
        { encoding: "utf8" },
      )
        .trim()
        .replaceAll("\r\n", "\n"),
      routes: readFileSync(
        join(__dirname, `${targetsFolder}/${testName}.routes.ts`),
        { encoding: "utf8" },
      )
        .trim()
        .replaceAll("\r\n", "\n"),
      routedTypes: readFileSync(
        join(__dirname, `${targetsFolder}/${testName}.routed-types.ts`),
        { encoding: "utf8" },
      )
        .trim()
        .replaceAll("\r\n", "\n"),
    },
  };
};

const emitterOptions = {
  "root-namespace": "test",
  "enable-routes": true,
  "enable-types": true,
  "enable-typeguards": true,
  "enable-routed-typemap": true,
};

tests.forEach((test) => {
  it(`works for ${test}`, async () => {
    const data = getTestData(test);
    const emitter = await runner.emit(
      "typespec-typescript-emitter",
      emitterOptions,
    );
    const result = await emitter.compileAndDiagnose(data.input);

    writeFileSync(
      join(__dirname, `out/${test}.target.ts`),
      result[0].outputs["Test.ts"],
    );
    writeFileSync(
      join(__dirname, `out/${test}.routes.ts`),
      result[0].outputs["routes_test.ts"],
    );
    writeFileSync(
      join(__dirname, `out/${test}.routed-types.ts`),
      result[0].outputs["routedTypemap_test.ts"],
    );

    expect(result[1].length).toBe(0);
    expect(result[0].outputs["Test.ts"].trim()).toBe(data.output.ts);
    expect(result[0].outputs["routes_test.ts"].trim()).toBe(data.output.routes);
    expect(result[0].outputs["routedTypemap_test.ts"].trim()).toBe(
      data.output.routedTypes,
    );
  });
});
