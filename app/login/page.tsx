import { HubShell } from "../components/HubShell";

export default function LoginPage() {
  return (
    <HubShell>
      <section className="loginPanel">
        <p>登录</p>
        <h1>登录 AI Hub</h1>
        <label>
          账号
          <input placeholder="请输入账号" />
        </label>
        <label>
          密码
          <input type="password" placeholder="请输入密码" />
        </label>
        <button>登录</button>
        <span>还没有账号？注册</span>
      </section>
    </HubShell>
  );
}
