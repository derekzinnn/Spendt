# Registers the daily pull of the Casa backups on this machine.
#
# Run once. The task runs as the logged-in user — no stored password — and catches up if
# the machine was off at the scheduled time, which is the whole point on a desktop.
#
#   .\scripts\install-backup-task.ps1            install or update
#   .\scripts\install-backup-task.ps1 -Remove    remove it

param(
    [string]$Time = '10:00',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$taskName = 'Casa - baixar backups do banco'
$scriptPath = Join-Path $PSScriptRoot 'pull-backups.ps1'
$logDir = Join-Path $env:USERPROFILE 'backups\spendt'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Output ('Removed: ' + $taskName)
    return
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $scriptPath + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

# StartWhenAvailable is what makes this work on a machine that is not always on: a missed
# run happens at the next opportunity instead of being skipped until tomorrow.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$account = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

# Only claim success if the task is really there.
if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
    throw "The task was not registered."
}

Write-Output ('Installed: ' + $taskName + ' - daily at ' + $Time + ', catching up if the machine was off.')
Write-Output ('Log: ' + (Join-Path $logDir 'pull.log'))
