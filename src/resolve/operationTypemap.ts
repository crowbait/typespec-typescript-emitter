import { Operation, Program, Type } from "@typespec/compiler";
import { getHttpOperation } from "@typespec/http";
import { TTypeMap } from "../helpers/buildTypeMap.js";
import { EmitterOptions } from "../lib.js";
import { Resolvable } from "./Resolvable.js";
import { Resolver } from "./Resolvable_helpers.js";

/** Maps a route path to its typemap definition and required imports */
export type TOperationTypemap = {
  // "string" in these does not refer to the type "string"; it's the typescript code *as* string.
  request: string;
  response: Array<{ status: number | "unknown"; body: string }>;
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
      request: "null",
      response: [],
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
    ret.types.request = resolved.resolved.value;
  }

  // response
  if (op.returnType) {
    const getReturnType = async (
      t: Type,
    ): Promise<{ status: number | "unknown"; body: string }[]> => {
      const responseRet: TOperationTypemap["response"] = [];

      switch (t.kind) {
        case "Model": {
          // If the return type is a model, it may either be a "blank" body or a fully
          // qualified response with status and body.
          const modelret: TOperationTypemap["response"][number] = {
            status: 200,
            body: "{}",
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
                ret.imports.push(...resolved.imports);
                modelret.body = resolved.resolved.value;
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
            ret.imports.push(...resolved.imports);
            modelret.body = resolved.resolved.value;
          }

          responseRet.push(modelret);

          break;
        }

        case "Union": {
          // if return type is a union, each variant may be fully qualified or body-only
          for (const variant of t.variants) {
            responseRet.push(...(await getReturnType(variant[1].type)));
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
          responseRet.push({
            status: 200,
            body: resolved.resolved.value,
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
