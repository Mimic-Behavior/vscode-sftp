import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: './src/extension.ts',
            fileName: 'extension',
            name: 'extension',
        },
        outDir: './out',
        rolldownOptions: {
            external: ['cpu-features', 'vscode'],
        },
    },
})
