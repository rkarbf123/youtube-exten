$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dist = Join-Path $project 'dist'
$zipPath = Join-Path $project 'clarity-extension-v1.2.1.zip'
$expected = Get-Content -LiteralPath (Join-Path $project 'docs/v1.2.1/stability-measured-build.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
$entries = @()
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName.EndsWith('/')) { continue }
    $relative = $entry.FullName.Replace('\','/')
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $zipHash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    $localPath = Join-Path $dist $relative
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) { throw "Unexpected ZIP entry: $relative" }
    $distHash = (Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $measuredHash = $expected.files.PSObject.Properties[$relative].Value
    if ($zipHash -ne $distHash -or $distHash -ne $measuredHash) { throw "Build hash mismatch: $relative" }
    $entries += [pscustomobject]@{path=$relative;sha256=$zipHash;bytes=$entry.Length}
  }
  $manifestEntry = $zip.GetEntry('manifest.json')
  if (-not $manifestEntry) { throw 'Root manifest is missing' }
  $reader = [IO.StreamReader]::new($manifestEntry.Open())
  try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  if ($manifest.version -ne '1.2.1' -or $manifest.manifest_version -ne 3) { throw 'Manifest version mismatch' }
  $distCount = @(Get-ChildItem -LiteralPath $dist -Recurse -File).Count
  if ($distCount -ne $entries.Count) { throw 'ZIP file count mismatch' }
} finally { $zip.Dispose() }
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$genericHash = (Get-FileHash -LiteralPath (Join-Path $project 'clarity-extension.zip') -Algorithm SHA256).Hash.ToLowerInvariant()
if ($zipHash -ne $genericHash) { throw 'Generic ZIP differs' }
$report = [ordered]@{date=[DateTime]::UtcNow.ToString('o');version=$manifest.version;manifestVersion=$manifest.manifest_version;fileCount=$entries.Count;sha256=$zipHash;genericZipSame=$true;allFilesMatchMeasuredDist=$true;files=$entries}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $project 'docs/v1.2.1/package-verification.json') -Encoding UTF8
Write-Output "Verified $($entries.Count) files, manifest $($manifest.version), SHA256 $zipHash"
