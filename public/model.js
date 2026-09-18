// Menu definitions are extracted from the supplied firmware; behavior is a host-side port.
export function createModel(source) {
  const entry = (table, index, extra = {}) => ({
    id: `${table}.${index}`,
    table,
    index,
    ...source.tables[table][index],
    ...extra,
  });
  const number = (key, min, max, tag, extra = {}) => ({
    kind: "number",
    key,
    min,
    max,
    tag,
    ...extra,
  });
  const choice = (key, array, tag) => ({ kind: "choice", key, array, tag });
  const groups = {
    dmx: [
      entry("stDmxAddrSet", 0, number("address", 1, 512, "MEM_TAG_DMXADDR")),
      entry("stDmxAddrSet", 1, choice("mode", "NameChMode", "MEM_TAG_CHMODE")),
      entry("stDmxAddrSet", 2, choice("noDmx", "NameNoDmx", "MEM_TAG_NODMX")),
    ],
    personality: [
      entry("stFixSet", 0, choice("primary", "pnPriSec", "MEM_TAG_PRI_SEC")),
      entry("stFixSet", 1, { kind: "group", group: "aria" }),
      ...["panInvert", "tiltInvert", "correction", "flip", "target"].map(
        (k, i) =>
          entry(
            "stFixSet",
            i + 2,
            choice(
              k,
              i === 2 || i === 4 ? "pnOnOff" : "pnYesNo",
              [
                "MEM_TAG_PANINVERT",
                "MEM_TAG_TILTINVERT",
                "MEM_TAG_PT_CALIBRA",
                "MEM_TAG_DISPFLIP",
                "MEM_TAG_TARGETMODE",
              ][i],
            ),
          ),
      ),
      entry(
        "stFixSet",
        7,
        number("sensitivity", 0, 100, "MEM_TAG_SENSITIVITY"),
      ),
      entry("stFixSet", 8, {
        kind: "action",
        array: "pnYesNoRev",
        action: "reset",
      }),
      entry("stFixSet", 9, {
        kind: "action",
        array: "pnYesNoRev",
        action: "factory",
      }),
      entry(
        "stFixSet",
        10,
        number("password", 0, 255, null, { kind: "password" }),
      ),
    ],
    program: [
      entry("stRunMode", 0, choice("program", "pnRunMode", "MEM_TAG_PROGRAM")),
      entry("stRunMode", 1, number("speed", 1, 10, "MEM_TAG_PROGSPEED")),
    ],
    aria: [
      entry(
        "stAriaSetting",
        0,
        choice(
          "band",
          "NameAriaFreq",
          "MEM_TAG_ARIA_SETTING+ARIA_SETTING_ARIA_FREQ",
        ),
      ),
      entry(
        "stAriaSetting",
        1,
        number("ch24", 0, 15, "MEM_TAG_ARIA_SETTING+ARIA_SETTING_CH24"),
      ),
      entry(
        "stAriaSetting",
        2,
        number("ch900", 0, 9, "MEM_TAG_ARIA_SETTING+ARIA_SETTING_CH900"),
      ),
      entry(
        "stAriaSetting",
        3,
        choice("mesh", "pnOnOff", "MEM_TAG_ARIA_SETTING+ARIA_SETTING_MESH"),
      ),
      entry(
        "stAriaSetting",
        4,
        choice(
          "bluetooth",
          "pnOnOff",
          "MEM_TAG_ARIA_SETTING+ARIA_SETTING_BLUE_EN",
        ),
      ),
    ],
    calibration: source.tables.stFactory.map((_, i) =>
      entry(
        "stFactory",
        i,
        number(`adj${i}`, 0, 255, `MEM_TAG_ADJ+${i}`, { live: true }),
      ),
    ),
  };
  const defaults = {
    address: 1,
    mode: 1,
    noDmx: 0,
    primary: 1,
    panInvert: 0,
    tiltInvert: 0,
    correction: 1,
    flip: 0,
    target: 1,
    sensitivity: 90,
    program: 0,
    speed: 5,
    password: 0,
    band: 0,
    ch24: 0,
    ch900: 0,
    mesh: 1,
    bluetooth: 1,
  };
  for (let i = 0; i < 8; i++) defaults[`adj${i}`] = i < 4 ? 127 : 255;
  for (let i = 0; i < 26; i++) defaults[`ctrl${i}`] = 0;
  for (const list of Object.values(groups))
    for (const e of list) {
      const d = source.defaults[e.tag];
      if (d) defaults[e.key] = d.value;
    }
  function manual(mode) {
    const names = source.arrays[mode ? "NameCH26" : "NameCH20"],
      n = names.length / 2;
    return Array.from({ length: n }, (_, i) =>
      entry("stManual", 0, {
        id: `manual.${mode}.${i}`,
        zh: names[i],
        en: names[i + n],
        ...number(`ctrl${i}`, 0, 255, `MEM_TAG_CRTL+${i}`, { live: true }),
      }),
    );
  }
  return {
    source,
    groups,
    defaults,
    manual,
    main: ["dmx", "personality", "program", "manual", "info"],
  };
}
