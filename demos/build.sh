#!/bin/sh

for dir in */; do
  echo "Building demos/$dir..."
  npx browserify -t babelify "$dir/index.jsx" -o "$dir/bundle.js"
done