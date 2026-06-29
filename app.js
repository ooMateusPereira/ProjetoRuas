// Constantes e Chaves de Banco
const PACIENTES_KEY = 'ruas_pacientes_db';
const SCHEMA_KEY = 'form_schema_db';
const FINANCEIRO_KEY = 'ruas_finance_db';
const TAREFAS_KEY = 'ruas_tarefas_db'; 
const LOCK_KEY = 'ruas_lockout_db'; 
const SESSION_PERSIST_KEY = 'ruas_saved_session'; 
const LOG_KEY = 'ruas_log_db';
const DARKMODE_KEY = 'ruas_darkmode';
const MATERIAIS_KEY = 'ruas_materiais_db';
const BAIRROS_KEY = 'ruas_bairros_db';

// Bairros / Equipes operacionais (segmentação de dados conforme requisitos)
// BAIRROS e BAIRROS_LABELS são carregados dinamicamente da API (/api/bairros)
// e populados pelo Backend.init() — não são mais constantes hardcoded.
let BAIRROS = [];
let BAIRROS_LABELS = {};

// Perfis de acesso: diretoria vê tudo; operacionais veem apenas o próprio bairro
const PERFIS_USUARIO = {
  diretoria: { tipo: 'diretoria', label: 'Diretoria (Acesso Total)' },
  largodomacho: { tipo: 'operacional', bairro: 'largodomacho', label: BAIRROS_LABELS.largodomacho },
  copacabana: { tipo: 'operacional', bairro: 'copacabana', label: BAIRROS_LABELS.copacabana },
  tijuca: { tipo: 'operacional', bairro: 'tijuca', label: BAIRROS_LABELS.tijuca },
  gloria: { tipo: 'operacional', bairro: 'gloria', label: BAIRROS_LABELS.gloria },
  botafogo: { tipo: 'operacional', bairro: 'botafogo', label: BAIRROS_LABELS.botafogo }
};

// SVGs Dinâmicos de Contorno
const eyeOpenSVG = '<svg class="w-5 h-5 eye-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const eyeClosedSVG = '<svg class="w-5 h-5 eye-icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

const defaultSchemas = {
  'adulto': { title: 'Perfil Adulto', fields: [{ id: 'a_nome', label: 'Nome Social / Completo *', type: 'text' }, { id: 'a_idade', label: 'Idade', type: 'number' }, { id: 'a_tempo', label: 'Tempo de Situação de Rua', type: 'select', options: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 5 anos', 'Mais de 5 anos'] }, { id: 'a_saude', label: 'Condições de Saúde / Uso de Substâncias', type: 'textarea' }, { id: 'a_demandas', label: 'Demandas do Atendimento Hoje', type: 'textarea' }] },
  'crianca': { title: 'Perfil Criança', fields: [{ id: 'c_nome', label: 'Nome da Criança *', type: 'text' }, { id: 'c_idade', label: 'Idade', type: 'number' }, { id: 'c_resp', label: 'Nome do Responsável Presente', type: 'text' }, { id: 'c_saude', label: 'Condição de Saúde, Sinais Físicos', type: 'textarea' }] },
  'adolescente': { title: 'Perfil Adolescente', fields: [{ id: 'ad_nome', label: 'Nome do Adolescente *', type: 'text' }, { id: 'ad_idade', label: 'Idade', type: 'number' }, { id: 'ad_resp', label: 'Nome do Responsável Presente', type: 'text' }, { id: 'ad_saude', label: 'Condição de Saúde, Sinais Físicos', type: 'textarea' }, { id: 'ad_demandas', label: 'Demandas do Atendimento Hoje', type: 'textarea' }] }
};

// Tipos de campo suportados pelo motor de formulários (requisito 1)
const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Lista suspensa (1 opção)' },
  { value: 'checkbox', label: 'Múltipla escolha (caixas)' },
  { value: 'date', label: 'Data' }
];

const Utils = {
  generateId: () => 'id_' + Math.random().toString(36).substr(2, 9),
  escapeHTML: (str) => { if (!str) return ''; return str.toString().replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); },
  calcUrgencia: (texto) => {
    const t = texto.toLowerCase();
    if (t.includes('dor no peito') || t.includes('sangramento') || t.includes('abuso') || t.includes('fome grave')) return 'ALTA';
    if (t.includes('febre') || t.includes('tosse') || t.includes('ferida')) return 'MÉDIA';
    return 'BAIXA';
  },
  obterCorUrgencia: (urgencia) => {
    if(urgencia === 'ALTA') return 'text-red-700 bg-red-100 px-2 py-1 rounded font-bold';
    if(urgencia === 'MÉDIA') return 'text-yellow-700 bg-yellow-100 px-2 py-1 rounded font-bold';
    return 'text-green-700 bg-green-100 px-2 py-1 rounded font-bold';
  },
  notify: (mensagem, tipo = 'sucesso') => {
    const container = document.getElementById('notification-container');
    const n = document.createElement('div');
    n.className = `p-4 rounded-lg shadow-xl text-white font-bold text-sm flex items-center gap-2 transform transition-all duration-300 translate-x-full pointer-events-auto ${tipo === 'sucesso' ? 'bg-emerald-600' : 'bg-red-600'}`;
    n.innerHTML = `<span class="text-xl">${tipo === 'sucesso' ? '✅' : '❌'}</span> ${mensagem}`;
    container.appendChild(n);
    setTimeout(() => { n.classList.remove('translate-x-full'); }, 10);
    setTimeout(() => { n.classList.add('translate-x-full'); setTimeout(() => n.remove(), 300); }, 5000);
  }
};

// ==========================================
// MÓDULO BACKEND
// ==========================================
const API_BASE = '/api';

const Backend = {
  cache: { [PACIENTES_KEY]: [], [SCHEMA_KEY]: null, [FINANCEIRO_KEY]: [], [TAREFAS_KEY]: [], [LOG_KEY]: [], [MATERIAIS_KEY]: [], [BAIRROS_KEY]: [] },

  init: async () => {
    try {
      const [rSch, rPac, rTar, rFin, rLog, rMat, rBairros] = await Promise.all([
        fetch(`${API_BASE}/schemas`),
        fetch(`${API_BASE}/pacientes`),
        fetch(`${API_BASE}/tarefas`),
        fetch(`${API_BASE}/financeiro`),
        fetch(`${API_BASE}/logs`),
        fetch(`${API_BASE}/materiais`),
        fetch(`${API_BASE}/bairros`)
      ]);
      Backend.cache[SCHEMA_KEY] = await rSch.json();
      Backend.cache[PACIENTES_KEY] = await rPac.json();
      Backend.cache[TAREFAS_KEY] = await rTar.json();
      Backend.cache[FINANCEIRO_KEY] = await rFin.json();
      Backend.cache[LOG_KEY] = await rLog.json();
      Backend.cache[MATERIAIS_KEY] = await rMat.json();
      Backend.cache[BAIRROS_KEY] = await rBairros.json();
      Backend._sincronizarBairros();
    } catch (e) {
      console.error("Falha ao conectar no backend Flask/SQLite.", e);
      Utils.notify('Não foi possível conectar ao servidor. Verifique se o backend está rodando.', 'erro');
    }
  },

  // Sincroniza as variáveis globais BAIRROS e BAIRROS_LABELS com o cache da API
  _sincronizarBairros: () => {
    const lista = Backend.cache[BAIRROS_KEY] || [];
    BAIRROS = lista.map(b => b.chave);
    BAIRROS_LABELS = {};
    lista.forEach(b => { BAIRROS_LABELS[b.chave] = b.label; });
  },

  get: (key) => Backend.cache[key],

  // Recarrega uma entidade do servidor e atualiza o cache local
  refresh: async (key) => {
    const endpoints = {
      [PACIENTES_KEY]: '/pacientes',
      [TAREFAS_KEY]: '/tarefas',
      [FINANCEIRO_KEY]: '/financeiro',
      [LOG_KEY]: '/logs',
      [SCHEMA_KEY]: '/schemas',
      [MATERIAIS_KEY]: '/materiais',
      [BAIRROS_KEY]: '/bairros'
    };
    const res = await fetch(`${API_BASE}${endpoints[key]}`);
    Backend.cache[key] = await res.json();
    return Backend.cache[key];
  },

  // ===== Schemas =====
  saveSchemas: async (schemas) => {
    Backend.cache[SCHEMA_KEY] = schemas;
    const res = await fetch(`${API_BASE}/schemas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schemas) });
    if (!res.ok) { const err = await res.json(); Utils.notify(err.error || 'Erro ao salvar formulário', 'erro'); throw new Error(err.error); }
    return res.json();
  },

  // ===== Pacientes =====
  criarPaciente: async (paciente) => {
    const res = await fetch(`${API_BASE}/pacientes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paciente) });
    const novo = await res.json();
    Backend.cache[PACIENTES_KEY].push(novo);
    return novo;
  },
  atualizarPaciente: async (id, dados) => {
    const res = await fetch(`${API_BASE}/pacientes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const atualizado = await res.json();
    const idx = Backend.cache[PACIENTES_KEY].findIndex(p => p.id === id);
    if (idx >= 0) Backend.cache[PACIENTES_KEY][idx] = atualizado;
    return atualizado;
  },
  deletarPaciente: async (id) => {
    await fetch(`${API_BASE}/pacientes/${id}`, { method: 'DELETE' });
    Backend.cache[PACIENTES_KEY] = Backend.cache[PACIENTES_KEY].filter(p => p.id !== id);
  },
  adicionarAtendimento: async (pacId, atend) => {
    const res = await fetch(`${API_BASE}/pacientes/${pacId}/atendimentos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(atend) });
    const data = await res.json();
    const idx = Backend.cache[PACIENTES_KEY].findIndex(p => p.id === pacId);
    if (idx >= 0) Backend.cache[PACIENTES_KEY][idx] = data.paciente;
    return data.paciente;
  },
  editarAtendimento: async (pacId, atendId, dados) => {
    const res = await fetch(`${API_BASE}/pacientes/${pacId}/atendimentos/${atendId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const atualizado = await res.json();
    const idx = Backend.cache[PACIENTES_KEY].findIndex(p => p.id === pacId);
    if (idx >= 0) Backend.cache[PACIENTES_KEY][idx] = atualizado;
    return atualizado;
  },
  alterarUrgencia: async (pacId, atendId, dados) => {
    const res = await fetch(`${API_BASE}/pacientes/${pacId}/atendimentos/${atendId}/urgencia`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const atualizado = await res.json();
    const idx = Backend.cache[PACIENTES_KEY].findIndex(p => p.id === pacId);
    if (idx >= 0) Backend.cache[PACIENTES_KEY][idx] = atualizado;
    return atualizado;
  },
  adicionarEventoTimeline: async (pacId, evento) => {
    await fetch(`${API_BASE}/pacientes/${pacId}/timeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento) });
    const pac = Backend.cache[PACIENTES_KEY].find(p => p.id === pacId);
    if (pac) { pac.eventosTimeline = pac.eventosTimeline || []; pac.eventosTimeline.push(evento); }
  },

  // ===== Tarefas =====
  criarTarefa: async (tarefa) => {
    const res = await fetch(`${API_BASE}/tarefas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarefa) });
    const nova = await res.json();
    Backend.cache[TAREFAS_KEY].push(nova);
    return nova;
  },
  atualizarTarefa: async (id, dados) => {
    const res = await fetch(`${API_BASE}/tarefas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const atualizada = await res.json();
    const idx = Backend.cache[TAREFAS_KEY].findIndex(t => t.id === id);
    if (idx >= 0) Backend.cache[TAREFAS_KEY][idx] = atualizada;
    return atualizada;
  },
  deletarTarefa: async (id) => {
    await fetch(`${API_BASE}/tarefas/${id}`, { method: 'DELETE' });
    Backend.cache[TAREFAS_KEY] = Backend.cache[TAREFAS_KEY].filter(t => t.id !== id);
  },
  comentarTarefa: async (id, comentario) => {
    const res = await fetch(`${API_BASE}/tarefas/${id}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(comentario) });
    const atualizada = await res.json();
    const idx = Backend.cache[TAREFAS_KEY].findIndex(t => t.id === id);
    if (idx >= 0) Backend.cache[TAREFAS_KEY][idx] = atualizada;
    return atualizada;
  },

  // ===== Financeiro =====
  criarRegistroFinanceiro: async (registro) => {
    const res = await fetch(`${API_BASE}/financeiro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registro) });
    const data = await res.json();
    await Backend.refresh(FINANCEIRO_KEY);
    if (data.tarefa_criada) Backend.cache[TAREFAS_KEY].push(data.tarefa_criada);
    return data;
  },

  // ===== Logs =====
  registrarLog: async (log) => {
    Backend.cache[LOG_KEY].unshift(log); // exibição imediata
    fetch(`${API_BASE}/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log) }).catch(e => console.error('Erro ao salvar log:', e));
  },

  // ===== Bairros =====
  getBairros: () => Backend.cache[BAIRROS_KEY] || [],
  criarBairro: async (label) => {
    const res = await fetch(`${API_BASE}/bairros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, requester: App.currentUser.username }) });
    const data = await res.json();
    if (!res.ok) { Utils.notify(data.error || 'Erro ao criar bairro', 'erro'); throw new Error(data.error); }
    await Backend.refresh(BAIRROS_KEY);
    Backend._sincronizarBairros();
    return data;
  },
  editarBairro: async (chave, novoLabel) => {
    const res = await fetch(`${API_BASE}/bairros/${chave}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: novoLabel, requester: App.currentUser.username }) });
    const data = await res.json();
    if (!res.ok) { Utils.notify(data.error || 'Erro ao renomear bairro', 'erro'); throw new Error(data.error); }
    await Backend.refresh(BAIRROS_KEY);
    Backend._sincronizarBairros();
  },
  deletarBairro: async (chave) => {
    const res = await fetch(`${API_BASE}/bairros/${chave}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requester: App.currentUser.username }) });
    const data = await res.json();
    if (!res.ok) { Utils.notify(data.error || 'Erro ao remover bairro', 'erro'); throw new Error(data.error); }
    await Backend.refresh(BAIRROS_KEY);
    Backend._sincronizarBairros();
  },

  // ===== Materiais =====
  criarMaterial: async (material) => {
    const res = await fetch(`${API_BASE}/materiais`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(material) });
    if (!res.ok) { const err = await res.json(); Utils.notify(err.error || 'Erro ao salvar material', 'erro'); throw new Error(err.error); }
    const data = await res.json();
    await Backend.refresh(MATERIAIS_KEY);
    return data;
  },
  deletarMaterial: async (id) => {
    await fetch(`${API_BASE}/materiais/${id}`, { method: 'DELETE' });
    Backend.cache[MATERIAIS_KEY] = Backend.cache[MATERIAIS_KEY].filter(m => m.id !== id);
  },
  analiseMateriais: async () => {
    const res = await fetch(`${API_BASE}/materiais/analise`);
    return res.json();
  }
};

