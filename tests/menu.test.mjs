import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const web = fs.existsSync(new URL('../public/',import.meta.url)) ? '../public/' : '../dist/';
const { createModel } = await import(web+'model.js');
const { MenuEngine } = await import(web+'engine.js');
import { exportLocale, collectCatalog } from "../tools/locale-lib.mjs";
const source = JSON.parse(
    fs.readFileSync(new URL(web+"generated/source.json", import.meta.url)),
  ),
  model = createModel(source);
const fresh = () => new MenuEngine(model);
const keys = (e, ...seq) => seq.flat().forEach((k) => e.press(k));
function group(e, n) {
  keys(e, "menu", Array(n).fill("down"), "enter");
}
test("extracted source has active five-category tree, 95 glyphs and exact icon pixel counts", () => {
  assert.equal(source.tables.stMainMenu.length, 5);
  assert.equal(Object.keys(source.fonts).length, 95);
  for (const im of Object.values(source.icons))
    assert.equal(im.pixels.length, im.w * im.h);
  assert.equal(source.tables.stFixSet[10].enter, "L3CalE");
});
test("home only MENU opens menu; main selection clamps", () => {
  const e = fresh();
  keys(e, "enter", "up", "down");
  assert.equal(e.page, "home");
  keys(e, "menu", "up");
  assert.equal(e.mainIndex, 0);
  keys(e, Array(9).fill("down"));
  assert.equal(e.mainIndex, 4);
});
test("DMX number UP increments and wraps 512 to 1, DOWN wraps 1 to 512", () => {
  const e = fresh();
  group(e, 0);
  keys(e, "enter", "down");
  assert.equal(e.edit.draft, 512);
  keys(e, "up");
  assert.equal(e.edit.draft, 1);
});
test("ENTER saves across simulated reboot; MENU cancels", () => {
  const e = fresh();
  group(e, 0);
  keys(e, "enter", "up", "enter");
  assert.equal(e.saved.address, 2);
  keys(e, "enter", "up", "menu");
  assert.equal(e.values.address, 2);
  e.reboot();
  assert.equal(e.values.address, 2);
});
test("DMX mode defaults to 26ch; enum UP moves backwards and wraps", () => {
  const e = fresh();
  group(e, 0);
  keys(e, "down", "enter", "up", "enter");
  assert.equal(e.values.mode, 0);
  keys(e, "enter", "up");
  assert.equal(e.edit.draft, 1);
});
test("entering a DMX edit switches primary even on cancel", () => {
  const e = fresh();
  e.values.primary = 0;
  e.saved.primary = 0;
  group(e, 0);
  keys(e, "enter", "menu");
  assert.equal(e.saved.primary, 1);
});
test("all 11 personality entries scroll within a six-row window", () => {
  const e = fresh();
  group(e, 1);
  keys(e, Array(10).fill("down"));
  assert.equal(e.index, 10);
  assert.equal(e.cursor, 5);
  keys(e, "down");
  assert.equal(e.index, 10);
  keys(e, Array(10).fill("up"));
  assert.equal(e.index, 0);
  assert.equal(e.cursor, 0);
});
test("all choice entries can commit; all numeric editors wrap at actual limits", () => {
  for (const [name, list] of Object.entries(model.groups))
    for (const [i, item] of list.entries()) {
      if (
        item.kind === "group" ||
        item.kind === "action" ||
        item.kind === "password" ||
        item.key === "speed"
      )
        continue;
      const e = fresh();
      e.page = "list";
      e.group = name;
      e.index = i;
      e.begin();
      if (item.kind === "choice") {
        e.press("down");
        const value = e.edit.draft;
        e.press("enter");
        assert.equal(e.values[item.key], value, item.id);
      } else {
        e.edit.draft = item.max;
        e.press("up");
        assert.equal(e.edit.draft, item.min, item.id);
        e.press("down");
        assert.equal(e.edit.draft, item.max, item.id);
      }
    }
});
test("Aria channel edit save emits request; cancellation does not", () => {
  const e = fresh();
  group(e, 1);
  keys(e, "down", "enter", "down", "enter", "up", "enter");
  assert.equal(e.values.ch24, 1);
  assert.ok(e.events.some((v) => v.detail === "AriaResend(1)"));
  const n = e.events.length;
  keys(e, "enter", "up", "menu");
  assert.equal(e.events.length, n);
  assert.equal(e.values.ch24, 1);
});
test("manual has 26/20 channels, live preview rolls back, persisted commit survives reboot", () => {
  const e = fresh();
  group(e, 3);
  assert.equal(e.entries.length, 26);
  keys(e, "enter", "up");
  assert.equal(e.values.ctrl0, 1);
  assert.equal(e.saved.ctrl0, 0);
  keys(e, "menu");
  assert.equal(e.values.ctrl0, 0);
  keys(e, "enter", "down", "enter");
  assert.equal(e.saved.ctrl0, 255);
  e.reboot();
  assert.equal(e.values.ctrl0, 255);
  e.values.mode = 0;
  e.group = "manual";
  assert.equal(e.entries.length, 20);
});
test("calibration 018 opens eight channels; returning clears password and allows re-entry", () => {
  const e = fresh();
  group(e, 1);
  keys(e, Array(10).fill("down"), "enter", Array(18).fill("up"), "enter");
  assert.equal(e.group, "calibration");
  assert.equal(e.entries.length, 8);
  keys(e, "enter", "up", "menu");
  assert.equal(e.values.adj0, 127);
  keys(e, "menu");
  assert.equal(e.group, "personality");
  assert.equal(e.values.password, 0);
  keys(e, "enter", "enter");
  assert.equal(e.page, "list");
  keys(e, "enter", Array(18).fill("up"), "enter");
  assert.equal(e.group, "calibration");
});
test("Program Speed faithfully reproduces uninitialized ParaEdit path", () => {
  const e = fresh();
  group(e, 2);
  keys(e, "enter", Array(3).fill("down"), "enter");
  assert.equal(e.values.program, 3);
  keys(e, "down", "enter", "enter");
  assert.equal(e.saved.speed, 3);
  assert.ok(e.note.startsWith("原版疑点"));
});
test("reset dialog defaults to Yes; MENU never emits reset request", () => {
  const e = fresh();
  group(e, 1);
  keys(e, Array(8).fill("down"), "enter");
  assert.equal(e.edit.draft, 0);
  keys(e, "menu");
  assert.equal(e.events.length, 0);
  keys(e, "enter", "enter");
  assert.ok(e.events.some((v) => v.detail.includes("FixtureReset")));
});
test("factory restore preserves calibration, controls and correction", () => {
  const e = fresh();
  e.values.adj0 = 99;
  e.saved.adj0 = 99;
  e.values.ctrl0 = 40;
  e.saved.ctrl0 = 40;
  e.values.correction = 0;
  e.saved.correction = 0;
  e.values.address = 100;
  group(e, 1);
  keys(e, Array(9).fill("down"), "enter", "enter");
  assert.equal(e.values.address, 1);
  assert.equal(e.values.adj0, 99);
  assert.equal(e.values.ctrl0, 40);
  assert.equal(e.values.correction, 0);
});
test("display reverse also exchanges UP/DOWN", () => {
  const e = fresh();
  group(e, 1);
  keys(e, Array(5).fill("down"), "enter", "down", "enter");
  assert.equal(e.values.flip, 1);
  keys(e, "up");
  assert.equal(e.index, 6);
});
test("30-second blackout consumes first wake key only", () => {
  const e = fresh();
  e.tick(30000);
  keys(e, "menu");
  assert.equal(e.page, "home");
  assert.equal(e.backlight, true);
  keys(e, "menu");
  assert.equal(e.page, "main");
});
test("all active callbacks exist and source mappings remain valid", () => {
  for (const entries of Object.values(model.groups))
    for (const e of entries)
      for (const f of [e.enter, e.back, e.up, e.down])
        assert.ok(source.functions[f], `${e.id} ${f}`);
});
test("locale exporter is reversible, preserves original bytes and blocks missing glyphs", {skip: !fs.existsSync(new URL('../../new source code/SourceCode/User/Menu.c',import.meta.url))}, () => {
  const raw = fs.readFileSync(
    new URL("../../new source code/SourceCode/User/Menu.c", import.meta.url),
  );
  const out = exportLocale(raw, source, {
    id: "es-test",
    strings: { Address: "Direccion" },
  });
  assert.ok(out.header.includes("Direccion"));
  assert.ok(out.report.replacements.length > 100);
  assert.ok(out.candidate.includes(Buffer.from('#include "m1_locale.h"')));
  assert.throws(
    () =>
      exportLocale(raw, source, {
        id: "zh-test",
        strings: { Address: "地址" },
      }),
    /Missing firmware glyph/,
  );
  assert.throws(
    () =>
      exportLocale(Buffer.from("changed"), source, { id: "en", strings: {} }),
    /has changed/,
  );
  assert.ok(collectCatalog(source).length > 50);
});
test('Chinese and Russian export UTF-8 bytes with the shared firmware glyphs', {skip: !fs.existsSync(new URL('../../new source code/SourceCode/User/Menu.c',import.meta.url))}, () => {
  const raw=fs.readFileSync(new URL('../../new source code/SourceCode/User/Menu.c',import.meta.url));
  const glyphs=JSON.parse(fs.readFileSync(new URL(web+'generated/menu-font.json',import.meta.url))).glyphs;
  const langs=JSON.parse(fs.readFileSync(new URL(web+'locales/overrides.json',import.meta.url))).languages;
  for(const lang of langs) {
    const out=exportLocale(raw,source,lang,glyphs);
    assert.equal(out.report.warnings.length,0);
    for(const replacement of out.report.replacements) {
      const literal=out.header.match(new RegExp(`^#define ${replacement.name} (.+)$`,'m'))[1];
      const translated=lang.strings[replacement.key];
      const decoded=literal.includes('\\') && /\\[0-7]{3}/.test(literal)
        ? Buffer.from([...literal.matchAll(/\\([0-7]{3})/g)].map(m=>parseInt(m[1],8))).toString('utf8')
        : JSON.parse(literal);
      assert.equal(decoded,translated,lang.id+' '+replacement.key);
    }
    assert.throws(()=>exportLocale(raw,source,{id:'bad',strings:{'Primary %d':'%s'}},glyphs),/format string/);
  }
});
