import "@typespec/http";

using TypeSpec.Http;

@service()
namespace test {
  enum AdminLevel {
    Level1,
    Level2
  }

  scalar Name extends string;
  alias Timestamp = unixTimestamp32;

  model Resource {
    @visibility(Lifecycle.Read)
    id_onlyRead: uint32,
    name: Name,
    metadata: {
      @visibility
      created_onlyRead: Timestamp,
      user: uint32,
      username: string,
      adminLevel?: AdminLevel | null
    }
  }

  /** Retrieves an instance of the ressource */
  @get
  op getResource(): {
    @statusCode status: 200,
    @body body: Resource
  };

  /** Creates a resource */
  @post
  op postResource(@body body: Resource | inner.InnerModel): OkResponse;

  @route("/inner")
  namespace inner {
    model InnerModel {
      resourceName: string,
      resource: test.Resource
    }

    op del(@body body: InnerModel): OkResponse | UnauthorizedResponse;
  }
}