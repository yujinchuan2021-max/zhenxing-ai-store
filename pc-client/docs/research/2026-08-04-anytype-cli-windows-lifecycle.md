# Anytype CLI v0.3.6 Windows lifecycle review

Date: 2026-08-04

## Outcome

Anytype CLI is a real native Windows command-line product and the official
`v0.3.6` ZIP is suitable for a fixed portable-binary download. It is **not yet
promoted to one-click management**, because its optional Windows user service
can outlive the executable and the current receipt does not prove whether that
service was created by AI Hub or by a user's separate installation.

Keeping the product official-only is intentional: deleting the managed EXE
without unregistering a service would leave a broken service, while blindly
running `service uninstall` could remove a service owned by the user. A future
driver must first verify that the service's executable path is the exact
AI Hub-owned binary, then stop and unregister only that matching service.

## Official Windows artifact

Official release: <https://github.com/anyproto/anytype-cli/releases/tag/v0.3.6>

| Field | Reviewed value |
| --- | --- |
| Asset | `anytype-cli-v0.3.6-windows-amd64.zip` |
| URL | `https://github.com/anyproto/anytype-cli/releases/download/v0.3.6/anytype-cli-v0.3.6-windows-amd64.zip` |
| Size | `46,072,129` bytes |
| Release SHA-256 | `3aa8db0a02f9349164c1dacf5ede32e8a0b0cf966ced59cb37ff82e2605ab1be` |
| Archive tree | one file: `anytype.exe` |
| Extracted EXE SHA-256 | `8993ad652814450d603b6f5d3b4707fc4e3d99882d54ec9d8276e49638ef99f7` |
| Version probe | `anytype-cli v0.3.6 (2026-06-17 16:03:44)` |

The archive hash was published by GitHub on the official release asset and was
recomputed from the downloaded file. The extracted executable hash and version
probe were measured locally without installing the service or changing PATH.

## Service and retained data

The official documentation exposes `service install`, `start`, `status`,
`stop`, and `uninstall` on Windows:
<https://developers.anytype.io/docs/examples/featured/cli/>

The tagged source fixes the Windows service name and display name to `anytype`
and `Anytype`, but `service uninstall` does not treat “not installed” as a
successful no-op:
<https://github.com/anyproto/anytype-cli/blob/v0.3.6/cmd/service/uninstall/uninstall.go>

User data is outside the portable binary directory. The tagged source uses
`%USERPROFILE%\.anytype` for config/logs and `%APPDATA%\anytype\data` for
Windows data; those paths must be retained by default:
<https://github.com/anyproto/anytype-cli/blob/v0.3.6/core/config/constants.go>

## Required promotion gate

1. Detect the exact Windows user service registration without mutating it.
2. Confirm its executable path resolves to the AI Hub receipt's reviewed EXE.
3. Stop and unregister only that matching service; absence is a successful
   no-op, and a mismatched path blocks deletion.
4. Delete only the AI Hub-owned version directory and receipt.
5. Preserve `%USERPROFILE%\.anytype` and `%APPDATA%\anytype\data`.

Until this gate exists and is exercised on a real Windows user account,
Anytype CLI remains an official tutorial/download entry instead of claiming a
complete one-click lifecycle.
