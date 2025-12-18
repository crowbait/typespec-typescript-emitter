import { Model } from "@typespec/compiler";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

enum Type {
  Array,
  Record,
}

export class IndexedModel extends Resolvable<Model> {
  constructor(t: Model, r: Resolver) {
    super(t, r);
    if (t.name === "Array") {
      this._indexedModelKind = Type.Array;
    } else if (t.name === "Record") {
      this._indexedModelKind = Type.Record;
    } else
      throw new TypeError(
        `Cannot create IndexedModel on type of name ${t.name}`,
      );
  }

  private _indexedModelKind: Type;
  protected expectedTypeKind: string = "Model";

  public override async hasVisibility(
    opts: ResolverOptions<Resolver>,
    out: ResolverResult<Resolver>,
  ): Promise<boolean> {
    if (await super.hasVisibility(opts, out)) return true;
    if (
      await Resolvable.hasVisibility(this._t.indexer!.value, opts, out, this._t)
    )
      return true;
    return false;
  }

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    const resolved = await this.resolveNested(
      this._t.indexer!.value,
      opts,
      out,
      this._t.name,
      false,
    );
    switch (this._indexedModelKind) {
      case Type.Array:
        out.resolved.append(`(${resolved.resolved})[]`);
        break;
      case Type.Record:
        out.resolved.append(`{[k: string]: ${resolved.resolved}}`);
        break;
    }
    out.imports.push(...resolved.imports);
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    const oldAccessor = opts.accessor;
    opts.accessor = this._indexedModelKind === Type.Array ? "v" : "v[1]";
    const resolved = await this.resolveNested(
      this._t.indexer!.value,
      opts,
      out,
      this._t.name,
    );
    opts.accessor = oldAccessor;
    if (resolved.resolved.value.endsWith("\n")) resolved.resolved.dropLast();

    switch (this._indexedModelKind) {
      case Type.Array:
        out.resolved.append(
          `Array.isArray(${opts.accessor}) && ${opts.accessor}.every((v) => ${resolved.resolved})`,
        );
        break;
      case Type.Record:
        out.resolved.append(
          `typeof ${opts.accessor} === 'object' && Object.entries(${opts.accessor} as Record<string, any>).every((v) => ${resolved.resolved})`,
        );
        break;
    }
    out.imports.push(...resolved.imports);
  }

  protected validate(): void {
    if (this._t.name !== "Array" && this._t.name !== "Record") {
      this.diagnostic(
        "typeclass-modeltype-mismatch",
        "Tried creating IndexedModel for non-array and non-record model type",
        "error",
      );
      throw new Error(
        "Tried creating IndexedModel for non-array and non-record model type",
      );
    }
    if (!this._t.indexer) {
      this.diagnostic(
        "no-indexer",
        "Tried creating IndexedModel for type without indexer",
        "error",
      );
      throw new Error("Tried creating IndexedModel for type without indexer");
    }
    super.validate();
  }
}
