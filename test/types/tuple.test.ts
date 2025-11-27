import { expectTypeResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target][] = [
  ["basic, strings", "[string, string]", "[string, string]"],
  [
    "mixed",
    "[string, int32, null, {a: unknown, b: float}]",
    "[string, number, null, {a: unknown,b: number}]",
  ],
  [
    "unions",
    "[string | float, null | unknown]",
    "[string | number, null | unknown]",
  ],
];

tests.forEach((test) => {
  expectTypeResolution({
    type: "Tuple",
    desc: test[0],
    source: `alias test = ${test[1]};`,
    target: test[2],
  });
});
