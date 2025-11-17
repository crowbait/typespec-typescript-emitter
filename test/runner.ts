import {createTester} from "@typespec/compiler/testing";

export const runner = createTester(".", {
  libraries: ["@typespec/http", "typespec-typescript-emitter"], // Add other libraries you depend on in your tests
});