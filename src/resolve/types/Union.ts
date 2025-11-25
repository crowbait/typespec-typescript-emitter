import {getDoc, Union} from '@typespec/compiler';
import {Resolvable} from '../Resolvable.js';
import {resolve, Resolver, ResolverOptions, ResolverResult} from '../resolve.js';

export class ResolvableUnion extends Resolvable<Union> {
  protected expectedTypeKind = "Union";

  protected async type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void> {
    if (opts.emitDocs) { out.doc = getDoc(opts.context.program, this._t); }
    const results: string[] = [];
    for (const v of Array.from(this._t.variants)) {
      const resolved = await resolve(this._r, v[1].type, opts);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
    }
    out.resolved.append(results.join(" | "));
  }

  protected async typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void> {
    const results: string[] = [];
    for (const v of Array.from(this._t.variants)) {
      const resolved = await resolve(this._r, v[1].type, opts);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
    }
    out.resolved.append(results.join(" || "));
  }
}