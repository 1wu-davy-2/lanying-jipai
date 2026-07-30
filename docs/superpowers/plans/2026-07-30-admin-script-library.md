# 管理端话术库与教学培训 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理端增加“话术库”菜单，在一个页面内提供已分类的话术复制与教学话术培训，并让三份 `docs/话术` 源文档全文入库、可做完整模糊检索。

**Architecture:** 数据层以 `script_categories` + `script_documents` 保存三类菜单和三份原始 Markdown，运行期不依赖本地文档。迁移阶段以 SHA-256、一级标题数和 fenced code block 数锁定源文档版本，确保 36 个一级分组与 113 条可复制话术块没有遗漏。后端只向管理员暴露列表、详情和分页检索；前端在同一个 `/admin/scripts` 页面使用“话术库 / 教学话术培训”标签共享分类选择与全文数据。

**Tech Stack:** FastAPI、SQLAlchemy 2、Alembic、MariaDB/SQLite、React 18、TypeScript、Ant Design、TanStack Query、Vitest、Testing Library。

---

## 范围与验收

- 菜单名称为“话术库”，仅管理员工作台可见，路由为 `/admin/scripts`。
- 分类固定为“抖音运营话术”“达人招新与教学”“敏感品类话术”；所选文档按自身 H2 标题显示为二级内容分组。
- 迁移逐字存储三份 Markdown 全文，而不是只存可复制段落，因此规则、表格、示范对话、变量说明和培训内容均保留。
- 校验基线为 `12 + 11 + 13 = 36` 个 H2 分组，以及 `46 + 33 + 34 = 113` 个 fenced code 话术块。
- 搜索 `keyword` 覆盖分类名、标题、源文件名和全文正文，并按字面子串模糊匹配；空关键词只按分类筛选。
- “敏感品类话术”保留 `is_restricted=true` 和页面风险提示。当前系统没有独立运营角色，所有登录管理员可查看，不能虚构未实现的权限控制。
- 本期不做在线编辑、版本审批、操作审计、达人端展示或重新导入按钮；源文档变更应由新的内容管理需求和新迁移处理。

## 目标文件

| 文件 | 责任 |
| --- | --- |
| `backend/alembic/versions/20260803_11_script_library.py` | 创建分类/文档表并导入锁定版本的三份全文。已生成。 |
| `backend/tests/test_migrations.py` | 验证迁移表、全文、SHA-256、H2 数和 fenced code block 数。已补充。 |
| `backend/app/models/script.py` | SQLAlchemy 映射 `ScriptCategory`、`ScriptDocument`。 |
| `backend/app/models/__init__.py` | 导入话术模型，使 Alembic metadata 与运行期一致。 |
| `backend/app/schemas/script.py` | 管理端话术分类、列表、详情响应模型。 |
| `backend/app/routers/admin.py` | 增加管理员分类、文档列表、文档详情接口和字面模糊匹配。 |
| `backend/tests/test_admin_script_api.py` | 覆盖鉴权、分类、全文/分类/标题检索、分页与敏感标记。 |
| `frontend/src/api/adminScripts.ts` | 前端接口类型和请求函数。 |
| `frontend/src/pages/admin/AdminScriptsPage.tsx` | 话术库和教学培训共用的页面。 |
| `frontend/src/pages/admin/AdminScriptsPage.test.tsx` | 覆盖标签切换、搜索、复制与风险提示。 |
| `frontend/src/pages/RoleWorkspace.tsx` | 管理端导航与页面分发。 |
| `frontend/src/pages/RoleWorkspace.test.tsx` | 验证新菜单与路由分发。 |
| `frontend/src/styles.css` | 页面三栏/窄屏布局、Markdown 内容和复制按钮样式。 |
| `frontend/package.json`、`frontend/package-lock.json` | 添加 `react-markdown` 与 `remark-gfm`，按原文渲染表格、列表和代码块。 |

### Task 1: 固化数据库结构与完整源数据

**Files:**
- Create: `backend/alembic/versions/20260803_11_script_library.py`
- Modify: `backend/tests/test_migrations.py`

- [ ] **Step 1: 写入描述迁移契约的失败测试。**

