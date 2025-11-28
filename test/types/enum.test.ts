import { EmitterOptions } from "../../src/lib";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Source = string;
type Target = string;

const tests: [Name, Source, Target, Partial<EmitterOptions>][] = [
  [
    "basic, not nominal",
    "enum test {val1, val2}",
    "{val1,val2}",
    { "string-nominal-enums": false },
  ],
  [
    "basic, nominal",
    "enum test {val1, val2}",
    "{val1 = 'val1',val2 = 'val2'}",
    { "string-nominal-enums": true },
  ],
  [
    "shifted, not nominal",
    "enum test {val1: 1, val2: 2}",
    "{val1 = 1,val2 = 2}",
    { "string-nominal-enums": false },
  ],
  [
    "shifted, nominal",
    "enum test {val1: 1, val2: 2}",
    "{val1 = 1,val2 = 2}",
    { "string-nominal-enums": true },
  ],
  [
    "string, not nominal",
    'enum test {val1: "value1", val2: "value2"}',
    "{val1 = 'value1',val2 = 'value2'}",
    { "string-nominal-enums": false },
  ],
  [
    "string, nominal",
    'enum test {val1: "value1", val2: "value2"}',
    "{val1 = 'value1',val2 = 'value2'}",
    { "string-nominal-enums": true },
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Type, {
    type: "Enum",
    desc: test[0],
    source: test[1],
    target: test[2],
    config: test[3],
    typescriptTransformer: (tsp) => `enum test ${tsp}`,
  });
});
