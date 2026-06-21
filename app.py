"""
Cadastro Ágil Ruas - Backend Flask + SQLite
=============================================
API REST que substitui o armazenamento em localStorage por um banco
SQLite real, com tabelas relacionais para pacientes, atendimentos,
timeline, tarefas, comentários, financeiro, logs de auditoria e
schemas de formulários dinâmicos.

Estrutura de rotas:
  GET/POST  /api/schemas
  DELETE    /api/schemas/<perfil_chave>
  GET       /api/pacientes  (filtros: bairro, perfil_chave, ano, data_inicio, data_fim)
  POST      /api/pacientes
  GET       /api/pacientes/<id>
  PUT       /api/pacientes/<id>
  DELETE    /api/pacientes/<id>
  POST      /api/pacientes/<id>/atendimentos
  PUT       /api/pacientes/<id>/atendimentos/<atend_id>
  PATCH     /api/pacientes/<id>/atendimentos/<atend_id>/urgencia
  POST      /api/pacientes/<id>/timeline
  GET       /api/tarefas  (filtro: bairro)
  POST      /api/tarefas
  PUT       /api/tarefas/<id>
  DELETE    /api/tarefas/<id>
  POST      /api/tarefas/<id>/comentarios
  GET       /api/financeiro  (filtros: ano, data_inicio, data_fim)
  POST      /api/financeiro
  GET       /api/materiais  (filtros: ano, data_inicio, data_fim, bairro, tipo, vencidos)
  POST      /api/materiais
  DELETE    /api/materiais/<id>
  GET       /api/materiais/analise
  GET       /api/logs
  POST      /api/logs
  POST      /api/auth/login
  POST      /api/auth/trocar-senha
  GET       /api/usuarios  (requer ?requester=<username> da diretoria)
  POST      /api/usuarios/<username>/redefinir-senha  (diretoria)
"""

import os
import sqlite3
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "data", "database.db"))
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)  # ajuste allow_origins conforme necessário em produção


# ----------------------------------------------------------------
# Conexão com o banco
# ----------------------------------------------------------------
def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    # Popular schemas padrão se ainda não existirem
    cur = conn.execute("SELECT COUNT(*) FROM form_schemas")
    if cur.fetchone()[0] == 0:
        default_schemas = {
            "adulto": {
                "title": "Perfil Adulto",
                "fields": [
                    {"id": "a_nome", "label": "Nome Social / Completo *", "type": "text"},
                    {"id": "a_idade", "label": "Idade", "type": "number"},
                    {"id": "a_tempo", "label": "Tempo de Situação de Rua", "type": "select",
                     "options": ["Menos de 6 meses", "6 meses a 1 ano", "1 a 5 anos", "Mais de 5 anos"]},
                    {"id": "a_saude", "label": "Condições de Saúde / Uso de Substâncias", "type": "textarea"},
                    {"id": "a_demandas", "label": "Demandas do Atendimento Hoje", "type": "textarea"},
                ],
            },
            "crianca": {
                "title": "Perfil Criança",
                "fields": [
                    {"id": "c_nome", "label": "Nome da Criança *", "type": "text"},
                    {"id": "c_idade", "label": "Idade", "type": "number"},
                    {"id": "c_resp", "label": "Nome do Responsável Presente", "type": "text"},
                    {"id": "c_saude", "label": "Condição de Saúde, Sinais Físicos", "type": "textarea"},
                ],
            },
            "adolescente": {
                "title": "Perfil Adolescente",
                "fields": [
                    {"id": "ad_nome", "label": "Nome do Adolescente *", "type": "text"},
                    {"id": "ad_idade", "label": "Idade", "type": "number"},
                    {"id": "ad_resp", "label": "Nome do Responsável Presente", "type": "text"},
                    {"id": "ad_saude", "label": "Condição de Saúde, Sinais Físicos", "type": "textarea"},
                    {"id": "ad_demandas", "label": "Demandas do Atendimento Hoje", "type": "textarea"},
                ],
            },
        }
        for chave, schema in default_schemas.items():
            conn.execute(
                "INSERT INTO form_schemas (perfil_chave, title, fields_json) VALUES (?, ?, ?)",
                (chave, schema["title"], json.dumps(schema["fields"], ensure_ascii=False)),
            )
        conn.commit()

    # Popular usuários padrão se ainda não existirem.
    # Senha inicial de cada conta: "<usuario>2026" (ex: diretoria2026, tijuca2026).
    # Sem troca obrigatória - o usuário pode trocar quando quiser pela própria conta
    # ou a diretoria pode redefinir a senha de qualquer um a qualquer momento.
    cur = conn.execute("SELECT COUNT(*) FROM usuarios")
    if cur.fetchone()[0] == 0:
        usuarios_padrao = [
            ("diretoria", "diretoria", None, "Diretoria (Acesso Total)"),
            ("largodomacho", "operacional", "largodomacho", "Largo do Machio"),
            ("copacabana", "operacional", "copacabana", "Copacabana"),
            ("tijuca", "operacional", "tijuca", "Tijuca"),
            ("gloria", "operacional", "gloria", "Glória"),
            ("botafogo", "operacional", "botafogo", "Botafogo"),
        ]
        for username, tipo, bairro, label in usuarios_padrao:
            senha_padrao_hash = generate_password_hash(f"{username}2026")
            conn.execute(
                """INSERT INTO usuarios (username, senha_hash, tipo, bairro, label, deve_trocar_senha)
                   VALUES (?, ?, ?, ?, ?, 0)""",
                (username, senha_padrao_hash, tipo, bairro, label),
            )
        conn.commit()
    conn.close()


