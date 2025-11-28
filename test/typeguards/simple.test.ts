import { Type } from "@typespec/compiler";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Value = string;
type Target = string;

const tests: [Type["kind"], Value, Target][] = [
  ["Boolean", "true", "undefined === true"],
  ["Boolean", "false", "undefined === false"],
  // ["Intrinsic", ["never", "unknown", "void", "null"]],
  ["Intrinsic", "never", "false"],
  ["Intrinsic", "unknown", "true"],
  ["Intrinsic", "void", "undefined === undefined"],
  ["Intrinsic", "null", "undefined === null"],
  ["String", `"stringy"`, `undefined === 'stringy'`],
  ...[5, 8, 17, 15.55, -4].map(
    (n) =>
      ["Number", n.toString(), `undefined === ${n}`] as [
        Type["kind"],
        Value,
        Target,
      ],
  ),
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: test[0],
    desc: `simple: ${test[1]}`,
    source: `alias test = ${test[1]};`,
    target: test[2],
    typescriptTransformer: null,
  });
});
