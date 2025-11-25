import {createTypeSpecLibrary, EmitContext, JSONSchemaType} from "@typespec/compiler";

export interface EmitterOptions {
  "root-namespaces": string[];
  "out-dir": string;
  "enable-types": boolean;
  "enable-typeguards": boolean;
  "enable-routes": boolean;
  "enable-routed-typemap": boolean;
  "string-nominal-enums": boolean;
  "serializable-date-types": boolean;
}

const EmitterOptionsSchema: JSONSchemaType<EmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "root-namespaces": { type: "array", items: { type: "string" } },
    "out-dir": { type: "string", format: "absolute-path" },
    "enable-types": { type: "boolean" },
    "enable-typeguards": { type: "boolean" },
    "enable-routes": { type: "boolean" },
    "enable-routed-typemap": { type: "boolean" },
    "string-nominal-enums": { type: "boolean" },
    "serializable-date-types": { type: "boolean" },
  },
  required: ["root-namespaces"],
};

/** Maps option to its default value and options that must be set to `true` for this one to work */
export const optionDependencies = (context: EmitContext):
  {[K in keyof EmitterOptions]: [EmitterOptions[K], (keyof EmitterOptions)[]]} => 
({
  ["root-namespaces"]: [[], []],
  ["out-dir"]: [context.emitterOutputDir, []],
  ["enable-types"]: [false, []],
  ["enable-routes"]: [false, []],
  ["string-nominal-enums"]: [false, []],
  ["serializable-date-types"]: [false, []],

  ["enable-typeguards"]: [false, ["enable-types"]],
  ["enable-routed-typemap"]: [false, ["enable-types"]]
});

export const $lib = createTypeSpecLibrary({
  name: "typespec-typescript-emitter",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic, createDiagnostic } = $lib;
