// Constantes e Chaves de Banco
const PACIENTES_KEY = 'ruas_pacientes_db';
const SCHEMA_KEY = 'form_schema_db';
const FINANCEIRO_KEY = 'ruas_finance_db';
const TAREFAS_KEY = 'ruas_tarefas_db'; 
const LOCK_KEY = 'ruas_lockout_db'; 
const SESSION_PERSIST_KEY = 'ruas_saved_session'; 

// SVGs Dinâmicos de Contorno
const eyeOpenSVG = '<svg class="w-5 h-5 eye-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const eyeClosedSVG = '<svg class="w-5 h-5 eye-icon" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

const defaultSchemas = {
  'adulto': { title: 'Perfil Adulto', fields: [{ id: 'a_nome', label: 'Nome Social / Completo *', type: 'text' }, { id: 'a_idade', label: 'Idade', type: 'number' }, { id: 'a_tempo', label: 'Tempo de Situação de Rua', type: 'select', options: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 5 anos', 'Mais de 5 anos'] }, { id: 'a_saude', label: 'Condições de Saúde / Uso de Substâncias', type: 'textarea' }, { id: 'a_demandas', label: 'Demandas do Atendimento Hoje', type: 'textarea' }] },
  'crianca': { title: 'Perfil Criança / Adolescente', fields: [{ id: 'c_nome', label: 'Nome da Criança/Adolescente *', type: 'text' }, { id: 'c_idade', label: 'Idade', type: 'number' }, { id: 'c_resp', label: 'Nome do Responsável Presente', type: 'text' }, { id: 'c_saude', label: 'Condição de Saúde, Sinais Físicos', type: 'textarea' }] }
};

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
const Backend = {
  cache: { [PACIENTES_KEY]: [], [SCHEMA_KEY]: null, [FINANCEIRO_KEY]: [], [TAREFAS_KEY]: [] },
  init: async () => {
    try {
      const urls = [fetch(`/api/data/${PACIENTES_KEY}`), fetch(`/api/data/${SCHEMA_KEY}`), fetch(`/api/data/${FINANCEIRO_KEY}`), fetch(`/api/data/${TAREFAS_KEY}`)];
      const [rPac, rSch, rFin, rTar] = await Promise.all(urls);
      const pac = await rPac.json(); if(pac) Backend.cache[PACIENTES_KEY] = pac;
      const sch = await rSch.json(); if(sch) Backend.cache[SCHEMA_KEY] = sch;
      const fin = await rFin.json(); if(fin) Backend.cache[FINANCEIRO_KEY] = fin;
      const tar = await rTar.json(); if(tar) Backend.cache[TAREFAS_KEY] = tar;
    } catch (e) { console.error("Falha ao conectar no backend. Tentando usar cache local.", e); }
  },
  get: (key) => Backend.cache[key],
  save: (key, data) => {
    Backend.cache[key] = data;
    fetch(`/api/data/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .catch(e => console.error("Erro ao salvar no servidor:", e));
  }
};

// ==========================================
// MÓDULO DE TAREFAS
// ==========================================
const Tarefas = {
  getDB: () => Backend.get(TAREFAS_KEY) || [],
  saveDB: (db) => Backend.save(TAREFAS_KEY, db),
  init: () => document.getElementById('formTarefa').addEventListener('submit', Tarefas.add),
  add: (e) => {
    e.preventDefault();
    const text = Utils.escapeHTML(document.getElementById('novaTarefa').value);
    const db = Tarefas.getDB();
    db.push({ id: Utils.generateId(), text, completed: false, date: new Date().toLocaleString('pt-BR'), user: App.currentUser.username });
    Tarefas.saveDB(db); document.getElementById('formTarefa').reset(); Tarefas.render();
  },
  toggle: (id) => {
    const db = Tarefas.getDB(); const t = db.find(x => x.id === id);
    if(t) { t.completed = !t.completed; t.doneDate = t.completed ? new Date().toLocaleString('pt-BR') : null; Tarefas.saveDB(db); Tarefas.render(); }
  },
  delete: (id) => {
    if(confirm('Apagar esta tarefa do sistema?')) { Tarefas.saveDB(Tarefas.getDB().filter(x => x.id !== id)); Tarefas.render(); }
  },
  render: () => {
    const db = Tarefas.getDB(); let pendentes = ''; let concluidas = '';
    [...db].reverse().forEach(t => {
      if(!t.completed) {
        pendentes += `<li class="flex justify-between items-center bg-white p-3 border border-emerald-200 rounded-lg shadow-sm">
          <span class="font-bold text-gray-700">${t.text}</span>
          <div class="flex gap-2">
            <button onclick="Tarefas.toggle('${t.id}')" class="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-bold" title="Concluir">✓ Feito</button>
            <button onclick="Tarefas.delete('${t.id}')" class="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold">✕</button>
          </div>
        </li>`;
      } else {
        concluidas += `<li class="flex justify-between items-center bg-gray-100 p-3 border border-gray-200 rounded-lg">
          <div><span class="line-through text-gray-500 font-bold">${t.text}</span><span class="text-[10px] block text-gray-400 mt-1">Concluída em: ${t.doneDate} por ${t.user}</span></div>
          <div class="flex gap-2">
            <button onclick="Tarefas.toggle('${t.id}')" class="text-blue-500 hover:underline text-xs font-bold">Desfazer</button>
            <button onclick="Tarefas.delete('${t.id}')" class="text-red-400 hover:text-red-600 font-bold">✕</button>
          </div>
        </li>`;
      }
    });
    document.getElementById('listaTarefasPendentes').innerHTML = pendentes || '<p class="text-sm text-gray-400 italic">Nenhuma tarefa pendente na fila.</p>';
    document.getElementById('listaTarefasConcluidas').innerHTML = concluidas || '<p class="text-sm text-gray-400 italic">O log de atividades está vazio.</p>';
  }
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================
const Auth = {
  maxAttempts: 3, lockTimeMs: 15 * 60000, timeoutTimer: null,
  credential: { user: 'voluntario', pass: 'Projeto@Voluntario26' },
  init: () => {
    document.getElementById('formLogin').addEventListener('submit', Auth.handleLogin);
    document.getElementById('btnTogglePassword').innerHTML = eyeOpenSVG;
    const session = sessionStorage.getItem('ruas_session') || localStorage.getItem(SESSION_PERSIST_KEY);
    if (session) { App.currentUser = JSON.parse(session); App.startSession(); Auth.resetInactivityTimeout(); } else { App.navigate('login'); }
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
    if (App.currentUser) Auth.timeoutTimer = setTimeout(() => { Utils.notify("Sessão expirada por inatividade", "erro"); Auth.logout(); }, 30 * 60000);
  },
  handleLogin: (e) => {
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

    if (u === Auth.credential.user && p === Auth.credential.pass) {
      err.classList.add('hidden'); lock.attempts = 0; lockDb[u] = lock; localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb));
      App.currentUser = { username: u };
      sessionStorage.setItem('ruas_session', JSON.stringify(App.currentUser));
      if(document.getElementById('loginRemember').checked) {
        localStorage.setItem(SESSION_PERSIST_KEY, JSON.stringify(App.currentUser));
      } else {
        localStorage.removeItem(SESSION_PERSIST_KEY);
      }
      document.getElementById('formLogin').reset(); 
      document.getElementById('loginPass').type = 'password';
      document.getElementById('btnTogglePassword').innerHTML = eyeOpenSVG;
      App.startSession(); Auth.resetInactivityTimeout();
    } else {
      lock.attempts += 1;
      if (lock.attempts >= Auth.maxAttempts) lock.lockedUntil = Date.now() + Auth.lockTimeMs;
      err.innerText = `Credenciais inválidas! Tentativas restantes: ${Auth.maxAttempts - lock.attempts}`; 
      lockDb[u] = lock; localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb)); err.classList.remove('hidden');
    }
  },
  logout: () => { sessionStorage.removeItem('ruas_session'); localStorage.removeItem(SESSION_PERSIST_KEY); App.currentUser = null; App.navigate('login'); }
};

// ==========================================
// PRONTUÁRIOS
// ==========================================
const Prontuario = {
  pacienteAtual: null,
  getPacientes: () => Backend.get(PACIENTES_KEY),
  savePacientes: (db) => Backend.save(PACIENTES_KEY, db),
  init: () => {
    document.getElementById('formTriagemDinamico').addEventListener('submit', Prontuario.salvarAtendimento);
    document.getElementById('selectPerfilTriagem').addEventListener('change', FormEngine.renderTriagemForm);
    document.getElementById('dashFilterText').addEventListener('keyup', Prontuario.renderListaCadastrados);
  },
  salvarAtendimento: (e) => {
    e.preventDefault();
    const pChave = document.getElementById('selectPerfilTriagem').value; const schemas = FormEngine.getSchemas(); const fields = schemas[pChave].fields;
    let respostas = {}; let rawText = ''; let nomePrincipal = 'Não Identificado';
    fields.forEach(f => {
      const val = Utils.escapeHTML(document.getElementById(f.id).value); respostas[f.label] = val; rawText += val + ' ';
      if(f.label.toLowerCase().includes('nome')) nomePrincipal = val;
    });
    const urgencia = Utils.calcUrgencia(rawText);
    const novoAtend = { id: Utils.generateId(), dataStr: new Date().toLocaleString('pt-BR'), respostas, urgencia };
    let db = Prontuario.getPacientes(); const editPacId = document.getElementById('editPacienteId').value; const editAtendId = document.getElementById('editAtendimentoId').value;

    if (editPacId) {
      const pacIndex = db.findIndex(p => p.id === editPacId);
      if (editAtendId) {
        const atIndex = db[pacIndex].historico.findIndex(a => a.id === editAtendId);
        db[pacIndex].historico[atIndex] = { ...db[pacIndex].historico[atIndex], respostas, urgencia };
        db[pacIndex].nome = nomePrincipal; Utils.notify('Registro Atualizado');
      } else { db[pacIndex].historico.push(novoAtend); Utils.notify('Evolução Adicionada'); }
    } else {
      db.push({ id: Utils.generateId(), nome: nomePrincipal, perfil: schemas[pChave].title, perfilChave: pChave, historico: [novoAtend] });
      Utils.notify('Cadastro Realizado');
    }
    Prontuario.savePacientes(db); Prontuario.fecharEdicao();
    if(editPacId && !editAtendId) Prontuario.abrirProntuario(editPacId); else App.navigate('cadastrados');
  },
  iniciarNovoAtendimento: () => {
    if(!Prontuario.pacienteAtual) return;
    document.getElementById('editPacienteId').value = Prontuario.pacienteAtual.id; document.getElementById('editAtendimentoId').value = '';
    document.getElementById('triagemTitle').innerText = `Evolução de Prontuário: ${Prontuario.pacienteAtual.nome}`;
    document.getElementById('seletorPerfilContainer').classList.add('hidden'); document.getElementById('selectPerfilTriagem').value = Prontuario.pacienteAtual.perfilChave;
    FormEngine.renderTriagemForm();
    const fields = FormEngine.getSchemas()[Prontuario.pacienteAtual.perfilChave].fields;
    setTimeout(() => { fields.forEach(f => { if(f.label.toLowerCase().includes('nome') && document.getElementById(f.id)) { document.getElementById(f.id).value = Prontuario.pacienteAtual.nome; document.getElementById(f.id).readOnly = true; document.getElementById(f.id).classList.add('bg-gray-100'); } }); }, 100);
    document.getElementById('btnCancelEdit').classList.remove('hidden'); App.navigate('triagem');
  },
  editarAtendimento: (pacienteId, atendimentoId) => {
    const db = Prontuario.getPacientes(); const pac = db.find(p => p.id === pacienteId); const atend = pac.historico.find(a => a.id === atendimentoId);
    document.getElementById('editPacienteId').value = pac.id; document.getElementById('editAtendimentoId').value = atend.id;
    document.getElementById('triagemTitle').innerText = `Corrigir Ficha de: ${pac.nome}`;
    document.getElementById('seletorPerfilContainer').classList.add('hidden'); document.getElementById('selectPerfilTriagem').value = pac.perfilChave;
    FormEngine.renderTriagemForm();
    const fields = FormEngine.getSchemas()[pac.perfilChave].fields;
    setTimeout(() => { fields.forEach(f => { if(atend.respostas[f.label] && document.getElementById(f.id)) document.getElementById(f.id).value = atend.respostas[f.label]; }); }, 100);
    document.getElementById('btnCancelEdit').classList.remove('hidden'); App.navigate('triagem');
  },
  fecharEdicao: () => {
    document.getElementById('formTriagemDinamico').reset(); document.getElementById('editPacienteId').value = ''; document.getElementById('editAtendimentoId').value = '';
    document.getElementById('triagemTitle').innerText = 'Nova Triagem';
    document.getElementById('seletorPerfilContainer').classList.remove('hidden'); document.getElementById('btnCancelEdit').classList.add('hidden');
    FormEngine.renderTriagemForm(); if(Prontuario.pacienteAtual && document.getElementById('view-prontuario').classList.contains('active')) App.navigate('prontuario');
  },
  abrirProntuario: (id) => {
    const pac = Prontuario.getPacientes().find(p => p.id === id); if(!pac) return; Prontuario.pacienteAtual = pac;
    document.getElementById('prontNome').innerText = pac.nome; document.getElementById('prontPerfil').innerText = pac.perfil;
    const histHtml = pac.historico.slice().reverse().map(a => {
      const resHtml = Object.entries(a.respostas).map(([c, v]) => `<div class="text-sm"><span class="font-bold">${c}:</span> ${v}</div>`).join('');
      return `<div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div class="flex justify-between items-center mb-2 border-b pb-2"><span class="font-bold text-gray-700">Data: ${a.dataStr.split(' ')[0]}</span>
            <div><span class="${Utils.obterCorUrgencia(a.urgencia)} text-xs mr-2">${a.urgencia}</span><button onclick="Prontuario.editarAtendimento('${pac.id}', '${a.id}')" class="text-blue-500 hover:text-blue-700 text-xs font-bold">Editar Ficha</button></div>
          </div><div class="space-y-1">${resHtml}</div></div>`;
    }).join('');
    document.getElementById('prontHistorico').innerHTML = histHtml; App.navigate('prontuario');
  },
  renderListaCadastrados: () => {
    const db = Prontuario.getPacientes(); const termo = document.getElementById('dashFilterText').value.toLowerCase(); let html = '';
    const filtrados = db.filter(p => p.nome.toLowerCase().includes(termo)).reverse();
    filtrados.forEach(p => {
      const numAtend = p.historico.length; const ultimoAtend = p.historico[numAtend - 1];
      html += `<tr class="border-b hover:bg-emerald-50">
          <td class="p-3 font-bold">${p.nome} <br><span class="text-xs text-gray-500 font-normal">${p.perfil}</span></td>
          <td class="p-3 text-xs">${ultimoAtend.dataStr.split(' ')[0]} <br><span class="${Utils.obterCorUrgencia(ultimoAtend.urgencia)} text-[10px]">${ultimoAtend.urgencia}</span></td>
          <td class="p-3 text-center font-bold text-gray-600">${numAtend}</td>
          <td class="p-3 text-center space-x-2"><button onclick="Prontuario.abrirProntuario('${p.id}')" class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200">Ver Prontuário</button><button onclick="Prontuario.deletarPaciente('${p.id}')" class="text-red-500 hover:underline text-xs font-bold">Excluir</button></td></tr>`;
    });
    document.getElementById('tabelaPacientes').innerHTML = html || '<tr><td colspan="4" class="p-4 text-center">Nenhum paciente cadastrado.</td></tr>';
  },
  deletarPaciente: (id) => { if(confirm('Apagar permanentemente do servidor?')) { Prontuario.savePacientes(Prontuario.getPacientes().filter(p => p.id !== id)); Prontuario.renderListaCadastrados(); } }
};

// ==========================================
// DASHBOARD E EXPORTAÇÃO
// ==========================================
const Dashboard = {
  charts: { perfil: null, urgencia: null },
  contextoAtual: 'triagens',
  alterarContexto: (novoContexto) => {
    Dashboard.contextoAtual = novoContexto; const isTriagem = novoContexto === 'triagens';
    document.getElementById('containerKpisTriagem').classList.toggle('hidden', !isTriagem); document.getElementById('containerKpisEconomia').classList.toggle('hidden', isTriagem); document.getElementById('containerFiltrosCruzados').classList.toggle('hidden', !isTriagem);
    document.getElementById('tituloGrafico1').innerText = isTriagem ? "Distribuição por Perfil" : "Fluxo Financeiro"; document.getElementById('tituloGrafico2').innerText = isTriagem ? "Métricas de Urgência" : "Distribuição de Despesas";
    Dashboard.render();
  },
  render: () => {
    if (Dashboard.contextoAtual === 'economias') return Dashboard.renderEconomia();
    const db = Prontuario.getPacientes(); const perfisMarcados = Array.from(document.querySelectorAll('.chk-filtro-perfil:checked')).map(el => el.value); const urgenciasMarcadas = Array.from(document.querySelectorAll('.chk-filtro-urgencia:checked')).map(el => el.value);
    let totalAtend = 0; let kpiUrg = 0; let qtdAdulto = 0; let qtdCrianca = 0; let distUrgencia = { 'ALTA': 0, 'MÉDIA': 0, 'BAIXA': 0 };

    const filtrados = db.filter(p => {
      const matchP = perfisMarcados.length === 0 || perfisMarcados.includes(p.perfilChave);
      const matchU = urgenciasMarcadas.length === 0 || urgenciasMarcadas.includes(p.historico[p.historico.length - 1].urgencia);
      return matchP && matchU;
    });

    filtrados.forEach(p => {
      totalAtend += p.historico.length;
      if(p.perfilChave === 'adulto') qtdAdulto++; if(p.perfilChave === 'crianca') qtdCrianca++;
      const last = p.historico[p.historico.length - 1]; if(last.urgencia === 'ALTA') kpiUrg++; distUrgencia[last.urgencia]++;
    });

    document.getElementById('dashKpiTotal').innerText = filtrados.length; document.getElementById('dashKpiAtend').innerText = totalAtend; document.getElementById('dashKpiUrgencia').innerText = kpiUrg;
    Dashboard.renderChartsTriagem(qtdAdulto, qtdCrianca, distUrgencia);
  },
  renderChartsTriagem: (adultos, criancas, urgencias) => {
    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'doughnut', data: { labels: ['Adultos', 'Crianças'], datasets: [{ data: [adultos, criancas], backgroundColor: ['#3b82f6', '#a855f7'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'bar', data: { labels: ['ALTA', 'MÉDIA', 'BAIXA'], datasets: [{ label: 'Casos', data: [urgencias['ALTA'], urgencias['MÉDIA'], urgencias['BAIXA']], backgroundColor: ['#ef4444', '#eab308', '#22c55e'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  },
  renderEconomia: () => {
    const db = Financeiro.getDB(); let cx = 0; let pv = 0; let mat = 0; let sr = 0; let sg = 0;
    db.forEach(r => { if(r.tipo === 'renda') { cx += r.valor; sr += r.valor; } else if(r.tipo === 'gasto') { cx -= r.valor; sg += r.valor; } else if(r.tipo === 'futuro') pv += r.valor; else mat += r.valor; });
    document.getElementById('dashKpiCaixa').innerText = cx.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); document.getElementById('dashKpiPrevisto').innerText = pv.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); document.getElementById('dashKpiMateriais').innerText = `${mat} un.`;
    const ctxP = document.getElementById('chartPerfil').getContext('2d'); const ctxU = document.getElementById('chartUrgencia').getContext('2d');
    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy(); if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();
    Dashboard.charts.perfil = new Chart(ctxP, { type: 'bar', data: { labels: ['Arrecadado', 'Gasto Realizado'], datasets: [{ data: [sr, sg], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    Dashboard.charts.urgencia = new Chart(ctxU, { type: 'doughnut', data: { labels: ['Previsões Futuras', 'Insumos Utilizados'], datasets: [{ data: [pv, mat], backgroundColor: ['#f59e0b', '#3b82f6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
  },
  exportarParaExcel: (acao) => {
    let csv = "\uFEFF"; let filename = "";
    if (Dashboard.contextoAtual === 'economias') {
      filename = "balanco_ruas.csv"; csv += "Data;Tipo;Descrição;Valor ou Qtd;Registrado Por\n"; Financeiro.getDB().forEach(r => csv += `${r.data};${r.tipo.toUpperCase()};${r.desc};${r.valor};${r.user}\n`);
    } else {
      filename = "base_pacientes_ruas.csv"; csv += "Nome do Assistido;Perfil;Data;Urgência;Evolução\n"; Prontuario.getPacientes().forEach(p => p.historico.forEach(h => { const res = Object.entries(h.respostas).map(([l, v]) => `${l}: ${v}`).join(' | '); csv += `${p.nome};${p.perfil};${h.dataStr};${h.urgencia};${res}\n`; }));
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
  getDB: () => Backend.get(FINANCEIRO_KEY), saveDB: (db) => Backend.save(FINANCEIRO_KEY, db),
  init: () => document.getElementById('formFinanceiro').addEventListener('submit', Financeiro.salvarRegistro),
  salvarRegistro: (e) => {
    e.preventDefault(); const r = { id: Utils.generateId(), data: new Date().toLocaleString('pt-BR'), tipo: document.getElementById('finTipo').value, desc: Utils.escapeHTML(document.getElementById('finDesc').value), valor: parseFloat(document.getElementById('finValor').value), user: App.currentUser.username };
    const db = Financeiro.getDB(); db.push(r); Financeiro.saveDB(db); document.getElementById('formFinanceiro').reset(); Financeiro.render();
    Utils.notify('Registro Financeiro Salvo');
  },
  render: () => {
    const db = Financeiro.getDB().slice().reverse(); let cx = 0; let pv = 0; let html = '';
    db.forEach(r => {
      let cor = 'text-gray-600'; let sinal = ''; let valFormat = r.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
      if(r.tipo === 'renda') { cx += r.valor; cor = 'text-green-600'; sinal = '+'; } else if(r.tipo === 'gasto') { cx -= r.valor; cor = 'text-red-600'; sinal = '-'; } else if(r.tipo === 'futuro') { pv += r.valor; cor = 'text-yellow-600'; } else if(r.tipo === 'material') { cor = 'text-blue-600'; valFormat = `${r.valor} un.`; }
      html += `<li class="flex justify-between items-center p-2 border-b"><div><span class="font-bold ${cor}">${r.desc}</span> <span class="text-[10px] text-gray-400 block">${r.data.split(' ')[0]}</span></div><div class="font-bold ${cor}">${sinal}${valFormat}</div></li>`;
    });
    document.getElementById('listaFinanceiro').innerHTML = html || '<p class="text-center text-gray-400 mt-4">Nenhum registro.</p>'; document.getElementById('finCaixa').innerText = cx.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); document.getElementById('finPrevisto').innerText = pv.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  }
};

// ==========================================
// MOTOR DE FORMULÁRIOS DINÂMICOS
// ==========================================
const FormEngine = {
  getSchemas: () => Backend.get(SCHEMA_KEY) || defaultSchemas, saveSchemas: (s) => Backend.save(SCHEMA_KEY, s),
  initAdmin: () => {
    const ts = document.getElementById('newFieldType'); const oc = document.getElementById('selectOptionsContainer');
    document.getElementById('selectPerfilAdmin').addEventListener('change', FormEngine.renderSchemaList);
    ts.addEventListener('change', (e) => e.target.value === 'select' ? oc.classList.remove('hidden') : oc.classList.add('hidden'));
    document.getElementById('formAddField').addEventListener('submit', (e) => {
      e.preventDefault(); const p = document.getElementById('selectPerfilAdmin').value; const nf = { id: Utils.generateId(), label: Utils.escapeHTML(document.getElementById('newFieldLabel').value), type: ts.value };
      if(ts.value === 'select') nf.options = document.getElementById('newFieldOptions').value.split(',').map(o=>Utils.escapeHTML(o.trim())).filter(Boolean);
      const s = FormEngine.getSchemas(); s[p].fields.push(nf); FormEngine.saveSchemas(s); document.getElementById('formAddField').reset(); oc.classList.add('hidden'); FormEngine.renderSchemaList(); FormEngine.renderTriagemForm();
    });
  },
  renderSchemaList: () => { const p = document.getElementById('selectPerfilAdmin').value; document.getElementById('schemaList').innerHTML = FormEngine.getSchemas()[p].fields.map((f, i) => `<li class="flex justify-between items-center p-3 bg-gray-50 border rounded-lg"><div><span class="font-bold">${Utils.escapeHTML(f.label)}</span> <span class="text-xs bg-gray-200 px-2 rounded">${f.type}</span></div><button onclick="FormEngine.deleteField('${p}', ${i})" class="text-red-500 font-bold px-2 text-sm">Excluir</button></li>`).join(''); },
  deleteField: (p, i) => { const s = FormEngine.getSchemas(); s[p].fields.splice(i, 1); FormEngine.saveSchemas(s); FormEngine.renderSchemaList(); FormEngine.renderTriagemForm(); },
  renderTriagemForm: () => {
    const p = document.getElementById('selectPerfilTriagem').value;
    document.getElementById('dynamicFieldsContainer').innerHTML = FormEngine.getSchemas()[p].fields.map(f => {
      let h = ''; const b = "w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white";
      if(f.type==='textarea') h = `<textarea id="${f.id}" rows="2" class="${b}" required></textarea>`; else if(f.type==='select') h = `<select id="${f.id}" class="${b}">${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`; else h = `<input type="${f.type}" id="${f.id}" class="${b}" required>`;
      return `<div><label class="block text-sm font-bold text-emerald-900 mb-1">${Utils.escapeHTML(f.label)}</label>${h}</div>`;
    }).join('');
  }
};

// ==========================================
// CONTROLADOR SPA
// ==========================================
const App = {
  currentUser: null,
  init: async () => {
    await Backend.init(); if(!Backend.get(SCHEMA_KEY)) Backend.save(SCHEMA_KEY, defaultSchemas);
    
    // Função do Menu Mobile Atualizada
    document.getElementById('mobileMenuBtn').addEventListener('click', () => { 
      const nav = document.getElementById('mainNav'); 
      nav.classList.toggle('hidden'); 
      nav.classList.toggle('flex'); 
    });
    
    FormEngine.initAdmin(); Prontuario.init(); Financeiro.init(); Tarefas.init(); Auth.init();
  },
  startSession: () => {
    const nav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    // Remove o bloqueio absoluto de ocultação após o login
    nav.classList.remove('force-hidden');
    menuBtn.classList.remove('force-hidden');
    
    document.getElementById('header-user-info').innerText = `Operador: ${Utils.escapeHTML(App.currentUser.username.toUpperCase())}`;
    FormEngine.renderSchemaList(); Financeiro.render(); Prontuario.renderListaCadastrados(); FormEngine.renderTriagemForm(); Tarefas.render();
    App.navigate('triagem');
  },
  navigate: (viewId) => {
    if(!App.currentUser && viewId !== 'login') return App.navigate('login');
    if(App.currentUser && viewId === 'login') return App.navigate('triagem');
    
    const nav = document.getElementById('mainNav');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    // Na tela de login, aplica a classe que oculta o menu impiedosamente
    if (viewId === 'login') {
      nav.classList.add('force-hidden');
      menuBtn.classList.add('force-hidden');
      document.getElementById('header-user-info').innerText = 'Acesso Restrito';
    } else {
      nav.classList.remove('force-hidden');
      menuBtn.classList.remove('force-hidden');
    }

    if(window.innerWidth < 768 && viewId !== 'login') { nav.classList.add('hidden'); nav.classList.remove('flex'); }
    
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active')); 
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    if (viewId === 'triagem') FormEngine.renderTriagemForm();
    if (viewId === 'cadastrados') Prontuario.renderListaCadastrados();
    if (viewId === 'dashboard') { setTimeout(() => Dashboard.render(), 100); }
    if (viewId === 'financeiro') Financeiro.render();
    if (viewId === 'tarefas') Tarefas.render();
    window.scrollTo(0, 0);
  }
};

document.addEventListener('DOMContentLoaded', App.init);