import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    // UpscalerJS loads the AI model weights by URL at runtime, so they're copied to models/x2, x3 and x4 as they are.
    // model.json refers to its .bin file by name, so the files can't go through Vite's usual renaming
    viteStaticCopy({
      targets: [2, 3, 4].map(scale => ({
        src: `node_modules/@upscalerjs/esrgan-medium/models/x${scale}/*`,
        dest: `models/x${scale}`,
        rename: { stripBase: true }
      }))
    })
  ],
  build: {
    // TensorFlow.js is about 1 MB, but it's split out and only downloaded when AI upscaling is first used
    chunkSizeWarningLimit: 1200
  }
});
