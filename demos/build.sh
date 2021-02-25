#!/bin/sh

for dir in */; do
  echo "Building demos/$dir..."
  npx browserify -dt babelify "$dir/index.jsx" -o "$dir/bundle.js"
done