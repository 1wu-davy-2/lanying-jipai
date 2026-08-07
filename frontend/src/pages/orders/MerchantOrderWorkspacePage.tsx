import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Avatar, Badge, Button, Card, Col, Descriptions, Drawer, Empty, Image, Input, List, Modal, Progress, Row, Segmented, Space, Statistic, Tabs, Tag, Timeline, Typography } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, FileImageOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import {
  acceptFulfillment, getOrderWorkspace, reviewFulfillmentOwnedProduct, reviewFulfillmentSubmission, shipFulfillment, type ApplicationStatus, type FulfillmentSubmission, type OrderApplication, type OrderFulfillment,
} from "../../api/orders";
import { OrderStatusTag } from "../../components/OrderStatusTag";
import { productSourceLabels } from "../../api/orders";
import { FulfillmentMessageBoard } from "../../components/FulfillmentMessageBoard";
import { talentOrderNextAction } from "./talentOrderProgress";
import type { UserRole } from "../../types";

type WorkspaceTab = "fulfillments" | "applications" | "attention";

const applicationStatusMeta: Record<ApplicationStatus, { label: string; color: string }> = {
  PENDING: { label: "待审核", color: "gold" }, APPROVED: { label: "已分配", color: "green" }, REJECTED: { label: "未通过", color: "default" }, WAITLISTED: { label: "候补", color: "blue" }, CLOSED: { label: "已关闭", color: "default" },
};

function talentName(item: OrderFulfillment | OrderApplication) {
  return ("talent" in item ? (item.talent?.nickname || item.model?.nickname) : "applicant" in item ? item.applicant?.nickname : undefined) || `达人 #${"model_id" in item ? item.model_id : ""}`;
}

