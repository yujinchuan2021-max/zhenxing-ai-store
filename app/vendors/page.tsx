"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { HubShell } from "../components/HubShell";
import { vendorCategories, vendors } from "../data";

export default function VendorsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQuery = params.get("q")?.trim().toLowerCase() || "";
  const [category, setCategory] = useState("全部");
  const [letter, setLetter] = useState("全部");

  const visibleVendorEntries = useMemo(
    () =>
      vendors.flatMap((vendor) => {
        if (letter !== "全部" && vendor.initial !== letter) {
          return [];
        }

        const productsInCategory = vendor.products.filter(
          (product) =>
            category === "全部" || product.category === category,
        );
        if (!productsInCategory.length) {
          return [];
        }

        const vendorText = `${vendor.name} ${vendor.description}`.toLowerCase();
        const matchingProducts =
          !initialQuery || vendorText.includes(initialQuery)
            ? productsInCategory
            : productsInCategory.filter((product) =>
                `${product.name} ${product.description}`
                  .toLowerCase()
                  .includes(initialQuery),
              );

        if (!matchingProducts.length) {
          return [];
        }

        return [
          {
            vendor,
            products: matchingProducts,
            category:
              category !== "全部"
                ? category
                : initialQuery &&
                    new Set(
                      matchingProducts.map((product) => product.category),
                    ).size === 1
                  ? matchingProducts[0].category
                  : vendor.category,
          },
        ];
      }),
    [category, initialQuery, letter],
  );

  const letters = ["全部", ...new Set(vendors.map((vendor) => vendor.initial))];

  return (
    <HubShell>
      <header className="pageHeader">
        <p>全部厂商</p>
        <h1>所有 AI 厂商</h1>
        <span>选择厂商后，查看该厂商旗下的全部 AI 产品。</span>
      </header>

      <section className="directoryFilters">
        <div className="filterGroup">
          <b>工具特性</b>
          <div>
            {vendorCategories.map((item) => (
              <button
                key={item}
                className={category === item ? "filter active" : "filter"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="filterGroup">
          <b>厂商排序</b>
          <div>
            {letters.map((item) => (
              <button
                key={item}
                className={letter === item ? "filter active" : "filter"}
                onClick={() => setLetter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="directorySummary">
        <b>{initialQuery ? `“${params.get("q")}” 的搜索结果` : "厂商目录"}</b>
        <span>{visibleVendorEntries.length} 个厂商</span>
      </div>

      <div className="vendorGrid">
        {visibleVendorEntries.map(({ vendor, products, category: cardCategory }) => (
          <Link
            href={`/vendors/${vendor.slug}`}
            className="vendorCard"
            key={vendor.slug}
          >
            <div className="vendorCardTop">
              <span
                className="vendorMark large"
                style={{ background: vendor.color }}
              >
                {vendor.mark}
              </span>
              <span className="vendorCategory">{cardCategory}</span>
            </div>
            <h2>{vendor.name}</h2>
            <p>{vendor.description}</p>
            <div className="productNames">
              {products.map((product) => (
                <span key={product.name}>{product.name}</span>
              ))}
            </div>
            <div className="vendorCardFooter">
              <span>{products.length} 个产品</span>
              <b>查看厂商 →</b>
            </div>
          </Link>
        ))}
      </div>

      {!visibleVendorEntries.length && (
        <div className="emptyState">
          <h2>没有找到符合条件的厂商</h2>
          <button
            onClick={() => {
              setCategory("全部");
              setLetter("全部");
              router.push("/vendors");
            }}
          >
            清除搜索与筛选
          </button>
        </div>
      )}
    </HubShell>
  );
}
