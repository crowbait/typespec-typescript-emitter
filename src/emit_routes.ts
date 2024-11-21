import { EmitContext, getDoc, Namespace } from "@typespec/compiler";
import { getAuthentication, getHttpOperation, HttpAuth } from "@typespec/http";
import autogenerateWarning from "./helper_autogenerateWarning.js";

const emitRoutes = (
  context: EmitContext,
  namespace: Namespace,
  rootServer: string,
): string => {
  const rootNode = `routes_${context.options["root-namespace"]}`;
  let out = autogenerateWarning;

  out +=
    "/** This type is mostly meant for use in function signatures and `extends`' in generic functions.\n";
  out += "  * eg: `const callApi(route: IRoute) => fetch(route.getUrl(...))`\n";
  out +=
    "  * It should not be used to type variables (eg.: `let x: IRoute`), because the resulting type\n";
  out += "  * loses it's information about the getUrl parameters.\n";
  out += "  */\n";
  out += "export interface IRoute {\n";
  out += "  method: string\n";
  /* The "getUrl" type should really be more specific; something that at least shows that it's a Record.
   * However, doing that, Typescript always complains about the actual fields (of an implemented function in the output)
   * is missing from the type. I think, it's a TS issue...
   */
  out += "  getUrl: (p: any) => string\n";
  out += "  auth: boolean | 'varies'\n";
  out += "};\n\n";

  out += `const ${rootNode} = {\n`;

  const traverseNamespace = (n: Namespace, nestLevel: number): void => {
    const line = (str: string, addLevels?: number): void => {
      out += `${"  ".repeat(nestLevel + 1 + (addLevels ?? 0))}${str}\n`;
    };

    // operations
    let opNum = 0;
    n.operations.forEach((op) => {
      opNum++;
      const httpOp = getHttpOperation(context.program, op);

      // jsdoc comment
      const doc = getDoc(context.program, op);
      if (doc) line(`/** ${doc} */`);
      line(`${op.name}: {`);

      // http method
      line(`method: '${httpOp[0].verb}',`, 1);

      // url parameters
      const pathParams = httpOp[0].parameters.parameters.filter(
        (p) => p.type === "path",
      );
      if (pathParams.length > 0) {
        line("getUrl: (p: {", 1);
        pathParams.map((p) => `${p.name}: string`).forEach((p) => line(p, 2));
        let fn = "}) => ";
        fn += pathParams.reduce(
          (sum, cur) =>
            sum.replaceAll(`{${cur.name}}`, `${"$"}{p.${cur.name}}`),
          `\`${rootServer}${httpOp[0].path}\`,`,
        );
        line(fn, 1);
      } else {
        line(`getUrl: () => '${rootServer}${httpOp[0].path}',`, 1);
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
      line(
        `auth: ${typeof auth === "string" ? `'${auth}'` : auth.toString()}`,
        1,
      );

      line(`}${opNum < n.operations.size || n.namespaces.size > 0 ? "," : ""}`);
    });

    // namespaces
    let nsNum = 0;
    n.namespaces.forEach((ns) => {
      nsNum++;
      const doc = getDoc(context.program, ns);
      if (doc) line(`/** ${doc} */`);
      line(`${ns.name}: {`);
      traverseNamespace(ns, nestLevel + 1);
      line(`}${nsNum < n.namespaces.size ? "," : ""}`);
    });
  };

  traverseNamespace(namespace, 0);

  out += "} as const;\n";
  out += `export default ${rootNode};\n`;

  return out;
};

export default emitRoutes;
