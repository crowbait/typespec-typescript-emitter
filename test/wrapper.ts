import { Type } from "@typespec/compiler";
import { expect, it } from "vitest";
import { EmitterOptions } from "../src/lib";
import { Resolvable } from "../src/resolve/Resolvable";
import { Resolver, ResolverResult } from "../src/resolve/Resolvable_helpers";
import { runner } from "./runner";
import { validateTS } from "./ts";

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

export const expectTypeResolution = (args: {
  /** Kind of the type we expect to get (@typespec/compiler.Type['kind']) */
  type: string;
  desc?: string;
  /** Source TSP */
  source: string;
  /** Expected TS output */
  target: string;
  /** Either `true` (all okay) or error message */
  test?: (t: Type, r: ResolverResult<Resolver.Type>) => true | string;
  /** Name of the type to compile; used to get type from program. */
  typename?: string;
  config?: Partial<typeof defaultConfig>;
  /**
   * If set, the TSP output will be put through this before checking typescript validity.
   * Default is `type test = ${output}`.
   */
  typescriptTransformer?: (tsp: string) => string;
}) => {
  if (!args.typename) args.typename = "test";
  if (!args.config) {
    args.config = defaultConfig;
  } else {
    args.config = { ...defaultConfig, ...args.config };
  }

  const transformResult = (s: string): string =>
    s
      .split("\n")
      .map((l) => l.trim())
      .join("");
  if (args.typescriptTransformer == undefined)
    args.typescriptTransformer = (tsp) => `type test = ${tsp};`;

  it(`type: ${args.type} ${args.desc ?? ""}`, async () => {
    const { program } = await runner.compile(
      args.source,
      args.config as Record<string, any>,
    );
    // get compiled type
    const result = program.resolveTypeReference(args.typename!);
    // check for diagnostics
    if (result[1].length > 0) console.error(result[1]);
    expect(result[1].length).toBe(0); // no diagnostics
    // type compiled and expected type.kind?
    expect(result[0]).toBeDefined();
    expect(result[0]?.kind).toBe(args.type);
    // resolve to typescript
    const resolved = await Resolvable.resolve(Resolver.Type, result[0]!, {
      program,
      options: args.config as EmitterOptions,
      nestlevel: 0,
      rootType: null,
      typemap: [],
      emitDocs: false,
    });
    // check if valid typescript
    const tsCode = args.typescriptTransformer!(resolved.resolved.value);
    let tsValidity = validateTS(tsCode);
    if (tsValidity !== true) tsValidity += `\nTypescript: ${tsCode}`;
    expect(tsValidity).toBe(true);
    // check generated typescript content
    expect(transformResult(resolved.resolved.value)).toBe(
      transformResult(transformResult(args.target)),
    );
    if (args.test !== undefined)
      expect(await args.test(result[0]!, resolved)).toBe(true);
  });
};
