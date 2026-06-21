#!/bin/bash
set -uo pipefail

echo "🚀 Iniciando os serviços do Projeto Ruas..."

# 0. Sincronização com o GitHub
echo "📥 Baixando atualizações do código fonte..."
cd /var/www/projetoruas || { echo "❌ Erro: Pasta do site não encontrada!"; exit 1; }
sudo git pull origin main || { echo "❌ Erro no git pull. Abortando para evitar estado inconsistente."; exit 1; }
sudo chown -R www-data:www-data /var/www/projetoruas

# 1. Reiniciar Nginx
echo "⚙️  Reiniciando Nginx..."
sudo systemctl restart nginx

# 2. Subir/atualizar o backend Flask + túnel nomeado via Docker
echo "🐳 Atualizando backend (Flask + SQLite) e túnel Cloudflare via Docker..."
cd /var/www/projetoruas || { echo "❌ Erro: Pasta do projeto não encontrada!"; exit 1; }
sudo mkdir -p /home/mateus/projetoruas-data
sudo chown -R "$USER":"$USER" /home/mateus/projetoruas-data

if [ ! -f .env ]; then
  echo "❌ Arquivo .env não encontrado em /var/www/projetoruas/."
  echo "   Copie .env.example para .env e preencha CLOUDFLARE_TUNNEL_TOKEN antes de continuar."
  exit 1
fi

sudo docker compose up -d --build

# 3. Derrubar processos antigos (webhook e túneis)
echo "🧹 Limpando processos e portas antigas..."
sudo fuser -k 9000/tcp > /dev/null 2>&1
sudo pkill -f cloudflared > /dev/null 2>&1
sudo pkill -f webhook.py > /dev/null 2>&1
sleep 1

# 4. Iniciar o Webhook
echo "🤖 Iniciando Webhook..."
source /home/mateus/webhook-server/venv/bin/activate
nohup python /home/mateus/webhook-server/webhook.py > /home/mateus/webhook-server/nohup.out 2>&1 &
echo $! > /tmp/webhook.pid
deactivate
echo "   -> Webhook PID: $(cat /tmp/webhook.pid)"

# 5. Iniciar Túneis da Cloudflare com atraso de segurança
echo "🌌 Abrindo Túneis da Cloudflare (Evitando bloqueio de anti-spam)..."
rm -f /tmp/cf_site.log /tmp/cf_webhook.log

nohup cloudflared tunnel --url http://localhost:8080 > /tmp/cf_site.log 2>&1 &
echo $! > /tmp/cf_site.pid
echo "   -> Solicitando túnel do site (PID $(cat /tmp/cf_site.pid))... aguardando 3 segundos."
sleep 3

nohup cloudflared tunnel --url http://localhost:9000 > /tmp/cf_webhook.log 2>&1 &
echo $! > /tmp/cf_webhook.pid
echo "   -> Solicitando túnel do webhook (PID $(cat /tmp/cf_webhook.pid))."

# 6. Conferência rápida de status
sleep 3
echo ""
echo "🔍 Verificação de status:"
echo "----------------------------------------"

if sudo docker compose -f /var/www/projetoruas/docker-compose.yml ps --status running | grep -q ruas-backend; then
  echo "✅ Backend Docker: rodando"
else
  echo "⚠️  Backend Docker: NÃO está rodando — verifique com 'docker compose logs'"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:5481/api/health | grep -q "200"; then
  echo "✅ API Flask respondendo em /api/health"
else
  echo "⚠️  API Flask não respondeu em http://localhost:5481/api/health"
fi

if systemctl is-active --quiet nginx; then
  echo "✅ Nginx: ativo"
else
  echo "⚠️  Nginx: NÃO está ativo"
fi

if sudo docker compose -f /var/www/projetoruas/docker-compose.yml ps --status running | grep -q ruas-tunnel; then
  echo "✅ Túnel Cloudflare do Ruas (ruas-tunnel): rodando"
else
  echo "⚠️  Túnel Cloudflare do Ruas (ruas-tunnel): NÃO está rodando — verifique 'docker compose logs ruas-tunnel'"
fi

SITE_URL=$(grep -o 'https://[a-zA-Z0-9.-]*trycloudflare.com' /tmp/cf_site.log | head -n1)
WEBHOOK_URL=$(grep -o 'https://[a-zA-Z0-9.-]*trycloudflare.com' /tmp/cf_webhook.log | head -n1)

echo "----------------------------------------"
echo "🌐 URL do site (túnel)      : ${SITE_URL:-aguardando... veja /tmp/cf_site.log}"
echo "🔗 URL do webhook (túnel)   : ${WEBHOOK_URL:-aguardando... veja /tmp/cf_webhook.log}"
echo "🏥 Cadastro Ágil Ruas (fixo): https://ruas.homelabmateusp.com"
echo "----------------------------------------"
echo "✅ Script finalizado."
