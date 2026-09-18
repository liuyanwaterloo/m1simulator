import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {webRoot} from './paths.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "../new source code/SourceCode");
const decode = (b) => new TextDecoder("gb18030").decode(b);
const raw = fs.readFileSync(path.join(source, "User/Menu.c"));
const text = decode(raw);
const clean = text
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
const lineAt = (i) => text.slice(0, i).split("\n").length;
const strings = (s) => [...s.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]);
const tables = {};
for (const m of clean.matchAll(
  /stSysMenu\s+(\w+)\[[^\]]*\]\s*=\s*\{([\s\S]*?)\};/g,
)) {
  tables[m[1]] = [...m[2].matchAll(/\{([^{}]*)\}/g)].map((r) => {
    const names = strings(r[1]);
    const tokens = r[1].split(",").map((s) => s.trim());
    const index = m.index + m[0].indexOf(m[2]) + r.index;
    return {
      zh: names[0] ?? "",
      en: names[1] ?? "",
      count: tokens[2],
      enter: tokens[6],
      back: tokens[7],
      up: tokens[8],
      down: tokens[9],
      next: tokens[10],
      line: lineAt(index),
    };
  });
}
const arrays = {};
for (const m of clean.matchAll(
  /(?:c8|char)\s*\*\s*(\w+)\[[^\]]*\]\s*=\s*\{([^{}]*)\}/g,
)) {
  const ss = strings(m[2]);
  if (ss.length) arrays[m[1]] = ss;
}
const functions = {};
for (const m of clean.matchAll(
  /^(?:void|bool|u8|u16|stSysMenu|char\s*\*)\s+(\w+)\([^;]*?\)\s*\{/gm,
)) {
  let end = m.index + m[0].length,
    depth = 1;
  for (; end < clean.length && depth; end++) {
    if (clean[end] === "{") depth++;
    if (clean[end] === "}") depth--;
  }
  functions[m[1]] = {
    file: "User/Menu.c",
    line: lineAt(m.index),
    code: text.slice(m.index, end),
  };
}
const keyText = decode(fs.readFileSync(path.join(source, "User/Key.c")));
const keyClean = keyText
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
for (const m of keyClean.matchAll(/^(?:void|u8)\s+(\w+)\([^;]*?\)\s*\{/gm)) {
  let end = m.index + m[0].length,
    depth = 1;
  for (; end < keyClean.length && depth; end++) {
    if (keyClean[end] === "{") depth++;
    if (keyClean[end] === "}") depth--;
  }
  functions[m[1]] = {
    file: "User/Key.c",
    line: keyText.slice(0, m.index).split("\n").length,
    code: keyText.slice(m.index, end),
  };
}
const fonts = {};
const fontText = decode(
  fs.readFileSync(path.join(source, "Font/Helvetica16.c")),
);
for (const m of fontText.matchAll(
  /\{\s*(\d+),\s*(\d+),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*acGUI_FontHelvetica16_([A-Fa-f\d]+)\s*\}/g,
)) {
  const data = fontText.match(
    new RegExp(
      "acGUI_FontHelvetica16_" +
        m[6] +
        "\\[[^\\]]*\\]\\s*=\\s*\\{([\\s\\S]*?)\\};",
    ),
  );
  const bytes = [
    ...data[1].replace(/\/\/[^\n]*/g, "").matchAll(/0x([\da-f]+)/gi),
  ].map((x) => parseInt(x[1], 16));
  fonts[String.fromCodePoint(parseInt(m[6], 16))] = {
    w: +m[1],
    h: +m[2],
    x: +m[3],
    y: +m[4],
    advance: +m[5],
    bytes,
  };
}
const icons = {};
for (const filename of fs
  .readdirSync(path.join(source, "Icon"))
  .filter((n) => n.endsWith(".c"))) {
  const s = decode(fs.readFileSync(path.join(source, "Icon", filename)));
  const dim = s.match(/Dimensions:\s*(\d+)\s*\*\s*(\d+)/);
  const a = s.match(/unsigned char \w+\[\]\s*=\s*\{([\s\S]*?)\};/);
  if (!dim || !a) continue;
  const bytes = a[1]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  const pixels = [];
  for (let i = 0; i < bytes.length && pixels.length < +dim[1] * +dim[2]; ) {
    const n = bytes[i++];
    if (n) {
      const color = bytes[i++] | (bytes[i++] << 8);
      for (let k = 0; k < n; k++) pixels.push(color);
    } else {
      const count = bytes[i++];
      if (!count) break;
      for (let k = 0; k < count; k++)
        pixels.push(bytes[i++] | (bytes[i++] << 8));
    }
  }
  if (pixels.length !== +dim[1] * +dim[2])
    throw Error("Icon decode length " + filename);
  icons[filename.slice(0, -2)] = { w: +dim[1], h: +dim[2], pixels };
}
const hashes = {};
for (const f of [
  "User/Menu.c",
  "User/Key.c",
  "User/Memory.c",
  "User/Memory.h",
  "User/LcdDrive.h",
  "GUI/Dialog/NumEditDLG.c",
  "Font/Helvetica16.c",
])
  hashes[f] = createHash("sha256")
    .update(fs.readFileSync(path.join(source, f)))
    .digest("hex");
const mem = decode(fs.readFileSync(path.join(source, "User/Memory.c")));
const defaults = {};
for (const m of mem.matchAll(
  /^\s*(MEM_TAG_\w+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([01]),/gm,
))
  defaults[m[1]] = { value: +m[2], min: +m[3], max: +m[4], reset: !!+m[5] };
const out = {
  source: "new source code/SourceCode",
  hashes,
  tables,
  arrays,
  functions,
  defaults,
  fonts,
  icons,
  screen: { width: 160, height: 128 },
  version: "V1.02",
};
fs.mkdirSync(path.join(webRoot, "generated"), { recursive: true });
fs.writeFileSync(
  path.join(webRoot, "generated/source.json"),
  JSON.stringify(out),
);
console.log(
  `Extracted ${Object.keys(tables).length} menu tables, ${Object.keys(functions).length} functions, ${Object.keys(fonts).length} glyphs, ${Object.keys(icons).length} icons.`,
);
