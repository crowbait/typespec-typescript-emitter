import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "typespec-typescript-routes",
  diagnostics: {},
});

export const { reportDiagnostic, createDiagnostic } = $lib;
