import {EmitContext} from '@typespec/compiler';
import {reportDiagnostic} from './helpers/diagnostics.js';
import {EmitterOptions, optionDependencies} from './lib.js';

/**
 * Parses config-file options including inter-option dependencies, setting defaults,
 * emitting warnings/errors as required, 
 * replacing options in context with parsed versions.
 */
export const parseOptions = (context: EmitContext<EmitterOptions>): void => {
  Object.entries(optionDependencies).forEach(([k, val]) => {
    const key: keyof EmitterOptions = k as any;
    const [def, deps]: [unknown, (keyof EmitterOptions)[]] = val;
    if (deps.length === 0) {
      (context.options[key] as unknown) = context.options[key] ?? def;
    } else {
      if (
        context.options[key] &&
        !deps.every(d => context.options[d])
      ) {
        reportDiagnostic({
          code: `opts-dependency-${key}`,
          severity: "error",
          message: `Option ${key} requires ${deps.join(", ")}`
        });
      }
    }
  });
}