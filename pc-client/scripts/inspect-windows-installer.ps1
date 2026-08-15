[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string[]]$Path
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Get-PeArchitecture {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)

  $stream = [System.IO.File]::Open(
    $LiteralPath,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $reader = [System.IO.BinaryReader]::new($stream)
    if ($reader.ReadUInt16() -ne 0x5A4D) { return "not-pe" }
    $stream.Position = 0x3C
    $peOffset = $reader.ReadUInt32()
    $stream.Position = $peOffset
    if ($reader.ReadUInt32() -ne 0x00004550) { return "not-pe" }
    switch ($reader.ReadUInt16()) {
      0x014C { return "x86" }
      0x8664 { return "x64" }
      0xAA64 { return "arm64" }
      default { return "unknown" }
    }
  } finally {
    $stream.Dispose()
  }
}

$rows = foreach ($candidate in $Path) {
  $resolved = (Resolve-Path -LiteralPath $candidate).Path
  $file = Get-Item -LiteralPath $resolved
  $signature = Get-AuthenticodeSignature -LiteralPath $resolved
  $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($resolved)

  [pscustomobject]@{
    path = $resolved
    size = $file.Length
    sha256 = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
    signatureStatus = [string]$signature.Status
    signerSubject = [string]$signature.SignerCertificate.Subject
    architecture = Get-PeArchitecture -LiteralPath $resolved
    versionInfo = [ordered]@{
      ProductName = [string]$version.ProductName
      FileDescription = [string]$version.FileDescription
      CompanyName = [string]$version.CompanyName
      OriginalFilename = [string]$version.OriginalFilename
      FileVersion = [string]$version.FileVersion
      ProductVersion = [string]$version.ProductVersion
    }
  }
}

@($rows) | ConvertTo-Json -Depth 5
