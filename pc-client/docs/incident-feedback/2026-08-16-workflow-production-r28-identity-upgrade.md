# Workflow Production r28 Identity 升级

## 目标与边界

把已在 Linux 上通过 prepared-release 校验的 r28 Identity 镜像切换到现有生产栈，同时完成真实备份、隔离恢复演练、迁移核验、公网健康检查和可回滚保留。此次只允许重建 `identity`；Admin、PostgreSQL、MariaDB、Flarum 与 Caddy 不得重建，不清理旧发布、旧镜像、卷或历史备份。

## 冻结输入

- 本地 Git 基线：`be29335e04e081727539ff1497f67a8c8dbba1c6`。
- 新发布目录：`/opt/zhenxing-ai/releases/community-production-r28-d9fa8de8`。
- prepared marker SHA-256：`d64ced04650396deb31502ca6ab247133518f029083f43e2441557117c59aa53`。
- 旧 Identity：`zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e`，image ID `sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748`。
- 新 Identity：`zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8`，image ID `sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01`，source SHA `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8`。
- 受监管控制器 SHA-256：`0cf36acc5f5dbf11d63ffa10d2056401fa93515ff30cde803e02eadff6a1558e`。

## 执行

控制器通过唯一一次 transient systemd 作业 `zhenxing-ai-workflow-production-r28.service` 执行，固定顺序为：

1. 校验 prepared release、当前六个健康服务、旧 Identity 镜像、活动状态哈希和数据库计数。
2. 加载并核对新镜像 ID、非 root 用户和 source label。
3. 运行生产备份并核验 `SHA256SUMS`。
4. 在隔离临时数据库中运行恢复演练。
5. 比对新旧七个 SQL 文件完全相同，仅运行迁移 `verify`，不执行 schema apply。
6. 使用 `--no-deps --no-build --pull never --force-recreate` 只重建 `identity`。
7. 核对其余五个容器 ID、镜像 ID、启动时间和健康状态完全不变，再检查公网入口、更新源和 Workflow 公共列表。

作业状态为 `succeeded/complete`，状态文件 SHA-256 为 `5245ae9128f2d6bee405d33e7cd8e4f35bbff43e65e961458c4ca7ee5c7c6acd`。

## 备份、迁移与健康证据

- 备份：`/opt/zhenxing-ai/shared/backups/community-production-20260815T223340Z`；六个普通文件，`SHA256SUMS` SHA-256 为 `24df78c0baf2cf6a00484d51f8661a5393cf2e8fe2b8fc9af06de54016ae05ce`，逐项复算通过。
- 恢复演练：`restore-drill.txt` SHA-256 `988efb27e40d10226bb9946d158d89f8d137741961c8b5d8950bf42be017585a`。
- 迁移核验：`migration-verify.txt` SHA-256 `7f64f676bf6b5fc007fa32cb835defaa062177ebb8ddc84a6d36f941905de1ee`。
- 服务切换前快照：`services-before.tsv` SHA-256 `881a75d286b71c840c39a1aae675c163c416804c5238f78dd4d8cb6107ed2db7`。
- 服务切换后快照：`services-after.tsv` SHA-256 `99c078182c8d2e689e7d6422b08584fccb2680442419d665534678964c43dc5b`。
- 六个服务最终均为 `running/healthy`；仅 Identity 容器 ID 与镜像 ID发生变化。
- Workflow 数据在切换前后均为 `events=9 / idempotency=9 / head=9`，五张候选资源表仍为 0；活动状态 SHA-256 仍为 `cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012`。
- `https://zhenxingai.com/health` 返回 200；`https://community.zhenxingai.com/` 返回 200；软件更新源 SHA-256 仍为 `8a9628eddc35424639e7b63a4792838df352158755c26ebed334e256e153ca99`；Workflow 公共列表仍为 3 项且无下一页。
- 作业结束后 transient unit、相关进程、恢复/迁移临时容器和 staging 控制器均不存在。

## 可回滚状态

控制器在切换后的任一步失败时，会自动用旧发布配置只重建 Identity 并重新验证六个服务健康。本次没有触发失败回滚，因此状态中的 `rollbackSucceeded=false` 表示“未执行回滚”，不是回滚能力失败。

成功后仍保留旧发布目录和旧镜像。若后续必须人工回滚，使用旧发布的固定 Compose 配置，仅重建 `identity`，随后重复六服务、活动状态、Workflow 计数与公网检查；不得执行 `down`、删除卷或 prune。此次没有为了演示而把健康生产再切回旧版。

固定人工回滚入口为：

```bash
sudo -n /bin/bash -c '
set -euo pipefail
set -a
source /opt/zhenxing-ai/releases/community-production-r25-0967aaaf/deployment/community-production/workflow-production-fresh-host.env.template
set +a
docker compose -p zhenxing-community-production \
  -f /opt/zhenxing-ai/releases/community-production-r25-0967aaaf/deployment/community-production/compose.server.yaml \
  -f /opt/zhenxing-ai/releases/community-production-r25-0967aaaf/deployment/community-production/compose.workflow-production.yaml \
  up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 identity
'
```

该命令不会自动执行；执行前仍须重新确认当前 Identity、备份、旧镜像与旧发布哈希，执行后必须重新跑上述终态检查。

## 防回退

- 升级控制器必须固定旧/新 release、镜像 ID、source SHA、活动状态和更新源哈希。
- 备份与恢复演练必须先于任何服务切换；SQL 相同的版本只允许 `verify`，不得伪造一次迁移 apply。
- 公网社区的真实无副作用检查是站点根路径；现网 `/health` 返回 404，不能把它当作社区故障并触发错误回滚。
- 必须逐服务比较切换前后快照，禁止用“Compose 总体健康”替代“只有 Identity 被重建”的证据。
- 旧发布、旧镜像和已校验备份在后续独立保留策略批准前不得清理。
