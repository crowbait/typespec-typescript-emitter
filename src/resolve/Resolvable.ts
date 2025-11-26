import {Model, Type} from '@typespec/compiler';
import {AppendableString} from '../helpers/appendableString.js';
import {compareArrays} from '../helpers/arrays.js';
import {TTypeMap} from '../helpers/buildTypeMap.js';
import {reportDiagnostic} from '../helpers/diagnostics.js';
import {namespaceListFromNamespace} from '../helpers/namespaces.js';
import {Resolver, ResolverOptions, ResolverResult} from './Resolvable_helpers.js';

export abstract class Resolvable<T extends Type> {
  /** Recursively resolves a type. */
  static async resolve<R extends Resolver>(
    r: R,
    t: Type,
    opts: ResolverOptions<R>
  ): Promise<ResolverResult<R>> {
    const ret: ResolverResult<R> = {
      resolved: new AppendableString(),
      visibilityMap: "",
      hasVisibility: false,
      imports: []
    }
    await (await Resolvable.for(r, t)).resolve(opts, ret);
    return ret;
  }

  /** 
   * To be called from within the resolution logic of a type:
   * Resolves another type for the current type, handling required changes to the resolution options.
   * The passed `out` object is not signifiantly changed, only the `hasVisibility` flag is managed.
   */
  protected async resolveNested<R extends typeof this._r>(
    t: Type,
    opts: ResolverOptions<R>,
    out: ResolverResult<R>,
    nest: boolean = true
  ): Promise<ResolverResult<R>> {
    // prepare nested resolution
    if (nest) opts.nestlevel++;
    if (!opts.parents) opts.parents = [];
    opts.parents.push(this._t);

    const ret = await Resolvable.resolve(this._r, t, opts);

    // revert to current level
    if (nest) opts.nestlevel--;
    opts.parents.pop();
    
    return ret;
  }

  /** Creates the appropriate Resolvable instance for a given type. */
  static async for<T extends Type>(r: Resolver, t: T): Promise<Resolvable<T>> {
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
        const {IndexedModel} = await import("./types/Model.Indexed.js");
        const {ShapedModel} = await import("./types/Model.Shaped.js");
        switch ((t as Model).name) {
          case "Array":
          case "Record":
            return new IndexedModel(t, r) as any;

          default:
            return new ShapedModel(t, r) as any;
        }
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

  /** Resolves the type, modifying an output object in place. */
  public async resolve(opts: ResolverOptions<Resolver>, out: ResolverResult<Resolver>): Promise<void> {
    this.validate();

    if (await this.hasVisibility(opts, out)) out.hasVisibility = true;
    
    // check for known resolved type
    if (opts.rootTypeReady && (this._t as any).name) { // type without name can't be resolved
      const currentNamespaces = namespaceListFromNamespace((this._t as any).namespace);
      // find known resolved type
      const foundKnownResolved = ((): TTypeMap[number] | null => {
        const currentNamespaces = namespaceListFromNamespace((this._t as any).namespace);
        if (currentNamespaces && currentNamespaces.length > 0) {
          const found = opts.typemap.find(mt => 
            mt.type.kind === this._t.kind &&
            mt.type.name === (this._t as any).name &&
            compareArrays(mt.namespaces, currentNamespaces)
          );
          return found ?? null;
        }
        return null;
      })();

      // if found, return name instead of full resolution
      if (foundKnownResolved) {
        if (opts.rootType && compareArrays(currentNamespaces!, opts.rootType.namespaces)) {
          // if namespace of found is same as current (= same file), just return name
          out.resolved.append(this._r === Resolver.Type 
            ? foundKnownResolved.type.name
            : this._t.kind === "Enum"
              ? "true" // enums don't have typeguards
              : `is${foundKnownResolved.type.name}(${(opts as ResolverOptions<Resolver.Typeguard>).accessor})`
          );
        } else {
          // found is in different file than current, prepare importing
          out.resolved.append(`${foundKnownResolved.namespaces.join("_")}.${
            this._r === Resolver.Type
              ? foundKnownResolved.type.name
              : this._t.kind === "Enum"
                ? "true" // enums don't have typeguards
                : `is${foundKnownResolved.type.name}(${(opts as ResolverOptions<Resolver.Typeguard>).accessor}, vis)`
            }`
          );
          out.imports.push(foundKnownResolved.namespaces);
        }

        // optionally allow found type to modify output
        if (this.transformKnownType !== undefined) this.transformKnownType(opts, out);
        return;
      }
    }

    // this prevents the root type from triggering known resolution
    opts.rootTypeReady = true;

    switch (this._r) {
      case Resolver.Type: return await this.type(opts as ResolverOptions<Resolver.Type>, out as ResolverResult<Resolver.Type>);
      case Resolver.Typeguard: return await this.typeguard(opts as ResolverOptions<Resolver.Typeguard>, out as ResolverResult<Resolver.Typeguard>);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected transformKnownType(opts: ResolverOptions<Resolver>, out: ResolverResult<Resolver>): void {}
  
  /** Returns true if this type or anything it contains or references has visibility modifiers. */
  public async hasVisibility(opts: ResolverOptions<Resolver>, out: ResolverResult<Resolver>): Promise<boolean> { return out.hasVisibility }
  /** Returns true if this type or anything it contains or references has visibility modifiers. */
  protected static async hasVisibility(t: Type, opts: ResolverOptions<Resolver>, out: ResolverResult<Resolver>, current: Type): Promise<boolean> {
    if (!opts.parents) opts.parents = [];
    opts.parents.push(current);
    const ret = await (await Resolvable.for(Resolver.Type /** doesn't matter */, t)).hasVisibility(opts, out);
    opts.parents.pop();
    return ret;
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