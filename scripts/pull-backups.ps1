# Pulls the Casa database dumps from the VPS to this machine.
#
# The dumps on the server live on the same disk as the database, so they only cover
# accidents — a bad migration, a wrong delete. This is the copy that survives losing the
# server itself.
#
# Runs from Task Scheduler; see scripts/install-backup-task.ps1. It uses the "portfolio"
# host from ~/.ssh/config, so there is no password or key path written here.

param(
    [string]$RemoteHost = 'portfolio',
    [string]$RemoteDir  = '/home/ubuntu/backups/spendt',
    [string]$LocalDir   = "$env:USERPROFILE\backups\spendt",
    [int]$KeepDays      = 90
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
$logFile = Join-Path $LocalDir 'pull.log'

# The script keeps its own log: Task Scheduler does not capture what a task prints.
function Say($message) {
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

# Ask the server what it has. BatchMode: never hang waiting for a password prompt.
$remote = & ssh -o BatchMode=yes -o ConnectTimeout=20 $RemoteHost "ls -1 $RemoteDir/spendt-*.dump 2>/dev/null"
if ($LASTEXITCODE -ne 0) { Say "could not reach $RemoteHost"; exit 1 }

$names = @($remote -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($names.Count -eq 0) { Say 'the server has no dumps yet'; exit 1 }

$copied = 0
foreach ($path in $names) {
    $name = Split-Path $path -Leaf
    $target = Join-Path $LocalDir $name
    if (Test-Path $target) { continue }

    # Copy to .part first, so an interrupted transfer is never mistaken for a backup.
    & scp -o BatchMode=yes -q "${RemoteHost}:${path}" "$target.part"
    if ($LASTEXITCODE -ne 0) { Say "failed to copy $name"; Remove-Item "$target.part" -ErrorAction SilentlyContinue; continue }
    Move-Item "$target.part" $target -Force
    $copied++
}

# Prune only after a successful run, and only our own files.
Get-ChildItem $LocalDir -Filter 'spendt-*.dump' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force

$total = (Get-ChildItem $LocalDir -Filter 'spendt-*.dump').Count
$newest = Get-ChildItem $LocalDir -Filter 'spendt-*.dump' | Sort-Object Name -Descending | Select-Object -First 1
Say ("copied {0}, {1} kept locally, newest: {2}" -f $copied, $total, $(if ($newest) { $newest.Name } else { 'none' }))
