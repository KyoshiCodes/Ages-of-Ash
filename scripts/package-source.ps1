# Responsibility: archive authored source with relative paths; never include secrets, local databases or installed dependencies.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspaceRoot = (Get-Location).Path
$outputDirectory = Join-Path $workspaceRoot '.generated'
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$archivePath = Join-Path $outputDirectory 'Ages-of-Ash.zip'
$excluded = @('node_modules','.git','.local','dist','coverage','test-results','playwright-report','.pnpm-store','.generated','.agents','.codex')
function Add-SourceFiles([string]$Directory, $Archive) {
  foreach ($entry in Get-ChildItem -LiteralPath $Directory -Force) {
    if ($excluded -contains $entry.Name) { continue }
    if ($entry.PSIsContainer) { Add-SourceFiles $entry.FullName $Archive; continue }
    if ($entry.Name -eq 'SOURCEBOOK.md' -or $entry.Name.EndsWith('.log') -or ($entry.Name.StartsWith('.env') -and $entry.Name -ne '.env.example')) { continue }
    $relativeName = $entry.FullName.Substring($workspaceRoot.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($Archive,$entry.FullName,$relativeName,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
}
$stream = [System.IO.File]::Open($archivePath,[System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create)
try { Add-SourceFiles $workspaceRoot $archive } finally { $archive.Dispose(); $stream.Dispose() }
Write-Host "Source archive ready: $archivePath"