# Tipos de campo suportados pelo motor de formulários (requisito 1: +2 tipos novos)
FIELD_TYPES = ["text", "number", "textarea", "select", "checkbox", "date"]


# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------
def now_str():
    return datetime.now().strftime("%d/%m/%Y %H:%M:%S")


def new_id():
    return "id_" + uuid.uuid4().hex[:12]


def row_to_dict(row):
    return dict(row) if row else None


# ==================================================================
# SCHEMAS DE FORMULÁRIOS
# ==================================================================
@app.route("/api/schemas", methods=["GET"])
def get_schemas():
    db = get_db()
    rows = db.execute("SELECT perfil_chave, title, fields_json FROM form_schemas").fetchall()
    result = {}
    for r in rows:
        result[r["perfil_chave"]] = {
            "title": r["title"],
            "fields": json.loads(r["fields_json"]),
        }
    return jsonify(result)


@app.route("/api/schemas", methods=["POST"])
def save_schemas():
    """Recebe o objeto completo de schemas e regrava (igual ao Backend.save antigo)."""
    data = request.get_json(force=True)
    db = get_db()
    for chave, schema in data.items():
        for f in schema.get("fields", []):
            tipo = f.get("type")
            if tipo not in FIELD_TYPES:
                return jsonify({"error": f"Tipo de campo inválido: '{tipo}'."}), 400
            # Validação: campos de múltipla escolha (select/checkbox) precisam de >= 2 opções
            if tipo in ("select", "checkbox") and len(f.get("options", [])) < 2:
                return jsonify({"error": f"Campo '{f.get('label')}' ({tipo}) precisa de no mínimo 2 opções."}), 400
        db.execute(
            """INSERT INTO form_schemas (perfil_chave, title, fields_json) VALUES (?, ?, ?)
               ON CONFLICT(perfil_chave) DO UPDATE SET title=excluded.title, fields_json=excluded.fields_json""",
            (chave, schema["title"], json.dumps(schema["fields"], ensure_ascii=False)),
        )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/schemas/<perfil_chave>", methods=["DELETE"])
def deletar_schema(perfil_chave):
    db = get_db()
    db.execute("DELETE FROM form_schemas WHERE perfil_chave = ?", (perfil_chave,))
    db.commit()
    return jsonify({"ok": True})


# ==================================================================
# PACIENTES / PRONTUÁRIOS
# ==================================================================
def _carregar_paciente_completo(db, pac_id):
    pac = db.execute("SELECT * FROM pacientes WHERE id = ?", (pac_id,)).fetchone()
    if not pac:
        return None
    pac = dict(pac)

    historico = db.execute(
        "SELECT * FROM atendimentos WHERE paciente_id = ? ORDER BY criado_em ASC", (pac_id,)
    ).fetchall()
    pac["historico"] = []
    for a in historico:
        a = dict(a)
        a["respostas"] = json.loads(a.pop("respostas_json"))
        a["dataStr"] = a.pop("data_str")
        a["dataAtendimento"] = a.pop("data_atendimento")
        a["user"] = a.pop("usuario")
        pac["historico"].append(a)

    eventos = db.execute(
        "SELECT * FROM eventos_timeline WHERE paciente_id = ? ORDER BY criado_em ASC", (pac_id,)
    ).fetchall()
    pac["eventosTimeline"] = []
    for e in eventos:
        e = dict(e)
        e["data"] = e.pop("data_str")
        e["user"] = e.pop("usuario")
        pac["eventosTimeline"].append(e)

    urgencias = db.execute(
        "SELECT * FROM historico_urgencia WHERE paciente_id = ? ORDER BY criado_em ASC", (pac_id,)
    ).fetchall()
    pac["historicoUrgencia"] = []
    for u in urgencias:
        u = dict(u)
        u["atendimentoId"] = u.pop("atendimento_id")
        u["urgenciaAnterior"] = u.pop("urgencia_anterior")
        u["urgenciaNova"] = u.pop("urgencia_nova")
        u["data"] = u.pop("data_str")
        u["user"] = u.pop("usuario")
        pac["historicoUrgencia"].append(u)

    # Normalizar nomes de campos para o formato esperado pelo frontend
    pac["perfilChave"] = pac.pop("perfil_chave")
    pac["notasGerais"] = pac.pop("notas_gerais")
    pac["historicoVida"] = pac.pop("historico_vida")
    pac["criadoPor"] = pac.pop("criado_por")
    pac["bairroRegistro"] = pac.pop("bairro_registro")
    return pac


