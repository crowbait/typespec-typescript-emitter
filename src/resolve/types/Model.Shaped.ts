import {EmitContext, getDoc, ModelProperty, Model as TSP_Model} from '@typespec/compiler';
import {isVisible, Visibility} from '@typespec/http';
import {EmitterOptions} from '../../lib.js';
import {Resolvable} from '../Resolvable.js';
import {resolve, Resolver, ResolverOptions, ResolverResult} from '../resolve.js';

export class ShapedModel extends Resolvable<TSP_Model> {
  protected expectedTypeKind: string = "Model";

  private getProps(context: EmitContext<EmitterOptions>, visibility?: Visibility): ModelProperty[] {
    let props = Array.from(this._t.properties).map(p => p[1]);
    if (visibility !== undefined) props = props.filter(p => isVisible(context.program, p, visibility));
    return props;
  }

  protected async type(opts: ResolverOptions<Resolver.Type>, out: ResolverResult<Resolver.Type>): Promise<void> {
    if (opts.emitDocs) { out.doc = getDoc(opts.context.program, this._t); }
    if (this._t.baseModel) {
      const resolvedBase = await resolve(this._r, this._t.baseModel, opts);
      out.imports.push(...resolvedBase.imports);
      if (opts.andInsteadOfExtend) {
        out.resolved.append(`${resolvedBase.resolved} & `);
      } else {
        out.resolved.append(`extends ${resolvedBase.resolved} `);
      }
    }
    const props = this.getProps(opts.context, opts.visibility);

    if (props.length === 0) {
      out.resolved.append("{}");
    } else {
      out.resolved.append("{\n");
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        // add doc strings
        if (opts.emitDocs) {
          const doc = getDoc(opts.context.program, prop);
          if (doc) out.resolved.addLine(`/** ${doc} */`, opts.nestlevel + 1);
        }
        opts.nestlevel++;
        const resolved = await resolve(this._r, prop.type, opts);
        opts.nestlevel--;
        out.resolved.addLine(
          `${prop.name}${prop.optional ? "?" : ""}: ${resolved.resolved}${(i + 1) < this._t.properties.size ? "," : ""}`,
          opts.nestlevel + 1
        );
        out.imports.push(...resolved.imports);
      };
      out.resolved.addLine("}", opts.nestlevel, "continued");
    }
  }

  protected async typeguard(opts: ResolverOptions<Resolver.Typeguard>, out: ResolverResult<Resolver.Typeguard>): Promise<void> {
    out.resolved.append("\n");
    
    if (this._t.baseModel) {
      const resolvedBase = await resolve(this._r, this._t.baseModel, opts);
      out.resolved.append(`${"  ".repeat(opts.nestlevel)}${resolvedBase.resolved} &&`);
      out.imports.push(...resolvedBase.imports);
      // derived type does not have extended properties; fix by casting
      opts.accessor = `(${opts.accessor} as any)`;
    }

    const props = this.getProps(opts.context);
    const propGuards: string[] = [];
    for (const prop of props) {
      const oldAccessor = opts.accessor;
      opts.accessor = `${opts.accessor}['${prop.name}']`;
      opts.nestlevel++;
      const resolved = await resolve(this._r, prop.type, opts);
      opts.nestlevel--;
      opts.accessor = oldAccessor;
      out.imports.push(...resolved.imports);

      let guard = " ".repeat(out.resolved.value.endsWith("&") ? 1 : opts.nestlevel * 2);
      guard += prop.optional
        ? `${opts.accessor}['${prop.name}'] === undefined || `
        : `${opts.accessor}['${prop.name}'] !== undefined && `;
      guard += `(${resolved.resolved}`;
      guard += resolved.resolved.value.endsWith("\n") ? "  ".repeat(opts.nestlevel) : "";
      guard += ")";
      propGuards.push(guard);
    }
    out.resolved.append(propGuards.join(" &&\n"));
    out.resolved.addLine("", opts.nestlevel);
  }
}