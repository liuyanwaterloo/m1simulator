# M1 菜单模拟器：Vercel 部署

网页支持英文、中文、俄语；中文和俄文使用固定点阵，不再借用浏览器字体。网页部署无需 Keil、固件源目录、环境变量、API Key、数据库或构建步骤。MENU ◀ / ENTER ▶ 保持不变。

## 发布包内容

- `public/`：网页和菜单数据；部署后作为网站根目录。
- `vercel.json`：框架 Other、跳过安装及构建、输出目录 public。
- `README.md`：本说明，不在 public 中，不作为站点内容提供。

现在仓库也包含 `tools/` 生成工具、`tests/`、`assets/fonts/` 字体来源及许可、`firmware/shared/` 对应 C 字库。它们不在 public 中，不会作为静态网页发布。

普通网页开发：编辑 public，执行 `npm test`、`npm start`，提交 main。翻译/点阵/固件候选的再生成流程见 [firmware/README.md](firmware/README.md)。这里没有完整原始固件工程，也没有已经验证可烧录的 HEX。

Vercel 关联本仓库 main 后，新提交会触发部署；这里的更新不会改动旧的 chatgpt.site 网站。

## 必须先确认的保密事项

`public/generated/source.json` 保留了网页“源码对应”所需的原始 C 代码片段、菜单及资源。可以访问网站的人也可以下载这份文件。它不包含完整固件工程、Git 历史、Sites 凭据或账户信息。

原来的 Sites 仅本人访问限制不会跟随压缩包迁移。GitHub 仓库设为 Private 也不等于 Vercel 网站私有。若不能公开代码，在 Vercel 的 Deployment Protection 设置里检查当前套餐支持的保护方式及其覆盖范围，确认最终生产域名和静态资源也被保护后再分享链接。不要仅隐藏源码面板当作保护。图标等原项目资源的商业授权仍需另行确认。

## 方式一：Vercel CLI（不用 GitHub）

1. 解压压缩包。在包含 `vercel.json` 和 `public` 的目录打开 PowerShell。
2. 运行：

```powershell
npx vercel login
npx vercel --prod
```

首次 npx 询问是否安装 Vercel CLI 时输入 `y`，登录按提示在浏览器完成。

部署询问：

- Set up and deploy：Y。
- Scope：选择你自己的账号或团队。
- Link to existing project：第一次 N；如果已有目标项目则 Y 并选择它。
- Project name：例如 m1-menu。
- Code directory：`.`。
- Framework：如果询问，选 Other。
- Build / Install：不需要命令；输出目录 public（包内配置已指定）。

命令结束会返回部署地址。此步骤会把 public 中的数据上传到你的 Vercel 项目。不要误在完整 M1 固件根目录运行部署命令。

## 方式二：GitHub → Vercel 网页

1. 在 GitHub 新建仓库，建议 Private。
2. 上传**解压后的文件**，不要只上传 zip。仓库根目录应直接看到 `vercel.json` 和 `public/`。
3. Vercel → Add New → Project → 导入该 GitHub 仓库。
4. Framework Preset 选 Other；Root Directory 为仓库根目录；Build Command 留空；Install Command 留空；Output Directory 为 public。配置文件已提供这些设置，不要填写 `npm run build`。
5. 点击 Deploy，检查访问保护设置，然后打开生产网址。

## 验证

打开网址应看到显示屏和四个按键；MENU 图标为 ◀，ENTER 为 ▶。先按 MENU 进入五个图标的主菜单，再 ENTER 进入 DMX，测试地址修改、保存和取消。若放置 30 秒黑屏，先按一次键唤醒。刷新页面会恢复模拟默认参数，并非真机 Flash 存储。

若出现 404，检查 Root Directory 是否真的是 `vercel.json` 所在目录，以及 Output Directory 是否为 public。若菜单数据加载失败，检查 `public/generated/source.json` 是否随目录一起上传。

## 官方说明

- https://vercel.com/docs/cli/deploy
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/deployment-protection

本次只制作和本地验证发布包，未登录或部署到 Vercel，也未关闭现有 Sites 网站。
