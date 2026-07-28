"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  vendor: string;
  mark: string;
  color: string;
  category: string;
  description: string;
  platforms: string[];
  verified: boolean;
  featured?: boolean;
};

const products: Product[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "深度求索",
    mark: "D",
    color: "#4268f6",
    category: "AI 对话",
    description: "高效完成推理、写作、翻译与代码任务。",
    platforms: ["Web", "Windows"],
    verified: true,
    featured: true,
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    vendor: "Comfy Org",
    mark: "C",
    color: "#111827",
    category: "图像创作",
    description: "用节点工作流自由搭建专业 AI 图像生成流程。",
    platforms: ["Windows", "开源"],
    verified: true,
    featured: true,
  },
  {
    id: "cursor",
    name: "Cursor",
    vendor: "Anysphere",
    mark: "⌁",
    color: "#201f24",
    category: "编程开发",
    description: "理解代码库并协助编写、修改和排查代码。",
    platforms: ["Windows", "macOS"],
    verified: true,
    featured: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    vendor: "Ollama",
    mark: "O",
    color: "#0d9488",
    category: "本地模型",
    description: "在自己的电脑上运行与管理开源大语言模型。",
    platforms: ["Windows", "CLI"],
    verified: true,
  },
  {
    id: "dify",
    name: "Dify",
    vendor: "LangGenius",
    mark: "D",
    color: "#6f55ef",
    category: "智能体",
    description: "可视化构建 AI 应用、知识库和自动化工作流。",
    platforms: ["Web", "开源"],
    verified: true,
  },
  {
    id: "剪映",
    name: "剪映专业版",
    vendor: "字节跳动",
    mark: "剪",
    color: "#080b12",
    category: "视频创作",
    description: "覆盖剪辑、字幕、配音与智能成片的创作工具。",
    platforms: ["Windows", "macOS"],
    verified: true,
  },
];

