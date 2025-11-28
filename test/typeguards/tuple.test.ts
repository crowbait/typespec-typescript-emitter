import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target][] = [
  [
    "basic, strings",
    "[string, string]",
    "Array.isArray(undefined) && (typeof undefined[0] === 'string') && (typeof undefined[1] === 'string')",
  ],
  [
    "mixed",
    "[string, int32, null, {a: unknown, b: float}]",
    "Array.isArray(undefined) && (typeof undefined[0] === 'string') && (typeof undefined[1] === 'number') && (undefined[2] === null) && (undefined[3]['a'] !== undefined && (true) &&undefined[3]['b'] !== undefined && (typeof undefined[3]['b'] === 'number'))",
  ],
  [
    "unions",
    "[string | float, null | unknown]",
    "Array.isArray(undefined) && ((typeof undefined[0] === 'string') || (typeof undefined[0] === 'number')) && ((undefined[1] === null) || (true))",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: "Tuple",
    desc: test[0],
    source: `alias test = ${test[1]};`,
    target: test[2],
    typescriptTransformer: null,
  });
});
