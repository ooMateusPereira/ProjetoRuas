# Cadastro Ágil Ruas — Backend Flask + SQLite

Backend REST em Flask que substitui o armazenamento em `localStorage` por
um banco **SQLite real** (`./data/database.db`), com tabelas relacionais
para pacientes, atendimentos, timeline, tarefas, comentários, financeiro
e logs de auditoria.

## Estrutura

```
backend/
├── app.py              # API Flask
├── schema.sql          # Schema SQLite (tabelas relacionais)
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── data/                # criado automaticamente -> database.db (NÃO versionar)
└── static/              # frontend (index.html, app.js)
```

## Subir com Docker

```bash
cd backend
docker compose up -d --build
```

- A API fica disponível em `http://SEU_SERVIDOR:5000`
- O frontend (`static/index.html`) é servido na raiz `/`
- O arquivo `./data/database.db` fica persistido **fora** do container,
  na pasta `backend/data/` do seu servidor Ubuntu — pode fazer backup
  copiando esse arquivo.

## Integração com Cloudflare / proxy reverso existente

Como você já tem Docker + Flask atrás do Cloudflare, basta apontar o
proxy/tunnel para `http://ruas-backend:5000` (nome do serviço no
`docker-compose.yml`) ou `http://127.0.0.1:5000` se publicar a porta no
host, conforme já faz com seus outros serviços.

Se este backend for rodar na mesma rede Docker dos seus outros
containers/Cloudflare Tunnel, adicione a rede externa ao
`docker-compose.yml`:

```yaml
networks:
  ruas-net:
    driver: bridge
  # ou, se já existir uma rede compartilhada com o cloudflared:
  # default:
  #   external: true
  #   name: nome_da_rede_existente
```

## Rodar sem Docker (debug local)

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Servidor sobe em `http://0.0.0.0:5000` com SQLite em `./data/database.db`.

## Backup do banco

```bash
# Backup simples (com o container rodando, SQLite suporta cópia "hot"
# para snapshots pontuais; para algo mais seguro, pare o container antes)
cp backend/data/database.db backend/data/database_$(date +%Y%m%d).db.bak
```

Para sincronização com GitHub: **não** versione `data/database.db`
(já está no `.gitignore`). Versione apenas código (`app.py`,
`schema.sql`, `static/`, Dockerfile, etc.) e faça backup do `.db`
separadamente (ex.: rotina de cron + upload para storage externo).

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

## Migração de dados do localStorage antigo

Se você já tinha dados em `localStorage` (chaves `ruas_pacientes_db`,
`ruas_tarefas_db`, `ruas_finance_db`, `form_schema_db`, `ruas_log_db`),
exporte-os do navegador (console: `JSON.stringify(localStorage)`) e me
peça um script de migração — posso gerar um importador que lê esse JSON
e popula as tabelas relacionais via `/api/pacientes`, `/api/tarefas` etc.
