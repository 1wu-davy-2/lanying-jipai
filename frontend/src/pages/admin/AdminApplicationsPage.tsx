import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";

import { getAdminOrderApplications, reviewOrderApplication, type AdminOrderApplication } from "../../api/admin";
import type { ApplicationStatus } from "../../api/orders";

const statusColor: Record<ApplicationStatus, string> = { PENDING: "gold", APPROVED: "green", REJECTED: "default" };
const statusText: Record<ApplicationStatus, string> = { PENDING: "待审核", APPROVED: "已通过", REJECTED: "未通过" };

export function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ApplicationStatus | undefined>("PENDING");
  const [selected, setSelected] = useState<AdminOrderApplication>();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["admin-order-applications", status], queryFn: () => getAdminOrderApplications(status) });

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
    <div className="page-heading"><Typography.Title level={2}>接单申请</Typography.Title></div>
    <Space className="filter-bar"><Select value={status} allowClear placeholder="申请状态" onChange={setStatus} options={(Object.keys(statusText) as ApplicationStatus[]).map((value) => ({ value, label: statusText[value] }))} /></Space>
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} columns={[
      { title: "订单", render: (_, item) => <div><strong>{item.order?.title || "订单已删除"}</strong><div className="muted-text">{item.order?.order_no}</div></div> },
      { title: "申请达人", render: (_, item) => item.applicant ? <Space><Avatar src={item.applicant.avatar_url}>{item.applicant.nickname.slice(0, 1)}</Avatar><span>{item.applicant.nickname}</span><Tag>{item.applicant.level}</Tag></Space> : "-" },
      { title: "申请说明", dataIndex: "message", render: (value) => value || "-" },
      { title: "佣金", render: (_, item) => item.order ? `¥${item.order.commission_amount}` : "-" },
      { title: "状态", render: (_, item) => <Tag color={statusColor[item.status]}>{statusText[item.status]}</Tag> },
      { title: "申请时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
      { title: "操作", render: (_, item) => item.status === "PENDING" ? <Button type="primary" size="small" onClick={() => setSelected(item)}>审核</Button> : <Typography.Text type="secondary">{item.review_reason || "-"}</Typography.Text> },
    ]} />
    <Modal title="审核接单申请" open={Boolean(selected)} onCancel={() => { setSelected(undefined); setReason(""); }} footer={[
      <Button key="reject" danger loading={saving} onClick={() => review(false)}>驳回</Button>,
      <Button key="approve" type="primary" loading={saving} onClick={() => review(true)}>通过并分配</Button>,
    ]}>
      <Typography.Paragraph><strong>{selected?.applicant?.nickname || "达人"}</strong> 将接下订单「{selected?.order?.title || ""}」。审核通过后，订单会进入待寄样，其他未处理申请将自动关闭。</Typography.Paragraph>
      <Input.TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={255} placeholder="驳回时请填写原因；通过时可留空" />
    </Modal>
  </div>;
}
