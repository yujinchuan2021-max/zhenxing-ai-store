"use strict";

// This is the client-owned execution whitelist for reviewed Windows desktop
// products. The backend may select one of these profiles, but it cannot add a
// URL, signer, executable or uninstall command at runtime.

const MB = 1024 * 1024;
const GB = 1024 * MB;

function freezeList(values) {
  return Object.freeze([...values]);
}

function reviewedDesktop(input) {
  const capabilities = freezeList([
    "website",
    "tutorial",
    "install",
    "open",
    "uninstall"
  ]);
  return Object.freeze({
    ...input,
    requirements: freezeList(input.requirements || []),
    capabilities,
    download: Object.freeze({
      ...input.download,
      allowedHosts: freezeList(input.download.allowedHosts),
      safetyReserveBytes: input.download.safetyReserveBytes || 512 * MB,
      installDiskBytes: input.download.installDiskBytes || 2 * GB
    }),
    adapter: Object.freeze({
      ...input.adapter,
      names: freezeList(input.adapter.names),
      closeProcessStrategy: input.adapter.closeProcessStrategy || "graceful",
      closeProcessNames: freezeList(input.adapter.closeProcessNames || []),
      executableNames: freezeList(input.adapter.executableNames || []),
      uninstall: input.adapter.uninstall
        ? Object.freeze({
            ...input.adapter.uninstall,
            allowedArguments: Object.freeze(
              (input.adapter.uninstall.allowedArguments || [[]]).map(freezeList)
            ),
            launchArguments: freezeList(
              input.adapter.uninstall.launchArguments || []
            )
          })
        : undefined
    })
  });
}

function innoAdapter({
  names,
  signer,
  publisher,
  executables,
  uninstallSha256 = "",
  uninstallMode = "interactive",
  uninstallLifecycle = "detached",
  uninstallArguments = [],
  uninstallAllowedArguments = [[], ["/SILENT"]],
  closeProcessStrategy = "graceful"
}) {
  return {
    names,
    presenceEvidence: "trusted-install-identity",
    uninstallMode,
    uninstallLifecycle,
    signer,
    closeProcessStrategy,
    closeProcessNames: executables,
    executableNames: executables,
    uninstall: {
      displayName: new RegExp(`^(?:${names.map(escapeRegex).join("|")})(?:\\s+.*)?$`, "i"),
      publisher,
      executableName: /^unins\d*\.exe$/i,
      allowedArguments: uninstallAllowedArguments,
      launchWithoutArguments: true,
      launchArguments: uninstallArguments,
      ...(uninstallSha256 ? { expectedSha256: uninstallSha256 } : {}),
      allowMsi: false
    }
  };
}

