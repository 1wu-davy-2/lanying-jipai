import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileImageOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Input, List, Modal, Pagination, Select, Space, Tag, Typography, message } from "antd";

import { getAdminOrderApplications, reviewOrderApplication, type AdminOrderApplication } from "../../api/admin";
import type { ApplicationStatus } from "../../api/orders";

const statusColor: Record<ApplicationStatus, string> = { PENDING: "gold", APPROVED: "green", REJECTED: "default", WAITLISTED: "blue", CLOSED: "default" };
const statusText: Record<ApplicationStatus, string> = { PENDING: "待审核", APPROVED: "已通过", REJECTED: "未通过", WAITLISTED: "候补", CLOSED: "已关闭" };
const PAGE_SIZE = 20;

function reviewBlockReason(order: NonNullable<AdminOrderApplication["order"]>, approvedInPage: number) {
  const approved = order.approved_quantity ?? approvedInPage;
  const available = order.available_quantity ?? Math.max(order.quantity - approved, 0);
  if (order.recruitment_status === "CLOSED") return "招募已关闭，不能再分配达人";
  if (order.recruitment_status === "FULL" || available <= 0 || approved >= order.quantity) return "订单名额已满，不能再分配达人";
  return null;
}

export function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ApplicationStatus | undefined>();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrderApplication>();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["admin-order-applications", status, page], queryFn: () => getAdminOrderApplications(status, { page, page_size: PAGE_SIZE }) });
  const groups = useMemo(() => {
    const grouped = new Map<number, { order: NonNullable<AdminOrderApplication["order"]>; items: AdminOrderApplication[] }>();
    for (const item of data?.items ?? []) {
      if (!item.order) continue;
      const existing = grouped.get(item.order.id);
      if (existing) existing.items.push(item); else grouped.set(item.order.id, { order: item.order, items: [item] });
    }
    return [...grouped.values()];
  }, [data?.items]);

  const review = async (approved: boolean) => {
    if (!selected) return;
    if (!approved && !reason.trim()) {
      message.warning("请填写未通过原因");
      return;
    }
    setSaving(true);
    try {
      await reviewOrderApplication(selected.id, { approved, reason: reason.trim() || undefined });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-order-applications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["order-hall"] }),
      ]);
      setSelected(undefined);
      setReason("");
      message.success(approved ? "已通过申请并分配订单" : "已驳回申请");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "审核失败");
    } finally {
      setSaving(false);
    }
  };

  return <div>
    <div className="page-heading"><div><Typography.Title level={2}>接单申请</Typography.Title><Typography.Text type="secondary">按订单分组审核达人申请并分配名额。</Typography.Text></div></div>
    <Space className="filter-bar"><Select value={status} allowClear placeholder="全部申请状态" onChange={(value) => { setStatus(value); setPage(1); }} options={(Object.keys(statusText) as ApplicationStatus[]).map((value) => ({ value, label: statusText[value] }))} /></Space>
    {isLoading ? <Card loading /> : groups.length ? <div className="admin-application-groups">{groups.map(({ order, items }) => {
      const approvedInPage = items.filter((item) => item.status === "APPROVED").length;
      const approved = order.approved_quantity ?? approvedInPage;
      const pending = items.filter((item) => item.status === "PENDING").length;
      const blockedReason = reviewBlockReason(order, approvedInPage);
      return <Card key={order.id} className="admin-application-group" title={<div><strong>{order.title}</strong><div className="muted-text">{order.order_no} · {pending ? `待审核 ${pending} 人` : "暂无待审核"}</div></div>} extra={<Space><Tag color={approved >= order.quantity ? "green" : "blue"}>{approved}/{order.quantity} 已分配</Tag><Typography.Text type="secondary">{items.length} 位申请人</Typography.Text></Space>}>
        <List dataSource={items} renderItem={(item) => <List.Item actions={[item.status === "PENDING" ? <Space key="review" direction="vertical" size={0} align="end"><Button type="primary" size="small" disabled={Boolean(blockedReason)} onClick={() => setSelected(item)}>审核</Button>{blockedReason && <Typography.Text type="secondary">{blockedReason}</Typography.Text>}</Space> : <Typography.Text key="review" type="secondary">{item.review_reason || statusText[item.status]}</Typography.Text>]}>
          <List.Item.Meta avatar={<Avatar src={item.applicant?.avatar_url}>{item.applicant?.nickname?.slice(0, 1)}</Avatar>} title={<Space><span>{item.applicant?.nickname || "未知达人"}</span>{item.applicant?.level && <Tag>{item.applicant.level}</Tag>}<Tag color={statusColor[item.status]}>{statusText[item.status]}</Tag></Space>} description={<span>{item.applicant?.verify_status === "verified" ? "已实名" : "未实名"} · 申请于 {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</span>} />
          <div className="admin-application-message">{item.message || "未填写申请说明"}</div>
          {Boolean(item.owned_product_images?.length) && <Typography.Text type="secondary"><FileImageOutlined /> 已上传 {item.owned_product_images.length} 张同款实拍图</Typography.Text>}
        </List.Item>} />
      </Card>;
    })}</div> : <Card><Typography.Text type="secondary">暂无符合条件的申请</Typography.Text></Card>}
    {(data?.total ?? 0) > PAGE_SIZE && <Pagination current={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} showSizeChanger={false} onChange={setPage} showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`} />}
    <Modal title="审核接单申请" open={Boolean(selected)} onCancel={() => { setSelected(undefined); setReason(""); }} footer={[
      <Button key="reject" danger loading={saving} onClick={() => review(false)}>驳回</Button>,
      <Button key="approve" type="primary" loading={saving} onClick={() => review(true)}>通过并分配</Button>,
    ]}>
      <Typography.Paragraph><strong>{selected?.applicant?.nickname || "达人"}</strong> 将占用订单「{selected?.order?.title || ""}」的一个独立名额。通过后只会创建该达人的履约实例，其他申请会继续保留，直至名额满额或招募关闭。</Typography.Paragraph>
      <Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={255} placeholder="驳回时请填写原因；通过时可留空" />
    </Modal>
  </div>;
}
