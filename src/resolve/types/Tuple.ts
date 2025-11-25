import {Tuple} from '@typespec/compiler';
import {Resolvable} from '../Resolvable.js';
import {Resolver, ResolverOptions, ResolverResult, resolve} from '../resolve.js';

export class ResolvableTuple extends Resolvable<Tuple> {
  protected expectedTypeKind = "Tuple";

  protected async type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void> {
    const results: string[] = [];
    for (const v of this._t.values) {
      const resolved = await resolve(this._r, v, opts);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
    }
    out.resolved.append(results.join(", "))
  }

  protected async typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void> {
    const results: string[] = [];
    const oldAccessor = opts.accessor;
    let i = 0;
    for (const v of this._t.values) {
      opts.accessor = `${opts.accessor}[${i}]`;
      const resolved = await resolve(this._r, v, opts);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
      i++;
    }
    opts.accessor = oldAccessor;
    out.resolved.append(`Array.isArray(${opts.accessor} && ${results.map((g) => `(${g})`).join(" && ")}`);
  }
}