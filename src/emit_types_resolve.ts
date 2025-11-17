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

type CommonOptions = {
  nestlevel: number;
  currentNamespace: Namespace;
  context: EmitContext;
  visibility?: Visibility;
  resolveEvenWithName?: boolean;
  isNamespaceRoot?: boolean;
};

export const resolveType = (t: Type, opts: CommonOptions): string => {
  let typeStr = "unknown";
  switch (t.kind) {
    case "Model":
      if (t.name === "Array") {
        typeStr = resolveArray(t as ArrayModelType, opts);
      } else if (t.name === "Record") {
        typeStr = resolveRecord(t as RecordModelType, opts);
      } else typeStr = resolveModel(t, opts);
      break;
    case "Boolean":
      typeStr = "boolean";
      break;
    case "Enum":
      typeStr = resolveEnum(t, opts);
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
      typeStr = resolveTuple(t, opts);
      break;
    case "Union":
      typeStr = resolveUnion(t, opts);
      break;
    case "EnumMember":
      typeStr = `${t.enum.name}.${t.name}`;
      break;
    default:
      console.warn("Could not resolve type:", t.kind);
  }
  return typeStr;
};

export const resolveArray = (
  a: ArrayModelType,
  opts: CommonOptions,
): string => {
  if (a.name !== "Array")
    throw new Error(`Trying to parse model ${a.name} as Array`);
  return `(${resolveType(a.indexer.value, { ...opts, isNamespaceRoot: false })})[]`;
};

export const resolveRecord = (
  a: RecordModelType,
  opts: CommonOptions,
): string => {
  if (a.name !== "Record")
    throw new Error(`Trying to parse model ${a.name} as Record`);
  return `{[k: string]: ${resolveType(a.indexer.value, opts)}}`;
};

export const resolveEnum = (e: Enum, opts: CommonOptions): string => {
  if (
    e.name &&
    !opts.isNamespaceRoot &&
    opts.currentNamespace.enums.has(e.name) &&
    !opts.resolveEvenWithName
  )
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
      opts.nestlevel + 1,
    );
    i++;
  });
  ret = ret.addLine("}", opts.nestlevel, true);
  return ret;
};

export const resolveTuple = (t: Tuple, opts: CommonOptions): string => {
  return `[${t.values.map((v) => resolveType(v, opts)).join(", ")}]`;
};

export const resolveUnion = (u: Union, opts: CommonOptions): string => {
  if (
    u.name &&
    !opts.isNamespaceRoot &&
    u.namespace?.unions.has(u.name) &&
    !opts.resolveEvenWithName
  )
    return u.name;
  return Array.from(u.variants)
    .map((v) => {
      const variantType = v[1].type;
      // If variant is a named model in the current namespace, reference it by name
      if (
        variantType.kind === "Model" &&
        variantType.name &&
        opts.currentNamespace.models.has(variantType.name)
      ) {
        return variantType.name;
      }
      // Otherwise resolve type inline
      return resolveType(variantType, { ...opts, isNamespaceRoot: false });
    })
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

export const resolveModel = (m: Model, opts: CommonOptions): string => {
  if (
    m.name &&
    !opts.isNamespaceRoot &&
    opts.currentNamespace.models.has(m.name) &&
    !opts.resolveEvenWithName
  )
    return m.name;
  let ret = "{\n";
  let i = 1;
  m.properties.forEach((p) => {
    if (
      opts.visibility === undefined ||
      isVisible(opts.context.program, p, opts.visibility)
    ) {
      if (opts.context) {
        const doc = getDoc(opts.context.program, p);
        if (doc) ret = ret.addLine(`/** ${doc} */`, opts.nestlevel! + 1);
      }
      const typeStr = resolveType(p.type, {
        ...opts,
        nestlevel: opts.nestlevel + 1,
        isNamespaceRoot: false,
      });
      if (typeStr.includes("unknown"))
        console.warn(`Could not resolve property ${p.name} on ${m.name}`);
      ret = ret.addLine(
        `${p.name}${p.optional ? "?" : ""}: ${typeStr}${i < m.properties.size ? "," : ""}`,
        opts.nestlevel + 1,
      );
    }
    i++;
  });
  ret = ret.addLine("}", opts.nestlevel, true);
  return ret;
};
