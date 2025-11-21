import "@typespec/http";
using TypeSpec.Http;

// https://github.com/crowbait/typespec-typescript-emitter/issues/7

@route("/test-simple")
namespace test {
  union UnionA {
    variantName1: {a: true, b: false},
    variantName2: int32,
  }

  union UnionB {
    variantName1: {a: true, b: false}[],
    variantName2: int32,
  }

  union UnionVisibility {
    variantName1: {
      @visibility(Lifecycle.Create)
      a: true,
      b: false
    },
    variantName2: int32,
  }

  model UnionModel {
    a: int16 | UnionA,
    b: boolean | string,
    c: UnionA | UnionVisibility
  }

  @get
  op getAll(): {@body body: UnionA[]} | {@statusCode status: 418, @body body: "Me teapot"};

  @post
  op add(@body body: UnionVisibility): {@body body: UnionModel};
}