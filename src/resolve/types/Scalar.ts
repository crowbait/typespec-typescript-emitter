import {Scalar} from '@typespec/compiler';
import {Resolvable} from '../Resolvable.js';
import {Resolver, ResolverOptions, ResolverResult, resolve} from '../resolve.js';

export class ResolvableScalar extends Resolvable<Scalar> {
  protected expectedTypeKind = "Scalar";
  private dateTypes = ["offsetDateTime", "plainDate", "utcDateTime", "unixTimestamp32"];

  protected async type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void> {
    if (this.dateTypes.includes(this._t.name)) {
      switch (this._t.name) {
        case "offsetDateTime":
        case "plainDate":
        case "utcDateTime":
          out.resolved.append(opts.context.options["serializable-date-types"] ? "string" : "Date")
          break;
        case "unixTimestamp32":
          out.resolved.append(opts.context.options["serializable-date-types"] ? "number" : "Date")
          break;
      }
    } else if (this._t.baseScalar) {
      out.resolved.append((await resolve(this._r, this._t.baseScalar, opts)).resolved.value);
    } else {
      switch (this._t.name) {
        case "boolean": out.resolved.append("boolean"); break;
        case "bytes": out.resolved.append("Uint8Array"); break;
        case "duration": out.resolved.append("number"); break;
        case "numeric": out.resolved.append("number"); break;
        case "plainTime": out.resolved.append("string"); break;
        case "string": out.resolved.append("string"); break;
        case "url": out.resolved.append("string"); break;
        
        default:
          this.diagnostic(
            "resolve-unresolved-scalar",
            `Could not resolve scalar ${this._t.name}`,
            "error"
          );
          out.resolved.append("unknown");
          break;
      }
    }
  }

  protected async typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void> {
    if (this.dateTypes.includes(this._t.name)) {
      switch (this._t.name) {
        case "offsetDateTime":
        case "plainDate":
        case "utcDateTime":
          out.resolved.append(
            opts.context.options["serializable-date-types"]
              ? `typeof ${opts.accessor} === 'string'`
              : `${opts.accessor} instanceof Date`
          );
          break;
        case "unixTimestamp32":
          out.resolved.append(
            opts.context.options["serializable-date-types"]
              ? `typeof ${opts.accessor} === 'number'`
              : `${opts.accessor} instanceof Date`
          );
          break;
      }
    } else if (this._t.baseScalar) {
      out.resolved.append((await resolve(this._r, this._t.baseScalar, opts)).resolved.value);
    } else if (this._t.name === "bytes") {
      out.resolved.append(`${opts.accessor} instanceof Uint8Array`);
    } else {
      out.resolved.append(`typeof ${opts.accessor} === '`)
      switch (this._t.name) {
        case "boolean": out.resolved.append("boolean"); break;
        case "duration": out.resolved.append("number"); break;
        case "numeric": out.resolved.append("number"); break;
        case "plainTime": out.resolved.append("string"); break;
        case "string": out.resolved.append("string"); break;
        case "url": out.resolved.append("string"); break;
        
        default:
          this.diagnostic(
            "resolve-unresolved-scalar",
            `Could not create typeguard for scalar ${this._t.name}`,
            "error"
          );
          out.resolved.append("unknown");
          break;
      }
      out.resolved.append("'");
    }
  }
}