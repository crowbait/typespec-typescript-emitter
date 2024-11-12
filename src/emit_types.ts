import {
  ArrayModelType,
  EmitContext,
  Enum,
  getDoc,
  Model,
  Namespace,
  Scalar,
  Tuple,
  Type,
  Union,
} from "@typespec/compiler";
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
): Record<string, string> => {
  const out: ReturnType<typeof emitTypes> = {};

  const traverseNamespace = (n: Namespace): void => {
    let file = autogenerateWarning;

    const resolvedNames: {
      enums: string[];
      unions: string[];
      models: string[];
    } = {
      enums: [],
      unions: [],
      models: [],
    };

    const resolveType = (t: Type, nestlevel: number): string => {
      let typeStr = "unknown";
      switch (t.kind) {
        case "Model":
          if (t.name === "Array") {
            typeStr = resolveArray(t as ArrayModelType, nestlevel);
          } else typeStr = resolveModel(t, nestlevel + 1);
          break;
        case "Boolean":
          typeStr = "boolean";
          break;
        case "Enum":
          typeStr = resolveEnum(t, nestlevel);
          break;
        case "Intrinsic":
          typeStr = t.name;
          break;
        case "Number":
          typeStr = t.valueAsString;
          break;
        case "Scalar":
          typeStr = resolveScalar(t);
          break;
        case "String":
          typeStr = `'${t.value}'`;
          break;
        case "Tuple":
          typeStr = resolveTuple(t, nestlevel);
          break;
        case "Union":
          typeStr = resolveUnion(t, nestlevel);
          break;
        default:
          console.warn("Could not resolve type:", t.kind);
      }
      return typeStr;
    };

    const resolveArray = (a: ArrayModelType, nestlevel: number): string => {
      if (a.name !== "Array")
        throw new Error(`Trying to parse model ${a.name} as Array`);
      let ret = `${resolveType(a.indexer.value, nestlevel)}[]`;
      return ret;
    };

    const resolveEnum = (e: Enum, nestlevel: number): string => {
      if (e.name && resolvedNames.enums.includes(e.name)) return e.name;
      let ret = "{\n";
      let i = 1;
      e.members.forEach((p) => {
        const val =
          p.value === undefined
            ? ""
            : " = " +
              (typeof p.value === "string"
                ? `'${p.value}'`
                : p.value.toString());
        ret = ret.addLine(
          `${p.name}${val}${i < e.members.size ? "," : ""}`,
          nestlevel + 1,
        );
        i++;
      });
      ret = ret.addLine("}", nestlevel, true);
      resolvedNames.enums.push(e.name);
      return ret;
    };

    const resolveTuple = (t: Tuple, nestlevel: number): string => {
      return `[${t.values.map((v) => resolveType(v, nestlevel)).join(", ")}]`;
    };

    const resolveUnion = (u: Union, nestlevel: number): string => {
      if (u.name && resolvedNames.unions.includes(u.name)) return u.name;
      return Array.from(u.variants)
        .map((v) => resolveType(v[1].type, nestlevel))
        .join(" | ");
    };

    const resolveScalar = (s: Scalar): string => {
      let ret = "unknown";
      if (!s.baseScalar) {
        switch (s.name) {
          case "boolean":
            ret = "boolean";
            break;
          case "bytes":
            ret = "Uint8Array";
            break;
          case "duration":
          case "numeric":
            ret = "number";
            break;
          case "plainTime":
          case "string":
          case "url":
            ret = "string";
            break;
          case "offsetDateTime":
          case "plainDate":
          case "unixTimestamp32":
          case "utcDateTime":
            ret = "Date";
            break;
          default:
            console.warn("Could not resolve scalar:", s.name);
        }
      }
      return s.baseScalar ? resolveScalar(s.baseScalar) : ret;
    };

    const resolveModel = (m: Model, nestlevel: number = 0): string => {
      if (m.name && resolvedNames.models.includes(m.name)) return m.name;
      let ret = "{\n";
      let i = 1;
      m.properties.forEach((p) => {
        const doc = getDoc(context.program, p);
        if (doc) ret = ret.addLine(`/** ${doc} */`, nestlevel + 1);
        const typeStr = resolveType(p.type, nestlevel);
        if (typeStr.includes("unknown"))
          console.warn(`Could not resolve property ${p.name} on ${m.name}`);
        ret = ret.addLine(
          `${p.name}: ${typeStr}${i < m.properties.size ? "," : ""}`,
          nestlevel + 1,
        );
        i++;
      });
      ret = ret.addLine("}", nestlevel, true);
      resolvedNames.models.push(m.name);
      return ret;
    };

    n.enums.forEach((e) => {
      const resolved = resolveEnum(e, 0);
      if (resolved) {
        const doc = getDoc(context.program, e);
        if (doc) file = file.addLine(`/** ${doc} */`);
        file = file.addLine(`export enum ${e.name} ${resolved};\n`);
      }
    });
    n.unions.forEach((u) => {
      const resolved = resolveUnion(u, 0);
      if (resolved) {
        const doc = getDoc(context.program, u);
        if (doc) file = file.addLine(`/** ${doc} */`);
        file = file.addLine(`export type ${u.name} = ${resolved};\n`);
      }
    });
    n.models.forEach((m) => {
      const resolved = resolveModel(m);
      if (resolved) {
        const doc = getDoc(context.program, m);
        if (doc) file = file.addLine(`/** ${doc} */`);
        file = file.addLine(`export interface ${m.name} ${resolved};\n`);
      }
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
