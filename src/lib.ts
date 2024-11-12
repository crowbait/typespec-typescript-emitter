import { createTypeSpecLibrary, JSONSchemaType } from "@typespec/compiler";

export interface EmitterOptions {
  "root-namespace": string;
  "out-dir": string;
  "enable-types": boolean;
  "enable-routes": boolean;
}

const EmitterOptionsSchema: JSONSchemaType<EmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "root-namespace": { type: "string" },
    "out-dir": { type: "string", format: "absolute-path" },
    "enable-types": { type: "boolean" },
    "enable-routes": { type: "boolean" },
  },
  required: ["root-namespace"],
};

export const $lib = createTypeSpecLibrary({
  name: "typespec-typescript-emitter",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic, createDiagnostic } = $lib;
