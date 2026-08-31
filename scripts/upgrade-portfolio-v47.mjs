import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const files = [
  ["scripts/.portfolio-v47-page.gz.b64", "app/teacher/portfolio/page.tsx"],
  ["scripts/.portfolio-v47-css.gz.b64", "app/teacher/portfolio/portfolio.css"],
  ["scripts/.portfolio-v47-sw.gz.b64", "public/sw.js"],
];

for (const [source, target] of files) {
  const encoded = readFileSync(source, "utf8").trim();
  writeFileSync(target, gunzipSync(Buffer.from(encoded, "base64")));
  console.log(`wrote ${target}`);
}
