import { getDoc, Union } from "@typespec/compiler";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

export class ResolvableUnion extends Resolvable<Union> {
  protected expectedTypeKind = "Union";

  public override async hasVisibility(
    opts: ResolverOptions<Resolver>,
    out: ResolverResult<Resolver>,
  ): Promise<boolean> {
    if (await super.hasVisibility(opts, out)) return true;
    for (const v of Array.from(this._t.variants)) {
      if (await Resolvable.hasVisibility(v[1].type, opts, out, this._t))
        return true;
    }
    return false;
  }

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    if (opts.emitDocs) {
      out.doc = getDoc(opts.program, this._t);
    }
    const results: string[] = [];
    for (const v of Array.from(this._t.variants)) {
      const resolved = await this.resolveNested(v[1].type, opts, out, false);
      out.imports.push(...resolved.imports);
      results.push(resolved.resolved.value);
    }
    out.resolved.append(results.join(" | "));
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    const results: string[] = [];
    for (const v of Array.from(this._t.variants)) {
      const resolved = await this.resolveNested(v[1].type, opts, out);
      out.imports.push(...resolved.imports);
      results.push(`(${resolved.resolved.value})`);
    }
    out.resolved.append(results.join(" || "));
  }
}
