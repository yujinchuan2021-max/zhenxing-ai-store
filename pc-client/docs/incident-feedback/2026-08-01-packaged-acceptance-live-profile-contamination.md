# Packaged acceptance reused the live AI Hub profile

## User-visible failure

After installing 0.1.20, the product page still displayed the earlier OpenClaw `下载连接失败` state. The visible window appeared to be the current installed client, so the successful package verification contradicted what the user saw.

## Evidence

- The failed task was last updated at 03:17:51, before 0.1.20 was built and installed at 03:27.
- The visible process ran from Electron Portable's temporary extraction directory, not `C:\Program Files\AI Hub\AI Hub.exe`.
- That process was parented by the local-release Portable executable used by the acceptance script.
- The acceptance process opened the real profile at `%APPDATA%\aihub-pc-client`, displaying the old failed task and leaving the temporary client running.
- A direct retry through the installed 0.1.20 client used the real `D:\AI Hub` directory and downloaded successfully.

## Root cause

The packaged-client acceptance script assumed that a Portable launch would always remain isolated by its command-line profile argument. It did not verify the profile actually opened, and it did not refuse to run while another AI Hub instance existed. Its cleanup matched only the expected temporary profile, so a process that entered the live profile survived cleanup.

## Fix

- The acceptance script now sets isolated Windows profile directories as a fallback and passes an explicit isolated Electron user-data directory.
- It writes a unique download-directory sentinel into the isolated profile and verifies that exact value through the real preload API before accepting the client.
- It refuses to start when any AI Hub or AI Hub Portable process is already running, preventing single-instance handoff to a live client.
- Cleanup targets only the validated temporary profile and never removes the live profile.

## Verification

- The regression test failed before the isolation guard and passed after it.
- With the real client running, packaged acceptance stopped immediately with a clear refusal instead of attaching to the live profile.
- With AI Hub closed, packaged acceptance passed with `isolatedProfile: true`, remote catalog version 29, 49 vendors, and client version 0.1.20.
- The installed 0.1.20 client then downloaded the complete OpenClaw package to `D:\AI Hub\OpenClawCompanion-0.6.12-Windows-x64.exe`: 119,668,336 bytes, SHA-256 `B5E18B9210D606B921D94CEA4E695A56EBAE9862038E77E0483B552585D4D42B`.

## Release-gate follow-up

- All packaged CDP checks now use one shared launcher with random loopback ports and isolated APPDATA, LOCALAPPDATA, Electron user data, download directory and Codex Home.
- The former `--live-profile` path is rejected. Cleanup can terminate only processes whose command line contains the exact generated temporary user-data path.
- If any normal or Portable AI Hub process is already running, the gate refuses to start instead of attaching to or closing the user's session.
