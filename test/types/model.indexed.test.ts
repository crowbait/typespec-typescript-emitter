import { Model } from "@typespec/compiler";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, string, Source, Target][] = [
  ["Array", "simple", "string[]", "(string)[]"],
  ["Array", "union", "(string | int32)[]", "(string | number)[]"],
  ["Array", "tuple", "[string, int32][]", "([string, number])[]"],
  ["Array", "model", "{str: string}[]", "({str: string})[]"],
  ["Record", "simple", "Record<string>", "{[k: string]: string}"],
  [
    "Record",
    "union",
    "Record<string | int32>",
    "{[k: string]: string | number}",
  ],
  [
    "Record",
    "tuple",
    "Record<[string, int32]>",
    "{[k: string]: [string, number]}",
  ],
  [
    "Record",
    "model",
    "Record<{str?: string}>",
    "{[k: string]: {str?: string}}",
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Type, {
    type: "Model",
    desc: `${test[0]}: ${test[1]}`,
    source: `alias test = ${test[2]};`,
    target: test[3],
    test: (t) =>
      (t as Model).name === test[0]
        ? true
        : `model name was ${(t as Model).name}`,
  });
});
