import { createModel } from "./model.js";
import { MenuEngine } from "./engine.js";
import { DisplayRenderer } from "./render.js";
const $ = (s) => document.querySelector(s);
const source = await fetch("./generated/source.json").then((r) => {
  if (!r.ok) throw Error("Source data unavailable");
  return r.json();
});
const atlas = await fetch('./generated/menu-font.json').then(r => {
  if (!r.ok) throw Error('Shared bitmap font unavailable');
  return r.json();
});
source.fonts = atlas.glyphs;
const model = createModel(source),
  engine = new MenuEngine(model),
  renderer = new DisplayRenderer($("#lcd"), source);
const localeConfig = await fetch("./locales/overrides.json").then((r) =>
  r.json(),
);
for (const lang of localeConfig.languages) {
  if (!/^[a-z][a-z0-9-]*$/.test(lang.id) || lang.id === "en")
    throw Error("Invalid custom language ID");
  const option = document.createElement("option");
  option.value = lang.id;
  option.textContent = lang.label;
  $("#locale").append(option);
}
const telemetry = { temperature: 77, version: "----" };
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function update() {
  renderer.draw(engine, telemetry);
  $("#backlight-status").textContent = engine.backlight
    ? "当前亮屏 · 点击关闭" : "背光已关闭 · 按键唤醒";
  $("#sleep").dataset.screen = engine.backlight ? "on" : "off";
  const e = engine.edit?.entry ?? engine.current;
  const f = source.functions[engine.lastHandler];
  $("#hint").textContent = [engine.note, ...renderer.warnings].filter(Boolean).join(' · ');
  $("#page-state").textContent =
    {
      home: "地址首页",
      main: "主菜单",
      list: "菜单列表",
      edit: "参数编辑",
      info: "信息页",
    }[engine.page] + (!engine.backlight ? " · 背光关闭" : "");
  $("#breadcrumb").textContent =
    engine.page === "home"
      ? "DMX Address"
      : engine.page === "main"
        ? "MainMenu"
        : `${source.tables.stMainMenu[engine.mainIndex].en.trim()}${engine.group === "aria" ? " / AriaSettings" : engine.group === "calibration" ? " / Calibration" : ""}${engine.page === "edit" ? " / " + e.en.trim() : ""}`;
  const visible = ["list", "edit"].includes(engine.page);
  $("#mapping").innerHTML =
    `<div>入口：<code>${escape(f?.file ?? "User/Menu.c")}:${f?.line ?? 2478} · ${escape(engine.lastHandler)}</code></div>${visible ? `<div>菜单项：<code>${escape(e.id)} · Menu.c:${e.line}</code></div><div>保存位置：<code>${escape(e.tag ?? "无参数写入")}</code></div><div>ENTER / MENU：<code>${escape(e.enter)} / ${escape(e.back)}</code></div><div>UP / DOWN：<code>${escape(e.up)} / ${escape(e.down)}</code></div>` : ""}`;
  $("#source-code").textContent =
    f?.code ?? "Key.c → KeyFunction（首键唤醒 / 按键处理）";
  $("#values").innerHTML =
    `<div>DMX 地址<strong>${String(engine.values.address).padStart(3, "0")}</strong></div><div>通道模式<strong>${engine.values.mode ? 26 : 20} CH</strong></div><div>运行状态<strong>${{ dmx: "DMX", host: "Primary", manual: "Manual" }[engine.runMode] ?? engine.runMode}</strong></div>`;
  $("#events").innerHTML =
    engine.events
      .slice(0, 12)
      .map(
        (e) => `<li><span>${escape(e.type)}</span> · ${escape(e.detail)}</li>`,
      )
      .join("") || "<li>尚未修改参数。保存和硬件请求会显示在这里。</li>";
  $("#lcd").setAttribute(
    "aria-label",
    `${$("#breadcrumb").textContent}，${engine.edit ? "编辑值 " + engine.edit.draft : "当前地址 " + engine.values.address}`,
  );
}
let held = null,
  repeatTimer = null,
  longTimer = null;
