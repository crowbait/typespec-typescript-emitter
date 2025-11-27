import { Type } from "@typespec/compiler";
import { expectTypeResolution } from "../wrapper";

const tests: [Type["kind"], any[]][] = [
  ["Boolean", ["true", "false"]],
  ["Intrinsic", ["never", "unknown", "void", "null"]],
  ["Number", [5, 8, 17, 15.55, -4]],
  ["String", [`""`, `"someString"`]],
];

tests.forEach((test) => {
  test[1].forEach((v) =>
    expectTypeResolution(
      `simple: ${test[0]} (${v})`,
      `alias test = ${v};`,
      v.toString().replaceAll('"', "'"),
      (t) => {
        if (t.kind !== test[0]) return `Type was ${t.kind}`;
        return true;
      },
    ),
  );
});
