import {Namespace} from '@typespec/compiler';

/** Traverses *up* a namespace, generating a hierarchy array from itself and its parents. */
export const namespaceListFromNamespace = (n: Namespace | undefined): string[] | null => {
  if (!n) return null;
  const ret: string[] = [];
  let cur: Namespace | undefined = n;
  while (cur && cur.name) {
    ret.unshift(cur.name);
    cur = cur.namespace;
  }
  return ret;
}

export const filenameFromNamespaces = (ns: string[]): string => `${ns.join(".")}.ts`;