export const rgb565 = (v) =>
  [
    (((v >> 11) & 31) * 255) / 31,
    (((v >> 5) & 63) * 255) / 63,
    ((v & 31) * 255) / 31,
  ].map(Math.round);
const css = (v) => `rgb(${rgb565(v).join(",")})`;
export class DisplayRenderer {
  constructor(canvas, source) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.source = source;
    this.locale = "en";
    this.custom = {};
    this.warnings = [];
    this.icons = {};
    for (const [k, a] of Object.entries(source.icons)) {
      const c = document.createElement("canvas");
      c.width = a.w;
      c.height = a.h;
      const ctx = c.getContext("2d"),
        im = ctx.createImageData(a.w, a.h);
      a.pixels.forEach((p, i) => im.data.set([...rgb565(p), 255], i * 4));
      ctx.putImageData(im, 0, 0);
      this.icons[k] = c;
    }
  }
  name(e) {
    return this.custom[e.en.trim()] ?? e.en.trim();
  }
  textWidth(text) {
    return [...text].reduce(
      (sum, c) => {
        if (!this.source.fonts[c]) throw Error(`Missing bitmap glyph: ${c}`);
        return sum + this.source.fonts[c].advance;
      },
      0,
    );
  }
  text(text, x, y, color = "white", bg = null) {
    text = String(text);
    const ctx = this.ctx;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, this.textWidth(text), 16);
    }
    for (const char of text) {
      const g = this.source.fonts[char];
      if (g) {
        ctx.fillStyle = color;
        for (let yy = 0; yy < g.h; yy++)
          for (let xx = 0; xx < g.w; xx++) {
            const b = g.bytes[yy * Math.ceil(g.w / 2) + (xx >> 1)] ?? 0;
            const a = xx % 2 ? b & 15 : b >> 4;
            if (a) {
              ctx.globalAlpha = a / 15;
              ctx.fillRect(x + g.x + xx, y + g.y + yy, 1, 1);
            }
          }
        ctx.globalAlpha = 1;
        x += g.advance;
      } else {
        throw Error(`Missing bitmap glyph: ${char}`);
      }
    }
  }
  draw(engine, telemetry) {
    const c = this.ctx;
    this.warnings = [];
    c.save();
    c.fillStyle = "black";
    c.fillRect(0, 0, 160, 128);
    if (!engine.backlight) {
      c.restore();
      return;
    }
    if (engine.values.flip) {
      c.translate(160, 128);
      c.rotate(Math.PI);
    }
    const page = engine.page;
    if (page === "home") {
      this.text(this.custom["Stryker Max"] ?? "Stryker Max", 36, 1);
      c.font = "76px Arial";
      c.textBaseline = "top";
      c.fillStyle = "white";
      c.fillText(String(engine.values.address).padStart(3, "0"), 12, 20, 140);
      const status = engine.runMode === "dmx"
          ? engine.values.mode
            ? "26CH"
            : "20CH"
          : engine.values.primary
            ? "Secondary"
            : "Primary";
      this.text(
        this.custom[status] ?? status,
        engine.runMode === "dmx" ? 58 : 46,
        110,
      );
    } else if (page === "main") {
      const names = ["DMX", "Pers", "Prog", "Manu", "Info"],
        icons = ["DMX", "Personality", "Programs", "Manul", "Info"],
        xy = [
          [10, 7, 12, 50],
          [60, 7, 64, 50],
          [110, 7, 114, 50],
          [10, 68, 10, 112],
          [60, 68, 67, 112],
        ];
      xy.forEach(([x, y, tx, ty], i) => {
        const selected = engine.mainIndex === i;
        const im = this.icons[`MainMenu_${icons[i]}${selected ? "_R" : ""}`];
        if (im) c.drawImage(im, x, y);
        if (selected) {
          c.fillStyle = "white";
          c.fillRect(x, y + im.height, im.width, 16 + (i === 2 ? 2 : 0));
        }
        this.text(
          this.custom[names[i]] ?? names[i],
          tx,
          ty,
          selected ? "black" : "white",
        );
      });
    } else if (page === "info") {
      this.title(this.name(this.source.tables.stMainMenu[4]));
      const time = (n) => `${Math.floor(n / 60)}H${n % 60}M`;
      const vals = [
        time(engine.onMinutes),
        time(engine.totalMinutes),
        this.source.version,
        telemetry.version,
        engine.values.primary
          ? engine.values.mode
            ? "26Ch"
            : "20Ch"
          : (this.custom['Primary %d'] ?? 'Primary %d').replace('%d',engine.values.program + 1),
        String(telemetry.temperature).padStart(3, "0") + "F",
      ];
      this.source.tables.stInfo.forEach((e, i) =>
        this.row(this.name(e), vals[i], i, false),
      );
    } else {
      this.drawList(engine);
      if (page === "edit") {
        const { entry: e, draft, cursor } = engine.edit;
        if (["choice", "action"].includes(e.kind)) {
          this.title(this.name(e));
          this.clearBody();
          const opts = engine.options(e),
            raw = this.source.arrays[e.array],
            start = draft - cursor;
          opts
            .slice(start, start + 6)
            .forEach((s, i) =>
              this.row(
                this.custom[s.trim()] ?? s.trim(),
                "",
                i,
                start + i === draft,
              ),
            );
        } else {
          c.fillStyle = "blue";
          c.fillRect(20, 20, 121, 21);
          this.text(this.name(e), 21, 21);
          c.fillStyle = "white";
          c.fillRect(20, 40, 121, 61);
          c.fillStyle = "black";
          c.font = "48px Arial";
          c.textBaseline = "top";
          c.fillText(String(draft).padStart(3, "0"), 25, 42, 112);
        }
      }
    }
    c.restore();
  }
  clearBody() {
    this.ctx.fillStyle = css(0x0108);
    this.ctx.fillRect(0, 18, 160, 110);
  }
  title(text) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, 160, 18);
    this.text(text, 0, 1);
    this.clearBody();
  }
  row(label, value, index, selected) {
    const bg = css(selected ? 27469 : 0x0108),
      y = 18 + index * 18;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, y, 160, 16);
    this.text(label, 0, y);
    if (value) {
      const x = 160 - this.textWidth(String(value));
      if (this.textWidth(label) > x)
        this.warnings.push(`${label} 与参数可能重叠`);
      this.text(value, x, y, "white", bg);
    }
  }
  drawList(engine) {
    const title =
      engine.group === "aria"
        ? this.source.tables.stFixSet[1]
        : engine.group === "calibration"
          ? this.source.tables.stFixSet[10]
          : this.source.tables.stMainMenu[engine.mainIndex];
    this.title(this.name(title));
    const start = engine.index - engine.cursor;
    engine.entries.slice(start, start + 6).forEach((e, i) => {
      let value = "";
      if (e.kind === "group") value = " >";
      else if (e.kind === "action")
        value = this.custom.No ?? "No";
      else if (e.kind === "choice") {
        const raw = this.source.arrays[e.array];
        const text =
          raw[
            raw.length / 2 + engine.values[e.key]
          ] ?? "?";
        value = this.custom[text.trim()] ?? text.trim();
      } else
        value = String(engine.values[e.key]).padStart(
          e.key === "speed" || e.key === "ch24" || e.key === "ch900" ? 2 : 3,
          "0",
        );
      this.row(this.name(e), value, i, start + i === engine.index);
    });
  }
}
