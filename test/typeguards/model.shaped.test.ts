import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

const tests: [string, string][] = [
  [
    "{s: string}",
    "undefined['s'] !== undefined && (typeof undefined['s'] === 'string')",
  ],
  [
    "{s?: string}",
    "undefined['s'] === undefined || (typeof undefined['s'] === 'string')",
  ],
  [
    "{m: {s: string | int32}}",
    "undefined['m'] !== undefined && (undefined['m']['s'] !== undefined && ((typeof undefined['m']['s'] === 'string') || (typeof undefined['m']['s'] === 'number')))",
  ],
  [
    "{a: {s: utcDateTime}[]}",
    "undefined['a'] !== undefined && (Array.isArray(undefined['a']) && undefined['a'].every((v) =>v['s'] !== undefined && (v['s'] instanceof Date)    ))",
  ],
  [
    "{r: Record<[string, int32]>, a: string[], f: never}",
    "undefined['r'] !== undefined && (typeof undefined['r'] === 'object' && Object.entries(undefined['r'] as Record<string, any>).every((v) => Array.isArray(v[1]) && (typeof v[1][0] === 'string') && (typeof v[1][1] === 'number'))) &&" +
      "undefined['a'] !== undefined && (Array.isArray(undefined['a']) && undefined['a'].every((v) => typeof v === 'string')) &&" +
      "!('f' in undefined)",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: "Model",
    desc: test[0],
    source: `alias test = ${test[0]};`,
    target: test[1],
    typescriptTransformer: null,
    config: { "serializable-date-types": false },
  });
});
