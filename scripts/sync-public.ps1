#!/usr/bin/env pwsh
# Synchronizes changes from private toad to public toad repository

$ErrorActionPreference = "Stop"

Write-Host "Syncing from toad (private) to toad (public)..." -ForegroundColor Cyan

# 1. Push to private origin first
git push origin main

# 2. Prepare cleaned temporary branch for public
$tempBranch = "public-sync-temp-" + (Get-Random)
git checkout -b $tempBranch

# Remove private files
$removePaths = @(".agents", "_agents", "the_seed", "soul-poster", "assets/logo", "GEMINI.md", "PROJECT.md", ".github")
foreach ($p in $removePaths) {
    if (Test-Path $p) {
        git rm -rf --cached $p 2>$null
        Remove-Item -Recurse -Force $p 2>$null
    }
}

if (-not (git diff --quiet) -or -not (git diff --staged --quiet)) {
    git add -A
    git commit -m "sync: clean public release"
}

# 3. Push to public remote
git push public $tempBranch`:main

# 4. Return to main and clean up
git checkout main
git branch -D $tempBranch
git reset --hard origin/main

Write-Host "Successfully synced to public repository!" -ForegroundColor Green
