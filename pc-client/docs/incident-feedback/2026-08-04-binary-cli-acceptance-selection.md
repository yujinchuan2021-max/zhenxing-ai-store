# 二进制 CLI 验收脚本忽略产品筛选

## 现象

执行 `node scripts/test-official-binary-cli-artifacts.cjs openfang-cli zeroclaw-cli` 时，脚本仍重复下载并验证了 Amp 与 Daytona。

## 根因

脚本没有解析命令行中的产品 ID，始终遍历完整 `PRODUCTS` 清单。

## 修复

验收入口现在按传入的产品 ID 过滤，并在未知产品或数量不一致时直接失败；不传参数时才运行完整矩阵。

## 验证

OpenFang 与 ZeroClaw 的真实官方包已通过下载跳转、ZIP 边界、文件摘要、版本输出、收据卸载和无关文件哨兵验证。Open Interpreter 的 x64/ARM64 官方 `.tar.gz` 也完成归档摘要、完整多文件树、嵌套入口摘要和 x64 绝对路径版本探针核验，并已加入同一验收矩阵。后续定向重放不再触发清单外产品。

## 预防门

新增二进制 CLI 时必须将产品加入验收矩阵；ZIP 与 `.tar.gz` 目录归档走同一受限路径，保留完整官方目录并检查解压条目数、总字节数和嵌套主入口。日常变更只传本轮产品 ID，完整矩阵留给阶段发布门。
