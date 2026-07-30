function trustedLocalProxy(environment) {
  const candidates = [
    environment.HTTPS_PROXY,
    environment.https_proxy,
    environment.ALL_PROXY,
    environment.all_proxy,
    environment.HTTP_PROXY,
    environment.http_proxy
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    try {
      const url = new URL(candidate);
      if (
        !["http:", "https:", "socks:", "socks5:"].includes(url.protocol) ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        url.username ||
        url.password ||
        !url.port
      ) {
        continue;
      }
      const port = Number(url.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
      return `${url.protocol}//${url.host}`;
    } catch {
      // Ignore malformed environment values.
    }
  }
  return "";
}

module.exports = {
  trustedLocalProxy
};
