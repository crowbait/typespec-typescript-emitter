import {
  ArrayModelType,
  EmitContext,
  getDoc,
  Namespace,
  Type,
} from "@typespec/compiler";
import { getAuthentication, getHttpOperation, HttpAuth } from "@typespec/http";
import { resolveScalar } from "./emit_types_resolve.js";
import autogenerateWarning from "./helper_autogenerateWarning.js";
import { EmitterOptions } from "./lib.js";

const emitRoutes = (
  context: EmitContext,
  namespace: Namespace,
  rootServer: string,
  options: EmitterOptions,
  typeguardedNames: string[],
): string => {
  const rootNode = `routes_${context.options["root-namespace"]}`;
  const imports: Array<{ model: string; importStatement: string }> = [];
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
      out = out.addLine(`method: '${httpOp[0].verb}',`, nestLevel + 2);

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
      const getTypeguard = (t: Type): string => {
        switch (t.kind) {
          case "Model":
            if (t.name !== "Array") {
              if (!typeguardedNames.includes(t.name)) {
                if (t.name) return "";
                return "(arg: any) => typeof arg === 'object'";
              }
              if (!imports.some((x) => x.model === t.name))
                imports.push({
                  model: t.name,
                  importStatement: `import {is${t.name}} from './${n.name.charAt(0).toUpperCase() + n.name.slice(1)}';`,
                });
              return `is${t.name}`;
            } else {
              const typeguard = getTypeguard(
                (t as ArrayModelType).indexer.value,
              );
              if (!typeguard) return "";
              return `(arg: any) => (Array.isArray(arg) && ( arg.every((x) => (${typeguard})(x)) ) )`;
            }
          case "Boolean":
            return `(arg: any) => typeof arg === 'boolean'`;
          case "Intrinsic":
            if (t.name === "void") return "";
            return `(arg: any) => arg === ${t.name}`;
          case "Number":
            return `(arg: any) => typeof arg === 'number'`;
          case "Scalar":
            if (
              resolveScalar(t) !== "Date" &&
              resolveScalar(t) !== "Uint8Array"
            ) {
              return `(arg: any) => typeof arg === '${resolveScalar(t)}'`;
            } else {
              return `(arg: any) => typeof arg === 'object'`;
            }
          case "String":
            return `(arg: any) => typeof arg === 'string'`;
          case "Tuple": {
            const typeguards = t.values
              .map((v) => getTypeguard(v))
              .filter((v) => !!v);
            if (typeguards.length === 0) return "";
            return `(arg: any) => Array.isArray(arg) && (${typeguards.map((v, i) => `(${v})(arg[${i}])`).join(" && ")})`;
          }
          case "Union": {
            const typeguards = Array.from(t.variants)
              .map((v) => getTypeguard(v[1].type))
              .filter((x) => !!x)
              .map((v) => `((${v})(arg))`)
              .join(" || ");
            if (!typeguards) return "";
            return `(arg: any) => (${typeguards})`;
          }

          default:
            return "null";
        }
      };

      if (options["typeguards-in-routes"]) {
        if (!typeguardedNames) {
          console.warn(
            "Typeguard Names List was empty when it shouldn't have been.",
          );
          return;
        }
        if (op.parameters.properties.has("body")) {
          out = out.addLine(
            `isRequestType: ${getTypeguard(op.parameters.properties.get("body")!.type) || "null"},`,
            nestLevel + 2,
          );
        } else out = out.addLine("isRequestType: null,", nestLevel + 2);

        // TODO check: filters void?
        // TODO what the fuck is going on with robots, spec, doc (spec, not docs), etc..?
        // TODO filter everything not from root namespace / child of root namespace (Unauthorized and shit like that)
        if (
          op.returnType &&
          op.returnType.kind &&
          op.returnType.kind !== "Intrinsic"
        ) {
          out = out.addLine(
            `isResponseType: ${getTypeguard(op.returnType) || "null"}`,
            nestLevel + 2,
          );
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

  out = `${imports.map((x) => x.importStatement).join("\n")}\n\n${out}`;

  return out;
};

export default emitRoutes;
