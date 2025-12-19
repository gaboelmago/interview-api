#!/bin/sh
set -eu

echo "Starting API..."
exec node dist/main.js
