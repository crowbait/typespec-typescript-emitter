import { getDoc, Model, ModelProperty, Program } from "@typespec/compiler";
import { isVisible, Visibility } from "@typespec/http";
import { AppendableString } from "../../helpers/appendableString.js";
import { compareArrays } from "../../helpers/arrays.js";
import { namespaceListFromNamespace } from "../../helpers/namespaces.js";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

type VisibilityType = "Read" | "Create" | "Update" | "Delete" | "Query";

export class ShapedModel extends Resolvable<Model> {
  protected expectedTypeKind: string = "Model";

  private getProps(): ModelProperty[] {
    return Array.from(this._t.properties).map((p) => p[1]);
  }

  private getPropVisibilityType(
    program: Program,
    prop: ModelProperty,
  ): VisibilityType[] | null {
    if (
      !prop.decorators.some(
        (decorator) => decorator.definition?.name === "@visibility",
      )
    )
      return null;
    const ret: VisibilityType[] = [];
    if (isVisible(program, prop, Visibility.Read)) ret.push("Read");
    if (isVisible(program, prop, Visibility.Create)) ret.push("Create");
    if (isVisible(program, prop, Visibility.Update)) ret.push("Update");
    if (isVisible(program, prop, Visibility.Delete)) ret.push("Delete");
    if (isVisible(program, prop, Visibility.Query)) ret.push("Query");
    return ret;
  }

  /**
   * Checks whether or not any of the model's properties has @visibility modifier.
   * Also returns true if any base model (in the entire chain) has a visibility OR if
   * any nested type (in the model's properties) has a visibility.
   */
  public override async hasVisibility(
    opts: ResolverOptions<Resolver>,
    out: ResolverResult<Resolver>,
  ): Promise<boolean> {
    if (await super.hasVisibility(opts, out)) return true;
    // resolve base
    if (
      this._t.baseModel &&
      (await Resolvable.hasVisibility(this._t.baseModel, opts, out, this._t))
    )
      return true;
    // resolve props: check for decorators
    const props = this.getProps();
    if (
      props.some((prop) =>
        prop.decorators.some(
          (decorator) => decorator.definition?.name === "@visibility",
        ),
      )
    )
      return true;
    // resolve props: check if any resolves to visibility
    for (const prop of props) {
      // check if this prop is somewhere up the resolution chain -> recursion -> skip (defaults to false)
      const propNamespaces = namespaceListFromNamespace(
        (prop.type as any).namespace,
      );
      if (
        opts.parents &&
        opts.parents.some((parent) => {
          const parentNamespaces = namespaceListFromNamespace(
            (parent as any).namespace,
          );
          return (
            parent.kind === prop.type.kind &&
            (prop.type as any).name &&
            (parent as any).name === (prop.type as any).name &&
            propNamespaces &&
            parentNamespaces &&
            compareArrays(propNamespaces, parentNamespaces)
          );
        })
      )
        continue;
      // not recursion, resolve
      if (await Resolvable.hasVisibility(prop.type, opts, out, this._t))
        return true;
    }
    // nothing true
    return false;
  }

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    if (opts.emitDocs) {
      out.doc = getDoc(opts.program, this._t);
    }
    const resolution = new AppendableString();
    // check for base model (extended)
    if (this._t.baseModel) {
      const resolvedBase = await this.resolveNested(
        this._t.baseModel,
        opts,
        out,
      );
      out.imports.push(...resolvedBase.imports);
      resolution.append(`${resolvedBase.resolved} & `);
    }

    const props = this.getProps();

    const propVisibilityTypes: Record<
      string,
      { type: VisibilityType[] | null; nested: string }
    > = {};

    if (props.length === 0) {
      out.resolved.append("{}");
    } else {
      resolution.append("{\n");
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        // add doc strings
        if (opts.emitDocs) {
          const doc = getDoc(opts.program, prop);
          if (doc) resolution.addLine(`/** ${doc} */`, opts.nestlevel + 1);
        }
        // resolve prop
        const resolved = await this.resolveNested(prop.type, opts, out);
        resolution.addLine(
          `${prop.name}${prop.optional ? "?" : ""}: ${resolved.resolved}${i + 1 < this._t.properties.size ? "," : ""}`,
          opts.nestlevel + 1,
        );
        out.imports.push(...resolved.imports);
        // if prop has visibility, save to vismap
        const propVis = this.getPropVisibilityType(opts.program, prop);
        if (propVis !== null || resolved.hasVisibility) {
          propVisibilityTypes[prop.name] = { type: null, nested: "" };
          propVisibilityTypes[prop.name].type = propVis;
          propVisibilityTypes[prop.name].nested = resolved.visibilityMap;
        }
      }

