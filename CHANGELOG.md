# [2.2.0](https://github.com/crowbait/typespec-typescript-emitter/compare/v2.1.0...v2.2.0) (2026-01-14)


### Features

* option to enabled/disable .ts file extensions on import statements ([c6a423e](https://github.com/crowbait/typespec-typescript-emitter/commit/c6a423e73139a35b36f8c413431f408a09dd9d89))



# [2.1.0](https://github.com/crowbait/typespec-typescript-emitter/compare/v2.0.1...v2.1.0) (2025-12-18)


### Features

* overridable types + typeguards, closes [#15](https://github.com/crowbait/typespec-typescript-emitter/issues/15) ([71a6fef](https://github.com/crowbait/typespec-typescript-emitter/commit/71a6fef82569a4d378e1ba3c4e9dd94a2e6ccc80))



## [2.0.1](https://github.com/crowbait/typespec-typescript-emitter/compare/v1.3.0...v2.0.1) (2025-11-30)



# [1.3.0](https://github.com/crowbait/typespec-typescript-emitter/compare/v2.0.0...v1.3.0) (2025-11-30)


### Bug Fixes

* `string-nominal-enums` option now works for type emission as well, related to [#11](https://github.com/crowbait/typespec-typescript-emitter/issues/11) ([046246a](https://github.com/crowbait/typespec-typescript-emitter/commit/046246a4daaf5c25e8c7e8594db431efde4b67f8))
* false warning on resolving scalars, related to [#10](https://github.com/crowbait/typespec-typescript-emitter/issues/10) ([95f9ec2](https://github.com/crowbait/typespec-typescript-emitter/commit/95f9ec2b1b214ad5997bb1c25829dc7969975f33))
* handle prev. unhandled types / typeguards (enum, enum-member, template-parameter) ([9baefd8](https://github.com/crowbait/typespec-typescript-emitter/commit/9baefd86c1532e66971a51084a330e5e94ac82f7))
* lifecycle-related imports, type parameters and typeguard signatures now omitted if type does not have visibility , related to [#14](https://github.com/crowbait/typespec-typescript-emitter/issues/14) ([32069c0](https://github.com/crowbait/typespec-typescript-emitter/commit/32069c004011365b1d82132d9a08ff965dc693e2))
* nominal-enums option should not use member names as values if an actual value exists ([6d9f870](https://github.com/crowbait/typespec-typescript-emitter/commit/6d9f870ac01680883719b6d4be4c081f4049e16c))
* special handling for intrinsic `void`, `unknown`, `never`, closes [#13](https://github.com/crowbait/typespec-typescript-emitter/issues/13) ([71595f9](https://github.com/crowbait/typespec-typescript-emitter/commit/71595f9794cb9508c8cb46694189e5e82fed9610))
* support "unknown" in typeguards ([4ea3054](https://github.com/crowbait/typespec-typescript-emitter/commit/4ea3054fa2536a5bdd3f9745a9d32fb52ff56a68))
* type order in emitted files now: enum -> model (type) -> union (type) , related to [#14](https://github.com/crowbait/typespec-typescript-emitter/issues/14) ([8eb6833](https://github.com/crowbait/typespec-typescript-emitter/commit/8eb6833b7a67458aa8777280445263a6fc41f8ee))


### Features

* (re-)integrate routes emitter ([9a0866a](https://github.com/crowbait/typespec-typescript-emitter/commit/9a0866aa5620b2e8037c84b949ff58699372296c))
* declared scalars (`scalar X extends string`) are now resolved and emitted as well ([224ac68](https://github.com/crowbait/typespec-typescript-emitter/commit/224ac68e66a3984facc45fb5fce92f5a01472a89))
* support `extends` on models ([dfb8f8b](https://github.com/crowbait/typespec-typescript-emitter/commit/dfb8f8b34752b851f4e5f12ce83a3e3120e0209a))
* visibility system ([adb28ab](https://github.com/crowbait/typespec-typescript-emitter/commit/adb28abdeb87ae99622302126633381a477c8247)), closes [#12](https://github.com/crowbait/typespec-typescript-emitter/issues/12) [#7](https://github.com/crowbait/typespec-typescript-emitter/issues/7)



