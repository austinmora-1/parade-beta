import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const framesDir = "/tmp/parade-frames";
fs.mkdirSync(framesDir, { recursive: true });

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: "main",
  puppeteerInstance: browser,
});

// Render every 2nd frame for 20fps GIF (150 frames / 2 = 75 frames)
for (let f = 0; f < composition.durationInFrames; f += 2) {
  await renderStill({
    composition,
    serveUrl: bundled,
    output: path.join(framesDir, `frame-${String(f).padStart(4, "0")}.png`),
    frame: f,
    puppeteerInstance: browser,
    imageFormat: "png",
    transparent: true,
  });
  if (f % 20 === 0) console.log(`Rendered frame ${f}/${composition.durationInFrames}`);
}

await browser.close({ silent: false });
console.log("All frames rendered");
