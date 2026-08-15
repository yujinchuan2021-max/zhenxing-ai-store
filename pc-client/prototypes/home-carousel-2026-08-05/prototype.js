// THROWAWAY UI PROTOTYPE — Three home-carousel directions via ?variant=A|B|C.
const slides = [
  { imageUrl: "./assets/constellation.svg", eyebrow: "厂商优先", title: "从可信厂商开始，找到适合你的 AI 工具", description: "浏览桌面端、CLI 与 Web 产品；只在你点击安装后才开始本地检查。", primary: "查看 AI 厂商", secondary: "了解产品入口" },
  { imageUrl: "./assets/aurora-grid.svg", eyebrow: "桌面与本地工具", title: "桌面产品、CLI 与教程，一处看清", description: "每种入口都有明确说明，避免把不同使用方式混在一张卡片里。", primary: "浏览桌面工具", secondary: "查看 CLI" },
  { imageUrl: "./assets/orbit-network.svg", eyebrow: "生态资源商店", title: "先选目标工具，再发现可用资源", description: "Skill、MCP 与插件按兼容目标组织，不把海量资源平铺在首页。", primary: "进入资源商店", secondary: "查看兼容关系" }
];

const variants = {
  A: { name: "星图观测台", description: "选定：固定阅读面 + 右侧全高星图，平衡品牌与工具发现。" },
  B: { name: "信号控制台", description: "超宽横图 + 控制台信息带，偏专业工作台。" },
  C: { name: "轨道编辑页", description: "纵向缩略导航 + 编辑化单栏叙事，偏内容官网。" }
};

let variant = new URLSearchParams(location.search).get("variant")?.toUpperCase() || "A";
if (!variants[variant]) variant = "A";
let active = 0;
let timer = null;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;

function setVariant(next) {
  variant = next;
  const params = new URLSearchParams(location.search);
  params.set("variant", variant);
  history.replaceState(null, "", `${location.pathname}?${params}`);
  render();
}

function setSlide(next, manual = true) {
  active = (next + slides.length) % slides.length;
  if (manual) pause();
  render();
}

function pause() { paused = true; clearInterval(timer); timer = null; }
function play() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  paused = false;
  clearInterval(timer);
  timer = setInterval(() => setSlide(active + 1, false), 7000);
}

function render() {
  clearInterval(timer);
  const slide = slides[active];
  document.querySelector("#app").innerHTML = `
    <div class="prototype-notice">THROWAWAY PROTOTYPE · 不接真实接口、不代表生产页面</div>
    <div class="app-shell theme-dark variant-${variant}">
      <header class="topbar"><div class="brand"><span class="brand-star">✦</span><b>枕星 AI</b><small>ZhenXing AI</small></div><div class="top-actions"><span>搜索厂商或产品</span><button>设置</button><button>登录</button></div></header>
      <div class="workspace"><aside><small>主导航</small><button class="active">✦ 首页</button><button>◇ 全部 AI 厂商</button><button>⌘ 资源商店</button><button>◌ 社区</button></aside>
        <section class="content">
          ${heroMarkup(slide)}
          <section class="below-fold"><div><p>厂商优先</p><h2>从品牌出发，而非海量分类</h2></div><div class="mini-card">OpenAI<br><small>桌面端 · CLI · Web</small></div><div class="mini-card">Anthropic<br><small>桌面端 · CLI</small></div><div class="mini-card">生态资源<br><small>按目标工具浏览</small></div></section>
        </section>
      </div>
    </div>
    <nav class="variant-switcher" aria-label="原型方向切换"><button data-variant="${previousVariant()}" aria-label="上一方向">←</button><span><b>${variant}</b> · ${variants[variant].name}<small>${variants[variant].description}</small></span><button data-variant="${nextVariant()}" aria-label="下一方向">→</button></nav>`;
  wire();
  if (!paused) play();
}

function heroMarkup(slide) {
  const dots = slides.map((item, index) => `<button class="dot ${index === active ? "selected" : ""}" data-slide="${index}" aria-label="显示：${item.title}" aria-current="${index === active ? "true" : "false"}"></button>`).join("");
  const controls = `<div class="carousel-controls"><button data-prev aria-label="上一张">←</button><div class="dots" aria-label="选择轮播页">${dots}</div><button data-next aria-label="下一张">→</button><button data-toggle aria-label="${paused ? "开始自动播放" : "暂停自动播放"}">${paused ? "▶" : "Ⅱ"}</button></div>`;
  const copy = `<div class="hero-copy"><p class="eyebrow">${slide.eyebrow}</p><h1>${slide.title}</h1><p class="description">${slide.description}</p><div class="hero-actions"><button class="primary">${slide.primary} <span>→</span></button><button class="secondary">${slide.secondary}</button></div></div>`;
  const image = `<div class="hero-image" style="background-image:url('${slide.imageUrl}')"><span class="slide-count">0${active + 1} / 0${slides.length}</span></div>`;
  if (variant === "A") return `<section class="hero carousel" aria-label="枕星 AI 推荐内容" tabindex="0">${copy}${image}${controls}</section>`;
  if (variant === "B") return `<section class="hero carousel" aria-label="枕星 AI 推荐内容" tabindex="0">${image}<div class="signal-panel">${copy}${controls}</div></section>`;
  return `<section class="hero carousel" aria-label="枕星 AI 推荐内容" tabindex="0"><div class="orbit-rail">${slides.map((_, i) => `<button class="rail-item ${i === active ? "selected" : ""}" data-slide="${i}">0${i + 1}</button>`).join("")}</div>${image}${copy}${controls}</section>`;
}

function previousVariant() { return ["A", "B", "C"][["A", "B", "C"].indexOf(variant + "") - 1] || "C"; }
function nextVariant() { return ["A", "B", "C"][["A", "B", "C"].indexOf(variant + "") + 1] || "A"; }
function wire() {
  document.querySelectorAll("[data-variant]").forEach((button) => button.onclick = () => setVariant(button.dataset.variant));
  document.querySelectorAll("[data-slide]").forEach((button) => button.onclick = () => setSlide(Number(button.dataset.slide)));
  document.querySelector("[data-prev]").onclick = () => setSlide(active - 1);
  document.querySelector("[data-next]").onclick = () => setSlide(active + 1);
  document.querySelector("[data-toggle]").onclick = () => paused ? play() : pause();
  const carousel = document.querySelector(".carousel");
  carousel.onmouseenter = carousel.onfocusin = pause;
  carousel.onkeydown = (event) => { if (event.key === "ArrowLeft") setSlide(active - 1); if (event.key === "ArrowRight") setSlide(active + 1); };
}
document.addEventListener("keydown", (event) => { if (!/[a-zA-Z]/.test(event.target.tagName) && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) { if (event.key === "ArrowLeft") setVariant(previousVariant()); if (event.key === "ArrowRight") setVariant(nextVariant()); } });
render();
