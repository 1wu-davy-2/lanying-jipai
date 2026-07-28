import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, InputNumber, Modal, Table, Tabs, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { createOrder, getMyOrders, type OrderStatus } from "../../api/orders";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag } from "../../components/OrderStatusTag";

const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" }, { key: "PUBLISHED", label: "待抢单" }, { key: "CLAIMED", label: "待寄出" },
  { key: "SHIPPED_TO_MODEL", label: "寄送中" }, { key: "RETURNED", label: "待验收" }, { key: "COMPLETED", label: "已完成" }, { key: "DISPUTED", label: "争议中" },
];

export function MerchantOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sampleImages, setSampleImages] = useState<string[]>([]);
  const [form] = Form.useForm();
  const { data, isLoading } = useQuery({ queryKey: ["merchant-orders", status, page], queryFn: () => getMyOrders(status === "all" ? undefined : status, page) });
  const publish = async (values: { title: string; description: string; commission_amount: number; shoot_requirements?: string }) => {
    setSaving(true);
    try {
      await createOrder({ ...values, commission_amount: values.commission_amount.toFixed(2), sample_images: sampleImages });
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      form.resetFields(); setSampleImages([]); setOpen(false); message.success("订单已发布");
    } catch (error) { message.error(error instanceof Error ? error.message : "发布失败"); } finally { setSaving(false); }
  };
  return <div>
    <div className="page-heading"><Typography.Title level={2}>我的订单</Typography.Title><Button type="primary" onClick={() => setOpen(true)}>发布订单</Button></div>
    <Tabs activeKey={status} onChange={(key) => { setStatus(key as OrderStatus | "all"); setPage(1); }} items={tabs} />
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={{ current: page, pageSize: 20, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }} onRow={(record) => ({ onClick: () => navigate(`/merchant/orders/${record.id}`), className: "table-row-link" })} columns={[
      { title: "订单", dataIndex: "title" }, { title: "佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` }, { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> },
    ]} />
    <Modal title="发布寄拍订单" open={open} onCancel={() => { setOpen(false); form.resetFields(); setSampleImages([]); }} footer={null} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={publish}>
        <Form.Item name="title" label="订单标题" rules={[{ required: true, message: "请输入订单标题" }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="description" label="拍摄说明" rules={[{ required: true, message: "请输入拍摄说明" }]}><Input.TextArea rows={4} /></Form.Item>
        <Form.Item label="样品图片"><OrderMediaUpload value={sampleImages} onChange={setSampleImages} accept="image" /></Form.Item>
        <Form.Item name="commission_amount" label="佣金" rules={[{ required: true, message: "请输入佣金" }]}><InputNumber min={0.01} precision={2} className="field-full" prefix="¥" /></Form.Item>
        <Form.Item name="shoot_requirements" label="交付要求"><Input.TextArea rows={2} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>确认发布</Button>
      </Form>
    </Modal>
  </div>;
}
