import { EmitContext, Namespace, Type } from "@typespec/compiler";
import { getHttpOperation } from "@typespec/http";
import { resolveType } from "./emit_types_resolve.js";

export const emitRoutedTypemap = (
  context: EmitContext,
  namespace: Namespace,
): string => {
  const ops: {
    [K: string]: {
      // "string" in these does not refer to the type "string"! It's the typescript code as string.
      request: string;
      response: Array<{ status: number | "unknown"; body: string }>;
    };
  } = {};

  const traverseNamespace = (n: Namespace): void => {
    // operations
    n.operations.forEach((op) => {
      const httpOp = getHttpOperation(context.program, op);
      const identifier = httpOp[0].path;
      ops[identifier] = {
        request: "null",
        response: [{ status: 200, body: "unknown" }],
      };

      // request
      let request = "null";
      if (op.parameters.properties.has("body")) {
        request = resolveType(
          op.parameters.properties.get("body")!.type,
          1,
          namespace,
          context,
        );
      }
      ops[identifier].request = request;

      // response
      if (op.returnType && op.returnType.kind) {
        const getReturnType = (t: Type): (typeof ops)[string]["response"] => {
          const ret: (typeof ops)[string]["response"] = [];
          if (t.kind === "Model") {
            // if the return type is a model, it may have a fully qualified body
            const modelret: (typeof ret)[number] = {
              status: 200,
              body: "unknown",
            };
            let wasQualifiedBody = false;
            t.properties.forEach((prop) => {
              prop.decorators.forEach((dec) => {
                // one of the properties may be the status code
                if (
                  dec.definition?.name === "@statusCode" &&
                  prop.type.kind === "Number"
                )
                  modelret.status = prop.type.value;
                // one of the properties may be the body definition
                if (dec.definition?.name === "@body") {
                  modelret.body = resolveType(prop.type, 1, namespace, context);
                  wasQualifiedBody = true;
                }
              });
            });
            // ... if not, we assume status 200 and treat the model as the body
            if (!wasQualifiedBody) {
              modelret.body = resolveType(t, 1, namespace, context);
            }
            ret.push(modelret);
          } else if (t.kind === "Union") {
            // if the return type is a union, we have to check and resolve all variants
            // the union could either be a body-only definition or fully qualified (see above)
            t.variants.forEach((variant) => {
              ret.push(...getReturnType(variant.type));
            });
          } else ret.push({ status: 200, body: resolveType(t, 1, namespace) });
          return ret;
        };
        ops[identifier].response = getReturnType(op.returnType);
      }
    }); // end operations

    // get and traverse all namespaces
    n.namespaces.forEach((ns) => traverseNamespace(ns));
  };

  traverseNamespace(namespace);
  console.log(ops);
  let out = `export type types_${context.options["root-namespace"]} = {\n`;
  out += Object.entries(ops)
    .map((op) => {
      let ret = `  ['${op[0]}']: {\n`;
      ret += `    request: ${op[1].request}\n`;
      ret += `    response: ${op[1].response.map((res) => `{status: ${res.status}, body: ${res.body}}`).join(" | ")}\n`;
      ret += "  }";
      return ret;
    })
    .join(",\n");
  out += "\n};\n";
  return out;
};
