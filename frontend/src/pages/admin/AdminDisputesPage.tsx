import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Pagination, Radio, Space, Table, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import {
  arbitrateFulfillment,
  arbitrateOrder,
  getDisputedOrders,
  getFulfillmentDisputes,
  type AdminFulfillmentDispute,
} from "../../api/admin";
import type { OrderItem } from "../../api/orders";

const PAGE_SIZE = 20;
type DisputeTarget =
  | { kind: "order"; value: OrderItem }
  | { kind: "fulfillment"; value: AdminFulfillmentDispute };

export function AdminDisputesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<DisputeTarget | null>(null);
  const [form] = Form.useForm();
  const legacyQuery = useQuery({ queryKey: ["admin-disputes", "orders", page], queryFn: () => getDisputedOrders({ page, page_size: PAGE_SIZE }) });
  const fulfillmentQuery = useQuery({ queryKey: ["admin-disputes", "fulfillments", page], queryFn: () => getFulfillmentDisputes({ page, page_size: PAGE_SIZE }) });

  const arbitrate = async (values: { winner: "model" | "merchant"; remark: string }) => {
    if (!target) return;
    try {
      if (target.kind === "order") await arbitrateOrder(target.value.id, values);
      else await arbitrateFulfillment(target.value.id, values);
      setTarget(null);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-disputes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
      message.success("仲裁结果已生效");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "仲裁失败");
    }
  };

  const legacyItems = legacyQuery.data?.items ?? [];
  const fulfillmentItems = fulfillmentQuery.data?.items ?? [];
  const legacyColumns = [
    { title: "订单", render: (_: unknown, item: OrderItem) => <div><strong>{item.title}</strong><div className="muted-text">{item.order_no}</div><Tag>旧订单</Tag></div> },
    { title: "争议原因", dataIndex: "reject_reason", render: (value: string | null) => value || "-" },
    { title: "佣金", dataIndex: "commission_amount", render: (value: string) => `¥${value}` },
    { title: "操作", render: (_: unknown, item: OrderItem) => <Space><Button size="small" onClick={() => navigate(`/admin/orders/${item.id}`)}>查看详情</Button><Button size="small" type="primary" onClick={() => setTarget({ kind: "order", value: item })}>仲裁</Button></Space> },
  ];
  const fulfillmentColumns = [
    { title: "订单 / 履约", render: (_: unknown, item: AdminFulfillmentDispute) => <div><strong>{item.order?.title || `履约 #${item.id}`}</strong><div className="muted-text">{item.order?.order_no || "-"} · 第 {item.slot_no || "-"} 个名额</div><Tag color="purple">新履约</Tag></div> },
    { title: "争议原因", dataIndex: "reject_reason", render: (value: string | null) => value || "-" },
    { title: "达人", render: (_: unknown, item: AdminFulfillmentDispute) => item.model?.nickname || item.talent?.nickname || "-" },
    { title: "佣金", dataIndex: "commission_amount", render: (value: string) => `¥${value}` },
    { title: "操作", render: (_: unknown, item: AdminFulfillmentDispute) => <Space><Button size="small" onClick={() => navigate(`/admin/orders/${item.order_id}`)}>查看订单</Button><Button size="small" type="primary" onClick={() => setTarget({ kind: "fulfillment", value: item })}>仲裁</Button></Space> },
  ];

  return <div>
    <div className="page-heading"><Typography.Title level={2}>争议处理</Typography.Title></div>
    <Typography.Title level={4}>旧订单争议</Typography.Title>
    <Table rowKey="id" loading={legacyQuery.isLoading} dataSource={legacyItems} pagination={false} columns={legacyColumns} locale={{ emptyText: "暂无旧订单争议" }} />
    <Typography.Title level={4} style={{ marginTop: 24 }}>履约实例争议</Typography.Title>
    <Table rowKey="id" loading={fulfillmentQuery.isLoading} dataSource={fulfillmentItems} pagination={false} columns={fulfillmentColumns} locale={{ emptyText: "暂无履约争议" }} />
    {(Math.max(legacyQuery.data?.total ?? 0, fulfillmentQuery.data?.total ?? 0) > PAGE_SIZE) && <Pagination current={page} pageSize={PAGE_SIZE} total={Math.max(legacyQuery.data?.total ?? 0, fulfillmentQuery.data?.total ?? 0)} showSizeChanger={false} onChange={setPage} />}
    <Modal title={target?.kind === "fulfillment" ? "履约仲裁" : "订单仲裁"} open={target !== null} onCancel={() => { setTarget(null); form.resetFields(); }} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" initialValues={{ winner: "model" }} onFinish={arbitrate}>
        <Form.Item name="winner" label="仲裁结果" rules={[{ required: true }]}><Radio.Group><Radio value="model">判达人（完成并结算）</Radio><Radio value="merchant">判商家（取消本次履约）</Radio></Radio.Group></Form.Item>
        <Form.Item name="remark" label="仲裁说明" rules={[{ required: true, message: "请填写仲裁说明" }]}><Input.TextArea rows={4} /></Form.Item>
        <Button type="primary" htmlType="submit">确认仲裁</Button>
      </Form>
    </Modal>
  </div>;
}
