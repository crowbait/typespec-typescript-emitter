import "@typespec/http";
using TypeSpec.Http;

@route("/test-simple")
namespace test {
  model TestVisibilityA {
    @visibility(Lifecycle.Create, Lifecycle.Read)
    name: string;
    @visibility(Lifecycle.Read)
    display: string;
    always: boolean;
    @visibility(Lifecycle.Update)
    updated: int32;
    @visibility(Lifecycle.Read, Lifecycle.Create)
    readCreateModel: {
      always: true;
      @visibility(Lifecycle.Create)
      create: string;
    }
  }

  @route("/visibility")
  @tag("Test-Visibility")
  interface Tests {
    @doc("List Tests")
    @get op list(): {
      @statusCode statusCode: 200;
      @body response: TestVisibilityA[]; // RESPONSE body: [{name: string, display: string, always: boolean}]
    };

    @route("/{id}")
    @get op read(@path id: int32): {
      @statusCode statusCode: 200;
      @header "content-type": "application/json";
      @body response: TestVisibilityA; // RESPONSE body: {name: string, display: string, always: boolean}
    };

    @post op create(@body test: TestVisibilityA): { // POST body: {name: string, always: boolean}. -> emit type TestCreate
      @statusCode statusCode: 201;
      @body response: TestVisibilityA; // RESPONSE body: {name: string, display: string, always: boolean}
    };

    @route("/{id}")
    @patch op update(@path id: int32, @body test: TestVisibilityA): { // PATCH body: {always: boolean} -> emit type TestUpdate
      @statusCode statusCode: 201;
      @body response: TestVisibilityA; // RESPONSE body: {name: string, display: string, always: boolean}
    };
  }
}