      // build prop visibility map
      const visMap = new AppendableString();
      const propVisibilityTypesArr = Object.entries(propVisibilityTypes).filter(
        (p) => p[1].type !== null || p[1].nested,
      );
      if (propVisibilityTypesArr.length > 0) {
        visMap.addLine("{");
        let i = 1;
        for (const [prop, propvis] of propVisibilityTypesArr) {
          const visLine = `vis: [${(propvis.type ?? []).map((t) => `Lifecycle.${t}`).join(", ")}]`;
          if (propvis.type !== null && !propvis.nested) {
            visMap.addLine(
              `'${prop}': {${visLine}}`,
              opts.nestlevel + 1,
              "continued",
            );
          }
          if (propvis.nested) {
            visMap.addLine(`'${prop}': {`, opts.nestlevel + 1);
            if (propvis.type) visMap.addLine(`${visLine},`, opts.nestlevel + 2);
            visMap.addLine(
              `nested: ${propvis.nested
                .split("\n")
                .map((l) => `  ${l}`)
                .join("\n")
                .trim()}`,
              opts.nestlevel + 2,
            );
            visMap.addLine("}", opts.nestlevel + 1, "continued");
          }
          visMap.addLine(i < propVisibilityTypesArr.length ? "," : "");
          i++;
        }
        visMap.addLine("}", opts.nestlevel, "continued");
      }

      resolution.addLine("}", opts.nestlevel, "continued");

      out.visibilityMap = visMap.value;

      if (
        opts.parents &&
        opts.parents.every(
          (p) =>
            p.kind !== "Model" || p.name === "Array" || p.name === "Record",
        ) &&
        visMap.value
      ) {
        // this model is nested in something that's not a model and has visibility; inline filters
        out.resolved.append(`FilterLifecycle<${resolution}, ${visMap}, V>`);
        // this model is the root type or nested in a model; do not inline visibility filter
      } else {
        out.resolved.append(resolution);
      }
    }
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    out.resolved.append("\n");

    if (this._t.baseModel) {
      const resolvedBase = await this.resolveNested(
        this._t.baseModel,
        opts,
        out,
      );
      out.resolved.append(
        `${"  ".repeat(opts.nestlevel)}${resolvedBase.resolved} &&`,
      );
      out.imports.push(...resolvedBase.imports);
      // derived type does not have extended properties; fix by casting
      opts.accessor = `(${opts.accessor} as any)`;
    }

    const props = this.getProps();
    const propGuards: string[] = [];
    for (const prop of props) {
      const oldAccessor = opts.accessor;
      opts.accessor = `${opts.accessor}['${prop.name}']`;
      const resolved = await this.resolveNested(prop.type, opts, out);
      opts.accessor = oldAccessor;
      out.imports.push(...resolved.imports);

      const visibility = this.getPropVisibilityType(opts.program, prop);

      let guard = " ".repeat(
        out.resolved.value.endsWith("&") ? 1 : opts.nestlevel * 2,
      );
      if (visibility !== null) {
        guard += `((vis as any) === Lifecycle.All || ([${(visibility ?? []).map((t) => `Lifecycle.${t}`).join(", ")}].includes(vis) && (`;
      }
      guard += prop.optional
        ? `${opts.accessor}['${prop.name}'] === undefined || `
        : `${opts.accessor}['${prop.name}'] !== undefined && `;
      guard += `(${resolved.resolved}`;
      guard += resolved.resolved.value.endsWith("\n")
        ? "  ".repeat(opts.nestlevel)
        : "";
      guard += ")";
      if (visibility !== null) guard += ")))";
      propGuards.push(guard);
    }
    out.resolved.append(propGuards.join(" &&\n"));
    out.resolved.addLine("", opts.nestlevel);
  }

  protected transformKnownType(
    opts: ResolverOptions<Resolver>,
    out: ResolverResult<Resolver>,
  ): void {
    // If this is a known type, it can't be the root of this resolution tree,
    // because of the "originalTypeReady" flag.
    // If it also has visibility, it must have its own visibility map,
    // which is baked into the type definition, so it shouldn't be returned now.

    if (this._r === Resolver.Type && out.hasVisibility) {
      out.visibilityMap = "";
      const newResolved = `${out.resolved}<V>`;
      out.resolved.clear().append(newResolved);
      // ret.visibilityMap = `${(t as any).name}_VisMap`;
    }
  }
}
