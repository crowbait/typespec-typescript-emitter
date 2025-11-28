scalar dateType extends unixTimestamp32;
alias aliasedString = string;
alias aliasedModel = {str: string, fl: float, nested: {int: int32}};

model test {
  @visibility(Lifecycle.Read)
  id_onlyRead: uint64,
  name: string,
  aliasedName: aliasedString,
  date: utcDateTime,
  time: plainTime,
  @visibility(Lifecycle.Create)
  created_onlyCreate: unixTimestamp32,
  @visibility(Lifecycle.Read, Lifecycle.Query)
  tuple_strIntModel_readQuery: [string, int16, {inmodel_union: null | unknown}],
  nested: {
    availability: boolean
  },
  array: string[],
  array_union: (string | int16)[],
  record: Record<string>,
  record_union: Record<string | int16>,
  @visibility(Lifecycle.Delete, Lifecycle.Query)
  nested_deleteQuery: {
    @visibility(Lifecycle.Query)
    str_onlyQuery: string,
    aliasedModel: aliasedModel,
    modelWithVis: {
      a: "a",
      @visibility(Lifecycle.Delete)
      seven_onlyDelete: 7
    }
  },
  nestedInnerVis: {
    unk: unknown,
    @visibility(Lifecycle.Update)
    void_onlyUpdate: void
  },
  tupleWithUnion: [string, int32 | boolean]
}