// ==========================================
// MÓDULO DE AUDITORIA / LOGS
// ==========================================
const Auditoria = {
  getDB: () => Backend.get(LOG_KEY) || [],
  registrar: (modulo, acao, alvo, campo, valorAnterior, valorNovo) => {
    const log = {
      id: Utils.generateId(),
      data: new Date().toISOString(),
      dataStr: new Date().toLocaleString('pt-BR'),
      usuario: App.currentUser ? App.currentUser.username : 'sistema',
      bairro: App.currentUser ? App.currentUser.bairro : null,
      modulo, acao, alvo,
      campo: campo || null,
      valorAnterior: (valorAnterior === undefined ? null : valorAnterior),
      valorNovo: (valorNovo === undefined ? null : valorNovo)
    };
    Backend.registrarLog(log);
  },
  render: () => {
    const cont = document.getElementById('listaLogs');
    if (!cont) return;
    const filtroUser = (document.getElementById('logFiltroUsuario') || {}).value || '';
    const filtroModulo = (document.getElementById('logFiltroModulo') || {}).value || '';
    let db = Auditoria.getDB().slice().reverse();
    if (filtroUser) db = db.filter(l => l.usuario === filtroUser);
    if (filtroModulo) db = db.filter(l => l.modulo === filtroModulo);
    const html = db.slice(0, 300).map(l => {
      const alteracao = (l.campo) ? `<div class="text-xs mt-1"><span class="font-bold">${Utils.escapeHTML(l.campo)}:</span> <span class="text-red-500 line-through">${Utils.escapeHTML(l.valorAnterior ?? '-')}</span> → <span class="text-green-600 font-bold">${Utils.escapeHTML(l.valorNovo ?? '-')}</span></div>` : '';
      return `<li class="p-3 border-b text-sm">
        <div class="flex justify-between items-center">
          <span class="font-bold text-emerald-900">${Utils.escapeHTML(l.usuario)}</span>
          <span class="text-[10px] text-gray-400">${l.dataStr}</span>
        </div>
        <div class="text-xs text-gray-600">${Utils.escapeHTML(l.modulo)} • ${Utils.escapeHTML(l.acao)} • ${Utils.escapeHTML(l.alvo || '')}</div>
        ${alteracao}
      </li>`;
    }).join('');
    cont.innerHTML = html || '<p class="text-center text-gray-400 p-4">Nenhum registro de auditoria.</p>';
  },
  initFiltros: () => {
    const selUser = document.getElementById('logFiltroUsuario');
    const selMod = document.getElementById('logFiltroModulo');
    if (!selUser) return;
    selUser.innerHTML = '<option value="">Todos os usuários</option>' + Object.keys(PERFIS_USUARIO).map(u => `<option value="${u}">${Utils.escapeHTML(PERFIS_USUARIO[u].label)}</option>`).join('');
    selUser.addEventListener('change', Auditoria.render);
    selMod.addEventListener('change', Auditoria.render);
  }
};


// ==========================================
// MÓDULO DE GESTÃO DE USUÁRIOS (restrito à diretoria)
// ==========================================
const Usuarios = {
  pendingUsername: null,
  init: () => {
    const form = document.getElementById('formRedefinirSenha');
    if (form) form.addEventListener('submit', Usuarios.confirmarRedefinicao);
  },
  render: async () => {
    if (!App.currentUser || App.currentUser.tipo !== 'diretoria') return;
    const cont = document.getElementById('listaUsuarios');
    cont.innerHTML = '<li class="p-4 text-sm text-gray-400">Carregando...</li>';
    try {
      const res = await fetch(`${API_BASE}/usuarios?requester=${encodeURIComponent(App.currentUser.username)}`);
      if (!res.ok) { cont.innerHTML = '<li class="p-4 text-sm text-red-500">Não foi possível carregar os usuários.</li>'; return; }
      const usuarios = await res.json();
      cont.innerHTML = usuarios.map(u => `
        <li class="p-4 flex justify-between items-center">
          <div>
            <span class="font-bold">${Utils.escapeHTML(u.label)}</span>
            <span class="text-xs text-gray-400 block">@${Utils.escapeHTML(u.username)} • ${u.tipo === 'diretoria' ? 'Diretoria' : 'Operacional'}</span>
            <span class="text-[10px] text-green-600 font-bold">✅ Senha ativa</span>
          </div>
          <button onclick="Usuarios.abrirModal('${u.username}', '${Utils.escapeHTML(u.label)}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-xs font-bold">Redefinir Senha</button>
        </li>`).join('');
    } catch (e) {
      cont.innerHTML = '<li class="p-4 text-sm text-red-500">Erro ao conectar ao servidor.</li>';
    }
  },
  abrirModal: (username, label) => {
    Usuarios.pendingUsername = username;
    document.getElementById('redefinirSenhaUsername').innerText = label;
    document.getElementById('redefinirSenhaNova').value = '';
    document.getElementById('redefinirSenhaError').classList.add('hidden');
    document.getElementById('modalRedefinirSenha').classList.remove('hidden');
  },
  fecharModal: () => {
    document.getElementById('modalRedefinirSenha').classList.add('hidden');
    Usuarios.pendingUsername = null;
  },
  confirmarRedefinicao: async (e) => {
    e.preventDefault();
    const err = document.getElementById('redefinirSenhaError');
    const novaSenha = document.getElementById('redefinirSenhaNova').value;
    if (!Usuarios.pendingUsername) return;
    try {
      const res = await fetch(`${API_BASE}/usuarios/${Usuarios.pendingUsername}/redefinir-senha`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester: App.currentUser.username, novaSenha })
      });
      const data = await res.json();
      if (!res.ok) { err.innerText = data.error || 'Erro ao redefinir senha.'; err.classList.remove('hidden'); return; }
      Auditoria.registrar('Auth', 'redefinir-senha', Usuarios.pendingUsername);
      Utils.notify('Senha redefinida com sucesso.');
      Usuarios.fecharModal();
      Usuarios.render();
    } catch (ex) {
      err.innerText = 'Não foi possível conectar ao servidor.'; err.classList.remove('hidden');
    }
  }
};


// ==========================================
// MÓDULO DE GESTÃO DE BAIRROS (restrito à diretoria)
// ==========================================
const GestaBairros = {
  init: () => {
    const form = document.getElementById('formNovoBairro');
    if (form) form.addEventListener('submit', GestaBairros.criar);
  },
  render: () => {
    if (!App.currentUser || App.currentUser.tipo !== 'diretoria') return;
    const lista = Backend.getBairros();
    const cont = document.getElementById('listaBairros');
    if (!cont) return;
    cont.innerHTML = lista.length ? lista.map(b => `
      <li class="flex justify-between items-center p-3 border-b" id="bairro-row-${b.chave}">
        <div id="bairro-display-${b.chave}" class="flex-1 flex items-center gap-2">
          <span class="font-bold text-gray-700">${Utils.escapeHTML(b.label)}</span>
          <span class="text-xs text-gray-400">@${Utils.escapeHTML(b.chave)}</span>
        </div>
        <div id="bairro-edit-${b.chave}" class="hidden flex-1 flex gap-2 items-center">
          <input type="text" id="bairro-input-${b.chave}" value="${Utils.escapeHTML(b.label)}" class="flex-1 p-1 border rounded text-sm outline-none focus:ring-2 focus:ring-emerald-500">
          <button onclick="GestaBairros.confirmarEdicao('${b.chave}')" class="text-emerald-700 font-bold text-xs hover:underline">Salvar</button>
          <button onclick="GestaBairros.cancelarEdicao('${b.chave}')" class="text-gray-500 font-bold text-xs hover:underline">Cancelar</button>
        </div>
        <div class="flex gap-2 ml-2">
          <button onclick="GestaBairros.iniciarEdicao('${b.chave}')" class="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">Renomear</button>
          <button onclick="GestaBairros.remover('${b.chave}', '${Utils.escapeHTML(b.label)}')" class="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded border border-red-200 hover:bg-red-50">Remover</button>
        </div>
      </li>`).join('') : '<li class="p-4 text-sm text-gray-400 text-center">Nenhum bairro cadastrado.</li>';
  },
  criar: async (e) => {
    e.preventDefault();
    const input = document.getElementById('novoBairroLabel');
    const label = input.value.trim();
    if (!label) return;
    try {
      await Backend.criarBairro(label);
      input.value = '';
      GestaBairros.render();
      Auditoria.registrar('Bairros', 'criar', label);
      Utils.notify(`Bairro "${label}" adicionado`);
    } catch (err) {}
  },
  iniciarEdicao: (chave) => {
    document.getElementById(`bairro-display-${chave}`).classList.add('hidden');
    document.getElementById(`bairro-edit-${chave}`).classList.remove('hidden');
    document.getElementById(`bairro-input-${chave}`).focus();
  },
  cancelarEdicao: (chave) => {
    document.getElementById(`bairro-display-${chave}`).classList.remove('hidden');
    document.getElementById(`bairro-edit-${chave}`).classList.add('hidden');
  },
  confirmarEdicao: async (chave) => {
    const novoLabel = document.getElementById(`bairro-input-${chave}`).value.trim();
    if (!novoLabel) return;
    try {
      await Backend.editarBairro(chave, novoLabel);
      GestaBairros.render();
      Auditoria.registrar('Bairros', 'renomear', chave);
      Utils.notify('Bairro renomeado');
    } catch (err) {}
  },
  remover: async (chave, label) => {
    if (!confirm(`Remover o bairro "${label}"?\n\nIsto só é possível se não houver pacientes ou usuários vinculados a ele.`)) return;
    try {
      await Backend.deletarBairro(chave);
      GestaBairros.render();
      Auditoria.registrar('Bairros', 'excluir', label);
      Utils.notify(`Bairro "${label}" removido`);
    } catch (err) {}
  }
};

