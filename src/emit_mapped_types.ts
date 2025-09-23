import {
  EmitContext,
  isTemplateDeclaration,
  Namespace,
  Operation,
  Type,
} from "@typespec/compiler";
import {
  getHttpOperation,
  resolveRequestVisibility,
  Visibility,
} from "@typespec/http";
import { resolveType } from "./emit_types_resolve.js";

export const emitRoutedTypemap = (
  context: EmitContext,
  namespace: Namespace,
): string => {
  const ops: {
    [path: string]: {
      [verb: string]: {
        // "string" in these does not refer to the type "string"! It's the typescript code as string.
        request: string;
        response: Array<{ status: number | "unknown"; body: string }>;
      };
    };
  } = {};

  const traverseNamespace = (n: Namespace): void => {
    // operations
    const processOp = (op: Operation) => {
      const httpOp = getHttpOperation(context.program, op);
      const path = httpOp[0].path;
      const verb = httpOp[0].verb.toUpperCase();
      if (!ops[path]) ops[path] = {};
      ops[path][verb] = {
        request: "null",
        response: [{ status: 200, body: "{}" }],
      };

      // request
      let request = "null";
      if (httpOp[0].parameters.body) {
        request = resolveType({
          t: httpOp[0].parameters.body.type,
          nestlevel: 1,
          currentNamespace: namespace,
          context,
          visibility: resolveRequestVisibility(
            context.program,
            op,
            httpOp[0].verb,
          ),
        }).replaceAll("\n", "\n  ");
      }
      ops[path][verb].request = request;

      // response
      if (op.returnType && op.returnType.kind) {
        const getReturnType = (
          t: Type,
        ): (typeof ops)[string][string]["response"] => {
          const ret: (typeof ops)[string][string]["response"] = [];
          if (t.kind === "Model") {
            // if the return type is a model, it may have a fully qualified body
            const modelret: (typeof ret)[number] = {
              status: 200,
              body: "{}",
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
                  modelret.body = resolveType({
                    t: prop.type,
                    nestlevel: 1,
                    currentNamespace: namespace,
                    context,
                    visibility: Visibility.Read,
                  }).replaceAll("\n", "\n  ");
                  wasQualifiedBody = true;
                }
              });
            });
            // ... if not, we assume status 200 and treat the model as the body
            if (!wasQualifiedBody) {
              modelret.body = resolveType({
                t,
                nestlevel: 1,
                currentNamespace: namespace,
                context,
                visibility: Visibility.Read,
              }).replaceAll("\n", "\n  ");
            }
            ret.push(modelret);
          } else if (t.kind === "Union") {
            // if the return type is a union, we have to check and resolve all variants
            // the union could either be a body-only definition or fully qualified (see above)
            t.variants.forEach((variant) => {
              ret.push(...getReturnType(variant.type));
            });
          } else
            ret.push({
              status: 200,
              body: resolveType({
                t,
                nestlevel: 1,
                currentNamespace: namespace,
                context,
                visibility: Visibility.Read,
              }),
            });
          return ret;
        };
        ops[path][verb].response = getReturnType(op.returnType);
      }
    }; // end operations

    n.operations.forEach(processOp);
    n.interfaces.forEach((itf) => {
      if (!isTemplateDeclaration(itf)) itf.operations.forEach(processOp);
    });

    // get and traverse all namespaces
    n.namespaces.forEach((ns) => traverseNamespace(ns));
  };

  traverseNamespace(namespace);
  let out = `export type types_${context.options["root-namespace"]} = {\n`;
  out += Object.entries(ops)
    .map((path) => {
      let pathret = `  ['${path[0]}']: {\n`;
      pathret += Object.entries(path[1])
        .map((verb) => {
          let verbret = `    ['${verb[0]}']: {\n`;
          verbret += `      request: ${verb[1].request}\n`;
          verbret += `      response: ${verb[1].response.map((res) => `{status: ${res.status}, body: ${res.body}}`).join(" | ")}\n`;
          verbret += "    }";
          return verbret;
        })
        .join(",\n");
      pathret += "\n  }";
      return pathret;
    })
    .join(",\n");
  out += "\n};\n";
  return out;
};
