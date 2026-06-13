import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 10_000;
const PART_FILE = /\.p\d+\.(js|css)$/;
const ORIGIN_PLACEHOLDER = "__VMESTE_ORIGIN__";

function rewriteImportsForBlob(code) {
  return code
    .replace(/import\s*\(\s*(["'])\.\/([^"']+)\1/g, `import($1${ORIGIN_PLACEHOLDER}/assets/$2$1`)
    .replace(/from\s*(["'])\.\/([^"']+)\1/g, `from $1${ORIGIN_PLACEHOLDER}/assets/$2$1`)
    .replace(/import\s+(["'])\.\/([^"']+)\1/g, `import $1${ORIGIN_PLACEHOLDER}/assets/$2$1`);
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
const __origin__ = typeof location !== "undefined" ? location.origin : "";
async function __fetchPart__(__part__) {
  for (let __try__ = 0; __try__ < 3; __try__ += 1) {
    const __res__ = await fetch(__origin__ + "/assets/" + __part__);
    const __text__ = await __res__.text();
    const __trim__ = __text__.trimStart();
    if (__res__.ok && __trim__ && !__trim__.startsWith("<")) {
      return __text__;
    }
    await new Promise((__r__) => setTimeout(__r__, 400 * (__try__ + 1)));
  }
  throw new Error("Failed to load chunk part: " + __part__);
}
let __code__ = "";
for (const __part__ of __parts__) {
  __code__ += await __fetchPart__(__part__);
}
__code__ = __code__.replace(/${ORIGIN_PLACEHOLDER}/g, __origin__);
const __blob__ = new Blob([__code__], { type: "text/javascript" });
const __mod__ = await import(URL.createObjectURL(__blob__));
export default __mod__.default;
${reexports}
`;
}

function splitCssFile(filePath) {
  if (PART_FILE.test(path.basename(filePath))) return;

  const css = fs.readFileSync(filePath, "utf8");
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

  fs.writeFileSync(filePath, partNames.map((name) => `@import "./${name}";`).join("\n"), "utf8");
}

function splitJsFile(filePath) {
  if (PART_FILE.test(path.basename(filePath))) return;

  const code = fs.readFileSync(filePath, "utf8");
  if (Buffer.byteLength(code, "utf8") <= MAX_BYTES) return;

  const rewritten = rewriteImportsForBlob(code);
  const exportNames = extractExportNames(rewritten);
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".js");
  const segments = splitByNewlines(rewritten, MAX_BYTES);

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
      const initialFiles = collectFiles(distDir);

      for (const filePath of initialFiles) {
        if (filePath.endsWith(".css")) splitCssFile(filePath);
      }

      for (const filePath of initialFiles) {
        if (filePath.endsWith(".js")) splitJsFile(filePath);
      }

      for (const filePath of collectFiles(distDir)) {
        if (!filePath.endsWith(".js") || !PART_FILE.test(path.basename(filePath))) continue;
        const size = Buffer.byteLength(fs.readFileSync(filePath), "utf8");
        if (size > 12_000) {
          console.warn(`[split-large-assets] warning: ${path.basename(filePath)} is ${size} bytes`);
        }
      }
    },
  };
}
