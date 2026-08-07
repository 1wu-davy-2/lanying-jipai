# T01 设计基础与样式边界

## 目标

建立统一主题令牌和可分工的 CSS 边界，不改变任何页面结构或业务行为。完成后，后续任务能分别修改认证、达人、商家、管理和官网样式，避免继续堆积在单一 `styles.css`。

## 依赖与允许文件

- 依赖：无，必须最先执行。
- 允许修改：`frontend/src/main.tsx`、`frontend/src/styles.css`。
- 允许新增：`frontend/src/theme.ts`、`frontend/src/styles/*.css`。
- 不允许修改任何页面、路由、API、测试业务断言或 Android 文件。

## 必须产出

1. `theme.ts` 导出唯一 Ant Design `ThemeConfig`，至少映射 PRD 的主色、信息色、成功色、警告色、危险色、正文色、背景、边框、圆角、字体和控件高度。
2. `styles.css` 只保留按以下顺序的 `@import`，不得重复声明页面规则：

```text
tokens.css
base.css
auth.css
workspace.css
talent-marketplace.css
talent-orders.css
talent-account.css
wallet.css
merchant.css
admin-orders.css
admin-support.css
official.css
responsive.css
```

3. 将现有 561 行样式机械迁移到最接近的模块，迁移阶段不改选择器和属性值；无法判断归属的共享规则放 `base.css` 或 `workspace.css`。
4. 在 `tokens.css` 定义 PRD 4.2-4.4 的颜色、字体、间距、圆角、阴影、侧栏、顶栏和底栏变量。
5. 在 `base.css` 增加稳定的 `body/#root`、图片、按钮焦点、`prefers-reduced-motion`、数字等宽和通用可访问隐藏类规则。
6. `main.tsx` 使用 `theme.ts`，不再内联主题对象；Provider 层级保持不变。

## 实施步骤

- [ ] 记录 `styles.css` 现有行数、所有 media query 和页面前缀，先做纯迁移。
- [ ] 运行全量前端测试和构建，证明拆分没有改变行为。
- [ ] 添加新主题令牌，并只替换全局默认值，不在本任务重做具体页面。
- [ ] 确认 CSS import 顺序稳定，移动规则没有丢失，官方页的远程资源暂不删除，留给 T11。
- [ ] 搜索 `styles.css` 和新文件，保证同一选择器没有因迁移意外复制。

## 验收

- 页面 DOM 与路由代码零变化。
- `styles.css` 只含 import；所有旧规则均能在新模块找到。
- `ConfigProvider` 使用共享主题，主色为 `#B33B5A`、圆角为 6/8px 体系。
- 360px 的基础页面不因 `body` 或 `#root` 产生水平滚动。
- `npm test`、`npm run build`、`git diff --check` 通过。

## 禁止事项

不得借拆分样式重命名所有 class、重写页面、增加 CSS-in-JS、安装格式化工具或处理构建分包警告。

## 完成反馈

使用 `../02-execution-contract.md` 第 9 节模板，明确列出每个旧样式区块迁移到哪个新文件，并反馈迁移前后规则数量。最后写：

> T01 已停止扩展，等待主审检查后再进入下一任务。
