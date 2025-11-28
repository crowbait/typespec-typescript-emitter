import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target][] = [
  ["basic", "string | float", "string | number"],
  ["mixed", "[string, int32] | {a: null}", "[string, number] | {a: null}"],
];

tests.forEach((test) => {
  expectResolution(Resolver.Type, {
    type: "Union",
    desc: test[0],
    source: `alias test = ${test[1]};`,
    target: test[2],
  });
});
