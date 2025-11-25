import {EmitContext, emitFile, resolvePath} from '@typespec/compiler';
import {AppendableString} from './helpers/appendableString.js';
import {unique2D} from './helpers/arrays.js';
import autogenerateWarning from './helpers/autogenerateWarning.js';
import {TTypeMap} from './helpers/buildTypeMap.js';
import {getImports} from './helpers/getImports.js';
import {filenameFromNamespaces} from './helpers/namespaces.js';
import {EmitterOptions} from './lib.js';
import {resolve, Resolver} from './resolve/resolve.js';

export const emitTypes = async (
  context: EmitContext<EmitterOptions>,
  typemap: TTypeMap
): Promise<void> => {
  // maps file names to file contents
  const files: Record<string, AppendableString> = {};
  // maps file names to list of required imports
  const imports: Record<string, TTypeMap[number]["namespaces"][]> = {}

  // generate files
  typemap.forEach(t => {
    files[filenameFromNamespaces(t.namespaces)] = new AppendableString();
    imports[filenameFromNamespaces(t.namespaces)] = []
  });
  
  // resolve all types
  for (let i = 0; i < typemap.length; i++) {
    const t = typemap[i];
    const filename = filenameFromNamespaces(t.namespaces);
    const resolved = await resolve(Resolver.Type, t.type, {
      "context": context,
      "emitDocs": true,
      "nestlevel": 0,
      "originalType": t,
      "typemap": typemap
    });
  
    imports[filename].push(...resolved.imports);
    let declaration = "export ";
    switch (t.type.kind) {
      case "Enum":
        declaration += `enum ${t.type.name}`;
        break;
      case "Model":
        declaration += `interface ${t.type.name}`;
        break;
      case "Union":
        declaration += `type ${t.type.name} =`;
        break;
    }
    if (resolved.doc) files[filename].addLine(`/** ${resolved.doc} */`);
    files[filename].addLine(`${declaration} ${resolved.resolved.value}`);
    
    if (context.options["enable-typeguards"]) {
      const typeguard = await resolve(Resolver.Typeguard, t.type, {
        "context": context,
        "nestlevel": 1,
        "originalType": t,
        "typemap": typemap,
        "accessor": "t"
      });
      if (typeguard.resolved.value) {
        files[filename].addLine(`export function is${t.type.name}(t: any, visibility?: Visibility): t is ${t.type.name} {return (${typeguard.resolved})}`);
        imports[filename].push(...typeguard.imports);
      }
    }

    files[filename].append("\n");
  };

  const filesArr = Object.entries(files).filter(f => !!f[1].value)
  for (let i = 0; i < filesArr.length; i++) {
    if (!filesArr[i][1].value) continue;
    const filename = filesArr[i][0];
  
    imports[filename] = unique2D(imports[filename]);
    const importStrings = getImports(imports[filename].filter(i => filenameFromNamespaces(i) !== filename));
    if (context.options["enable-typeguards"]) {
      importStrings.push("import {Visibility} from '@typespec/http';")
    }

    const content = `/* eslint-disable */\n\n${autogenerateWarning}\n${importStrings.join("\n")}\n\n${filesArr[i][1].value}`;
    await emitFile(context.program, {
      path: resolvePath(context.options['out-dir'], filename),
      content: content
    });
  };
}