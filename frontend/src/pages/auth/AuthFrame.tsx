import type { PropsWithChildren } from "react";
import { CameraOutlined } from "@ant-design/icons";

export function AuthFrame({ children }: PropsWithChildren) {
  return (
    <main className="auth-page">
      <section className="auth-image" aria-label="寄拍摄影素材">
        <div className="auth-image-overlay">
          <span className="auth-mark"><CameraOutlined /> 蓝鹰寄拍</span>
          <p>让每一件商品，都有可信的镜头语言。</p>
        </div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
