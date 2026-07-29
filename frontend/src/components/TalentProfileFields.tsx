import { CameraOutlined, PlusOutlined } from "@ant-design/icons";
import { Avatar, Cascader, Col, Form, Input, InputNumber, Row, Typography, Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd";
import { useEffect, useState } from "react";

import { uploadFile } from "../api/orders";
import { SHIPPING_ADDRESS_OPTIONS } from "../constants/shippingAddresses";

function filesFromUrls(urls: string[]) {
  return urls.map((url) => ({ uid: url, name: url.split("/").pop() ?? "作品照片", status: "done" as const, url }));
}

function ImageUploader({ value, onChange, maxCount, label }: { value?: string[]; onChange?: (urls: string[]) => void; maxCount: number; label: string }) {
  const [files, setFiles] = useState<UploadFile[]>(() => filesFromUrls(value ?? []));

  useEffect(() => {
    setFiles(filesFromUrls(value ?? []));
  }, [value]);

  const customRequest: UploadProps["customRequest"] = async ({ file, onError, onSuccess }) => {
    try {
      const result = await uploadFile(file as File);
      setFiles((current) => {
        const next = [...current.filter((item) => item.uid !== result.url), { uid: result.url, name: result.url.split("/").pop() ?? "作品照片", status: "done" as const, url: result.url }];
        onChange?.(next.filter((item) => item.status === "done").map((item) => item.url).filter((url): url is string => Boolean(url)));
        return next;
      });
      onSuccess?.({ url: result.url });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "图片上传失败");
      onError?.(error as Error);
    }
  };

  const handleRemove = (file: UploadFile) => {
    const next = files.filter((item) => item.uid !== file.uid);
    setFiles(next);
    onChange?.(next.map((item) => item.url).filter((url): url is string => Boolean(url)));
    return true;
  };

  return <Upload
    listType={maxCount === 1 ? "picture-circle" : "picture-card"}
    accept="image/jpeg,image/png,image/webp"
    fileList={files}
    customRequest={customRequest}
    multiple={maxCount > 1}
    onChange={({ fileList }) => setFiles(fileList)}
    onRemove={handleRemove}
    maxCount={maxCount}
  >
    {files.length < maxCount && <button type="button" className="upload-add-button" aria-label={label}>{maxCount === 1 ? <CameraOutlined /> : <PlusOutlined />}</button>}
  </Upload>;
}

export function AvatarField() {
  return <Form.Item name="avatar_url" label="头像" rules={[{ required: true, message: "请上传头像" }]} valuePropName="value">
    <AvatarUploader />
  </Form.Item>;
}

function AvatarUploader({ value, onChange }: { value?: string; onChange?: (url: string | undefined) => void }) {
  return <ImageUploader value={value ? [value] : []} onChange={(urls) => onChange?.(urls[0])} maxCount={1} label="上传头像" />;
}

export function PortfolioField() {
  return <Form.Item name="portfolio_urls" label="作品照片" rules={[{ required: true, type: "array", min: 6, message: "请上传至少 6 张作品照片" }]} valuePropName="value">
    <div>
      <ImageUploader maxCount={12} label="添加作品照片" />
      <Typography.Text type="secondary">仅支持 JPG、PNG、WEBP，至少 6 张，最多 12 张。</Typography.Text>
    </div>
  </Form.Item>;
}

export function TalentProfileFields({ includeMeasurements = true }: { includeMeasurements?: boolean }) {
  return <>
    <Row gutter={16} align="middle">
      <Col flex="96px"><AvatarField /></Col>
      <Col flex="auto"><Form.Item name="nickname" label="用户名" rules={[{ required: true, min: 2, message: "请输入至少 2 个字符的用户名" }]}><Input maxLength={50} placeholder="展示给商家的达人名称" /></Form.Item></Col>
    </Row>
    {includeMeasurements && <Row gutter={12}>
      <Col xs={12}><Form.Item name="height_cm" label="身高（cm）"><InputNumber min={1} max={300} className="field-full" /></Form.Item></Col>
      <Col xs={12}><Form.Item name="weight_kg" label="体重（kg）"><InputNumber min={1} max={500} className="field-full" /></Form.Item></Col>
    </Row>}
    <Form.Item name="skill_tags" label="技能标签"><Input placeholder="例如：平面模特、服饰、美妆" /></Form.Item>
    <Form.Item name="receive_address" label="收货地区" rules={[{ required: true, type: "array", len: 3, message: "请选择完整的省、市、区" }]}>
      <Cascader options={SHIPPING_ADDRESS_OPTIONS} placeholder="选择省 / 市 / 区" className="field-full" />
    </Form.Item>
    <Row gutter={12}>
      <Col xs={12}><Form.Item name="receiver_name" label="收件人姓名" rules={[{ required: true, min: 2, message: "请输入收件人姓名" }]}><Input autoComplete="name" /></Form.Item></Col>
      <Col xs={12}><Form.Item name="receiver_phone" label="收件人手机号" rules={[{ required: true, min: 6, message: "请输入收件人手机号" }]}><Input inputMode="tel" autoComplete="tel" /></Form.Item></Col>
    </Row>
    <Form.Item name="receive_address_detail" label="详细收货地址" rules={[{ required: true, message: "请输入小区、楼栋和门牌号" }]}><Input placeholder="例如：蓝影花园 3 栋 1202 室" autoComplete="street-address" /></Form.Item>
    <PortfolioField />
  </>;
}

export function TalentAvatar({ url, nickname }: { url?: string | null; nickname: string }) {
  return <Avatar src={url}>{nickname.slice(0, 1)}</Avatar>;
}