const Tarefas = {
  PRIORIDADES: ['Baixa', 'Média', 'Alta', 'Urgente'],
  STATUS: ['Pendente', 'Em andamento', 'Concluído', 'Cancelado'],
  getDB: () => Backend.get(TAREFAS_KEY) || [],
  init: () => {
    document.getElementById('formTarefa').addEventListener('submit', Tarefas.add);
    const inputTexto = document.getElementById('novaTarefa');
    inputTexto.addEventListener('input', Tarefas.handleMentionInput);
    document.getElementById('filtroStatusTarefa').addEventListener('change', Tarefas.render);
    document.getElementById('filtroPrioridadeTarefa').addEventListener('change', Tarefas.render);
    if (document.getElementById('filtroBairroTarefa')) {
      const selBairro = document.getElementById('filtroBairroTarefa');
      if (App.currentUser && App.currentUser.tipo !== 'diretoria') {
        selBairro.parentElement.classList.add('hidden');
      } else {
        selBairro.innerHTML = '<option value="">Todos os bairros</option>' + BAIRROS.map(b => `<option value="${b}">${BAIRROS_LABELS[b]}</option>`).join('');
      }
      selBairro.addEventListener('change', Tarefas.render);
    }
  },
  // Detecta @nome enquanto digita e mostra sugestões de pacientes e equipes/bairros
  handleMentionInput: (e) => {
    const val = e.target.value;
    const match = val.match(/@([^\s]*)$/);
    const sugestoesEl = document.getElementById('mentionSuggestions');
    if (!sugestoesEl) return;
    if (!match) { sugestoesEl.classList.add('hidden'); sugestoesEl.innerHTML=''; return; }
    const termo = match[1].toLowerCase();

    const pacientes = (Prontuario.getPacientes() || []).filter(p => p.nome.toLowerCase().includes(termo)).slice(0, 5);
    const equipes = BAIRROS.filter(b => BAIRROS_LABELS[b].toLowerCase().includes(termo) || b.includes(termo)).slice(0, 5);

    if (pacientes.length === 0 && equipes.length === 0) { sugestoesEl.classList.add('hidden'); sugestoesEl.innerHTML=''; return; }

    let html = '';
    if (equipes.length) {
      html += `<div class="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">Equipes / Bairros</div>`;
      html += equipes.map(b => `<button type="button" onclick="Tarefas.selecionarMencaoEquipe('${b}')" class="block w-full text-left px-3 py-1 hover:bg-blue-50 text-sm">👥 @${BAIRROS_LABELS[b]}</button>`).join('');
    }
    if (pacientes.length) {
      html += `<div class="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">Pacientes</div>`;
      html += pacientes.map(p => `<button type="button" onclick="Tarefas.selecionarMencao('${p.id}','${Utils.escapeHTML(p.nome)}')" class="block w-full text-left px-3 py-1 hover:bg-emerald-50 text-sm">🩺 @${Utils.escapeHTML(p.nome)}</button>`).join('');
    }
    sugestoesEl.innerHTML = html;
    sugestoesEl.classList.remove('hidden');
  },
  selecionarMencao: (pacienteId, nome) => {
    const input = document.getElementById('novaTarefa');
    input.value = input.value.replace(/@([^\s]*)$/, `@${nome} `);
    input.dataset.pacienteId = pacienteId;
    document.getElementById('mentionSuggestions').classList.add('hidden');
    input.focus();
  },
  // Menciona uma equipe/bairro - permite requisitar tarefas para outras equipes (requisito 8)
  selecionarMencaoEquipe: (bairro) => {
    const input = document.getElementById('novaTarefa');
    input.value = input.value.replace(/@([^\s]*)$/, `@${BAIRROS_LABELS[bairro]} `);
    const mencoes = JSON.parse(input.dataset.mencoes || '[]');
    if (!mencoes.includes(bairro)) mencoes.push(bairro);
    input.dataset.mencoes = JSON.stringify(mencoes);
    document.getElementById('mentionSuggestions').classList.add('hidden');
    input.focus();
  },
  add: async (e) => {
    e.preventDefault();
    const input = document.getElementById('novaTarefa');
    const text = Utils.escapeHTML(input.value);
    if (!text.trim()) return;
    const prioridade = document.getElementById('novaTarefaPrioridade').value;
    const prazo = document.getElementById('novaTarefaPrazo').value;
    const pacienteId = input.dataset.pacienteId || null;
    const mencoes = JSON.parse(input.dataset.mencoes || '[]');
    // Se uma equipe foi mencionada, a tarefa é destinada a ela (requisição entre equipes); senão fica com a equipe do criador
    const bairroDestino = mencoes.length ? mencoes[0] : (App.currentUser.bairro || null);
    // Garante que a equipe de origem também acompanhe a tarefa requisitada para outra equipe
    if (App.currentUser.bairro && bairroDestino !== App.currentUser.bairro && !mencoes.includes(App.currentUser.bairro)) {
      mencoes.push(App.currentUser.bairro);
    }
    const novaTarefa = {
      text, status: 'Pendente',
      prioridade, prazo: prazo || null,
      date: new Date().toLocaleString('pt-BR'), user: App.currentUser.username,
      bairro: bairroDestino,
      bairroOrigem: App.currentUser.bairro || null,
      mencoes,
      pacienteId
    };
    await Backend.criarTarefa(novaTarefa);
    Auditoria.registrar('Tarefas', 'criar', text);
    if (pacienteId) Backend.adicionarEventoTimeline(pacienteId, { tipo: 'tarefa', descricao: `Tarefa criada: ${text}`, data: novaTarefa.date, user: App.currentUser.username });
    if (mencoes.length && bairroDestino !== App.currentUser.bairro) {
      Utils.notify(`Tarefa requisitada para a equipe ${BAIRROS_LABELS[bairroDestino]}`);
    }
    delete input.dataset.pacienteId;
    delete input.dataset.mencoes;
    document.getElementById('formTarefa').reset();
    Tarefas.render();
  },
  setStatus: async (id, status) => {
    const db = Tarefas.getDB(); const t = db.find(x => x.id === id);
    if (t) {
      const anterior = t.status;
      await Backend.atualizarTarefa(id, { status });
      Auditoria.registrar('Tarefas', 'alterar-status', t.text, 'status', anterior, status);
      if (t.pacienteId) Backend.adicionarEventoTimeline(t.pacienteId, { tipo: 'tarefa', descricao: `Tarefa "${t.text}" → ${status}`, data: new Date().toLocaleString('pt-BR'), user: App.currentUser.username });
      Tarefas.render();
    }
  },
  toggle: (id) => {
    const db = Tarefas.getDB(); const t = db.find(x => x.id === id);
    if(t) Tarefas.setStatus(id, t.completed ? 'Pendente' : 'Concluído');
  },
  delete: async (id) => {
    if(confirm('Apagar esta tarefa do sistema?')) {
      const db = Tarefas.getDB(); const t = db.find(x => x.id === id);
      await Backend.deletarTarefa(id);
      if (t) Auditoria.registrar('Tarefas', 'excluir', t.text);
      Tarefas.render();
    }
  },
  comentar: async (id) => {
    const texto = prompt('Comentário interno:');
    if (!texto) return;
    const db = Tarefas.getDB(); const t = db.find(x => x.id === id);
    if (t) {
      const comentario = { texto: Utils.escapeHTML(texto), user: App.currentUser.username, data: new Date().toLocaleString('pt-BR') };
      await Backend.comentarTarefa(id, comentario);
      Auditoria.registrar('Tarefas', 'comentario', t.text, 'comentario', null, texto);
      Tarefas.render();
    }
  },
  estaAtrasada: (t) => {
    if (!t.prazo || t.completed) return false;
    return new Date(t.prazo) < new Date(new Date().toDateString());
  },
  corPrioridade: (p) => ({ 'Urgente': 'bg-red-600 text-white', 'Alta': 'bg-red-100 text-red-700', 'Média': 'bg-yellow-100 text-yellow-700', 'Baixa': 'bg-gray-100 text-gray-600' }[p] || 'bg-gray-100 text-gray-600'),
  render: () => {
    let db = Tarefas.getDB();
    // Segmentação por bairro: operacional vê tarefas do próprio bairro, sem bairro definido,
    // ou onde sua equipe foi mencionada/requisitada (requisito 8)
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') {
      db = db.filter(t => !t.bairro || t.bairro === App.currentUser.bairro || (t.mencoes || []).includes(App.currentUser.bairro));
    }
    const fStatus = (document.getElementById('filtroStatusTarefa') || {}).value;
    const fPrior = (document.getElementById('filtroPrioridadeTarefa') || {}).value;
    const fBairro = (document.getElementById('filtroBairroTarefa') || {}).value;
    if (fStatus) db = db.filter(t => t.status === fStatus);
    if (fPrior) db = db.filter(t => t.prioridade === fPrior);
    if (fBairro) db = db.filter(t => t.bairro === fBairro);

    let pendentes = ''; let concluidas = '';
    [...db].reverse().forEach(t => {
      const atrasada = Tarefas.estaAtrasada(t);
      const prazoHtml = t.prazo ? `<span class="text-[10px] font-bold ${atrasada ? 'text-red-600' : 'text-gray-500'}">${atrasada ? '⚠️ ATRASADA - ' : '📅 '}Prazo: ${new Date(t.prazo).toLocaleDateString('pt-BR')}</span>` : '';
      const mencaoHtml = t.pacienteId ? `<span class="text-[10px] text-blue-600 font-bold">🔗 Vinculada a paciente</span>` : '';
      // Destaque visual de requisição entre equipes (requisito 8)
      const ehRequisicaoRecebida = App.currentUser.tipo !== 'diretoria' && t.bairroOrigem && t.bairroOrigem !== App.currentUser.bairro && t.bairro === App.currentUser.bairro;
      const ehRequisicaoEnviada = App.currentUser.tipo !== 'diretoria' && t.bairroOrigem === App.currentUser.bairro && t.bairro !== App.currentUser.bairro;
      let mencaoEquipeHtml = '';
      if (ehRequisicaoRecebida) mencaoEquipeHtml = `<span class="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded">📨 Requisitada por ${BAIRROS_LABELS[t.bairroOrigem] || t.bairroOrigem}</span>`;
      else if (ehRequisicaoEnviada) mencaoEquipeHtml = `<span class="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded">📤 Requisitada para ${BAIRROS_LABELS[t.bairro] || t.bairro}</span>`;
      const comentariosHtml = (t.comentarios && t.comentarios.length) ? `<div class="mt-1 space-y-1">${t.comentarios.map(c => `<div class="text-[10px] bg-gray-50 p-1 rounded">💬 <span class="font-bold">${Utils.escapeHTML(c.user)}:</span> ${Utils.escapeHTML(c.texto)} <span class="text-gray-400">(${c.data})</span></div>`).join('')}</div>` : '';
      const statusOptions = Tarefas.STATUS.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('');

      if(t.status !== 'Concluído' && t.status !== 'Cancelado') {
        pendentes += `<li class="bg-white p-3 border ${atrasada ? 'border-red-300' : (ehRequisicaoRecebida ? 'border-purple-300' : 'border-emerald-200')} rounded-lg shadow-sm">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1">
              <span class="font-bold text-gray-700">${t.text}</span>
              <div class="flex flex-wrap gap-2 mt-1 items-center">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${Tarefas.corPrioridade(t.prioridade)}">${t.prioridade}</span>
                ${prazoHtml} ${mencaoHtml} ${mencaoEquipeHtml}
                ${t.bairro ? `<span class="text-[10px] text-emerald-700 font-bold">📍 ${BAIRROS_LABELS[t.bairro] || t.bairro}</span>` : ''}
              </div>
              ${comentariosHtml}
            </div>
            <div class="flex flex-col gap-1 items-end">
              <select onchange="Tarefas.setStatus('${t.id}', this.value)" class="text-xs border rounded p-1">${statusOptions}</select>
              <div class="flex gap-1">
                <button onclick="Tarefas.comentar('${t.id}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-xs font-bold" title="Comentar">💬</button>
                <button onclick="Tarefas.delete('${t.id}')" class="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold">✕</button>
              </div>
            </div>
          </div>
        </li>`;
      } else {
        concluidas += `<li class="bg-gray-100 p-3 border border-gray-200 rounded-lg">
          <div class="flex justify-between items-center">
            <div><span class="line-through text-gray-500 font-bold">${t.text}</span><span class="text-[10px] block text-gray-400 mt-1">${t.status} em: ${t.doneDate || '-'} por ${t.user}</span></div>
            <div class="flex gap-2">
              <button onclick="Tarefas.setStatus('${t.id}','Pendente')" class="text-blue-500 hover:underline text-xs font-bold">Reabrir</button>
              <button onclick="Tarefas.delete('${t.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
            </div>
          </div>
        </li>`;
      }
    });
    document.getElementById('listaTarefasPendentes').innerHTML = pendentes || '<p class="text-sm text-gray-400 italic">Nenhuma tarefa pendente na fila.</p>';
    document.getElementById('listaTarefasConcluidas').innerHTML = concluidas || '<p class="text-sm text-gray-400 italic">O log de atividades está vazio.</p>';
  },
  exportarRelatorio: () => {
    let db = Tarefas.getDB();
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') db = db.filter(t => !t.bairro || t.bairro === App.currentUser.bairro);
    let csv = "\uFEFF" + "Descrição;Status;Prioridade;Prazo;Bairro;Criado Por;Data Criação\n";
    db.forEach(t => {
      csv += `${t.text};${t.status};${t.prioridade};${t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : ''};${t.bairro ? BAIRROS_LABELS[t.bairro] : ''};${t.user};${t.date}\n`;
    });
    Dashboard.dispararDownload(csv, 'relatorio_tarefas_ruas.csv');
  }
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================
const Auth = {
  maxAttempts: 3, lockTimeMs: 15 * 60000, timeoutTimer: null,
  init: () => {
    document.getElementById('formLogin').addEventListener('submit', Auth.handleLogin);
    document.getElementById('formTrocarSenha').addEventListener('submit', Auth.handleTrocarSenha);
    document.getElementById('btnTogglePassword').innerHTML = eyeOpenSVG;
    const session = sessionStorage.getItem('ruas_session') || localStorage.getItem(SESSION_PERSIST_KEY);
    if (session) {
      App.currentUser = JSON.parse(session);
      if (App.currentUser.deveTrocarSenha) {
        App.navigate('trocarSenha');
      } else {
        App.startSession(); Auth.resetInactivityTimeout();
      }
    } else {
      App.navigate('login');
    }
    window.addEventListener('mousemove', Auth.resetInactivityTimeout);
    window.addEventListener('keypress', Auth.resetInactivityTimeout);
  },
  togglePassword: () => {
    const p = document.getElementById('loginPass');
    const btn = document.getElementById('btnTogglePassword');
    if(p.type === 'password') {
      p.type = 'text';
      btn.innerHTML = eyeClosedSVG; 
    } else {
      p.type = 'password';
      btn.innerHTML = eyeOpenSVG; 
    }
  },
  resetInactivityTimeout: () => {
    clearTimeout(Auth.timeoutTimer);
    if (App.currentUser && !App.currentUser.deveTrocarSenha) Auth.timeoutTimer = setTimeout(() => { Utils.notify("Sessão expirada por inatividade", "erro"); Auth.logout(); }, 30 * 60000);
  },
  persistirSessao: (user, lembrar) => {
    sessionStorage.setItem('ruas_session', JSON.stringify(user));
    if (lembrar) {
      localStorage.setItem(SESSION_PERSIST_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_PERSIST_KEY);
    }
  },
  handleLogin: async (e) => {
    e.preventDefault();
    const u = Utils.escapeHTML(document.getElementById('loginUser').value.toLowerCase().trim());
    const p = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    let lockDb = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    let lock = lockDb[u] || { attempts: 0, lockedUntil: null };

    if (lock.lockedUntil && Date.now() < lock.lockedUntil) { 
      err.innerText = `🛡️ Bloqueado. Aguarde.`; err.classList.remove('hidden'); return; 
    }
    if (lock.lockedUntil && Date.now() > lock.lockedUntil) { lock.attempts = 0; lock.lockedUntil = null; }

    let resposta;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      resposta = await res.json();
      if (!res.ok) {
        lock.attempts += 1;
        if (lock.attempts >= Auth.maxAttempts) lock.lockedUntil = Date.now() + Auth.lockTimeMs;
        err.innerText = `Credenciais inválidas! Tentativas restantes: ${Auth.maxAttempts - lock.attempts}`;
        lockDb[u] = lock; localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb)); err.classList.remove('hidden');
        return;
      }
    } catch (ex) {
      err.innerText = 'Não foi possível conectar ao servidor.'; err.classList.remove('hidden'); return;
    }

    err.classList.add('hidden'); lock.attempts = 0; lockDb[u] = lock; localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb));
    App.currentUser = resposta; // {username, tipo, bairro, label, deveTrocarSenha}
    Auth.persistirSessao(App.currentUser, document.getElementById('loginRemember').checked);

    document.getElementById('formLogin').reset(); 
    document.getElementById('loginPass').type = 'password';
    document.getElementById('btnTogglePassword').innerHTML = eyeOpenSVG;
    Auditoria.registrar('Auth', 'login', u);

    if (App.currentUser.deveTrocarSenha) {
      App.navigate('trocarSenha');
    } else {
      App.startSession(); Auth.resetInactivityTimeout();
    }
  },
  handleTrocarSenha: async (e) => {
    e.preventDefault();
    const err = document.getElementById('trocarSenhaError');
    const senhaAtual = document.getElementById('trocarSenhaAtual').value;
    const senhaNova = document.getElementById('trocarSenhaNova').value;
    const senhaConfirma = document.getElementById('trocarSenhaConfirma').value;

    if (senhaNova !== senhaConfirma) { err.innerText = 'As senhas não coincidem.'; err.classList.remove('hidden'); return; }
    if (senhaNova.length < 6) { err.innerText = 'A nova senha deve ter pelo menos 6 caracteres.'; err.classList.remove('hidden'); return; }
    if (senhaNova === senhaAtual) { err.innerText = 'A nova senha deve ser diferente da senha atual.'; err.classList.remove('hidden'); return; }

    try {
      const res = await fetch(`${API_BASE}/auth/trocar-senha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: App.currentUser.username, senhaAtual, senhaNova }) });
      const data = await res.json();
      if (!res.ok) { err.innerText = data.error || 'Erro ao trocar senha.'; err.classList.remove('hidden'); return; }
      err.classList.add('hidden');
      App.currentUser = data; // deveTrocarSenha agora false
      // Reaplica persistência mantendo a preferência "lembrar" anterior (se a sessão já estava em localStorage)
      const lembrar = !!localStorage.getItem(SESSION_PERSIST_KEY);
      Auth.persistirSessao(App.currentUser, lembrar);
      document.getElementById('formTrocarSenha').reset();
      Utils.notify('Senha definida com sucesso!');
      App.startSession(); Auth.resetInactivityTimeout();
    } catch (ex) {
      err.innerText = 'Não foi possível conectar ao servidor.'; err.classList.remove('hidden');
    }
  },
  logout: () => { if(App.currentUser) Auditoria.registrar('Auth', 'logout', App.currentUser.username); sessionStorage.removeItem('ruas_session'); localStorage.removeItem(SESSION_PERSIST_KEY); App.currentUser = null; App.navigate('login'); }
};

// ==========================================
// PRONTUÁRIOS
// ==========================================
const Prontuario = {
  pacienteAtual: null,
  pendingSave: null, // dados aguardando classificação de urgência (requisito 3)
  getPacientes: () => Backend.get(PACIENTES_KEY),
  init: () => {
    document.getElementById('formTriagemDinamico').addEventListener('submit', Prontuario.salvarAtendimento);
    document.getElementById('selectPerfilTriagem').addEventListener('change', FormEngine.renderTriagemForm);
    document.getElementById('dashFilterText').addEventListener('keyup', Prontuario.renderListaCadastrados);
    if (document.getElementById('formNotasProntuario')) document.getElementById('formNotasProntuario').addEventListener('submit', Prontuario.salvarNotas);
    // Bairro de Registro (requisito 9) - select de triagem
    const selBairroReg = document.getElementById('triagemBairroRegistro');
    if (selBairroReg) {
      selBairroReg.innerHTML = BAIRROS.map(b => `<option value="${b}">${BAIRROS_LABELS[b]}</option>`).join('');
      if (App.currentUser && App.currentUser.bairro) selBairroReg.value = App.currentUser.bairro;
    }
    if (document.getElementById('filtroBairroCadastrados')) {
      const sel = document.getElementById('filtroBairroCadastrados');
      if (App.currentUser && App.currentUser.tipo !== 'diretoria') {
        sel.parentElement.classList.add('hidden');
      } else {
        sel.innerHTML = '<option value="">Todos os bairros</option>' + BAIRROS.map(b => `<option value="${b}">${BAIRROS_LABELS[b]}</option>`).join('');
        sel.addEventListener('change', Prontuario.renderListaCadastrados);
      }
    }
  },
  // Verifica se o usuário atual pode editar este paciente (operacional só edita o que criou/seu bairro)
  podeEditar: (pac) => {
    if (!App.currentUser) return false;
    if (App.currentUser.tipo === 'diretoria') return true;
    return pac.bairro === App.currentUser.bairro;
  },
  adicionarEventoTimeline: async (pacienteId, tipo, descricao) => {
    const pac = (Prontuario.getPacientes() || []).find(p => p.id === pacienteId);
    if (!pac) return;
    const evento = { tipo, descricao, data: new Date().toLocaleString('pt-BR'), user: App.currentUser ? App.currentUser.username : 'sistema' };
    await Backend.adicionarEventoTimeline(pacienteId, evento);
  },
  salvarAtendimento: async (e) => {
    e.preventDefault();
    const pChave = document.getElementById('selectPerfilTriagem').value; const schemas = FormEngine.getSchemas(); const fields = schemas[pChave].fields;
    let respostas = {}; let rawText = ''; let nomePrincipal = 'Não Identificado';
    fields.forEach(f => {
      const val = Utils.escapeHTML(FormEngine.lerValorCampo(f)); respostas[f.label] = val; rawText += val + ' ';
      if(f.label.toLowerCase().includes('nome')) nomePrincipal = val;
    });
    const bairroRegistro = document.getElementById('triagemBairroRegistro').value;
    const dataAtendimentoInput = document.getElementById('triagemDataAtendimento').value;
    const editPacId = document.getElementById('editPacienteId').value; const editAtendId = document.getElementById('editAtendimentoId').value;

    // Sugestão automática baseada no texto, mas a confirmação final é feita no modal (requisitos 3 e 4)
    const urgenciaSugerida = Utils.calcUrgencia(rawText);

    Prontuario.pendingSave = {
      pChave, schemas, respostas, nomePrincipal, bairroRegistro,
      dataAtendimento: dataAtendimentoInput || null,
      editPacId, editAtendId, urgenciaSugerida
    };
    Prontuario.abrirModalUrgencia();
  },
  abrirModalUrgencia: () => {
    document.getElementById('modalUrgencia').classList.remove('hidden');
  },
  fecharModalUrgencia: () => {
    document.getElementById('modalUrgencia').classList.add('hidden');
  },
  confirmarUrgenciaESalvar: async (urgencia) => {
    const pending = Prontuario.pendingSave;
    if (!pending) return;
    Prontuario.fecharModalUrgencia();

    const { pChave, schemas, respostas, nomePrincipal, bairroRegistro, dataAtendimento, editPacId, editAtendId } = pending;
    const agora = new Date().toLocaleString('pt-BR');
    const novoAtend = { dataStr: agora, dataAtendimento, respostas, urgencia, user: App.currentUser.username };
    const db = Prontuario.getPacientes();

    if (editPacId) {
      const pac = db.find(p => p.id === editPacId);
      if (!Prontuario.podeEditar(pac)) { Utils.notify('Você não tem permissão para editar este registro.', 'erro'); Prontuario.pendingSave = null; return; }
      if (editAtendId) {
        await Backend.editarAtendimento(editPacId, editAtendId, { respostas, urgencia, dataAtendimento, nome: nomePrincipal });
        Utils.notify('Registro Atualizado');
        Auditoria.registrar('Prontuario', 'editar-atendimento', nomePrincipal);
      } else {
        await Backend.adicionarAtendimento(editPacId, { ...novoAtend, nome: nomePrincipal });
        Utils.notify('Evolução Adicionada');
        Auditoria.registrar('Prontuario', 'novo-atendimento', nomePrincipal);
      }
    } else {
      await Backend.criarPaciente({
        nome: nomePrincipal, perfil: schemas[pChave].title, perfilChave: pChave,
        bairro: App.currentUser.bairro || null, bairroRegistro,
        criadoPor: App.currentUser.username,
        notasGerais: '', historicoVida: '',
        historico: [novoAtend],
        eventosTimeline: [{ tipo: 'atendimento', descricao: `Cadastro inicial (Urgência: ${urgencia})`, data: agora, user: App.currentUser.username }]
      });
      Utils.notify('Cadastro Realizado');
      Auditoria.registrar('Prontuario', 'novo-cadastro', nomePrincipal);
    }
    Prontuario.pendingSave = null;
    Prontuario.fecharEdicao();
    if(editPacId && !editAtendId) Prontuario.abrirProntuario(editPacId); else App.navigate('cadastrados');
  },
  salvarNotas: async (e) => {
    e.preventDefault();
    if (!Prontuario.pacienteAtual) return;
    const pac = (Prontuario.getPacientes() || []).find(p => p.id === Prontuario.pacienteAtual.id);
    if (!Prontuario.podeEditar(pac)) { Utils.notify('Sem permissão para editar este prontuário.', 'erro'); return; }
    const novasNotas = Utils.escapeHTML(document.getElementById('prontNotasGerais').value);
    const novoHistVida = Utils.escapeHTML(document.getElementById('prontHistoricoVida').value);
    if (pac.notasGerais !== novasNotas) Auditoria.registrar('Prontuario', 'editar-notas', pac.nome, 'Notas Gerais', pac.notasGerais, novasNotas);
    if (pac.historicoVida !== novoHistVida) Auditoria.registrar('Prontuario', 'editar-historico-vida', pac.nome, 'Histórico de Vida', pac.historicoVida, novoHistVida);
    await Backend.atualizarPaciente(pac.id, { nome: pac.nome, notasGerais: novasNotas, historicoVida: novoHistVida });
    Utils.notify('Anotações salvas');
  },
  // Edita o "Bairro de Registro" do paciente (requisito 9, com auditoria)
  salvarBairroRegistro: async (pacId) => {
    const pac = (Prontuario.getPacientes() || []).find(p => p.id === pacId);
    if (!Prontuario.podeEditar(pac)) { Utils.notify('Sem permissão para editar este prontuário.', 'erro'); return; }
    const novoBairro = document.getElementById('prontBairroRegistroSelect').value;
    await Backend.atualizarPaciente(pacId, {
      nome: pac.nome, notasGerais: pac.notasGerais, historicoVida: pac.historicoVida,
      bairroRegistro: novoBairro, user: App.currentUser.username, bairroOperador: App.currentUser.bairro
    });
    Utils.notify('Bairro de registro atualizado');
    Prontuario.abrirProntuario(pacId);
  },
  // Edição manual de urgência pós-salvamento (requisito 4)
  alterarUrgenciaAtendimento: async (pacId, atendId, novaUrgencia) => {
    await Backend.alterarUrgencia(pacId, atendId, { urgencia: novaUrgencia, user: App.currentUser.username });
    Auditoria.registrar('Prontuario', 'editar-urgencia', Prontuario.pacienteAtual ? Prontuario.pacienteAtual.nome : '', 'Urgência', null, novaUrgencia);
    Utils.notify('Urgência atualizada');
    Prontuario.abrirProntuario(pacId);
  },
  iniciarNovoAtendimento: () => {
    if(!Prontuario.pacienteAtual) return;
    document.getElementById('editPacienteId').value = Prontuario.pacienteAtual.id; document.getElementById('editAtendimentoId').value = '';
    document.getElementById('triagemTitle').innerText = `Evolução de Prontuário: ${Prontuario.pacienteAtual.nome}`;
    document.getElementById('seletorPerfilContainer').classList.add('hidden'); document.getElementById('selectPerfilTriagem').value = Prontuario.pacienteAtual.perfilChave;
    document.getElementById('triagemDataAtendimento').value = '';
    if (Prontuario.pacienteAtual.bairroRegistro) document.getElementById('triagemBairroRegistro').value = Prontuario.pacienteAtual.bairroRegistro;
    FormEngine.renderTriagemForm();
    const fields = FormEngine.getSchemas()[Prontuario.pacienteAtual.perfilChave].fields;
    setTimeout(() => { fields.forEach(f => { if(f.label.toLowerCase().includes('nome') && document.getElementById(f.id)) { document.getElementById(f.id).value = Prontuario.pacienteAtual.nome; document.getElementById(f.id).readOnly = true; document.getElementById(f.id).classList.add('bg-gray-100'); } }); }, 100);
    document.getElementById('btnCancelEdit').classList.remove('hidden'); App.navigate('triagem');
  },
  editarAtendimento: (pacienteId, atendimentoId) => {
    const db = Prontuario.getPacientes(); const pac = db.find(p => p.id === pacienteId);
    if (!Prontuario.podeEditar(pac)) { Utils.notify('Sem permissão para editar este registro.', 'erro'); return; }
    const atend = pac.historico.find(a => a.id === atendimentoId);
    document.getElementById('editPacienteId').value = pac.id; document.getElementById('editAtendimentoId').value = atend.id;
    document.getElementById('triagemTitle').innerText = `Corrigir Ficha de: ${pac.nome}`;
    document.getElementById('seletorPerfilContainer').classList.add('hidden'); document.getElementById('selectPerfilTriagem').value = pac.perfilChave;
    document.getElementById('triagemDataAtendimento').value = atend.dataAtendimento || '';
    if (pac.bairroRegistro) document.getElementById('triagemBairroRegistro').value = pac.bairroRegistro;
    FormEngine.renderTriagemForm();
    const fields = FormEngine.getSchemas()[pac.perfilChave].fields;
    setTimeout(() => { fields.forEach(f => { if(atend.respostas[f.label] !== undefined) FormEngine.setValorCampo(f, atend.respostas[f.label]); }); }, 100);
    document.getElementById('btnCancelEdit').classList.remove('hidden'); App.navigate('triagem');
  },
  fecharEdicao: () => {
    document.getElementById('formTriagemDinamico').reset(); document.getElementById('editPacienteId').value = ''; document.getElementById('editAtendimentoId').value = '';
    document.getElementById('triagemTitle').innerText = 'Nova Triagem';
    document.getElementById('seletorPerfilContainer').classList.remove('hidden'); document.getElementById('btnCancelEdit').classList.add('hidden');
    if (App.currentUser && App.currentUser.bairro) document.getElementById('triagemBairroRegistro').value = App.currentUser.bairro;
    FormEngine.renderTriagemForm(); if(Prontuario.pacienteAtual && document.getElementById('view-prontuario').classList.contains('active')) App.navigate('prontuario');
  },
  iconeTimeline: (tipo) => ({ atendimento: '🩺', tarefa: '✅', alteracao: '✏️', evolucao: '📈' }[tipo] || '•'),
  abrirProntuario: (id) => {
    const pac = Prontuario.getPacientes().find(p => p.id === id); if(!pac) return;
    if (App.currentUser.tipo !== 'diretoria' && pac.bairro && pac.bairro !== App.currentUser.bairro) { Utils.notify('Você não tem permissão para visualizar este prontuário.', 'erro'); return; }
    Prontuario.pacienteAtual = pac;
    document.getElementById('prontNome').innerText = pac.nome; document.getElementById('prontPerfil').innerText = pac.perfil + (pac.bairro ? ` • ${BAIRROS_LABELS[pac.bairro]}` : '');
    const editavel = Prontuario.podeEditar(pac);

    // Bairro de Registro (requisito 9)
    const bairroRegEl = document.getElementById('prontBairroRegistro');
    if (bairroRegEl) {
      if (editavel) {
        bairroRegEl.innerHTML = `<select id="prontBairroRegistroSelect" class="p-1 border rounded text-xs font-bold">${BAIRROS.map(b => `<option value="${b}" ${pac.bairroRegistro === b ? 'selected' : ''}>${BAIRROS_LABELS[b]}</option>`).join('')}</select> <button onclick="Prontuario.salvarBairroRegistro('${pac.id}')" class="text-xs text-emerald-700 font-bold hover:underline">Salvar</button>`;
      } else {
        bairroRegEl.innerHTML = `<span class="text-xs font-bold">${pac.bairroRegistro ? BAIRROS_LABELS[pac.bairroRegistro] : 'Não definido'}</span>`;
      }
    }

    const histHtml = pac.historico.slice().reverse().map(a => {
      const resHtml = Object.entries(a.respostas).map(([c, v]) => `<div class="text-sm"><span class="font-bold">${c}:</span> ${v}</div>`).join('');
      const dataLabel = a.dataAtendimento ? new Date(a.dataAtendimento).toLocaleDateString('pt-BR') : a.dataStr.split(' ')[0];
      const urgenciaSelect = editavel
        ? `<select onchange="Prontuario.alterarUrgenciaAtendimento('${pac.id}','${a.id}', this.value)" class="text-xs font-bold border rounded px-1 py-0.5 ${Utils.obterCorUrgencia(a.urgencia)}">
            <option value="ALTA" ${a.urgencia==='ALTA'?'selected':''}>ALTA</option>
            <option value="MÉDIA" ${a.urgencia==='MÉDIA'?'selected':''}>MÉDIA</option>
            <option value="BAIXA" ${a.urgencia==='BAIXA'?'selected':''}>BAIXA</option>
          </select>`
        : `<span class="${Utils.obterCorUrgencia(a.urgencia)} text-xs mr-2">${a.urgencia}</span>`;
      return `<div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div class="flex justify-between items-center mb-2 border-b pb-2"><span class="font-bold text-gray-700">Data: ${dataLabel}</span>
            <div class="flex items-center gap-2">${urgenciaSelect}${editavel ? `<button onclick="Prontuario.editarAtendimento('${pac.id}', '${a.id}')" class="text-blue-500 hover:text-blue-700 text-xs font-bold">Editar Ficha</button>` : ''}</div>
          </div><div class="space-y-1">${resHtml}</div></div>`;
    }).join('');
    document.getElementById('prontHistorico').innerHTML = histHtml;

    // Histórico de mudanças de urgência (requisito 4)
    const histUrgEl = document.getElementById('prontHistoricoUrgencia');
    if (histUrgEl) {
      const lista = (pac.historicoUrgencia || []).slice().reverse();
      histUrgEl.innerHTML = lista.length ? lista.map(h => `
        <div class="text-xs flex items-center gap-2 border-b py-1">
          <span class="text-gray-400">${h.data}</span>
          ${h.urgenciaAnterior ? `<span class="${Utils.obterCorUrgencia(h.urgenciaAnterior)}">${h.urgenciaAnterior}</span> →` : ''}
          <span class="${Utils.obterCorUrgencia(h.urgenciaNova)}">${h.urgenciaNova}</span>
          <span class="text-gray-400">por ${Utils.escapeHTML(h.user || '-')}</span>
        </div>`).join('') : '<p class="text-xs text-gray-400">Sem alterações de urgência registradas.</p>';
    }

    // Notas gerais e histórico de vida
    const notasEl = document.getElementById('prontNotasGerais'); const histVidaEl = document.getElementById('prontHistoricoVida');
    if (notasEl) { notasEl.value = pac.notasGerais || ''; notasEl.disabled = !editavel; }
    if (histVidaEl) { histVidaEl.value = pac.historicoVida || ''; histVidaEl.disabled = !editavel; }
    const btnSalvarNotas = document.getElementById('btnSalvarNotas');
    if (btnSalvarNotas) btnSalvarNotas.classList.toggle('hidden', !editavel);

    // Timeline unificada
    const timelineEl = document.getElementById('prontTimeline');
    if (timelineEl) {
      const eventos = (pac.eventosTimeline || []).slice().reverse();
      timelineEl.innerHTML = eventos.length ? eventos.map(ev => `
        <div class="flex gap-3 items-start">
          <div class="text-xl">${Prontuario.iconeTimeline(ev.tipo)}</div>
          <div class="flex-1 border-b pb-2">
            <p class="text-sm">${Utils.escapeHTML(ev.descricao)}</p>
            <p class="text-[10px] text-gray-400">${ev.data} • ${Utils.escapeHTML(ev.user)}</p>
          </div>
        </div>`).join('') : '<p class="text-sm text-gray-400">Nenhum evento na linha do tempo.</p>';
    }

    document.getElementById('btnNovoAtendimento') && document.getElementById('btnNovoAtendimento').classList.toggle('hidden', !editavel);
    App.navigate('prontuario');
  },
  renderListaCadastrados: () => {
    let db = Prontuario.getPacientes(); const termo = document.getElementById('dashFilterText').value.toLowerCase(); let html = '';
    // Segmentação por bairro
    if (App.currentUser.tipo !== 'diretoria') {
      db = db.filter(p => !p.bairro || p.bairro === App.currentUser.bairro);
    } else {
      const fBairro = (document.getElementById('filtroBairroCadastrados') || {}).value;
      if (fBairro) db = db.filter(p => p.bairro === fBairro);
    }
    const filtrados = db.filter(p => p.nome.toLowerCase().includes(termo)).reverse();
    filtrados.forEach(p => {
      const numAtend = p.historico.length; const ultimoAtend = p.historico[numAtend - 1];
      const podeExcluir = Prontuario.podeEditar(p);
      html += `<tr class="border-b hover:bg-emerald-50">
          <td class="p-3 font-bold">${p.nome} <br><span class="text-xs text-gray-500 font-normal">${p.perfil}${p.bairroRegistro ? ` • 📍${BAIRROS_LABELS[p.bairroRegistro]}` : ''}</span></td>
          <td class="p-3 text-xs">${(ultimoAtend.dataAtendimento ? new Date(ultimoAtend.dataAtendimento).toLocaleDateString('pt-BR') : ultimoAtend.dataStr.split(' ')[0])} <br><span class="${Utils.obterCorUrgencia(ultimoAtend.urgencia)} text-[10px]">${ultimoAtend.urgencia}</span></td>
          <td class="p-3 text-center font-bold text-gray-600">${numAtend}</td>
          <td class="p-3 text-center space-x-2"><button onclick="Prontuario.abrirProntuario('${p.id}')" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200">Ver Prontuário</button>${podeExcluir ? `<button onclick="Prontuario.deletarPaciente('${p.id}')" class="text-red-500 hover:underline text-xs font-bold">Excluir</button>` : ''}</td></tr>`;
    });
    document.getElementById('tabelaPacientes').innerHTML = html || '<tr><td colspan="4" class="p-4 text-center">Nenhum paciente cadastrado.</td></tr>';
  },
  deletarPaciente: async (id) => {
    const db = Prontuario.getPacientes(); const pac = db.find(p => p.id === id);
    if (!Prontuario.podeEditar(pac)) { Utils.notify('Sem permissão para excluir este registro.', 'erro'); return; }
    if(confirm('Apagar permanentemente do servidor?')) {
      await Backend.deletarPaciente(id);
      Auditoria.registrar('Prontuario', 'excluir-paciente', pac.nome);
      Prontuario.renderListaCadastrados();
    }
  }
};

