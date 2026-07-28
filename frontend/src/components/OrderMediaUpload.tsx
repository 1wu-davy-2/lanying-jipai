import { Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd";

import { uploadFile } from "../api/orders";

interface OrderMediaUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  accept: "image" | "media";
  maxCount?: number;
}

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const mediaTypes = [...imageTypes, "video/mp4"];

export function OrderMediaUpload({ value, onChange, accept, maxCount = 9 }: OrderMediaUploadProps) {
  const allowedTypes = accept === "image" ? imageTypes : mediaTypes;
  const fileList: UploadFile[] = value.map((url) => ({ uid: url, name: url.split("/").pop() ?? "素材", status: "done", url }));
  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!allowedTypes.includes(file.type)) {
      message.error(accept === "image" ? "仅支持 JPG、PNG、WEBP 图片" : "仅支持 JPG、PNG、WEBP 图片或 MP4 视频");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error("文件不能超过 10MB");
      return Upload.LIST_IGNORE;
    }
    return true;
  };
  const customRequest: UploadProps["customRequest"] = async ({ file, onError, onSuccess }) => {
    try {
      const result = await uploadFile(file as File);
      onChange([...value, result.url]);
      onSuccess?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("上传失败"));
    }
  };
  return <Upload
    listType="picture-card"
    accept={accept === "image" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,video/mp4"}
    fileList={fileList}
    beforeUpload={beforeUpload}
    customRequest={customRequest}
    onRemove={(file) => onChange(value.filter((url) => url !== file.url))}
    showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
  >
    {value.length >= maxCount ? null : <span>上传素材</span>}
  </Upload>;
}