function stop() {
  held = null;
  clearTimeout(repeatTimer);
  clearTimeout(longTimer);
  document
    .querySelectorAll(".pressed")
    .forEach((b) => b.classList.remove("pressed"));
}
function press(key) {
  engine.press(key);
  update();
}
function start(key, button) {
  if (held) return;
  held = key;
  button?.classList.add("pressed");
  press(key);
  if (key === "enter" && engine.page === "info")
    longTimer = setTimeout(() => {
      engine.resetTime();
      update();
    }, 5060);
  repeatTimer = setTimeout(function again() {
    if (!held) return;
    if (engine.repeat !== "none") {
      press(key);
      repeatTimer = setTimeout(again, engine.repeat === "fast" ? 20 : 160);
    }
  }, 700);
}
document.querySelectorAll("[data-key]").forEach((b) => {
  b.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    b.setPointerCapture(ev.pointerId);
    start(b.dataset.key, b);
  });
  b.addEventListener("pointerup", stop);
  b.addEventListener("pointercancel", stop);
  b.addEventListener("lostpointercapture", stop);
  b.addEventListener("click", (ev) => {
    if (ev.detail === 0) press(b.dataset.key);
  });
});
const keys = {
  Escape: "menu",
  ArrowUp: "up",
  ArrowDown: "down",
  Enter: "enter",
};
document.addEventListener("keydown", (ev) => {
  if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ev.target.tagName)) return;
  const key = keys[ev.key];
  if (key) {
    ev.preventDefault();
    if (!ev.repeat) start(key, document.querySelector(`[data-key=${key}]`));
  }
});
document.addEventListener("keyup", (ev) => {
  if (keys[ev.key]) stop();
});
window.addEventListener("blur", stop);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
$("#locale").addEventListener("change", (ev) => {
  renderer.locale = ev.target.value;
  renderer.custom =
    localeConfig.languages.find((l) => l.id === renderer.locale)?.strings ?? {};
  $("#locale-note").textContent =
    renderer.locale === "en"
      ? "原版英文；图标和 16px 英文字体来自项目资源。大数字与部分绘制细节近似。"
      : renderer.locale === "zh"
        ? "中文使用固定点阵，与 C 候选字库共用像素和字宽；不是旧版中文字形复刻。大数字仍近似；尚未编译、烧录验证。"
        : "俄语使用固定点阵，与 C 候选字库共用像素和字宽；短词适配 160×128 小屏。大数字仍近似；尚未编译、烧录验证。";
  update();
});
$("#reboot").onclick = () => {
  stop();
  engine.reboot();
  update();
};
$("#sleep").onclick = () => {
  stop();
  engine.backlight = false;
  engine.note = "背光已关闭；下一次按键只唤醒。";
  update();
};
$("#temperature").oninput = (ev) => {
  telemetry.temperature = Math.max(
    0,
    Math.min(999, Number(ev.target.value) || 0),
  );
  update();
};
$("#motor-version").oninput = (ev) => {
  const missing=[...ev.target.value].find(c=>!source.fonts[c]);
  if(missing) {
    $("#hint").textContent=`测试版本号含缺失字形：${missing}。请先扩充共享字库。`;
    return;
  }
  telemetry.version = ev.target.value;
  update();
};
$("#export").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          sourceHashes: source.hashes,
          locale: renderer.locale,
          sequence: engine.sequence,
          state: engine.snapshot(),
          events: engine.events,
          telemetry,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "m1-menu-test.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
setInterval(() => {
  if (!held) engine.tick(250);
  update();
}, 250);
window.m1 = { press, snapshot: () => engine.snapshot() };
const context = document.modelContext;
if (context?.registerTool) {
  for (const tool of [
    {
      name: "m1_read_menu",
      description:
        "Read the simulated display menu state. No hardware connection.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => engine.snapshot(),
    },
    {
      name: "m1_press_keys",
      description:
        "Press a sequence of simulated display-board buttons. Changes simulated settings only.",
      inputSchema: {
        type: "object",
        properties: {
          keys: {
            type: "array",
            items: { type: "string", enum: ["menu", "enter", "up", "down"] },
            maxItems: 100,
          },
        },
        required: ["keys"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (
          !input ||
          !Array.isArray(input.keys) ||
          input.keys.length > 100 ||
          input.keys.some((k) => !keysAllowed.includes(k))
        )
          throw Error("Invalid keys");
        input.keys.forEach(press);
        return engine.snapshot();
      },
    },
  ])
    Promise.resolve(context.registerTool(tool)).catch(() => {});
}
const keysAllowed = ["menu", "enter", "up", "down"];
update();
