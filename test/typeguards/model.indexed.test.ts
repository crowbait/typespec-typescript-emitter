import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../helpers/wrapper";

type Name = string;
type Source = string;
type Target = string;

// because there is no accessor, we are "testing" `undefined`
const tests: [Name, string, Source, Target][] = [
  [
    "Array",
    "simple",
    "string[]",
    "Array.isArray(undefined) && undefined.every((v) => typeof v === 'string')",
  ],
  [
    "Array",
    "union",
    "(string | int32)[]",
    "Array.isArray(undefined) && undefined.every((v) => (typeof v === 'string') || (typeof v === 'number'))",
  ],
  [
    "Array",
    "tuple",
    "[string, int32][]",
    "Array.isArray(undefined) && undefined.every((v) => Array.isArray(v) && (typeof v[0] === 'string') && (typeof v[1] === 'number'))",
  ],
  [
    "Array",
    "model",
    "{str: string}[]",
    "Array.isArray(undefined) && undefined.every((v) =>v['str'] !== undefined && (typeof v['str'] === 'string')  )",
  ],
  [
    "Record",
    "simple",
    "Record<string>",
    "typeof undefined === 'object' && Object.entries(undefined as Record<string, any>).every((v) => typeof v[1] === 'string')",
  ],
  [
    "Record",
    "union",
    "Record<string | int32>",
    "typeof undefined === 'object' && Object.entries(undefined as Record<string, any>).every((v) => (typeof v[1] === 'string') || (typeof v[1] === 'number'))",
  ],
  [
    "Record",
    "tuple",
    "Record<[string, int32]>",
    "typeof undefined === 'object' && Object.entries(undefined as Record<string, any>).every((v) => Array.isArray(v[1]) && (typeof v[1][0] === 'string') && (typeof v[1][1] === 'number'))",
  ],
  [
    "Record",
    "model",
    "Record<{str?: string}>",
    "typeof undefined === 'object' && Object.entries(undefined as Record<string, any>).every((v) =>v[1]['str'] === undefined || (typeof v[1]['str'] === 'string')  )",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: "Model",
    desc: `(indexed: ${test[0]}): ${test[1]}`,
    source: `alias test = ${test[2]};`,
    target: test[3],
    typescriptTransformer: null,
  });
});
