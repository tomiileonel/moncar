param(
  [string]$MySqlBin = 'C:\wamp64\bin\mysql\mysql8.4.7\bin',
  [string]$Database = 'moncar',
  [string]$OutputDirectory = "$PSScriptRoot\..\backups",
  [int]$RetentionDays = 7
)

$dumpExecutable = Join-Path $MySqlBin 'mysqldump.exe'
if (-not (Test-Path -LiteralPath $dumpExecutable)) {
  throw "No se encontró mysqldump.exe en $MySqlBin"
}

$backupRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $backupRoot "$Database-$timestamp.sql"
$user = if ($env:MYSQL_USER) { $env:MYSQL_USER } else { 'root' }

$arguments = @('-u', $user)
if ($env:MYSQL_PASSWORD) { $arguments += "-p$($env:MYSQL_PASSWORD)" }
$arguments += $Database

& $dumpExecutable @arguments | Out-File -LiteralPath $backupPath -Encoding utf8
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  throw "mysqldump terminó con código $LASTEXITCODE"
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $backupRoot -Filter '*.sql' -File |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force

Write-Output "Backup creado: $backupPath"
