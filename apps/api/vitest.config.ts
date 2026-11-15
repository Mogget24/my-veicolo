import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Each test file runs its own PGlite (WASM Postgres), which is memory-hungry:
    // cap parallel workers so `turbo build test typecheck` does not run out of memory.
    maxWorkers: 2,
  },
})
