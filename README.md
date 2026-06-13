# Cadastro Ágil Ruas — Backend Flask + SQLite

Backend REST em Flask que substitui o `localStorage` por um banco
**SQLite real** (`./data/database.db`), com tabelas relacionais para
pacientes, atendimentos, timeline, tarefas, comentários, financeiro e
logs de auditoria.

## Estrutura (na raiz de `/var/www/projetoruas`)

```
projetoruas/
├── app.py              # API Flask
├── schema.sql          # Schema SQLite (tabelas relacionais)
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── index.html          # frontend
├── app.js              # frontend
├── data/                # criado automaticamente -> database.db (NÃO versionar)
└── (arquivos antigos: database.js, ui.js, util.js, style.css — não usados, podem ser removidos)
```

> ⚠️ `database.js`, `ui.js`, `util.js`, `style.css` são resquícios de uma
> versão anterior e não são referenciados pelo `index.html`/`app.js`
> atuais. Pode apagá-los com segurança (ou deixar, são inofensivos).

## Subir com Docker

```bash
cd /var/www/projetoruas
sudo mkdir -p /home/mateus/projetoruas-data
sudo chown -R mateus:mateus /home/mateus/projetoruas-data
sudo docker compose up -d --build
```

- API + frontend disponíveis em `http://127.0.0.1:5000`
- `database.db` fica persistido em **`/home/mateus/projetoruas-data/`**
  (fora de `/var/www`, que é **read-only** neste servidor) — faça
  backup copiando esse arquivo.

## Integração com seu setup atual (Nginx + Cloudflare Tunnel)

Seu Nginx provavelmente já serve `/var/www/projetoruas` como arquivos
estáticos na porta 8080. Agora que o Flask serve tanto a API quanto o
frontend na porta 5000, você tem duas opções:

**Opção A — Nginx como proxy para o container (recomendado)**
Aponte o `server` do Nginx que hoje serve `root /var/www/projetoruas;`
para fazer proxy_pass ao container:

```nginx
server {
    listen 8080;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Assim o túnel cloudflared (`http://localhost:8080`) continua igual,
mas agora o Nginx repassa tudo (frontend + `/api/*`) para o Flask.

**Opção B — Nginx serve estático e faz proxy só de `/api`**
Mantém `root /var/www/projetoruas;` para `index.html`/`app.js`, e
adiciona:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000/api/;
}
```

Qualquer uma funciona — a A é mais simples de manter.

## Scripts de start/stop

Os scripts `start_ruas.sh` e `parar_ruas.sh` (na home do usuário) já
foram ajustados para chamar `docker compose up -d --build` /
`docker compose down` na raiz do projeto, em vez de
`systemctl restart/stop backend-ruas`.

## Backup do banco

```bash
cp /home/mateus/projetoruas-data/database.db \
   /home/mateus/projetoruas-data/database_$(date +%Y%m%d).db.bak
```

`/home/mateus/projetoruas-data/` está fora do repositório Git, então
não há risco de ser sobrescrito pelo `git pull`.

## Rotas principais da API

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/schemas` | Schemas dos formulários dinâmicos |
| GET/POST | `/api/pacientes` | Listar / criar pacientes |
| GET/PUT/DELETE | `/api/pacientes/<id>` | Detalhe / editar notas / excluir |
| POST | `/api/pacientes/<id>/atendimentos` | Nova evolução |
| PUT | `/api/pacientes/<id>/atendimentos/<atend_id>` | Editar evolução |
| POST | `/api/pacientes/<id>/timeline` | Evento manual na timeline |
| GET/POST | `/api/tarefas` | Listar / criar tarefas |
| PUT/DELETE | `/api/tarefas/<id>` | Atualizar status / excluir |
| POST | `/api/tarefas/<id>/comentarios` | Comentário interno |
| GET/POST | `/api/financeiro` | Listar / criar registro (gasto futuro cria tarefa automaticamente) |
| GET/POST | `/api/logs` | Auditoria |
| GET | `/api/health` | Healthcheck |