import { resolvePath } from "@typespec/compiler";
import {
  createTestLibrary,
  TypeSpecTestLibrary,
} from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const TypespecTypescriptRoutesEmitterTestLibrary: TypeSpecTestLibrary =
  createTestLibrary({
    name: "typespec-typescript-routes-emitter",
    packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../"),
  });
