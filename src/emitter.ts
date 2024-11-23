import {
  EmitContext,
  emitFile,
  navigateProgram,
  resolvePath,
} from "@typespec/compiler";
import { getServers } from "@typespec/http";
import emitRoutes from "./emit_routes.js";
import emitTypes from "./emit_types.js";
import { EmitterOptions } from "./lib.js";

declare global {
  interface String {
    addLine(str: string, tabs?: number, continued?: boolean): string;
  }
}

String.prototype.addLine = function (
  this: string,
  str: string,
  tabs?: number,
  continued?: boolean,
): string {
  return `${this}${"  ".repeat(tabs ?? 0)}${str}${continued ? "" : "\n"}`;
};

export async function $onEmit(context: EmitContext) {
  if (!context.program.compilerOptions.noEmit) {
    const options: EmitterOptions = {
      "root-namespace": context.options["root-namespace"],
      "out-dir": context.options["out-dir"] ?? context.emitterOutputDir,
      "enable-types": context.options["enable-types"] ?? true,
      "enable-typeguards":
        (context.options["enable-types"] ?? true) &&
        (context.options["enable-typeguards"] ?? false),
      "enable-routes": context.options["enable-routes"] ?? false,
      "typeguards-in-routes":
        (context.options["enable-types"] ?? true) &&
        (context.options["enable-typeguards"] ?? false) &&
        (context.options["enable-routes"] ?? false) &&
        (context.options["typeguards-in-routes"] ?? false),
    };

    console.log(`Writing routes to ${options["out-dir"]}`);

    let targetNamespaceFound = false;
    let routesObject = "";
    let typeFiles: ReturnType<typeof emitTypes> = {
      files: {},
      typeguardedNames: [],
    };
    navigateProgram(context.program, {
      namespace(n) {
        if (
          !targetNamespaceFound &&
          n.name === context.options["root-namespace"]
        ) {
          targetNamespaceFound = true;
          if (options["enable-types"] || options["enable-typeguards"])
            typeFiles = emitTypes(context, n, options);
          if (options["enable-routes"]) {
            const servers = getServers(context.program, n);
            routesObject = emitRoutes(
              context,
              n,
              servers && servers[0] ? servers[0].url : "",
              options,
              typeFiles.typeguardedNames,
            );
          }
        }
      },
    });

    if (!targetNamespaceFound)
      throw new Error("Targeted root namespace not found.");

    // routes object
    if (options["enable-routes"]) {
      if (!routesObject) throw new Error("Routes object empty.");
      await emitFile(context.program, {
        path: resolvePath(
          options["out-dir"],
          `routes_${options["root-namespace"]}.ts`,
        ),
        content: routesObject,
      });
    }

    // type files
    if (options["enable-types"] || options["enable-typeguards"]) {
      const typeFileArr = Object.entries(typeFiles.files);
      for (let i = 0; i < typeFileArr.length; i++) {
        await emitFile(context.program, {
          path: resolvePath(options["out-dir"], `${typeFileArr[i][0]}.ts`),
          content: typeFileArr[i][1],
        });
      }
    }
  }
}
