import { builtinModules } from 'node:module'
import path from 'node:path'
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
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src'),
        },
    },
})
