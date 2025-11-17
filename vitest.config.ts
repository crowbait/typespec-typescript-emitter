import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    isolate: false, // per TypeSpec docs :contentReference[oaicite:0]{index=0}
    include: ["test/**/*.test.ts"],
    exclude: ["dist/**"]
  },
});
