const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const payloadDir = path.join(__dirname, "quality-payload");
const outputDir = path.join(__dirname, "..", "public", "quality-analytics");

function readParts(prefix) {
  return fs
    .readdirSync(payloadDir)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".txt"))
    .sort()
    .map((name) => fs.readFileSync(path.join(payloadDir, name), "utf8").trim())
    .join("");
}

function inflateToFile(prefix, fileName) {
  const compressed = Buffer.from(readParts(prefix), "base64");
  const output = zlib.inflateSync(compressed);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), output);
}

inflateToFile("app", "app.js");
inflateToFile("index", "index.html");
fs.writeFileSync(path.join(outputDir, ".nojekyll"), "");
console.log("Quality analytics site generated in public/quality-analytics.");
