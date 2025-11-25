import {TTypeMap} from './buildTypeMap.js';
import {filenameFromNamespaces} from './namespaces.js';

export const getImports = (imports: TTypeMap[number]["namespaces"][]): string[] => imports.map((i) => 
  `import * as ${i.join("_")} from './${filenameFromNamespaces(i)}';`
);