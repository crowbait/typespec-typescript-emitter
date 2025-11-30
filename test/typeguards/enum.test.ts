import { Resolver } from "../../src/resolve/Resolvable_helpers";
import { expectResolution } from "../helpers/wrapper";

expectResolution(Resolver.Typeguard, {
  type: "Enum",
  source: "enum test {val1, val2}",
  target: "", // enums don't have typeguards
  typescriptTransformer: null,
  noTruthyCheck: true,
});
