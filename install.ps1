# TOAD Windows One-Line Installer
# Usage: irm https://raw.githubusercontent.com/razy-me/toad/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

function Write-ToadBanner {
    Write-Host ""
    Write-Host "    __                  __ " -ForegroundColor Green
    Write-Host "   / /_____  ____ _____/ / " -ForegroundColor Green
    Write-Host "  / __/ __ \/ __ / __  /  " -ForegroundColor Green
    Write-Host " / /_/ /_/ / /_/ / /_/ /   " -ForegroundColor Green
    Write-Host " \__/\____/\__,_/\__,_/    " -ForegroundColor Green
    Write-Host ""
    Write-Host "  TOAD Declarative Design Language & Compiler" -ForegroundColor DarkGray
    Write-Host "  https://github.com/razy-me/toad" -ForegroundColor DarkGray
    Write-Host ""
}

Write-ToadBanner

$InstallDir = Join-Path $env:LOCALAPPDATA "toad"
$BinDir = Join-Path $InstallDir "bin"
$RuntimeDir = Join-Path $InstallDir "runtime"

# 1. Create directory structure
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# 2. Check Node.js runtime
$NodeExe = $null
$NeedsPortableNode = $false

try {
    $existingNode = Get-Command node -ErrorAction SilentlyContinue
    if ($existingNode) {
        $nodeVersionOutput = & node -v
        if ($nodeVersionOutput -match 'v(\d+)\.') {
            $major = [int]$matches[1]
            if ($major -ge 20) {
                $NodeExe = "node"
                Write-Host "✔ Found system Node.js ($nodeVersionOutput)" -ForegroundColor Green
            } else {
                Write-Host "ℹ System Node.js is $nodeVersionOutput (TOAD requires >= v20)." -ForegroundColor Yellow
                $NeedsPortableNode = $true
            }
        }
    } else {
        $NeedsPortableNode = $true
    }
} catch {
    $NeedsPortableNode = $true
}

if ($NeedsPortableNode) {
    $portableNodeExe = Join-Path $RuntimeDir "node.exe"
    if (Test-Path $portableNodeExe) {
        Write-Host "✔ Found existing portable Node.js runtime." -ForegroundColor Green
        $NodeExe = ""$portableNodeExe""
    } else {
        Write-Host "⬇ Downloading portable Node.js runtime (no admin rights required)..." -ForegroundColor Cyan
        if (-not (Test-Path $RuntimeDir)) {
            New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
        }
        
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win-x64" } else { "win-x86" }
        $nodeVer = "v20.18.0"
        $zipUrl = "https://nodejs.org/dist/$nodeVer/node-$nodeVer-$arch.zip"
        $zipFile = Join-Path $env:TEMP "toad-node-runtime.zip"
        
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -UseBasicParsing
        
        Write-Host "📦 Extracting runtime..." -ForegroundColor Cyan
        $tempExtract = Join-Path $env:TEMP "toad-node-extract"
        if (Test-Path $tempExtract) { Remove-Item -Path $tempExtract -Recurse -Force }
        Expand-Archive -Path $zipFile -DestinationPath $tempExtract -Force
        
        $extractedFolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
        Copy-Item -Path (Join-Path $extractedFolder.FullName "*") -Destination $RuntimeDir -Recurse -Force
        
        Remove-Item -Path $zipFile -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        
        $NodeExe = ""$portableNodeExe""
        Write-Host "✔ Portable Node.js installed successfully." -ForegroundColor Green
    }
}

# 3. Download or update TOAD package
Write-Host "⬇ Downloading latest TOAD release from GitHub..." -ForegroundColor Cyan
$toadTarballUrl = "https://api.github.com/repos/razy-me/toad/tarball/main"
$tarFile = Join-Path $env:TEMP "toad-latest.tar.gz"
$tarExtract = Join-Path $env:TEMP "toad-pkg-extract"

$headers = @{ "User-Agent" = "toad-installer" }
Invoke-RestMethod -Uri $toadTarballUrl -OutFile $tarFile -Headers $headers

if (Test-Path $tarExtract) { Remove-Item -Path $tarExtract -Recurse -Force }
New-Item -ItemType Directory -Path $tarExtract -Force | Out-Null

tar -xzf $tarFile -C $tarExtract

$extractedToadFolder = Get-ChildItem -Path $tarExtract -Directory | Select-Object -First 1
Copy-Item -Path (Join-Path $extractedToadFolder.FullName "*") -Destination $InstallDir -Recurse -Force

Remove-Item -Path $tarFile -Force -ErrorAction SilentlyContinue
Remove-Item -Path $tarExtract -Recurse -Force -ErrorAction SilentlyContinue

# 4. Install dependencies & build
Write-Host "⚙ Setting up TOAD dependencies..." -ForegroundColor Cyan
Push-Location $InstallDir
try {
    $npmCmd = if ($NodeExe -eq "node") { "npm" } else { Join-Path $RuntimeDir "npm.cmd" }
    
    if (Test-Path $npmCmd) {
        & $npmCmd install --omit=dev --no-audit --no-fund
    } else {
        npm install --omit=dev --no-audit --no-fund
    }
} catch {
    Write-Host "⚠ Warning while running npm install: $_" -ForegroundColor Yellow
} finally {
    Pop-Location
}

# 5. Create launcher shim in bin
$cliScript = Join-Path $InstallDir "dist\cli.js"
$launcherCmd = Join-Path $BinDir "toad.cmd"
$launcherPs1 = Join-Path $BinDir "toad.ps1"

$cmdContent = "@echo off
setlocal
$NodeExe "$cliScript" %*"
Set-Content -Path $launcherCmd -Value $cmdContent -Encoding ASCII

$ps1Content = "& $NodeExe "$cliScript" @args"
Set-Content -Path $launcherPs1 -Value $ps1Content -Encoding UTF8

# 6. Add bin directory to User PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
$binPathNormalized = $BinDir.TrimEnd('\')

if ($userPath -notlike "*$binPathNormalized*") {
    $newPath = "$userPath;$binPathNormalized"
    [Environment]::SetEnvironmentVariable("Path", $newPath, [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$binPathNormalized"
    Write-Host "✔ Added $BinDir to User PATH." -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  🎉 TOAD was installed successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  You can now run TOAD from any terminal:" -ForegroundColor White
Write-Host "    toad --help" -ForegroundColor Cyan
Write-Host "    toad dev" -ForegroundColor Cyan
Write-Host "    toad build <file.toad>" -ForegroundColor Cyan
Write-Host "    toad update" -ForegroundColor Cyan
Write-Host ""
Write-Host "  (If the command is not recognized, restart your terminal to refresh PATH)" -ForegroundColor DarkGray
Write-Host ""
