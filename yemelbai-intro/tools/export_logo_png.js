// Векторлық логотиптерді мөлдір фондағы PNG-ге экспорттайды.  node tools/export_logo_png.js
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "assets");
const jobs = [                                   // [svg, png, colour for currentColor]
  ["logo.svg", "veoseebot-logo-white.png", "#ffffff"],
  ["logo.svg", "veoseebot-logo-black.png", "#000000"],
  ["ziyo-logo.svg", "ziyo-fest-ai-logo.png", "#000000"],
  ["ziyo-logo-on-dark.svg", "ziyo-fest-ai-logo-on-dark.png", "#ffffff"],
];
(async () => {
  const width = 2400;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: width + 400, height: 3200 } });
  for (const [svgFile, png, color] of jobs) {
    const svg = fs.readFileSync(path.join(dir, svgFile), "utf8");
    await page.setContent(`<body style="margin:0;background:transparent">
      <div id="l" style="display:inline-block;padding:120px;color:${color};line-height:0">${svg.replace("<svg ", `<svg width="${width}" `)}</div></body>`);
    await (await page.$("#l")).screenshot({ path: path.join(dir, png), omitBackground: true });
    console.log("wrote", png);
  }
  await browser.close();
})();
