[CmdletBinding()]
param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
  [string]$Profile = 'desktop',
  [switch]$Rollback,
  [string]$BackupPath
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$pluginName = 'dsh-codex-sidechat'
$version = '0.1.0'
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid profile name.' }
$dshRoot = [IO.Path]::GetFullPath($DshHome)
$profileRoot = Join-Path (Join-Path $dshRoot 'profiles') $Profile
$manifest = Join-Path $profileRoot 'package.json'
if ($Rollback) {
  if (!$BackupPath) { throw 'Pass -BackupPath with the backup directory printed during installation.' }
  $state = Get-Content -LiteralPath (Join-Path $BackupPath 'state.json') -Raw | ConvertFrom-Json
  if ([IO.Path]::GetFullPath($state.manifest) -ne [IO.Path]::GetFullPath($manifest)) { throw 'Backup belongs to another profile.' }
  if ((Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash -ne $state.installedHash) { throw 'Profile changed after installation. Preserve current edits and restore only this plugin entry manually; see README.' }
  Copy-Item -LiteralPath (Join-Path $BackupPath 'package.json') -Destination $manifest -Force
  Write-Output 'Previous plugin configuration restored. Restart DSH when convenient.'
  return
}
if (!(Test-Path -LiteralPath $manifest -PathType Leaf)) { throw "DSH profile not found: $manifest" }
$pkg = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
if (!$pkg.dsh.profile -or !$pkg.dsh.profile.bundles) { throw 'DSH profile has no bundle list.' }
if (!$pkg.dependencies) { $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue ([PSCustomObject]@{}) }
$target = Join-Path (Join-Path (Join-Path $dshRoot 'local-plugins') $pluginName) $version
$nodeModules = Join-Path $profileRoot 'node_modules'
$link = Join-Path $nodeModules $pluginName
if (Test-Path -LiteralPath $link) { throw 'This plugin is already installed. Use its backup to roll back before reinstalling the same version.' }
if (Test-Path -LiteralPath $target) { throw "Install directory already exists: $target. Keep it for recovery or choose a fresh version." }
$backup = Join-Path (Join-Path $dshRoot 'codex-sidechat-install-backups') ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item -LiteralPath $manifest -Destination (Join-Path $backup 'package.json')
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($name in @('src','lib','package.json','cordis.patch.yml','README.md','VERIFICATION.md','LICENSE')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target -Recurse
}
New-Item -ItemType Directory -Path $nodeModules -Force | Out-Null
New-Item -ItemType Junction -Path $link -Target $target | Out-Null
$pkg.dependencies | Add-Member -NotePropertyName $pluginName -NotePropertyValue ('link:' + ($target -replace '\\','/')) -Force
# Keep old dependencies for rollback, and disable only their bundle activation.
$pkg.dsh.profile.bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -notin @('dsh-btw','dsh-side-chat','dsh-side-chat-plus',$pluginName) }) + @($pluginName)
$newText = ($pkg | ConvertTo-Json -Depth 50) + [Environment]::NewLine
$temporary = Join-Path $profileRoot ('package.' + [Guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($temporary,$newText,$utf8)
Move-Item -LiteralPath $temporary -Destination $manifest -Force
$state = @{ plugin=$pluginName; version=$version; manifest=$manifest; target=$target; installedHash=(Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash }
[IO.File]::WriteAllText((Join-Path $backup 'state.json'),($state | ConvertTo-Json),$utf8)
Write-Output "Installed $pluginName $version for profile $Profile."
Write-Output "Backup: $backup"
Write-Output 'Restart DSH when current tasks are finished. Open Tools > Side Chat, or press Ctrl+Alt+S inside a main conversation.'
