import Link from "next/link";
import { notFound } from "next/navigation";
import { HubShell } from "../../components/HubShell";
import { getVendor, vendors } from "../../data";

export function generateStaticParams() {
  return vendors.map((vendor) => ({ slug: vendor.slug }));
}

export default async function VendorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendor = getVendor(slug);

  if (!vendor) {
    notFound();
  }

  if (vendor.slug === "openai") {
    return <OpenAIVendorPage />;
  }

  const groups = ["桌面端", "CLI", "其他产品"] as const;

  return (
    <HubShell>
      <Link className="backLink" href="/vendors">
        ← 返回全部厂商
      </Link>

      <section className="vendorHero">
        <span
          className="vendorMark hero"
          style={{ background: vendor.color }}
        >
          {vendor.mark}
        </span>
        <div>
          <p>{vendor.category}</p>
          <h1>{vendor.name}</h1>
          <span>{vendor.description}</span>
        </div>
        <a href={vendor.website} target="_blank" rel="noreferrer">
          厂商官网 ↗
        </a>
      </section>

      <section className="vendorProducts">
        <div className="sectionHeading">
          <div>
            <p>厂商产品</p>
            <h2>{vendor.name} 的所有 AI 产品</h2>
          </div>
        </div>

        {groups.map((group) => {
          const products = vendor.products.filter(
            (product) => product.type === group,
          );
          if (!products.length) return null;

          return (
            <section className="productGroup" key={group}>
              <h3>{group}</h3>
              <div className="productList">
                {products.map((product) => (
                  <article className="productRow" key={product.name}>
                    <div>
                      <h4>{product.name}</h4>
                      <p>{product.description}</p>
                    </div>
                    <div className="platforms">
                      {product.platforms.map((platform) => (
                        <span key={platform}>{platform}</span>
                      ))}
                    </div>
                    <a
                      href={product.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开产品网站
                    </a>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <section className="tutorialBlock">
        <div>
          <p>使用教学</p>
          <h2>{vendor.name} 产品使用教学</h2>
        </div>
        <button>前往教学页面 →</button>
      </section>
    </HubShell>
  );
}

function OpenAIVendorPage() {
  return (
    <HubShell>
      <Link className="backLink" href="/vendors">
        ← 返回全部厂商
      </Link>

      <section className="vendorHero openaiHero">
        <span className="vendorMark hero openaiMark">O</span>
        <div>
          <p>AI 对话 · 编程开发</p>
          <h1>OpenAI</h1>
          <span>
            OpenAI 研发并提供人工智能模型、消费级产品和开发者工具。
          </span>
        </div>
        <a href="https://openai.com" target="_blank" rel="noreferrer">
          厂商官网 ↗
        </a>
      </section>

      <nav className="vendorSectionNav" aria-label="OpenAI 产品导航">
        <a href="#desktop">桌面端</a>
        <a href="#cli">CLI</a>
        <a href="#other">其他产品</a>
        <a href="#tutorials">使用教学</a>
      </nav>

      <section className="openaiSection" id="desktop">
        <div className="openaiSectionHeading">
          <div>
            <p>桌面端</p>
            <h2>ChatGPT 桌面应用</h2>
          </div>
          <span>Windows · macOS</span>
        </div>

        <article className="openaiProductCard">
          <div className="openaiProductMain">
            <span className="productGlyph">C</span>
            <div>
              <h3>ChatGPT</h3>
              <p>
                在桌面端使用 ChatGPT。当前桌面应用包含 Chat、Work 和
                Codex，并支持 Windows 与 macOS。
              </p>
            </div>
          </div>
          <div className="openaiProductFacts">
            <div>
              <small>产品官网</small>
              <a
                href="https://chatgpt.com/download/"
                target="_blank"
                rel="noreferrer"
              >
                chatgpt.com/download ↗
              </a>
            </div>
            <div>
              <small>支持平台</small>
              <b>Windows、macOS</b>
            </div>
            <div>
              <small>Web 端操作</small>
              <b>跳转官方产品页面</b>
            </div>
          </div>
          <div className="openaiProductActions">
            <a
              href="https://chatgpt.com/download/"
              target="_blank"
              rel="noreferrer"
            >
              打开产品网站
            </a>
          </div>
        </article>
      </section>

      <section className="openaiSection" id="cli">
        <div className="openaiSectionHeading">
          <div>
            <p>CLI</p>
            <h2>Codex CLI</h2>
          </div>
          <span>Windows · macOS · Linux</span>
        </div>

        <article className="openaiProductCard">
          <div className="openaiProductMain">
            <span className="productGlyph terminal">›_</span>
            <div>
              <h3>Codex CLI</h3>
              <p>
                运行在终端中的编程智能体，可在本地代码目录中阅读、修改和运行代码。
              </p>
            </div>
          </div>
          <div className="openaiProductFacts">
            <div>
              <small>CLI 官网</small>
              <a
                href="https://github.com/openai/codex"
                target="_blank"
                rel="noreferrer"
              >
                github.com/openai/codex ↗
              </a>
            </div>
            <div>
              <small>安装方式</small>
              <b>官方脚本、npm、Homebrew 或安装包</b>
            </div>
            <div>
              <small>启动命令</small>
              <code>codex</code>
            </div>
          </div>
          <div className="openaiProductActions">
            <a
              href="https://github.com/openai/codex"
              target="_blank"
              rel="noreferrer"
            >
              打开产品网站
            </a>
          </div>
        </article>
      </section>

      <section className="openaiSection" id="other">
        <div className="openaiSectionHeading">
          <div>
            <p>其他产品</p>
            <h2>ChatGPT Web</h2>
          </div>
          <span>Web</span>
        </div>

        <article className="openaiProductCard compact">
          <div className="openaiProductMain">
            <span className="productGlyph web">W</span>
            <div>
              <h3>ChatGPT Web</h3>
              <p>通过浏览器使用 ChatGPT，无需下载安装桌面程序。</p>
            </div>
          </div>
          <div className="openaiProductActions">
            <a href="https://chatgpt.com" target="_blank" rel="noreferrer">
              打开产品官网
            </a>
          </div>
        </article>
      </section>

      <section className="openaiTutorials" id="tutorials">
        <div className="sectionHeading">
          <div>
            <p>使用教学</p>
            <h2>OpenAI 产品使用教学</h2>
          </div>
        </div>
        <div className="tutorialList">
          <a
            href="https://help.openai.com"
            target="_blank"
            rel="noreferrer"
          >
            <span>01</span>
            <div>
              <b>ChatGPT 帮助中心</b>
              <small>查看 ChatGPT 的使用说明</small>
            </div>
            <i>→</i>
          </a>
          <a
            href="https://github.com/openai/codex"
            target="_blank"
            rel="noreferrer"
          >
            <span>02</span>
            <div>
              <b>Codex CLI 入门</b>
              <small>查看安装与启动方式</small>
            </div>
            <i>→</i>
          </a>
          <a href="https://openai.com" target="_blank" rel="noreferrer">
            <span>03</span>
            <div>
              <b>OpenAI 官方网站</b>
              <small>了解厂商与其他产品</small>
            </div>
            <i>→</i>
          </a>
        </div>
      </section>
    </HubShell>
  );
}
