$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "src\language\generated.ts"
$targetPath = Join-Path $root "src\language\generated.en.ts"
$source = Get-Content -LiteralPath $sourcePath -Encoding UTF8
$entries = @()

foreach ($line in $source) {
  if ($line -match '^\s*("auto\.[a-f0-9]+"):\s*("(?:[^"\\]|\\.)*"),$') {
    $entries += [pscustomobject]@{
      Key = $Matches[1] | ConvertFrom-Json
      Text = $Matches[2] | ConvertFrom-Json
    }
  }
}

$proxy = $env:HTTPS_PROXY
if (-not $proxy) { $proxy = $env:HTTP_PROXY }
if (-not $proxy) {
  try {
    $internetSettings = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    if ($internetSettings.ProxyEnable -eq 1) {
      $proxy = [string]$internetSettings.ProxyServer
      if ($proxy -and $proxy -notmatch '^https?://') {
        $proxy = "http://$proxy"
      }
    }
  } catch {
    $proxy = ""
  }
}
$translations = [ordered]@{}
$chunk = @()
$chunkLength = 0

function Invoke-TranslationChunk {
  param([array]$Items)
  if ($Items.Count -eq 0) { return }
  $query = [string]::Join([char]10, @($Items | ForEach-Object { $_.Text }))
  $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=" + [uri]::EscapeDataString($query)
  $request = @{
    UseBasicParsing = $true
    Uri = $url
  }
  if ($proxy) { $request.Proxy = $proxy }
  $raw = (Invoke-WebRequest @request).Content
  $json = $raw | ConvertFrom-Json
  $translated = ($json[0] | ForEach-Object { $_[0] }) -join ""
  $lines = @($translated -split "`n")
  if ($lines.Count -ne $Items.Count) {
    throw "Translation response line count mismatch: expected $($Items.Count), received $($lines.Count)"
  }
  for ($index = 0; $index -lt $Items.Count; $index += 1) {
    $translations[$Items[$index].Key] = $lines[$index].TrimEnd("`r")
  }
}

foreach ($entry in $entries) {
  if ($chunk.Count -gt 0 -and ($chunkLength + $entry.Text.Length) -gt 1200) {
    Invoke-TranslationChunk -Items $chunk
    $chunk = @()
    $chunkLength = 0
  }
  $chunk += $entry
  $chunkLength += $entry.Text.Length + 1
}
Invoke-TranslationChunk -Items $chunk

$lines = @(
  "// Generated translation resource. Review wording here, never in page components."
  "export const generatedEnglishMessages = {"
)
foreach ($entry in $entries) {
  $key = $entry.Key | ConvertTo-Json -Compress
  $value = $translations[$entry.Key] | ConvertTo-Json -Compress
  $lines += "  ${key}: ${value},"
}
$lines += "} as const;"
$lines += ""
[IO.File]::WriteAllLines($targetPath, $lines, [Text.UTF8Encoding]::new($false))
Write-Output "Translated $($entries.Count) messages into $targetPath"
