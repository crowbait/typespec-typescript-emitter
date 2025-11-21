import "@typespec/http";
using TypeSpec.Http;

@route("/test-simple")
namespace test {
  model TestSimpleA {
    @visibility(Lifecycle.Read)
    id: int32,
    name: string
  }

  @get
  op getAll(): {@body body: TestSimpleA[]} | {@statusCode status: 418, @body body: "Me teapot"};

  @post
  op add(@body body: TestSimpleA): OkResponse;

  @get
  @route("{id}")
  op getOne(
    @path id: int32
  ): {@body body: TestSimpleA} | NotFoundResponse | {@statusCode status: 418} | {@statusCode status: 419, @body body: {}};
}