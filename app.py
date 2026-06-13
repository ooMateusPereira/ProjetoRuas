"""
Cadastro Ágil Ruas - Backend Flask + SQLite
=============================================
API REST que substitui o armazenamento em localStorage por um banco
SQLite real, com tabelas relacionais para pacientes, atendimentos,
timeline, tarefas, comentários, financeiro, logs de auditoria e
schemas de formulários dinâmicos.

Estrutura de rotas:
  GET/POST  /api/schemas
  GET       /api/pacientes
  POST      /api/pacientes
  GET       /api/pacientes/<id>
  PUT       /api/pacientes/<id>
  DELETE    /api/pacientes/<id>
  POST      /api/pacientes/<id>/atendimentos
  PUT       /api/pacientes/<id>/atendimentos/<atend_id>
  POST      /api/pacientes/<id>/timeline
  GET       /api/tarefas
  POST      /api/tarefas
  PUT       /api/tarefas/<id>
  DELETE    /api/tarefas/<id>
  POST      /api/tarefas/<id>/comentarios
  GET       /api/financeiro
  POST      /api/financeiro
  GET       /api/logs
  POST      /api/logs
"""

import os
import sqlite3
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS

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
                "title": "Perfil Criança / Adolescente",
                "fields": [
                    {"id": "c_nome", "label": "Nome da Criança/Adolescente *", "type": "text"},
                    {"id": "c_idade", "label": "Idade", "type": "number"},
                    {"id": "c_resp", "label": "Nome do Responsável Presente", "type": "text"},
                    {"id": "c_saude", "label": "Condição de Saúde, Sinais Físicos", "type": "textarea"},
                ],
            },
        }
        for chave, schema in default_schemas.items():
            conn.execute(
                "INSERT INTO form_schemas (perfil_chave, title, fields_json) VALUES (?, ?, ?)",
                (chave, schema["title"], json.dumps(schema["fields"], ensure_ascii=False)),
            )
        conn.commit()
    conn.close()


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
        # Validação: campos do tipo select precisam de >= 2 opções
        for f in schema.get("fields", []):
            if f.get("type") == "select" and len(f.get("options", [])) < 2:
                return jsonify({"error": f"Campo '{f.get('label')}' (select) precisa de no mínimo 2 opções."}), 400
        db.execute(
            """INSERT INTO form_schemas (perfil_chave, title, fields_json) VALUES (?, ?, ?)
               ON CONFLICT(perfil_chave) DO UPDATE SET title=excluded.title, fields_json=excluded.fields_json""",
            (chave, schema["title"], json.dumps(schema["fields"], ensure_ascii=False)),
        )
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

    # Normalizar nomes de campos para o formato esperado pelo frontend
    pac["perfilChave"] = pac.pop("perfil_chave")
    pac["notasGerais"] = pac.pop("notas_gerais")
    pac["historicoVida"] = pac.pop("historico_vida")
    pac["criadoPor"] = pac.pop("criado_por")
    return pac


@app.route("/api/pacientes", methods=["GET"])
def listar_pacientes():
    """Lista todos os pacientes com histórico e timeline completos.
    Suporta filtro opcional por bairro: /api/pacientes?bairro=copacabana
    """
    db = get_db()
    bairro = request.args.get("bairro")
    if bairro:
        rows = db.execute("SELECT id FROM pacientes WHERE bairro = ? ORDER BY criado_em ASC", (bairro,)).fetchall()
    else:
        rows = db.execute("SELECT id FROM pacientes ORDER BY criado_em ASC").fetchall()
    return jsonify([_carregar_paciente_completo(db, r["id"]) for r in rows])


