import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";

import { createAdminMerchant, createAdminOrder, getAdminOrders, getAdminUsers } from "../../api/admin";
import type { OrderStatus } from "../../api/orders";
import { OrderMediaUpload } from "../../components/OrderMediaUpload";
import { OrderStatusTag } from "../../components/OrderStatusTag";
import { OrderFulfillmentFormItems } from "../../components/OrderFulfillmentFormItems";
import { PRODUCT_CATEGORY_OPTIONS } from "../../constants/productCategories";

const tabs: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "PUBLISHED", label: "申请审核" },
  { key: "CLAIMED", label: "待寄样" },
  { key: "SHIPPED_TO_MODEL", label: "寄送中" },
  { key: "RETURNED", label: "待验收" },
  { key: "COMPLETED", label: "已完成" },
  { key: "DISPUTED", label: "争议中" },
];

type PublishValues = {
  title: string;
  description: string;
  product_categories: string[];
  commission_amount: number;
  shoot_requirements?: string;
  order_type: "product_photo" | "try_on" | "short_video" | "live_show";
  quantity: number;
  required_media_count: number;
  delivery_days: number;
  deposit_required: boolean;
  deposit_amount?: number;
  return_required: boolean;
  product_source: "merchant_ship" | "talent_purchase" | "talent_owned";
  product_subsidy_amount?: number;
};

type MerchantValues = {
  phone: string;
  password: string;
  nickname?: string;
  shop_name: string;
  shop_platform?: string;
  contact_phone: string;
  default_ship_address: string;
};

