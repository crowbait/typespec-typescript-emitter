/**
 * This class provides a string type which can only be appended to but not overwritten.
 */
export class AppendableString {
  constructor(init?: string) {
    this._content = init ?? "";
  }

  private _content: string;

  get value(): string { return this._content }
  append(s?: string | AppendableString) { this._content += s ?? "" }

  /** Changes in place, returning the new value */
  addLine(
    str: string | AppendableString,
    tabs?: number,
    continued: "continued" | "line-end" = "line-end"
  ): this {
    this._content += `${"  ".repeat(tabs ?? 0)}${str}${continued === "continued" ? "" : "\n"}`;
    return this;
  }

  [Symbol.toPrimitive](hint: string) { 
    switch (hint) {
      case "default":
      case "string":
        return this.value;

      case "boolean":
        return !!this.value;
    
      default:
        throw new TypeError(`Appendable string cannot be coerced to ${hint}`);
    }
  }

  /** Removes the last x characters */
  dropLast(n: number = 1): this {
    this._content = this._content.substring(0, this._content.length - n);
    return this;
  }

  clear(): this { this._content = ""; return this; }
}