import { EmitContext, getDoc, Namespace } from "@typespec/compiler";
import { getAuthentication, getHttpOperation } from "@typespec/http";
import { EmitterOptions } from "./lib.js";

export const emitRoutes = (
  options: EmitterOptions,
  context: EmitContext,
  namespace: Namespace,
): string => {
  let out = `export const routes_${context.options["root-namespace"]} = {\n`;

  const traverseNamespace = (n: Namespace, nestLevel: number): void => {
    // operations
    let opnum = 0;
    n.operations.forEach((op) => {
      opnum++;
      const httpOp = getHttpOperation(context.program, op);

      // jsdoc comment
      const doc = getDoc(context.program, op);
      if (doc) out = out.addLine(`/** ${doc} */`, nestLevel + 1);

      // start op body
      out = out.addLine(`${op.name}: {`, nestLevel + 1);

      // HTTP method
      out = out.addLine(
        `method: '${httpOp[0].verb.toUpperCase()}',`,
        nestLevel + 2,
      );

      // path
      out = out.addLine(`path: '${httpOp[0].path}',`, nestLevel + 2);

      // getUrl
      const pathParams = httpOp[0].parameters.parameters.filter(
        (p) => p.type === "path",
      );
      const pathParamsArgsString = pathParams
        .map((p) => `${p.name}: string`)
        .join(", ");
      const pathParamsArg = `params: {${pathParamsArgsString}}`;
      const pathParamsOutString = pathParams.reduce(
        (sum, cur) =>
          sum.replaceAll(`{${cur.name}}`, `${"$"}{params.${cur.name}}`),
        `\`${httpOp[0].path}\``,
      );

      out = out.addLine(
        `getUrl: (${pathParams.length > 0 ? pathParamsArg : ""}): string => ${pathParamsOutString},`,
        nestLevel + 2,
      );

      // auth
      let auth: Array<
        null | string | { apiKeyLocation: string; apiKeyName: string }
      > = [];
      const opAuth = getAuthentication(context.program, op);
      if (opAuth) {
        opAuth.options.forEach((authOption) =>
          authOption.schemes.forEach((authScheme) => {
            if (authScheme.type === "noAuth") auth.push(null);
            if (authScheme.type === "http")
              auth.push(authScheme.scheme.toUpperCase());
            if (authScheme.type === "apiKey")
              auth.push({
                apiKeyLocation: authScheme.in.toUpperCase(),
                apiKeyName: authScheme.name,
              });
            if (authScheme.type === "oauth2")
              authScheme.flows.forEach((oauthFlow) =>
                auth.push(`OAuth_${oauthFlow.type}`),
              );
            if (authScheme.type === "openIdConnect") auth.push("OPENID");
          }),
        );
      } else auth = [null];

      out = out.addLine(
        `auth: [${auth
          .map((authEntry) =>
            !authEntry
              ? "null"
              : typeof authEntry === "string"
                ? `'${authEntry}'`
                : `{${Object.entries(authEntry)
                    .map((entry) => `${entry[0]}: '${entry[1]}'`)
                    .join(", ")}}`,
          )
          .join(", ")}]`,
        nestLevel + 2,
      );

      // finalize route entry
      out = out.addLine(
        `}${opnum < n.operations.size || n.namespaces.size > 0 ? "," : ""}`,
        nestLevel + 1,
      );
    }); // end operations

    // get and traverse all namespaces
    let nsnum = 0;
    n.namespaces.forEach((ns) => {
      nsnum++;
      const doc = getDoc(context.program, ns);
      if (doc) out = out.addLine(`/** ${doc} */`, nestLevel + 1);
      out = out.addLine(`${ns.name}: {`, nestLevel + 1);
      traverseNamespace(ns, nestLevel + 1);
      out = out.addLine(
        `}${nsnum < n.namespaces.size ? "," : ""}`,
        nestLevel + 1,
      );
    });
  };

  traverseNamespace(namespace, 0);
  out += "} as const;\n";
  return out;
};
