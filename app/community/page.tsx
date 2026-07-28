import { HubShell } from "../components/HubShell";

export default function CommunityPage() {
  return (
    <HubShell>
      <header className="pageHeader">
        <p>社区</p>
        <h1>AI Hub 社区</h1>
        <span>社区将使用开源论坛方案搭建。</span>
      </header>
      <section className="simplePanel">
        <h2>论坛站暂未接入</h2>
        <p>确认开源论坛方案后，再在这里接入正式社区。</p>
      </section>
    </HubShell>
  );
}
