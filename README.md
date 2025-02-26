# typespec-typescript-emitter

This is a [TypeSpec](https://typespec.io) library aiming to provide
TypeScript output to a TypeSpec project.

Currently, this library is tailored to my specific use case, which is defining
an HTTP API. The 'routes'-emitter will only work on HTTP operations. **However**, exporting all models as types is independent of HTTP, and so may also benefit projects with a different usage scenario.

It can the following things:

- ts files exporting every model present in the spec
  - 1 file for each (nested) namespace
  - exports models, enums and unions
  - does NOT export aliases (see below)
- optional typeguards, *if* type export is enabled
  - referenced or generated in the routes object as well, if enabled (experimental)
- for `TypeSpec.Http`: ts file containing a nested object containing information about every route
  - this can be imported at runtime to provide a robust way of eg. accessing URLs

## Content <!-- omit from toc -->

- [Installation](#installation)
- [Configuration](#configuration)
- [Types emitter](#types-emitter)
  - [Alias's](#aliass)
- [Routes emitter](#routes-emitter)

## Installation

```sh
npm i -D typespec-typescript-emitter
```

## Configuration

This library is configured using TypeSpec's `tspconfig.yaml` file:

```yaml
emit:
  - "typespec-typescript-emitter"
options:
  "typespec-typescript-emitter":
    root-namespace: "string"
    out-dir: "{cwd}/path"
    enable-types: true
    enable-typeguards: false
    enable-routes: false
```

The following options are available:

- `root-namespace` **(required)**: name of the most outer namespace. As the TypeSpec docs recommend, your project is expected to consist of one or more nested namespaces. Here, you need to specify the most outer / general namespace you want emitted.
- `out-dir`: output directory. Must be an absolute path; replacers like `{cwd}` are permitted.
- `enable-types` (default: true): enables output of TypeScript types.
- `enable-typeguards` (default: false): enables output of typeguards, *IF* type-output is enabled.
- `enable-routes` (default: false): enables output of the HTTP-routes object.

## Types emitter

This emitter will traverse your configured root namespace and all nested namespaces, generating a `{namespace-name}.ts`-file.

The emitter can handle `Model`s, `Enum`s and `Union`s. ~~`Alias`'s~~ are _not_ emitted - more on that [later](#aliass). It will also preserve docs as JSDoc-style comments.

The emitter should be able to handle most basic TS contructs, like scalars, literals, object, arrays, tuples and intrinsics (eg. `null`).

Example:

```ts
namespace myProject { // remember to set in config!
  enum ReadStatus {
    Never,
    Once,
    Often
  }
  union Author {"unknown" | string}
  model Book {
    author: Author,
    title: string,
    subtitle: null | string,
    read: ReadStatus,
    chapterTitles?: string[]
  }

  // you can either nest namespaces like this:
  namespace subNameSpace {/* ... */}
  // ... or specify them in (and import from) external files:
  namespace myProject.subNameSpace {/* ... */} // this is in another file
  // The emitted file will always have the name of the namespace it's
  // *currently* investigating, in this case:
  // `SubNameSpace.ts`
}
```

...will be transformed into:

```ts
/* /path/to/outdir/MyProject.ts */
export enum ReadStatus {
  Never,
  Once,
  Often
}
export type Author = "unknown" | string;
export interface Book {
  author: Author,
  title: string,
  subtitile: null | string,
  read: ReadStatus,
  chapterTitles?: string[]
}

// if `enable-typeguards` is set to true
export function isBook(arg: any): arg is Book {
  return (
    (arg['author'] !== undefined) &&
    (arg['title'] !== undefined && typeof arg['title'] === 'string') &&
    (arg['subtitle'] !== undefined) &&
    (arg['read'] !== undefined) &&
    (arg['chapterTitles'] === undefined ||  Array.isArray(arg['chapterTitles']))
  );
};

// the other namespace will be emitted to `/path/to/outdir/SubNameSpace.ts`
```

Typeguards *should* create comprehensive checks that adhere as strictly to the source model as possible.
If you find a case where the typeguard is looser than it needs to be, please report that as a bug.

### Alias's

There seems to be no way to extract aliases from TypeSpec's emitter framework. Because of that, `Alias`'s are ignored by the emitter (or, to be more precise: `Alias`'s reach the emitter already resolved. They won't be exported as their own type but directly substituted where they're needed).

That means, if you want something to be emitted, it can't be an alias:

```ts
model Demo {
  prop1: string,
  prop2: int32
}

// will not be emitted:
alias Derived1 = OmitProperties<Demo, "prop1">;

// will be emitted:
model Derived2 {...OmitProperties<Demo, "prop1">};
```

## Routes emitter

**This emitter depends on your use of the `TypeSpec.Http` library**.

If you're using `TypeSpec.Http` to define your API routes and endpoints, this library offers an emitter to export a `routes` object.
It will generate a nested object containing information about every `op` you have defined, nested by namespace.
I contains the following data (per `op`):
- `method`: HTTP method
- `path`: Path (as defined as `route`-string; parameters are not substituted)
- `getUrl`: Function for generating a valid URL to this `op`; if the path has parameters, this function will have analogue parameters
- `auth`: Array of valid authentication schemes (or `[null]`, if none)
Just as the types emitter, this emitter will also preserve docs as JSDoc-style comments.

Example:

```ts
@server("https://api.example.com", "Server")
namespace myProject { // remember to set in config!
  @get
  op getSomething(): {@body body: string};
  // if you want to use `typeguards-in-routes`, make sure
  // to properly declare responses as a model with a `body`-property

  @get
  @route("{param}")
  @useAuth(NoAuth | BasicAuth)
  op getSmthElse(@path param: string): {@body body: string};

  @route("/subroute")
  namespace sub {
    @post
    @route("post/{post_param}")
    @useAuth(BearerAuth)
    op postSomething(
      @path post_param: int32,
      @body body: string
    ): {@body body: string};
  }
}
```

...will be transformed into:

```ts
/* /path/to/outdir/routes_{root-namespace}.ts */
export const routes_myProject = {
  getSomething: {
    method: 'GET',
    path: '/',
    getUrl: (): string => `/`,
    auth: [null]
  },
  getSmthElse: {
    method: 'GET',
    path: '/{param}',
    getUrl: (params: {param: string}): string => `/${params.param}`,
    auth: [null, "BASIC"]
  },
  sub: {
    postSomething: {
      method: 'POST',
      path: '/post/{post_param}',
      getUrl: (params: {post_param: string}): string => `/post/${params.post_param}`,
      auth: ["BEARER"]
    }
  }
} as const;
```