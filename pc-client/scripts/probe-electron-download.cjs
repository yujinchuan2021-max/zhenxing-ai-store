"use strict";

const { app, net, session } = require("electron");
const {
  fetchManagedDownloadResponse,
  refreshManagedDownloadSession
} = require("../shared/managed-download-network.cjs");

const targetUrl =
  process.argv.slice(2).find((value) => /^https:\/\//.test(value)) ||
  "https://github.com/openclaw/openclaw/releases/download/v2026.7.1/OpenClawCompanion-Setup-x64.exe";
const simulateFirstFailure = process.argv.includes("--simulate-first-failure");
const fullRequest = process.argv.includes("--full-request");
const installDefaultCertificateVerifyProc = process.argv.includes(
  "--default-certificate-verify-proc"
);

async function main() {
  await app.whenReady();
  if (installDefaultCertificateVerifyProc) {
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
      callback(-3);
    });
  }
  await refreshManagedDownloadSession({
    networkSession: session.defaultSession
  });
  const resolvedProxy = await session.defaultSession.resolveProxy(targetUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let exitCode = 1;
  let attempts = 0;
  try {
    const response = await fetchManagedDownloadResponse({
      fetchResponse: () => {
        attempts += 1;
        if (simulateFirstFailure && attempts === 1) {
          throw new TypeError("net::ERR_FAILED");
        }
        return net.fetch(targetUrl, {
          method: "GET",
          headers: {
            ...(fullRequest ? {} : { Range: "bytes=0-0" }),
            "User-Agent": "AI-Hub-PC/diagnostic"
          },
          redirect: "follow",
          cache: "no-store",
          signal: controller.signal
        });
      },
      refreshNetwork: ({ retryNumber }) =>
        refreshManagedDownloadSession({
          networkSession: session.defaultSession
        }),
      retries: 3
    });
    const reader = response.body?.getReader();
    const chunk = await reader?.read();
    await reader?.cancel();
    process.stdout.write(
      `${JSON.stringify({
        networkMode: "system",
        resolvedProxy,
        requestMode: fullRequest ? "full" : "range-0-0",
        certificateVerifyProc: installDefaultCertificateVerifyProc,
        attempts,
        status: response.status,
        finalUrl: response.url,
        firstChunkBytes: chunk?.value?.byteLength || 0
      })}\n`
    );
    exitCode = response.ok && chunk?.value?.byteLength ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        networkMode: "system",
        resolvedProxy,
        requestMode: fullRequest ? "full" : "range-0-0",
        certificateVerifyProc: installDefaultCertificateVerifyProc,
        name: error?.name,
        code: error?.code,
        message: error?.message
      })}\n`
    );
  } finally {
    clearTimeout(timeout);
    app.exit(exitCode);
  }
}

void main();