```python
assert {"script_categories", "script_documents"} <= set(inspect(engine).get_table_names())
assert row["markdown_body"] == body
assert row["content_sha256"] == hashlib.sha256(body.encode("utf-8")).hexdigest()
assert row["section_count"] == len(re.findall(r"(?m)^##\s+", body))
assert row["copy_block_count"] == len(re.findall(r"(?s)```(?:\w+)?\s*\r?\n(.*?)\r?\n```", body))
```

- [ ] **Step 2: 运行测试确认当前 head 缺少新表。**

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider tests/test_migrations.py::test_script_library_migration_preserves_every_source_document -q`

Expected: FAIL，断言显示 `script_categories` 与 `script_documents` 尚不存在。`-c NUL` 仅绕开现有 `pytest.ini` 对已移除 Starlette 告警类的引用；不修改该无关配置。

- [ ] **Step 3: 创建分类与全文归档表。**

```python
op.create_table(
    "script_categories",
    sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
    sa.Column("code", sa.String(length=50), nullable=False),
    sa.Column("name", sa.String(length=100), nullable=False),
    sa.Column("description", sa.String(length=255), nullable=False, server_default=""),
    sa.Column("display_order", sa.SmallInteger(), nullable=False),
    sa.Column("is_restricted", sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.UniqueConstraint("code", name="uq_script_categories_code"),
    mysql_engine="InnoDB",
    mysql_charset="utf8mb4",
    mysql_collate="utf8mb4_unicode_ci",
)
op.create_table(
    "script_documents",
    sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
    sa.Column("category_id", SQLITE_BIGINT, sa.ForeignKey("script_categories.id"), nullable=False),
    sa.Column("source_key", sa.String(length=80), nullable=False),
    sa.Column("source_filename", sa.String(length=255), nullable=False),
    sa.Column("title", sa.String(length=150), nullable=False),
    sa.Column("markdown_body", sa.Text(), nullable=False),
    sa.Column("content_sha256", sa.String(length=64), nullable=False),
    sa.Column("section_count", sa.SmallInteger(), nullable=False),
    sa.Column("copy_block_count", sa.SmallInteger(), nullable=False),
    sa.UniqueConstraint("source_key", name="uq_script_documents_source_key"),
)
```

- [ ] **Step 4: 以锁定内容加载三份原文并插入三类菜单。**

```python
SOURCE_DOCUMENTS = (
    SourceDocument(1, 1, "douyin-ops-scripts", "douyin-ops-scripts.md", "抖音运营话术库", "dfbef0e0f9e77a49dfcd8878e0d49e6989a8bb316c69c7d89c184390faeb95d7", 12, 46),
    SourceDocument(2, 2, "recruitment-copy", "recruitment-copy.md", "达人招新物料与教学", "04e79f1eaf6ddc0dfa95cf812b639c80a6bcdeace0ea66df855499dda0257fa5", 11, 33),
    SourceDocument(3, 3, "sensitive-category-scripts", "sensitive-category-scripts.md", "敏感品类寄拍话术", "018e2b19c6ed9115c6a4bcf21ea3caea1e1e39ba8a625d6e76ebd8069966398c", 13, 34),
)

if sha256(markdown_body.encode("utf-8")).hexdigest() != source.expected_sha256:
    raise RuntimeError(f"话术源文件内容与本迁移锁定版本不一致，已停止迁移: {source.filename}")
```

Insert category codes `douyin_ops`、`recruitment_training`、`sensitive_category` with display orders `10`、`20`、`30`; the third category has `is_restricted=True`. Insert the entire `markdown_body`, hash, H2 count and fenced-code count for every source document.

- [ ] **Step 5: 运行测试确认原文不丢失。**

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider tests/test_migrations.py::test_script_library_migration_preserves_every_source_document -q`

Expected: PASS，3 行文档数据逐字等于源文件，计数分别为 `(12, 46)`、`(11, 33)`、`(13, 34)`。

- [ ] **Step 6: 提交迁移与测试。**

```bash
git add backend/alembic/versions/20260803_11_script_library.py backend/tests/test_migrations.py
git commit -m "feat: seed admin script library"
```

### Task 2: 增加话术库 ORM、响应模型和管理员 API

**Files:**
- Create: `backend/app/models/script.py`
- Create: `backend/app/schemas/script.py`
- Create: `backend/tests/test_admin_script_api.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/routers/admin.py`

- [ ] **Step 1: 写 API 失败测试，锁定管理员、分类和全部字段的模糊匹配。**

```python
def test_admin_can_search_script_documents_by_category_title_filename_and_body() -> None:
    client = TestClient(app)
    headers = admin_headers()

    categories = client.get("/api/admin/script-categories", headers=headers)
    assert [item["code"] for item in categories.json()["data"]] == [
        "douyin_ops", "recruitment_training", "sensitive_category",
    ]
    assert client.get("/api/admin/script-documents", headers=headers, params={"keyword": "首条破冰"}).json()["data"]["total"] == 1
    assert client.get("/api/admin/script-documents", headers=headers, params={"keyword": "recruitment-copy.md"}).json()["data"]["total"] == 1
    assert client.get("/api/admin/script-documents", headers=headers, params={"keyword": "敏感品类"}).json()["data"]["items"][0]["is_restricted"] is True
```

- [ ] **Step 2: 运行 API 测试确认迁移数据尚未由测试库创建。**

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider tests/test_admin_script_api.py -q`

Expected: FAIL，路由尚未注册或测试数据库尚未具有话术 ORM/种子数据。

- [ ] **Step 3: 创建与迁移同名字段的 ORM 映射，并在模型包导入。**

```python
class ScriptCategory(TimestampMixin, Base):
    __tablename__ = "script_categories"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_restricted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    documents: Mapped[list[ScriptDocument]] = relationship(back_populates="category")


class ScriptDocument(TimestampMixin, Base):
    __tablename__ = "script_documents"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("script_categories.id"), nullable=False)
    source_key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    source_filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    markdown_body: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    section_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    copy_block_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    category: Mapped[ScriptCategory] = relationship(back_populates="documents")
