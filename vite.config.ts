import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: './src/extension.ts',
            fileName: 'extension',
            formats: ['cjs'],
        },
        outDir: './out',
        rolldownOptions: {
            external: ['cpu-features', 'vscode', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
            platform: 'node',
        },
    },
})
