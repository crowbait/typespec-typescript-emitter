import "@typespec/http";
using TypeSpec.Http;

@route("/test-simple")
namespace test {
  enum WidgetSize {
    SMALL: "small",
    LARGE: "large",
  }
  
  enum WidgetStatus {
    ACTIVE: "active",
    INACTIVE: "inactive",
  }
  
  model Tag {
    name: string;
    value: string;
  }
  
  model SmallWidget {
    type: WidgetSize.SMALL;
    weight: int32;
    color: "red" | "blue";
  }
  
  model LargeWidget {
    type: WidgetSize.LARGE;
    size: string;
    capacity: int32;
  }
  
  union WidgetDetails {
    small: SmallWidget,
    large: LargeWidget,
  }
  
  model Widget {
    @visibility(Lifecycle.Read)
    id: string;
    
    status: WidgetStatus;
    
    details: WidgetDetails;
    
    tags?: Tag[];
  }
  
  @error
  model Error {
    code: int32;
    message: string;
  }
  
  @route("/widgets")
  @tag("Widgets")
  interface Widgets {
    @get list(): Widget[] | Error;
    @get read(@path id: string): Widget | Error;
    @post create(@body widget: Widget): Widget | Error;
  }
}