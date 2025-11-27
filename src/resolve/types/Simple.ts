import {
  IntrinsicType,
  NumericLiteral,
  StringLiteral,
  Type,
} from "@typespec/compiler";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

const allowedTypeKinds = [
  "Boolean",
  "Intrinsic",
  "Number",
  "String",
  "TemplateParameter",
] as const;

export class ResolvableSimple extends Resolvable<Type> {
  protected expectedTypeKind = ""; // placeholder as required; validate is overridden
  public static AllowedTypeKinds = allowedTypeKinds;

  private static typeMap: Record<
    (typeof allowedTypeKinds)[number],
    (t: Type) => string
  > = {
    Boolean: (t) => ((t as any).value ? "true" : "false"),
    Intrinsic: (t) => (t as IntrinsicType).name,
    Number: (t) => (t as NumericLiteral).valueAsString,
    String: (t) => `'${(t as StringLiteral).value}'`,
    TemplateParameter: () => "unknown",
  };

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    const mapped =
      ResolvableSimple.typeMap[
        this._t.kind as (typeof allowedTypeKinds)[number]
      ]; // check is in validate()
    out.resolved.append(mapped(this._t));
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    const mapped =
      ResolvableSimple.typeMap[
        this._t.kind as (typeof allowedTypeKinds)[number]
      ]; // check is in validate()
    const v = mapped(this._t);
    if (v === "unknown") {
      out.resolved.append(`true`);
    } else {
      out.resolved.append(`${opts.accessor} === ${v}`);
    }
  }

  protected validate(): void {
    if (!ResolvableSimple.AllowedTypeKinds.includes(this._t.kind as any)) {
      this.diagnostic(
        "typeclass-mismatch",
        `Tried resolving type ${this._t.kind} as primitive`,
        "error",
      );
      throw new TypeError(
        `Type-kind/class mismatch: tried resolving type ${this._t.kind} as primitive`,
      );
    }
  }
}