function fulfillmentTalent(item: OrderFulfillment) {
  return item.talent || item.model || null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function slotLabel(slotNo: number | null) {
  return slotNo ?? "已释放";
}

function isVideo(url: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function MediaPreview({ urls }: { urls: string[] }) {
  if (!urls.length) return <Typography.Text type="secondary">暂未提交素材</Typography.Text>;
  return <Image.PreviewGroup items={urls.filter((url) => !isVideo(url))}>
    <Space wrap size={[8, 8]}>
      {urls.map((url) => isVideo(url) ? <video key={url} src={url} controls preload="metadata" className="fulfillment-media-thumb" /> : <Image key={url} className="fulfillment-media-thumb" src={url} fallback="/placeholder-image.svg" />)}
    </Space>
  </Image.PreviewGroup>;
}

function FulfillmentCard({ item, onOpen }: { item: OrderFulfillment; onOpen: (item: OrderFulfillment) => void }) {
  const latest = item.submissions?.[0];
  const talent = fulfillmentTalent(item);
  return <Card className="fulfillment-card" size="small" bordered>
    <div className="fulfillment-card-heading">
      <Space size={10}>
        <Badge count={slotLabel(item.slot_no)} color="var(--color-trust-600)" overflowCount={99} showZero><Avatar size={42} src={talent?.avatar_url} icon={<UserOutlined />}>{talent?.nickname?.slice(0, 1)}</Avatar></Badge>
        <div><Typography.Text strong>{talentName(item)}</Typography.Text><div className="muted-text">{talent?.level || "达人"}{talent?.verify_status === "verified" ? " · 已实名" : ""}</div></div>
      </Space>
      <OrderStatusTag status={item.status} />
    </div>
    <div className="fulfillment-card-facts"><span>{productSourceLabels[item.product_source]}</span><span>下一步：{talentOrderNextAction(item.status)}</span><span>结算 ¥{item.commission_amount}</span>{latest && <span>返图版本 {latest.version}</span>}</div>
    {latest?.review_reason && <Typography.Paragraph className="fulfillment-card-feedback" type="warning">审核反馈：{latest.review_reason}</Typography.Paragraph>}
    <Button block icon={<EyeOutlined />} onClick={() => onOpen(item)}>查看达人履约详情</Button>
  </Card>;
}

function SubmissionReview({ fulfillment, submission, onRefresh }: { fulfillment: OrderFulfillment; submission: FulfillmentSubmission; onRefresh: () => Promise<void> }) {
  const { modal, message } = App.useApp();
  const [saving, setSaving] = useState(false);
  if (fulfillment.status !== "SUBMITTED" || submission.status !== "PENDING_REVIEW") return null;
  const review = (approved: boolean) => {
    let revisionReason = "请根据订单要求修改返图后重新提交";
    modal.confirm({ title: approved ? `通过 ${talentName(fulfillment)} 的返图？` : `要求 ${talentName(fulfillment)} 修改返图？`, content: approved ? "通过后将进入返货或结算流程。" : <div><Typography.Paragraph type="secondary">要求修改会保留当前版本，并允许达人重新提交。</Typography.Paragraph><Input.TextArea defaultValue={revisionReason} rows={3} maxLength={255} onChange={(event) => { revisionReason = event.target.value; }} /></div>, okText: "确认", cancelText: "取消", onOk: async () => {
      setSaving(true);
      try { await reviewFulfillmentSubmission(fulfillment.id, submission.id, { approved, reason: approved ? undefined : revisionReason.trim() || "请根据订单要求修改返图后重新提交" }); await onRefresh(); message.success(approved ? "返图审核已通过" : "已要求达人修改返图"); } catch (error) { message.error(error instanceof Error ? error.message : "审核失败"); } finally { setSaving(false); }
    } });
  };
  return <Space wrap><Button type="primary" size="small" loading={saving} onClick={() => review(true)} icon={<CheckCircleOutlined />}>通过返图</Button><Button danger size="small" loading={saving} onClick={() => review(false)}>驳回并要求修改</Button></Space>;
}

export function MerchantOrderWorkspacePage({ orderId, viewerRole = "merchant" }: { orderId: number; viewerRole?: Extract<UserRole, "merchant" | "admin"> }) {
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WorkspaceTab>("fulfillments");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [selected, setSelected] = useState<OrderFulfillment | null>(null);
  const [shipmentTarget, setShipmentTarget] = useState<OrderFulfillment | null>(null);
  const [shippingCompany, setShippingCompany] = useState("");
  const [shippingTrackingNo, setShippingTrackingNo] = useState("");
  const [shippingSaving, setShippingSaving] = useState(false);
  const [ownedReviewTarget, setOwnedReviewTarget] = useState<{ fulfillment: OrderFulfillment; approved: boolean } | null>(null);
  const [ownedReviewReason, setOwnedReviewReason] = useState("");
  const [ownedReviewSaving, setOwnedReviewSaving] = useState(false);
  const isMerchantViewer = viewerRole === "merchant";
  const { data, isLoading, isError } = useQuery({ queryKey: ["order-workspace", orderId], queryFn: () => getOrderWorkspace(orderId) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["order-workspace", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    if (selected) {
      const next = (await queryClient.fetchQuery({ queryKey: ["order-workspace", orderId], queryFn: () => getOrderWorkspace(orderId) })).fulfillments.find((item) => item.id === selected.id);
      setSelected(next || null);
    }
  };
  const fulfillments = data?.fulfillments ?? [];
  const applications = data?.applications ?? [];
  const summary = data?.summary;
  const filteredFulfillments = useMemo(() => {
    const bySlot = statusFilter === "all" ? fulfillments : fulfillments.filter((item) => item.status === statusFilter);
    return [...bySlot].sort((left, right) => (left.slot_no ?? Number.MAX_SAFE_INTEGER) - (right.slot_no ?? Number.MAX_SAFE_INTEGER));
  }, [fulfillments, statusFilter]);
  const attention = useMemo(() => fulfillments.filter((item) => ["OWNED_PRODUCT_REVIEW", "SUBMITTED", "RETURNED", "DISPUTED"].includes(item.status) || item.submissions?.some((submission) => submission.status === "PENDING_REVIEW")), [fulfillments]);
  const pendingApplications = applications.filter((item) => item.status === "PENDING");
  const assigned = summary?.approved_quantity ?? fulfillments.length;
  const total = summary?.quantity ?? data?.order.quantity ?? 1;
  const progress = Math.min(100, Math.round((assigned / Math.max(total, 1)) * 100));
  const submitOwnedReview = async () => {
    if (!ownedReviewTarget) return;
    const reason = ownedReviewReason.trim();
    if (!ownedReviewTarget.approved && !reason) {
      message.warning("请填写驳回原因");
      return;
    }
    if (ownedReviewSaving) return;
    setOwnedReviewSaving(true);
    const target = ownedReviewTarget;
    try {
      await reviewFulfillmentOwnedProduct(target.fulfillment.id, { approved: target.approved, reason: target.approved ? undefined : reason });
      await refresh();
      setOwnedReviewTarget(null);
      setOwnedReviewReason("");
      message.success(target.approved ? "同款审核已通过" : "已驳回同款申请");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "审核失败");
    } finally {
      setOwnedReviewSaving(false);
    }
  };

  if (isLoading) return <Card loading />;
  if (isError || !data) return <Card><Empty description="暂时无法加载订单工作台" /><Button onClick={() => navigate(viewerRole === "admin" ? "/admin/operations" : "/merchant/orders")}>返回订单列表</Button></Card>;

  const order = data.order;
  const drawerTalent = selected ? fulfillmentTalent(selected) : null;
  return <div className="merchant-order-workspace">
    <div className="page-heading merchant-workspace-heading"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回订单列表" onClick={() => navigate(viewerRole === "admin" ? "/admin/operations" : "/merchant/orders")} /><div><Typography.Title level={2}>{order.title}</Typography.Title><Typography.Text type="secondary">{order.order_no} · 多人履约工作台</Typography.Text></div><Tag color={summary?.recruitment_status === "FULL" ? "green" : "blue"}>{summary?.recruitment_status === "FULL" ? "名额已满" : "招募中"}</Tag></div>
    <Card className="workspace-overview-card" bordered={false}><Row gutter={[20, 18]} align="middle"><Col xs={24} md={9}><Typography.Text type="secondary">名额进度</Typography.Text><div className="workspace-progress-line"><strong>{assigned}/{total}</strong><Progress percent={progress} showInfo={false} strokeColor="var(--color-trust-600)" /></div><Typography.Text type="secondary">已分配达人 / 订单总名额 · 履约完成 {fulfillments.filter((item) => item.status === "COMPLETED").length}/{total}</Typography.Text></Col><Col xs={12} md={3}><Statistic title="待审申请" value={summary?.pending_application_count ?? pendingApplications.length} /></Col><Col xs={12} md={3}><Statistic title="待返图" value={summary?.waiting_submission_count ?? attention.filter((item) => item.status === "SUBMITTED").length} /></Col><Col xs={12} md={3}><Statistic title="待验收" value={summary?.waiting_acceptance_count ?? attention.filter((item) => item.status === "RETURNED").length} /></Col><Col xs={12} md={6}><Descriptions column={1} size="small" items={[{ key: "commission", label: "佣金预算", children: `¥${order.commission_amount} × ${total}` }, { key: "source", label: "商品规则", children: `${productSourceLabels[order.product_source]} · ${order.return_required ? "需返货" : "拍后自留"}` }]} /></Col></Row></Card>
    <Tabs activeKey={tab} onChange={(key) => setTab(key as WorkspaceTab)} items={[{ key: "fulfillments", label: `履约中 ${fulfillments.length}` }, { key: "applications", label: `申请人 ${applications.length}` }, { key: "attention", label: <Badge count={attention.length} offset={[10, 0]}>待处理</Badge> }]} />
    {tab === "fulfillments" && <><Space className="workspace-filter-bar" wrap><Segmented value={statusFilter} onChange={(value) => setStatusFilter(value as string)} options={[{ label: "全部", value: "all" }, { label: "进行中", value: "IN_PROGRESS" }, { label: "待审核", value: "SUBMITTED" }, { label: "待验收", value: "RETURNED" }, { label: "已完成", value: "COMPLETED" }]} /></Space>{filteredFulfillments.length ? <div className="fulfillment-card-grid">{filteredFulfillments.map((item) => <FulfillmentCard key={item.id} item={item} onOpen={setSelected} />)}</div> : <Empty description="暂无履约实例" />}</>}
    {tab === "applications" && <Card className="workspace-list-card"><List dataSource={applications} locale={{ emptyText: "暂无申请" }} renderItem={(item) => <List.Item actions={[item.status === "PENDING" && <Button key="review" type="link" onClick={() => message.info("请在运营端审核申请，审核结果会实时同步到这里")} >查看审核</Button>] }><List.Item.Meta avatar={<Avatar src={item.applicant?.avatar_url}>{item.applicant?.nickname?.slice(0, 1)}</Avatar>} title={<Space><span>{item.applicant?.nickname || "未知达人"}</span><Tag color={applicationStatusMeta[item.status].color}>{applicationStatusMeta[item.status].label}</Tag>{(item.fulfillment_id || item.fulfillment?.id) && <Tag color="green">已分配名额</Tag>}</Space>} description={<span>{item.applicant?.level || "达人"} · {item.applicant?.verify_status === "verified" ? "已实名" : "未实名"} · 申请于 {formatDate(item.created_at)}</span>} /><div className="workspace-application-message">{item.message || "未填写申请留言"}</div>{Boolean(item.owned_product_images?.length) && <Typography.Text type="secondary"><FileImageOutlined /> 已上传 {item.owned_product_images?.length} 张同款图</Typography.Text>}</List.Item>} /></Card>}
    {tab === "attention" && <Card className="workspace-list-card"><List dataSource={attention} locale={{ emptyText: "暂无待处理事项" }} renderItem={(item) => { const talent = fulfillmentTalent(item); return <List.Item actions={[<Button key="detail" type="primary" size="small" onClick={() => setSelected(item)}>{item.status === "DISPUTED" ? "查看争议" : "处理"}</Button>]}><List.Item.Meta avatar={<Avatar src={talent?.avatar_url}>{talent?.nickname?.slice(0, 1)}</Avatar>} title={<Space><span>名额 {slotLabel(item.slot_no)} · {talentName(item)}</span><OrderStatusTag status={item.status} /></Space>} description={item.status === "SUBMITTED" ? "达人已提交返图，等待商家审核" : item.status === "RETURNED" ? "返货已寄回，等待商家验收" : item.status === "DISPUTED" ? "该履约实例已进入管理员仲裁，当前仅可查看与沟通" : "等待商家确认同款商品"} /></List.Item>; }} /></Card>}

    <Drawer className="merchant-workspace-drawer" title={selected ? `名额 ${slotLabel(selected.slot_no)} · ${talentName(selected)} 的履约详情` : "履约详情"} width={620} open={Boolean(selected)} onClose={() => setSelected(null)} extra={selected && <OrderStatusTag status={selected.status} />}>
      {selected && <div className="fulfillment-drawer-content">
        <Card size="small" className="fulfillment-drawer-talent">
          <Space>
            <Avatar size={52} src={drawerTalent?.avatar_url} icon={<UserOutlined />}>{drawerTalent?.nickname?.slice(0, 1)}</Avatar>
            <div><Typography.Title level={4}>{talentName(selected)}</Typography.Title><Typography.Text type="secondary">{drawerTalent?.level || "达人"} · {drawerTalent?.verify_status === "verified" ? "已实名" : "未实名"}</Typography.Text></div>
          </Space>
          <Descriptions column={1} size="small" items={[
            { key: "source", label: "商品处理", children: productSourceLabels[selected.product_source] },
            { key: "shipping", label: "寄样物流", children: selected.ship_to_model_tracking_no ? `${selected.ship_to_model_company || ""} ${selected.ship_to_model_tracking_no}` : "暂无" },
            { key: "return", label: "返货物流", children: selected.return_tracking_no ? `${selected.return_company || ""} ${selected.return_tracking_no}` : selected.return_required ? "待填写" : "无需返货" },
            { key: "settlement", label: "预计结算", children: `¥${(Number(selected.commission_amount) + Number(selected.product_subsidy_amount || 0)).toFixed(2)}` },
          ]} />
        </Card>
        {selected.status === "DISPUTED" && <Alert
          type="warning"
          showIcon
          message="该履约已进入争议处理"
          description="当前返图、寄样和结算信息仅供查看，等待管理员仲裁后再继续处理。"
        />}
        <Card size="small" title="返图版本" className="fulfillment-drawer-section">
          {selected.submissions?.length ? <List
            dataSource={[...(selected.submissions || [])].reverse()}
            renderItem={(submission: FulfillmentSubmission) => <List.Item className="fulfillment-submission-item">
              <div className="fulfillment-submission-header">
                <div className="fulfillment-submission-title">
                  <Typography.Text strong>版本 {submission.version}</Typography.Text>
                  <Tag color={submission.status === "APPROVED" ? "green" : submission.status === "REVISION_REQUIRED" ? "orange" : "gold"}>{submission.status === "APPROVED" ? "已通过" : submission.status === "REVISION_REQUIRED" ? "要求修改" : "待审核"}</Tag>
                </div>
                <Typography.Text type="secondary" className="fulfillment-submission-meta">
                  提交于 {formatDate(submission.submitted_at)}{submission.reviewed_at ? ` · 审核于 ${formatDate(submission.reviewed_at)}` : ""}
                </Typography.Text>
              </div>
              <div className="fulfillment-submission-body"><MediaPreview urls={submission.media_urls} />{submission.remark && <Typography.Paragraph type="secondary">备注：{submission.remark}</Typography.Paragraph>}{submission.review_reason && <Typography.Paragraph type="warning">审核意见：{submission.review_reason}</Typography.Paragraph>}</div>
              {selected.status === "SUBMITTED" && submission.status === "PENDING_REVIEW" && <div className="fulfillment-submission-actions"><SubmissionReview fulfillment={selected} submission={submission} onRefresh={refresh} /></div>}
            </List.Item>}
          /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="达人尚未提交返图" />}
        </Card>
        <FulfillmentMessageBoard fulfillmentId={selected.id} />
        <Card size="small" title="履约时间线" className="fulfillment-drawer-section"><Timeline items={[{ dot: <ClockCircleOutlined />, children: `申请通过 ${formatDate(selected.claimed_at)}` }, { children: `寄样 ${formatDate(selected.shipped_at)}` }, { children: `提交返图 ${formatDate(selected.submitted_at)}` }, { children: `返货/完成 ${formatDate(selected.returned_at || selected.completed_at)}` }]} /></Card>
        <Space wrap>
          {isMerchantViewer && selected.status === "CLAIMED" && <Button type="primary" onClick={() => { setShipmentTarget(selected); setShippingCompany(""); setShippingTrackingNo(""); }}>填写寄样物流</Button>}
          {isMerchantViewer && selected.status === "OWNED_PRODUCT_REVIEW" && <Space wrap><Button type="primary" onClick={() => { setOwnedReviewReason(""); setOwnedReviewTarget({ fulfillment: selected, approved: true }); }}>通过同款审核</Button><Button danger onClick={() => { setOwnedReviewReason(""); setOwnedReviewTarget({ fulfillment: selected, approved: false }); }}>驳回同款</Button></Space>}
          {(isMerchantViewer || viewerRole === "admin") && selected.status === "RETURNED" && <Button type="primary" onClick={() => modal.confirm({ title: `确认验收 ${talentName(selected)} 的返货？`, okText: "确认验收", cancelText: "取消", onOk: async () => { try { await acceptFulfillment(selected.id); await refresh(); message.success("已完成该达人验收"); } catch (error) { message.error(error instanceof Error ? error.message : "验收失败"); } } })}>确认验收并结算</Button>}
        </Space>
      </div>}
    </Drawer>
    <Modal title={shipmentTarget ? `填写名额 ${slotLabel(shipmentTarget.slot_no)} 的寄样物流` : "填写寄样物流"} open={Boolean(shipmentTarget)} onCancel={() => setShipmentTarget(null)} okText="确认寄出" cancelText="取消" confirmLoading={shippingSaving} onOk={async () => { if (!shipmentTarget || !shippingCompany.trim() || !shippingTrackingNo.trim()) { message.warning("请填写物流公司和运单号"); return; } setShippingSaving(true); try { await shipFulfillment(shipmentTarget.id, { company: shippingCompany.trim(), tracking_no: shippingTrackingNo.trim() }); await refresh(); setShipmentTarget(null); message.success("寄样物流已记录"); } catch (error) { message.error(error instanceof Error ? error.message : "寄样失败"); } finally { setShippingSaving(false); } }}><Typography.Paragraph type="secondary">本操作只影响 {shipmentTarget ? `名额 ${slotLabel(shipmentTarget.slot_no)} · ${talentName(shipmentTarget)}` : "当前达人"}。</Typography.Paragraph><div className="fulfillment-ship-form"><Input value={shippingCompany} onChange={(event) => setShippingCompany(event.target.value)} placeholder="物流公司" maxLength={50} /><Input value={shippingTrackingNo} onChange={(event) => setShippingTrackingNo(event.target.value)} placeholder="运单号" maxLength={50} /></div></Modal>
    <Modal title={ownedReviewTarget?.approved ? "通过同款审核" : "驳回同款申请"} open={Boolean(ownedReviewTarget)} onCancel={() => { if (!ownedReviewSaving) { setOwnedReviewTarget(null); setOwnedReviewReason(""); } }} okText={ownedReviewTarget?.approved ? "确认通过" : "确认驳回"} cancelText="取消" confirmLoading={ownedReviewSaving} onOk={submitOwnedReview} destroyOnHidden>
      {ownedReviewTarget?.approved ? <Typography.Paragraph type="secondary">通过后该达人将进入拍摄阶段。</Typography.Paragraph> : <><Typography.Paragraph type="secondary">驳回后该名额会重新开放，达人可重新申请。</Typography.Paragraph><Input.TextArea value={ownedReviewReason} onChange={(event) => setOwnedReviewReason(event.target.value)} rows={4} maxLength={255} showCount placeholder="请填写驳回原因" /></>}
    </Modal>
  </div>;
}
