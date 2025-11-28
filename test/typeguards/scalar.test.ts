import { Scalar } from "@typespec/compiler";
import { EmitterOptions } from "../../src/lib";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

type Name = string;
type Target = string;

const tests: [Name, Target, Partial<EmitterOptions>?][] = [
  ["boolean", "typeof undefined === 'boolean'"],
  ["bytes", "undefined instanceof Uint8Array"],
  ["duration", "typeof undefined === 'number'"],
  ["numeric", "typeof undefined === 'number'"],
  ["plainTime", "typeof undefined === 'string'"],
  ["string", "typeof undefined === 'string'"],
  ["url", "typeof undefined === 'string'"],

  // date / time types
  ...["offsetDateTime", "plainDate", "utcDateTime"].map(
    (t) =>
      [
        t,
        "undefined instanceof Date",
        { "serializable-date-types": false },
      ] as [string, string, any],
  ),
  ...["offsetDateTime", "plainDate", "utcDateTime"].map(
    (t) =>
      [
        t,
        "typeof undefined === 'string'",
        { "serializable-date-types": true },
      ] as [string, string, any],
  ),
  [
    "unixTimestamp32",
    "undefined instanceof Date",
    { "serializable-date-types": false },
  ],
  [
    "unixTimestamp32",
    "typeof undefined === 'number'",
    { "serializable-date-types": true },
  ],
];

tests.forEach((test) => {
  expectResolution(Resolver.Typeguard, {
    type: "Scalar",
    desc: test[2]
      ? `{${Object.entries(test[2]).map((p) => `${p[0]}: ${p[1]}`)}}`
      : undefined,
    source: `alias test = ${test[0]};`,
    target: test[1],
    test: (t) =>
      (t as Scalar).name === test[0]
        ? true
        : `scalar name was ${(t as Scalar).name}`,
    config: test[2],
    typescriptTransformer: null,
  });
});
