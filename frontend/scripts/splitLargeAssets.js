import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 15_000;
const PART_FILE = /\.p\d+\.(js|css)$/;

function rewriteImportsToAbsolute(code) {
  return code
    .replace(/from\s*(["'])\.\/([^"']+)\1/g, 'from "/assets/$2"')
    .replace(/import\s*(["'])\.\/([^"']+)\1/g, 'import "/assets/$2"');
}

function splitByNewlines(content, maxBytes) {
  const parts = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + maxBytes, content.length);
    if (end < content.length) {
      const slice = content.slice(start, end);
      const lastNewline = slice.lastIndexOf("\n");
      if (lastNewline > 0) {
        end = start + lastNewline + 1;
      }
    }
    parts.push(content.slice(start, end));
    start = end;
  }
  return parts;
}

function extractExportNames(code) {
  const names = new Set();
  for (const match of code.matchAll(/export\s*\{\s*([^}]+)\s*\}/g)) {
    match[1].split(",").forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const alias = trimmed.split(/\s+as\s+/);
      names.add(alias[alias.length - 1].trim());
    });
  }
  for (const match of code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of code.matchAll(/export\s+class\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of code.matchAll(/export\s+const\s+(\w+)/g)) {
    names.add(match[1]);
  }
  if (/export\s+default/.test(code)) {
    names.add("default");
  }
  return [...names];
}

function buildJsLoader(partNames, exportNames) {
  const reexports = exportNames
    .filter((name) => name !== "default")
    .map((name) => `export const ${name} = __mod__.${name};`)
    .join("\n");

  return `const __parts__ = ${JSON.stringify(partNames)};
const __chunks__ = await Promise.all(__parts__.map(async (__part__) => {
  const __res__ = await fetch("/assets/" + __part__);
  if (!__res__.ok) throw new Error("Failed to load chunk part: " + __part__);
  return __res__.text();
}));
const __code__ = __chunks__.join("");
const __blob__ = new Blob([__code__], { type: "text/javascript" });
const __mod__ = await import(URL.createObjectURL(__blob__));
export default __mod__.default;
${reexports}
`;
}

function splitCssFile(filePath) {
  if (PART_FILE.test(path.basename(filePath))) return;

  let css = fs.readFileSync(filePath, "utf8");
  if (Buffer.byteLength(css, "utf8") <= MAX_BYTES) return;

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".css");
  const parts = [];
  let buffer = "";

  for (const rule of css.split(/(?=\})/)) {
    if (Buffer.byteLength(buffer + rule, "utf8") > MAX_BYTES && buffer) {
      parts.push(buffer);
      buffer = rule;
    } else {
      buffer += rule;
    }
  }
  if (buffer) parts.push(buffer);
  if (parts.length <= 1) return;

  const partNames = parts.map((part, index) => {
    const partName = `${baseName}.p${String(index).padStart(2, "0")}.css`;
    fs.writeFileSync(path.join(dir, partName), part, "utf8");
    return partName;
  });

  const importPrefix = dir.endsWith("assets") ? "./" : "/assets/";
  const wrapper = partNames
    .map((name) => {
      const href = dir.endsWith("assets") ? `./${name}` : `/assets/${name}`;
      return `@import "${href}";`;
    })
    .join("\n");
  fs.writeFileSync(filePath, wrapper, "utf8");
}

function splitJsFile(filePath) {
  if (PART_FILE.test(path.basename(filePath))) return;

  let code = fs.readFileSync(filePath, "utf8");
  code = rewriteImportsToAbsolute(code);
  const exportNames = extractExportNames(code);

  if (Buffer.byteLength(code, "utf8") <= MAX_BYTES) {
    fs.writeFileSync(filePath, code);
    return;
  }

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".js");
  const segments = splitByNewlines(code, MAX_BYTES);

  const partNames = segments.map((segment, index) => {
    const partName = `${baseName}.p${String(index).padStart(2, "0")}.js`;
    fs.writeFileSync(path.join(dir, partName), segment, "utf8");
    return partName;
  });

  fs.writeFileSync(filePath, buildJsLoader(partNames, exportNames), "utf8");
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export function splitLargeAssetsPlugin() {
  return {
    name: "split-large-assets",
    apply: "build",
    closeBundle() {
      const distDir = path.resolve("dist");
      const files = collectFiles(distDir);

      for (const filePath of files) {
        if (filePath.endsWith(".css")) splitCssFile(filePath);
      }

      for (const filePath of files) {
        if (filePath.endsWith(".js")) splitJsFile(filePath);
      }

      // Split oversized part files by merging into parent loader lists.
      let changed = true;
      while (changed) {
        changed = false;
        for (const filePath of collectFiles(distDir)) {
          if (!filePath.endsWith(".js") || !PART_FILE.test(path.basename(filePath))) continue;
          if (Buffer.byteLength(fs.readFileSync(filePath), "utf8") <= MAX_BYTES) continue;
          const dir = path.dirname(filePath);
          const baseName = path.basename(filePath).replace(/\.p\d+\.js$/, "");
          const code = fs.readFileSync(filePath, "utf8");
          const subParts = splitByNewlines(code, MAX_BYTES).map((segment, index) => {
            const existing = fs.readdirSync(dir).filter((name) => name.startsWith(baseName + ".p"));
            const nextIndex = existing.length + index;
            const partName = `${baseName}.p${String(nextIndex).padStart(2, "0")}.js`;
            fs.writeFileSync(path.join(dir, partName), segment, "utf8");
            return partName;
          });
          fs.unlinkSync(filePath);
          const loaderPath = path.join(dir, `${baseName}.js`);
          if (fs.existsSync(loaderPath)) {
            const loader = fs.readFileSync(loaderPath, "utf8");
            const match = loader.match(/const __parts__ = (\[[^\]]+\]);/);
            if (match) {
              const parts = JSON.parse(match[1].replace(/'/g, '"'));
              const oldName = path.basename(filePath);
              const idx = parts.indexOf(oldName);
              if (idx >= 0) {
                parts.splice(idx, 1, ...subParts);
                fs.writeFileSync(
                  loaderPath,
                  loader.replace(/const __parts__ = (\[[^\]]+\]);/, `const __parts__ = ${JSON.stringify(parts)};`),
                  "utf8",
                );
                changed = true;
              }
            }
          }
        }
      }
    },
  };
}
