import {EmitContext, Enum, Model, Namespace, navigateProgram, navigateTypesInNamespace, Union} from '@typespec/compiler';
import {EmitterOptions} from '../lib.js';

export type TTypeMap = {
  type: Enum | Model | Union,
  namespaces: string[]
}[]

/**
 * Traverses all namespaces in the program and produces
 * a map of all types-to-be-emitted and their namespace hierarchy.
 */
export const buildTypeMap = (context: EmitContext<EmitterOptions>): TTypeMap => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = [...context.options["root-namespaces"]];
  const map: TTypeMap = [];

  const pushType = (t: Enum | Model | Union, hierarchy: string[]): void => {
    if (!t.name) return;
    map.push({
      type: t,
      namespaces: hierarchy
    });
  }

  const traverseNamespace = (n: Namespace, hierarchy: string[]) => {
    navigateTypesInNamespace(n, {
      enum: (t) => pushType(t, [...hierarchy, n.name]),
      model: (t) => pushType(t, [...hierarchy, n.name]),
      union: (t) => pushType(t, [...hierarchy, n.name])
    }, {
      "skipSubNamespaces" : true
    });
    n.namespaces.forEach(ns => traverseNamespace(ns, [...hierarchy, n.name]));
  }

  navigateProgram(context.program, {
    namespace(n) {
      const nsIndex = context.options["root-namespaces"].findIndex(ns => n.name === ns);
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete context.options["root-namespaces"][nsIndex];
      
      traverseNamespace(n, []);
    }
  });

  context.options["root-namespaces"] = targetedNamespaces;
  return map;
}