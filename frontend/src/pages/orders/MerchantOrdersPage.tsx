import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tabs, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { createOrder, getMyOrders, type OrderStatus } from "../../api/orders";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag } from "../../components/OrderStatusTag";
import { PRODUCT_CATEGORY_OPTIONS } from "../../constants/productCategories";

const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" }, { key: "PUBLISHED", label: "申请审核" }, { key: "CLAIMED", label: "待寄出" },
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
  const publish = async (values: { title: string; description: string; product_categories: string[]; commission_amount: number; shoot_requirements?: string; order_type: string; quantity: number; required_media_count: number; delivery_days: number; deposit_required: boolean; deposit_amount?: number; return_required: boolean }) => {
    setSaving(true);
    try {
      await createOrder({ ...values, commission_amount: values.commission_amount.toFixed(2), deposit_amount: (values.deposit_required ? values.deposit_amount ?? 0 : 0).toFixed(2), sample_images: sampleImages });
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
    <Modal title="发布寄拍订单" open={open} onCancel={() => { setOpen(false); form.resetFields(); setSampleImages([]); }} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={publish} initialValues={{ order_type: "product_photo", quantity: 1, required_media_count: 6, delivery_days: 5, deposit_required: false, return_required: true }}>
        <Form.Item name="order_type" label="订单类型" rules={[{ required: true, message: "请选择订单类型" }]}><Select options={[{ value: "product_photo", label: "商品平拍" }, { value: "try_on", label: "试穿展示" }, { value: "short_video", label: "短视频素材" }, { value: "live_show", label: "直播展示" }]} /></Form.Item>
        <Form.Item name="product_categories" label="商品分类" rules={[{ required: true, message: "请选择至少一个商品分类" }, { type: "array", min: 1, max: 3, message: "请选择 1 至 3 个商品分类" }]}>
          <Select mode="multiple" maxCount={3} options={PRODUCT_CATEGORY_OPTIONS} placeholder="选择 1 至 3 个分类" />
        </Form.Item>
        <Form.Item name="title" label="订单标题" rules={[{ required: true, message: "请输入订单标题" }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="description" label="拍摄说明" rules={[{ required: true, message: "请输入拍摄说明" }]}><Input.TextArea rows={4} /></Form.Item>
        <Form.Item label="样品图片"><OrderMediaUpload value={sampleImages} onChange={setSampleImages} accept="image" /></Form.Item>
        <div className="publish-number-grid"><Form.Item name="quantity" label="寄拍数量" rules={[{ required: true }]}><InputNumber min={1} max={1000} className="field-full" suffix="件" /></Form.Item><Form.Item name="required_media_count" label="交付素材" rules={[{ required: true }]}><InputNumber min={1} max={100} className="field-full" suffix="份起" /></Form.Item><Form.Item name="delivery_days" label="收货后交付" rules={[{ required: true }]}><InputNumber min={1} max={30} className="field-full" suffix="天内" /></Form.Item></div>
        <Form.Item name="commission_amount" label="佣金" rules={[{ required: true, message: "请输入佣金" }]}><InputNumber min={0.01} precision={2} className="field-full" prefix="¥" /></Form.Item>
        <div className="publish-switch-row"><Form.Item name="deposit_required" label="需要缴纳押金" valuePropName="checked"><Switch /></Form.Item><Form.Item name="return_required" label="拍摄后需要返货" valuePropName="checked"><Switch /></Form.Item></div>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.deposit_required !== current.deposit_required}>{({ getFieldValue }) => getFieldValue("deposit_required") ? <Form.Item name="deposit_amount" label="押金金额" rules={[{ required: true, message: "请输入押金金额" }]}><InputNumber min={0.01} precision={2} className="field-full" prefix="¥" /></Form.Item> : null}</Form.Item>
        <Form.Item name="shoot_requirements" label="交付要求"><Input.TextArea rows={2} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>确认发布</Button>
      </Form>
    </Modal>
  </div>;
}