// ==========================================
// DASHBOARD E EXPORTAÇÃO
// ==========================================
const Dashboard = {
  charts: { perfil: null, urgencia: null, equipes: null },
  contextoAtual: 'triagens',
  alterarContexto: (novoContexto) => {
    Dashboard.contextoAtual = novoContexto;
    const isTriagem = novoContexto === 'triagens'; const isEquipes = novoContexto === 'equipes'; const isMateriais = novoContexto === 'materiais';
    const isEconomia = novoContexto === 'economias';
    document.getElementById('containerKpisTriagem').classList.toggle('hidden', !isTriagem);
    document.getElementById('containerKpisEconomia').classList.toggle('hidden', !isEconomia);
    document.getElementById('containerKpisMateriais').classList.toggle('hidden', !isMateriais);
    document.getElementById('containerFiltrosCruzados').classList.toggle('hidden', !isTriagem);
    document.getElementById('tituloGrafico1').innerText = isTriagem ? "Distribuição por Perfil" : (isEquipes ? "Pacientes por Bairro" : (isMateriais ? "Estoque por Tipo" : "Fluxo Financeiro"));
    document.getElementById('tituloGrafico2').innerText = isTriagem ? "Métricas de Urgência" : (isEquipes ? "Ranking de Produtividade das Equipes" : (isMateriais ? "Validade dos Materiais" : "Distribuição de Despesas"));
    const blocoEquipes = document.getElementById('containerKpisEquipes');
    if (blocoEquipes) blocoEquipes.classList.toggle('hidden', !isEquipes);
    Dashboard.render();
  },
  // Lê os filtros de período (ano / data início / data fim) que afetam pacientes, financeiro e materiais
  getFiltrosPeriodo: () => ({
    ano: document.getElementById('filtroAnoDashboard').value,
    dataInicio: document.getElementById('filtroDataInicioDashboard').value,
    dataFim: document.getElementById('filtroDataFimDashboard').value
  }),
  limparFiltrosPeriodo: () => {
    document.getElementById('filtroAnoDashboard').value = '';
    document.getElementById('filtroDataInicioDashboard').value = '';
    document.getElementById('filtroDataFimDashboard').value = '';
    Dashboard.render();
  },
  // Popula o seletor de anos com base nos dados existentes (pacientes, financeiro, materiais)
  popularFiltroAno: () => {
    const anos = new Set();
    Prontuario.getPacientes().forEach(p => p.historico.forEach(h => {
      const d = h.dataAtendimento || Dashboard.dataIsoDeDataStr(h.dataStr);
      if (d) anos.add(d.slice(0, 4));
    }));
    Financeiro.getDB().forEach(r => { const d = r.dataRegistro || Dashboard.dataIsoDeDataStr(r.data); if (d) anos.add(d.slice(0,4)); });
    Materiais.getDB().forEach(m => { const d = m.dataRegistro || Dashboard.dataIsoDeDataStr(m.data); if (d) anos.add(d.slice(0,4)); });
    const sel = document.getElementById('filtroAnoDashboard');
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todos os anos</option>' + [...anos].sort().reverse().map(a => `<option value="${a}" ${a===atual?'selected':''}>${a}</option>`).join('');
  },
  dataIsoDeDataStr: (dataStr) => {
    if (!dataStr) return null;
    const partes = dataStr.split(' ')[0].split('/');
    if (partes.length !== 3) return null;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  },
  dataEfetivaDentroDoFiltro: (dataIso, filtros) => {
    if (!dataIso) return !filtros.ano && !filtros.dataInicio && !filtros.dataFim;
    if (filtros.ano && dataIso.slice(0,4) !== filtros.ano) return false;
    if (filtros.dataInicio && dataIso < filtros.dataInicio) return false;
    if (filtros.dataFim && dataIso > filtros.dataFim) return false;
    return true;
  },
  // Filtra pacientes de acordo com bairro do usuário logado (diretoria vê tudo) e período
  pacientesVisiveis: () => {
    let db = Prontuario.getPacientes();
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') db = db.filter(p => !p.bairro || p.bairro === App.currentUser.bairro);
    const filtros = Dashboard.getFiltrosPeriodo();
    if (filtros.ano || filtros.dataInicio || filtros.dataFim) {
      db = db.filter(p => {
        if (!p.historico.length) return false;
        const d = p.historico[0].dataAtendimento || Dashboard.dataIsoDeDataStr(p.historico[0].dataStr);
        return Dashboard.dataEfetivaDentroDoFiltro(d, filtros);
      });
    }
    return db;
  },
  // Registros financeiros visíveis (bairro + período)
  financeiroVisivel: () => {
    let db = Financeiro.getDB();
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') db = db.filter(r => !r.bairro || r.bairro === App.currentUser.bairro);
    const filtros = Dashboard.getFiltrosPeriodo();
    if (filtros.ano || filtros.dataInicio || filtros.dataFim) {
      db = db.filter(r => Dashboard.dataEfetivaDentroDoFiltro(r.dataRegistro || Dashboard.dataIsoDeDataStr(r.data), filtros));
    }
    return db;
  },
  // Materiais visíveis (bairro + período)
  materiaisVisiveis: () => {
    let db = Materiais.getDB();
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') db = db.filter(m => !m.bairro || m.bairro === App.currentUser.bairro);
    const filtros = Dashboard.getFiltrosPeriodo();
    if (filtros.ano || filtros.dataInicio || filtros.dataFim) {
      db = db.filter(m => Dashboard.dataEfetivaDentroDoFiltro(m.dataRegistro || Dashboard.dataIsoDeDataStr(m.data), filtros));
    }
    return db;
  },
  tarefasVisiveis: () => {
    const db = Tarefas.getDB();
    if (App.currentUser && App.currentUser.tipo !== 'diretoria') return db.filter(t => !t.bairro || t.bairro === App.currentUser.bairro);
    return db;
  },
  render: () => {
    Dashboard.popularFiltroAno();
    if (Dashboard.contextoAtual === 'economias') return Dashboard.renderEconomia();
    if (Dashboard.contextoAtual === 'equipes') return Dashboard.renderEquipes();
    if (Dashboard.contextoAtual === 'materiais') return Dashboard.renderMateriais();
    const db = Dashboard.pacientesVisiveis(); const perfisMarcados = Array.from(document.querySelectorAll('.chk-filtro-perfil:checked')).map(el => el.value); const urgenciasMarcadas = Array.from(document.querySelectorAll('.chk-filtro-urgencia:checked')).map(el => el.value);
    let totalAtend = 0; let kpiUrg = 0; let porPerfil = { adulto: 0, crianca: 0, adolescente: 0 }; let distUrgencia = { 'ALTA': 0, 'MÉDIA': 0, 'BAIXA': 0 };

    const filtrados = db.filter(p => {
      const matchP = perfisMarcados.length === 0 || perfisMarcados.includes(p.perfilChave);
      const matchU = urgenciasMarcadas.length === 0 || urgenciasMarcadas.includes(p.historico[p.historico.length - 1].urgencia);
      return matchP && matchU;
    });

    filtrados.forEach(p => {
      totalAtend += p.historico.length;
      if (porPerfil[p.perfilChave] !== undefined) porPerfil[p.perfilChave]++;
      const last = p.historico[p.historico.length - 1]; if(last.urgencia === 'ALTA') kpiUrg++; distUrgencia[last.urgencia]++;
    });

    document.getElementById('dashKpiTotal').innerText = filtrados.length; document.getElementById('dashKpiAtend').innerText = totalAtend; document.getElementById('dashKpiUrgencia').innerText = kpiUrg;
    Dashboard.renderChartsTriagem(porPerfil, distUrgencia);
  },
  renderChartsTriagem: (porPerfil, urgencias) => {
    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'doughnut', data: { labels: ['Adultos', 'Crianças', 'Adolescentes'], datasets: [{ data: [porPerfil.adulto, porPerfil.crianca, porPerfil.adolescente], backgroundColor: ['#3b82f6', '#a855f7', '#f97316'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'bar', data: { labels: ['ALTA', 'MÉDIA', 'BAIXA'], datasets: [{ label: 'Casos', data: [urgencias['ALTA'], urgencias['MÉDIA'], urgencias['BAIXA']], backgroundColor: ['#ef4444', '#eab308', '#22c55e'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  },
  renderEconomia: () => {
    const db = Dashboard.financeiroVisivel(); let cx = 0; let pv = 0; let sr = 0; let sg = 0;
    db.forEach(r => { if(r.tipo === 'renda') { cx += r.valor; sr += r.valor; } else if(r.tipo === 'gasto') { cx -= r.valor; sg += r.valor; } else if(r.tipo === 'futuro') pv += r.valor; });
    document.getElementById('dashKpiCaixa').innerText = cx.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); document.getElementById('dashKpiPrevisto').innerText = pv.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'bar', data: { labels: ['Arrecadado', 'Gasto Realizado'], datasets: [{ data: [sr, sg], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'doughnut', data: { labels: ['Saldo em Caixa', 'Previsões Futuras'], datasets: [{ data: [Math.max(cx,0), pv], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  },
  // Dashboard de Materiais: estoque, validade e movimentação (requisito 7)
  renderMateriais: () => {
    const db = Dashboard.materiaisVisiveis();
    let entradas = 0, saidas = 0;
    const estoquePorTipo = {};
    const hoje = new Date().toISOString().slice(0,10);
    const em30dias = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
    let vencidos = 0, proximos = 0;

    db.forEach(m => {
      if (m.movimento === 'entrada') { entradas += m.quantidade; estoquePorTipo[m.tipo] = (estoquePorTipo[m.tipo]||0) + m.quantidade; }
      else { saidas += m.quantidade; estoquePorTipo[m.tipo] = (estoquePorTipo[m.tipo]||0) - m.quantidade; }
      if (m.validade) {
        if (m.validade < hoje) vencidos++;
        else if (m.validade <= em30dias) proximos++;
      }
    });

    document.getElementById('dashKpiMatEntradas').innerText = entradas;
    document.getElementById('dashKpiMatSaidas').innerText = saidas;
    document.getElementById('dashKpiMatVencidos').innerText = vencidos;

    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    const tipos = Object.keys(estoquePorTipo);
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'bar', data: { labels: tipos, datasets: [{ label: 'Estoque', data: tipos.map(t => estoquePorTipo[t]), backgroundColor: '#059669', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'doughnut', data: { labels: ['Vencidos', 'Próximos da Validade (30d)', 'Demais'], datasets: [{ data: [vencidos, proximos, Math.max(db.length - vencidos - proximos, 0)], backgroundColor: ['#ef4444', '#eab308', '#22c55e'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  },
  // Dashboard Geral por Equipe/Bairro (somente diretoria)
  renderEquipes: () => {
    const pacientes = Prontuario.getPacientes(); const tarefas = Tarefas.getDB();
    const porBairroPac = {}; const porBairroTarefasConcluidas = {}; const porBairroTarefasTotal = {};
    BAIRROS.forEach(b => { porBairroPac[b] = 0; porBairroTarefasConcluidas[b] = 0; porBairroTarefasTotal[b] = 0; });
    let totalPacientes = 0, totalTarefasPendentes = 0;
    pacientes.forEach(p => { if (p.bairro && porBairroPac.hasOwnProperty(p.bairro)) porBairroPac[p.bairro]++; totalPacientes++; });
    tarefas.forEach(t => {
      if (t.bairro && porBairroTarefasTotal.hasOwnProperty(t.bairro)) {
        porBairroTarefasTotal[t.bairro]++;
        if (t.status === 'Concluído') porBairroTarefasConcluidas[t.bairro]++;
      }
      if (t.status !== 'Concluído' && t.status !== 'Cancelado') totalTarefasPendentes++;
    });

    const elTotal = document.getElementById('dashKpiTotalEquipes'); if (elTotal) elTotal.innerText = totalPacientes;
    const elPend = document.getElementById('dashKpiTarefasPendentesEquipes'); if (elPend) elPend.innerText = totalTarefasPendentes;
    const elBairros = document.getElementById('dashKpiBairrosAtivos'); if (elBairros) elBairros.innerText = BAIRROS.filter(b => porBairroPac[b] > 0).length;

    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    // Gráfico 1: pacientes por bairro
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'bar', data: { labels: BAIRROS.map(b => BAIRROS_LABELS[b]), datasets: [{ label: 'Pacientes', data: BAIRROS.map(b => porBairroPac[b]), backgroundColor: '#059669', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    // Gráfico 2: ranking de produtividade (% tarefas concluídas por bairro)
    const ranking = BAIRROS.map(b => ({ bairro: b, pct: porBairroTarefasTotal[b] ? Math.round((porBairroTarefasConcluidas[b] / porBairroTarefasTotal[b]) * 100) : 0 })).sort((a,b) => b.pct - a.pct);
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'bar', data: { labels: ranking.map(r => BAIRROS_LABELS[r.bairro]), datasets: [{ label: '% Tarefas Concluídas', data: ranking.map(r => r.pct), backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  },
  exportarParaExcel: (acao) => {
    let csv = "\uFEFF"; let filename = "";
    if (Dashboard.contextoAtual === 'economias') {
      filename = "balanco_ruas.csv"; csv += "Data;Tipo;Descrição;Valor;Registrado Por\n"; Dashboard.financeiroVisivel().forEach(r => csv += `${r.dataRegistro ? new Date(r.dataRegistro).toLocaleDateString('pt-BR') : r.data};${r.tipo.toUpperCase()};${r.desc};${r.valor};${r.user}\n`);
    } else if (Dashboard.contextoAtual === 'materiais') {
      filename = "materiais_ruas.csv"; csv += "Data;Tipo;Descrição;Movimento;Quantidade;Validade;Bairro\n"; Dashboard.materiaisVisiveis().forEach(m => csv += `${m.dataRegistro ? new Date(m.dataRegistro).toLocaleDateString('pt-BR') : m.data};${m.tipo};${m.descricao||''};${m.movimento};${m.quantidade};${m.validade ? new Date(m.validade).toLocaleDateString('pt-BR') : ''};${m.bairro ? BAIRROS_LABELS[m.bairro] : ''}\n`);
    } else if (Dashboard.contextoAtual === 'equipes') {
      filename = "produtividade_equipes_ruas.csv"; csv += "Bairro;Pacientes;Tarefas Pendentes;Tarefas Concluídas\n";
      const pacientes = Prontuario.getPacientes(); const tarefas = Tarefas.getDB();
      BAIRROS.forEach(b => {
        const numPac = pacientes.filter(p => p.bairro === b).length;
        const pend = tarefas.filter(t => t.bairro === b && t.status !== 'Concluído' && t.status !== 'Cancelado').length;
        const conc = tarefas.filter(t => t.bairro === b && t.status === 'Concluído').length;
        csv += `${BAIRROS_LABELS[b]};${numPac};${pend};${conc}\n`;
      });
    } else {
      filename = "base_pacientes_ruas.csv"; csv += "Nome do Assistido;Perfil;Bairro de Registro;Data;Urgência;Evolução\n"; Dashboard.pacientesVisiveis().forEach(p => p.historico.forEach(h => { const res = Object.entries(h.respostas).map(([l, v]) => `${l}: ${v}`).join(' | '); const dataLabel = h.dataAtendimento ? new Date(h.dataAtendimento).toLocaleDateString('pt-BR') : h.dataStr; csv += `${p.nome};${p.perfil};${p.bairroRegistro ? BAIRROS_LABELS[p.bairroRegistro] : ''};${dataLabel};${h.urgencia};${res}\n`; }));
    }
    
    Dashboard.dispararDownload(csv, filename);

    if(acao === 'email') {
      const assunto = encodeURIComponent(`Relatório Oficial: ${filename}`);
      const corpo = encodeURIComponent(`Olá equipe,\n\nSegue em anexo o relatório exportado diretamente do sistema do Projeto Ruas.\n\n(Importante: Lembre-se de anexar o arquivo '${filename}' que acabou de ser baixado no seu dispositivo antes de enviar este e-mail).\n\nAtenciosamente,\nSistema de Gestão - Projeto Ruas`);
      window.location.href = `mailto:?subject=${assunto}&body=${corpo}`;
    }
  },
  dispararDownload: (content, filename) => { const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

// ==========================================
// FINANCEIRO
// ==========================================
const Financeiro = {
  getDB: () => Backend.get(FINANCEIRO_KEY) || [],
  init: () => {
    document.getElementById('formFinanceiro').addEventListener('submit', Financeiro.salvarRegistro);
    const tipoSel = document.getElementById('finTipo');
    const dataContainer = document.getElementById('finDataFuturaContainer');
    if (tipoSel && dataContainer) {
      tipoSel.addEventListener('change', () => dataContainer.classList.toggle('hidden', tipoSel.value !== 'futuro'));
    }
  },
  salvarRegistro: async (e) => {
    e.preventDefault();
    const tipo = document.getElementById('finTipo').value;
    const desc = Utils.escapeHTML(document.getElementById('finDesc').value);
    const valor = parseFloat(document.getElementById('finValor').value);
    const dataRegistro = (document.getElementById('finDataRegistro') || {}).value || null;
    const dataFutura = (document.getElementById('finDataFutura') || {}).value || null;
    const r = { data: new Date().toLocaleString('pt-BR'), dataRegistro, tipo, desc, valor, user: App.currentUser.username, bairro: App.currentUser.bairro || null, dataPrevista: tipo === 'futuro' ? dataFutura : null };

    const resultado = await Backend.criarRegistroFinanceiro(r);
    Auditoria.registrar('Financeiro', 'novo-registro', desc, 'valor', null, valor);

    if (tipo === 'futuro' && resultado.tarefa_criada) {
      Utils.notify('Gasto futuro registrado e tarefa criada no To Do');
    } else {
      Utils.notify('Registro Financeiro Salvo');
    }
    document.getElementById('formFinanceiro').reset();
    document.getElementById('finDataFuturaContainer').classList.add('hidden');
    Financeiro.render();
  },
  render: () => {
    const db = Financeiro.getDB().slice().reverse(); let cx = 0; let pv = 0; let html = '';
    db.forEach(r => {
      let cor = 'text-gray-600'; let sinal = ''; let valFormat = r.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
      if(r.tipo === 'renda') { cx += r.valor; cor = 'text-green-600'; sinal = '+'; } else if(r.tipo === 'gasto') { cx -= r.valor; cor = 'text-red-600'; sinal = '-'; } else if(r.tipo === 'futuro') { pv += r.valor; cor = 'text-yellow-600'; }
      const previsaoHtml = r.dataPrevista ? `<span class="text-[10px] text-yellow-600 block">📅 Previsto para: ${new Date(r.dataPrevista).toLocaleDateString('pt-BR')}</span>` : '';
      const dataLabel = r.dataRegistro ? new Date(r.dataRegistro).toLocaleDateString('pt-BR') : r.data.split(' ')[0];
      html += `<li class="flex justify-between items-center p-2 border-b"><div><span class="font-bold ${cor}">${r.desc}</span> <span class="text-[10px] text-gray-400 block">${dataLabel}</span>${previsaoHtml}</div><div class="font-bold ${cor}">${sinal}${valFormat}</div></li>`;
    });
    document.getElementById('listaFinanceiro').innerHTML = html || '<p class="text-center text-gray-400 mt-4">Nenhum registro.</p>'; document.getElementById('finCaixa').innerText = cx.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); document.getElementById('finPrevisto').innerText = pv.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  }
};

// ==========================================
// MÓDULO DE MATERIAIS (estoque, validade, movimentação)
// ==========================================
const Materiais = {
  getDB: () => Backend.get(MATERIAIS_KEY) || [],
  init: () => {
    document.getElementById('formMaterial').addEventListener('submit', Materiais.salvar);
    document.getElementById('matFiltroTipo').addEventListener('change', Materiais.render);
    document.getElementById('matFiltroAno').addEventListener('change', Materiais.render);
    const selBairro = document.getElementById('matFiltroBairro');
    if (selBairro) {
      if (App.currentUser && App.currentUser.tipo === 'diretoria') {
        selBairro.innerHTML = '<option value="">Todos os bairros</option>' + BAIRROS.map(b => `<option value="${b}">${BAIRROS_LABELS[b]}</option>`).join('');
        selBairro.addEventListener('change', Materiais.render);
      }
    }
  },
  salvar: async (e) => {
    e.preventDefault();
    const tipo = Utils.escapeHTML(document.getElementById('matTipo').value);
    const descricao = Utils.escapeHTML(document.getElementById('matDescricao').value);
    const data = document.getElementById('matData').value;
    const validade = document.getElementById('matValidade').value || null;
    const quantidade = parseFloat(document.getElementById('matQuantidade').value);
    const movimento = document.getElementById('matMovimento').value;

    const registro = {
      tipo, descricao, movimento, validade, quantidade,
      data: new Date().toLocaleString('pt-BR'),
      dataRegistro: data || null,
      user: App.currentUser.username, bairro: App.currentUser.bairro || null
    };
    try {
      await Materiais.criarComAuditoria(registro);
    } catch (err) { return; }
    document.getElementById('formMaterial').reset();
    Materiais.render();
  },
  criarComAuditoria: async (registro) => {
    await Backend.criarMaterial(registro);
    Auditoria.registrar('Materiais', registro.movimento === 'entrada' ? 'entrada' : 'saida', registro.tipo, 'quantidade', null, registro.quantidade);
    Utils.notify(registro.movimento === 'entrada' ? 'Entrada de material registrada' : 'Saída de material registrada');
  },
  deletar: async (id) => {
    if (!confirm('Remover este registro de movimentação?')) return;
    const m = Materiais.getDB().find(x => x.id === id);
    await Backend.deletarMaterial(id);
    if (m) Auditoria.registrar('Materiais', 'excluir', m.tipo);
    Materiais.render();
  },
  popularFiltros: () => {
    let db = Materiais.getDB();
    if (App.currentUser.tipo !== 'diretoria') db = db.filter(m => !m.bairro || m.bairro === App.currentUser.bairro);
    const tipos = [...new Set(db.map(m => m.tipo))].sort();
    const anos = [...new Set(db.map(m => (m.dataRegistro || m.data.split(' ')[0].split('/').reverse().join('-')).slice(0,4)))].sort().reverse();
    const selTipo = document.getElementById('matFiltroTipo');
    const valorTipo = selTipo.value;
    selTipo.innerHTML = '<option value="">Todos os tipos</option>' + tipos.map(t => `<option value="${Utils.escapeHTML(t)}" ${t===valorTipo?'selected':''}>${Utils.escapeHTML(t)}</option>`).join('');
    const selAno = document.getElementById('matFiltroAno');
    const valorAno = selAno.value;
    selAno.innerHTML = '<option value="">Todos os anos</option>' + anos.map(a => `<option value="${a}" ${a===valorAno?'selected':''}>${a}</option>`).join('');
  },
  render: async () => {
    Materiais.popularFiltros();
    let db = Materiais.getDB();
    if (App.currentUser.tipo !== 'diretoria') db = db.filter(m => !m.bairro || m.bairro === App.currentUser.bairro);

    const fTipo = document.getElementById('matFiltroTipo').value;
    const fAno = document.getElementById('matFiltroAno').value;
    const fBairro = (document.getElementById('matFiltroBairro') || {}).value;
    if (fTipo) db = db.filter(m => m.tipo === fTipo);
    if (fAno) db = db.filter(m => (m.dataRegistro || '').slice(0,4) === fAno || (!m.dataRegistro && m.data.slice(6,10) === fAno));
    if (fBairro) db = db.filter(m => m.bairro === fBairro);

    // Lista de movimentações
    const html = db.slice().reverse().map(m => {
      const dataLabel = m.dataRegistro ? new Date(m.dataRegistro).toLocaleDateString('pt-BR') : m.data.split(' ')[0];
      const validadeLabel = m.validade ? `<span class="text-[10px] text-gray-400 block">Validade: ${new Date(m.validade).toLocaleDateString('pt-BR')}</span>` : '';
      const sinal = m.movimento === 'entrada' ? '+' : '-';
      const cor = m.movimento === 'entrada' ? 'text-green-600' : 'text-red-600';
      return `<li class="flex justify-between items-center p-2 border-b">
        <div>
          <span class="font-bold">${Utils.escapeHTML(m.tipo)}</span> ${m.descricao ? `<span class="text-xs text-gray-400">(${Utils.escapeHTML(m.descricao)})</span>` : ''}
          <span class="text-[10px] text-gray-400 block">${dataLabel}${m.bairro ? ' • ' + BAIRROS_LABELS[m.bairro] : ''}</span>
          ${validadeLabel}
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold ${cor}">${sinal}${m.quantidade}</span>
          <button onclick="Materiais.deletar('${m.id}')" class="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
        </div>
      </li>`;
    }).join('');
    document.getElementById('listaMovimentacoesMateriais').innerHTML = html || '<p class="text-center text-gray-400 mt-4">Nenhuma movimentação registrada.</p>';

    // Área analítica
    try {
      const analise = await Backend.analiseMateriais();
      const estoqueHtml = Object.entries(analise.estoquePorTipo || {}).map(([tipo, qtd]) => `<li class="flex justify-between"><span>${Utils.escapeHTML(tipo)}</span><span class="font-bold ${qtd < 0 ? 'text-red-600' : ''}">${qtd}</span></li>`).join('');
      document.getElementById('listaEstoqueMateriais').innerHTML = estoqueHtml || '<p class="text-gray-400 text-xs">Sem dados.</p>';

      const vencidosHtml = (analise.vencidos || []).map(v => `<li>${Utils.escapeHTML(v.tipo)} <span class="text-[10px] text-gray-400">(venceu em ${new Date(v.validade).toLocaleDateString('pt-BR')})</span></li>`).join('');
      document.getElementById('listaMateriaisVencidos').innerHTML = vencidosHtml || '<p class="text-gray-400 text-xs">Nenhum item vencido.</p>';

      const proximosHtml = (analise.proximosVencimento || []).map(v => `<li>${Utils.escapeHTML(v.tipo)} <span class="text-[10px] text-gray-400">(vence em ${new Date(v.validade).toLocaleDateString('pt-BR')})</span></li>`).join('');
      document.getElementById('listaMateriaisProximos').innerHTML = proximosHtml || '<p class="text-gray-400 text-xs">Nenhum item próximo da validade.</p>';
    } catch (e) { console.error('Erro ao carregar análise de materiais', e); }
  }
};


const FormEngine = {
  getSchemas: () => Backend.get(SCHEMA_KEY) || defaultSchemas,
  saveSchemas: (s) => Backend.saveSchemas(s),
  initAdmin: () => {
    const ts = document.getElementById('newFieldType'); const oc = document.getElementById('selectOptionsContainer');
    document.getElementById('selectPerfilAdmin').addEventListener('change', FormEngine.renderSchemaList);
    const tiposComOpcoes = ['select', 'checkbox'];
    ts.addEventListener('change', (e) => {
      if (tiposComOpcoes.includes(e.target.value)) {
        oc.classList.remove('hidden');
        if (document.getElementById('optionsBuilder').children.length === 0) {
          FormEngine.addOptionInput(); FormEngine.addOptionInput();
        }
      } else {
        oc.classList.add('hidden');
      }
    });
    document.getElementById('formAddField').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = document.getElementById('selectPerfilAdmin').value;
      const nf = { id: Utils.generateId(), label: Utils.escapeHTML(document.getElementById('newFieldLabel').value), type: ts.value };
      if (tiposComOpcoes.includes(ts.value)) {
        const inputs = document.querySelectorAll('#optionsBuilder input');
        nf.options = Array.from(inputs).map(i => Utils.escapeHTML(i.value.trim())).filter(Boolean);
        if (nf.options.length < 2) { Utils.notify('Esse tipo de campo exige no mínimo 2 opções.', 'erro'); return; }
      }
      const s = FormEngine.getSchemas(); s[p].fields.push(nf);
      try {
        await FormEngine.saveSchemas(s);
      } catch (err) { return; }
      document.getElementById('formAddField').reset();
      document.getElementById('optionsBuilder').innerHTML = '';
      oc.classList.add('hidden');
      FormEngine.renderSchemaList(); FormEngine.renderTriagemForm();
      Auditoria.registrar('Formularios', 'novo-campo', nf.label);
    });
  },
  addOptionInput: () => {
    const container = document.getElementById('optionsBuilder');
    const idx = container.children.length + 1;
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center';
    row.innerHTML = `<input type="text" placeholder="Opção ${idx}" class="flex-1 p-2 border rounded-lg outline-none text-sm"><button type="button" onclick="this.parentElement.remove()" class="text-red-500 font-bold px-2">✕</button>`;
    container.appendChild(row);
  },
  // Rótulo amigável para cada tipo de campo nas "Perguntas Atuais"
  labelTipo: (tipo) => ({ text: 'Texto Curto', textarea: 'Texto Longo', number: 'Número', date: 'Data', select: 'Lista Suspensa', checkbox: 'Múltipla Escolha' }[tipo] || tipo),
  renderSchemaList: () => {
    const p = document.getElementById('selectPerfilAdmin').value;
    document.getElementById('schemaList').innerHTML = FormEngine.getSchemas()[p].fields.map((f, i) => {
      const opcoesHtml = (f.options && f.options.length) ? `<div class="text-[10px] text-gray-400 mt-1">Opções: ${f.options.map(o=>Utils.escapeHTML(o)).join(', ')}</div>` : '';
      return `<li class="flex justify-between items-center p-3 bg-gray-50 border rounded-lg"><div><span class="font-bold">${Utils.escapeHTML(f.label)}</span> <span class="text-xs bg-gray-200 px-2 rounded">${FormEngine.labelTipo(f.type)}</span>${opcoesHtml}</div><button onclick="FormEngine.deleteField('${p}', ${i})" class="text-red-500 font-bold px-2 text-sm">Excluir</button></li>`;
    }).join('');
  },
  deleteField: async (p, i) => { const s = FormEngine.getSchemas(); s[p].fields.splice(i, 1); await FormEngine.saveSchemas(s); FormEngine.renderSchemaList(); FormEngine.renderTriagemForm(); },
  // Lê o valor de um campo dinâmico (trata checkbox como array de opções marcadas)
  lerValorCampo: (f) => {
    if (f.type === 'checkbox') {
      const marcados = document.querySelectorAll(`input[name="${f.id}"]:checked`);
      return Array.from(marcados).map(c => c.value).join(', ');
    }
    const el = document.getElementById(f.id);
    return el ? el.value : '';
  },
  // Preenche um campo dinâmico com um valor salvo (trata checkbox marcando as opções correspondentes)
  setValorCampo: (f, valor) => {
    if (f.type === 'checkbox') {
      const selecionados = (valor || '').split(',').map(s => s.trim()).filter(Boolean);
      document.querySelectorAll(`input[name="${f.id}"]`).forEach(c => { c.checked = selecionados.includes(c.value); });
      return;
    }
    const el = document.getElementById(f.id);
    if (el) el.value = valor;
  },
  renderTriagemForm: () => {
    const p = document.getElementById('selectPerfilTriagem').value;
    document.getElementById('dynamicFieldsContainer').innerHTML = FormEngine.getSchemas()[p].fields.map(f => {
      let h = ''; const b = "w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white";
      if (f.type === 'textarea') {
        h = `<textarea id="${f.id}" rows="2" class="${b}" required></textarea>`;
      } else if (f.type === 'select') {
        h = `<select id="${f.id}" class="${b}">${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
      } else if (f.type === 'checkbox') {
        // Mini-caixas selecionáveis (requisito 2)
        h = `<div class="flex flex-wrap gap-2">${(f.options||[]).map((o, idx) => `
          <label class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-emerald-50 text-sm">
            <input type="checkbox" name="${f.id}" value="${Utils.escapeHTML(o)}" class="accent-emerald-600">
            ${Utils.escapeHTML(o)}
          </label>`).join('')}</div>`;
      } else if (f.type === 'date') {
        h = `<input type="date" id="${f.id}" class="${b}">`;
      } else {
        h = `<input type="${f.type}" id="${f.id}" class="${b}" required>`;
      }
      return `<div data-field-id="${f.id}" data-field-type="${f.type}"><label class="block text-sm font-bold text-emerald-900 mb-1">${Utils.escapeHTML(f.label)}</label>${h}</div>`;
    }).join('');
  }
};

// ==========================================
// CONTROLADOR SPA
// ==========================================
const App = {
  currentUser: null,
  init: async () => {
    await Backend.init();
    // Os schemas padrão já são populados pelo backend Flask na primeira execução (init_db()).
    if (!Backend.get(SCHEMA_KEY) || Object.keys(Backend.get(SCHEMA_KEY)).length === 0) {
      Backend.cache[SCHEMA_KEY] = defaultSchemas;
    }
    
    // Função do Menu Mobile Atualizada
    document.getElementById('mobileMenuBtn').addEventListener('click', () => { 
      const nav = document.getElementById('mainNav'); 
      nav.classList.toggle('hidden'); 
      nav.classList.toggle('flex'); 
    });

    // Modo Escuro
    App.initDarkMode();

    // Busca global
    if (document.getElementById('buscaGlobal')) {
      document.getElementById('buscaGlobal').addEventListener('keyup', App.buscaGlobal);
    }
    
    FormEngine.initAdmin(); Prontuario.init(); Financeiro.init(); Tarefas.init(); Materiais.init(); Usuarios.init(); GestaBairros.init();
    if (document.getElementById('listaLogs')) Auditoria.initFiltros();
    Auth.init();
  },
  initDarkMode: () => {
    const btn = document.getElementById('btnDarkMode');
    const ativo = localStorage.getItem(DARKMODE_KEY) === '1';
    if (ativo) document.documentElement.classList.add('dark');
    if (btn) btn.addEventListener('click', App.toggleDarkMode);
  },
  toggleDarkMode: () => {
    const ativo = document.documentElement.classList.toggle('dark');
    localStorage.setItem(DARKMODE_KEY, ativo ? '1' : '0');
  },
  // Busca global por nome de paciente
  buscaGlobal: (e) => {
    const termo = e.target.value.toLowerCase().trim();
    const resultadosEl = document.getElementById('buscaGlobalResultados');
    if (!resultadosEl) return;
    if (!termo) { resultadosEl.classList.add('hidden'); resultadosEl.innerHTML = ''; return; }
    let pacientes = Prontuario.getPacientes();
    if (App.currentUser.tipo !== 'diretoria') pacientes = pacientes.filter(p => !p.bairro || p.bairro === App.currentUser.bairro);
    const encontrados = pacientes.filter(p => p.nome.toLowerCase().includes(termo)).slice(0, 8);
    resultadosEl.innerHTML = encontrados.length
      ? encontrados.map(p => `<button onclick="App.irParaProntuario('${p.id}')" class="block w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b">${Utils.escapeHTML(p.nome)} <span class="text-xs text-gray-400">(${p.perfil})</span></button>`).join('')
      : '<div class="px-3 py-2 text-sm text-gray-400">Nenhum resultado.</div>';
    resultadosEl.classList.remove('hidden');
  },
  irParaProntuario: (id) => {
    document.getElementById('buscaGlobalResultados').classList.add('hidden');
    document.getElementById('buscaGlobal').value = '';
    Prontuario.abrirProntuario(id);
  },
  startSession: () => {
    const nav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    const busca = document.getElementById('buscaGlobalContainer');
    
    // Remove o bloqueio absoluto de ocultação após o login
    nav.classList.remove('force-hidden');
    menuBtn.classList.remove('force-hidden');
    if (busca) busca.classList.remove('force-hidden');
    document.getElementById('btnDarkMode').classList.remove('force-hidden');
    
    document.getElementById('header-user-info').innerText = `Operador: ${Utils.escapeHTML(App.currentUser.label || App.currentUser.username.toUpperCase())}`;

    // Itens visíveis apenas para diretoria
    document.querySelectorAll('.diretoria-only').forEach(el => el.classList.toggle('hidden', App.currentUser.tipo !== 'diretoria'));
    const optEquipes = document.querySelector('#selectContextoDashboard option[value="equipes"]');
    if (optEquipes) optEquipes.disabled = (App.currentUser.tipo !== 'diretoria');

    FormEngine.renderSchemaList(); Financeiro.render(); Prontuario.renderListaCadastrados(); FormEngine.renderTriagemForm(); Tarefas.render();
    App.navigate('triagem');
  },
  navigate: (viewId) => {
    if(!App.currentUser && viewId !== 'login') return App.navigate('login');
    if(App.currentUser && App.currentUser.deveTrocarSenha && viewId !== 'trocarSenha') return App.navigate('trocarSenha');
    if(App.currentUser && !App.currentUser.deveTrocarSenha && (viewId === 'login' || viewId === 'trocarSenha')) return App.navigate('triagem');
    if((viewId === 'logs' || viewId === 'usuarios') && App.currentUser && App.currentUser.tipo !== 'diretoria') { Utils.notify('Acesso restrito à Diretoria.', 'erro'); return; }
    
    const nav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    // Na tela de login/troca de senha, aplica a classe que oculta o menu impiedosamente
    if (viewId === 'login' || viewId === 'trocarSenha') {
      nav.classList.add('force-hidden');
      menuBtn.classList.add('force-hidden');
      if (document.getElementById('buscaGlobalContainer')) document.getElementById('buscaGlobalContainer').classList.add('force-hidden');
      if (document.getElementById('btnDarkMode')) document.getElementById('btnDarkMode').classList.add('force-hidden');
      document.getElementById('header-user-info').innerText = viewId === 'trocarSenha' ? 'Troca de Senha Obrigatória' : 'Acesso Restrito';
    } else {
      nav.classList.remove('force-hidden');
      menuBtn.classList.remove('force-hidden');
    }

    if(window.innerWidth < 768 && viewId !== 'login' && viewId !== 'trocarSenha') { nav.classList.add('hidden'); nav.classList.remove('flex'); }
    
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); 
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    if (viewId === 'triagem') FormEngine.renderTriagemForm();
    if (viewId === 'cadastrados') Prontuario.renderListaCadastrados();
    if (viewId === 'dashboard') { setTimeout(() => Dashboard.render(), 100); }
    if (viewId === 'financeiro') Financeiro.render();
    if (viewId === 'materiais') Materiais.render();
    if (viewId === 'tarefas') Tarefas.render();
    if (viewId === 'logs') Auditoria.render();
    if (viewId === 'usuarios') { Usuarios.render(); GestaBairros.render(); }
    window.scrollTo(0, 0);
  }
};

document.addEventListener('DOMContentLoaded', App.init);