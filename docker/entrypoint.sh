#!/bin/sh
set -eu

echo "Starting API..."
exec node dist/src/main.js
