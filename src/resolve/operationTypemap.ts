import { Operation, Program, Type } from "@typespec/compiler";
import { getHttpOperation } from "@typespec/http";
import { TTypeMap } from "../helpers/buildTypeMap.js";
import { EmitterOptions } from "../lib.js";
import { Resolvable } from "./Resolvable.js";
import { Resolver } from "./Resolvable_helpers.js";

/** Maps a route path to its typemap definition and required imports */
export type TOperationTypemap = {
  // "string" in these does not refer to the type "string"; it's the typescript code *as* string.
  request: { content: string; hasVisibility: boolean };
  response: {
    content: Array<{
      status: number | "unknown";
      body: string;
      hasVisibility: boolean;
    }>;
  };
};

export const resolveOperationTypemap = async (
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  op: Operation,
): Promise<{
  types: TOperationTypemap;
  imports: TTypeMap[number]["namespaces"][];
}> => {
  const httpOp = getHttpOperation(program, op)[0];
  const ret: Awaited<ReturnType<typeof resolveOperationTypemap>> = {
    types: {
      request: { content: "null", hasVisibility: false },
      response: { content: [] },
    },
    imports: [],
  };

  // request
  if (httpOp.parameters.body) {
    const resolved = await Resolvable.resolve(
      Resolver.Type,
      httpOp.parameters.body.type,
      {
        program,
        options,
        emitDocs: false,
        nestlevel: 3,
        rootType: null,
        typemap,
        rootTypeReady: true,
      },
    );
    ret.imports.push(...resolved.imports);
    ret.types.request.content = replaceLifecycle(
      resolved.resolved.value,
      httpOp.verb.toUpperCase(),
      resolved.hasVisibility,
    );
    if (resolved.hasVisibility) ret.types.request.hasVisibility = true;
  }

  // response
  if (op.returnType) {
    const getReturnType = async (
      t: Type,
    ): Promise<{
      content: {
        status: number | "unknown";
        body: string;
        hasVisibility: boolean;
      }[];
    }> => {
      const responseRet: TOperationTypemap["response"] = { content: [] };

      switch (t.kind) {
        case "Model": {
          // If the return type is a model, it may either be a "blank" body or a fully
          // qualified response with status and body.
          const modelret: TOperationTypemap["response"]["content"][number] = {
            status: 200,
            body: "{}",
            hasVisibility: false,
          };

          // check for fully qualified response or plain body
          let wasFullyQualified = false;
          for (const prop of t.properties) {
            for (const decorator of prop[1].decorators) {
              // find status code
              if (
                decorator.definition?.name === "@statusCode" &&
                prop[1].type.kind === "Number"
              )
                modelret.status = prop[1].type.value;
              // find body definiton
              if (decorator.definition?.name === "@body") {
                const resolved = await Resolvable.resolve(
                  Resolver.Type,
                  prop[1].type,
                  {
                    program,
                    options,
                    emitDocs: false,
                    nestlevel: 3,
                    rootType: null,
                    typemap,
                    rootTypeReady: true,
                  },
                );
                if (resolved.hasVisibility) modelret.hasVisibility = true;
                ret.imports.push(...resolved.imports);
                modelret.body = replaceLifecycle(
                  resolved.resolved.value,
                  "RETURN",
                  resolved.hasVisibility,
                );
                wasFullyQualified = true;
              }
            }
          }

          if (!wasFullyQualified) {
            const resolved = await Resolvable.resolve(Resolver.Type, t, {
              program,
              options,
              emitDocs: false,
              nestlevel: 3,
              rootType: null,
              typemap,
              rootTypeReady: true,
            });
            if (resolved.hasVisibility) modelret.hasVisibility = true;
            ret.imports.push(...resolved.imports);
            modelret.body = replaceLifecycle(
              resolved.resolved.value,
              "RETURN",
              resolved.hasVisibility,
            );
          }

          responseRet.content.push(modelret);

          break;
        }

        case "Union": {
          // if return type is a union, each variant may be fully qualified or body-only
          for (const variant of t.variants) {
            const resolved = await getReturnType(variant[1].type);
            responseRet.content.push(...resolved.content);
          }
          break;
        }

        default: {
          // return type does not have a qualified body; making one up and resolving that one
          const resolved = await Resolvable.resolve(Resolver.Type, t, {
            program,
            options,
            emitDocs: false,
            nestlevel: 3,
            rootType: null,
            typemap,
            rootTypeReady: true,
          });
          ret.imports.push(...resolved.imports);
          responseRet.content.push({
            status: 200,
            body: replaceLifecycle(
              resolved.resolved.value,
              httpOp.verb.toUpperCase(),
              resolved.hasVisibility,
            ),
            hasVisibility: resolved.hasVisibility,
          });
          break;
        }
      }

      return responseRet;
    };
    ret.types.response = await getReturnType(op.returnType);
  }

  return ret;
};

/** Maps HTTP verbs to lifecycle states. See @typespec/compiler/.../visibility.tsp */
const VerbToLifecycle = {
  RETURN: ["Read"], // for all return types
  POST: ["Create"],
  PUT: ["Create", "Update"],
  PATCH: ["Update"],
  DELETE: ["Delete"],
  GET: ["Query"], // *parameters* of request, return type is still RETURN
  Head: ["Query"],
};

// lifecycle assignment helper
const replaceLifecycle = (
  resolved: string,
  verb: string,
  hasVisibility: boolean,
): string => {
  const opLifecycle = VerbToLifecycle[verb as keyof typeof VerbToLifecycle];
  if (!hasVisibility) return resolved;
  return resolved.replaceAll(
    "V>",
    `V extends Lifecycle.All ? (${opLifecycle.map((l) => `Lifecycle.${l}`).join(" | ")}) : V>`,
  );
};
