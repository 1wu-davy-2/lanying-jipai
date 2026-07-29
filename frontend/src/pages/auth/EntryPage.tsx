import { ArrowRightOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { AuthFrame } from "./AuthFrame";

export function EntryPage() {
  const navigate = useNavigate();

  return (
    <AuthFrame>
      <div className="auth-form-wrap entry-page">
        <Typography.Title level={1}>选择工作台</Typography.Title>
        <Typography.Paragraph className="auth-subtitle">请选择本次进入的业务端</Typography.Paragraph>
        <div className="entry-options">
          <Button className="entry-option" block onClick={() => navigate("/admin/login")}>
            <SettingOutlined className="entry-option-icon" />
            <span><strong>运营管理端</strong><small>代商家发单、订单运营与审核</small></span>
            <ArrowRightOutlined />
          </Button>
          <Button className="entry-option" block onClick={() => navigate("/talent/login")}>
            <UserOutlined className="entry-option-icon" />
            <span><strong>达人端</strong><small>抢单、交付、收入与提现</small></span>
            <ArrowRightOutlined />
          </Button>
        </div>
      </div>
    </AuthFrame>
  );
}
