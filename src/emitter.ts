import { EmitContext } from "@typespec/compiler";
import { emitRoutedTypemap } from "./emit_routedTypemap.js";
import { emitRoutes } from "./emit_routes.js";
import { emitTypes } from "./emit_types.js";
import { buildTypeMap } from "./helpers/buildTypeMap.js";
import { setContext } from "./helpers/diagnostics.js";
import { emitVisibilityHelperFile } from "./helpers/visibilityHelperFile.js";
import { EmitterOptions } from "./lib.js";
import { parseOptions } from "./parseOptions.js";

export async function $onEmit(context: EmitContext<EmitterOptions>) {
  if (context.program.compilerOptions.noEmit) return;
  setContext(context);
  parseOptions(context);

  const typeMap = buildTypeMap(context.program, context.options);
  if (context.options["enable-types"])
    await emitTypes(context.program, context.options, typeMap);
  if (context.options["enable-routed-typemap"])
    await emitRoutedTypemap(context.program, context.options, typeMap);
  if (context.options["enable-routes"])
    await emitRoutes(context.program, context.options);

  await emitVisibilityHelperFile(context.program, context.options);
}