export function AdminOperationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState<number>();
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [publishOpen, setPublishOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleImages, setSampleImages] = useState<string[]>([]);
  const [publishForm] = Form.useForm<PublishValues>();
  const [merchantForm] = Form.useForm<MerchantValues>();
  const { data: merchants } = useQuery({
    queryKey: ["operation-merchants"],
    queryFn: () => getAdminUsers({ role: "merchant", status: "active", page_size: "100" }),
  });
  const { data: orders, isLoading } = useQuery({
    queryKey: ["operation-orders", merchantId, status, page],
    queryFn: () => getAdminOrders({ merchant_id: merchantId, status_filter: status === "all" ? undefined : status, page }),
    enabled: merchantId !== undefined,
  });
  const selectedMerchant = merchants?.items.find((item) => item.id === merchantId);

  const publish = async (values: PublishValues) => {
    if (!merchantId) return;
    setSaving(true);
    try {
      await createAdminOrder({
          merchant_id: merchantId,
          ...values,
          commission_amount: values.commission_amount.toFixed(2),
        sample_images: sampleImages,
        return_required: values.product_source === "merchant_ship" ? values.return_required : false,
        self_keep_after_shoot: values.product_source !== "merchant_ship" || !values.return_required,
        product_subsidy_amount: (values.product_source === "talent_purchase" ? values.product_subsidy_amount ?? 0 : 0).toFixed(2),
        deposit_amount: (values.deposit_required ? values.deposit_amount ?? 0 : 0).toFixed(2),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operation-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
      publishForm.resetFields();
      setSampleImages([]);
      setPublishOpen(false);
      message.success("订单已按所选商家归属发布");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "发布失败");
    } finally {
      setSaving(false);
    }
  };

  const createMerchant = async (values: MerchantValues) => {
    setSaving(true);
    try {
      const merchant = await createAdminMerchant(values);
      setMerchantId(merchant.id);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["operation-merchants"] });
      merchantForm.resetFields();
      setMerchantOpen(false);
      message.success("商家已创建并选中");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "创建商家失败");
    } finally {
      setSaving(false);
    }
  };

  return <div>
    <div className="page-heading">
      <Typography.Title level={2}>运营发单</Typography.Title>
      <Button onClick={() => setMerchantOpen(true)}>新建商家</Button>
    </div>
    <Space wrap className="filter-bar">
      <Select
        value={merchantId}
        onChange={(value) => { setMerchantId(value); setPage(1); }}
        placeholder="选择商家"
        showSearch
        optionFilterProp="label"
        style={{ minWidth: 280 }}
        options={(merchants?.items ?? []).map((merchant) => ({
          value: merchant.id,
          label: `${merchant.merchant_profile?.shop_name || merchant.nickname} · ${merchant.phone}`,
        }))}
      />
      {selectedMerchant && <Typography.Text type="secondary">当前归属：{selectedMerchant.merchant_profile?.shop_name || selectedMerchant.nickname}</Typography.Text>}
      <Button type="primary" disabled={!merchantId} onClick={() => setPublishOpen(true)}>发布订单</Button>
    </Space>
    {merchantId ? <>
      <Tabs activeKey={status} onChange={(key) => { setStatus(key as OrderStatus | "all"); setPage(1); }} items={tabs} />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={orders?.items ?? []}
        pagination={{ current: page, pageSize: 20, total: orders?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        onRow={(record) => ({ onClick: () => navigate(`/admin/orders/${record.id}`), className: "table-row-link" })}
        columns={[
          { title: "订单", render: (_, order) => <div><strong>{order.title}</strong><div className="muted-text">{order.order_no}</div></div> },
          { title: "佣金", dataIndex: "commission_amount", render: (value) => `¥${value}` },
          { title: "状态", dataIndex: "status", render: (value) => <OrderStatusTag status={value} /> },
          { title: "创建时间", dataIndex: "created_at", render: (value) => value ? new Date(value).toLocaleString() : "-" },
        ]}
      />
    </> : <Empty description="选择商家后查看或发布订单" />}
    <Modal title="新建商家" open={merchantOpen} onCancel={() => { setMerchantOpen(false); merchantForm.resetFields(); }} footer={null} destroyOnHidden>
      <Form form={merchantForm} layout="vertical" onFinish={createMerchant} requiredMark={false}>
        <Form.Item name="shop_name" label="店铺名称" rules={[{ required: true, message: "请输入店铺名称" }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="nickname" label="商家显示名称"><Input maxLength={50} /></Form.Item>
        <Form.Item name="shop_platform" label="电商平台"><Input maxLength={50} /></Form.Item>
        <Form.Item name="phone" label="登录手机号" rules={[{ required: true, message: "请输入登录手机号" }]}><Input maxLength={20} /></Form.Item>
        <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: "密码至少 8 位" }]}><Input.Password maxLength={128} /></Form.Item>
        <Form.Item name="contact_phone" label="业务联系电话" rules={[{ required: true, message: "请输入业务联系电话" }]}><Input maxLength={20} /></Form.Item>
        <Form.Item name="default_ship_address" label="默认寄样地址" rules={[{ required: true, message: "请输入默认寄样地址" }]}><Input.TextArea rows={3} maxLength={255} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>确认创建</Button>
      </Form>
    </Modal>
    <Modal title="发布寄拍订单" open={publishOpen} onCancel={() => { setPublishOpen(false); publishForm.resetFields(); setSampleImages([]); }} footer={null} destroyOnHidden>
      <Form form={publishForm} layout="vertical" onFinish={publish} requiredMark={false} initialValues={{ order_type: "product_photo", quantity: 1, required_media_count: 6, delivery_days: 5, deposit_required: false, return_required: true, product_source: "merchant_ship", product_subsidy_amount: 0 }}>
        <Form.Item name="order_type" label="订单类型" rules={[{ required: true, message: "请选择订单类型" }]}><Select options={[{ value: "product_photo", label: "商品平拍" }, { value: "try_on", label: "试穿展示" }, { value: "short_video", label: "短视频素材" }, { value: "live_show", label: "直播展示" }]} /></Form.Item>
        <Form.Item name="product_categories" label="商品分类" rules={[{ required: true, message: "请选择至少一个商品分类" }, { type: "array", min: 1, max: 3, message: "请选择 1 至 3 个商品分类" }]}>
          <Select mode="multiple" maxCount={3} options={PRODUCT_CATEGORY_OPTIONS} placeholder="选择 1 至 3 个分类" />
        </Form.Item>
        <Form.Item name="title" label="订单标题" rules={[{ required: true, message: "请输入订单标题" }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="description" label="拍摄说明" rules={[{ required: true, message: "请输入拍摄说明" }]}><Input.TextArea rows={4} /></Form.Item>
        <Form.Item label="样品图片"><OrderMediaUpload value={sampleImages} onChange={setSampleImages} accept="image" /></Form.Item>
        <div className="publish-number-grid"><Form.Item name="quantity" label="寄拍数量" rules={[{ required: true }]}><InputNumber min={1} max={1000} className="field-full" suffix="件" /></Form.Item><Form.Item name="required_media_count" label="交付素材" rules={[{ required: true }]}><InputNumber min={1} max={100} className="field-full" suffix="份起" /></Form.Item><Form.Item name="delivery_days" label="收货后交付" rules={[{ required: true }]}><InputNumber min={1} max={30} className="field-full" suffix="天内" /></Form.Item></div>
        <Form.Item name="commission_amount" label="佣金" rules={[{ required: true, message: "请输入佣金" }]}><InputNumber min={0.01} precision={2} className="field-full" prefix="¥" /></Form.Item>
        <Form.Item name="deposit_required" label="需要缴纳押金" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.deposit_required !== current.deposit_required}>{({ getFieldValue }) => getFieldValue("deposit_required") ? <Form.Item name="deposit_amount" label="押金金额" rules={[{ required: true, message: "请输入押金金额" }]}><InputNumber min={0.01} precision={2} className="field-full" prefix="¥" /></Form.Item> : null}</Form.Item>
        <OrderFulfillmentFormItems />
        <Form.Item name="shoot_requirements" label="交付要求"><Input.TextArea rows={2} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>确认发布</Button>
      </Form>
    </Modal>
  </div>;
}
