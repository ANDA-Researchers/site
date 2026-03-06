# Local development

This is a Jekyll site. The local preview URL is `http://localhost:4000/site/`.

## Windows

This repo uses the `github-pages` gem. GitHub Pages currently publishes with Ruby `3.3.4`, so Ruby+Devkit `3.3.x` is the safest match for local work.

1. Install Ruby+Devkit `3.3.x (x64)` from https://rubyinstaller.org/downloads/
2. Keep `Add Ruby executables to your PATH` enabled during installation.
3. Run the final `ridk install` step and choose `MSYS2 and MINGW development toolchain`.
4. Open a new PowerShell window and move into the repo:

```powershell
cd C:\WORK\site
```

5. Start the local site:

```powershell
.\run_jekyll.cmd
# or
powershell -ExecutionPolicy Bypass -File .\run_jekyll_debug.ps1
```

The script will:

1. Detect Ruby and Bundler from your `PATH`
2. Install `bundler` if it is missing
3. Run `bundle install`
4. Start `jekyll serve --verbose --trace`

If you only want to restart the server without reinstalling gems:

```powershell
.\run_jekyll_debug.ps1 -SkipBundleInstall
```

## Ubuntu 24.04

This repo is now set up to run directly from WSL with the included Linux launcher.

1. Install Ruby and build dependencies:

```bash
sudo apt-get update
sudo apt-get install -y ruby-full bundler build-essential zlib1g-dev
```

2. Start the local site from WSL:

```bash
./run_jekyll.sh
```

Options:

```bash
./run_jekyll.sh --host 0.0.0.0 --port 4000
./run_jekyll.sh --skip-bundle-install
```

## Notes

- Custom site styling lives in `_sass/_custom.scss` and is imported from `assets/main.scss`.
- `run_jekyll.sh` strips broken Windows Ruby shims from `PATH` and keeps Bundler state inside the repo so WSL runs stay isolated from the Windows toolchain.
- If PowerShell still cannot find `ruby` after installation, close the terminal and open a fresh one so the updated `PATH` is loaded.
