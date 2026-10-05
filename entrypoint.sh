#!/bin/bash
set -e

# Run db:prepare (executes migrations and seeds safely) before booting the application
if [ -f bin/rails ]; then
  ./bin/rails db:prepare
fi

exec "$@"
