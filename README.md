# typespec-typescript-emitter <!-- omit from toc -->

This is a [TypeSpec](https://typespec.io) library aiming to provide TypeScript (*TS*) output to a TypeSpec (*TSP*) project.

While this library is tailored to HTTP APIs, it can certainly be useful to other types of projects.

It can the following things:

- export TypeScript files containing each enum, scalar, model and union present in your TSP files
- generate narrow typeguards for all emitted types
- *for HTTP*: export a nested object containing information about every route (eg. url-from-parameters, method, etc.)
- *for HTTP*: export a "routed typemap", making expected request and response body types accessible using the operation's path

## Content <!-- omit from toc -->

- [Installation](#installation)
- [Configuration](#configuration)
- [Emitter: Types](#emitter-types)
  - [Types](#types)
  - [Typeguards](#typeguards)
  - [Lifecycle Visibility](#lifecycle-visibility)
    - [In Types](#in-types)
    - [In Typeguards](#in-typeguards)
  - [Nominal Enums](#nominal-enums)
  - [Overriding Types \& Typeguards](#overriding-types--typeguards)
- [Emitter: Routes](#emitter-routes)
- [Emitter: Routed Typemap](#emitter-routed-typemap)
- [Contributing](#contributing)
  - [Short Overview](#short-overview)
  - [Todo](#todo)

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
    root-namespaces:
      - "namespace1"
      - "namespace2"
    out-dir: "{cwd}/path"
    enable-types: true
    enable-typeguards: false
    enable-routes: false
    enable-routed-typemap: false
    string-nominal-enums: false
    serializable-date-types: false
```

The following options are available:

- `root-namespaces` **(required)**: array of names of all namespaces in your program you want to emit from. You don't need to specify namespaces nested inside other namespaces, as the ones listed will be traversed recursively.
- `out-dir` **(required)**: output directory. Must be an absolute path; replacers like `{cwd}` are permitted.
- `enable-types` (default: true): enables output of TypeScript types.
- `enable-typeguards` (default: false, **requires** `enable-types`): enables output of [typeguards](#typeguards).
- `enable-routes` (default: false): enables output of the [HTTP-routes object](#emitter-routes).
- `enable-routed-typemap` (default: false, **requires** `enable-types`): enables output of an [indexable type](#emitter-routed-typemap), mapping paths and HTTP verbs to request and response bodies.
- `string-nominal-enums` (default: false): outputs member names as strings instead of index values for enum members declared without explicit values.
- `serializable-date-types` (default: false): outputs serializable types for typespec's dates types that match OpenApi spec. Types like `offsetDateTime`, `plainDate` and `utcDateTime` will be emitted as `string` and `unixTimestamp32` as `number`. If disabled, all these types resolve to `Date`.
- `type-mappings` (default: undefined): see [Overriding Types \& Typeguards](#overriding-types--typeguards)
- `typeguard-mappings` (default: undefined): see [Overriding Types \& Typeguards](#overriding-types--typeguards)
- `import-file-extensions` (default: false): if true, import statements get the `.ts` extension, otherwise, the file extension is omitted for import statements.

## Emitter: Types

All examples in this section use this input:

```ts
namespace Showcase {
  enum Status {
    Status1,
    Status2
  }

  /** A showcase model. */
  model Mdl {
    status: Status,
    something: string,
    someNumber: int32,
    nestedModel: {
      name: string
    }
  }

  @get
  op getModel(): {@statusCode status: 200, @body body: Mdl};

  @route("/inner")
  namespace InnerNamespace {
    scalar ID extends uint32;
    scalar Name extends string;

    model InnerNamespaceModel {
      @visibility(Lifecycle.Read)
      id: ID,
      name: Name,
      @visibility(Lifecycle.Create)
      created?: unixTimestamp32,
      parent: Mdl
    }

    @post
    op create(@body body: InnerNamespaceModel): OkResponse;

    @delete
    @route("{id}")
    op del(@path id: ID): {@statusCode status: 200, @body body: InnerNamespaceModel} | UnauthorizedResponse;
  }
}
```

Naturally, you can also split your declarations into multiple files and import them.

### Types

```ts
// Showcase.ts

export enum Status {
  Status1,
  Status2
}

/** A showcase model. */
export type Mdl = {
  status: Status,
  something: string,
  someNumber: number,
  nestedModel: {
    name: string
  }
}
```

```ts
// Showcase.InnerNamespace.ts

export type ID = number
export type Name = string
export type InnerNamespaceModel<V extends Lifecycle = Lifecycle.All> = FilterLifecycle<{
  id: ID,
  name: Name,
  created?: Date,
  parent: Showcase.Mdl
}, {
  'id': {vis: [Lifecycle.Read]},
  'created': {vis: [Lifecycle.Create]}
}, V>
```

As you can see, the output is split into files per namespace.
The defined scalars are exported as types, as are the models, while enums are exported as-is (also see [nominal enums](#nominal-enums)).
You can also see how the already-known `Mdl` is referenced by name.

If you're wondering why `InnerNamespaceModel` looks funny, check out the [lifecycle visibility](#lifecycle-visibility) section.

### Typeguards

Setting the option `enable-typeguards` to `true` will generate typeguards for all exported types.
This is the output of our example:

```ts
// Showcase.ts

export type Mdl = {
  status: Status,
  something: string,
  someNumber: number,
  nestedModel: {
    name: string
  }
}
export function isMdl(t: any): t is Mdl {return (
  t['status'] !== undefined && (true) &&
  t['something'] !== undefined && (typeof t['something'] === 'string') &&
  t['someNumber'] !== undefined && (typeof t['someNumber'] === 'number') &&
  t['nestedModel'] !== undefined && (
    t['nestedModel']['name'] !== undefined && (typeof t['nestedModel']['name'] === 'string')    
  )  
)}
```

```ts
export type ID = number
export function isID(t: any): t is ID {return (typeof t === 'number')}

export type Name = string
export function isName(t: any): t is Name {return (typeof t === 'string')}

export type InnerNamespaceModel<V extends Lifecycle = Lifecycle.All> = FilterLifecycle<{
  id: ID,
  name: Name,
  created?: Date,
  parent: Showcase.Mdl
}, {
  'id': {vis: [Lifecycle.Read]},
  'created': {vis: [Lifecycle.Create]}
}, V>
export function isInnerNamespaceModel(t: any, vis: Lifecycle = Lifecycle.All): t is InnerNamespaceModel<typeof vis> {return (
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Read].includes(vis) ? !('id' in t) : (t['id'] !== undefined && (isID(t['id'])))) &&
  t['name'] !== undefined && (isName(t['name'])) &&
  ((vis as any) !== Lifecycle.All && ![Lifecycle.Create].includes(vis) ? !('created' in t) : (t['created'] === undefined || (t['created'] instanceof Date))) &&
  t['parent'] !== undefined && (Showcase.isMdl(t['parent']))  
)}
```

Typeguards are functions you can call to ensure some variable is exactly of the type you'd expect.
As you can see, already-known typeguards are resused (similar to types). [Lifecycle visibility](#lifecycle-visibility) is respected.
Typeguards are designed to be as restrictive as possible (except extra properties, those are not checked for). If you encounter one that is not as strict as it could be, please open an issue.

### Lifecycle Visibility

As you have probably notices, some parts of our example have more complex output than others:

```ts
export type InnerNamespaceModel<V extends Lifecycle = Lifecycle.All> = FilterLifecycle<{
  id: ID,
  name: Name,
  created?: Date,
  parent: Showcase.Mdl
}, {
  'id': {vis: [Lifecycle.Read]},
  'created': {vis: [Lifecycle.Create]}
}, V>

function isInnerNamespaceModel(t: any, vis: Lifecycle = Lifecycle.All) { /* ... */ }
```

This is the Lifecycle system. In TypeSpec, you can use [lifecycle visibility](https://typespec.io/docs/language-basics/visibility/#lifecycle-visibility) to specify which parts of a model are present during creation of a resource, reading it, updating it, et cetera.

This emitter allows you to work with that.

Any type that has `@visibility` decorators *somewhere* will be "lifecycle-enabled". "Somewhere" does include nested types and extended types as well, so everything that is reference by the current type in any way.
Working with lifecycles involves use of the `Lifecycle` enum, conveniently emitted alongside your regular project output.

#### In Types

Any type that is lifecycle-enabled gets a type parameter:

```ts
type T<V extends Lifecycle = Lifecycle.All>
```

This parameter defaults to `All` (so you don't *have* to specify it), including all properties. If you access the type with `T<Lifecycle.Read>`, for example, all properties not visible on read will be excluded. This follows the normal TypeSpec behavior of *always* including all properties that do not have *any* visibility specified.

#### In Typeguards

Let's look at the typeguard signature of a lifecycle-enabled type:

```ts
isInnerNamespaceModel(t: any, vis: Lifecycle = Lifecycle.All)
```

Again, the lifecycle defaults to `All` and works similar to the type parameter. Also similarly, any typeguard that calls another typeguard which *has* lifecycle visibility, will also have it.

### Nominal Enums

In TypeSpec (and TypeScript), enums can be declared "plain" or with values:

```ts
export enum Status {
  STATUS_1,
  STATUS_2
}

export enum StatusShifted {
  STATUS_1 = 1,
  STATUS_2 = 2
}

export enum StatusText {
  STATUS_1 = 'Status 1',
  STATUS_2 = 'Status 2'
}
```

The latter 2 will be emitted just as they are defined here, but the first example (the plain one) can be configured.
By default, it is emitted as-is, but that may be undesirable. The `string-nominal-enums` config option emits enums without explicitely declared values in a way that uses the enum member names as their values:

```ts
export enum Status {
  STATUS_1 = 'STATUS_1',
  STATUS_2 = 'STATUS_2'
}
```

### Overriding Types & Typeguards

Using the configuration options `type-mappings` and `typeguard-mappings`, you can override the type(guard) resolution for specific types.
You specify a "path" of any length, ending in the **type** or **model property** to be overridden. This "path" can consist of namespaces, models and model properties:

```yml
type-mappings:
  "myModel/overriddenProperty": "number"
  "myNamespace/myModel/overriddenProperty": "string"
  "Overridden": "'stringLiteral'"
  "myNamespace/OverriddenModel": "{a: string}"
typeguard-mappings:
  "Overridden": "typeof t === 'string'"
  "myNamespace/OverriddenModel": "t['a'] !== undefined && typeof t['a'] === 'string'"
```

This example config does the following:

- any property `overriddenProperty` on any model `myModel` will resolve to `number`
- any property `overriddenProperty` on any model `myModel` that is an immediate child of `myNamespace` will resolve to `string`
- any type named `Overridden` will resolve to `'stringLiteral'`
  - its typeguard resolves to `typeof t === 'string'`
- any type named `OverriddenModel` that is an immediate child of `myNamespace` will resolve to `{a: string}`
  - its typeguard resolves to `t['a'] !== undefined && typeof t['a'] === 'string'`

You can use `t` in typeguards to access the variable currently being tested. Overridden types without overridden typeguards will default to `true` (which does not break `!== undefined` for non-optional model properties).

You *can* specified the name of a known type as the resolution target, because your specified value is emitted verbatim instead of the default resolution. *However*, there is no import resolution being performed, so if you specify the name of another type, that other type *has* to be in the same namespace so that it ends up in the same typescript file.

## Emitter: Routes

When enabled, this emitter will traverse your program to find all operations (`op`).
These are then compiled into a single, nested object:

```ts
namespace Showcase {
  enum Status {
    Status1,
    Status2
  }

  /** A showcase model. */
  model Mdl {
    status: Status,
    something: string,
    someNumber: int32,
    nestedModel: {
      name: string
    }
  }

  @get
  op getModel(): {@statusCode status: 200, @body body: Mdl};

  @route("/inner")
  namespace InnerNamespace {
    scalar ID extends uint32;
    scalar Name extends string;

    model InnerNamespaceModel {
      @visibility(Lifecycle.Read)
      id: ID,
      name: Name,
      @visibility(Lifecycle.Create)
      created?: unixTimestamp32,
      parent: Mdl
    }

    @post
    op create(@body body: InnerNamespaceModel): OkResponse;

    @delete
    @route("{id}")
    op del(@path id: ID): {@statusCode status: 200, @body body: InnerNamespaceModel} | UnauthorizedResponse;
  }
}
```

... will be transformed into:

```ts
export const routes_Showcase = {
  getModel: {
    verb: 'GET',
    path: '/',
    getUrl: (): string => `/`,
    auth: [null]
  },
  InnerNamespace: {
    create: {
      verb: 'POST',
      path: '/inner',
      getUrl: (): string => `/inner`,
      auth: [null]
    },
    del: {
      verb: 'DELETE',
      path: '/inner/{id}',
      getUrl: (params: {id: string}): string => `/inner/${params.id}`,
      auth: [null]
    }
  }
} as const;
```

The main use cases are:

- accessing URLs safely
- using the `path` property to access the [typemap](#emitter-routed-typemap)

## Emitter: Routed Typemap

When enabled, this emitter provides a single indexed type from which the request and response body types can be accessed (same input as [above](#emitter-routes)):

```ts
export type types_Showcase<V extends Lifecycle = Lifecycle.All> = {
  ['/']: {
    ['GET']: {
      request: null
      response: {status: 200, body: Showcase.Mdl}
    }
  },
  ['/inner']: {
    ['POST']: {
      request: Showcase_InnerNamespace.InnerNamespaceModel<V extends Lifecycle.All ? (Lifecycle.Create) : V>
      response: {status: 200, body: {
        statusCode: 200
      }}
    }
  },
  ['/inner/{id}']: {
    ['DELETE']: {
      request: null
      response: {status: 200, body: Showcase_InnerNamespace.InnerNamespaceModel<V extends Lifecycle.All ? (Lifecycle.Read) : V>} | {status: 401, body: {
        statusCode: 401
      }}
    }
  }
};
```

> [!TIP]
> This type is not nested.
> Each route can be accessed by using the `path` property on the corresponding entry in the `routes` object.

This automatically applies [lifecycle visibilities](#lifecycle-visibility), where applicable. The assignment which HTTP verb leads to which visibility variant follows the logic TypeSpec uses internally:

| Verb     | Lifecycles         |
| -------- | ------------------ |
| `HEAD`   | `Query`            |
| `GET`    | `Query`            |
| `POST`   | `Create`           |
| `PUT`    | `Create \| Update` |
| `PATCH`  | `Update`           |
| `DELETE` | `Delete`           |
| Return   | `Read`             |

"Return" refers to *all* operation return types.

The typemap itself has a lifecycle visibility parameter. If you access the typemap using any type parameter (except `Lifecycle.All`, which is the default), the returned type will be forced to the visibility you specified, overriding the HTTP-verb-specific selection.

```ts
// Accessing type of response body directly by knowing path and verb
type T_update1 = types_namespaceA['/typemap']['POST']['response']['body']

// Accessing type of request body by indexing Routes object
// namespace "namespaceA.typemap", op "add"
type T_update2 = types_namespaceA[typeof routes_namespaceA.typemap.add.path]['POST']['request']
// You could also use `typeof routes_namespace.testSimple.update.method` instead of 'POST'.
```

## Contributing

Thank you very much for considering investing time into this project!

For the smoothest contributing experience, please consider these guidelines:

- please use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary)
- if your contribution expands functionality, please consider drafting tests for it

You may find the following section helpful.

### Short Overview

This section roughly outlines the inner workings of the library.

- `lib.ts` defines primarily emitter options
- `emitter.ts` is the main entry point

`$onEmit` calls the actual emitters defined in `emit_*` files.
These each traverse the program, recursively collecting the objects they are interested in (emittable types, operations, ...) from the root namespaces specified by the user.

The primary resolution of types and typeguards starts in `resolve/Resolvable.ts`.
It defines an abstract class which both contains static functions to resolve types as well as inherited methods each type resolver implements and uses to recursively resolve.
Each resolvable type defines its methods in an inherited class, in `resolve/types/[type].ts`.

The primary flow of type resolution is quite simple:

- `static Resolvable.resolve` calls `static Resolvable.for`, which returns a `Resolvable` instance for the specific type (we will call this instance `rt`, for "resolvable type")
- `rt.resolve` first checks a list of all types found in the program - even if they have not been yet resolved, they will be and then will be emitted - so they should just be referenced. This returns the name and skips all further resolution, ending the process here.
- `rt.type` or `rt.typeguard` are invoked: these are defined for each type in its class. Depending on the type, these either resolve directly, ending the process here, or have other types "within" them (unions or models, for example, have this). In this case, `rt.resolveNested` is called, which finishes the recursive loop by calling `static Resolvable.resolve` on the "child" type.

Most of these methods do not return data, because they mutate an "output" object passed as a parameter. This has proven to be much more concise than passing return values up and down the chain.
Also to be considered is the `hasVisibility` flag showing up at many points. This is used to ultimately determine whether a type needs lifecycle visibility handling in any way (because if any part of it does, so does the whole thing).

### Todo

There are some things left to do, most of which I hoped to get ready for 2.0.0, however, that didn't work out.
My free time is too limited to get these things done without holding back the much needed fixes in 2.0.0 .
They will either be done when time permits or, perhaps, you might want to tackle some of this?

- [ ] additional tests (the current testing setup is by no means exhaustive)
  - [ ] `extends` on models, including `is` and spread notation
  - [ ] imports from other files; are naming collisions still possible?
  - [ ] thorough tests on imports and reuses for all emitted type kinds (model, union, enum, scalar)
- [ ] support for generics
- [ ] (with new option) typeguards referenced in / accessible from routes object
- [ ] each file could export its "child" namespaces (from their respective files) via `export * from "rootNS.someNS.subNS.ts" as subNS;`, effectively making everything accessible by simply typing `rootNS.someNS.subNS.MyType`
  - this will collide with imports from other files; these conflicts must be avoided when this option is set
  - one dedicated file as "root" exports all specified root namespaces
  - the `typemap` object can be used to generate lists of all namespaces within each namespace, using array reduction