```

`backend/app/models/__init__.py` must export both classes so `Base.metadata` has the tables during isolated API tests.

- [ ] **Step 4: 增加稳定、最小的响应模型。**

```python
class ScriptCategoryResponse(BaseModel):
    code: str
    name: str
    description: str
    display_order: int
    is_restricted: bool


class ScriptDocumentSummaryResponse(BaseModel):
    source_key: str
    title: str
    source_filename: str
    category_code: str
    category_name: str
    is_restricted: bool
    section_count: int
    copy_block_count: int


class ScriptDocumentDetailResponse(ScriptDocumentSummaryResponse):
    markdown_body: str
    content_sha256: str
```

- [ ] **Step 5: 在 `admin.py` 实现三个只读接口与字面模糊匹配。**

```python
def escaped_like_pattern(keyword: str) -> str:
    escaped = keyword.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("/script-documents")
def list_script_documents(
    keyword: str | None = Query(default=None, max_length=100),
    category_code: str | None = Query(default=None, max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(ScriptDocument, ScriptCategory).join(ScriptCategory)
    if category_code:
        statement = statement.where(ScriptCategory.code == category_code)
    if keyword and keyword.strip():
        pattern = escaped_like_pattern(keyword)
        statement = statement.where(or_(
            ScriptCategory.name.ilike(pattern, escape="\\"),
            ScriptDocument.title.ilike(pattern, escape="\\"),
            ScriptDocument.source_filename.ilike(pattern, escape="\\"),
            ScriptDocument.markdown_body.ilike(pattern, escape="\\"),
        ))
```

Add `GET /script-categories` ordered by `display_order`, and `GET /script-documents/{source_key}` that returns the complete Markdown. Build the count statement from `statement.subquery()` before pagination. Return the existing `{ "code": 0, "message": "ok", "data": ... }` envelope.

- [ ] **Step 6: 填充 API 测试库的固定数据并运行测试。**

Create the three categories and documents from `SOURCE_DOCUMENTS` in the test setup, using the full Markdown bodies loaded from `docs/话术`. Assert: non-admin requests return `403`; `%` and `_` are escaped; category, title, filename and document body each match; pagination does not change total; the detail endpoint returns the full original Markdown.

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider tests/test_admin_script_api.py -q`

Expected: PASS.

- [ ] **Step 7: 提交后端只读接口。**

```bash
git add backend/app/models/script.py backend/app/models/__init__.py backend/app/schemas/script.py backend/app/routers/admin.py backend/tests/test_admin_script_api.py
git commit -m "feat: add admin script library API"
```

### Task 3: 增加话术库/教学培训共用页面

**Files:**
- Create: `frontend/src/api/adminScripts.ts`
- Create: `frontend/src/pages/admin/AdminScriptsPage.tsx`
- Create: `frontend/src/pages/admin/AdminScriptsPage.test.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: 添加 Markdown 渲染依赖并写页面失败测试。**

Run: `cd frontend; npm install react-markdown remark-gfm`

```tsx
it("renders the library and training tabs on one admin page", async () => {
  render(<AdminScriptsPage />);
  expect(await screen.findByRole("tab", { name: "话术库" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "教学话术培训" })).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: "教学话术培训" }));
  expect(screen.getByText("运营纪律（必须遵守）")).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认页面模块不存在。**

Run: `cd frontend; npm test -- src/pages/admin/AdminScriptsPage.test.tsx`

Expected: FAIL，模块或查询函数尚不存在。

- [ ] **Step 3: 创建前端接口模块，列表不下载全文，详情才下载全文。**

```ts
export type ScriptCategory = {
  code: string; name: string; description: string; display_order: number; is_restricted: boolean;
};

export type ScriptDocumentSummary = {
  source_key: string; title: string; source_filename: string;
  category_code: string; category_name: string; is_restricted: boolean;
  section_count: number; copy_block_count: number;
};

export type ScriptDocument = ScriptDocumentSummary & { markdown_body: string; content_sha256: string };

export const getScriptCategories = () => request<ScriptCategory[]>(client.get("/admin/script-categories"));
export const getScriptDocuments = (params: Record<string, string | number | undefined>) =>
  request<Page<ScriptDocumentSummary>>(client.get("/admin/script-documents", { params }));
export const getScriptDocument = (sourceKey: string) =>
  request<ScriptDocument>(client.get(`/admin/script-documents/${sourceKey}`));
```

- [ ] **Step 4: 在单个页面中实现分类、检索、复制、阅读两种视图。**

```tsx
<Tabs
  activeKey={view}
  onChange={(key) => setView(key as "library" | "training")}
  items={[
    { key: "library", label: "话术库", children: <ScriptCopyView document={document} /> },
    { key: "training", label: "教学话术培训", children: <ScriptTrainingView document={document} /> },
  ]}
/>
```

The left-hand `Menu` uses `ScriptCategory.code`, not array indexes. Place `Input.Search` above the document area and send only the trimmed keyword. `ScriptCopyView` renders code blocks with an icon-only copy button whose `aria-label` is `复制话术`; it copies only that code block through `navigator.clipboard.writeText`. `ScriptTrainingView` renders the same complete Markdown but uses all prose, tables, warnings and examples as training material. Both use `ReactMarkdown` with `remarkGfm`; do not duplicate, truncate or manually maintain the source text in TypeScript.

Show an Ant Design warning alert before restricted content: `敏感品类仅限成年、自愿、合规的运营沟通使用`. Keep the content width fluid, the category column fixed at 224px on desktop, and stack it above the content below 760px.

- [ ] **Step 5: 实现复制失败与加载/空态。**

```tsx
const copyBlock = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    message.success("已复制");
  } catch {
    message.error("复制失败，请手动选择文本");
  }
};
```

Use `Skeleton` while category/document queries load, `Empty` when keyword yields no document, and leave the previous selected document visible only until a different detail request starts.

- [ ] **Step 6: 运行页面测试。**

Run: `cd frontend; npm test -- src/pages/admin/AdminScriptsPage.test.tsx`

Expected: PASS. The suite must cover category selection, whole-document keyword result, switching both tabs, clipboard content equal to one code block, and the restricted alert.

- [ ] **Step 7: 提交页面与接口。**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/adminScripts.ts frontend/src/pages/admin/AdminScriptsPage.tsx frontend/src/pages/admin/AdminScriptsPage.test.tsx frontend/src/styles.css
git commit -m "feat: add admin script library page"
```

### Task 4: 注册管理端导航与路由分发

**Files:**
- Modify: `frontend/src/pages/RoleWorkspace.tsx`
- Modify: `frontend/src/pages/RoleWorkspace.test.tsx`

- [ ] **Step 1: 写失败测试验证管理员可见菜单与页面分发。**

```tsx
it("shows the script library route to administrators", () => {
  render(<MemoryRouter initialEntries={["/admin/scripts"]}><RoleWorkspace role="admin" /></MemoryRouter>);
  expect(screen.getByRole("menuitem", { name: "话术库" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "话术库" })).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认新菜单不存在。**

Run: `cd frontend; npm test -- src/pages/RoleWorkspace.test.tsx`

Expected: FAIL，找不到“话术库”。

- [ ] **Step 3: 增加导航项、页面导入与路由分支。**

```tsx
admin: [
  { key: "operations", label: "运营发单" },
  { key: "scripts", label: "话术库" },
  { key: "applications", label: "接单申请" },
  // retain the existing dashboard, users, orders, disputes and withdrawals items
],

const adminScriptsRoute = role === "admin" && currentPage === "scripts";

{adminScriptsRoute ? <AdminScriptsPage /> : adminOperationsRoute ? <AdminOperationsPage /> : /* existing branches */}
```

- [ ] **Step 4: 运行导航测试与生产构建。**

Run: `cd frontend; npm test -- src/pages/RoleWorkspace.test.tsx`

Expected: PASS.

Run: `cd frontend; npm run build`

Expected: exit code 0 with TypeScript and Vite build completing.

- [ ] **Step 5: 提交导航变更。**

```bash
git add frontend/src/pages/RoleWorkspace.tsx frontend/src/pages/RoleWorkspace.test.tsx
git commit -m "feat: add script library navigation"
```

### Task 5: 集成验证与上线前检查

**Files:**
- Modify: `docs/06-execution-plan.md`
- Modify: `progress.md`

- [ ] **Step 1: 在空 SQLite 库验证升级与数据基线。**

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider tests/test_migrations.py tests/test_admin_script_api.py -q`

Expected: PASS; no migration loses any of the three source documents.

- [ ] **Step 2: 运行后端完整测试。**

Run: `cd backend; $env:PYTHONPATH = (Get-Location).Path; pytest -c NUL -p no:cacheprovider -q`

Expected: PASS. Record separately that the default `pytest.ini` requires a later dependency/configuration fix unrelated to this feature.

- [ ] **Step 3: 运行前端测试与构建。**

Run: `cd frontend; npm test`

Expected: PASS.

Run: `cd frontend; npm run build`

Expected: exit code 0.

- [ ] **Step 4: 对 MariaDB 生成并审阅迁移 SQL。**

Run: `cd backend; $env:DATABASE_URL = 'mysql+pymysql://migration:placeholder@127.0.0.1:3306/lanying?charset=utf8mb4'; alembic upgrade head --sql`

Expected: SQL contains `CREATE TABLE script_categories`, `CREATE TABLE script_documents`, three category INSERTs and three Markdown document INSERTs. Do not use the SQLite URL for this offline command: the pre-existing batch migration `20260802_10` needs a live SQLite connection and cannot render offline SQL.

- [ ] **Step 5: 在预发库执行并核对行数和哈希。**

```sql
SELECT c.code, d.source_filename, d.section_count, d.copy_block_count, d.content_sha256
FROM script_documents AS d
JOIN script_categories AS c ON c.id = d.category_id
ORDER BY c.display_order;
```

Expected: exactly three rows, ordered `douyin_ops`, `recruitment_training`, `sensitive_category`, with counts `(12,46)`, `(11,33)`, `(13,34)` and the hashes fixed in Task 1.

- [ ] **Step 6: 更新项目执行计划并提交验证记录。**

```bash
git add docs/06-execution-plan.md progress.md
git commit -m "docs: record script library rollout"
```

## 数据迁移注意事项

`20260803_11_script_library.py` 是当前仓库的 canonical Alembic migration，并不是运行时导入器。它在迁移执行时读取 `docs/话术` 的锁定版本，验证 SHA-256 后才写入数据库；一旦文档被修改，迁移主动失败。生产执行前必须使用包含这三份文档的同一版本代码包。迁移成功后，管理端及 API 只从数据库读取，运行期不再依赖本地 Markdown。

为了变更已上线话术，不得修改这个历史迁移的哈希或源数据。新需求应新增内容版本表、审核流和新的迁移/管理 API；它们不属于本次范围。
