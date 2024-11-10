import { resolvePath } from "@typespec/compiler";
import { createTestLibrary, TypeSpecTestLibrary } from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const TypespecTypescriptRoutesTestLibrary: TypeSpecTestLibrary = createTestLibrary({
  name: "typespec-typescript-routes",
  packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../"),
});
