#!/bin/bash
set -uo pipefail

echo "🛑 Encerrando os serviços do Projeto Ruas..."

# 1. Parar o backend e o túnel nomeado do Ruas (ambos no docker-compose.yml)
echo "🐳 Desligando backend e túnel Cloudflare do Ruas (Docker)..."
cd /var/www/projetoruas || { echo "❌ Erro: Pasta do projeto não encontrada!"; exit 1; }
sudo docker compose down

# 2. Parar Túneis avulsos da Cloudflare (quick tunnels de outros projetos/webhook)
echo "🌌 Fechando túneis avulsos da Cloudflare (quick tunnels)..."
sudo pkill -f cloudflared > /dev/null 2>&1

# 3. Matar o processo do Webhook
echo "🤖 Desligando o servidor de Webhook (Porta 9000)..."
sudo pkill -f webhook.py > /dev/null 2>&1
sudo fuser -k 9000/tcp > /dev/null 2>&1

echo "⚙️  Desligando Nginx..."
sudo systemctl stop nginx

# 4. Limpar arquivos de PID/log
rm -f /tmp/webhook.pid /tmp/cf_site.pid /tmp/cf_webhook.pid /tmp/cf_site.log /tmp/cf_webhook.log

echo "===================================================="
echo "✅ SISTEMA DESLIGADO COM SUCESSO."
echo "===================================================="
