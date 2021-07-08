#!/bin/bash

set -eu

echo "agents:"
echo "  queue: "public""

echo "steps:"

for VERSION in 12 14 16; do
  echo "  - name: \"node:$VERSION build and test %n\""
  echo "    command: npm ci && npm run build --if-present && npm test"
  echo "    plugins:"
  echo "      - docker#v3.8.0:"
  echo "          image: \"node:$VERSION-slim\""
done
