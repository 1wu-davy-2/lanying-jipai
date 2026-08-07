import type { ThemeConfig } from "antd";

/**
 * 全端共享的 Ant Design 主题。
 * 色值、圆角与字体来自 docs/ui-redesign/01-prd.md 4.2-4.4；
 * 业务组件不得在 JSX 中另建主题或硬编码颜色/尺寸。
 */
export const theme: ThemeConfig = {
  token: {
    // 莓果主色
    colorPrimary: "#B33B5A",
    colorPrimaryHover: "#8F2F48",
    colorPrimaryActive: "#8F2F48",
    // 语义色
    colorInfo: "#3566B8",
    colorSuccess: "#26756F",
    colorWarning: "#8A5700",
    colorError: "#B63B47",
    // 文字与边框
    colorText: "#24212B",
    colorTextSecondary: "#6F6875",
    colorBorder: "#E7E3EA",
    colorBorderSecondary: "#E7E3EA",
    // 背景
    colorBgLayout: "#F7F7FA",
    colorBgContainer: "#FFFFFF",
    // 圆角体系：控件 6px、大容器 8px
    borderRadius: 6,
    borderRadiusLG: 8,
    // 字体与控件
    fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    controlHeight: 40,
  },
};
