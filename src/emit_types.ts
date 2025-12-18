import { emitFile, Program, resolvePath, Type } from "@typespec/compiler";
import { AppendableString } from "./helpers/appendableString.js";
import { unique2D } from "./helpers/arrays.js";
import autogenerateWarning from "./helpers/autogenerateWarning.js";
import { TTypeMap } from "./helpers/buildTypeMap.js";
import { getImports } from "./helpers/getImports.js";
import { filenameFromNamespaces } from "./helpers/namespaces.js";
import { visibilityHelperFileName } from "./helpers/visibilityHelperFile.js";
import { EmitterOptions } from "./lib.js";
import { Resolvable } from "./resolve/Resolvable.js";
import { Resolver } from "./resolve/Resolvable_helpers.js";

export const emitTypes = async (
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
): Promise<void> => {
  // maps file names to file contents
  const files: Record<string, AppendableString> = {};
  // maps file names to list of required imports
  const imports: Record<
    string,
    {
      namespaces: TTypeMap[number]["namespaces"][];
      lifecycleTypes: string[];
    }
  > = {};

  // generate files
  typemap.forEach((t) => {
    files[filenameFromNamespaces(t.namespaces)] = new AppendableString();
    imports[filenameFromNamespaces(t.namespaces)] = {
      namespaces: [],
      lifecycleTypes: [],
    };
  });

  const typeOrder: Type["kind"][] = ["Enum", "Scalar", "Model", "Union"];
  typemap.sort(
    (a, b) => typeOrder.indexOf(a.type.kind) - typeOrder.indexOf(b.type.kind),
  );

  // resolve all types
  for (let i = 0; i < typemap.length; i++) {
    const t = typemap[i];
    const filename = filenameFromNamespaces(t.namespaces);
    const resolved = await Resolvable.resolve(Resolver.Type, t.type, {
      program,
      options,
      emitDocs: true,
      nestlevel: 0,
      rootType: t,
      typemap: typemap,
      ancestryPath: [...t.namespaces, t.type.name],
    });

    imports[filename].namespaces.push(...resolved.imports);
    let declaration = "export ";
    switch (t.type.kind) {
      case "Enum":
        declaration += `enum ${t.type.name}`;
        break;
      case "Scalar":
        declaration += `type ${t.type.name} =`;
        break;
      case "Model":
        declaration += `type ${t.type.name}${resolved.hasVisibility ? "<V extends Lifecycle = Lifecycle.All>" : ""} =`;
        // Making ALL types generic (regardless of whether they need it) improves ease-of-use,
        // both for the user as well for the dev when accessing known types.
        // declaration += `type ${t.type.name}${resolved.hasVisibility ? "<V extends Lifecycle = Lifecycle.All>" : ""} =`;
        break;
      case "Union":
        declaration += `type ${t.type.name}${resolved.hasVisibility ? "<V extends Lifecycle = Lifecycle.All>" : ""} =`;
        // declaration += `type ${t.type.name}${resolved.hasVisibility ? "<V extends Lifecycle = Lifecycle.All>" : ""} =`;
        break;
    }
    if (resolved.doc) files[filename].addLine(`/** ${resolved.doc} */`);

    if (resolved.hasVisibility) {
      imports[filename].lifecycleTypes.push("FilterLifecycle", "Lifecycle");
    }
    if (
      (t.type as any).kind === "Model" &&
      t.type.name !== "Array" &&
      t.type.name !== "Record" &&
      resolved.visibilityMap.replaceAll("{", "").replaceAll("}", "").trim()
    ) {
      files[filename].addLine(`${declaration} ${resolved.resolved.value}`);
      // files[filename].addLine(
      //   `${declaration} FilterLifecycle<${resolved.resolved.value}, typeof ${t.type.name}_VisMap, V>`,
      // );
      // files[filename].addLine(
      //   `export const ${t.type.name}_VisMap = ${resolved.visibilityMap} as const`,
      // );
    } else {
      files[filename].addLine(`${declaration} ${resolved.resolved.value}`);
    }

    if (options["enable-typeguards"]) {
      const typeguard = await Resolvable.resolve(Resolver.Typeguard, t.type, {
        program,
        options,
        nestlevel: 1,
        rootType: t,
        typemap: typemap,
        accessor: "t",
        ancestryPath: [...t.namespaces, t.type.name],
      });
      if (typeguard.resolved.value) {
        if (typeguard.hasVisibility) {
          imports[filename].lifecycleTypes.push("Lifecycle");
          files[filename].addLine(
            `export function is${t.type.name}(t: any, vis: Lifecycle = Lifecycle.All): t is ${t.type.name}<typeof vis> {return (${typeguard.resolved})}`,
          );
        } else {
          files[filename].addLine(
            `export function is${t.type.name}(t: any): t is ${t.type.name} {return (${typeguard.resolved})}`,
          );
        }
        imports[filename].namespaces.push(...typeguard.imports);
      }
    }

    files[filename].append("\n");
  }

  const filesArr = Object.entries(files).filter((f) => !!f[1].value);
  for (let i = 0; i < filesArr.length; i++) {
    if (!filesArr[i][1].value) continue;
    const filename = filesArr[i][0];

    imports[filename].namespaces = unique2D(imports[filename].namespaces);
    const importStrings = getImports(
      imports[filename].namespaces.filter(
        (i) => filenameFromNamespaces(i) !== filename,
      ),
    );
    if (imports[filename].lifecycleTypes.length > 0) {
      importStrings.push(
        `import {${[...new Set(imports[filename].lifecycleTypes)].join(", ")}} from './${visibilityHelperFileName}';`,
      ); // unique-ify
    }

    const content = `/* eslint-disable */\n\n${autogenerateWarning}${importStrings.join("\n")}${importStrings.length > 0 ? "\n\n" : ""}${filesArr[i][1].value}`;
    await emitFile(program, {
      path: resolvePath(options["out-dir"], filename),
      content: content,
    });
  }
};
