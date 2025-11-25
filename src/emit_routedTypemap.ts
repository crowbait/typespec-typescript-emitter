import {EmitContext, emitFile, Namespace, navigateProgram, Operation, resolvePath} from '@typespec/compiler';
import {getHttpOperation} from '@typespec/http';
import {unique2D} from './helpers/arrays.js';
import autogenerateWarning from './helpers/autogenerateWarning.js';
import {TTypeMap} from './helpers/buildTypeMap.js';
import {getImports} from './helpers/getImports.js';
import {EmitterOptions} from './lib.js';
import {resolveOperationTypemap, TOperationTypemap} from './resolve/operationTypemap.js';

export const emitRoutedTypemap = async (
  context: EmitContext<EmitterOptions>,
  typemap: TTypeMap
): Promise<void> => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = [...context.options["root-namespaces"]];
  
  const namespaceImports: {
    [namespace: string]: TTypeMap[number]["namespaces"][];
  } = {};
  const namespaceOps: {
    [namespace: string]: {
      [path: string]: {
        [verb: string]: TOperationTypemap
      };
    }
  } = {};

// finding all operations
  const foundOps: {[namespace: string]: Operation[]} = {};
  const traverseNamespace = (n: Namespace, rootName: string) => {
    if (!foundOps[rootName]) foundOps[rootName] = [];
    foundOps[rootName].push(...Array.from(n.operations).map(op => op[1]));
    n.namespaces.forEach(ns => traverseNamespace(ns, rootName));
  }
  navigateProgram(context.program, {
    namespace(n) {
      const nsIndex = context.options["root-namespaces"].findIndex(ns => n.name === ns);
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete context.options["root-namespaces"][nsIndex];
      
      traverseNamespace(n, n.name);
    }
  });

// resolving operations
  for (const ns of Object.entries(foundOps)) {
    for (const op of ns[1]) {
      console.log(op.namespace?.name);
      const resolved = await resolveOperationTypemap(context, typemap, op);
      const httpOp = getHttpOperation(context.program, op)[0];

      if (!namespaceImports[ns[0]]) namespaceImports[ns[0]] = [];
      namespaceImports[ns[0]].push(...resolved.imports);

      if (!namespaceOps[ns[0]]) namespaceOps[ns[0]] = {};
      if (!namespaceOps[ns[0]][httpOp.path]) namespaceOps[ns[0]][httpOp.path] = {};
      namespaceOps[ns[0]][httpOp.path][httpOp.verb.toUpperCase()] = resolved.types;
    }
  }

// emitting
  for (const ns of Object.entries(namespaceOps)) {
    const importStrings = getImports(unique2D(namespaceImports[ns[0]]));
    let out = `export type type_${ns[0]} = {\n`;
    out += Object.entries(ns[1]).map((path) => {
      let pathret = `  ['${path[0]}']: {\n`;
      pathret += Object.entries(path[1])
        .map((verb) => {
          let verbret = `    ['${verb[0]}']: {\n`;
          verbret +=    `      request: ${verb[1].request}\n`;
          verbret +=    `      response: ${verb[1].response.map((res) => `{status: ${res.status}, body: ${res.body}}`).join(" | ")}\n`;
          verbret +=    "    }";
          return verbret;
        })
        .join(",\n");
      pathret += "\n  }";
      return pathret;
    }).join(",\n");
    out += "\n};\n";
    const content = `/* eslint-disable */\n\n${autogenerateWarning}\n${importStrings.join("\n")}\n\n${out}`;
    await emitFile(context.program, {
      path: resolvePath(context.options['out-dir'], `routedTypemap_${ns[0]}.ts`),
      content: content
    });
  }

  context.options["root-namespaces"] = targetedNamespaces;
}