import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["ts/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  noExternal: [],
  external: [/native\.cjs$/],
});
