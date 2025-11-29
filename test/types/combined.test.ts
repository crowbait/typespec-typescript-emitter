import { readFileSync } from "fs";
import { join } from "path";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../helpers/wrapper";

const input = readFileSync(
  join(__dirname, "..", "helpers", "largeModel.tsp"),
  "utf8",
);

const target = `
FilterLifecycle<{
  id_onlyRead: number,
  name: string,
  aliasedName?: string,
  date: string,
  time: string,
  created_onlyCreate: number,
  tuple_strIntModel_readQuery: [string, number, {inmodel_union: null | unknown}],
  nested?: {
    availability: boolean
  },
  array: (string)[],
  array_union: (string | number)[],
  record: {[k: string]: string},
  record_union: {[k: string]: string | number},
  nested_deleteQuery: {
    str_onlyQuery: string,
    aliasedModel: {str: string,fl: number,nested: {int: number}},
    modelWithVis: {
      a: 'a',
      seven_onlyDelete: 7
    }
  },
  nestedInnerVis: {
    unk?: unknown,
    void_onlyUpdate: void
  },
  tupleWithUnion: [string, number | boolean]
}, {
  'id_onlyRead': {vis: [Lifecycle.Read]},
  'created_onlyCreate': {vis: [Lifecycle.Create]},
  'tuple_strIntModel_readQuery': {vis: [Lifecycle.Read, Lifecycle.Query]},
  'nested_deleteQuery': {
    vis: [Lifecycle.Delete, Lifecycle.Query],
    nested: {
      'str_onlyQuery': {vis: [Lifecycle.Query]},
      'modelWithVis': {
        nested: {
          'seven_onlyDelete': {vis: [Lifecycle.Delete]}
        }
      }
    }
  },
  'nestedInnerVis': {
    nested: {
      'void_onlyUpdate': {vis: [Lifecycle.Update]}
    }
  }
}, V>
`;

expectResolution(Resolver.Type, {
  type: "Model",
  desc: "combined",
  source: input,
  target: target,
  config: {
    "serializable-date-types": true,
  },
});
