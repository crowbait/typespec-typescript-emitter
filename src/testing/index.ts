import { resolvePath } from "@typespec/compiler";
import {
  createTestLibrary,
  TypeSpecTestLibrary,
} from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const TypespecTypescriptEmitterTestLibrary: TypeSpecTestLibrary =
  createTestLibrary({
    name: "typespec-typescript-emitter",
    packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../"),
  });
