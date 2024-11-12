import {
  EmitContext,
  emitFile,
  navigateProgram,
  resolvePath,
} from "@typespec/compiler";
import { getServers } from "@typespec/http";
import emitRoutes from "./emit_routes.js";
import emitTypes from "./emit_types.js";

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
    let typeFiles: ReturnType<typeof emitTypes> = {};
    navigateProgram(context.program, {
      namespace(n) {
        if (
          !targetNamespaceFound &&
          n.name === context.options["root-namespace"]
        ) {
          targetNamespaceFound = true;
          rootServer = getServers(context.program, n)![0].url;
          routesObject = emitRoutes(context, n, rootServer);
          typeFiles = emitTypes(context, n);
        }
      },
    });

    if (!targetNamespaceFound)
      throw new Error("Targeted root namespace not found.");
    if (!routesObject) throw new Error("Routes object empty.");

    // routes object
    await emitFile(context.program, {
      path: resolvePath(
        outDir,
        `routes_${context.options["root-namespace"]}.ts`,
      ),
      content: routesObject,
    });

    // type files
    const typeFileArr = Object.entries(typeFiles);
    for (let i = 0; i < typeFileArr.length; i++) {
      await emitFile(context.program, {
        path: resolvePath(outDir, `${typeFileArr[i][0]}.ts`),
        content: typeFileArr[i][1],
      });
    }
  }
}
