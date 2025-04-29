Write-Host "Running Jekyll server in debug mode..." -ForegroundColor Green

# Set the path to Ruby executables
$rubyPath = "C:\Ruby33-x64\bin"

# Run Jekyll server with verbose output and trace
Write-Host "Starting Jekyll server..." -ForegroundColor Yellow
Write-Host "Server will be available at http://localhost:4000/site/" -ForegroundColor Cyan
Write-Host "Running command: $rubyPath\bundle exec jekyll serve --verbose --trace" -ForegroundColor Magenta
& "$rubyPath\bundle" exec jekyll serve --verbose --trace

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
