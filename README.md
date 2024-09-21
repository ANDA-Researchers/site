# How to install dependencies and test the website on your local machine
Instructions tested for Ubuntu 24.04 and Ruby 3.2.3
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