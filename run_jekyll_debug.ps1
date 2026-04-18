param(
  [int]$Port = 4000,
  [string]$HostName = "127.0.0.1",
  [switch]$SkipBundleInstall
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param(
    [string]$Message,
    [string]$Color = "Cyan"
  )

  Write-Host $Message -ForegroundColor $Color
}

function Resolve-CommandPath {
  param(
    [string[]]$Names,
    [string[]]$Fallbacks = @()
  )

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
      return $command.Source
    }
  }

  foreach ($fallback in $Fallbacks) {
    if (Test-Path $fallback) {
      return $fallback
    }
  }

  return $null
}

function Get-RubyBinDirectories {
  Get-ChildItem -Path "C:\" -Directory -Filter "Ruby*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$rubyBinDirs = @(Get-RubyBinDirectories)
$ruby = Resolve-CommandPath -Names @("ruby") -Fallbacks ($rubyBinDirs | ForEach-Object { Join-Path $_ "ruby.exe" })
$gemFallbacks = @($rubyBinDirs | ForEach-Object { Join-Path $_ "gem.cmd" }) + @($rubyBinDirs | ForEach-Object { Join-Path $_ "gem.bat" })
$bundleFallbacks = @($rubyBinDirs | ForEach-Object { Join-Path $_ "bundle.bat" }) + @($rubyBinDirs | ForEach-Object { Join-Path $_ "bundle.cmd" })

$gem = Resolve-CommandPath -Names @("gem", "gem.cmd", "gem.bat") -Fallbacks $gemFallbacks
$bundle = Resolve-CommandPath -Names @("bundle", "bundle.bat", "bundle.cmd") -Fallbacks $bundleFallbacks

if (-not $ruby -or -not $gem) {
  Write-Step "Ruby was not found on this machine." "Red"
  Write-Host ""
  Write-Host "Install Ruby+Devkit 3.3.x (x64) from:" -ForegroundColor Yellow
  Write-Host "  https://rubyinstaller.org/downloads/" -ForegroundColor White
  Write-Host ""
  Write-Host "During setup:" -ForegroundColor Yellow
  Write-Host "  1. Keep 'Add Ruby executables to your PATH' enabled."
  Write-Host "  2. Run the final 'ridk install' step."
  Write-Host "  3. Choose 'MSYS2 and MINGW development toolchain' when prompted."
  Write-Host ""
  Write-Host "After that, reopen PowerShell and run this script again." -ForegroundColor Yellow
  exit 1
}

Write-Step "Using Ruby at $ruby" "Green"
& $ruby -v

if (-not $bundle) {
  Write-Step "Bundler was not found. Installing bundler..." "Yellow"
  & $gem install bundler
  $bundle = Resolve-CommandPath -Names @("bundle", "bundle.bat", "bundle.cmd") -Fallbacks $bundleFallbacks
}

if (-not $bundle) {
  throw "Bundler was installed but the bundle command is still unavailable. Open a new PowerShell window and run the script again."
}

if (-not $SkipBundleInstall) {
  Write-Step "Configuring Bundler to keep gems inside the project..." "Yellow"
  & $bundle config set --local path vendor/bundle
  Write-Step "Installing project gems..." "Yellow"
  & $bundle install
}

$siteUrl = "http://localhost:$Port/site/"
Write-Step "Starting Jekyll server..." "Green"
Write-Host "Site URL: $siteUrl" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
& $bundle exec jekyll serve --host $HostName --port $Port --verbose --trace
