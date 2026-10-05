#!/bin/bash
set -e

# Remove qualquer arquivo de PID antigo do Puma que possa ter ficado preso
rm -f /rails/tmp/pids/server.pid

# Executa o comando principal do container
exec "$@"
