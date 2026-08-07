import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CopyOutlined, FileTextOutlined, SearchOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Empty, Input, List, Pagination, Segmented, Skeleton, Space, Tag, Typography, message } from "antd";

import { getAdminScript, getAdminScriptCategories, getAdminScripts, type ScriptDocumentSummary } from "../../api/admin";

const ALL_CATEGORIES = "all";
const COPY_PAGE_SIZE = 6;

type ScriptBlock = { id: string; content: string; sectionIndex: number; sectionTitle: string };
type ScriptSection = { index: number; title: string; blocks: ScriptBlock[] };

function parseScriptSections(markdown: string): ScriptSection[] {
  const headings = Array.from(markdown.matchAll(/^##\s+(.+)$/gm));
  return headings.map((heading, index) => {
    const contentStart = (heading.index ?? 0) + heading[0].length;
    const contentEnd = headings[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(contentStart, contentEnd);
    const title = heading[1].trim();
    const blocks = Array.from(content.matchAll(/```(?:\w+)?\s*\r?\n([\s\S]*?)\r?\n```/g), (match, blockIndex) => ({
      id: `${index}-${blockIndex}`,
      content: match[1].trim(),
      sectionIndex: index,
      sectionTitle: title,
    })).filter((block) => block.content);
    return { index, title, blocks };
  });
}

export function AdminScriptsPage() {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [selected, setSelected] = useState<ScriptDocumentSummary | null>(null);
  const [chapterKeyword, setChapterKeyword] = useState("");
  const [copyKeyword, setCopyKeyword] = useState("");
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [copyPage, setCopyPage] = useState(1);
  const { data: categories, isLoading: categoriesLoading } = useQuery({ queryKey: ["admin-script-categories"], queryFn: getAdminScriptCategories });
  const { data: scripts, isLoading: scriptsLoading } = useQuery({ queryKey: ["admin-scripts", category, queryKeyword], queryFn: () => getAdminScripts({ category: category === ALL_CATEGORIES ? undefined : category, keyword: queryKeyword || undefined }) });
  const { data: detail, isLoading: detailLoading } = useQuery({ queryKey: ["admin-script", selected?.id], queryFn: () => getAdminScript(selected!.id), enabled: selected !== null });
  const categoryOptions = useMemo(() => [{ label: "全部", value: ALL_CATEGORIES }, ...(categories ?? []).map((item) => ({ label: item.name, value: item.code }))], [categories]);
  const selectedCategory = categories?.find((item) => item.code === category);
  const sections = useMemo(() => detail ? parseScriptSections(detail.markdown_body) : [], [detail]);
  const visibleSections = useMemo(() => {
    const normalized = chapterKeyword.trim().toLowerCase();
    return normalized ? sections.filter((section) => section.title.toLowerCase().includes(normalized)) : sections;
  }, [chapterKeyword, sections]);
  const selectedSection = sections.find((section) => section.index === selectedChapterIndex) ?? sections[0];
  const copyBlocks = useMemo(() => {
    const normalized = copyKeyword.trim().toLowerCase();
    const source = normalized ? sections.flatMap((section) => section.blocks) : selectedSection?.blocks ?? [];
    return normalized ? source.filter((block) => block.content.toLowerCase().includes(normalized)) : source;
  }, [copyKeyword, sections, selectedSection]);
  const pagedBlocks = copyBlocks.slice((copyPage - 1) * COPY_PAGE_SIZE, copyPage * COPY_PAGE_SIZE);

  useEffect(() => {
    setSelectedChapterIndex(sections[0]?.index ?? 0);
    setChapterKeyword("");
    setCopyKeyword("");
    setCopyPage(1);
  }, [detail?.id]);

  useEffect(() => {
    setCopyPage(1);
  }, [copyKeyword, selectedChapterIndex]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success("已复制到剪贴板");
    } catch {
      message.error("浏览器未允许复制，请手动复制内容");
    }
  };

  return <section className="admin-scripts-page">
    <div className="page-heading admin-scripts-heading">
      <div><Typography.Title level={2}>话术库</Typography.Title><Typography.Text type="secondary">运营沟通、达人招新和培训资料统一维护在这里。</Typography.Text></div>
    </div>
    {categoriesLoading ? <Skeleton active /> : <>
      <Segmented className="admin-scripts-categories" value={category} options={categoryOptions} onChange={(value) => setCategory(String(value))} />
      {selectedCategory?.is_restricted && <Alert className="admin-scripts-alert" type="warning" showIcon icon={<SafetyCertificateOutlined />} message="敏感品类沟通资料" description="仅用于合法成人商品的合规运营沟通。必须事前说明品类和拍摄边界，并尊重达人拒绝意愿。" />}
      <Input.Search className="admin-scripts-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} onSearch={(value) => setQueryKeyword(value.trim())} onPressEnter={() => setQueryKeyword(keyword.trim())} allowClear placeholder="搜索标题、分类或话术内容" enterButton={<><SearchOutlined /> 搜索</>} />
      <div className="admin-scripts-count"><Typography.Text type="secondary">共 {scripts?.total ?? 0} 份资料</Typography.Text>{queryKeyword && <Tag closable onClose={() => { setKeyword(""); setQueryKeyword(""); }}>关键词：{queryKeyword}</Tag>}</div>
      {scriptsLoading ? <Skeleton active paragraph={{ rows: 7 }} /> : (scripts?.items.length ?? 0) > 0 ? <List className="admin-scripts-list" dataSource={scripts?.items} renderItem={(item) => <List.Item actions={[<Button key="view" type="link" onClick={() => setSelected(item)}>查看章节</Button>]}>
        <List.Item.Meta avatar={<FileTextOutlined className="admin-scripts-file-icon" />} title={<Space wrap><Typography.Text strong>{item.title}</Typography.Text>{item.category.is_restricted && <Tag color="orange">敏感品类</Tag>}</Space>} description={<><div>{item.category.name} · {item.section_count} 个章节 · {item.copy_block_count} 条可复制话术</div><div className="muted-text">{item.source_filename}</div></>} />
      </List.Item>} /> : <Empty description="没有匹配的话术资料" />}
    </>}
    <Drawer className="admin-scripts-drawer" title={detail?.title || "话术资料"} open={selected !== null} onClose={() => setSelected(null)} width={1120} destroyOnClose>
      {detailLoading || !detail ? <Skeleton active /> : <div className="admin-script-detail">
        <Space wrap><Tag color="cyan">{detail.category.name}</Tag>{detail.category.is_restricted && <Tag color="orange">敏感品类</Tag>}<Typography.Text type="secondary">{detail.section_count} 个章节，{detail.copy_block_count} 条话术</Typography.Text></Space>
        {detail.category.is_restricted && <Alert type="warning" showIcon message="使用前须明确告知拍摄边界并取得自愿确认" />}
        <div className="admin-script-browser">
          <aside className="admin-script-chapters">
            <div className="admin-script-chapters-heading"><Typography.Title level={4}>章节目录</Typography.Title><Typography.Text type="secondary">{sections.length} 个章节</Typography.Text></div>
            <Input allowClear value={chapterKeyword} onChange={(event) => setChapterKeyword(event.target.value)} placeholder="检索章节" aria-label="章节检索" />
            {visibleSections.length ? <List split={false} dataSource={visibleSections} renderItem={(section) => <List.Item className={section.index === selectedSection?.index ? "active" : ""}><button type="button" onClick={() => setSelectedChapterIndex(section.index)}><span>{section.index + 1}</span><strong>{section.title}</strong><small>{section.blocks.length} 条话术</small></button></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配章节" />}
          </aside>
          <section className="admin-script-copies">
            <div className="admin-script-copy-heading"><div><Typography.Title level={4}>{copyKeyword ? "话术检索结果" : selectedSection?.title || "章节内容"}</Typography.Title><Typography.Text type="secondary">{copyKeyword ? `已在全部 ${sections.length} 个章节中检索` : `第 ${(selectedSection?.index ?? 0) + 1} 章`} · 复制前请结合实际订单核对变量和承诺。</Typography.Text></div><Button icon={<CopyOutlined />} onClick={() => copy(detail.markdown_body)}>复制全文</Button></div>
            <Input.Search className="admin-script-copy-search" allowClear value={copyKeyword} onChange={(event) => setCopyKeyword(event.target.value)} placeholder="检索话术内容" aria-label="话术检索" enterButton={<><SearchOutlined /> 检索</>} />
            {pagedBlocks.length ? <List className="admin-script-copy-list" dataSource={pagedBlocks} renderItem={(block, index) => <List.Item actions={[<Button key="copy" icon={<CopyOutlined />} onClick={() => copy(block.content)}>复制</Button>]}><Typography.Text className="admin-script-copy-index">#{(copyPage - 1) * COPY_PAGE_SIZE + index + 1}</Typography.Text><div className="admin-script-copy-content">{copyKeyword && <Typography.Text type="secondary">{block.sectionTitle}</Typography.Text>}<pre>{block.content}</pre></div></List.Item>} /> : <Empty description={copyKeyword ? "没有匹配的话术" : "本章节暂无可复制话术"} />}
            {copyBlocks.length > COPY_PAGE_SIZE && <Pagination className="admin-script-pagination" current={copyPage} pageSize={COPY_PAGE_SIZE} total={copyBlocks.length} showSizeChanger={false} showQuickJumper onChange={setCopyPage} showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`} />}
          </section>
        </div>
      </div>}
    </Drawer>
  </section>;
}
