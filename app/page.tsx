import Link from "next/link";
import { HubShell } from "./components/HubShell";
import { vendors } from "./data";

const featured = [
  { vendor: "OpenAI", product: "ChatGPT", slug: "openai" },
  { vendor: "Anthropic", product: "Claude Desktop", slug: "anthropic" },
  { vendor: "Comfy Org", product: "ComfyUI Desktop", slug: "comfy-org" },
  { vendor: "Ollama", product: "Ollama", slug: "ollama" },
];

export default function Home() {
  return (
    <HubShell>
      <section className="homeHero">
        <div className="heroCopy">
          <p className="eyebrow">AI HUB</p>
          <h1>发现并使用适合你的 AI 工具</h1>
          <p>
            从厂商进入，查看该厂商提供的桌面端、CLI 和其他 AI 产品。
          </p>
          <Link href="/vendors" className="primaryButton">
            查看全部厂商 →
          </Link>
        </div>
        <div className="heroGraphic" aria-hidden="true">
          <div className="heroRing ringOne" />
          <div className="heroRing ringTwo" />
          <div className="heroCore">
            <b>AI</b>
            <small>HUB</small>
          </div>
        </div>
      </section>

      <section className="homeSection">
        <div className="sectionHeading">
          <div>
            <p>后台精选</p>
            <h2>精选 AI 工具</h2>
          </div>
          <Link href="/vendors">全部厂商 →</Link>
        </div>

        <div className="featuredGrid">
          {featured.map((item) => {
            const vendor = vendors.find((entry) => entry.slug === item.slug)!;
            return (
              <Link
                href={`/vendors/${item.slug}`}
                className="featuredCard"
                key={`${item.slug}-${item.product}`}
              >
                <span
                  className="vendorMark"
                  style={{ background: vendor.color }}
                >
                  {vendor.mark}
                </span>
                <div>
                  <small>{item.vendor}</small>
                  <h3>{item.product}</h3>
                </div>
                <span className="cardArrow">→</span>
              </Link>
            );
          })}
        </div>
      </section>
    </HubShell>
  );
}
