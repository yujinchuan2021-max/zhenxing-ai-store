async function runEnvironmentInstall({
  environmentId,
  client,
  onState
}) {
  onState({
    stage: "probing",
    message: "正在检测官方下载源…"
  });

  try {
    const result = await client.installEnvironment(environmentId);
    const taskPhase = result.task?.phase;
    onState({
      stage: result.downloaded || taskPhase === "completed"
        ? "ready"
        : taskPhase === "paused"
          ? "paused"
          : taskPhase === "failed"
            ? "download-error"
            : result.task
              ? "downloading"
              : "idle",
      message:
        result.message ||
        result.error ||
        "无法下载该环境的官方安装包或可信镜像"
    });
    return result;
  } catch (error) {
    const result = {
      downloaded: false,
      error: error instanceof Error ? error.message : "环境安装请求失败"
    };
    onState({
      stage: "idle",
      message: result.error
    });
    return result;
  }
}

module.exports = {
  runEnvironmentInstall
};
