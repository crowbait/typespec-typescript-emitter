import "@typespec/http";
using TypeSpec.Http;

@route("/test-simple")
namespace test {
enum Status {
    STATUS_1,
    STATUS_2
  }
  enum StatusShifted {
    STATUS_1: 1,
    STATUS_2: 2
  }
  enum StatusText {
    STATUS_1: "Status 1",
    STATUS_2: "Status 2"
  }
  
  model TestEnumModel {
    status: Status,
    status_shifted: StatusShifted,
    status_text: StatusText
  }

  @get
  op getAll(): {@body body: TestEnumModel[]};

  @post
  op add(@body body: TestEnumModel): OkResponse;

  @get
  @route("{id}")
  op getOne(
    @path id: int32
  ): {@body body: TestEnumModel} | NotFoundResponse;
}