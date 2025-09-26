import { EmitContext, getDoc, Namespace } from "@typespec/compiler";
import {
  resolveEnum,
  resolveModel,
  resolveUnion,
} from "./emit_types_resolve.js";
import { getTypeguardModel } from "./emit_types_typeguards.js";
import { EmitterOptions } from "./lib.js";

const emitTypes = (
  context: EmitContext,
  namespace: Namespace,
  options: EmitterOptions,
): {
  files: Record<string, string>;
  typeguardedNames: Array<{ filename: string; name: string }>;
} => {
  const out: ReturnType<typeof emitTypes> = { files: {}, typeguardedNames: [] };

  const traverseNamespace = (n: Namespace): void => {
    let file = "";

    n.enums.forEach((e) => {
      if (options["enable-types"]) {
        const resolved = resolveEnum(e, {
          context: context,
          currentNamespace: n,
          nestlevel: 0,
          isNamespaceRoot: true,
        });
        if (resolved) {
          const doc = getDoc(context.program, e);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export enum ${e.name} ${resolved};\n`);
        }
      }
    });
    n.unions.forEach((u) => {
      if (options["enable-types"]) {
        const resolved = resolveUnion(u, {
          currentNamespace: n,
          context,
          nestlevel: 0,
          isNamespaceRoot: true,
        });
        if (resolved) {
          const doc = getDoc(context.program, u);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export type ${u.name} = ${resolved};\n`);
        }
      }
    });
    n.models.forEach((m) => {
      if (options["enable-types"]) {
        const resolved = resolveModel(m, {
          nestlevel: 0,
          currentNamespace: n,
          context,
          isNamespaceRoot: true,
        });
        if (resolved) {
          const doc = getDoc(context.program, m);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export interface ${m.name} ${resolved};`);
        }
      }

      if (options["enable-typeguards"]) {
        file = file.addLine(
          `export function is${m.name}(arg: any): arg is ${m.name} {`,
        );
        file = file.addLine("return (", 1);
        getTypeguardModel(m, "arg", undefined, n)[0]
          .split("\n")
          .forEach((line) => {
            file = file.addLine(line, 1);
          });
        file = file.addLine(");", 1);
        file = file.addLine("};");
        out.typeguardedNames.push({
          filename: n.name.charAt(0).toUpperCase() + n.name.slice(1),
          name: m.name,
        });
      }
      file += "\n";
    });
    // set output for this namespace
    out.files[n.name.charAt(0).toUpperCase() + n.name.slice(1)] = file;
    // recursively iterate child namespaces
    n.namespaces.forEach((ns) => traverseNamespace(ns));
  };
  traverseNamespace(namespace);

  return out;
};

export default emitTypes;
