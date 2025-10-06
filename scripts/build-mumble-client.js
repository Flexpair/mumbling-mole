#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { promises: fsp } = require("fs");
const babel = require("@babel/core");

const rootDir = path.resolve(__dirname, "..");
const vendorDir = path.join(rootDir, "vendors", "mumble-client");
const srcDir = path.join(vendorDir, "src");
const outDir = path.join(vendorDir, "lib");
const configFile = path.join(vendorDir, ".babelrc");

async function removeOutDir() {
  await fsp.rm(outDir, { recursive: true, force: true });
}

async function ensureDirectory(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function collectSourceFiles(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function buildFile(filePath) {
  const relative = path.relative(srcDir, filePath);
  const outPath = path.join(outDir, relative);
  const result = await babel.transformFileAsync(filePath, {
    configFile,
    babelrc: false,
    sourceMaps: false,
    filename: filePath,
  });

  if (!result || typeof result.code !== "string") {
    throw new Error(`Babel transform returned no code for ${relative}`);
  }

  await ensureDirectory(path.dirname(outPath));
  await fsp.writeFile(outPath, result.code, "utf8");
}

async function main() {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Missing src directory: ${srcDir}`);
  }
  if (!fs.existsSync(configFile)) {
    throw new Error(`Missing vendor .babelrc: ${configFile}`);
  }

  await removeOutDir();
  const files = await collectSourceFiles(srcDir);
  await Promise.all(files.map(buildFile));
}

main()
  .then(() => {
    console.log("[build-mumble-client] Compiled", srcDir, "→", outDir);
  })
  .catch((error) => {
    console.error("[build-mumble-client][ERR]", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  });
