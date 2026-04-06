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
        kickStatus: resolve(__dirname, "kick/status/index.html"),
        kickHeatmap: resolve(__dirname, "kick/heatmap/index.html"),
        kickDayFlow: resolve(__dirname, "kick/day-flow/index.html"),
        kickBattleLines: resolve(__dirname, "kick/battle-lines/index.html"),
        kickDonate: resolve(__dirname, "kick/donate/index.html")
      }
    }
  }
})
