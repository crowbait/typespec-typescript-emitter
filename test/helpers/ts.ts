import ts from "typescript";

export const validateTS = (code: string): true | string => {
  const out = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: { noEmit: true },
  });
  return out.diagnostics === undefined || out.diagnostics.length === 0
    ? true
    : out.diagnostics.map((d) => d.messageText).join(", ");
};
