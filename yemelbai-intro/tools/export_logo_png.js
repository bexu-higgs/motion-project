// assets/logo.svg -> мөлдір фондағы PNG (ақ және қара нұсқа).  node tools/export_logo_png.js
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const dir = path.join(__dirname, "..", "assets");
  const svg = fs.readFileSync(path.join(dir, "logo.svg"), "utf8");
  const width = 2400;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: width + 400, height: 2400 } });
  for (const [name, color] of [["white", "#ffffff"], ["black", "#000000"]]) {
    await page.setContent(`<body style="margin:0;background:transparent">
      <div id="l" style="display:inline-block;padding:120px;color:${color}">${svg.replace("<svg ", `<svg width="${width}" `)}</div></body>`);
    await (await page.$("#l")).screenshot({ path: path.join(dir, `veoseebot-logo-${name}.png`), omitBackground: true });
  }
  await browser.close();
})();
