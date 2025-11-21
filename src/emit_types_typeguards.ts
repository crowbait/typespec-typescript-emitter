import { Model, Namespace, Type } from "@typespec/compiler";
import { resolveScalar } from "./emit_types_resolve.js";

export const getTypeguardModel = (
  m: Model,
  accessor: string,
  nestingLevel = 1,
  currentNamespace: Namespace,
  serializableDates: boolean,
  knownGuards?: Array<{ filename: string; name: string }>,
): [string, string[]] => {
  const imports: string[] = [];
  return [
    Array.from(m.properties)
      .map((property) => {
        const guard = getTypeguard(
          property[1].type,
          `${accessor}['${property[1].name}']`,
          nestingLevel + 1,
          currentNamespace,
          serializableDates,
          knownGuards,
        );
        imports.push(...guard[1]);
        let ret = "  ".repeat(nestingLevel);
        ret += property[1].optional
          ? `${accessor}['${property[1].name}'] === undefined || `
          : `${accessor}['${property[1].name}'] !== undefined && `;
        ret += `(${guard[0]})`;
        return ret;
      })
      .filter((x) => !!x)
      .join(" &&\n"),
    imports,
  ];
};

/**
 * Creates the function body for a typeguard
 * @param t Type to create guards for
 * @param accessor String by which the type-to-test can be accessed by the code
 * @param nestingLevel
 * @param knownGuards Array of names of known typeguards; if type is found in those, no new typeguard will be created and instead a reference to the existing one is produced
 * @returns Tuple: [function body of the typeguard, array of import filenames (not unique!)]
 */
export const getTypeguard = (
  t: Type,
  accessor: string,
  nestingLevel = 1,
  currentNamespace: Namespace,
  serializableDates: boolean,
  knownGuards?: Array<{ filename: string; name: string }>,
): [string, string[]] => {
  switch (t.kind) {
    case "Model":
      if (t.name === "Array") {
        const guard = getTypeguard(
          t.indexer!.value,
          "v",
          nestingLevel,
          currentNamespace,
          serializableDates,
          knownGuards,
        );
        if (guard[0].endsWith("\n"))
          guard[0] = guard[0].substring(0, guard[0].length - 1);
        return [
          `Array.isArray(${accessor}) && ${accessor}.every((v) => ${guard[0]})`,
          guard[1],
        ];
      } else if (t.name === "Record") {
        const guard = getTypeguard(
          t.indexer!.value,
          "v",
          nestingLevel,
          currentNamespace,
          serializableDates,
          knownGuards,
        );
        if (guard[0].endsWith("\n"))
          guard[0] = guard[0].substring(0, guard[0].length - 1);
        return [
          `typeof ${accessor} === 'object' && (Object.entries(${accessor}).length > 0 ? Object.values(${accessor} as Record<string, any>).every((v) => ${guard[0]}) : true)`,
          guard[1],
        ];
      } else if (knownGuards && knownGuards.some((x) => x.name === t.name)) {
        return [
          `is${t.name}(${accessor})`,
          [
            `import {is${t.name}} from './${knownGuards.find((x) => x.name === t.name)!.filename}';`,
          ],
        ];
      } else if (
        t.name &&
        !knownGuards &&
        currentNamespace.name === t.namespace!.name
      ) {
        return [`is${t.name}(${accessor})`, []];
      } else {
        const guard = getTypeguardModel(
          t,
          accessor,
          nestingLevel,
          currentNamespace,
          serializableDates,
          knownGuards,
        );
        return [
          `(\n${guard[0]}\n${"  ".repeat(Math.max(nestingLevel - 1, 0))})`,
          guard[1],
        ];
      }
    case "Boolean":
      return [`typeof ${accessor} === 'boolean'`, []];
    case "Enum":
    case "EnumMember":
      // can't typeguard enums
      return ["true", []];
    case "Intrinsic":
      switch (t.name) {
        case "unknown":
          // can't typeguard "unknown"
          return ["true", []];
        default:
          return [`${accessor} === ${t.name}`, []];
      }
    case "Number":
      return [`typeof ${accessor} === 'number'`, []];
    case "Scalar":
      if (
        // TODO: figure out how to support all the varieties of dates
        // TODO: support byte arrays
        resolveScalar(t, serializableDates) !== "Date" &&
        resolveScalar(t, serializableDates) !== "Uint8Array"
      )
        return [
          `typeof ${accessor} === '${resolveScalar(t, serializableDates)}'`,
          [],
        ];
      break;
    case "String":
      return [`typeof ${accessor} === 'string'`, []];
    case "TemplateParameter":
      // template parameters resolve to unknown, which can't be typeguarded
      return ["true", []];
    case "Tuple": {
      // TODO: ['string1', 'string2'] gets resolved as [string, string] instead of literals. Why?
      const imports: string[] = [];
      return [
        t.values
          .map((v, i) => {
            const guard = getTypeguard(
              v,
              `${accessor}[${i}]`,
              nestingLevel,
              currentNamespace,
              serializableDates,
              knownGuards,
            );
            imports.push(...guard[1]);
            return `(${guard[0]})`;
          })
          .join(" && "),
        imports,
      ];
    }
    case "Union": {
      const imports: string[] = [];
      return [
        Array.from(t.variants)
          .map((v) => {
            const guard = getTypeguard(
              v[1].type,
              `${accessor}`,
              nestingLevel,
              currentNamespace,
              serializableDates,
              knownGuards,
            );
            imports.push(...guard[1]);
            return `(${guard[0]})`;
          })
          .join(" || "),
        imports,
      ];
    }
    default:
      console.warn("Could not resolve typeguard:", t.kind);
  }
  return ["true", []]; // fallback to not break everything in case of errors
};
