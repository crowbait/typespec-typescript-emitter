import { Type } from "@typespec/compiler";
import { expect, it } from "vitest";
import { EmitterOptions } from "../src/lib";
import { Resolvable } from "../src/resolve/Resolvable";
import { Resolver, ResolverResult } from "../src/resolve/Resolvable_helpers";
import { runner } from "./runner";

export const defaultConfig: Omit<EmitterOptions, "out-dir"> = {
  "root-namespaces": ["test"],
  "enable-types": true,
  "enable-typeguards": false,
  "enable-routes": false,
  "enable-routed-typemap": false,
  "string-nominal-enums": true,
  "serializable-date-types": true,
};

export const expectEmit = (
  desc: string,
  input: string,
  expected: string,
  config: typeof defaultConfig = defaultConfig,
  outFilename: string = "test.ts",
): void => {
  it(desc, async () => {
    const emitter = await runner.emit(
      "typespec-typescript-emitter",
      config as Record<string, any>,
    );
    const result = await emitter.compileAndDiagnose(input);
    expect(result[1].length).toBe(0); // no diagnostics
    expect(result[0].outputs[outFilename].trim()).toBe(expected);
  });
};

export const expectTypeResolution = (
  desc: string,
  input: string,
  target: string,
  test?: (t: Type, r: ResolverResult<Resolver.Type>) => true | string,
  typename: string = "test",
  config: typeof defaultConfig = defaultConfig,
) => {
  const transformResult = (s: string): string =>
    s
      .split("\n")
      .map((l) => l.trim())
      .join("");
  it(`type: ${desc}`, async () => {
    const { program } = await runner.compile(
      input,
      config as Record<string, any>,
    );
    const result = program.resolveTypeReference(typename);
    if (result[1].length > 0) console.error(result[1]);
    expect(result[1].length).toBe(0); // no diagnostics
    expect(result[0]).toBeDefined();
    const resolved = await Resolvable.resolve(Resolver.Type, result[0]!, {
      program,
      options: config as any,
      nestlevel: 0,
      rootType: null,
      typemap: [],
      emitDocs: false,
    });
    expect(transformResult(resolved.resolved.value)).toBe(
      transformResult(transformResult(target)),
    );
    if (test !== undefined) expect(await test(result[0]!, resolved)).toBe(true);
  });
};
