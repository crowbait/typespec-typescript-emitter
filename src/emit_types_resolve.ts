import {
  ArrayModelType,
  EmitContext,
  Enum,
  getDoc,
  Model,
  Namespace,
  RecordModelType,
  Scalar,
  Tuple,
  Type,
  Union,
} from "@typespec/compiler";
import { isVisible, Visibility } from "@typespec/http";

export const resolveType = (
  t: Type,
  nestlevel: number,
  currentNamespace: Namespace,
  context: EmitContext,
  visibility?: Visibility,
): string => {
  let typeStr = "unknown";
  switch (t.kind) {
    case "Model":
      if (t.name === "Array") {
        typeStr = resolveArray(
          t as ArrayModelType,
          nestlevel,
          currentNamespace,
          context,
          visibility,
        );
      } else if (t.name === "Record") {
        typeStr = resolveRecord(
          t as RecordModelType,
          nestlevel,
          currentNamespace,
          context,
          visibility,
        );
      } else
        typeStr = resolveModel({
          m: t,
          nestlevel: nestlevel + 1,
          currentNamespace,
          context,
          visibility: visibility,
        });
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
      typeStr = resolveTuple(
        t,
        nestlevel,
        currentNamespace,
        context,
        visibility,
      );
      break;
    case "Union":
      typeStr = resolveUnion({
        u: t,
        nestlevel,
        currentNamespace,
        context,
        visibility,
      });
      break;
    default:
      console.warn("Could not resolve type:", t.kind);
  }
  return typeStr;
};

export const resolveArray = (
  a: ArrayModelType,
  nestlevel: number,
  currentNamespace: Namespace,
  context: EmitContext,
  visibility?: Visibility,
): string => {
  if (a.name !== "Array")
    throw new Error(`Trying to parse model ${a.name} as Array`);
  return `${resolveType(a.indexer.value, nestlevel, currentNamespace, context, visibility)}[]`;
};

export const resolveRecord = (
  a: RecordModelType,
  nestlevel: number,
  currentNamespace: Namespace,
  context: EmitContext,
  visibility?: Visibility,
): string => {
  if (a.name !== "Record")
    throw new Error(`Trying to parse model ${a.name} as Record`);
  return `{[k: string]: ${resolveType(a.indexer.value, nestlevel, currentNamespace, context, visibility)}}`;
};

export const resolveEnum = (
  e: Enum,
  nestlevel: number,
  isNamespaceRoot?: boolean,
): string => {
  if (e.name && !isNamespaceRoot && e.namespace?.enums.has(e.name))
    return e.name;
  let ret = "{\n";
  let i = 1;
  e.members.forEach((p) => {
    const val =
      p.value === undefined
        ? ""
        : " = " +
          (typeof p.value === "string" ? `'${p.value}'` : p.value.toString());
    ret = ret.addLine(
      `${p.name.includes("-") ? `'${p.name}'` : p.name}${val}${i < e.members.size ? "," : ""}`,
      nestlevel + 1,
    );
    i++;
  });
  ret = ret.addLine("}", nestlevel, true);
  return ret;
};

export const resolveTuple = (
  t: Tuple,
  nestlevel: number,
  currentNamespace: Namespace,
  context: EmitContext,
  visibility?: Visibility,
): string => {
  return `[${t.values.map((v) => resolveType(v, nestlevel, currentNamespace, context, visibility)).join(", ")}]`;
};

export const resolveUnion = (args: {
  u: Union;
  nestlevel: number;
  currentNamespace: Namespace;
  context: EmitContext;
  isNamespaceRoot?: boolean;
  visibility?: Visibility;
}): string => {
  if (
    args.u.name &&
    !args.isNamespaceRoot &&
    args.u.namespace?.unions.has(args.u.name)
  )
    return args.u.name;
  return Array.from(args.u.variants)
    .map((v) =>
      resolveType(
        v[1].type,
        args.nestlevel,
        args.currentNamespace,
        args.context,
        args.visibility,
      ),
    )
    .join(" | ");
};
export const resolveScalar = (s: Scalar): string => {
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

export const resolveModel = (args: {
  m: Model;
  nestlevel: number;
  currentNamespace: Namespace;
  context: EmitContext;
  isNamespaceRoot?: boolean;
  visibility?: Visibility;
}): string => {
  if (
    args.m.name &&
    !args.isNamespaceRoot &&
    args.currentNamespace.namespace === args.m.namespace
  )
    return args.m.name;
  let ret = "{\n";
  let i = 1;
  args.m.properties.forEach((p) => {
    if (
      args.visibility === undefined ||
      isVisible(args.context.program, p, args.visibility)
    ) {
      if (args.context) {
        const doc = getDoc(args.context.program, p);
        if (doc) ret = ret.addLine(`/** ${doc} */`, args.nestlevel! + 1);
      }
      const typeStr = resolveType(
        p.type,
        args.nestlevel,
        args.currentNamespace,
        args.context,
        args.visibility,
      );
      if (typeStr.includes("unknown"))
        console.warn(`Could not resolve property ${p.name} on ${args.m.name}`);
      ret = ret.addLine(
        `${p.name}${p.optional ? "?" : ""}: ${typeStr}${i < args.m.properties.size ? "," : ""}`,
        args.nestlevel + 1,
      );
    }
    i++;
  });
  ret = ret.addLine("}", args.nestlevel, true);
  return ret;
};
