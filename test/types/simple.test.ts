import { Type } from "@typespec/compiler";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../wrapper";

const tests: [Type["kind"], any[]][] = [
  ["Boolean", ["true", "false"]],
  ["Intrinsic", ["never", "unknown", "void", "null"]],
  ["Number", [5, 8, 17, 15.55, -4]],
  ["String", [`""`, `"someString"`]],
];

tests.forEach((test) => {
  test[1].forEach((v) =>
    expectResolution(Resolver.Type, {
      type: test[0],
      source: `alias test = ${v};`,
      target: v.toString().replaceAll('"', "'"),
    }),
  );
});
