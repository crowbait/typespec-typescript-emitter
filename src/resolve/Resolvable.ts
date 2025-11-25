import {Type} from '@typespec/compiler';
import {reportDiagnostic} from '../helpers/diagnostics.js';
import {Resolver, ResolverOptions, ResolverResult} from './resolve.js';

export abstract class Resolvable<T extends Type> {
  static async for<T extends Type>(t: T, r: Resolver): Promise<Resolvable<T>> {
    // use lazy imports to break circular dependencies
    const {ResolvableSimple} = await import("./types/Simple.js");
    if (ResolvableSimple.AllowedTypeKinds.includes(t.kind as any)) {
      return new ResolvableSimple(t, r) as any;
    }
    switch (t.kind) {
      case "Enum": {
        const {ResolvableEnum} = await import("./types/Enum.js");
        return new ResolvableEnum(t, r) as any;
      }
      case "EnumMember": {
        const {ResolvableEnumMember} = await import("./types/Enum.js");
        return new ResolvableEnumMember(t, r) as any;
      }
      case "Model": {
        const {ResolvableModel} = await import("./types/Model.js");
        return new ResolvableModel(t, r) as any;
      }
      case "Scalar": {
        const {ResolvableScalar} = await import("./types/Scalar.js");
        return new ResolvableScalar(t, r) as any;
      }
      case "Tuple": {
        const {ResolvableTuple} = await import("./types/Tuple.js");
        return new ResolvableTuple(t, r) as any;
      }
      case "Union": {
        const {ResolvableUnion} = await import("./types/Union.js");
        return new ResolvableUnion(t, r) as any;
      }
    
      default:
        reportDiagnostic({
          code: "resolve-unresolved",
          message: `Could not resolve type ${t.kind}`,
          severity: "error"
        });
        throw new TypeError(`Could not resolve type ${t.kind}`);
    }
  }

  constructor(t: T, r: Resolver) {
    this._t = t;
    this._r = r;
  }

  protected abstract expectedTypeKind: string;

  protected _t: T;
  protected _r: Resolver;

  /** Modifies passed output object in-place. */
  protected abstract type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void>;
  /** Modifies passed output object in-place. */
  protected abstract typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void>;

  public async resolve(opts: ResolverOptions<Resolver>, out: ResolverResult<Resolver>): Promise<void> {
    this.validate();
    switch (this._r) {
      case Resolver.Type: return await this.type(opts as ResolverOptions<Resolver.Type>, out as ResolverResult<Resolver.Type>);
      case Resolver.Typeguard: return await this.typeguard(opts as ResolverOptions<Resolver.Typeguard>, out as ResolverResult<Resolver.Typeguard>);
    }
  }

  /** Checks its stored type to ensure the instance was created on a suitable type. */
  protected validate(): void {
    if (this._t.kind !== this.expectedTypeKind) {
      this.diagnostic(
        "typeclass-mismatch",
        `Tried creating resolver for ${this.expectedTypeKind} on type ${this._t.kind}`,
        "error"
      );
      throw new TypeError(`Type-kind/class mismatch: instanced ${this.expectedTypeKind} on type ${this._t.kind}`);
    }
  };

  protected diagnostic(code: string, msg: string, level: "error" | "warning"): void {
    reportDiagnostic({
      code: `resolve-${this._r}-${code}`,
      message: msg,
      severity: level
    });
  }
}