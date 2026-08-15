import styles from "./official-site.module.css";

/* eslint-disable @next/next/no-img-element -- The official site intentionally serves local brand assets without an image optimization service. */

const platforms = [
  {
    name: "Windows",
    state: "联机评审候选",
    detail: "当前仅用于服务连接评审，尚未作为公开版本提供下载。",
    availability: "尚未公开下载",
  },
  {
    name: "macOS",
    state: "开发中",
    detail: "桌面体验正在构建中；公开制品准备好后会在这里同步。",
    availability: "敬请期待",
  },
  {
    name: "Linux",
    state: "开发中",
    detail: "桌面体验正在规划与开发中；不会提供占位下载地址。",
    availability: "敬请期待",
  },
] as const;

const values = [
  {
    number: "01",
    title: "更容易发现",
    copy: "客户端下载后，官方与社区、热门与长尾内容都应被更容易地发现、筛选和理解。",
  },
  {
    number: "02",
    title: "低门槛，不降安全线",
    copy: "收录、理解与投稿可以更容易；可见性不等于自动获得本地执行资格。",
  },
  {
    number: "03",
    title: "透明展示，谨慎执行",
    copy: "高风险内容可以被透明说明和警示；受管安装与自动调用仍须固定合同和用户确认。",
  },
] as const;

export default function Home() {
  return (
    <main className={styles.site} id="top">
      <a className={styles.skipLink} href="#main-content">
        跳到主要内容
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#top" aria-label="枕星 AI 首页">
            <img
              src="/zhenxingai-logo-simple.png"
              alt=""
              width="48"
              height="48"
            />
            <span>
              <b>枕星 AI</b>
              <small>ZHENXING AI</small>
            </span>
          </a>

          <nav className={styles.nav} aria-label="官网导航">
            <a href="#capabilities">理念</a>
            <a href="#downloads">下载</a>
            <a href="#integrity">完整性</a>
            <a href="#community">文档与社区</a>
          </nav>

          <a className={styles.headerCta} href="#downloads">
            查看公开状态 <span aria-hidden="true">↘</span>
          </a>
        </div>
      </header>

      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.ambientOne} />
        <span className={styles.ambientTwo} />
        <span className={styles.ambientThree} />
      </div>

      <section className={styles.hero} id="main-content" tabIndex={-1} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true">✦</span> OBSERVATORY / 01
          </p>
          <h1 id="hero-title">
            在星图里，找到下一步的 <em>AI</em> 能力。
          </h1>
          <p className={styles.lead}>
            枕星 AI 是一座为桌面而生的观测台：用清楚的状态、可信的入口和可验证的发布信息，陪你抵达下一颗星。
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#downloads">
              查看下载状态 <span aria-hidden="true">↓</span>
            </a>
            <a className={styles.secondaryAction} href="#integrity">
              了解发布原则
            </a>
          </div>
          <p className={styles.heroStatus} role="status">
            <span aria-hidden="true" /> 公开桌面版本尚未发布
          </p>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.orbitWide} />
          <div className={styles.coordinate}>
            <span>N 31° 14′</span>
            <span>O 121° 28′</span>
          </div>
          <img
            className={styles.heroMark}
            src="/zhenxingai-logo-starry.png"
            alt=""
            width="1024"
            height="1024"
          />
          <span className={styles.starOne}>✦</span>
          <span className={styles.starTwo}>✦</span>
          <span className={styles.starThree}>✦</span>
          <div className={styles.readout}>
            <span>STATUS</span>
            <b>LOCAL REVIEW</b>
          </div>
        </div>
      </section>

      <section className={styles.valueSection} id="capabilities" aria-labelledby="value-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>WHY ZHENXING</p>
          <h2 id="value-title">让更多人进来，但不让安全线后退。</h2>
          <p className={styles.sectionLead}>
            官网只负责让三个客户端下载路径清楚可信；资源的发现、筛选、理解与投稿会在客户端下载后完成，而不是被做成网页商店镜像。
          </p>
        </div>
        <div className={styles.valueGrid}>
          {values.map((value) => (
            <article className={styles.valueCard} key={value.number}>
              <span>{value.number}</span>
              <h3>{value.title}</h3>
              <p>{value.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.downloadSection} id="downloads" aria-labelledby="download-title">
        <div className={styles.downloadHeading}>
          <div>
            <p className={styles.eyebrow}>DESKTOP DOWNLOADS</p>
            <h2 id="download-title">三个系统，始终由你选择。</h2>
          </div>
          <p>
            我们不会自动识别你的系统、自动跳转或隐藏其他平台。只有真实公开的制品，才会成为可点击下载。
          </p>
        </div>

        <div className={styles.platformGrid}>
          {platforms.map((platform) => (
            <article className={styles.platformCard} key={platform.name}>
              <div className={styles.platformTopline}>
                <span className={styles.platformGlyph} aria-hidden="true">✦</span>
                <span>{platform.state}</span>
              </div>
              <h3>{platform.name}</h3>
              <p>{platform.detail}</p>
              <div className={styles.platformAvailability} role="status">
                <span aria-hidden="true" /> {platform.availability}
              </div>
            </article>
          ))}
        </div>

        <p className={styles.downloadNote}>
          公开版本发布后，每个平台卡片都会明确列出版本号、文件名、大小、SHA-256、签名状态与官方 HTTPS 地址。
        </p>
      </section>

      <section className={styles.integritySection} id="integrity" aria-labelledby="integrity-title">
        <div className={styles.integrityIntro}>
          <p className={styles.eyebrow}>RELEASE INTEGRITY</p>
          <h2 id="integrity-title">下载不是一个神秘按钮。</h2>
          <p>
            公开交付前，我们宁可显示真实状态，也不会用演示链接、占位包或不完整信息制造“已经上线”的错觉。
          </p>
        </div>
        <ol className={styles.integrityList}>
          <li>
            <span>01</span>
            <div>
              <b>先有可验证制品</b>
              <p>版本、平台、文件名与大小先被明确记录。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <b>再公开完整性信息</b>
              <p>SHA-256、签名状态和官方 HTTPS 地址一起出现。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <b>最后才开放下载</b>
              <p>没有通过这三步的候选，不会在官网被包装成正式版。</p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.communitySection} id="community" aria-labelledby="community-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>NEXT SIGNAL</p>
          <h2 id="community-title">文档与社区，等有了真实入口再打开。</h2>
          <p className={styles.sectionLead}>
            公开文档、社区和状态页正在准备中。它们开放时会在这里提供官方入口，而不是提前放置无效链接。
          </p>
        </div>
        <div className={styles.communityGrid}>
          <article>
            <span>DOCS</span>
            <h3>发布与完整性说明</h3>
            <p>将记录可公开版本的下载信息、验证方式与已知状态。</p>
            <b>公开入口准备中</b>
          </article>
          <article>
            <span>COMMUNITY</span>
            <h3>同行的观测记录</h3>
            <p>社区开放后，枕星 AI PC 内外将使用明确且可信的进入方式。</p>
            <b>公开入口准备中</b>
          </article>
        </div>
      </section>

      <footer className={styles.footer} id="release-status">
        <div className={styles.footerBrand}>
          <img src="/zhenxingai-logo-simple.png" alt="" width="44" height="44" />
          <div>
            <b>枕星 AI</b>
            <span>让每一次下载，都从一份可验证的说明开始。</span>
          </div>
        </div>
        <div className={styles.footerStatus}>
          <span>当前状态</span>
          <b>公开桌面版本尚未发布</b>
        </div>
        <a className={styles.backToTop} href="#top">回到星图顶部 ↑</a>
      </footer>
    </main>
  );
}
