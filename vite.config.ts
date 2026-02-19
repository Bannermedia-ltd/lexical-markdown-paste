import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LexicalMarkdownPaste',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        format === 'es' ? 'index.js' : 'index.cjs',
    },
    rollupOptions: {
      external: [
        'lexical',
        '@lexical/markdown',
        '@lexical/react',
        '@lexical/react/LexicalComposerContext',
        'react',
        'react-dom',
      ],
      output: {
        globals: {
          lexical: 'Lexical',
          '@lexical/markdown': 'LexicalMarkdown',
          '@lexical/react': 'LexicalReact',
          react: 'React',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
