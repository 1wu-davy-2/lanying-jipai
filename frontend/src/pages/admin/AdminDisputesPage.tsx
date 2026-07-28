import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Radio, Space, Table, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { arbitrateOrder, getDisputedOrders } from "../../api/admin";
import type { OrderItem } from "../../api/orders";

export function AdminDisputesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-disputes"], queryFn: getDisputedOrders });
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [form] = Form.useForm();
  const arbitrate = async (values: { winner: "model" | "merchant"; remark: string }) => {
    if (!order) return;
    try { await arbitrateOrder(order.id, values); setOrder(null); form.resetFields(); await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }), queryClient.invalidateQueries({ queryKey: ["admin-orders"] }), queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] })]); message.success("仲裁结果已生效"); } catch (error) { message.error(error instanceof Error ? error.message : "仲裁失败"); }
  };
  return <div><div className="page-heading"><Typography.Title level={2}>争议处理</Typography.Title></div>
    <Table rowKey="id" loading={isLoading} dataSource={data?.items ?? []} pagination={false} columns={[
      { title: "订单", render: (_, item: OrderItem) => <div><strong>{item.title}</strong><div className="muted-text">{item.order_no}</div></div> },
      { title: "争议原因", dataIndex: "reject_reason", render: (value) => value || "-" }, { title: "佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` },
      { title: "操作", render: (_, item: OrderItem) => <Space><Button size="small" onClick={() => navigate(`/admin/orders/${item.id}`)}>查看详情</Button><Button size="small" type="primary" onClick={() => setOrder(item)}>仲裁</Button></Space> },
    ]} />
    <Modal title="订单仲裁" open={order !== null} onCancel={() => { setOrder(null); form.resetFields(); }} footer={null} destroyOnClose><Form form={form} layout="vertical" initialValues={{ winner: "model" }} onFinish={arbitrate}><Form.Item name="winner" label="仲裁结果" rules={[{ required: true }]}><Radio.Group><Radio value="model">判达人（完成并结算）</Radio><Radio value="merchant">判商家（取消订单）</Radio></Radio.Group></Form.Item><Form.Item name="remark" label="仲裁说明" rules={[{ required: true, message: "请填写仲裁说明" }]}><Input.TextArea rows={4} /></Form.Item><Button type="primary" htmlType="submit">确认仲裁</Button></Form></Modal>
  </div>;
}
