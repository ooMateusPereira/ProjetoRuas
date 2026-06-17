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
  (fora de `/var/www`, que é **read-only** neste servidor para criação
  de novos arquivos/pastas) — faça backup copiando esse arquivo.

> ⚠️ `index.html` e `app.js` **não** são montados via bind mount (pelo
> mesmo motivo do `/var/www` read-only) — eles vão para dentro da
> imagem no build (`COPY index.html app.js ./static/` no Dockerfile).
> Qualquer alteração no frontend exige rebuild, que o
> `start_ruas.sh` já faz automaticamente (`docker compose up -d --build`).

## ⚠️ Atualização de schema (requisitos v2)

Esta versão adiciona tabelas e colunas novas (`materiais`,
`historico_urgencia`, `bairro_registro`, `data_atendimento`, `mencoes_json`,
`usuarios`, perfis `crianca`/`adolescente` separados, etc.). O `schema.sql`
usa `CREATE TABLE IF NOT EXISTS`, então tabelas novas são criadas
automaticamente — mas **colunas novas em tabelas existentes não são
adicionadas via `ALTER TABLE`**.

Como ainda estamos em ambiente de testes (sem dados reais), a forma mais
simples é apagar o banco antigo e deixar o Flask recriar tudo do zero:

```bash
sudo docker compose down
rm -f /home/mateus/projetoruas-data/database.db
sudo docker compose up -d --build
```

Se no futuro já houver dados reais e for necessário preservar, será preciso
um script de migração com `ALTER TABLE ... ADD COLUMN` — posso gerar esse
script quando chegar a hora.

## Autenticação e gestão de usuários

Os usuários (`diretoria`, `largodomacho`, `copacabana`, `tijuca`, `gloria`,
`botafogo`) são criados automaticamente na primeira execução com senha
inicial **`Demo2026`** (hash bcrypt/Werkzeug no banco, não em texto puro).

No primeiro login (qualquer perfil, incluindo diretoria), o sistema exige
a troca obrigatória dessa senha temporária antes de liberar o acesso ao
restante do sistema.

Depois disso, **somente o perfil `diretoria`** tem acesso à aba "Gestão de
Usuários", de onde pode redefinir a senha de qualquer usuário (gerando uma
nova senha temporária, que força o usuário afetado a trocá-la no próximo
login). Toda troca/redefinição de senha é registrada em auditoria
(`/api/logs`, módulo `Auth`).

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
| DELETE | `/api/schemas/<perfil_chave>` | Remover um perfil de formulário |
| GET/POST | `/api/pacientes` | Listar (filtros: bairro, perfil_chave, ano, data_inicio, data_fim) / criar pacientes |
| GET/PUT/DELETE | `/api/pacientes/<id>` | Detalhe / editar notas, bairro de registro / excluir |
| POST | `/api/pacientes/<id>/atendimentos` | Nova evolução (solicita urgência) |
| PUT | `/api/pacientes/<id>/atendimentos/<atend_id>` | Editar evolução (registra mudança de urgência) |
| PATCH | `/api/pacientes/<id>/atendimentos/<atend_id>/urgencia` | Editar apenas a urgência |
| POST | `/api/pacientes/<id>/timeline` | Evento manual na timeline |
| GET/POST | `/api/tarefas` | Listar (filtro: bairro, inclui menções) / criar tarefas |
| PUT/DELETE | `/api/tarefas/<id>` | Atualizar status / excluir |
| POST | `/api/tarefas/<id>/comentarios` | Comentário interno |
| GET/POST | `/api/financeiro` | Listar (filtros: ano, data_inicio, data_fim) / criar registro (gasto futuro cria tarefa automaticamente) |
| GET/POST | `/api/materiais` | Listar (filtros: ano, data_inicio, data_fim, bairro, tipo, vencidos) / criar movimentação |
| DELETE | `/api/materiais/<id>` | Excluir movimentação |
| GET | `/api/materiais/analise` | Estoque por tipo, itens vencidos e próximos da validade |
| GET/POST | `/api/logs` | Auditoria |
| POST | `/api/auth/login` | Login (retorna usuário + flag deveTrocarSenha) |
| POST | `/api/auth/trocar-senha` | Troca de senha (exige senha atual) |
| GET | `/api/usuarios` | Lista usuários (somente diretoria, via `?requester=`) |
| POST | `/api/usuarios/<username>/redefinir-senha` | Diretoria redefine senha de outro usuário |
| GET | `/api/health` | Healthcheck |