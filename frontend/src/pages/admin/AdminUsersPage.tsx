import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";

import { getAdminUsers, reviewVerification, updateAdminUserStatus, type AdminUser } from "../../api/admin";

const roleLabels: Record<string, string> = { merchant: "商家", model: "达人", admin: "管理员" };
const verifyLabels: Record<string, { label: string; color: string }> = { unverified: { label: "未认证", color: "default" }, pending: { label: "待审核", color: "gold" }, verified: { label: "已认证", color: "green" }, rejected: { label: "已驳回", color: "red" } };

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ role: undefined as string | undefined, status: undefined as string | undefined, verify_status: undefined as string | undefined, keyword: "" });
  const [reviewing, setReviewing] = useState<AdminUser | null>(null);
  const [reviewForm] = Form.useForm();
  const queryFilters = useMemo(() => ({ ...filters, keyword: filters.keyword || undefined }), [filters]);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users", queryFilters], queryFn: () => getAdminUsers(queryFilters) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const toggleStatus = (user: AdminUser) => Modal.confirm({ title: user.status === "active" ? "禁用账号" : "启用账号", content: `确认${user.status === "active" ? "禁用" : "启用"} ${user.nickname} 吗？`, onOk: async () => { try { await updateAdminUserStatus(user.id, user.status === "active" ? "disabled" : "active"); await refresh(); message.success("账号状态已更新"); } catch (error) { message.error(error instanceof Error ? error.message : "更新失败"); } } });
  const review = async (values: { approved: boolean; reason?: string }) => {
    if (!reviewing) return;
    try { await reviewVerification(reviewing.id, values.approved, values.reason); setReviewing(null); reviewForm.resetFields(); await refresh(); message.success("认证审核已提交"); } catch (error) { message.error(error instanceof Error ? error.message : "审核失败"); }
  };
  return <div><div className="page-heading"><Typography.Title level={2}>用户管理</Typography.Title></div>
    <Space wrap className="filter-bar"><Select allowClear placeholder="角色" options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} onChange={(role) => setFilters((old) => ({ ...old, role }))} /><Select allowClear placeholder="账号状态" options={[{ value: "active", label: "正常" }, { value: "disabled", label: "已禁用" }]} onChange={(status) => setFilters((old) => ({ ...old, status }))} /><Select allowClear placeholder="认证状态" options={Object.entries(verifyLabels).map(([value, item]) => ({ value, label: item.label }))} onChange={(verify_status) => setFilters((old) => ({ ...old, verify_status }))} /><Input.Search allowClear placeholder="手机号或昵称" onSearch={(keyword) => setFilters((old) => ({ ...old, keyword }))} /></Space>
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} columns={[
      { title: "用户", render: (_, user: AdminUser) => <div><strong>{user.nickname}</strong><div className="muted-text">{user.phone}</div></div> },
      { title: "角色", dataIndex: "role", render: (value) => roleLabels[value] ?? value },
      { title: "账号", dataIndex: "status", render: (value) => <Tag color={value === "active" ? "green" : "red"}>{value === "active" ? "正常" : "已禁用"}</Tag> },
      { title: "认证", dataIndex: "verify_status", render: (value) => <Tag color={verifyLabels[value]?.color}>{verifyLabels[value]?.label ?? value}</Tag> },
      { title: "操作", render: (_, user: AdminUser) => <Space><Button size="small" onClick={() => toggleStatus(user)}>{user.status === "active" ? "禁用" : "启用"}</Button>{user.verify_status === "pending" && <Button size="small" type="primary" onClick={() => setReviewing(user)}>审核认证</Button>}</Space> },
    ]} />
    <Modal title="认证审核" open={reviewing !== null} onCancel={() => { setReviewing(null); reviewForm.resetFields(); }} footer={null} destroyOnHidden><p className="masked-id">身份证号：{reviewing?.id_card_no || "未提交"}</p><Form form={reviewForm} layout="vertical" initialValues={{ approved: true }} onFinish={review}><Form.Item name="approved" label="审核结果"><Select options={[{ value: true, label: "通过" }, { value: false, label: "驳回" }]} /></Form.Item><Form.Item name="reason" label="驳回原因"><Input.TextArea rows={3} /></Form.Item><Button type="primary" htmlType="submit">确认审核</Button></Form></Modal>
  </div>;
}