@app.route("/api/pacientes", methods=["GET"])
def listar_pacientes():
    """Lista todos os pacientes com histórico e timeline completos.
    Filtros opcionais:
      ?bairro=copacabana
      ?perfil_chave=adulto|crianca|adolescente
      ?ano=2026 (filtra pelo ano do primeiro atendimento)
      ?data_inicio=2026-01-01&data_fim=2026-12-31
    """
    db = get_db()
    bairro = request.args.get("bairro")
    if bairro:
        rows = db.execute("SELECT id FROM pacientes WHERE bairro = ? ORDER BY criado_em ASC", (bairro,)).fetchall()
    else:
        rows = db.execute("SELECT id FROM pacientes ORDER BY criado_em ASC").fetchall()

    pacientes = [_carregar_paciente_completo(db, r["id"]) for r in rows]

    perfil_chave = request.args.get("perfil_chave")
    ano = request.args.get("ano")
    data_inicio = request.args.get("data_inicio")
    data_fim = request.args.get("data_fim")

    if perfil_chave:
        pacientes = [p for p in pacientes if p["perfilChave"] == perfil_chave]

    if ano or data_inicio or data_fim:
        def primeiro_atend_data(p):
            if not p["historico"]:
                return None
            a = p["historico"][0]
            return a.get("dataAtendimento") or _data_iso_de_data_str(a["dataStr"])

        if ano:
            pacientes = [p for p in pacientes if (primeiro_atend_data(p) or "")[:4] == str(ano)]
        if data_inicio:
            pacientes = [p for p in pacientes if primeiro_atend_data(p) and primeiro_atend_data(p) >= data_inicio]
        if data_fim:
            pacientes = [p for p in pacientes if primeiro_atend_data(p) and primeiro_atend_data(p) <= data_fim]

    return jsonify(pacientes)


