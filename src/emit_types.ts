import {
  emitFile,
  Interface,
  isErrorModel,
  Model,
  Operation,
  Program,
  resolvePath,
  Type,
  Union,
} from "@typespec/compiler";
import { AppendableString } from "./helpers/appendableString.js";
import { unique2D } from "./helpers/arrays.js";
import autogenerateWarning from "./helpers/autogenerateWarning.js";
import { TInterfaceMap, TTypeMap } from "./helpers/buildTypeMap.js";
import { getImports } from "./helpers/getImports.js";
import { filenameFromNamespaces } from "./helpers/namespaces.js";
import { visibilityHelperFileName } from "./helpers/visibilityHelperFile.js";
import { isAsyncOp } from "./decorators.js";
import { EmitterOptions } from "./lib.js";
import { Resolvable } from "./resolve/Resolvable.js";
import { Resolver } from "./resolve/Resolvable_helpers.js";

/**
 * Analyzes a return type and separates success types from error types.
 * @error-decorated models are considered error types.
 */
function analyzeReturnType(
  program: Program,
  returnType: Type,
): { successTypes: Type[]; errorTypes: Model[] } {
  const successTypes: Type[] = [];
  const errorTypes: Model[] = [];

  if (returnType.kind === "Union") {
    const union = returnType as Union;
    for (const [, variant] of union.variants) {
      const variantType = variant.type;
      if (variantType.kind === "Model" && isErrorModel(program, variantType)) {
        errorTypes.push(variantType);
      } else {
        successTypes.push(variantType);
      }
    }
  } else if (
    returnType.kind === "Model" &&
    isErrorModel(program, returnType as Model)
  ) {
    errorTypes.push(returnType as Model);
  } else {
    successTypes.push(returnType);
  }

  return { successTypes, errorTypes };
}

/**
 * Resolves a method parameter to TypeScript syntax.
 */
async function resolveParameter(
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  param: { name: string; type: Type; optional: boolean; defaultValue?: any },
  namespaces: string[],
): Promise<{ resolved: string; imports: string[][] }> {
  const resolved = await Resolvable.resolve(Resolver.Type, param.type, {
    program,
    options,
    emitDocs: false,
    nestlevel: 0,
    rootType: { type: param.type as any, namespaces, hasVisibility: undefined },
    typemap,
    rootTypeReady: true,
    ancestryPath: [...namespaces],
  });

  const optionalMark = param.optional ? "?" : "";

  return {
    resolved: `${param.name}${optionalMark}: ${resolved.resolved.value}`,
    imports: resolved.imports,
  };
}

/**
 * Resolves the success return type to TypeScript syntax.
 * Returns 'never' if there are no success types, or a union if multiple.
 */
async function resolveSuccessReturnType(
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  successTypes: Type[],
  namespaces: string[],
): Promise<{ resolved: string; imports: string[][] }> {
  if (successTypes.length === 0) {
    return { resolved: "never", imports: [] };
  }

  const allImports: string[][] = [];
  const resolvedTypes: string[] = [];

  for (const t of successTypes) {
    // Handle void return type
    if (t.kind === "Intrinsic" && (t as any).name === "void") {
      resolvedTypes.push("void");
      continue;
    }

    const resolved = await Resolvable.resolve(Resolver.Type, t, {
      program,
      options,
      emitDocs: false,
      nestlevel: 0,
      rootType: { type: t as any, namespaces, hasVisibility: undefined },
      typemap,
      rootTypeReady: true,
      ancestryPath: [...namespaces],
    });

    resolvedTypes.push(resolved.resolved.value);
    allImports.push(...resolved.imports);
  }

  const resolved =
    resolvedTypes.length === 1 ? resolvedTypes[0] : resolvedTypes.join(" | ");

  return { resolved, imports: allImports };
}

/**
 * Generates a method signature with JSDoc @throws comments for error types.
 */
