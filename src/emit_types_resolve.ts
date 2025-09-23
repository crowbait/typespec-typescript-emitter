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

export const resolveType = (args: {
  t: Type;
  nestlevel: number;
  currentNamespace: Namespace;
  context: EmitContext;
  visibility?: Visibility;
}): string => {
  let typeStr = "unknown";
  switch (args.t.kind) {
    case "Model":
      if (args.t.name === "Array") {
        typeStr = resolveArray(
          args.t as ArrayModelType,
          args.nestlevel,
          args.currentNamespace,
          args.context,
          args.visibility,
        );
      } else if (args.t.name === "Record") {
        typeStr = resolveRecord(
          args.t as RecordModelType,
          args.nestlevel,
          args.currentNamespace,
          args.context,
          args.visibility,
        );
      } else
        typeStr = resolveModel({
          m: args.t,
          nestlevel: args.nestlevel + 1,
          currentNamespace: args.currentNamespace,
          context: args.context,
          visibility: args.visibility,
        });
      break;
    case "Boolean":
      typeStr = "boolean";
      break;
    case "Enum":
      typeStr = resolveEnum(args.t, args.nestlevel);
      break;
    case "Intrinsic":
      typeStr = args.t.name;
      break;
    case "Number":
      typeStr = args.t.valueAsString;
      break;
    case "Scalar":
      typeStr = resolveScalar(args.t);
      break;
    case "String":
      typeStr = `'${args.t.value}'`;
      break;
    case "Tuple":
      typeStr = resolveTuple(
        args.t,
        args.nestlevel,
        args.currentNamespace,
        args.context,
        args.visibility,
      );
      break;
    case "Union":
      typeStr = resolveUnion({
        u: args.t,
        nestlevel: args.nestlevel,
        currentNamespace: args.currentNamespace,
        context: args.context,
        visibility: args.visibility,
      });
      break;
    default:
      console.warn("Could not resolve type:", args.t.kind);
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
  return `${resolveType({ t: a.indexer.value, nestlevel, currentNamespace, context, visibility })}[]`;
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
  return `{[k: string]: ${resolveType({ t: a.indexer.value, nestlevel, currentNamespace, context, visibility })}}`;
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
  return `[${t.values.map((v) => resolveType({ t: v, nestlevel, currentNamespace, context, visibility })).join(", ")}]`;
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
      resolveType({
        t: v[1].type,
        nestlevel: args.nestlevel,
        currentNamespace: args.currentNamespace,
        context: args.context,
        visibility: args.visibility,
      }),
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
      const typeStr = resolveType({
        t: p.type,
        nestlevel: args.nestlevel,
        currentNamespace: args.currentNamespace,
        context: args.context,
        visibility: args.visibility,
      });
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
