"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";

const navigation = [
  { href: "/", label: "主页", icon: "⌂" },
  { href: "/vendors", label: "全部厂商", icon: "◇" },
  { href: "/community", label: "社区", icon: "◎" },
  { href: "/settings", label: "设置", icon: "⚙" },
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
        <Link className="brand" href="/" aria-label="AI Hub 主页">
          <span className="brandMark">A</span>
          <span>AI Hub</span>
          <small>AI 工具商店</small>
        </Link>

        <SearchBar
          key={params.get("q") || ""}
          initialQuery={params.get("q") || ""}
        />

        <Link className="loginButton" href="/login">
          登录
        </Link>
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
          <span className="brandMark">A</span>
          <div>
            <b>AI Hub</b>
            <small>AI 工具商店</small>
          </div>
        </div>
        <p>主页 · 全部厂商 · 社区 · 设置</p>
        <span>DEMO · 2026</span>
      </footer>
    </main>
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