async function resolveMethodSignature(
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  operation: Operation,
  namespaces: string[],
): Promise<{ signature: string; imports: string[][] }> {
  const allImports: string[][] = [];
  const isAsync = isAsyncOp(program, operation);

  // Resolve parameters
  const params: string[] = [];
  for (const [, param] of operation.parameters.properties) {
    const resolved = await resolveParameter(
      program,
      options,
      typemap,
      {
        name: param.name,
        type: param.type,
        optional: param.optional,
        defaultValue: param.defaultValue,
      },
      namespaces,
    );
    params.push(resolved.resolved);
    allImports.push(...resolved.imports);
  }

  // Analyze return type
  const { successTypes, errorTypes } = analyzeReturnType(
    program,
    operation.returnType,
  );

  // Resolve success return type
  const returnTypeResult = await resolveSuccessReturnType(
    program,
    options,
    typemap,
    successTypes,
    namespaces,
  );
  allImports.push(...returnTypeResult.imports);

  // Build JSDoc for @throws
  let jsdoc = "";
  if (errorTypes.length > 0) {
    const throwsLines: string[] = [];
    for (const errorType of errorTypes) {
      const errorName = errorType.name || "Error";
      throwsLines.push(`   * @throws {${errorName}}`);
    }
    jsdoc = `  /**\n${throwsLines.join("\n")}\n   */\n`;
  }

  // Build return type (wrap in Promise if async)
  let returnType = returnTypeResult.resolved;
  if (isAsync) {
    returnType = `Promise<${returnType}>`;
  }

  const signature = `${jsdoc}  ${operation.name}(${params.join(", ")}): ${returnType};`;

  return { signature, imports: allImports };
}

/**
 * Emits TypeScript interface declaration for a TypeSpec Interface.
 */
async function emitInterface(
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  iface: Interface,
  namespaces: string[],
): Promise<{ content: string; imports: string[][] }> {
  const allImports: string[][] = [];

  // Skip empty interfaces
  const operations = Array.from(iface.operations);
  if (operations.length === 0) {
    return { content: `export interface ${iface.name} {}`, imports: [] };
  }

  // Build interface body
  const methodSignatures: string[] = [];

  for (const [, operation] of iface.operations) {
    const { signature, imports: methodImports } = await resolveMethodSignature(
      program,
      options,
      typemap,
      operation,
      namespaces,
    );
    methodSignatures.push(signature);
    allImports.push(...methodImports);
  }

  const content = `export interface ${iface.name} {\n${methodSignatures.join("\n\n")}\n}`;

  return { content, imports: allImports };
}

export const emitTypes = async (
  program: Program,
  options: EmitterOptions,
  typemap: TTypeMap,
  interfaceMap: TInterfaceMap = [],
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

  // generate files from typemap
  typemap.forEach((t) => {
    const filename = filenameFromNamespaces(t.namespaces, true);
    if (!files[filename]) {
      files[filename] = new AppendableString();
      imports[filename] = {
        namespaces: [],
        lifecycleTypes: [],
      };
    }
  });

  // also generate files from interfaceMap
  interfaceMap.forEach((i) => {
    const filename = filenameFromNamespaces(i.namespaces, true);
    if (!files[filename]) {
      files[filename] = new AppendableString();
      imports[filename] = {
        namespaces: [],
        lifecycleTypes: [],
      };
    }
  });

  const typeOrder: Type["kind"][] = ["Enum", "Scalar", "Model", "Union"];
  typemap.sort(
    (a, b) => typeOrder.indexOf(a.type.kind) - typeOrder.indexOf(b.type.kind),
  );

  // resolve all types
  for (let i = 0; i < typemap.length; i++) {
    const t = typemap[i];
    const filename = filenameFromNamespaces(t.namespaces, true);
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

  // emit all interfaces
  for (const ifaceEntry of interfaceMap) {
    const filename = filenameFromNamespaces(ifaceEntry.namespaces, true);
    const { content, imports: ifaceImports } = await emitInterface(
      program,
      options,
      typemap,
      ifaceEntry.iface,
      ifaceEntry.namespaces,
    );

    files[filename].addLine(content);
    files[filename].append("\n");
    imports[filename].namespaces.push(...ifaceImports);
  }

  const filesArr = Object.entries(files).filter((f) => !!f[1].value);
  for (let i = 0; i < filesArr.length; i++) {
    if (!filesArr[i][1].value) continue;
    const filename = filesArr[i][0];

    imports[filename].namespaces = unique2D(imports[filename].namespaces);
    const importStrings = getImports(
      imports[filename].namespaces.filter(
        (i) =>
          filenameFromNamespaces(i, options["import-file-extensions"]) !==
          filename,
      ),
      options["import-file-extensions"],
    );
    if (imports[filename].lifecycleTypes.length > 0) {
      importStrings.push(
        `import {${[...new Set(imports[filename].lifecycleTypes)].join(", ")}} from './${visibilityHelperFileName(options["import-file-extensions"])}';`,
      ); // unique-ify
    }

    const content = `/* eslint-disable */\n\n${autogenerateWarning}${importStrings.join("\n")}${importStrings.length > 0 ? "\n\n" : ""}${filesArr[i][1].value}`;
    await emitFile(program, {
      path: resolvePath(options["out-dir"], filename),
      content: content,
    });
  }
};
