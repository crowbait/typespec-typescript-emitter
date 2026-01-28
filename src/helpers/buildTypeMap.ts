import {
  Enum,
  Interface,
  Model,
  Namespace,
  navigateProgram,
  navigateTypesInNamespace,
  Program,
  Scalar,
  Union,
} from "@typespec/compiler";
import { EmitterOptions } from "../lib.js";

export type TTypeMap = {
  type: Enum | Model | Scalar | Union;
  namespaces: string[];
  hasVisibility: boolean | undefined;
}[];

export type TInterfaceMap = {
  iface: Interface;
  namespaces: string[];
}[];

/**
 * Traverses all namespaces in the program and produces
 * a map of all types-to-be-emitted and their namespace hierarchy.
 */
export const buildTypeMap = (
  program: Program,
  options: EmitterOptions,
): TTypeMap => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = structuredClone(options["root-namespaces"]);
  const map: TTypeMap = [];

  const pushType = (t: TTypeMap[number]["type"], hierarchy: string[]): void => {
    if (!t.name) return;
    map.push({
      type: t,
      namespaces: hierarchy,
      hasVisibility: undefined,
    });
  };

  const traverseNamespace = (n: Namespace, hierarchy: string[]) => {
    navigateTypesInNamespace(
      n,
      {
        enum: (t) => pushType(t, [...hierarchy, n.name]),
        scalar: (t) => pushType(t, [...hierarchy, n.name]),
        model: (t) => pushType(t, [...hierarchy, n.name]),
        union: (t) => pushType(t, [...hierarchy, n.name]),
      },
      {
        skipSubNamespaces: true,
      },
    );
    n.namespaces.forEach((ns) => traverseNamespace(ns, [...hierarchy, n.name]));
  };

  navigateProgram(program, {
    namespace(n) {
      const nsIndex = options["root-namespaces"].findIndex(
        (ns) => n.name === ns,
      );
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete options["root-namespaces"][nsIndex];

      traverseNamespace(n, []);
    },
  });

  // restore un-mutated version
  options["root-namespaces"] = targetedNamespaces;
  return map;
};

/**
 * Traverses all namespaces in the program and produces
 * a map of all interfaces-to-be-emitted and their namespace hierarchy.
 */
export const buildInterfaceMap = (
  program: Program,
  options: EmitterOptions,
): TInterfaceMap => {
  // save original targeted namespaces array because it's mutated here
  const targetedNamespaces = structuredClone(options["root-namespaces"]);
  const map: TInterfaceMap = [];

  const pushInterface = (iface: Interface, hierarchy: string[]): void => {
    if (!iface.name) return;
    map.push({
      iface,
      namespaces: hierarchy,
    });
  };

  const traverseNamespace = (n: Namespace, hierarchy: string[]) => {
    // Collect interfaces in this namespace
    for (const [, iface] of n.interfaces) {
      pushInterface(iface, [...hierarchy, n.name]);
    }
    // Also traverse operations at namespace level that might be in interfaces
    n.namespaces.forEach((ns) => traverseNamespace(ns, [...hierarchy, n.name]));
  };

  navigateProgram(program, {
    namespace(n) {
      const nsIndex = options["root-namespaces"].findIndex(
        (ns) => n.name === ns,
      );
      if (nsIndex === -1) return;
      // for some reason, navigateProgram visits each namespace multiple times; this prevents that
      delete options["root-namespaces"][nsIndex];

      traverseNamespace(n, []);
    },
  });

  // restore un-mutated version
  options["root-namespaces"] = targetedNamespaces;
  return map;
};
