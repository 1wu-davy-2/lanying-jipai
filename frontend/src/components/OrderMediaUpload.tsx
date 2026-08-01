import { PlusOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Modal, Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd";
import { useEffect, useRef, useState } from "react";

import { uploadFile } from "../api/orders";

interface OrderMediaUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  accept: "image" | "media";
  maxCount?: number;
}

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const mediaTypes = [...imageTypes, "video/mp4"];
const maxImageFileSize = 10 * 1024 * 1024;
const maxVideoFileSize = 20 * 1024 * 1024;

function isVideoUrl(url: string) {
  return /\.mp4(?:[?#]|$)/i.test(url);
}

function isVideoFile(file: UploadFile) {
  return file.type === "video/mp4" || isVideoUrl(file.url ?? file.name);
}

function filesFromUrls(urls: string[]): UploadFile[] {
  return urls.map((url) => ({
    uid: url,
    name: url.split("/").pop() ?? "素材",
    status: "done",
    url,
    type: isVideoUrl(url) ? "video/mp4" : undefined,
  }));
}

function uploadedUrls(files: UploadFile[]) {
  return files
    .filter((file) => file.status === "done")
    .map((file) => file.url)
    .filter((url): url is string => Boolean(url));
}

function sameUrls(left: string[], right: string[]) {
  return left.length === right.length && left.every((url, index) => url === right[index]);
}

export function OrderMediaUpload({ value, onChange, accept, maxCount = 9 }: OrderMediaUploadProps) {
  const allowedTypes = accept === "image" ? imageTypes : mediaTypes;
  const [files, setFiles] = useState<UploadFile[]>(() => filesFromUrls(value));
  const [previewFile, setPreviewFile] = useState<UploadFile>();
  const filesRef = useRef(files);
  const removedUploadIds = useRef(new Set<string>());

  const updateFiles = (next: UploadFile[]) => {
    filesRef.current = next;
    setFiles(next);
  };

  useEffect(() => {
    if (!sameUrls(uploadedUrls(filesRef.current), value)) {
      updateFiles(filesFromUrls(value));
    }
  }, [value]);

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!allowedTypes.includes(file.type)) {
      message.error(accept === "image" ? "仅支持 JPG、PNG、WEBP 图片" : "仅支持 JPG、PNG、WEBP 图片或 MP4 视频");
      return Upload.LIST_IGNORE;
    }
    const maxFileSize = file.type === "video/mp4" ? maxVideoFileSize : maxImageFileSize;
    if (file.size > maxFileSize) {
      message.error(file.type === "video/mp4" ? "视频不能超过 20MB" : "图片不能超过 10MB");
      return Upload.LIST_IGNORE;
    }
    return true;
  };
  const customRequest: UploadProps["customRequest"] = async ({ file, onError, onSuccess }) => {
    const uploadedFile = file as File & { uid?: string };
    const fileUid = uploadedFile.uid ?? uploadedFile.name;
    try {
      if (!filesRef.current.some((item) => item.uid === fileUid) && filesRef.current.length >= maxCount) {
        const error = new Error(`最多上传 ${maxCount} 个素材`);
        message.error(error.message);
        onError?.(error);
        return;
      }
      if (!filesRef.current.some((item) => item.uid === fileUid)) {
        updateFiles([...filesRef.current, { uid: fileUid, name: uploadedFile.name, status: "uploading", type: uploadedFile.type }]);
      }
      const result = await uploadFile(uploadedFile);
      if (removedUploadIds.current.delete(fileUid)) return;
      const current = filesRef.current.filter((item) => item.uid !== fileUid);
      const next = [
        ...current.filter((item) => item.uid !== result.url),
        { uid: result.url, name: result.url.split("/").pop() ?? "素材", status: "done" as const, url: result.url, type: uploadedFile.type },
      ];
      updateFiles(next);
      onChange(uploadedUrls(next));
      onSuccess?.({ url: result.url });
    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error("上传失败");
      updateFiles(filesRef.current.map((item) => item.uid === fileUid ? { ...item, status: "error" } : item));
      message.error(uploadError.message);
      onError?.(uploadError);
    }
  };
  const handleRemove = (file: UploadFile) => {
    if (file.status !== "done") removedUploadIds.current.add(file.uid);
    const next = filesRef.current.filter((item) => item.uid !== file.uid);
    updateFiles(next);
    onChange(uploadedUrls(next));
    return true;
  };

  const previewUrl = previewFile?.url;
  return <>
    <Upload
      listType="picture-card"
      multiple={maxCount > 1}
      maxCount={maxCount}
      accept={accept === "image" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,video/mp4"}
      fileList={files}
      beforeUpload={beforeUpload}
      customRequest={customRequest}
      isImageUrl={(file) => !isVideoFile(file)}
      iconRender={(file) => isVideoFile(file) ? <VideoCameraOutlined /> : undefined}
      onPreview={(file) => { if (file.url) setPreviewFile(file); }}
      onRemove={handleRemove}
      showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
    >
      {files.length >= maxCount ? null : <button type="button" className="upload-add-button" aria-label="上传素材"><PlusOutlined /></button>}
    </Upload>
    <Modal open={Boolean(previewUrl)} title={previewFile && isVideoFile(previewFile) ? "视频预览" : "图片预览"} footer={null} onCancel={() => setPreviewFile(undefined)} destroyOnHidden>
      {previewUrl && (previewFile && isVideoFile(previewFile)
        ? <video controls autoPlay src={previewUrl} style={{ display: "block", maxWidth: "100%", width: "100%" }} />
        : <img src={previewUrl} alt="素材预览" style={{ display: "block", maxWidth: "100%", width: "100%" }} />)}
    </Modal>
  </>;
}