@app.route("/api/pacientes", methods=["POST"])
def criar_paciente():
    """Cria um paciente novo com seu primeiro atendimento."""
    data = request.get_json(force=True)
    db = get_db()
    pac_id = data.get("id") or new_id()

    db.execute(
        """INSERT INTO pacientes (id, nome, perfil, perfil_chave, bairro, bairro_registro, criado_por, notas_gerais, historico_vida)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (pac_id, data["nome"], data["perfil"], data["perfilChave"], data.get("bairro"),
         data.get("bairroRegistro"), data.get("criadoPor"), data.get("notasGerais", ""), data.get("historicoVida", "")),
    )

    for atend in data.get("historico", []):
        atend_id = _inserir_atendimento(db, pac_id, atend)
        # Registro inicial de urgência no histórico
        _inserir_historico_urgencia(db, pac_id, atend_id, None, atend.get("urgencia", "BAIXA"), atend.get("user"), atend.get("dataStr", now_str()))

    for ev in data.get("eventosTimeline", []):
        _inserir_evento(db, pac_id, ev)

    db.commit()
    return jsonify(_carregar_paciente_completo(db, pac_id)), 201


@app.route("/api/pacientes/<pac_id>", methods=["GET"])
def obter_paciente(pac_id):
    db = get_db()
    pac = _carregar_paciente_completo(db, pac_id)
    if not pac:
        return jsonify({"error": "Paciente não encontrado"}), 404
    return jsonify(pac)


@app.route("/api/pacientes/<pac_id>", methods=["PUT"])
def atualizar_paciente(pac_id):
    """Atualiza nome, notas gerais, histórico de vida e bairro de registro do paciente."""
    data = request.get_json(force=True)
    db = get_db()
    pac = db.execute("SELECT * FROM pacientes WHERE id = ?", (pac_id,)).fetchone()
    if not pac:
        return jsonify({"error": "Paciente não encontrado"}), 404

    novo_bairro_registro = data.get("bairroRegistro", pac["bairro_registro"])

    db.execute(
        """UPDATE pacientes SET nome = ?, notas_gerais = ?, historico_vida = ?, bairro_registro = ?, atualizado_em = datetime('now')
           WHERE id = ?""",
        (data.get("nome", pac["nome"]), data.get("notasGerais", pac["notas_gerais"]),
         data.get("historicoVida", pac["historico_vida"]), novo_bairro_registro, pac_id),
    )

    # Auditoria: alteração de bairro de registro (requisito 9 e 10)
    if novo_bairro_registro != pac["bairro_registro"]:
        log_id = new_id()
        db.execute(
            """INSERT INTO logs_auditoria (id, data_iso, data_str, usuario, bairro, modulo, acao, alvo, campo, valor_anterior, valor_novo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (log_id, datetime.now().isoformat(), now_str(), data.get("user"), data.get("bairroOperador"),
             "Prontuario", "editar-bairro-registro", pac["nome"], "Bairro de Registro",
             pac["bairro_registro"], novo_bairro_registro),
        )
        _inserir_evento(db, pac_id, {
            "tipo": "alteracao",
            "descricao": f"Bairro de registro alterado: {pac['bairro_registro'] or '(não definido)'} → {novo_bairro_registro}",
            "data": now_str(),
            "user": data.get("user"),
        })

    db.commit()
    return jsonify(_carregar_paciente_completo(db, pac_id))


@app.route("/api/pacientes/<pac_id>", methods=["DELETE"])
def deletar_paciente(pac_id):
    db = get_db()
    db.execute("DELETE FROM pacientes WHERE id = ?", (pac_id,))
    db.commit()
    return jsonify({"ok": True})


def _inserir_atendimento(db, pac_id, atend):
    atend_id = atend.get("id") or new_id()
    db.execute(
        """INSERT INTO atendimentos (id, paciente_id, data_str, data_atendimento, respostas_json, urgencia, usuario)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (atend_id, pac_id, atend.get("dataStr", now_str()), atend.get("dataAtendimento"),
         json.dumps(atend.get("respostas", {}), ensure_ascii=False),
         atend.get("urgencia", "BAIXA"), atend.get("user")),
    )
    return atend_id


def _inserir_historico_urgencia(db, pac_id, atend_id, urgencia_anterior, urgencia_nova, usuario, data_str=None):
    h_id = new_id()
    db.execute(
        """INSERT INTO historico_urgencia (id, paciente_id, atendimento_id, urgencia_anterior, urgencia_nova, usuario, data_str)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (h_id, pac_id, atend_id, urgencia_anterior, urgencia_nova, usuario, data_str or now_str()),
    )
    return h_id


def _inserir_evento(db, pac_id, ev):
    ev_id = ev.get("id") or new_id()
    db.execute(
        """INSERT INTO eventos_timeline (id, paciente_id, tipo, descricao, data_str, usuario)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (ev_id, pac_id, ev.get("tipo", "evolucao"), ev.get("descricao", ""),
         ev.get("data", now_str()), ev.get("user")),
    )
    return ev_id


@app.route("/api/pacientes/<pac_id>/atendimentos", methods=["POST"])
def adicionar_atendimento(pac_id):
    """Adiciona uma nova evolução/atendimento a um paciente existente."""
    data = request.get_json(force=True)
    db = get_db()
    pac = db.execute("SELECT * FROM pacientes WHERE id = ?", (pac_id,)).fetchone()
    if not pac:
        return jsonify({"error": "Paciente não encontrado"}), 404

    atend_id = _inserir_atendimento(db, pac_id, data)
    _inserir_historico_urgencia(db, pac_id, atend_id, None, data.get("urgencia", "BAIXA"), data.get("user"), data.get("dataStr", now_str()))

    # Atualiza nome principal se enviado
    if data.get("nome"):
        db.execute("UPDATE pacientes SET nome = ?, atualizado_em = datetime('now') WHERE id = ?",
                    (data["nome"], pac_id))

    # Evento de timeline automático
    _inserir_evento(db, pac_id, {
        "tipo": "atendimento",
        "descricao": f"Evolução clínica/social registrada (Urgência: {data.get('urgencia', 'BAIXA')})",
        "data": data.get("dataStr", now_str()),
        "user": data.get("user"),
    })

    db.commit()
    return jsonify({"id": atend_id, "paciente": _carregar_paciente_completo(db, pac_id)}), 201


@app.route("/api/pacientes/<pac_id>/atendimentos/<atend_id>", methods=["PUT"])
def editar_atendimento(pac_id, atend_id):
    """Edita um atendimento existente (correção de ficha). Se a urgência mudar,
    registra no histórico de urgência (requisito 4)."""
    data = request.get_json(force=True)
    db = get_db()
    atend = db.execute("SELECT * FROM atendimentos WHERE id = ? AND paciente_id = ?", (atend_id, pac_id)).fetchone()
    if not atend:
        return jsonify({"error": "Atendimento não encontrado"}), 404

    nova_urgencia = data.get("urgencia", atend["urgencia"])
    nova_data_atend = data.get("dataAtendimento", atend["data_atendimento"])

    db.execute(
        "UPDATE atendimentos SET respostas_json = ?, urgencia = ?, data_atendimento = ? WHERE id = ?",
        (json.dumps(data.get("respostas", {}), ensure_ascii=False), nova_urgencia, nova_data_atend, atend_id),
    )

    if nova_urgencia != atend["urgencia"]:
        _inserir_historico_urgencia(db, pac_id, atend_id, atend["urgencia"], nova_urgencia, data.get("user"))
        _inserir_evento(db, pac_id, {
            "tipo": "alteracao",
            "descricao": f"Urgência alterada: {atend['urgencia']} → {nova_urgencia}",
            "data": now_str(),
            "user": data.get("user"),
        })

    if data.get("nome"):
        db.execute("UPDATE pacientes SET nome = ?, atualizado_em = datetime('now') WHERE id = ?",
                    (data["nome"], pac_id))
    db.commit()
    return jsonify(_carregar_paciente_completo(db, pac_id))


@app.route("/api/pacientes/<pac_id>/atendimentos/<atend_id>/urgencia", methods=["PATCH"])
def alterar_urgencia(pac_id, atend_id):
    """Atualiza apenas a urgência de um atendimento (edição manual pós-salvamento)."""
    data = request.get_json(force=True)
    db = get_db()
    atend = db.execute("SELECT * FROM atendimentos WHERE id = ? AND paciente_id = ?", (atend_id, pac_id)).fetchone()
    if not atend:
        return jsonify({"error": "Atendimento não encontrado"}), 404

    nova_urgencia = data["urgencia"]
    if nova_urgencia not in ("ALTA", "MÉDIA", "BAIXA"):
        return jsonify({"error": "Urgência inválida. Use ALTA, MÉDIA ou BAIXA."}), 400

    db.execute("UPDATE atendimentos SET urgencia = ? WHERE id = ?", (nova_urgencia, atend_id))

    if nova_urgencia != atend["urgencia"]:
        _inserir_historico_urgencia(db, pac_id, atend_id, atend["urgencia"], nova_urgencia, data.get("user"))
        _inserir_evento(db, pac_id, {
            "tipo": "alteracao",
            "descricao": f"Urgência alterada manualmente: {atend['urgencia']} → {nova_urgencia}",
            "data": now_str(),
            "user": data.get("user"),
        })

    db.commit()
    return jsonify(_carregar_paciente_completo(db, pac_id))


@app.route("/api/pacientes/<pac_id>/timeline", methods=["POST"])
def adicionar_evento_timeline(pac_id):
    """Adiciona um evento manual à timeline (ex.: vindo do módulo de Tarefas)."""
    data = request.get_json(force=True)
    db = get_db()
    pac = db.execute("SELECT id FROM pacientes WHERE id = ?", (pac_id,)).fetchone()
    if not pac:
        return jsonify({"error": "Paciente não encontrado"}), 404
    ev_id = _inserir_evento(db, pac_id, data)
    db.commit()
    return jsonify({"id": ev_id}), 201


# ==================================================================
# TAREFAS
# ==================================================================
def _carregar_tarefa_completa(db, tarefa_id):
    t = db.execute("SELECT * FROM tarefas WHERE id = ?", (tarefa_id,)).fetchone()
    if not t:
        return None
    t = dict(t)
    comentarios = db.execute(
        "SELECT * FROM comentarios_tarefa WHERE tarefa_id = ? ORDER BY criado_em ASC", (tarefa_id,)
    ).fetchall()
    t["comentarios"] = []
    for c in comentarios:
        c = dict(c)
        c["texto"] = c["texto"]
        c["user"] = c.pop("usuario")
        c["data"] = c.pop("data_str")
        t["comentarios"].append({k: c[k] for k in ("texto", "user", "data")})

    # Normalização de nomes para o frontend
    t["text"] = t.pop("texto")
    t["date"] = t.pop("data_str")
    t["doneDate"] = t.pop("done_date")
    t["user"] = t.pop("usuario")
    t["pacienteId"] = t.pop("paciente_id")
    t["origemFinanceiro"] = t.pop("origem_financeiro_id")
    t["bairroOrigem"] = t.pop("bairro_origem")
    t["mencoes"] = json.loads(t.pop("mencoes_json") or "[]")
    t["completed"] = (t["status"] == "Concluído")
    t["anexos"] = []  # reservado para uploads futuros
    return t


@app.route("/api/tarefas", methods=["GET"])
def listar_tarefas():
    """Lista tarefas. Por padrão retorna tarefas do bairro (ou sem bairro) +
    tarefas onde o bairro foi mencionado via @ (requisito 8 - tarefas entre equipes).
    /api/tarefas?bairro=copacabana
    """
    db = get_db()
    bairro = request.args.get("bairro")
    if bairro:
        rows = db.execute(
            """SELECT id FROM tarefas
               WHERE bairro = ? OR bairro IS NULL OR mencoes_json LIKE ?
               ORDER BY criado_em ASC""",
            (bairro, f'%"{bairro}"%'),
        ).fetchall()
    else:
        rows = db.execute("SELECT id FROM tarefas ORDER BY criado_em ASC").fetchall()
    return jsonify([_carregar_tarefa_completa(db, r["id"]) for r in rows])


@app.route("/api/tarefas", methods=["POST"])
def criar_tarefa():
    data = request.get_json(force=True)
    db = get_db()
    tarefa_id = data.get("id") or new_id()
    mencoes = data.get("mencoes", [])
    db.execute(
        """INSERT INTO tarefas (id, texto, status, prioridade, prazo, data_str, usuario, bairro, bairro_origem, paciente_id, mencoes_json, origem_financeiro_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tarefa_id, data["text"], data.get("status", "Pendente"), data.get("prioridade", "Média"),
         data.get("prazo"), data.get("date", now_str()), data.get("user"), data.get("bairro"),
         data.get("bairroOrigem"), data.get("pacienteId"), json.dumps(mencoes, ensure_ascii=False),
         data.get("origemFinanceiro")),
    )
    db.commit()
    return jsonify(_carregar_tarefa_completa(db, tarefa_id)), 201


@app.route("/api/tarefas/<tarefa_id>", methods=["PUT"])
def atualizar_tarefa(tarefa_id):
    """Atualiza status, prioridade, prazo, etc."""
    data = request.get_json(force=True)
    db = get_db()
    t = db.execute("SELECT * FROM tarefas WHERE id = ?", (tarefa_id,)).fetchone()
    if not t:
        return jsonify({"error": "Tarefa não encontrada"}), 404

    novo_status = data.get("status", t["status"])
    done_date = t["done_date"]
    if novo_status == "Concluído" and t["status"] != "Concluído":
        done_date = now_str()
    elif novo_status != "Concluído":
        done_date = None

    db.execute(
        """UPDATE tarefas SET status = ?, prioridade = ?, prazo = ?, done_date = ?, atualizado_em = datetime('now')
           WHERE id = ?""",
        (novo_status, data.get("prioridade", t["prioridade"]), data.get("prazo", t["prazo"]), done_date, tarefa_id),
    )
    db.commit()
    return jsonify(_carregar_tarefa_completa(db, tarefa_id))


@app.route("/api/tarefas/<tarefa_id>", methods=["DELETE"])
def deletar_tarefa(tarefa_id):
    db = get_db()
    db.execute("DELETE FROM tarefas WHERE id = ?", (tarefa_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/tarefas/<tarefa_id>/comentarios", methods=["POST"])
def adicionar_comentario(tarefa_id):
    data = request.get_json(force=True)
    db = get_db()
    t = db.execute("SELECT id FROM tarefas WHERE id = ?", (tarefa_id,)).fetchone()
    if not t:
        return jsonify({"error": "Tarefa não encontrada"}), 404
    com_id = new_id()
    db.execute(
        "INSERT INTO comentarios_tarefa (id, tarefa_id, texto, usuario, data_str) VALUES (?, ?, ?, ?, ?)",
        (com_id, tarefa_id, data["texto"], data.get("user"), data.get("data", now_str())),
    )
    db.commit()
    return jsonify(_carregar_tarefa_completa(db, tarefa_id)), 201


# ==================================================================
# FINANCEIRO
# ==================================================================
@app.route("/api/financeiro", methods=["GET"])
def listar_financeiro():
    """Lista registros financeiros. Filtros opcionais:
    ?ano=2026 - filtra pelo ano de data_registro (ou data_str se ausente)
    ?data_inicio=2026-01-01&data_fim=2026-12-31 - intervalo de datas (data_registro)
    """
    db = get_db()
    rows = db.execute("SELECT * FROM financeiro ORDER BY criado_em ASC").fetchall()
    result = []
    for r in rows:
        r = dict(r)
        r["data"] = r.pop("data_str")
        r["dataRegistro"] = r.pop("data_registro")
        r["desc"] = r.pop("descricao")
        r["user"] = r.pop("usuario")
        r["dataPrevista"] = r.pop("data_prevista")
        result.append(r)

    ano = request.args.get("ano")
    data_inicio = request.args.get("data_inicio")
    data_fim = request.args.get("data_fim")

    def data_efetiva(r):
        return r.get("dataRegistro") or _data_iso_de_data_str(r["data"])

    if ano:
        result = [r for r in result if (data_efetiva(r) or "")[:4] == str(ano)]
    if data_inicio:
        result = [r for r in result if data_efetiva(r) and data_efetiva(r) >= data_inicio]
    if data_fim:
        result = [r for r in result if data_efetiva(r) and data_efetiva(r) <= data_fim]

    return jsonify(result)


def _data_iso_de_data_str(data_str):
    """Converte 'dd/mm/yyyy HH:MM:SS' -> 'yyyy-mm-dd' para comparação de filtros."""
    try:
        return datetime.strptime(data_str.split(" ")[0], "%d/%m/%Y").strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


@app.route("/api/financeiro", methods=["POST"])
def criar_registro_financeiro():
    """Cria um registro financeiro. Se tipo == 'futuro', também cria
    automaticamente uma tarefa correspondente no To Do."""
    data = request.get_json(force=True)
    db = get_db()
    reg_id = data.get("id") or new_id()
    db.execute(
        """INSERT INTO financeiro (id, data_str, data_registro, tipo, descricao, valor, usuario, bairro, data_prevista)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (reg_id, data.get("data", now_str()), data.get("dataRegistro"), data["tipo"], data["desc"], data["valor"],
         data.get("user"), data.get("bairro"), data.get("dataPrevista")),
    )

    tarefa_criada = None
    if data["tipo"] == "futuro":
        tarefa_id = new_id()
        valor_fmt = f"{data['valor']:.2f}".replace(".", ",")
        db.execute(
            """INSERT INTO tarefas (id, texto, status, prioridade, prazo, data_str, usuario, bairro, origem_financeiro_id)
               VALUES (?, ?, 'Pendente', 'Média', ?, ?, ?, ?, ?)""",
            (tarefa_id, f"Gasto previsto: {data['desc']} (R$ {valor_fmt})", data.get("dataPrevista"),
             now_str(), data.get("user"), data.get("bairro"), reg_id),
        )
        tarefa_criada = _carregar_tarefa_completa(db, tarefa_id)

    db.commit()
    return jsonify({"registro_id": reg_id, "tarefa_criada": tarefa_criada}), 201


# ==================================================================
# MATERIAIS (estoque, validade, movimentação)
# ==================================================================
@app.route("/api/materiais", methods=["GET"])
def listar_materiais():
    """Lista materiais. Filtros opcionais:
    ?ano=2026, ?data_inicio=, ?data_fim=, ?bairro=, ?tipo=, ?vencidos=true
    """
    db = get_db()
    rows = db.execute("SELECT * FROM materiais ORDER BY criado_em ASC").fetchall()
    result = []
    for r in rows:
        r = dict(r)
        r["data"] = r.pop("data_str")
        r["dataRegistro"] = r.pop("data_registro")
        r["user"] = r.pop("usuario")
        result.append(r)

    ano = request.args.get("ano")
    data_inicio = request.args.get("data_inicio")
    data_fim = request.args.get("data_fim")
    bairro = request.args.get("bairro")
    tipo = request.args.get("tipo")
    vencidos = request.args.get("vencidos")

    def data_efetiva(r):
        return r.get("dataRegistro") or _data_iso_de_data_str(r["data"])

    if ano:
        result = [r for r in result if (data_efetiva(r) or "")[:4] == str(ano)]
    if data_inicio:
        result = [r for r in result if data_efetiva(r) and data_efetiva(r) >= data_inicio]
    if data_fim:
        result = [r for r in result if data_efetiva(r) and data_efetiva(r) <= data_fim]
    if bairro:
        result = [r for r in result if r.get("bairro") == bairro]
    if tipo:
        result = [r for r in result if r.get("tipo") == tipo]
    if vencidos == "true":
        hoje = datetime.now().strftime("%Y-%m-%d")
        result = [r for r in result if r.get("validade") and r["validade"] < hoje]

    return jsonify(result)


@app.route("/api/materiais", methods=["POST"])
def criar_material():
    """Cria um registro de movimentação de material (entrada ou saída)."""
    data = request.get_json(force=True)
    db = get_db()

    if not data.get("tipo"):
        return jsonify({"error": "Campo 'Tipo' é obrigatório."}), 400
    if data.get("quantidade") is None:
        return jsonify({"error": "Campo 'Quantidade' é obrigatório."}), 400

    mat_id = data.get("id") or new_id()
    db.execute(
        """INSERT INTO materiais (id, tipo, descricao, data_str, data_registro, validade, quantidade, movimento, usuario, bairro)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (mat_id, data["tipo"], data.get("descricao", ""), data.get("data", now_str()),
         data.get("dataRegistro"), data.get("validade"), data["quantidade"],
         data.get("movimento", "entrada"), data.get("user"), data.get("bairro")),
    )
    db.commit()
    return jsonify({"id": mat_id}), 201


@app.route("/api/materiais/<mat_id>", methods=["DELETE"])
def deletar_material(mat_id):
    db = get_db()
    db.execute("DELETE FROM materiais WHERE id = ?", (mat_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/materiais/analise", methods=["GET"])
def analise_materiais():
    """Área analítica: estoque atual (entradas - saídas) por tipo, itens
    vencidos e itens próximos da validade (<=30 dias)."""
    db = get_db()
    rows = db.execute("SELECT * FROM materiais").fetchall()
    rows = [dict(r) for r in rows]

    estoque = {}
    for r in rows:
        tipo = r["tipo"]
        estoque.setdefault(tipo, 0)
        if r["movimento"] == "saida":
            estoque[tipo] -= r["quantidade"]
        else:
            estoque[tipo] += r["quantidade"]

    hoje = datetime.now().strftime("%Y-%m-%d")
    em_30_dias = (datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).fromtimestamp(
        datetime.now().timestamp() + 30 * 86400)).strftime("%Y-%m-%d")

    vencidos = [r for r in rows if r.get("validade") and r["validade"] < hoje]
    proximos_vencimento = [r for r in rows if r.get("validade") and hoje <= r["validade"] <= em_30_dias]

    return jsonify({
        "estoquePorTipo": estoque,
        "vencidos": vencidos,
        "proximosVencimento": proximos_vencimento,
    })



@app.route("/api/logs", methods=["GET"])
def listar_logs():
    """Lista logs de auditoria. Filtros: ?usuario=xxx&modulo=xxx&limit=300"""
    db = get_db()
    query = "SELECT * FROM logs_auditoria WHERE 1=1"
    params = []
    if request.args.get("usuario"):
        query += " AND usuario = ?"
        params.append(request.args["usuario"])
    if request.args.get("modulo"):
        query += " AND modulo = ?"
        params.append(request.args["modulo"])
    query += " ORDER BY criado_em DESC LIMIT ?"
    params.append(int(request.args.get("limit", 300)))

    rows = db.execute(query, params).fetchall()
    result = []
    for r in rows:
        r = dict(r)
        r["dataStr"] = r.pop("data_str")
        r["valorAnterior"] = r.pop("valor_anterior")
        r["valorNovo"] = r.pop("valor_novo")
        result.append(r)
    return jsonify(result)


@app.route("/api/logs", methods=["POST"])
def criar_log():
    data = request.get_json(force=True)
    db = get_db()
    log_id = new_id()
    db.execute(
        """INSERT INTO logs_auditoria (id, data_iso, data_str, usuario, bairro, modulo, acao, alvo, campo, valor_anterior, valor_novo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log_id, data.get("data", datetime.now().isoformat()), data.get("dataStr", now_str()),
         data.get("usuario"), data.get("bairro"), data["modulo"], data["acao"], data.get("alvo"),
         data.get("campo"), data.get("valorAnterior"), data.get("valorNovo")),
    )
    db.commit()
    return jsonify({"id": log_id}), 201


# ==================================================================
# AUTENTICAÇÃO E GESTÃO DE USUÁRIOS
# ==================================================================
def _usuario_publico(row):
    """Remove o hash de senha antes de retornar dados do usuário."""
    return {
        "username": row["username"],
        "tipo": row["tipo"],
        "bairro": row["bairro"],
        "label": row["label"],
        "deveTrocarSenha": bool(row["deve_trocar_senha"]),
    }


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip().lower()
    senha = data.get("password") or ""

    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE username = ?", (username,)).fetchone()
    if not user or not check_password_hash(user["senha_hash"], senha):
        return jsonify({"error": "Usuário ou senha inválidos."}), 401

    return jsonify(_usuario_publico(user))


@app.route("/api/auth/trocar-senha", methods=["POST"])
def trocar_senha():
    """Permite que o próprio usuário troque sua senha (exige a senha atual).
    Usado tanto para a troca obrigatória no primeiro login quanto para
    trocas voluntárias posteriores."""
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip().lower()
    senha_atual = data.get("senhaAtual") or ""
    senha_nova = data.get("senhaNova") or ""

    if len(senha_nova) < 6:
        return jsonify({"error": "A nova senha deve ter pelo menos 6 caracteres."}), 400

    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE username = ?", (username,)).fetchone()
    if not user or not check_password_hash(user["senha_hash"], senha_atual):
        return jsonify({"error": "Senha atual incorreta."}), 401

    novo_hash = generate_password_hash(senha_nova)
    db.execute(
        "UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0, atualizado_em = datetime('now') WHERE username = ?",
        (novo_hash, username),
    )
    db.commit()

    log_id = new_id()
    db.execute(
        """INSERT INTO logs_auditoria (id, data_iso, data_str, usuario, bairro, modulo, acao, alvo, campo, valor_anterior, valor_novo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log_id, datetime.now().isoformat(), now_str(), username, user["bairro"],
         "Auth", "trocar-senha", username, "Senha", None, None),
    )
    db.commit()

    user = db.execute("SELECT * FROM usuarios WHERE username = ?", (username,)).fetchone()
    return jsonify(_usuario_publico(user))


def _requer_diretoria(requester):
    """Valida que o solicitante é da diretoria. Retorna o usuário ou None."""
    if not requester:
        return None
    db = get_db()
    user = db.execute("SELECT * FROM usuarios WHERE username = ?", (requester.strip().lower(),)).fetchone()
    if not user or user["tipo"] != "diretoria":
        return None
    return user


@app.route("/api/usuarios", methods=["GET"])
def listar_usuarios():
    """Lista todos os usuários (sem hashes de senha). Restrito à diretoria."""
    requester = request.args.get("requester")
    if not _requer_diretoria(requester):
        return jsonify({"error": "Acesso restrito à diretoria."}), 403

    db = get_db()
    rows = db.execute("SELECT * FROM usuarios ORDER BY tipo DESC, username ASC").fetchall()
    return jsonify([_usuario_publico(r) for r in rows])


@app.route("/api/usuarios/<username>/redefinir-senha", methods=["POST"])
def redefinir_senha(username):
    """Diretoria define uma nova senha para outro usuário.
    O usuário pode trocá-la depois se quiser, mas não é obrigado."""
    data = request.get_json(force=True)
    requester_user = _requer_diretoria(data.get("requester"))
    if not requester_user:
        return jsonify({"error": "Acesso restrito à diretoria."}), 403

    nova_senha = data.get("novaSenha") or ""
    if len(nova_senha) < 6:
        return jsonify({"error": "A nova senha deve ter pelo menos 6 caracteres."}), 400

    username = username.strip().lower()
    db = get_db()
    target = db.execute("SELECT * FROM usuarios WHERE username = ?", (username,)).fetchone()
    if not target:
        return jsonify({"error": "Usuário não encontrado."}), 404

    novo_hash = generate_password_hash(nova_senha)
    db.execute(
        "UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0, atualizado_em = datetime('now') WHERE username = ?",
        (novo_hash, username),
    )

    log_id = new_id()
    db.execute(
        """INSERT INTO logs_auditoria (id, data_iso, data_str, usuario, bairro, modulo, acao, alvo, campo, valor_anterior, valor_novo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (log_id, datetime.now().isoformat(), now_str(), requester_user["username"], requester_user["bairro"],
         "Auth", "redefinir-senha", username, "Senha", None, None),
    )
    db.commit()
    return jsonify({"ok": True})



@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db": DB_PATH, "exists": os.path.exists(DB_PATH)})


# ==================================================================
# Servir o frontend estático (index.html, app.js, etc.)
# ==================================================================
@app.route("/")
def serve_index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
else:
    # Garante que o banco existe ao rodar via gunicorn
    init_db()
