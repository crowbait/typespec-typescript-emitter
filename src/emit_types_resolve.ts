import {
  ArrayModelType,
  EmitContext,
  Enum,
  getDoc,
  Model,
  Scalar,
  Tuple,
  Type,
  Union,
} from "@typespec/compiler";

export const resolveType = (
  context: EmitContext,
  t: Type,
  nestlevel: number,
): string => {
  let typeStr = "unknown";
  switch (t.kind) {
    case "Model":
      if (t.name === "Array") {
        typeStr = resolveArray(context, t as ArrayModelType, nestlevel);
      } else typeStr = resolveModel(context, t, nestlevel + 1);
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
      typeStr = resolveTuple(context, t, nestlevel);
      break;
    case "Union":
      typeStr = resolveUnion(context, t, nestlevel);
      break;
    default:
      console.warn("Could not resolve type:", t.kind);
  }
  return typeStr;
};

export const resolveArray = (
  context: EmitContext,
  a: ArrayModelType,
  nestlevel: number,
): string => {
  if (a.name !== "Array")
    throw new Error(`Trying to parse model ${a.name} as Array`);
  const ret = `${resolveType(context, a.indexer.value, nestlevel)}[]`;
  return ret;
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
      `${p.name}${val}${i < e.members.size ? "," : ""}`,
      nestlevel + 1,
    );
    i++;
  });
  ret = ret.addLine("}", nestlevel, true);
  return ret;
};

export const resolveTuple = (
  context: EmitContext,
  t: Tuple,
  nestlevel: number,
): string => {
  return `[${t.values.map((v) => resolveType(context, v, nestlevel)).join(", ")}]`;
};

export const resolveUnion = (
  context: EmitContext,
  u: Union,
  nestlevel: number,
  isNamespaceRoot?: boolean,
): string => {
  if (u.name && !isNamespaceRoot && u.namespace?.unions.has(u.name))
    return u.name;
  return Array.from(u.variants)
    .map((v) => resolveType(context, v[1].type, nestlevel))
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

export const resolveModel = (
  context: EmitContext,
  m: Model,
  nestlevel: number = 0,
  isNamespaceRoot?: boolean,
): string => {
  if (m.name && !isNamespaceRoot && m.namespace?.models.has(m.name))
    return m.name;
  let ret = "{\n";
  let i = 1;
  m.properties.forEach((p) => {
    const doc = getDoc(context.program, p);
    if (doc) ret = ret.addLine(`/** ${doc} */`, nestlevel + 1);
    const typeStr = resolveType(context, p.type, nestlevel);
    if (typeStr.includes("unknown"))
      console.warn(`Could not resolve property ${p.name} on ${m.name}`);
    ret = ret.addLine(
      `${p.name}${p.optional ? "?" : ""}: ${typeStr}${i < m.properties.size ? "," : ""}`,
      nestlevel + 1,
    );
    i++;
  });
  ret = ret.addLine("}", nestlevel, true);
  return ret;
};
