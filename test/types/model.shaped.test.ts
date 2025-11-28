import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

const tests: [string, string][] = [
  ["{s: string}", "{s: string}"],
  ["{s?: string}", "{s?: string}"],
  ["{m: {s: float | int32}}", "{m: {s: number | number}}"],
  ["{a: {s: float}[]}", "{a: ({s: number})[]}"],
  ["{a: {s?: float}[]}", "{a: ({s?: number})[]}"],
  [
    "{r: Record<[string, int32]>, a: string[], f: never}",
    "{r: {[k: string]: [string, number]},a: (string)[],f: never}",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Type, {
    type: "Model",
    desc: test[0],
    source: `alias test = ${test[0]};`,
    target: test[1],
  });
});
