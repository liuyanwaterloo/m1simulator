import { createHash } from "node:crypto";
export function collectCatalog(source) {
  const map = new Map();
  const add = (en, zh, ref) => {
    if (!en?.trim()) return;
    const key = en.trim();
    if (!map.has(key)) map.set(key, { en: key, zh: zh.trim(), references: [] });
    map.get(key).references.push(ref);
  };
  for (const [name, items] of Object.entries(source.tables))
    for (const [i, e] of items.entries())
      add(e.en, e.zh, `${name}[${i}] @ Menu.c:${e.line}`);
  for (const [name, a] of Object.entries(source.arrays)) {
    if (a.length % 2) continue;
    const n = a.length / 2;
    for (let i = 0; i < n; i++) add(a[i + n], a[i], name);
  }
  for (const s of [
    "DMX",
    "Pers",
    "Prog",
    "Manu",
    "Info",
    "Stryker Max",
    "Primary %d",
    "20Ch",
    "26Ch",
    "2.4Ghz",
    "Subgig (US)",
    "Subgig (EU)",
  ])
    add(s, s, "L1Display / literal");
  return [...map.values()].sort((a, b) => a.en.localeCompare(b.en));
}
export function exportLocale(raw, source, language, glyphs = source.fonts) {
  const actual = createHash("sha256").update(raw).digest("hex");
  if (actual !== source.hashes["User/Menu.c"])
    throw Error(
      "Menu.c has changed. Run npm run build and review source mappings before exporting.",
    );
  if (!/^[a-z][a-z0-9-]*$/.test(language.id))
    throw Error("Invalid language ID");
  const catalog = collectCatalog(source),
    allowed = new Set(catalog.map((e) => e.en));
  for (const [k, v] of Object.entries(language.strings)) {
    if (!allowed.has(k)) throw Error("Unknown translation key: " + k);
    if (typeof v !== "string" || !v.trim())
      throw Error("Empty translation: " + k);
    if (k === 'Primary %d' && ((v.match(/%./g)??[]).join('') !== '%d' || Buffer.byteLength(v.replace('%d','8'),'utf8') >= 30))
      throw Error('Invalid or oversized Primary format string');
    if ([...v].some((c) => !glyphs[c]))
      throw Error(
        `Missing firmware glyph in ${k}: ${v}. Export blocked; add and verify a firmware font first.`,
      );
  }
  // latin1 round-trip preserves the original GBK comments and Chinese string bytes exactly.
  const input = raw.toString("latin1");
  const replacements = [];
  const lines = [];
  let i = 0;
  const token =
    /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
  const candidate = input.replace(token, (match, offset) => {
    if (!match.startsWith('"')) return match;
    const content = match.slice(1, -1);
    if (!/^[\x20-\x7e]+$/.test(content) || content.includes("\\")) return match;
    const key = content.trim();
    if (!allowed.has(key)) return match;
    const name = `M1_TEXT_${String(i++).padStart(3, "0")}`;
    const translated = language.strings[key] ?? key;
    const leading = content.match(/^ */)[0],
      trailing = content.match(/ *$/)[0];
    const value = language.id === 'en' ? leading + translated + trailing : translated;
    // Octal byte escapes are independent of ARMCC's source encoding and cannot
    // consume a following hexadecimal digit, unlike unbounded C hex escapes.
    const cLiteral = /^[\x20-\x7e]*$/.test(value) ? JSON.stringify(value)
      : '"' + [...Buffer.from(value, 'utf8')].map(b => '\\' + b.toString(8).padStart(3,'0')).join('') + '"';
    lines.push(`#define ${name} ${cLiteral}`);
    replacements.push({
      name,
      key,
      original: match,
      replacement: JSON.stringify(value),
      line: input.slice(0, offset).split("\n").length,
    });
    return name;
  });
  const include = '#include "m1_locale.h"\r\n';
  const restored = candidate.replace(
    /\bM1_TEXT_\d+\b/g,
    (name) => replacements.find((r) => r.name === name).original,
  );
  if (restored !== input) throw Error("Byte-preservation check failed");
  const header = [
    "/* Generated from dist/locales/overrides.json. Do not edit. */",
    "#ifndef M1_LOCALE_H",
    "#define M1_LOCALE_H",
    `/* Compile-time language: ${language.id}; baseline mLANGUAGE remains 1. */`,
    ...lines,
    "#endif",
    "",
  ].join("\n");
  const warnings = [];
  for (const [k, v] of Object.entries(language.strings)) {
    const w = [...v].reduce((n, c) => n + glyphs[c].advance, 0);
    if (w > 160) warnings.push(`${k}: ${w}px exceeds display width`);
  }
  return {
    candidate: Buffer.concat([
      Buffer.from(include),
      Buffer.from(candidate, "latin1"),
    ]),
    header,
    report: {
      language: language.id,
      sourceSHA256: actual,
      replacements,
      translatedKeys: Object.keys(language.strings).length,
      totalKeys: catalog.length,
      warnings,
      mode: "compile-time language; not runtime selection",
      verified:
        "Reversing generated macros restores original Menu.c bytes exactly",
      notVerified: [
        "ARM build",
        "real LCD glyph rendering",
        "flash layout and bootloader",
        "on-board behavior",
      ],
    },
  };
}
