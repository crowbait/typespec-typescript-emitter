import { Tuple } from "@typespec/compiler";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

export class ResolvableTuple extends Resolvable<Tuple> {
  protected expectedTypeKind = "Tuple";

  public override async hasVisibility(
    opts: ResolverOptions<Resolver>,
    out: ResolverResult<Resolver>,
  ): Promise<boolean> {
    if (await super.hasVisibility(opts, out)) return true;
    for (const v of this._t.values) {
      if (await Resolvable.hasVisibility(v, opts, out, this._t)) return true;
    }
    return false;
  }

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    const results: string[] = [];
    for (const v of this._t.values) {
      const resolved = await this.resolveNested(v, opts, out);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
    }
    out.resolved.append(`[${results.join(", ")}]`);
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    const results: string[] = [];
    const oldAccessor = opts.accessor;
    let i = 0;
    for (const v of this._t.values) {
      opts.accessor = `${opts.accessor}[${i}]`;
      const resolved = await this.resolveNested(v, opts, out);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
      i++;
    }
    opts.accessor = oldAccessor;
    out.resolved.append(
      `Array.isArray(${opts.accessor} && ${results.map((g) => `(${g})`).join(" && ")})`,
    );
  }
}
