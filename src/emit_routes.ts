import {
  emitFile,
  getDoc,
  Interface,
  isTemplateDeclaration,
  Namespace,
  navigateProgram,
  Program,
  resolvePath,
} from "@typespec/compiler";
import { getAuthentication, getHttpOperation } from "@typespec/http";
import { AppendableString } from "./helpers/appendableString.js";
import { EmitterOptions } from "./lib.js";

export const emitRoutes = async (
  program: Program,
  options: EmitterOptions,
): Promise<void> => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = [...options["root-namespaces"]];

  const files: Record<string, AppendableString> = {};

  const traverseNamespace = (
    n: Namespace | Interface,
    nestlevel: number,
    rootName: string,
  ) => {
    if (files[rootName] === undefined)
      files[rootName] = new AppendableString(
        `export const routes_${rootName} = {\n`,
      );

    const numCollections =
      Array.from((n as any).interfaces ?? []).length +
      Array.from(((n as any).namespaces ?? []) as any[]).length;
    console.log(n.name, numCollections);

    let i = 1;
    for (const op of n.operations) {
      const httpOp = getHttpOperation(program, op[1])[0];

      const pathParams = httpOp.parameters.parameters.filter(
        (p) => p.type === "path",
      );
      const urlParams = `params: {${pathParams
        .map((p) => `${p.name}: string`)
        .join(", ")}}`;
      const urlReturn = pathParams.reduce(
        (sum, cur) =>
          sum.replaceAll(`{${cur.name}}`, `${"$"}{params.${cur.name}}`),
        `\`${httpOp.path}\``,
      );

      const doc = getDoc(program, op[1]);
      if (doc)
        files[rootName].addLine(
          `/** ${doc} */`
            .split("\n")
            .map((l) => `${"  ".repeat(nestlevel)}${l}`)
            .join("\n"),
          0,
        );
      files[rootName]
        .addLine(`${op[1].name}: {`, nestlevel)
        .addLine(`verb: '${httpOp.verb.toUpperCase()}',`, nestlevel + 1)
        .addLine(`path: '${httpOp.path}',`, nestlevel + 1)
        .addLine(
          `getUrl: (${pathParams.length > 0 ? urlParams : ""}): string => ${urlReturn},`,
          nestlevel + 1,
        );

      // auth
      let auth: Array<
        null | string | { apiKeyLocation: string; apiKeyName: string }
      > = [];
      const opAuth = getAuthentication(program, op[1]);
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
      files[rootName].addLine(
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
        nestlevel + 1,
      );

      files[rootName].addLine(
        i < n.operations.size || numCollections > 0 ? "}," : "}",
        nestlevel,
      );
      i++;
    }

    let collectionNum = 1;
    const printCollection = (n: Namespace | Interface): void => {
      const doc = getDoc(program, n);
      if (doc)
        files[rootName].addLine(
          `/** ${doc} */`
            .split("\n")
            .map((l) => `${"  ".repeat(nestlevel)}${l}`)
            .join("\n"),
        );
      files[rootName].addLine(`${n.name}: {`, nestlevel);
      traverseNamespace(n, nestlevel + 1, rootName);
      files[rootName].addLine(
        collectionNum < numCollections ? "}," : "}",
        nestlevel,
      );
      collectionNum++;
    };

    (((n as any).interfaces ?? []) as Interface[]).forEach((i) => {
      if (!isTemplateDeclaration(i)) printCollection(i);
    });
    (((n as any).namespaces ?? []) as Namespace[]).forEach((ns) =>
      printCollection(ns),
    );
    if (n.name === rootName && nestlevel === 1)
      files[rootName].addLine("} as const;");
  };
  navigateProgram(program, {
    namespace(n) {
      const nsIndex = options["root-namespaces"].findIndex(
        (ns) => n.name === ns,
      );
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete options["root-namespaces"][nsIndex];

      traverseNamespace(n, 1, n.name);
    },
  });

  // emitting
  for (const file of Object.entries(files)) {
    await emitFile(program, {
      path: resolvePath(options["out-dir"], `routes_${file[0]}.ts`),
      content: file[1].value,
    });
  }

  // restore un-mutated version
  options["root-namespaces"] = targetedNamespaces;
};
