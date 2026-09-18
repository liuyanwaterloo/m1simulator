// Hardware-free state machine. No DOM, canvas, filesystem, network, or real flash writes.
// Each action records the original C handler; see source.json for code and line numbers.
const copy = (x) => structuredClone(x);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const loop = (v, a, b) => (v < a ? b : v > b ? a : v);
export class MenuEngine {
  constructor(model) {
    this.model = model;
    this.saved = copy(model.defaults);
    this.events = [];
    this.sequence = [];
    this.reboot();
  }
  reboot() {
    this.values = copy(this.saved);
    this.values.password = 0;
    this.page = "home";
    this.group = "dmx";
    this.mainIndex = 0;
    this.index = 0;
    this.cursor = 0;
    this.parent = null;
    this.edit = null;
    this.paraChoose = 0;
    this.paraMem = 0;
    this.repeat = "none";
    this.backlight = true;
    this.elapsed = 0;
    this.lastKey = 0;
    this.onMinutes = 0;
    this.totalMinutes = 0;
    this.runMode = this.values.primary ? "dmx" : "host";
    this.lastHandler = "DmxPageDisplay";
    this.note = "MENU 进入主菜单；首页 ENTER 无操作。";
  }
  get entries() {
    return this.group === "manual"
      ? this.model.manual(this.values.mode)
      : (this.model.groups[this.group] ?? []);
  }
  get current() {
    return this.entries[this.index];
  }
  options(e) {
    return (
      this.model.source.arrays[e.array]?.slice(
        this.model.source.arrays[e.array].length / 2,
      ) ?? []
    );
  }
  emit(type, detail) {
    this.events.unshift({ n: this.events.length + 1, type, detail });
    if (this.events.length > 300) this.events.pop();
  }
  save(e, v) {
    this.values[e.key] = v;
    if (e.tag) {
      this.saved[e.key] = v;
      this.emit("写入参数", `${e.tag} = ${v}`);
    }
  }
  goGroup(group) {
    this.group = group;
    this.page = group === "info" ? "info" : "list";
    this.index = 0;
    this.cursor = 0;
    this.repeat = "none";
    if (group === "manual") this.runMode = "manual";
    this.note = group === "info" ? "信息为测试输入；MENU 返回，长按 ENTER 约 5 秒清零计时。" : "UP / DOWN 选择菜单项，ENTER 编辑，MENU 返回。";
    this.lastHandler =
      group === "manual"
        ? "L2ManualE"
        : group === "info"
          ? "L2InfoEnter"
          : "L2_Enter";
  }
  move(step, count, wrap = false) {
    let next = this.index + step;
    this.index = wrap ? loop(next, 0, count - 1) : clamp(next, 0, count - 1);
    this.cursor = clamp(this.cursor + step, 0, Math.min(5, count - 1));
    if (wrap && this.index === 0 && step > 0) this.cursor = 0;
    if (wrap && this.index === count - 1 && step < 0)
      this.cursor = Math.min(5, count - 1);
    this.cursor = Math.min(this.cursor, this.index);
  }
  begin() {
    const e = this.current;
    if (!e) return;
    this.lastHandler = e.enter;
    if (e.kind === "group") {
      this.parent = {
        group: this.group,
        index: this.index,
        cursor: this.cursor,
      };
      this.goGroup(e.group);
      this.lastHandler = e.enter;
      return;
    }
    const v = e.kind === "action" ? 0 : this.values[e.key];
    this.edit = { entry: e, original: v, draft: v, cursor: Math.min(v, 5) };
    this.page = "edit";
    if (["choice", "action"].includes(e.kind)) {
      this.paraChoose = v;
      this.paraMem = v;
      const n = this.options(e).length;
      this.edit.cursor = n < 6 ? v : v + 5 < n ? 0 : 5 - (n - v - 1);
    }
    if (this.group === "aria") {
      this.paraChoose = v;
      this.paraMem = v;
    }
    if (["address", "password"].includes(e.key) || e.live) this.repeat = "fast";
    if (this.group === "dmx") {
      this.runMode = "dmx";
      if (this.values.primary !== 1)
        this.save({ key: "primary", tag: "MEM_TAG_PRI_SEC" }, 1);
      this.note = "原版副作用：进入 DMX 编辑即切换为 Secondary，即使随后取消。";
    } else
      this.note = e.live
        ? "实时预览数值；ENTER 保存，MENU 恢复进入前数值。"
        : "ENTER 保存；MENU 放弃本次修改。";
  }
  finish(commit) {
    const { entry: e, original } = this.edit;
    let draft = this.edit.draft;
    this.lastHandler = e.back;
    if (e.key === "speed") {
      // Faithful to L3ProgM: reads the shared ParaEdit even though numeric entry did not initialize it.
      draft = this.paraChoose;
      this.note =
        "原版疑点：Program Speed 保存读取残留 ParaEdit；模拟器保留此行为，未暗中修复。";
    }
    const old = e.key === "speed" ? this.paraMem : original;
    if (e.kind === "action") {
      if (commit && draft === 0) {
        if (e.action === "reset") {
          this.emit("硬件请求（模拟）", "FixtureReset(3)，不驱动真实电机");
        } else {
          for (const [key, val] of Object.entries(this.model.defaults)) {
            if (
              key.startsWith("adj") ||
              key.startsWith("ctrl") ||
              key === "correction" ||
              key === "password"
            )
              continue;
            this.values[key] = val;
            this.saved[key] = val;
          }
          this.runMode = this.values.primary ? "dmx" : "host";
          this.emit(
            "恢复出厂（模拟）",
            "保留校准、手动通道、P/T Correction；原函数仅重置 RstEn 项",
          );
        }
      }
    } else if (e.kind === "password") {
      if (commit && draft !== original) {
        this.values.password = draft;
        if (draft === 18) {
          this.page = "list";
          this.parent = { group: "personality", index: 10, cursor: 5 };
          this.group = "calibration";
          this.index = 0;
          this.cursor = 0;
          this.edit = null;
          this.repeat = "none";
          this.note = "校准值仅模拟，不发送至电机。";
          return;
        }
      }
    } else if (commit && draft !== old) {
      this.save(e, draft);
      if (this.group === "aria")
        this.emit("无线请求（模拟）", `AriaResend(${e.index})`);
    } else if (!commit && e.live) this.values[e.key] = original;
    if (e.key === "program") {
      if (!commit && draft !== old) this.values.program = original;
      if (commit || draft === old) {
        this.values.primary = 0;
        this.runMode = "host";
      }
    }
    if (e.key === "speed" && (commit || draft === old)) {
      this.values.primary = 0;
      this.runMode = "host";
    }
    this.page = "list";
    this.edit = null;
    this.repeat = "none";
    if (!this.note.startsWith("原版疑点"))
      this.note = commit ? "已确认。" : "已取消；未写入本次编辑参数。";
  }
  press(key) {
    if (!["menu", "enter", "up", "down"].includes(key))
      throw Error("Invalid key");
    this.sequence.push(key);
    this.lastKey = this.elapsed;
    if (!this.backlight) {
      this.backlight = true;
      this.lastHandler = "KeyFunction";
      this.note = "本次按键只唤醒背光；再按一次执行操作。";
      return;
    }
    if (this.values.flip) {
      if (key === "up") key = "down";
      else if (key === "down") key = "up";
    }
    const step = key === "up" ? -1 : 1;
    if (this.page === "home") {
      this.lastHandler =
        "KeyDispose_" +
        { menu: "Back", enter: "Enter", up: "Top", down: "Bottom" }[key];
      if (key === "menu") {
        this.page = "main";
        this.mainIndex = 0;
        this.repeat = "none";
        this.lastHandler = "MenuPageDisplay";
        this.note =
          "UP / DOWN 选择图标，ENTER 进入，MENU 返回地址页；首尾不循环。";
      }
      return;
    }
    if (this.page === "main") {
      if (key === "menu") {
        this.page = "home";
        this.repeat = "none";
        this.lastHandler = "DmxPageDisplay";
      } else if (key === "enter") this.goGroup(this.model.main[this.mainIndex]);
      else {
        this.mainIndex = clamp(this.mainIndex + step, 0, 4);
        this.repeat = "slow";
        this.lastHandler = key === "up" ? "L1_Top" : "L1_Bottom";
      }
      return;
    }
    if (this.page === "info") {
      if (key === "menu") {
        this.page = "main";
        this.lastHandler = "L2_Mode";
      }
      return;
    }
    if (this.page === "list") {
      if (key === "menu") {
        if (this.parent) {
          const previous = this.group,
            p = this.parent;
          if (previous === "calibration") this.values.password = 0;
          this.parent = null;
          this.group = p.group;
          this.index = p.index;
          this.cursor = p.cursor;
          this.lastHandler =
            previous === "calibration" ? "L3_Cal_Mode" : "L3AriaM";
        } else {
          if (this.group === "manual")
            this.runMode = this.values.primary ? "dmx" : "host";
          this.page = "main";
          this.lastHandler = this.group === "manual" ? "L2ManualM" : "L2_Mode";
        }
        this.repeat = "none";
      } else if (key === "enter") this.begin();
      else {
        const old = this.index;
        this.move(step, this.entries.length);
        if (old !== this.index) this.repeat = "slow";
        this.lastHandler =
          this.group === "aria"
            ? `L3Aria${key === "up" ? "T" : "B"}`
            : this.group === "calibration"
              ? `L3_Cal_${key === "up" ? "Top" : "Bottom"}`
              : this.group === "manual"
                ? `L2Manual${key === "up" ? "T" : "B"}`
                : `L2_${key === "up" ? "Top" : "Bottom"}`;
      }
      return;
    }
    if (this.page === "edit") {
      if (key === "menu" || key === "enter") {
        this.finish(key === "enter");
        return;
      }
      const e = this.edit.entry;
      this.lastHandler = key === "up" ? e.up : e.down;
      if (["choice", "action"].includes(e.kind)) {
        const n = this.options(e).length;
        this.edit.draft = loop(this.edit.draft + step, 0, n - 1);
        this.paraChoose = this.edit.draft;
        this.edit.cursor = clamp(
          this.edit.cursor + step,
          0,
          Math.min(n - 1, 5),
        );
        if (this.edit.draft === 0 && step > 0) this.edit.cursor = 0;
        if (this.edit.draft === n - 1 && step < 0)
          this.edit.cursor = Math.min(n - 1, 5);
      } else {
        this.edit.draft = loop(this.edit.draft - step, e.min, e.max);
        if (this.group === "aria" || e.key === "speed")
          this.paraChoose = this.edit.draft;
      }
      if (e.live || e.key === "program") {
        this.values[e.key] = this.edit.draft;
        this.emit("预览值", `${e.key} = ${this.edit.draft}（未保存）`);
      }
    }
  }
  tick(ms) {
    if (!Number.isFinite(ms) || ms < 0) throw Error("Invalid time");
    this.elapsed += ms;
    if (this.elapsed - this.lastKey >= 30000) this.backlight = false;
  }
  resetTime() {
    if (this.page === "info") {
      this.onMinutes = 0;
      this.totalMinutes = 0;
      this.emit(
        "计时清零（模拟）",
        "KeyValDispose → RealTimeDispose；需真机核对持久化",
      );
      this.lastHandler = "RealTimeDispose";
    }
  }
  snapshot() {
    return {
      page: this.page,
      group: this.group,
      mainIndex: this.mainIndex,
      index: this.index,
      cursor: this.cursor,
      edit: this.edit
        ? { id: this.edit.entry.id, value: this.edit.draft }
        : null,
      values: copy(this.values),
      saved: copy(this.saved),
      backlight: this.backlight,
      handler: this.lastHandler,
    };
  }
}