@app.route("/api/pacientes", methods=["POST"])
def criar_paciente():
    """Cria um paciente novo com seu primeiro atendimento."""
    data = request.get_json(force=True)
    db = get_db()
    pac_id = data.get("id") or new_id()

    db.execute(
        """INSERT INTO pacientes (id, nome, perfil, perfil_chave, bairro, criado_por, notas_gerais, historico_vida)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (pac_id, data["nome"], data["perfil"], data["perfilChave"], data.get("bairro"),
         data.get("criadoPor"), data.get("notasGerais", ""), data.get("historicoVida", "")),
    )

    for atend in data.get("historico", []):
        _inserir_atendimento(db, pac_id, atend)

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
    """Atualiza nome, notas gerais e histórico de vida do paciente."""
    data = request.get_json(force=True)
    db = get_db()
    pac = db.execute("SELECT * FROM pacientes WHERE id = ?", (pac_id,)).fetchone()
    if not pac:
        return jsonify({"error": "Paciente não encontrado"}), 404

    db.execute(
        """UPDATE pacientes SET nome = ?, notas_gerais = ?, historico_vida = ?, atualizado_em = datetime('now')
           WHERE id = ?""",
        (data.get("nome", pac["nome"]), data.get("notasGerais", pac["notas_gerais"]),
         data.get("historicoVida", pac["historico_vida"]), pac_id),
    )
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
        """INSERT INTO atendimentos (id, paciente_id, data_str, respostas_json, urgencia, usuario)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (atend_id, pac_id, atend.get("dataStr", now_str()),
         json.dumps(atend.get("respostas", {}), ensure_ascii=False),
         atend.get("urgencia", "BAIXA"), atend.get("user")),
    )
    return atend_id


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
    """Edita um atendimento existente (correção de ficha)."""
    data = request.get_json(force=True)
    db = get_db()
    atend = db.execute("SELECT * FROM atendimentos WHERE id = ? AND paciente_id = ?", (atend_id, pac_id)).fetchone()
    if not atend:
        return jsonify({"error": "Atendimento não encontrado"}), 404

    db.execute(
        "UPDATE atendimentos SET respostas_json = ?, urgencia = ? WHERE id = ?",
        (json.dumps(data.get("respostas", {}), ensure_ascii=False), data.get("urgencia", atend["urgencia"]), atend_id),
    )
    if data.get("nome"):
        db.execute("UPDATE pacientes SET nome = ?, atualizado_em = datetime('now') WHERE id = ?",
                    (data["nome"], pac_id))
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
    t["completed"] = (t["status"] == "Concluído")
    t["anexos"] = []  # reservado para uploads futuros
    return t


@app.route("/api/tarefas", methods=["GET"])
def listar_tarefas():
    """Lista tarefas, opcionalmente filtradas por bairro.
    /api/tarefas?bairro=copacabana
    """
    db = get_db()
    bairro = request.args.get("bairro")
    if bairro:
        rows = db.execute(
            "SELECT id FROM tarefas WHERE bairro = ? OR bairro IS NULL ORDER BY criado_em ASC", (bairro,)
        ).fetchall()
    else:
        rows = db.execute("SELECT id FROM tarefas ORDER BY criado_em ASC").fetchall()
    return jsonify([_carregar_tarefa_completa(db, r["id"]) for r in rows])


@app.route("/api/tarefas", methods=["POST"])
def criar_tarefa():
    data = request.get_json(force=True)
    db = get_db()
    tarefa_id = data.get("id") or new_id()
    db.execute(
        """INSERT INTO tarefas (id, texto, status, prioridade, prazo, data_str, usuario, bairro, paciente_id, origem_financeiro_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tarefa_id, data["text"], data.get("status", "Pendente"), data.get("prioridade", "Média"),
         data.get("prazo"), data.get("date", now_str()), data.get("user"), data.get("bairro"),
         data.get("pacienteId"), data.get("origemFinanceiro")),
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
    db = get_db()
    rows = db.execute("SELECT * FROM financeiro ORDER BY criado_em ASC").fetchall()
    result = []
    for r in rows:
        r = dict(r)
        r["data"] = r.pop("data_str")
        r["desc"] = r.pop("descricao")
        r["user"] = r.pop("usuario")
        r["dataPrevista"] = r.pop("data_prevista")
        result.append(r)
    return jsonify(result)


@app.route("/api/financeiro", methods=["POST"])
def criar_registro_financeiro():
    """Cria um registro financeiro. Se tipo == 'futuro', também cria
    automaticamente uma tarefa correspondente no To Do."""
    data = request.get_json(force=True)
    db = get_db()
    reg_id = data.get("id") or new_id()
    db.execute(
        """INSERT INTO financeiro (id, data_str, tipo, descricao, valor, usuario, bairro, data_prevista)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (reg_id, data.get("data", now_str()), data["tipo"], data["desc"], data["valor"],
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
# LOGS / AUDITORIA
# ==================================================================
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
# HEALTHCHECK
# ==================================================================
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
