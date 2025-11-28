import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target][] = [
  [
    "basic",
    "string | float",
    "(typeof undefined === 'string') || (typeof undefined === 'number')",
  ],
  [
    "mixed",
    "[string, int32] | {a: null}",
    "(Array.isArray(undefined) && (typeof undefined[0] === 'string') && (typeof undefined[1] === 'number')) || (undefined['a'] !== undefined && (undefined['a'] === null))",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: "Union",
    desc: test[0],
    source: `alias test = ${test[1]};`,
    target: test[2],
    typescriptTransformer: null,
  });
});
