import {EmitContext, Type} from '@typespec/compiler';
import {Visibility} from '@typespec/http';
import {AppendableString} from '../helpers/appendableString.js';
import {compareArrays} from '../helpers/arrays.js';
import {TTypeMap} from '../helpers/buildTypeMap.js';
import {namespaceListFromNamespace} from '../helpers/namespaces.js';
import {EmitterOptions} from '../lib.js';
import {Resolvable} from './Resolvable.js';

export enum Resolver {
  Type,
  Typeguard
}

export type ResolverOptions<R extends Resolver> = {
  context: EmitContext<EmitterOptions>,
  typemap: TTypeMap,
  nestlevel: number,
  /** Used to determine whether re-used resolution must import something. */
  originalType: TTypeMap[number] | null,
  /** 
   * This tracks whether or not resolving *to* the type currently being investigated
   * is valid. This allows for recursive types.
  */
  originalTypeReady?: boolean,
  /** If set, extended models will use `Base & {prop: type}` instead of `M extends Base`. */
  andInsteadOfExtend?: boolean
} & (R extends Resolver.Type ? {
  emitDocs: boolean,
  visibility?: Visibility
} : {
  /** 
   * This string describes how a function (part) of a typeguard can
   * access the value currently being tested by it.
   * Example: typeguard(t: any) on `n` for {n: string} -> this = "t"
   */
  accessor: string
});

export type ResolverResult<R extends Resolver> = {
  readonly resolved: AppendableString,
  readonly visibilityMap: AppendableString,
  imports: TTypeMap[number]["namespaces"][],
  doc?: R extends Resolver.Type ? string : never
};

export const resolve = async <
  R extends Resolver,
  Opt extends ResolverOptions<R>
>(resolver: R, t: Type, opts: Opt): Promise<ResolverResult<R>> => {
  const ret: ResolverResult<R> = {
    resolved: new AppendableString(),
    visibilityMap: new AppendableString(),
    imports: []
  }

  // check if this type may be a resolved one
  if (opts.originalTypeReady && (t as any).name) { // type without name can't be resolved
    const currentNamespaces = namespaceListFromNamespace((t as any).namespace);
    if (currentNamespaces && currentNamespaces.length > 0) {
      const found = opts.typemap.find(mt => 
        mt.type.kind === t.kind &&
        mt.type.name === (t as any).name &&
        compareArrays(mt.namespaces, currentNamespaces)
      );
      if (found) {
        if (opts.originalType && compareArrays(currentNamespaces, opts.originalType.namespaces)) {
          ret.resolved.append(resolver === Resolver.Type 
            ? found.type.name
            : `is${found.type.name}(${(opts as ResolverOptions<Resolver.Typeguard>).accessor})`
          );
        } else {
          ret.resolved.append(`${found.namespaces.join("_")}.${
            resolver === Resolver.Type
              ? found.type.name
              : `is${found.type.name}(t)`
            }`
          );
          ret.imports.push(found.namespaces);
        }
        return ret;
      }
    }
  }

  opts.originalTypeReady = true;

  await (await Resolvable.for(t, resolver)).resolve(opts, ret);
  
  return ret;
};