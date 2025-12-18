import { Program, Type } from "@typespec/compiler";
import { AppendableString } from "../helpers/appendableString.js";
import { compareArrays } from "../helpers/arrays.js";
import { TTypeMap } from "../helpers/buildTypeMap.js";
import { namespaceListFromNamespace } from "../helpers/namespaces.js";
import { EmitterOptions } from "../lib.js";

export enum Resolver {
  Type,
  Typeguard,
}

export type ResolverOptions<R extends Resolver> = {
  program: Program;
  options: EmitterOptions;
  typemap: TTypeMap;
  /** Used for indentation formatting */
  nestlevel: number;
  /** The type the entire resolution chain started with. */
  rootType: TTypeMap[number] | null;
  /**
   * This tracks whether or not resolving *to* the type currently being investigated
   * is valid. This allows for recursive types.
   */
  rootTypeReady?: boolean;
  /** The types "up the chain" - "parent" types on nested resolution. */
  parents?: Type[];
  /** The entire "name chain", from the root namespace to here - "things" without a name are `undefined`. */
  ancestryPath: (string | undefined)[];
} & (R extends Resolver.Type
  ? {
      emitDocs: boolean;
    }
  : {
      /**
       * This string describes how a function (part) of a typeguard can
       * access the value currently being tested by it.
       * Example: typeguard(t: any) on `n` for {n: string} -> this = "t"
       */
      accessor: string;
    });

/** Tries to find type in known types map */
export const getKnownResolvedType = (
  typemap: TTypeMap,
  t: any,
): TTypeMap[number] | null => {
  const currentNamespaces = namespaceListFromNamespace((t as any).namespace);
  if (currentNamespaces && currentNamespaces.length > 0) {
    const found = typemap.find(
      (mt) =>
        mt.type.kind === t.kind &&
        mt.type.name === (t as any).name &&
        compareArrays(mt.namespaces, currentNamespaces),
    );
    return found ?? null;
  }
  return null;
};

export type ResolverResult<R extends Resolver> = {
  readonly resolved: AppendableString;
  visibilityMap: string;
  imports: TTypeMap[number]["namespaces"][];
  /** Whether any resolved part (nested types and base types included) have @visibility modifiers */
  hasVisibility: boolean;
  doc?: R extends Resolver.Type ? string : never;
};
