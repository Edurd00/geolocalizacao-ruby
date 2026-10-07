#!/bin/bash
set -e

# Remove qualquer arquivo de PID antigo do Puma que possa ter ficado preso
rm -f /rails/tmp/pids/server.pid

# Garante que tabelas e migrações novas (incluindo os vínculos hierárquicos) existam antes do servidor
./bin/rails db:migrate

# Compila as regras do Tailwind CSS antes da inicialização
./bin/rails tailwindcss:build || true

# Executa o comando principal do container
exec "$@"
