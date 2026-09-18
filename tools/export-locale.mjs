import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectCatalog, exportLocale } from "./locale-lib.mjs";
import {webRoot} from './paths.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  fs.readFileSync(path.join(webRoot, "generated/source.json")),
);
const id = process.argv[2] ?? "en";
const languages = JSON.parse(
  fs.readFileSync(path.join(webRoot, "locales/overrides.json")),
).languages;
const catalog = collectCatalog(source);
if (id === "template") {
  const out = path.join(root, "artifacts/language-template.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        id: "new-language",
        label: "新语言 · 草稿",
        strings: Object.fromEntries(catalog.map((e) => [e.en, e.en])),
      },
      null,
      2,
    ),
  );
  console.log(out);
  process.exit(0);
}
const language =
  id === "en" ? { id: "en", strings: {} } : languages.find((l) => l.id === id);
if (!language)
  throw Error("Add the language to dist/locales/overrides.json first.");
const result = exportLocale(
  fs.readFileSync(
    path.resolve(root, "../new source code/SourceCode/User/Menu.c"),
  ),
  source,
  language,
  JSON.parse(fs.readFileSync(path.join(webRoot,'generated/menu-font.json'))).glyphs,
);
const out = path.join(root, "artifacts/firmware", id);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "Menu.c"), result.candidate);
// Minimal integration candidates; source files retain their original GBK bytes.
// These changes are separate from the reversible literal-only export above.
function integrate(buffer) {
  let text = buffer.toString('latin1');
  const includes = [...text.matchAll(/^#include[^\r\n]*/gm)];
  if (!includes.length) throw Error('No include insertion anchor');
  const last=includes.at(-1), pos=last.index+last[0].length;
  text=text.slice(0,pos)+'\r\n#include "m1_font_override.h"'+text.slice(pos);
  return Buffer.from(text,'latin1');
}
let menu=integrate(result.candidate).toString('latin1');
const anchor='    stMenu.pL1 = stMainMenu;';
if(menu.split(anchor).length!==2) throw Error('MenuInit anchor changed');
menu=menu.replace(anchor,'    GUI_UC_SetEncodeUTF8();\r\n'+anchor);
fs.writeFileSync(path.join(out,'Menu.c'),Buffer.from(menu,'latin1'));
for(const file of ['User/LcdDrive.c','GUI/Dialog/NumEditDLG.c']) {
  fs.writeFileSync(path.join(out,path.basename(file)),integrate(fs.readFileSync(path.resolve(root,'../new source code/SourceCode',file))));
}
for(const file of ['m1_menu_font.c','m1_menu_font.h','m1_font_override.h','font-manifest.json'])
  fs.copyFileSync(path.join(root,'firmware/shared',file),path.join(out,file));
result.report.integration = ['Menu.c: include font override; UTF-8 in MenuInit', 'LcdDrive.c and NumEditDLG.c: include font override', 'Add m1_menu_font.c to Keil project; add candidate directory to include paths'];
result.report.verified += '; font integration changes are listed separately (not byte-identical)';
fs.writeFileSync(path.join(out, "m1_locale.h"), result.header);
fs.writeFileSync(
  path.join(out, "report.json"),
  JSON.stringify(result.report, null, 2),
);
// Version-control only new language resources + mappings, not full supplied C files.
const checked=path.join(root,'firmware/locales',id);
fs.mkdirSync(checked,{recursive:true});
for(const file of ['m1_locale.h','report.json']) fs.copyFileSync(path.join(out,file),path.join(checked,file));
console.log(
  `Generated candidate only: ${out}; ${result.report.replacements.length} literal references; original firmware untouched.`,
);
