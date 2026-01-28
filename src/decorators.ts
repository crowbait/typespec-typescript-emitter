import { DecoratorContext, Operation, Program } from "@typespec/compiler";
import { AsyncOpStateKey } from "./lib.js";

/**
 * Decorator implementation for @asyncOp.
 * Marks an operation as asynchronous, which will wrap its return type in Promise<T>.
 */
export function $asyncOp(context: DecoratorContext, target: Operation): void {
  context.program.stateMap(AsyncOpStateKey).set(target, true);
}

/**
 * Checks if an operation is decorated with @asyncOp.
 * First checks the program state, then falls back to checking the decorator directly.
 */
export function isAsyncOp(program: Program, operation: Operation): boolean {
  // Check via program state (set by $asyncOp decorator implementation)
  if (program.stateMap(AsyncOpStateKey).has(operation)) {
    return true;
  }

  // Fallback: Check if decorator is present on operation
  // This works when the decorator is defined but JS implementation isn't linked
  return operation.decorators.some(
    (d) =>
      d.definition?.name === "@asyncOp" ||
      d.decorator?.name === "$asyncOp" ||
      (d as any).decorator?.name === "asyncOp",
  );
}
