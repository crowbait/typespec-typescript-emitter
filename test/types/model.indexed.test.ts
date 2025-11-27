import { Model } from "@typespec/compiler";
import { expectTypeResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target][] = [
  ["Array", "string[]", "(string)[]"],
  ["Array", "(string | int32)[]", "(string | number)[]"],
  ["Array", "[string, int32][]", "([string, number])[]"],
  ["Record", "Record<string>", "{[k: string]: string}"],
  ["Record", "Record<string | int32>", "{[k: string]: string | number}"],
  ["Record", "Record<[string, int32]>", "{[k: string]: [string, number]}"],
];

tests.forEach((test) => {
  expectTypeResolution({
    type: "Model",
    desc: test[0],
    source: `alias test = ${test[1]};`,
    target: test[2],
    test: (t) =>
      (t as Model).name === test[0]
        ? true
        : `model name was ${(t as Model).name}`,
  });
});
