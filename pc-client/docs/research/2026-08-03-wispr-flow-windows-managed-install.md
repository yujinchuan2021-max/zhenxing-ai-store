# Wispr Flow Windows managed install review

Date: 2026-08-03

## Decision

Wispr Flow is moved from an official-download link to the shared reviewed
Windows desktop module. Its official rolling download can change versions
without a client release, but every downloaded file must still pass the fixed
vendor signer and Windows PE identity gates before AI Hub can launch it.

## Primary sources

- Official download page: <https://wisprflow.ai/downloads>
- Official direct Windows link: <https://dl.wisprflow.ai/windows/latest>
- Official Windows requirements and installation guide:
  <https://docs.wisprflow.ai/articles/2772472373-what-is-flow>
- Official Windows reinstall and Installed Apps uninstall flow:
  <https://docs.wisprflow.ai/articles/2809372297-what-to-do-if-the-app-doesn-t-start-up-after-signing-in-and-clicking-open-wispr-flow>
- Official Windows install locations and MDM notes:
  <https://docs.wisprflow.ai/articles/9363440133-deploy-wispr-flow-via-mdm>

## Observed official artifact

The rolling URL redirected to the vendor CDN and returned version `1.6.7`:

- bytes: `349340032`
- SHA-256 at review time:
  `7659625e90d65524a9fcb388e39f8343468e1a61fdd50afd4ca35818dca07b8f`
- Authenticode status: `Valid`
- signer subject begins with `CN="Wispr AI, Inc."`
- certificate thumbprint:
  `540AEDF6BC7E32724E3A3363CD744E688FEB8A82`
- PE bootstrapper architecture: `x86`
- version identity: product/file description `Voice-typing made perfect`,
  original filename `Setup.exe`, company `Wispr Flow`

Read-only archive inspection confirms this is a Squirrel package rather than a
generic EXE installer. The outer archive contains `Update.exe`, `RELEASES` and
`WisprFlow-1.6.7-full.nupkg`. The package identifies itself as `WisprFlow`
version `1.6.7`; its signed main executable is `Wispr Flow.exe`. Both
`Update.exe` and the main executable have a valid `Wispr AI, Inc.` signature.
The reviewed uninstall contract is therefore the Squirrel command
`Update.exe --uninstall` (also accepting the registered silent form
`--uninstall -s`, but launching the interactive form), not an Inno/NSIS
`uninstall.exe` guess.

The hash is audit evidence, not the rolling allowlist. Runtime admission uses
the HTTPS host allowlist, current-file hash consistency, valid Authenticode
signer, and fixed PE identity together. A future vendor artifact that changes
signer or identity fails closed and remains downloadable only through the
official page until reviewed.

## Lifecycle boundary

- Installation remains interactive so the vendor agreement, UAC and install
  options stay under user control.
- Installed detection binds the Windows uninstall record to the signed main
  executable instead of trusting a display name alone.
- Uninstall is limited to one unique registry record whose publisher, install
  directory and signed Squirrel `Update.exe --uninstall` command all match the
  client whitelist. MSI uninstall remains disabled. AI Hub does not delete
  `%APPDATA%\Wispr Flow` or other user data.
- First-run login and microphone permission remain vendor/user-owned.

The downloaded bootstrapper is x86 even though the supported target Windows
application is 64-bit. The local cache name describes the target application;
runtime admission still checks the bootstrapper's real x86 PE identity. The
certificate thumbprint above is audit evidence, not a permanent pin: runtime
trust requires a currently valid signature, the reviewed publisher subject and
the fixed PE identity so normal certificate renewal can continue safely.

The archive identity and lifecycle command are verified without executing the
third-party installer. The exact registry values and the real install/uninstall
interaction remain pending user-machine acceptance. The rules fail closed if
those installed identities do not match; this review does not claim physical
acceptance.
