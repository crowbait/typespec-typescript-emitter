import { EmitContext, Model } from "@typespec/compiler";
import { resolveScalar } from "./emit_types_resolve.js";

export const createModelGuard = (context: EmitContext, m: Model): string => {
  let ret = "";
  const lines: string[] = [];

  Array.from(m.properties).map((prop) => {
    const lineParts: string[] = [];
    if (!prop[1].optional)
      lineParts.push(`arg['${prop[1].name}'] !== undefined`);
    switch (prop[1].type.kind) {
      case "Model":
        if (prop[1].type.name === "Array") {
          lineParts.push(
            `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}Array.isArray(arg['${prop[1].name}'])`,
          );
        } // else typeStr = resolveModel(context, t, nestlevel + 1);
        break;
      case "Boolean":
        lineParts.push(
          `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}typeof arg['${prop[1].name}'] === 'boolean'`,
        );
        break;
      case "Intrinsic":
        lineParts.push(
          `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}arg['${prop[1].name}'] === ${prop[1].type.name}`,
        );
        break;
      case "Number":
        lineParts.push(
          `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}typeof arg['${prop[1].name}'] === 'number'`,
        );
        break;
      case "Scalar":
        if (
          resolveScalar(prop[1].type) !== "Date" &&
          resolveScalar(prop[1].type) !== "Uint8Array"
        )
          lineParts.push(
            `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}typeof arg['${prop[1].name}'] === '${resolveScalar(prop[1].type)}'`,
          );
        break;
      case "String":
        lineParts.push(
          `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}typeof arg['${prop[1].name}'] === 'string'`,
        );
        break;
      case "Tuple":
        lineParts.push(
          `${prop[1].optional ? `arg['${prop[1].name}'] === undefined || ` : ""}Array.isArray(arg['${prop[1].name}'])`,
        );
        break;
      case "Union":
        // Unions are not yet supported
        break;
      default:
        console.warn("Could not resolve type:", prop[1].type.kind);
    }
    lines.push(lineParts.join(" && "));
  });

  ret += lines
    .filter((x) => !!x)
    .map((x) => `(${x})`)
    .join(" &&\n    ");
  return ret;
};
