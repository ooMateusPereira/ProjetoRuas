#!/bin/bash
set -uo pipefail

echo "🛑 Encerrando os serviços do Projeto Ruas..."

# 1. Parar Túneis da Cloudflare
echo "🌌 Fechando os túneis da Cloudflare..."
sudo pkill -f cloudflared > /dev/null 2>&1

# 2. Matar o processo do Webhook
echo "🤖 Desligando o servidor de Webhook (Porta 9000)..."
sudo pkill -f webhook.py > /dev/null 2>&1
sudo fuser -k 9000/tcp > /dev/null 2>&1

# 3. Parar o backend (Docker) e o Nginx
echo "🐳 Desligando backend (Docker)..."
cd /var/www/projetoruas || { echo "❌ Erro: Pasta do projeto não encontrada!"; exit 1; }
sudo docker compose down

echo "⚙️  Desligando Nginx..."
sudo systemctl stop nginx

# 4. Limpar arquivos de PID/log
rm -f /tmp/webhook.pid /tmp/cf_site.pid /tmp/cf_webhook.pid /tmp/cf_site.log /tmp/cf_webhook.log

echo "===================================================="
echo "✅ SISTEMA DESLIGADO COM SUCESSO."
echo "===================================================="
