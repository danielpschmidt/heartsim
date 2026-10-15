import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8098',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            // Homepage auf "/", die eigentliche App unter "/app/".
            input: {
                home: 'index.html',
                app: 'app/index.html',
            },
        },
    },
});
