-- ============================================================
-- Schema do Sistema Cadastro Ágil Ruas
-- ============================================================

PRAGMA foreign_keys = ON;

-- Schemas de formulários dinâmicos (por perfil: adulto, crianca, etc.)
CREATE TABLE IF NOT EXISTS form_schemas (
    perfil_chave TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    fields_json TEXT NOT NULL  -- array de campos serializado em JSON
);

-- Pacientes / Assistidos
CREATE TABLE IF NOT EXISTS pacientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    perfil TEXT NOT NULL,
    perfil_chave TEXT NOT NULL,
    bairro TEXT,
    criado_por TEXT,
    notas_gerais TEXT DEFAULT '',
    historico_vida TEXT DEFAULT '',
    criado_em TEXT DEFAULT (datetime('now')),
    atualizado_em TEXT DEFAULT (datetime('now'))
);

-- Atendimentos / Evoluções de cada paciente
CREATE TABLE IF NOT EXISTS atendimentos (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    data_str TEXT NOT NULL,
    respostas_json TEXT NOT NULL,  -- {"Pergunta": "Resposta", ...}
    urgencia TEXT NOT NULL,
    usuario TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente ON atendimentos(paciente_id);

-- Eventos da timeline do paciente (atendimento, tarefa, alteracao, evolucao)
CREATE TABLE IF NOT EXISTS eventos_timeline (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    data_str TEXT NOT NULL,
    usuario TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_paciente ON eventos_timeline(paciente_id);

-- Tarefas (To Do)
CREATE TABLE IF NOT EXISTS tarefas (
    id TEXT PRIMARY KEY,
    texto TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    prioridade TEXT NOT NULL DEFAULT 'Média',
    prazo TEXT,
    data_str TEXT NOT NULL,
    done_date TEXT,
    usuario TEXT,
    bairro TEXT,
    paciente_id TEXT REFERENCES pacientes(id) ON DELETE SET NULL,
    origem_financeiro_id TEXT,
    criado_em TEXT DEFAULT (datetime('now')),
    atualizado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tarefas_bairro ON tarefas(bairro);
CREATE INDEX IF NOT EXISTS idx_tarefas_paciente ON tarefas(paciente_id);

-- Comentários internos em tarefas
CREATE TABLE IF NOT EXISTS comentarios_tarefa (
    id TEXT PRIMARY KEY,
    tarefa_id TEXT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    usuario TEXT,
    data_str TEXT NOT NULL,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comentarios_tarefa ON comentarios_tarefa(tarefa_id);

-- Registros financeiros
CREATE TABLE IF NOT EXISTS financeiro (
    id TEXT PRIMARY KEY,
    data_str TEXT NOT NULL,
    tipo TEXT NOT NULL,  -- renda | gasto | futuro | material
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    usuario TEXT,
    bairro TEXT,
    data_prevista TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro(tipo);

-- Logs de Auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id TEXT PRIMARY KEY,
    data_iso TEXT NOT NULL,
    data_str TEXT NOT NULL,
    usuario TEXT,
    bairro TEXT,
    modulo TEXT NOT NULL,
    acao TEXT NOT NULL,
    alvo TEXT,
    campo TEXT,
    valor_anterior TEXT,
    valor_novo TEXT,
    criado_em TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario);
CREATE INDEX IF NOT EXISTS idx_logs_modulo ON logs_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_auditoria(data_iso);
