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
                    {product.requires?.length ? (
                      <div className="requirements">
                        <small>所需环境</small>
                        <b>{product.requires.join("、")}</b>
                      </div>
                    ) : (
                      <div className="requirements">
                        <small>使用方式</small>
                        <b>打开产品官网</b>
                      </div>
                    )}
                    <button>
                      {group === "桌面端"
                        ? "检测环境"
                        : group === "CLI"
                          ? "检测并安装"
                          : "打开产品"}
                    </button>
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
