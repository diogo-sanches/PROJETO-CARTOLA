import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
    proxy: {
      '/api': {
        target: 'https://api.cartola.globo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
    },
  },
});
