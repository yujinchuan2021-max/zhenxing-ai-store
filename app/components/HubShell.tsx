"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";

const navigation = [
  { href: "/", label: "主页", icon: "⌂" },
  { href: "/vendors", label: "全部厂商", icon: "◇" },
];

export function HubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("aihub-theme");
    document.documentElement.dataset.theme =
      savedTheme === "dark" ? "dark" : "light";
  }, []);

  return (
    <main className="site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="枕星 AI 主页">
          <span className="brandMark">枕</span>
          <span>枕星 AI</span>
          <small>AI 工具商店</small>
        </Link>

        <SearchBar
          key={params.get("q") || ""}
          initialQuery={params.get("q") || ""}
        />

        <div className="topbarActions">
          <DesktopDownloadButton />
          <SettingsDropdown />
          <Link className="loginButton" href="/login">
            登录
          </Link>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <p className="sidebarLabel">导航</p>
          <nav className="mainNavigation" aria-label="主导航">
            {navigation.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "navItem active" : "navItem"}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="content">{children}</section>
      </div>

      <footer>
        <div className="footerBrand">
          <span className="brandMark">枕</span>
          <div>
            <b>枕星 AI</b>
            <small>AI 工具商店</small>
          </div>
        </div>
        <p>主页 · 全部厂商</p>
        <span>ZhenXing AI · zhenxingai.com</span>
      </footer>
    </main>
  );
}

export function DesktopDownloadButton({
  hero = false,
}: {
  hero?: boolean;
}) {
  const [showStatus, setShowStatus] = useState(false);

  return (
    <span className={hero ? "downloadAction heroDownload" : "downloadAction"}>
      <button
        type="button"
        className={hero ? "primaryButton" : "desktopDownloadButton"}
        onClick={() => setShowStatus(true)}
      >
        下载桌面版 ↓
      </button>
      {showStatus && (
        <span className="downloadStatus" role="status">
          正式版准备中
        </span>
      )}
    </span>
  );
}

function SettingsDropdown() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<"zh-CN" | "en">("zh-CN");

  const changeTheme = (mode: "light" | "dark") => {
    setTheme(mode);
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem("aihub-theme", mode);
  };

  const changeLanguage = (value: "zh-CN" | "en") => {
    setLanguage(value);
    document.documentElement.lang = value;
    window.localStorage.setItem("aihub-language", value);
  };

  return (
    <details className="settingsDropdown">
      <summary>⚙ 设置</summary>
      <div className="settingsPopover">
        <div className="settingsOption">
          <span>颜色</span>
          <div className="compactSegmented">
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              onClick={() => changeTheme("light")}
            >
              浅色
            </button>
            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              onClick={() => changeTheme("dark")}
            >
              深色
            </button>
          </div>
        </div>
        <div className="settingsOption">
          <span>语言</span>
          <div className="compactSegmented">
            <button
              type="button"
              className={language === "zh-CN" ? "active" : ""}
              onClick={() => changeLanguage("zh-CN")}
            >
              中文
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => changeLanguage("en")}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/vendors?q=${encodeURIComponent(value)}` : "/vendors");
  };

  return (
    <form className="search" onSubmit={submitSearch}>
      <span aria-hidden="true">⌕</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="精准搜索厂商或者产品"
        aria-label="精准搜索厂商或者产品"
      />
      <button type="submit">搜索</button>
    </form>
  );
}
