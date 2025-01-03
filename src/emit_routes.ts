import {
  EmitContext,
  getDoc,
  Model,
  Namespace,
  Type,
} from "@typespec/compiler";
import { getAuthentication, getHttpOperation, HttpAuth } from "@typespec/http";
import { getTypeguard } from "./emit_types_typeguards.js";
import autogenerateWarning from "./helper_autogenerateWarning.js";
import { EmitterOptions } from "./lib.js";

const emitRoutes = (
  context: EmitContext,
  namespace: Namespace,
  rootServer: string,
  options: EmitterOptions,
  knownTypeguards: Array<{ filename: string; name: string }>,
): string => {
  const rootNode = `routes_${context.options["root-namespace"]}`;
  const imports: string[] = [];
  let out = autogenerateWarning;
  out += `const ${rootNode} = {\n`;

  const traverseNamespace = (n: Namespace, nestLevel: number): void => {
    // operations
    let opNum = 0;
    n.operations.forEach((op) => {
      opNum++;
      const httpOp = getHttpOperation(context.program, op);

      // jsdoc comment
      const doc = getDoc(context.program, op);
      if (doc) out = out.addLine(`/** ${doc} */`, nestLevel + 1);
      out = out.addLine(`${op.name}: {`, nestLevel + 1);

      // http method
      out = out.addLine(
        `method: '${httpOp[0].verb.toUpperCase()}',`,
        nestLevel + 2,
      );

      // url parameters
      const pathParams = httpOp[0].parameters.parameters.filter(
        (p) => p.type === "path",
      );
      if (pathParams.length > 0) {
        out = out.addLine("getUrl: (p: {", nestLevel + 2);
        pathParams
          .map((p) => `${p.name}: string`)
          .forEach((p) => (out = out.addLine(p, nestLevel + 3)));
        let fn = "}) => ";
        fn += pathParams.reduce(
          (sum, cur) =>
            sum.replaceAll(`{${cur.name}}`, `${"$"}{p.${cur.name}}`),
          `\`${rootServer}${httpOp[0].path}\`,`,
        );
        out = out.addLine(fn, nestLevel + 2);
      } else {
        out = out.addLine(
          `getUrl: () => '${rootServer}${httpOp[0].path}',`,
          nestLevel + 2,
        );
      }

      // auth
      let auth: string | boolean = false;
      const opAuth = getAuthentication(context.program, op);
      if (opAuth) {
        let includesSome = false;
        let includesNone = false;
        opAuth.options.forEach((authOpt) => {
          if (
            authOpt.schemes.some((scheme: HttpAuth) => scheme.type !== "noAuth")
          )
            includesSome = true;
          if (
            authOpt.schemes.some((scheme: HttpAuth) => scheme.type === "noAuth")
          )
            includesNone = true;
        });
        auth =
          includesSome && includesNone
            ? "varies"
            : includesSome && !includesNone
              ? true
              : false;
      }
      out = out.addLine(
        `auth: ${typeof auth === "string" ? `'${auth}'` : auth.toString()}${options["typeguards-in-routes"] ? "," : ""}`,
        nestLevel + 2,
      );

      // typeguards
      const typeguardLines = (t: Type): string[] => {
        const guard = getTypeguard(t, "arg", 0, n, knownTypeguards);
        imports.push(...guard[1]);
        return guard[0].split("\n");
      };

      if (options["typeguards-in-routes"]) {
        if (!knownTypeguards) {
          console.warn(
            "Typeguard Names List was empty when it shouldn't have been.",
          );
          return;
        }
        if (op.parameters.properties.has("body")) {
          const lines = typeguardLines(
            op.parameters.properties.get("body")!.type,
          );
          out = out.addLine(
            `isRequestType: ${lines.length === 0 ? "null" : `(arg: any): boolean => ${lines.shift()}`}${lines.length < 1 ? "," : ""}`,
            nestLevel + 2,
            lines.length === 1,
          );
          if (lines.length > 0) {
            lines[lines.length - 1] += ",";
            lines.forEach((line, i, arr) => {
              out = out.addLine(
                line,
                lines.length > 1 ? nestLevel + (i < arr.length - 1 ? 3 : 2) : 0,
              );
            });
          }
        } else out = out.addLine("isRequestType: null,", nestLevel + 2);

        if (
          op.returnType &&
          op.returnType.kind &&
          op.returnType.kind !== "Intrinsic"
        ) {
          const lines: string[] = [];
          const addModelLines = (m: Model): void => {
            if (m.properties.has("body")) {
              lines.push(...typeguardLines(m.properties.get("body")!.type));
              // else (no "body" prop): stays empty -> 'null'
              // why?: unnamed model return type is likely to be / should be
              //   headers'n'stuff, so if there is no "body" property, play it safe
            }
          };
          if (op.returnType.kind === "Union") {
            op.returnType.variants.forEach((v) => {
              if (v.type.kind === "Model") addModelLines(v.type);
            });
          }
          if (op.returnType.kind === "Model") addModelLines(op.returnType);
          out = out.addLine(
            `isResponseType: ${lines.length === 0 ? "null" : `(arg: any): boolean => ${lines.shift()}`}${lines.length < 1 ? "," : ""}`,
            nestLevel + 2,
            lines.length === 1,
          );
          lines.forEach((line, i, arr) => {
            out = out.addLine(
              line,
              lines.length > 1 ? nestLevel + (i < arr.length - 1 ? 3 : 2) : 0,
            );
          });
        } else out = out.addLine("isResponseType: null", nestLevel + 2);
      }

      out = out.addLine(
        `}${opNum < n.operations.size || n.namespaces.size > 0 ? "," : ""}`,
        nestLevel + 1,
      );
    });

    // namespaces
    let nsNum = 0;
    n.namespaces.forEach((ns) => {
      nsNum++;
      const doc = getDoc(context.program, ns);
      if (doc) out = out.addLine(`/** ${doc} */`, nestLevel + 1);
      out = out.addLine(`${ns.name}: {`, nestLevel + 1);
      traverseNamespace(ns, nestLevel + 1);
      out = out.addLine(
        `}${nsNum < n.namespaces.size ? "," : ""}`,
        nestLevel + 1,
      );
    });
  };

  traverseNamespace(namespace, 0);

  out += "} as const;\n";
  out += `export default ${rootNode};\n`;

  out = `${imports.filter((x, i, arr) => arr.indexOf(x) === i).join("\n")}\n\n${out}`;
  return out;
};

export default emitRoutes;
