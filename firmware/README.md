# 中文 / 俄语菜单：共享点阵与固件候选

网页已应用，原始硬件工程未覆盖。这里不是可烧录 HEX，也没有声称已经通过 ARM 编译或真机验证。

## 同一份数据对应在哪里

| 内容 | 网页 | 固件 |
| --- | --- | --- |
| 翻译 | public/locales/overrides.json | 导出的 m1_locale.h，逐条对应原 Menu.c 行号 |
| 字形与字宽 | public/generated/menu-font.json | shared/m1_menu_font.c / .h |
| 小字号字体选择 | public/render.js | shared/m1_font_override.h |
| 文本编码 | JavaScript Unicode 字符 | UTF-8 字节串 + GUI_UC_SetEncodeUTF8 |

`tools/build-translations.mjs` 是翻译维护入口。中文修正了原表里主从模式等混乱词条，统一同名菜单项；不是原中文文案/旧中文字模的逐字复刻。俄语是小屏短词初稿，建议懂舞台灯的俄语使用者复核。品牌、协议与单位保留。

字库包含菜单所需字符子集，不是整个中文/俄文字符集。新增词条后必须重新生成；缺字会阻止导出，网页不使用系统字体补字。原 95 个 ASCII 字模保留；新增中文/俄文来自 Noto，按固定 4 位灰度点阵生成，完整来源和许可见 FONT-NOTICES.md。

## 再生成

普通预览与 Vercel 部署不需要 Python，也不需要原始固件。仓库已带生成结果。

```sh
python -m pip install -r tools/font-requirements.txt
npm run fonts:build
npm test
npm start
```

`npm run build` 还会重新提取原始工程，需要同级目录 `../new source code/SourceCode`。生成器支持原开发目录 dist 和本仓库 public。

## 导出候选工程改动

本机保留原工程时运行：

```sh
npm run firmware:locale -- zh
npm run firmware:locale -- ru
```

每种语言输出到 `artifacts/firmware/<语言>/`，不改动原工程。新增语言头文件及行号映射也保存在仓库 `firmware/locales/zh`、`firmware/locales/ru`，完整原 C 文件不上传：

1. `Menu.c`：179 处字面量引用映射到语言宏；保持 `mLANGUAGE=1`，在原英文槽位使用所选翻译。初始化增加 UTF-8 编码。不是增加一个真机运行时语言菜单。
2. `LcdDrive.c`、`NumEditDLG.c`：原内容仅增加共享字体覆盖头文件，用于首页、菜单与数字编辑框标题。
3. `m1_locale.h`：中文/俄语以固定三位八进制 UTF-8 字节转义输出，避免编译器按 GBK 误读。英文原空格保留；翻译去除旧排版补空格，与网页字宽一致。
4. `m1_menu_font.c/.h`、`m1_font_override.h`：把 C 文件加入 Keil 工程，加入头文件搜索路径。字库是 emWin 5.22 的 `GUI_FONTTYPE_PROP_AA4_EXT` 格式；原工程 GUI.h 提供 UTF-8 API。
5. `report.json`：原 Menu.c SHA256、词条原行号、替换内容、单独列出的字体接入改动与未验证事项。

在原工程副本中替换以上三个候选 C 文件，加入字库再编译，不能只替换语言头文件。原始 GBK 中文槽位仍存在但不选择；不要把 mLANGUAGE 改成 0。整个 GUI 切换 UTF-8，对其他可能使用 GBK 的界面也必须做真机回归。

## 验证边界

- 自动检查每个 C 字模的字节和度量与网页相等；检查翻译缺字、标题宽度、列表参数重叠以及按键状态机。
- 字库位图共 19,309 字节；C 索引/字符度量表和翻译还占额外 Flash，实际占用必须看链接 MAP。
- 没有完成 ARM 编译、链接资源检查、HEX 生成、烧录或真实 LCD 验证。以上文件是可审查的接入候选，而非已经验证可运行的固件。
- 大数字仍为网页 Arial 近似，图标沿用原资源，部分绘制细节仍有差异。共享字形并不等于整屏逐像素复刻，也不保证 Canvas 与 emWin 的抗锯齿混色完全一致。
- 真机分别验证三种语言的所有菜单、数字框、翻转、掉电保存、背光唤醒、主从与通信状态；摄像头照片与网页截图对照后才能确认硬件效果。
