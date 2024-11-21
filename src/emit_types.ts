import { EmitContext, getDoc, Namespace } from "@typespec/compiler";
import {
  resolveEnum,
  resolveModel,
  resolveUnion,
} from "./emit_types_resolve.js";
import { createModelGuard } from "./emit_types_typeguards.js";
import autogenerateWarning from "./helper_autogenerateWarning.js";

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

const emitTypes = (
  context: EmitContext,
  namespace: Namespace,
  emit: {
    types?: boolean;
    typeguards?: boolean;
  },
): Record<string, string> => {
  const out: ReturnType<typeof emitTypes> = {};

  const traverseNamespace = (n: Namespace): void => {
    let file = autogenerateWarning;

    n.enums.forEach((e) => {
      if (emit.types) {
        const resolved = resolveEnum(e, 0);
        if (resolved) {
          const doc = getDoc(context.program, e);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export enum ${e.name} ${resolved};\n`);
        }
      }
    });
    n.unions.forEach((u) => {
      if (emit.types) {
        const resolved = resolveUnion(context, u, 0);
        if (resolved) {
          const doc = getDoc(context.program, u);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export type ${u.name} = ${resolved};\n`);
        }
      }
    });
    n.models.forEach((m) => {
      if (emit.types) {
        const resolved = resolveModel(context, m);
        if (resolved) {
          const doc = getDoc(context.program, m);
          if (doc) file = file.addLine(`/** ${doc} */`);
          file = file.addLine(`export interface ${m.name} ${resolved};`);
        }
      }
      if (emit.typeguards) {
        const guard = createModelGuard(context, m);
        if (guard) {
          file = file.addLine(
            `export function is${m.name}(arg: any): arg is ${m.name} {`,
          );
          file = file.addLine("return (", 1);
          file = file.addLine(guard, 2);
          file = file.addLine(");", 1);
          file = file.addLine("};");
        }
      }
      file += "\n";
    });

    // set output for this namespace
    out[n.name.charAt(0).toUpperCase() + n.name.slice(1)] = file;
    // recursively iterate child namespaces
    n.namespaces.forEach((ns) => traverseNamespace(ns));
  };
  traverseNamespace(namespace);

  return out;
};

export default emitTypes;
