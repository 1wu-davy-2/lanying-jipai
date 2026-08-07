# T11 官网组件与 Android 品牌收口

## 目标

让未接入路由的官网组件、Web favicon、Android 名称、图标与启动画面使用同一品牌系统。不得借此改变根路由、Android 容器、下载能力或强制更新流程。

## 依赖与允许文件

- 依赖：T02、T03；复用 T02 的 `AppLogo` 和本地品牌图片。
- 允许修改：`frontend/src/pages/OfficialHomePage.tsx`、对应测试、`frontend/src/styles/official.css`、`frontend/public/images/brand/*`、`frontend/public/favicon.svg`。
- Android 允许修改：`frontend/capacitor.config.ts`、`frontend/android/app/src/main/res/values/strings.xml`、`frontend/android/app/src/main/res/` 下仅与图标/启动画面相关的文件、与品牌名称直接相关的测试或说明。
- 不允许修改：`App.tsx`、任何路由、API、下载接口、包名、`webDir`、网络/HTTPS、版本检查和 `ForcedUpdateManager`。

## 官网组件规格

- 首屏 H1 必须是“蓝鹰寄拍”，价值描述放支持文案。
- 首屏使用真实寄拍创作场景的本地全宽主图或沉浸式背景；文字直接叠加，不做左右卡片式营销 Hero。
- 首屏在 390x844 和 1440x1000 都露出下一段内容提示。
- 颜色使用 PRD 莓果、翡翠和白灰系统；删除植物线稿、纸张纹理、装饰轨道、夸张拱门圆角和一组独立官网色令牌。
- 保留现有平台特色、协作流程、下载状态、FAQ、联系与三个角色入口；可重排视觉，但链接和“尚未提供”状态不变。
- Android 和小程序未就绪时继续明确“准备中”，不得创建假链接。
- 所有远程图片与纹理改成本地资源，写明来源；图片失败不导致文字不可读。
- `OfficialHomePage` 继续不接入活动路由，测试中单独渲染即可。

## Android 品牌规格

- `capacitor.config.ts` 的 `appName`、`strings.xml` 的 `app_name/title_activity_main` 统一为“蓝鹰寄拍”。
- 以现有鹰羽勾形矢量路径为唯一标记，颜色更新为品牌莓果 `#B33B5A`、信任翡翠 `#26756F`、白灰背景 `#F7F7FA`。
- 自适应图标、round icon、API 24 矢量回退、密度位图和启动画面均不得保留默认蓝色几何标记。
- 启动画面只含居中的品牌标记和白灰背景，不加文案、渐变或远程资源。
- 优先使用 XML/vector/layer-list 复用路径。若必须生成 PNG，只能使用环境已有的图像能力；禁止安装软件或下载转换工具。无法生成时明确反馈具体未完成资产，不得声称全部完成。
- 保留现有 Android 强制更新文案中的“蓝鹰寄拍”，省略号等字符编码保持正确。

## 实施步骤

- [ ] 更新官网测试，断言品牌、现有入口、FAQ、准备中状态和本地图片路径。
- [ ] 先简化官网 DOM 与 CSS，再替换本地图片；不改点击函数和下载查询。
- [ ] 统一 Web favicon 与 `AppLogo` 的轮廓和色彩。
- [ ] 统一 Android 名称、矢量、旧版图标和启动资源；逐一搜索“蓝影”和默认蓝色 `#65B5F6` 等旧资产特征。
- [ ] 在具备现有 Android 环境时运行 sync/build；不具备时只完成源码并如实反馈。

## 验收

- `rg -n '蓝影寄拍' frontend` 无结果，业务历史文档不在本任务修改范围。
- 官网代码不包含 `unsplash.com`、`transparenttextures.com` 或其他运行时第三方视觉资源。
- `/` 仍跳到 `/entry`，OfficialHomePage 仍未被接入路由。
- `appId`、包名、`webDir`、HTTPS 和更新逻辑无变化。
- 官网相关测试、全量测试和构建通过；Android 验证按环境如实报告。

## 完成反馈

使用统一模板，额外列出每个 Web/Android 品牌资产的路径、格式、尺寸/viewport、颜色和实际验证设备。最后写：

> T11 已停止扩展，等待主审检查后再进入下一任务。