function nsisAdapter({
  names,
  signer,
  publisher,
  publisherOverride,
  executables,
  uninstallExecutable = /^(?:Uninstall(?: .+)?|uninstall)\.exe$/i,
  uninstallArguments = [[], ["/currentuser"], ["/allusers"]],
  launchWithoutArguments = true,
  installerLifecycle = "detached"
}) {
  return {
    names,
    presenceEvidence: "trusted-install-identity",
    installerLifecycle,
    uninstallMode: "interactive",
    signer,
    closeProcessNames: executables,
    executableNames: executables,
    uninstall: {
      displayName: new RegExp(`^(?:${names.map(escapeRegex).join("|")})(?:\\s+.*)?$`, "i"),
      publisher: publisherOverride || publisher,
      executableName: uninstallExecutable,
      allowedArguments: uninstallArguments,
      launchWithoutArguments,
      allowMsi: false
    }
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WINDOWS_DESKTOP_PRODUCTS = Object.freeze({
  jianying: reviewedDesktop({
    label: "剪映专业版",
    profileId: "desktop.jianying.windows",
    vendorId: "bytedance",
    adapterId: "windows.jianying",
    download: {
      url: "https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_11_1_0_14287_jianyingpro_0_creatortool.exe",
      fileName: "Jianying-11.1.0.14287-Windows-x64.exe",
      allowedHosts: ["lf3-package.vlabstatic.com"],
      expectedSha256: "439ea7cb0fd6815806fe952b82aa28142cc0461214d60fdd30dd5d3e8006f579",
      expectedSigner: /^CN=深圳市脸萌科技有限公司(?:,|$)/i,
      installDiskBytes: 8 * GB
    },
    adapter: innoAdapter({
      names: ["剪映专业版", "JianyingPro"],
      signer: /^CN=深圳市脸萌科技有限公司(?:,|$)/i,
      publisher: /^深圳市脸萌科技有限公司$/i,
      executables: ["JianyingPro.exe"]
    })
  }),
  "trae-desktop": reviewedDesktop({
    label: "TRAE",
    profileId: "desktop.trae-cn.windows",
    vendorId: "bytedance",
    adapterId: "windows.trae-cn",
    download: {
      url: "https://lf-cdn.trae.com.cn/obj/trae-com-cn/pkg/app/releases/stable/2.3.62837/win32/Trae_CN-Setup-x64.exe",
      fileName: "TRAE-CN-2.3.62837-Windows-x64.exe",
      allowedHosts: ["lf-cdn.trae.com.cn"],
      expectedSha256: "2fc70f0a68f5269e232d8aa92c5ca4b3f7514a34bb321ea2784a9c2ff8428379",
      expectedSigner: /^CN=北京引力弹弓科技有限公司(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["Trae CN", "TRAE CN", "TRAE"],
      signer: /^CN=北京引力弹弓科技有限公司(?:,|$)/i,
      publisher: /^(?:北京引力弹弓科技有限公司|Beijing Yinli Catapult Technology Co\., Ltd\.)$/i,
      executables: ["Trae CN.exe", "Trae.exe"]
    })
  }),
  "trae-solo-cn": reviewedDesktop({
    label: "TRAE Work",
    profileId: "desktop.trae-solo-cn.windows",
    vendorId: "bytedance",
    adapterId: "windows.trae-solo-cn",
    download: {
      url: "https://lf-cdn.trae.com.cn/obj/trae-com-cn/pkg/app/releases/stable/2.3.62834/win32/TRAE_Work_CN-Setup-x64.exe",
      fileName: "TRAE-Work-CN-2.3.62834-Windows-x64.exe",
      allowedHosts: ["lf-cdn.trae.com.cn"],
      expectedSha256: "f15b4430d74195156f37de03164c6f27e14306024f1e0962aa9dab2084bce8e1",
      expectedSigner: /^CN=北京引力弹弓科技有限公司(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["TRAE Work CN", "TRAE Work", "TRAE SOLO CN"],
      signer: /^CN=北京引力弹弓科技有限公司(?:,|$)/i,
      publisher: /^(?:北京引力弹弓科技有限公司|Beijing Yinli Catapult Technology Co\., Ltd\.)$/i,
      executables: ["TRAE Work CN.exe", "TRAE Work.exe"]
    })
  }),
  "bytedance-doubao": reviewedDesktop({
    label: "豆包桌面版",
    profileId: "desktop.doubao.windows",
    vendorId: "bytedance",
    adapterId: "windows.doubao",
    download: {
      url: "https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao_pc/2.20.9/Doubao_installer_2.20.9.exe",
      fileName: "Doubao-2.20.9-Windows-x64.exe",
      allowedHosts: ["lf-flow-web-cdn.doubao.com"],
      expectedSha256: "7269365d3ecd4d432b9ef685f44de92ac02af384b7d8c2f781809fcc989434ed",
      expectedSigner: /^CN=北京春田知韵科技有限公司(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["豆包", "Doubao"],
      signer: /^CN=北京春田知韵科技有限公司(?:,|$)/i,
      publisher: /^(?:北京春田知韵科技有限公司|Beijing Chuntian Zhiyun Technology Co\., Ltd\.)$/i,
      executables: ["Doubao.exe"]
    })
  }),
  "google-antigravity-desktop": reviewedDesktop({
    label: "Google Antigravity 2.0",
    profileId: "desktop.google-antigravity.windows",
    vendorId: "google",
    adapterId: "windows.google-antigravity",
    download: {
      url: "https://storage.googleapis.com/antigravity-public/antigravity-hub/2.4.3-4510119262814208/windows-x64/Antigravity-x64.exe",
      fileName: "Google-Antigravity-2.4.3-Windows-x64.exe",
      allowedHosts: ["storage.googleapis.com"],
      expectedSha256: "82dc656c6922ec52b7c1e6c1475464a4fdb0dd7bded00b596e6a490405e22d50",
      expectedSigner: /^CN=Google LLC(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["Antigravity", "Google Antigravity"],
      signer: /^CN=Google LLC(?:,|$)/i,
      publisher: /^Google LLC$/i,
      executables: ["Antigravity.exe"]
    })
  }),
  "cursor-desktop": reviewedDesktop({
    label: "Cursor",
    profileId: "desktop.cursor.windows",
    vendorId: "anysphere",
    adapterId: "windows.cursor",
    download: {
      url: "https://downloads.cursor.com/production/a758f2241ca99fecf380180b6cbdbbce0f1f42cf/win32/x64/user-setup/CursorUserSetup-x64-3.14.7.exe",
      fileName: "Cursor-3.14.7-Windows-x64.exe",
      allowedHosts: ["downloads.cursor.com"],
      expectedSha256: "93b3ad1b9971c8ff9be18fc9c46d592749e47ea6d2e3711efe6d5a9d4091877f",
      expectedSigner: /^CN="?Anysphere, Inc\."?(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["Cursor"],
      signer: /^CN="?Anysphere, Inc\."?(?:,|$)/i,
      publisher: /^(?:Anysphere|Anysphere, Inc\.)$/i,
      executables: ["Cursor.exe"]
    })
  }),
  "kimi-work-desktop": reviewedDesktop({
    label: "Kimi Work（Windows）",
    profileId: "desktop.kimi.windows",
    vendorId: "moonshot",
    adapterId: "windows.kimi",
    download: {
      url: "https://kimi-img.moonshot.cn/app/download/windows/kimi_3.1.6.exe",
      fileName: "Kimi-Work-3.1.6-Windows-x64.exe",
      allowedHosts: ["kimi-img.moonshot.cn"],
      expectedSha256: "14edbc1bae32880bebef4937e918695b4ccb36077c084edf0eacc66cc811aec5",
      expectedSigner: /^CN=北京月之暗面科技有限公司(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["Kimi"],
      signer: /^CN=北京月之暗面科技有限公司(?:,|$)/i,
      publisher: /^(?:北京月之暗面科技有限公司|Beijing Yuezhi Dark Face Technology Co\., Ltd\.)$/i,
      executables: ["Kimi.exe"]
    })
  }),
  "alibaba-qwen-studio": reviewedDesktop({
    label: "千问桌面版",
    profileId: "desktop.qwen.windows",
    vendorId: "alibaba",
    adapterId: "windows.qwen",
    download: {
      url: "https://umcdn.qianwen.com/download/37270/qianwenpc/pcqwen@default/QianwenPC_V3.7.5.145_pc_pf3000_(zh-cn)_releasemini_(Build2901209-1001-x64).exe",
      fileName: "Qianwen-3.7.5.145-Windows-x64.exe",
      allowedHosts: ["umcdn.qianwen.com"],
      expectedSha256: "5e6c92f79eb0ddc735df6365dc5646b6401fb2f7017c3552d27740a36f8f2921",
      expectedSigner: /^CN="?ALIBABA \(CHINA\) NETWORK TECHNOLOGY CO\.,LTD\."?(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["千问", "Qwen", "Tongyi"],
      signer: /^CN="?ALIBABA \(CHINA\) NETWORK TECHNOLOGY CO\.,LTD\."?(?:,|$)/i,
      publisher: /^(?:Alibaba Group|阿里巴巴.*)$/i,
      executables: ["Qwen.exe", "tongyi.exe"]
    })
  }),
  "alibaba-qoder-cn-ide": reviewedDesktop({
    label: "Qoder CN IDE",
    profileId: "desktop.qoder-cn.windows",
    vendorId: "alibaba",
    adapterId: "windows.qoder-cn",
    download: {
      url: "https://qoder-ide.oss-accelerate.aliyuncs.com/release/1.20.1/QoderUserSetup-x64.exe",
      fileName: "Qoder-CN-Windows-x64.exe",
      allowedHosts: ["qoder-ide.oss-accelerate.aliyuncs.com"],
      expectedSha256: "99c629dc111df2bea974e0c077a690b06f7651b95e4039ed01d9a60e51119aa4",
      expectedSigner: /^CN=BRIGHT ZENITH PRIVATE LIMITED(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["Qoder"],
      signer: /^CN=BRIGHT ZENITH PRIVATE LIMITED(?:,|$)/i,
      publisher: /^Qoder$/i,
      executables: ["Qoder.exe"]
    })
  }),
  "alibaba-qoderwork-cn": reviewedDesktop({
    label: "QoderWork CN",
    profileId: "desktop.qoderwork-cn.windows",
    vendorId: "alibaba",
    adapterId: "windows.qoderwork-cn",
    download: {
      url: "https://download.qoder.com.cn/qoder-work/releases/latest/QoderWork-Setup-User-x64.exe",
      fileName: "QoderWork-Windows-x64.exe",
      allowedHosts: ["download.qoder.com.cn"],
      expectedSigner: /^CN=BRIGHT ZENITH PRIVATE LIMITED(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["QoderWork", "Qoder Work"],
      signer: /^CN=BRIGHT ZENITH PRIVATE LIMITED(?:,|$)/i,
      publisher: /^Qoder$/i,
      executables: ["QoderWork.exe", "Qoder Work.exe"]
    })
  }),
  "tencent-yuanbao-desktop": reviewedDesktop({
    label: "腾讯元宝电脑版",
    profileId: "desktop.tencent-yuanbao.windows",
    vendorId: "tencent",
    adapterId: "windows.tencent-yuanbao",
    download: {
      url: "https://cdn-hybrid-prod.hunyuan.tencent.com/Desktop/official/dc75c2246b0b13c1ef8a120d56b297cf/yuanbao_2.77.1.612_x64.exe",
      fileName: "Tencent-Yuanbao-2.77.1-Windows-x64.exe",
      allowedHosts: ["cdn-hybrid-prod.hunyuan.tencent.com"],
      expectedSha256: "d3c7455cb9edfb70063c95f4b5ff36f980d4e299e07ccdd321304b537238ca51",
      expectedSigner: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["腾讯元宝", "Yuanbao"],
      signer: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i,
      publisher: /^(?:腾讯科技\(深圳\)有限公司|Tencent Technology \(Shenzhen\) Company Limited)$/i,
      executables: ["yuanbao.exe", "Yuanbao.exe"]
    })
  }),
  "tencent-codebuddy": reviewedDesktop({
    label: "CodeBuddy",
    profileId: "desktop.tencent-codebuddy.windows",
    vendorId: "tencent",
    adapterId: "windows.tencent-codebuddy",
    download: {
      url: "https://codebuddy-1328495429.cos.accelerate.myqcloud.com/aiide/win32-x64-user/CodeBuddy-win32-x64-user-4.10.4.33993995-1ba59196.exe",
      fileName: "CodeBuddy-4.10.4-Windows-x64.exe",
      allowedHosts: ["codebuddy-1328495429.cos.accelerate.myqcloud.com"],
      expectedSha256: "fdb7342d8bb93c35b659cf67fd00ddeb8b7aa9747fbd0ad9e60bc4ae2791fd04",
      expectedSigner: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["CodeBuddy"],
      signer: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i,
      publisher: /^(?:Microsoft Corporation|Tencent Technology \(Shenzhen\) Company Limited)$/i,
      executables: ["CodeBuddy.exe"]
    })
  }),
  "tencent-workbuddy": reviewedDesktop({
    label: "WorkBuddy",
    profileId: "desktop.tencent-workbuddy.windows",
    vendorId: "tencent",
    adapterId: "windows.tencent-workbuddy",
    download: {
      url: "https://download.codebuddy.cn/workbuddy/saas/win32-x64-user/WorkBuddy-win32-x64-user-5.3.8.34705286-e9991e2b.exe",
      fileName: "WorkBuddy-5.3.8-Windows-x64.exe",
      allowedHosts: ["download.codebuddy.cn"],
      expectedSha256: "c111bc3f54a0e53fa04924313ae660125eebffafcd5ac7722da7c3c03402cb7a",
      expectedSigner: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["WorkBuddy"],
      signer: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i,
      publisher: /^Tencent Technology \(Shenzhen\) Company Limited$/i,
      executables: ["WorkBuddy.exe"]
    })
  }),
  "tencent-qclaw": reviewedDesktop({
    label: "QClaw",
    profileId: "desktop.tencent-qclaw.windows",
    vendorId: "tencent",
    adapterId: "windows.tencent-qclaw",
    download: {
      url: "https://package-cdn.qclaw.qq.com/qclaw/win/0.2.35-5001-624/QClaw-Setup-0.2.35-5001-624.exe",
      fileName: "QClaw-0.2.35-Windows.exe",
      allowedHosts: ["package-cdn.qclaw.qq.com"],
      expectedSha256: "ee14abf8cab6b71359b1c7970c0cf9eadc047a01af63319dec614509e7de1c88",
      expectedSigner: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["QClaw"],
      signer: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i,
      publisher: /^(?:腾讯科技\(深圳\)有限公司|Tencent Technology \(Shenzhen\) Company Limited)$/i,
      executables: ["QClaw.exe"]
    })
  }),
  "tencent-ima": reviewedDesktop({
    label: "ima",
    profileId: "desktop.tencent-ima.windows",
    vendorId: "tencent",
    adapterId: "windows.tencent-ima",
    download: {
      url: "https://app-dl.ima.qq.com/win_channel/ima.copilot_win_x64_1018_2.6.3_4813.exe",
      fileName: "ima-2.6.3-Windows-x64.exe",
      allowedHosts: ["app-dl.ima.qq.com"],
      expectedSha256: "14102bc92f815463905c9a7fe65137f1a2d4297fb733c827db011cd6dcc3d45f",
      expectedSigner: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["ima", "ima.copilot"],
      signer: /^CN=Tencent Technology \(Shenzhen\) Company Limited(?:,|$)/i,
      publisher: /^(?:腾讯科技\(深圳\)有限公司|Tencent Technology \(Shenzhen\) Company Limited)$/i,
      executables: ["ima.exe", "ima.copilot.exe"],
      publisherOverride: /^(?:The ima\.copilot Authors|Tencent Technology \(Shenzhen\) Company Limited)$/i,
      uninstallExecutable: /^ImaUninstall\.exe$/i,
      uninstallArguments: [["--uninstall", "--verbose-logging"]],
      launchWithoutArguments: true,
      installerLifecycle: "foreground"
    })
  }),
  "lm-studio-desktop": reviewedDesktop({
    label: "LM Studio",
    profileId: "desktop.lm-studio.windows",
    vendorId: "lmstudio",
    adapterId: "windows.lm-studio",
    download: {
      url: "https://installers.lmstudio.ai/win32/x64/0.4.20-1/LM-Studio-0.4.20-1-x64.exe",
      fileName: "LM-Studio-0.4.20-1-Windows-x64.exe",
      allowedHosts: ["installers.lmstudio.ai"],
      expectedSha256: "cae7b4a3dbdf97252f35d2d2d1b70e81415f1aac92b3e4779994bdec84ec067d",
      expectedSigner: /^CN=Element Labs Inc\.(?:,|$)/i,
      installDiskBytes: 6 * GB
    },
    adapter: nsisAdapter({
      names: ["LM Studio"],
      signer: /^CN=Element Labs Inc\.(?:,|$)/i,
      publisher: /^(?:LM Studio|Element Labs Inc\.?)$/i,
      executables: ["LM Studio.exe"]
    })
  }),
  "gpt4all-desktop": reviewedDesktop({
    label: "GPT4All Desktop",
    profileId: "desktop.gpt4all.windows",
    vendorId: "nomic",
    adapterId: "windows.gpt4all",
    download: {
      url: "https://github.com/nomic-ai/gpt4all/releases/download/v3.10.0/gpt4all-installer-win64-v3.10.0.exe",
      fileName: "GPT4All-3.10.0-Windows-x64.exe",
      allowedHosts: ["github.com", "release-assets.githubusercontent.com"],
      expectedSha256: "e284f2d72cf0026dc49c3dce8b5f1a19c088737b36e37bc8e0d48b668926ef52",
      expectedSigner: /^CN="?Nomic, Inc"?(?:,|$)/i,
      installDiskBytes: 6 * GB
    },
    adapter: {
      names: ["GPT4All"],
      presenceEvidence: "trusted-install-identity",
      uninstallMode: "interactive",
      uninstallLifecycle: "foreground",
      signer: /^CN="?Nomic, Inc"?(?:,|$)/i,
      closeProcessNames: ["GPT4All.exe", "chat.exe"],
      executableNames: ["GPT4All.exe", "chat.exe"],
      uninstall: {
        displayName: /^GPT4All(?:\s+.*)?$/i,
        publisher: /^(?:Nomic|Nomic, Inc)$/i,
        executableName: /^maintenancetool\.exe$/i,
        allowedArguments: [[], ["--start-uninstaller"]],
        launchArguments: ["--start-uninstaller"],
        launchWithoutArguments: true,
        allowMsi: false
      }
    }
  }),
  "anythingllm-desktop": reviewedDesktop({
    label: "AnythingLLM Desktop",
    profileId: "desktop.anythingllm.windows",
    vendorId: "mintplex",
    adapterId: "windows.anythingllm",
    download: {
      url: "https://cdn.anythingllm.com/latest/AnythingLLMDesktop.exe",
      fileName: "AnythingLLM-Desktop-Windows-x64.exe",
      allowedHosts: ["cdn.anythingllm.com"],
      expectedSigner: /^CN=Mintplex Labs Inc(?:,|$)/i,
      installDiskBytes: 6 * GB
    },
    adapter: nsisAdapter({
      names: ["AnythingLLM", "AnythingLLM Desktop"],
      signer: /^CN=Mintplex Labs Inc(?:,|$)/i,
      publisher: /^Mintplex Labs Inc\.?$/i,
      executables: ["AnythingLLM.exe", "AnythingLLM Desktop.exe"]
    })
  }),
  "amazon-kiro-ide": reviewedDesktop({
    label: "Kiro IDE",
    profileId: "desktop.amazon-kiro.windows",
    vendorId: "amazon",
    adapterId: "windows.amazon-kiro",
    download: {
      url: "https://prod.download.desktop.kiro.dev/releases/stable/win32-x64/signed/1.0.242/kiro-ide-1.0.242-stable-win32-x64.exe",
      fileName: "Kiro-1.0.242-Windows-x64.exe",
      allowedHosts: ["prod.download.desktop.kiro.dev"],
      expectedSha256: "20b68942d4d4002ab49747f43abdd26ea99367811aebf5fa7a5cc4e1337a780c",
      expectedSigner: /^CN="?Amazon\.com, Inc\."?(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["Kiro"],
      signer: /^CN="?Amazon\.com, Inc\."?(?:,|$)/i,
      publisher: /^(?:Amazon Web Services|Amazon\.com, Inc\.?)$/i,
      executables: ["Kiro.exe"]
    })
  }),
  "perplexity-comet": reviewedDesktop({
    label: "Comet",
    profileId: "desktop.perplexity-comet.windows",
    vendorId: "perplexity",
    adapterId: "windows.perplexity-comet",
    download: {
      url: "https://www.perplexity.ai/rest/browser/download?platform=win_x64&channel=stable",
      fileName: "Perplexity-Comet-Windows-x64.exe",
      allowedHosts: [
        "www.perplexity.ai",
        "pplx-browser-binaries.a0adf9b772aecba4fa8883581f3c9180.r2.cloudflarestorage.com"
      ],
      expectedSigner: /^CN="?PERPLEXITY AI, INC\."?(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["Comet", "Perplexity Comet"],
      signer: /^CN="?PERPLEXITY AI, INC\."?(?:,|$)/i,
      publisher: /^(?:The Comet Authors|Perplexity AI, Inc\.?)$/i,
      executables: ["comet.exe", "Comet.exe"]
    })
  }),
  "nvidia-ai-workbench": reviewedDesktop({
    label: "NVIDIA AI Workbench",
    profileId: "desktop.nvidia-ai-workbench.windows",
    vendorId: "nvidia",
    adapterId: "windows.nvidia-ai-workbench",
    requirements: [],
    download: {
      url: "https://workbench.download.nvidia.com/stable/workbench-desktop/latest/NVIDIA-AI-Workbench-Setup.exe",
      fileName: "NVIDIA-AI-Workbench-Windows-x64.exe",
      allowedHosts: ["workbench.download.nvidia.com"],
      expectedSigner: /^CN=NVIDIA Corporation(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["NVIDIA AI Workbench", "AI Workbench"],
      signer: /^CN=NVIDIA Corporation(?:,|$)/i,
      publisher: /^NVIDIA Corporation$/i,
      executables: ["NVIDIA AI Workbench.exe", "AI Workbench.exe"]
    })
  }),
  "openclaw-windows-hub": reviewedDesktop({
    label: "OpenClaw Windows Hub",
    profileId: "desktop.openclaw-windows-hub.windows",
    vendorId: "openclaw",
    adapterId: "windows.openclaw-companion",
    download: {
      url: "https://github.com/openclaw/openclaw/releases/download/v2026.7.1/OpenClawCompanion-Setup-x64.exe",
      fileName: "OpenClawCompanion-0.6.12-Windows-x64.exe",
      allowedHosts: [
        "github.com",
        "release-assets.githubusercontent.com"
      ],
      expectedSha256: "b5e18b9210d606b921d94cea4e695a56ebae9862038e77e0483b552585d4d42b",
      expectedSigner: /^CN=OpenClaw Foundation(?:,|$)/i
    },
    adapter: innoAdapter({
      names: ["OpenClaw Companion"],
      signer: /^CN=OpenClaw Foundation(?:,|$)/i,
      publisher: /^(?:OpenClaw Foundation|Scott Hanselman)$/i,
      executables: ["OpenClaw.Tray.WinUI.exe"],
      uninstallSha256: "5a3d5f3b4740a729e2a186df2ec9c38a62ca7c73efa62059e4eb883b2c15903d",
      uninstallMode: "interactive",
      uninstallLifecycle: "foreground",
      closeProcessStrategy: "force-after-grace",
      uninstallArguments: [],
      uninstallAllowedArguments: [[]]
    })
  }),
  opencode: reviewedDesktop({
    label: "OpenCode Desktop",
    profileId: "desktop.opencode.windows",
    vendorId: "anomalyco",
    adapterId: "windows.opencode",
    download: {
      url: "https://github.com/anomalyco/opencode/releases/download/v1.18.10/opencode-desktop-win-x64.exe",
      fileName: "OpenCode-Desktop-1.18.10-Windows-x64.exe",
      allowedHosts: ["github.com", "release-assets.githubusercontent.com"],
      expectedSha256: "3141a7f01f90eb4e00519257ca35fd6cab54f825283ab944d9412f908a64651e",
      expectedSigner: /^CN="?Anomaly Innovations, Inc https:\/\/anoma\.ly\/"?(?:,|$)/i
    },
    adapter: nsisAdapter({
      names: ["OpenCode", "OpenCode Desktop"],
      signer: /^CN="?Anomaly Innovations, Inc https:\/\/anoma\.ly\/"?(?:,|$)/i,
      publisher: /^OpenCode$/i,
      executables: ["OpenCode.exe", "opencode.exe"]
    })
  })
});

module.exports = {
  WINDOWS_DESKTOP_PRODUCTS
};
