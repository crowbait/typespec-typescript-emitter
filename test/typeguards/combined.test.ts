import { readFileSync } from "fs";
import { join } from "path";
import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../helpers/wrapper";

const input = readFileSync(
  join(__dirname, "..", "helpers", "largeModel.tsp"),
  "utf8",
);

const target = `
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Read].includes(vis) ? !('id_onlyRead' in undefined) : (undefined['id_onlyRead'] !== undefined && (typeof undefined['id_onlyRead'] === 'number'))) &&
  undefined['name'] !== undefined && (typeof undefined['name'] === 'string') &&
  undefined['aliasedName'] === undefined || (typeof undefined['aliasedName'] === 'string') &&
  undefined['date'] !== undefined && (undefined['date'] instanceof Date) &&
  undefined['time'] !== undefined && (typeof undefined['time'] === 'string') &&
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Create].includes(vis) ? !('created_onlyCreate' in undefined) : (
    undefined['created_onlyCreate'] !== undefined && (undefined['created_onlyCreate'] instanceof Date)
  )) &&
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Read, Lifecycle.Query].includes(vis) ? !('tuple_strIntModel_readQuery' in undefined) : (
    undefined['tuple_strIntModel_readQuery'] !== undefined && (
      Array.isArray(undefined['tuple_strIntModel_readQuery']) && (
        typeof undefined['tuple_strIntModel_readQuery'][0] === 'string'
      ) && (
        typeof undefined['tuple_strIntModel_readQuery'][1] === 'number'
      ) && (
        undefined['tuple_strIntModel_readQuery'][2]['inmodel_union'] !== undefined && (
          (undefined['tuple_strIntModel_readQuery'][2]['inmodel_union'] === null) || (true)
        )
      )
    )
  )) &&
  undefined['nested'] === undefined || (undefined['nested']['availability'] !== undefined && (typeof undefined['nested']['availability'] === 'boolean')) &&
  undefined['array'] !== undefined && (Array.isArray(undefined['array']) && undefined['array'].every((v) => typeof v === 'string')) &&
  undefined['array_union'] !== undefined && (Array.isArray(undefined['array_union']) && undefined['array_union'].every((v) => (typeof v === 'string') || (typeof v === 'number'))) &&
  undefined['record'] !== undefined && (typeof undefined['record'] === 'object' && Object.entries(undefined['record'] as Record<string, any>).every((v) => typeof v[1] === 'string')) &&
  undefined['record_union'] !== undefined && (typeof undefined['record_union'] === 'object' && Object.entries(undefined['record_union'] as Record<string, any>).every((v) => (typeof v[1] === 'string') || (typeof v[1] === 'number'))) &&
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Delete, Lifecycle.Query].includes(vis) ? !('nested_deleteQuery' in undefined) : (
    undefined['nested_deleteQuery'] !== undefined && (
      ((vis as any) !== Lifecycle.All && ![Lifecycle.Query].includes(vis) ? !('str_onlyQuery' in undefined['nested_deleteQuery']) : (
        undefined['nested_deleteQuery']['str_onlyQuery'] !== undefined && (typeof undefined['nested_deleteQuery']['str_onlyQuery'] === 'string')
      )) &&
      undefined['nested_deleteQuery']['aliasedModel'] !== undefined && (
        undefined['nested_deleteQuery']['aliasedModel']['str'] !== undefined && (typeof undefined['nested_deleteQuery']['aliasedModel']['str'] === 'string') &&
        undefined['nested_deleteQuery']['aliasedModel']['fl'] !== undefined && (typeof undefined['nested_deleteQuery']['aliasedModel']['fl'] === 'number') &&
        undefined['nested_deleteQuery']['aliasedModel']['nested'] !== undefined && (
          undefined['nested_deleteQuery']['aliasedModel']['nested']['int'] !== undefined && (typeof undefined['nested_deleteQuery']['aliasedModel']['nested']['int'] === 'number')
        )
      ) &&
      undefined['nested_deleteQuery']['modelWithVis'] !== undefined && (
        undefined['nested_deleteQuery']['modelWithVis']['a'] !== undefined && (undefined['nested_deleteQuery']['modelWithVis']['a'] === 'a') &&
        ((vis as any) !== Lifecycle.All && ![Lifecycle.Delete].includes(vis) ? !('seven_onlyDelete' in undefined['nested_deleteQuery']['modelWithVis']) : (
          undefined['nested_deleteQuery']['modelWithVis']['seven_onlyDelete'] !== undefined && (undefined['nested_deleteQuery']['modelWithVis']['seven_onlyDelete'] === 7)
        ))
      )
    )
)) &&
  undefined['nestedInnerVis'] !== undefined && (
    undefined['nestedInnerVis']['unk'] === undefined || (true) &&
    ((vis as any) !== Lifecycle.All && ![Lifecycle.Update].includes(vis) ? !('void_onlyUpdate' in undefined['nestedInnerVis']) : (
      undefined['nestedInnerVis']['void_onlyUpdate'] === undefined
    ))
  ) &&
  undefined['tupleWithUnion'] !== undefined && (
    Array.isArray(undefined['tupleWithUnion']) && (typeof undefined['tupleWithUnion'][0] === 'string') && ((typeof undefined['tupleWithUnion'][1] === 'number') || (typeof undefined['tupleWithUnion'][1] === 'boolean'))
  )
`;

expectResolution(Resolver.Typeguard, {
  type: "Model",
  desc: "combined",
  source: input,
  target: target,
  config: {
    "serializable-date-types": false,
  },
  typescriptTransformer: null,
});
