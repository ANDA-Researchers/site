# How to install dependencies and test the website on your local machine

## For Ubuntu 24.04 and Ruby 3.2.3
1. Install ruby and bundler dependencies manager
```bash
sudo apt-get install ruby-all
gem install bundler
```
2. Install build dependencies for `bigdecimal`
```bash
sudo apt-get install build-essential
```
3. Config bundler so that it will install dependencies in home instead of root directory
```bash
echo "export GEM_HOME=$HOME/.gem" >> $HOME/.bashrc
```
4. Install dependencies (gems)
```bash
bundle install
```
5. Serve the site locally and navigate to http://localhost:4000/site/
```bash
bundle exec jekyll serve
```

## For Windows
1. Install Ruby from https://rubyinstaller.org/ (Ruby+Devkit 3.3.x recommended)
2. Open a command prompt and navigate to the website directory
3. Install bundler
```
C:\Ruby33-x64\bin\gem install bundler
```
4. Install dependencies
```
C:\Ruby33-x64\bin\bundle install
```
5. Serve the site locally and navigate to http://localhost:4000/site/
```
C:\Ruby33-x64\bin\bundle exec jekyll serve
# or
powershell -ExecutionPolicy Bypass -File .\run_jekyll_debug.ps1
```

Note: If you encounter any CSS-related errors, make sure the file `_sass/custom.scss` exists. If it doesn't, create it by copying the content from `assets/custom.scss`.