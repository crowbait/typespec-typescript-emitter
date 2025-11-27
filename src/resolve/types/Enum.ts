import { Enum, EnumMember, getDoc } from "@typespec/compiler";
import { compareArrays } from "../../helpers/arrays.js";
import { namespaceListFromNamespace } from "../../helpers/namespaces.js";
import { Resolvable } from "../Resolvable.js";
import {
  Resolver,
  ResolverOptions,
  ResolverResult,
} from "../Resolvable_helpers.js";

/**
 * This resolves Enums completely, meaning it doesn't try to resolve
 * members as EnumMember, because EnumMember resolution references the base Enum.
 */
export class ResolvableEnum extends Resolvable<Enum> {
  protected expectedTypeKind = "Enum";

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    if (opts.emitDocs) {
      out.doc = getDoc(opts.program, this._t);
    }
    out.resolved.append("{\n");
    let i = 1;
    this._t.members.forEach((member) => {
      const val = resolveEnumMemberValue(member, opts);
      out.resolved.addLine(
        `${member.name.includes("-") ? `'${member.name}'` : member.name}${val}${i < this._t.members.size ? "," : ""}`,
        opts.nestlevel + 1,
      );
      i++;
    });
    out.resolved.addLine("}", opts.nestlevel, "continued");
  }

  protected async typeguard(): Promise<void> {
    // enums cannot have typeguards
    return;
  }
}

/**
 * This cannot resolve members during Enum resolution, because this
 * will try to reference the base Enum by name.
 */
export class ResolvableEnumMember extends Resolvable<EnumMember> {
  protected expectedTypeKind = "EnumMember";

  protected async type(
    opts: ResolverOptions<Resolver.Type>,
    out: ResolverResult<Resolver.Type>,
  ): Promise<void> {
    const foundParent = opts.typemap.find(
      (mt) =>
        mt.type.kind === "Enum" &&
        mt.type.name === this._t.enum.name &&
        compareArrays(
          mt.namespaces,
          namespaceListFromNamespace(this._t.enum.namespace) ?? [],
        ),
    );
    if (foundParent) {
      out.resolved.append(`${foundParent.type.name}.${this._t.name}`);
      out.imports.push(foundParent.namespaces);
    } else {
      out.resolved.append(resolveEnumMemberValue(this._t, opts));
    }
  }

  protected async typeguard(
    opts: ResolverOptions<Resolver.Typeguard>,
    out: ResolverResult<Resolver.Typeguard>,
  ): Promise<void> {
    out.resolved.append("true");
  }
}

const resolveEnumMemberValue = (
  member: EnumMember,
  opts: ResolverOptions<any>,
): string => {
  return member.value === undefined
    ? opts.options["string-nominal-enums"]
      ? ` = '${member.name}'`
      : ""
    : " = " +
        (typeof member.value === "string"
          ? `'${member.value}'`
          : opts.options["string-nominal-enums"]
            ? `'${member.name}'`
            : member.value.toString());
};
