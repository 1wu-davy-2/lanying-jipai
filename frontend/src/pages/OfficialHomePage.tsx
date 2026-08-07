import { useState } from "react";
import {
  AndroidOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  MenuOutlined,
  RightOutlined,
  WechatOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import { getLatestAndroidRelease } from "../api/appReleases";
import { AppLogo } from "../components/AppLogo";
import { navigateCurrentWindow } from "../utils/navigation";

const highlights = [
  {
    number: "01",
    title: "真实需求，清楚再接",
    description: "订单把样品、拍摄要求、佣金和交付时间写在前面。看明白，再决定。",
  },
  {
    number: "02",
    title: "把拍摄放进日常",
    description: "商家寄样到家。用一张干净的桌面、一段自己的时间，完成每次交付。",
  },
  {
    number: "03",
    title: "每一步都有记录",
    description: "从申请、寄送到素材验收，关键动作都在平台里完成，协作有据可查。",
  },
];

const services = [
  {
    number: "01",
    eyebrow: "FOR MERCHANTS",
    title: "给每一件样品，找合适的镜头",
    description: "创建订单、描述拍摄任务、寄出样品，再在同一条流程里查看交付与验收。让商品内容的协作回到清晰、可追溯的节奏。",
    items: ["按品类发布寄拍需求", "查看达人申请与交付", "在订单内完成验收"],
    image: "/images/brand/home-process-placeholder.svg",
    alt: "寄拍样品与拍摄设备占位图",
  },
  {
    number: "02",
    eyebrow: "FOR TALENTS",
    title: "让认真拍摄，成为可持续的日常",
    description: "从完善资料、浏览订单，到收样、拍摄、上传和寄回，每一步都有明确的下一步。你决定接什么单，也决定自己的节奏。",
    items: ["查看适合自己的订单", "按要求上传拍摄素材", "验收后在平台申请提现"],
    image: "/images/brand/home-process-placeholder.svg",
    alt: "居家创作者整理商品并准备拍摄占位图",
  },
  {
    number: "03",
    eyebrow: "FOR OPERATIONS",
    title: "把协作放在看得见的地方",
    description: "管理端承接商家、订单、争议与提现审核。需要人工介入的节点被沉淀下来，让运营判断有完整上下文。",
    items: ["统一查看订单进度", "处理审核与争议", "保留操作与结算记录"],
    image: "/images/brand/home-process-placeholder.svg",
    alt: "寄拍协作流程占位图",
  },
];

const faqs = [
  {
    question: "寄拍协作是怎样开始的？",
    answer: "商家发布包含样品、拍摄要求和佣金的订单；达人完善资料后查看并申请，审核通过再进入寄样、拍摄、上传、验收与结算的流程。",
  },
  {
    question: "没有摄影经验，可以接单吗？",
    answer: "不要求专业摄影棚。每笔订单都会说明交付要求，新手可以先从自己擅长、要求清楚的订单开始，按要求完成拍摄与上传。",
  },
  {
    question: "佣金和结算在哪里查看？",
    answer: "订单会展示对应佣金。商家验收通过后，佣金进入平台钱包；达人可在钱包页查看流水并按平台流程申请提现。",
  },
  {
    question: "样品和交付素材如何处理？",
    answer: "订单会写明是否需要寄回样品。拍摄素材应在订单内上传，物流信息、留言和异常说明也留在同一条订单记录中。",
  },
  {
    question: "遇到描述不符或沟通问题怎么办？",
    answer: "请先在订单内保留说明与记录。平台管理端提供订单监控和争议处理，用于跟进需要人工介入的协作节点。",
  },
];

export function OfficialHomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [developmentNotice, setDevelopmentNotice] = useState<string | null>(null);
  const [isAndroidDownloadPending, setIsAndroidDownloadPending] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const showDevelopmentNotice = (channel: string) => setDevelopmentNotice(`${channel} 正在开发中，敬请期待。`);
  const downloadAndroidApp = async () => {
    setDevelopmentNotice(null);
    setIsAndroidDownloadPending(true);
    try {
      const release = await getLatestAndroidRelease();
      if (!release) {
        setDevelopmentNotice("Android App 暂未发布，请稍后再试。");
        return;
      }
      navigateCurrentWindow(release.apk_url);
    } catch {
      setDevelopmentNotice("Android App 下载服务暂不可用，请稍后再试。");
    } finally {
      setIsAndroidDownloadPending(false);
    }
  };

  return <main className="official-page">
    <header className="official-header">
      <a className="official-brand" href="#top" aria-label="蓝鹰寄拍首页">
        <AppLogo variant="full" />
      </a>
      <nav className="official-nav" aria-label="主导航">
        <a href="#features">平台特色</a>
        <a href="#how-it-works">如何协作</a>
        <a href="#downloads">软件下载</a>
        <a href="#faq">常见问题</a>
        <a href="#contact">联系我们</a>
      </nav>
      <Link className="official-workspace-link" to="/entry">进入工作台 <ArrowRightOutlined aria-hidden /></Link>
      <button className="official-menu-button" type="button" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        {menuOpen ? <CloseOutlined aria-hidden /> : <MenuOutlined aria-hidden />}
      </button>
    </header>

    {menuOpen && <div className="official-mobile-menu-wrap">
      <button className="official-menu-scrim" type="button" aria-label="关闭导航" onClick={closeMenu} />
      <nav className="official-mobile-menu" aria-label="移动端导航">
        <a href="#features" onClick={closeMenu}>平台特色 <RightOutlined aria-hidden /></a>
        <a href="#how-it-works" onClick={closeMenu}>如何协作 <RightOutlined aria-hidden /></a>
        <a href="#downloads" onClick={closeMenu}>软件下载 <RightOutlined aria-hidden /></a>
        <a href="#faq" onClick={closeMenu}>常见问题 <RightOutlined aria-hidden /></a>
        <a href="#contact" onClick={closeMenu}>联系我们 <RightOutlined aria-hidden /></a>
        <Link to="/entry" onClick={closeMenu}>进入工作台 <ArrowRightOutlined aria-hidden /></Link>
      </nav>
    </div>}

    <section className="official-hero" id="top">
      <div className="official-hero-media">
        <img src="/images/brand/home-hero-placeholder.svg" alt="" />
      </div>
      <div className="official-hero-scrim" aria-hidden="true" />
      <div className="official-hero-copy">
        <h1>蓝鹰寄拍</h1>
        <p className="official-hero-intro">商家寄出真实样品，达人按要求完成拍摄。订单、交付、验收与结算，都留在同一个值得信任的地方。</p>
        <div className="official-hero-actions">
          <Link className="official-button official-button-primary" to="/talent/register">我是达人 <ArrowRightOutlined aria-hidden /></Link>
          <Link className="official-button official-button-secondary" to="/login">发布寄拍 <ArrowRightOutlined aria-hidden /></Link>
        </div>
        <p className="official-hero-note"><CheckOutlined aria-hidden /> 先看要求，再决定是否接单</p>
      </div>
    </section>

    <section className="official-feature-section" id="features">
      <div className="official-section-heading">
        <h2>一件样品的旅程，应该被好好安排</h2>
        <p>不靠模糊口头约定，也不把关键步骤散落在对话里。蓝鹰寄拍为真实协作留出清晰的位置。</p>
      </div>
      <div className="official-feature-grid">
        {highlights.map((item) => <article className="official-feature-card" key={item.number}>
          <span className="official-feature-number">{item.number}</span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <a href="#how-it-works" aria-label={`了解${item.title}`}><ArrowRightOutlined aria-hidden /></a>
        </article>)}
      </div>
    </section>

    <section className="official-stats" aria-label="平台协作数据">
      <dl className="official-stat-list">
        <div><dt>03</dt><dd>商家、达人、运营<br />在同一流程协作</dd></div>
        <div><dt>07</dt><dd>从发单到结算<br />关键节点清晰可见</dd></div>
        <div><dt>01</dt><dd>一条订单记录<br />承接每次沟通与交付</dd></div>
      </dl>
    </section>

    <section className="official-downloads" id="downloads" aria-labelledby="official-downloads-heading">
      <div className="official-downloads-copy">
        <h2 id="official-downloads-heading">把寄拍协作，带在身边</h2>
        <p>Android App 和微信小程序正在准备中。等它们就绪后，订单进展与协作消息也能随时查看。</p>
      </div>
      <div className="official-download-options">
        <button className="official-download-option official-download-android" type="button" aria-label="下载 Android App" aria-busy={isAndroidDownloadPending} disabled={isAndroidDownloadPending} onClick={downloadAndroidApp}>
          <span className="official-download-icon" aria-hidden="true"><AndroidOutlined /></span>
          <span className="official-download-label"><strong>Android App</strong><small>即将提供 APK 下载</small></span>
          <ArrowRightOutlined aria-hidden />
        </button>
        <button className="official-download-option official-download-mini" type="button" aria-label="打开微信小程序" onClick={() => showDevelopmentNotice("微信小程序")}>
          <span className="official-download-icon" aria-hidden="true"><WechatOutlined /></span>
          <span className="official-download-label"><strong>微信小程序</strong><small>即将开放扫码进入</small></span>
          <ArrowRightOutlined aria-hidden />
        </button>
      </div>
    </section>

    <section className="official-process" id="how-it-works">
      <div className="official-process-heading">
        <h2>每一端，都有恰好的下一步</h2>
      </div>
      <div className="official-service-list">
        {services.map((service, index) => <article className={`official-service official-service-${index + 1}`} key={service.number}>
          <div className="official-service-visual">
            <span className="official-service-number">{service.number}</span>
            <div className="official-service-image"><img src={service.image} alt={service.alt} /></div>
            {index === 1 && <span className="official-service-stamp">按要求<br />完成交付</span>}
          </div>
          <div className="official-service-copy">
            <p>{service.eyebrow}</p>
            <h3>{service.title}</h3>
            <span className="official-service-rule" />
            <p className="official-service-description">{service.description}</p>
            <ul>{service.items.map((item) => <li key={item}><CheckOutlined aria-hidden /> {item}</li>)}</ul>
            <Link to={index === 0 ? "/login" : index === 1 ? "/talent/register" : "/admin/login"}>进入对应入口 <ArrowRightOutlined aria-hidden /></Link>
          </div>
        </article>)}
      </div>
    </section>

    <section className="official-faq" id="faq">
      <div className="official-faq-aside">
        <h2>清楚的回答，让开始更轻松</h2>
        <p>关于平台协作、订单交付和结算流程，先把重要的事讲在前面。</p>
        <a href="#contact">还有问题？查看联系入口 <ArrowRightOutlined aria-hidden /></a>
      </div>
      <div className="official-accordion">
        {faqs.map((faq, index) => {
          const isOpen = openFaq === index;
          return <div className={`official-accordion-item ${isOpen ? "is-open" : ""}`} key={faq.question}>
            <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen}>
              <span>{faq.question}</span><DownOutlined aria-hidden />
            </button>
            <div className="official-accordion-answer" hidden={!isOpen}><p>{faq.answer}</p></div>
          </div>;
        })}
      </div>
    </section>

    <footer className="official-footer" id="contact">
      <div className="official-footer-top">
        <div className="official-footer-brand">
          <a className="official-brand" href="#top"><AppLogo variant="full" /></a>
          <p>让真实商品与认真拍摄，在更清楚的流程里相遇。</p>
          <span className="official-footer-quote">“把每一次交付，都放在看得见的地方。”</span>
        </div>
        <div className="official-footer-column">
          <h3>平台</h3>
          <a href="#features">平台特色</a>
          <a href="#how-it-works">如何协作</a>
          <a href="#downloads">软件下载</a>
          <a href="#faq">常见问题</a>
        </div>
        <div className="official-footer-column">
          <h3>入口</h3>
          <Link to="/talent/register">达人注册</Link>
          <Link to="/login">商家登录</Link>
          <Link to="/admin/login">管理端登录</Link>
        </div>
        <div className="official-footer-column official-footer-contact">
          <h3>联系与支持</h3>
          <p>需要处理订单问题时，优先在对应订单内留言，保留完整协作记录。</p>
          <Link to="/entry">进入工作台 <ArrowRightOutlined aria-hidden /></Link>
        </div>
      </div>
      <div className="official-footer-bottom"><span>© 2026 蓝鹰寄拍</span><span>寄拍协作平台</span><a href="#top">回到顶部 <ArrowUpOutlined aria-hidden /></a></div>
    </footer>
    {developmentNotice && <div className="official-development-notice" role="status" aria-live="polite">{developmentNotice}</div>}
  </main>;
}
