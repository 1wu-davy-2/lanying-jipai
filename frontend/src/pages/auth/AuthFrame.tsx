import type { PropsWithChildren } from "react";

import { AppLogo } from "../../components/AppLogo";

export function AuthFrame({ children }: PropsWithChildren) {
  return (
    <main className="auth-page">
      <section className="auth-image">
        <img src="/images/brand/auth-creator-placeholder.svg" alt="" />
        <div className="auth-image-overlay">
          <AppLogo variant="mark" size={28} />
          <p>让每一件商品，都有可信的镜头语言。</p>
        </div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
