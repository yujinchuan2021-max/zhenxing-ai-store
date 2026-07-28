"use client";

import { useState } from "react";
import { HubShell } from "../components/HubShell";

export default function SettingsPage() {
  const [theme, setTheme] = useState("白色");
  const [language, setLanguage] = useState("中文");

  const changeTheme = (value: string) => {
    setTheme(value);
    const mode = value === "黑色" ? "dark" : "light";
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem("aihub-theme", mode);
  };

  return (
    <HubShell>
      <header className="pageHeader">
        <p>设置</p>
        <h1>AI Hub 设置</h1>
      </header>

      <div className="settingsList">
        <section className="settingCard">
          <div>
            <h2>主题颜色</h2>
            <p>选择界面的显示主题。</p>
          </div>
          <div className="segmented">
            {["白色", "黑色"].map((item) => (
              <button
                key={item}
                className={theme === item ? "active" : ""}
                onClick={() => changeTheme(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="settingCard">
          <div>
            <h2>安装包下载位置</h2>
            <p>Web 端调用浏览器或用户默认软件下载。</p>
          </div>
          <button className="outlineButton">使用浏览器默认位置</button>
        </section>

        <section className="settingCard">
          <div>
            <h2>手动环境检测</h2>
            <p>此功能只在 PC 端提供。</p>
          </div>
          <button className="outlineButton" disabled>
            PC 端功能
          </button>
        </section>

        <section className="settingCard">
          <div>
            <h2>语言</h2>
            <p>选择界面语言。</p>
          </div>
          <div className="segmented">
            {["中文", "English"].map((item) => (
              <button
                key={item}
                className={language === item ? "active" : ""}
                onClick={() => setLanguage(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
    </HubShell>
  );
}
