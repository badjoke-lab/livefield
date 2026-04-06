import { defineConfig } from "vite"
import { resolve } from "node:path"

export default defineConfig({
  appType: "mpa",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        heatmap: resolve(__dirname, "heatmap/index.html"),
        dayFlow: resolve(__dirname, "day-flow/index.html"),
        battleLines: resolve(__dirname, "battle-lines/index.html"),
        
        about: resolve(__dirname, "about/index.html"),
        donate: resolve(__dirname, "donate/index.html"),
        status: resolve(__dirname, "status/index.html"),
        kick: resolve(__dirname, "kick/index.html"),
        kickAbout: resolve(__dirname, "kick/about/index.html"),
        kickStatus: resolve(__dirname, "kick/status/index.html")
      }
    }
  }
})
