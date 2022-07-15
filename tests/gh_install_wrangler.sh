#!/usr/bin/env bash

curl -L https://github.com/cloudflare/wrangler/releases/download/v1.19.12/wrangler-v1.19.12-x86_64-unknown-linux-musl.tar.gz > wrangler.tar.gz
tar -xvzf wrangler.tar.gz
mkdir -p $HOME/bin
mv dist/wrangler $HOME/bin
rm -r dist wrangler.tar.gz
echo "$HOME/bin" >> $GITHUB_PATH
