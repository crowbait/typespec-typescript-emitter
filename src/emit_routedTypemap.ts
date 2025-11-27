import {
  emitFile,
  Namespace,
  navigateProgram,
  Operation,
  Program,
  resolvePath,
} from "@typespec/compiler";
import { getHttpOperation } from "@typespec/http";
import { unique2D } from "./helpers/arrays.js";
import autogenerateWarning from "./helpers/autogenerateWarning.js";
import { TTypeMap } from "./helpers/buildTypeMap.js";
import { getImports } from "./helpers/getImports.js";
import { visibilityHelperFileName } from "./helpers/visibilityHelperFile.js";
import { EmitterOptions } from "./lib.js";
import {
  resolveOperationTypemap,
  TOperationTypemap,
} from "./resolve/operationTypemap.js";

/** Maps HTTP verbs to lifecycle states. See @typespec/compiler/.../visibility.tsp */
const VerbToLifecycle = {
  RETURN: ["Read"], // for all return types
  POST: ["Create"],
  PUT: ["Create", "Update"],
  PATCH: ["Update"],
  DELETE: ["Delete"],
  GET: ["Query"], // *parameters* of request, return type is still RETURN
  Head: ["Query"],
};

export const emitRoutedTypemap = async (
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
): Promise<void> => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = [...options["root-namespaces"]];

  const namespaceImports: {
    [namespace: string]: TTypeMap[number]["namespaces"][];
  } = {};
  const namespaceOps: {
    [namespace: string]: {
      [path: string]: {
        [verb: string]: TOperationTypemap;
      };
    };
  } = {};

  // finding all operations
  const foundOps: { [namespace: string]: Operation[] } = {};
  const traverseNamespace = (n: Namespace, rootName: string) => {
    if (!foundOps[rootName]) foundOps[rootName] = [];
    foundOps[rootName].push(...Array.from(n.operations).map((op) => op[1]));
    n.namespaces.forEach((ns) => traverseNamespace(ns, rootName));
  };
  navigateProgram(program, {
    namespace(n) {
      const nsIndex = options["root-namespaces"].findIndex(
        (ns) => n.name === ns,
      );
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete options["root-namespaces"][nsIndex];

      traverseNamespace(n, n.name);
    },
  });

  // resolving operations
  for (const ns of Object.entries(foundOps)) {
    for (const op of ns[1]) {
      const resolved = await resolveOperationTypemap(
        program,
        options,
        typemap,
        op,
      );
      const httpOp = getHttpOperation(program, op)[0];

      if (!namespaceImports[ns[0]]) namespaceImports[ns[0]] = [];
      namespaceImports[ns[0]].push(...resolved.imports);

      if (!namespaceOps[ns[0]]) namespaceOps[ns[0]] = {};
      if (!namespaceOps[ns[0]][httpOp.path])
        namespaceOps[ns[0]][httpOp.path] = {};
      namespaceOps[ns[0]][httpOp.path][httpOp.verb.toUpperCase()] =
        resolved.types;
    }
  }

  // lifecycle assignment helper
  const replaceLifecycle = (resolved: string, verb: string): string => {
    const opLifecycle = VerbToLifecycle[verb as keyof typeof VerbToLifecycle];
    return resolved.replaceAll(
      "V>",
      `V extends Lifecycle.All ? (${opLifecycle.map((l) => `Lifecycle.${l}`).join(" | ")}) : V>`,
    );
  };

  // emitting
  for (const ns of Object.entries(namespaceOps)) {
    const importStrings = getImports(unique2D(namespaceImports[ns[0]]));
    importStrings.push(
      `import {Lifecycle, FilterLifecycle} from './${visibilityHelperFileName}'`,
    );

    let out = `export type types_${ns[0]}<V extends Lifecycle = Lifecycle.All> = {\n`;
    out += Object.entries(ns[1])
      .map((path) => {
        let pathret = `  ['${path[0]}']: {\n`;
        pathret += Object.entries(path[1])
          .map((verb) => {
            let verbret = `    ['${verb[0]}']: {\n`;
            verbret += `      request: ${replaceLifecycle(verb[1].request, "RETURN")}\n`;
            verbret += `      response: ${replaceLifecycle(verb[1].response.map((res) => `{status: ${res.status}, body: ${res.body}}`).join(" | "), verb[0])}\n`;
            verbret += "    }";
            return verbret;
          })
          .join(",\n");
        pathret += "\n  }";
        return pathret;
      })
      .join(",\n");
    out += "\n};\n";
    const content = `/* eslint-disable */\n\n${autogenerateWarning}\n${importStrings.join("\n")}\n\n${out}`;
    await emitFile(program, {
      path: resolvePath(options["out-dir"], `routedTypemap_${ns[0]}.ts`),
      content: content,
    });
  }

  // restore un-mutated version
  options["root-namespaces"] = targetedNamespaces;
};