const categories = [
  "全部工具",
  "AI 对话",
  "编程开发",
  "图像创作",
  "视频创作",
  "智能体",
  "本地模型",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部工具");
  const [selected, setSelected] = useState<Product | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [dark, setDark] = useState(false);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        category === "全部工具" || product.category === category;
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.vendor} ${product.category}`
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const toggleSaved = (id: string) => {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <main className={dark ? "site dark" : "site"}>
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="AI Hub 首页">
          <span className="brandMark">A</span>
          <span>AI Hub</span>
          <small>可信 AI 工具集市</small>
        </a>

        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工具、厂商或用途"
            aria-label="搜索工具、厂商或用途"
          />
          <kbd>⌘ K</kbd>
        </label>

        <nav className="topActions" aria-label="主导航">
          <a href="#products">发现</a>
          <a href="#environment">环境</a>
          <button
            className="iconButton"
            onClick={() => setDark((value) => !value)}
            aria-label="切换深浅主题"
          >
            {dark ? "☀" : "◐"}
          </button>
          <button className="profileButton" aria-label="打开个人中心">
            游
          </button>
        </nav>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <p className="sidebarLabel">探索</p>
          <div className="categoryList">
            {categories.map((item, index) => (
              <button
                key={item}
                className={category === item ? "category active" : "category"}
                onClick={() => setCategory(item)}
              >
                <span className="categoryIcon" aria-hidden="true">
                  {["✦", "◌", "〈〉", "◇", "▷", "⌘", "⬡"][index]}
                </span>
                {item}
                {index === 0 && <em>{products.length}</em>}
              </button>
            ))}
          </div>

          <div className="sidebarDivider" />
          <p className="sidebarLabel">我的</p>
          <button className="category">
            <span className="categoryIcon">♡</span>
            我的收藏
            <em>{saved.length}</em>
          </button>
          <button className="category">
            <span className="categoryIcon">↓</span>
            下载管理
          </button>

          <div className="communityCard">
            <span>AI HUB 社区</span>
            <h3>和创作者一起探索</h3>
            <p>分享工作流、教程和真实使用体验。</p>
            <button>进入社区 ↗</button>
          </div>
        </aside>

        <section className="content">
          <section className="hero">
            <div className="heroCopy">
              <p className="eyebrow">
                <span>AI HUB 精选</span>
                本周新收录 12 款
              </p>
              <h1>
                找到真正
                <br />
                <i>适合你的 AI</i>
              </h1>
              <p className="heroText">
                从发现到安装，一个地方完成。每款工具都经过来源核验，
                让你少一点折腾，多一点创造。
              </p>
              <div className="heroActions">
                <a href="#products" className="primaryButton">
                  开始探索 <span>→</span>
                </a>
                <button
                  className="secondaryButton"
                  onClick={() => setCategory("本地模型")}
                >
                  查看本地 AI
                </button>
              </div>
            </div>

            <div className="heroVisual" aria-hidden="true">
              <div className="orbit orbitOne" />
              <div className="orbit orbitTwo" />
              <div className="core">
                <span className="coreHalo" />
                <b>AI</b>
                <small>HUB</small>
              </div>
              <div className="floatCard floatTop">
                <span className="miniMark purple">D</span>
                <div>
                  <b>Dify</b>
                  <small>智能体工作流</small>
                </div>
              </div>
              <div className="floatCard floatBottom">
                <span className="miniMark teal">O</span>
                <div>
                  <b>Ollama</b>
                  <small>本地模型就绪</small>
                </div>
                <i>✓</i>
              </div>
              <span className="spark sparkOne">✦</span>
              <span className="spark sparkTwo">✦</span>
            </div>
          </section>

          <section className="filterRow" id="products">
            <div>
              <p className="sectionKicker">CURATED FOR YOU</p>
              <h2>{category === "全部工具" ? "精选 AI 工具" : category}</h2>
            </div>
            <div className="filterPills" aria-label="快捷分类">
              {["全部工具", "编程开发", "图像创作", "视频创作"].map((item) => (
                <button
                  key={item}
                  className={category === item ? "pill active" : "pill"}
                  onClick={() => setCategory(item)}
                >
                  {item.replace("全部工具", "全部")}
                </button>
              ))}
            </div>
          </section>

          {visibleProducts.length ? (
            <div className="productGrid">
              {visibleProducts.map((product) => (
                <article className="productCard" key={product.id}>
                  <div className="productTop">
                    <span
                      className="productMark"
                      style={{ background: product.color }}
                    >
                      {product.mark}
                    </span>
                    <button
                      className={
                        saved.includes(product.id)
                          ? "saveButton saved"
                          : "saveButton"
                      }
                      onClick={() => toggleSaved(product.id)}
                      aria-label={`收藏 ${product.name}`}
                    >
                      {saved.includes(product.id) ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="productTitle">
                    <h3>{product.name}</h3>
                    {product.verified && (
                      <span title="来源已核验" className="verified">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="vendor">{product.vendor}</p>
                  <p className="description">{product.description}</p>
                  <div className="tags">
                    <span>{product.category}</span>
                    {product.platforms.map((platform) => (
                      <span key={platform}>{platform}</span>
                    ))}
                  </div>
                  <div className="cardFooter">
                    <button onClick={() => setSelected(product)}>
                      查看详情
                    </button>
                    <button
                      className="installButton"
                      onClick={() => setSelected(product)}
                    >
                      {product.platforms.includes("Web") ? "立即使用" : "获取"}
                      <span>↗</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="emptyState">
              <span>⌕</span>
              <h3>没有找到匹配的工具</h3>
              <p>换一个关键词，或者返回全部分类看看。</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("全部工具");
                }}
              >
                清除筛选
              </button>
            </div>
          )}

          <section className="environment" id="environment">
            <div className="environmentCopy">
              <span className="statusDot" />
              <p>AI HUB DESKTOP</p>
              <h2>安装之前，先把环境说清楚</h2>
              <span>
                PC 客户端会在获得你的允许后检测依赖，只展示需要处理的项目，
                不会静默执行未知命令。
              </span>
            </div>
            <div className="environmentPanel">
              <div>
                <span className="envIcon ok">✓</span>
                <p>
                  <b>Windows 11</b>
                  <small>系统兼容</small>
                </p>
              </div>
              <div>
                <span className="envIcon ok">✓</span>
                <p>
                  <b>Git 2.47</b>
                  <small>已安装</small>
                </p>
              </div>
              <div>
                <span className="envIcon pending">!</span>
                <p>
                  <b>Python</b>
                  <small>按需安装</small>
                </p>
              </div>
              <button onClick={() => alert("Demo：桌面端将请求授权后再进行检测。")}>
                模拟环境检测
              </button>
            </div>
          </section>
        </section>
      </div>

      <footer>
        <div className="footerBrand">
          <span className="brandMark">A</span>
          <div>
            <b>AI Hub</b>
            <small>让好用的 AI 更容易被发现</small>
          </div>
        </div>
        <p>产品目录 · 厂商入驻 · 安全说明 · 问题反馈</p>
        <span>DEMO · 2026</span>
      </footer>

      {selected && (
        <div className="modalBackdrop" onMouseDown={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} 详情`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modalClose"
              onClick={() => setSelected(null)}
              aria-label="关闭详情"
            >
              ×
            </button>
            <div className="modalHeading">
              <span
                className="productMark large"
                style={{ background: selected.color }}
              >
                {selected.mark}
              </span>
              <div>
                <p>{selected.vendor}</p>
                <h2>{selected.name}</h2>
              </div>
              <span className="sourceBadge">✓ 官方来源已核验</span>
            </div>
            <p className="modalDescription">{selected.description}</p>
            <div className="detailGrid">
              <div>
                <small>产品类型</small>
                <b>{selected.category}</b>
              </div>
              <div>
                <small>支持平台</small>
                <b>{selected.platforms.join(" · ")}</b>
              </div>
              <div>
                <small>获取方式</small>
                <b>官方渠道</b>
              </div>
            </div>
            <div className="safetyNote">
              <span>盾</span>
              <p>
                <b>安全获取</b>
                此 Demo 不会下载或执行任何程序。正式版将在下载前展示来源、
                版本与完整性校验结果。
              </p>
            </div>
            <div className="modalActions">
              <button
                className="secondaryButton"
                onClick={() => toggleSaved(selected.id)}
              >
                {saved.includes(selected.id) ? "已收藏" : "加入收藏"}
              </button>
              <button
                className="primaryButton"
                onClick={() =>
                  alert(`Demo：这里将进入 ${selected.name} 的安全获取流程。`)
                }
              >
                进入获取流程 →
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
