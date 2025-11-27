import { Diagnostic, EmitContext, NoTarget } from "@typespec/compiler";
import { EmitterOptions } from "../lib.js";

let context: EmitContext<EmitterOptions> | null = null;

export const setContext = (c: EmitContext<EmitterOptions>): void => {
  context = c;
};

export const reportDiagnostic = (
  diagnostic: Pick<Diagnostic, "code" | "message" | "severity">,
): void => {
  if (!context) throw new Error("Couldn't report diagnostic: context not set");
  context.program.reportDiagnostic({
    ...diagnostic,
    code: `typespec-emitter-${diagnostic.code}`,
    target: NoTarget,
  });
};
