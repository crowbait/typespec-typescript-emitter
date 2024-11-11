import {
  EmitContext,
  emitFile,
  navigateProgram,
  resolvePath,
} from "@typespec/compiler";
import { getServers } from "@typespec/http";
import emitRoutes from "./emit_routes.js";

export async function $onEmit(context: EmitContext) {
  if (!context.program.compilerOptions.noEmit) {
    const outDir = context.options["out-dir"]
      ? resolvePath(context.options["out-dir"])
      : resolvePath(context.emitterOutputDir);
    console.log(`Writing routes to ${outDir}`);

    const rootNode = `routes_${context.options["root-namespace"]}`;
    let rootServer = "";

    let targetNamespaceFound = false;
    let routesObject = "";
    navigateProgram(context.program, {
      namespace(n) {
        if (
          !targetNamespaceFound &&
          n.name === context.options["root-namespace"]
        ) {
          targetNamespaceFound = true;
          rootServer = getServers(context.program, n)![0].url;
          routesObject = emitRoutes(context, n, rootServer);
        }
      },
    });

    if (!targetNamespaceFound)
      throw new Error("Targeted root namespace not found.");
    if (!routesObject) throw new Error("Routes object empty.");

    await emitFile(context.program, {
      path: resolvePath(
        outDir,
        `${context.options["root-namespace"]}_routes.ts`,
      ),
      content: routesObject,
    });
  }
}
