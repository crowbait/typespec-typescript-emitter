import {
  createTypeSpecLibrary,
  EmitContext,
  JSONSchemaType,
} from "@typespec/compiler";

export interface EmitterOptions {
  "root-namespaces": string[];
  "out-dir": string;

  "enable-types": boolean;
  "enable-typeguards": boolean;

  "enable-routes": boolean;

  "enable-routed-typemap": boolean;
  "enable-routed-path-params": boolean;

  "import-file-extensions": boolean;
  "string-nominal-enums": boolean;
  "serializable-date-types": boolean;
  "type-mappings": Record<string, string>;
  "typeguard-mappings": Record<string, string>;
}

const EmitterOptionsSchema: JSONSchemaType<EmitterOptions> = {
  type: "object",
  properties: {
    "root-namespaces": { type: "array", items: { type: "string" } },
    "out-dir": { type: "string", format: "absolute-path" },

    "enable-types": { type: "boolean" },
    "enable-typeguards": { type: "boolean" },

    "enable-routes": { type: "boolean" },

    "enable-routed-typemap": { type: "boolean" },
    "enable-routed-path-params": { type: "boolean" },

    "import-file-extensions": { type: "boolean" },
    "string-nominal-enums": { type: "boolean" },
    "serializable-date-types": { type: "boolean" },
    "type-mappings": {
      type: "object",
      required: [],
      additionalProperties: { type: "string" },
    },
    "typeguard-mappings": {
      type: "object",
      required: [],
      additionalProperties: { type: "string" },
    },
  },
  required: ["root-namespaces"],
  additionalProperties: false,
};

/** Maps option to its default value and options that must be set to `true` for this one to work */
export const optionDependencies = (
  context: EmitContext,
): {
  [K in keyof EmitterOptions]: [EmitterOptions[K], (keyof EmitterOptions)[]];
} => ({
  ["root-namespaces"]: [[], []],
  ["out-dir"]: [context.emitterOutputDir, []],

  ["enable-types"]: [false, []],
  ["enable-typeguards"]: [false, ["enable-types"]],

  ["enable-routes"]: [false, []],

  ["enable-routed-typemap"]: [false, ["enable-types"]],
  ["enable-routed-path-params"]: [false, ["enable-routed-typemap"]],

  ["import-file-extensions"]: [false, []],
  ["serializable-date-types"]: [false, []],
  ["string-nominal-enums"]: [false, []],
  ["type-mappings"]: [{}, []],
  ["typeguard-mappings"]: [{}, []],
});

export const $lib = createTypeSpecLibrary({
  name: "typespec-typescript-emitter",
  diagnostics: {},
  state: {
    asyncOp: { description: "State for @asyncOp decorator" },
  },
  emitter: {
    options: EmitterOptionsSchema,
  },
});

export const { reportDiagnostic, createDiagnostic } = $lib;

// Export state keys for use in decorators
export const AsyncOpStateKey = $lib.stateKeys.asyncOp;
