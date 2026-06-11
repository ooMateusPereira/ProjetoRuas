// Constantes e Bancos de Dados
const DB_KEY = 'cadastro_ruas_db';
const SCHEMA_KEY = 'form_schema_db';
const USERS_KEY = 'ruas_users_db';
const LOCK_KEY = 'ruas_lockout_db'; // Novo banco para controle de bloqueios
const SESSION_PERSIST_KEY = 'ruas_saved_session'; // Para o "Lembrar de Mim"

const defaultSchemas = {
  'adulto': {
    title: 'Perfil Adulto',
    fields: [
      { id: 'a_nome', label: 'Nome Social / Completo *', type: 'text' },
      { id: 'a_idade', label: 'Idade', type: 'number' },
      { id: 'a_tempo', label: 'Tempo de Situação de Rua', type: 'select', options: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 5 anos', 'Mais de 5 anos'] },
      { id: 'a_doc', label: 'Possui Documentação Civil / CadÚnico?', type: 'select', options: ['Sim, documentos em mãos', 'Não possui/Perdeu tudo', 'Apenas alguns documentos'] },
      { id: 'a_saude', label: 'Condições de Saúde (Física/Mental) e Uso de Substâncias', type: 'textarea' },
      { id: 'a_demandas', label: 'Principais Demandas (Alimentação, Abrigo, Encaminhamento Médico, etc)', type: 'textarea' }
    ]
  },
  'crianca': {
    title: 'Perfil Criança / Adolescente',
    fields: [
      { id: 'c_nome', label: 'Nome da Criança/Adolescente *', type: 'text' },
      { id: 'c_idade', label: 'Idade', type: 'number' },
      { id: 'c_resp', label: 'Nome e Vínculo do Responsável Presente', type: 'text' },
      { id: 'c_escola', label: 'Situação Escolar', type: 'select', options: ['Frequentando a escola', 'Evasão Escolar (Fora da escola)', 'Nunca frequentou'] },
      { id: 'c_saude', label: 'Condição de Saúde, Vacinação e Sinais Físicos', type: 'textarea' },
      { id: 'c_risco', label: 'Observações Técnicas (Sinais de violência, trabalho infantil, negligência)', type: 'textarea' }
    ]
  }
};

const defaultUsers = {
  'admin': { pass: 'ProjetoR@uas26', role: 'admin' },
  'voluntario': { pass: 'ruas123', role: 'voluntario' }
};

// Utilitários de Segurança e Cálculos
const Utils = {
  generateId: () => 'id_' + Math.random().toString(36).substr(2, 9),
  
  // PROTEÇÃO XSS (Cross-Site Scripting) - Sanitiza todas as strings inseridas por usuários
  escapeHTML: (str) => {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
  },

  calcUrgencia: (valoresAgrupados) => {
    const texto = valoresAgrupados.toLowerCase();
    if (texto.includes('dor no peito') || texto.includes('sangramento') || texto.includes('violência') || texto.includes('abuso') || texto.includes('desnutrição')) return 'ALTA';
    if (texto.includes('febre') || texto.includes('tosse') || texto.includes('ferida') || texto.includes('trabalho infantil')) return 'MÉDIA';
    return 'BAIXA';
  },
  
  obterCorUrgencia: (urgencia) => {
    if(urgencia === 'ALTA') return 'text-red-700 bg-red-100 px-2 py-1 rounded font-bold';
    if(urgencia === 'MÉDIA') return 'text-yellow-700 bg-yellow-100 px-2 py-1 rounded font-bold';
    return 'text-green-700 bg-green-100 px-2 py-1 rounded font-bold';
  }
};

// 1. SISTEMA DE AUTENTICAÇÃO E PROTEÇÕES (Brute-Force e Inatividade)
const Auth = {
  maxAttempts: 3,
  lockTimeMs: 15 * 60 * 1000, // 15 Minutos de bloqueio
  timeoutTimer: null,

  getUsers: () => JSON.parse(localStorage.getItem(USERS_KEY) || JSON.stringify(defaultUsers)),
  saveUsers: (obj) => localStorage.setItem(USERS_KEY, JSON.stringify(obj)),

  init: () => {
    if(!localStorage.getItem(USERS_KEY)) Auth.saveUsers(defaultUsers);
    document.getElementById('formLogin').addEventListener('submit', Auth.handleLogin);
    
    // Verifica sessão de abas (sessionStorage) ou a persistente do "Lembrar-me" (localStorage)
    const activeSession = sessionStorage.getItem('ruas_session') || localStorage.getItem(SESSION_PERSIST_KEY);
    
    if (activeSession) {
      App.currentUser = JSON.parse(activeSession);
      App.startSession();
      Auth.resetInactivityTimeout(); // Inicia o timer de ociosidade
    } else {
      App.navigate('login');
    }

    // Monitora atividade do usuário para proteção de inatividade (30 mins)
    window.addEventListener('mousemove', Auth.resetInactivityTimeout);
    window.addEventListener('keypress', Auth.resetInactivityTimeout);
  },

  resetInactivityTimeout: () => {
    clearTimeout(Auth.timeoutTimer);
    if (App.currentUser) {
      Auth.timeoutTimer = setTimeout(() => {
        alert("Sua sessão expirou por inatividade para sua segurança.");
        Auth.logout();
      }, 30 * 60 * 1000); // 30 Minutos sem mexer o mouse desloga
    }
  },

  handleLogin: (e) => {
    e.preventDefault();
    const username = Utils.escapeHTML(document.getElementById('loginUser').value.toLowerCase().trim());
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    const rememberMe = document.getElementById('loginRemember').checked;
    
    const dbUsers = Auth.getUsers();
    let lockDb = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    let userLock = lockDb[username] || { attempts: 0, lockedUntil: null };

    // Verifica se a conta está temporariamente bloqueada
    if (userLock.lockedUntil && Date.now() < userLock.lockedUntil) {
      const minutesLeft = Math.ceil((userLock.lockedUntil - Date.now()) / 60000);
      err.innerText = `🛡️ Conta bloqueada por segurança. Tente novamente em ${minutesLeft} minuto(s).`;
      err.classList.remove('hidden');
      return;
    }

    // Remove bloqueio expirado
    if (userLock.lockedUntil && Date.now() > userLock.lockedUntil) {
      userLock.attempts = 0;
      userLock.lockedUntil = null;
    }

    if (dbUsers[username] && dbUsers[username].pass === pass) {
      // Sucesso no Login
      err.classList.add('hidden');
      userLock.attempts = 0; // Reseta tentativas
      lockDb[username] = userLock;
      localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb));

      App.currentUser = { username: username, role: dbUsers[username].role };
      sessionStorage.setItem('ruas_session', JSON.stringify(App.currentUser));
      
      // Feature "Lembrar de Mim"
      if(rememberMe) {
        localStorage.setItem(SESSION_PERSIST_KEY, JSON.stringify(App.currentUser));
      }

      document.getElementById('formLogin').reset();
      App.startSession();
      Auth.resetInactivityTimeout();
    } else {
      // Falha no Login - Incrementa Brute Force
      userLock.attempts += 1;
      if (userLock.attempts >= Auth.maxAttempts) {
        userLock.lockedUntil = Date.now() + Auth.lockTimeMs;
        err.innerText = `🛡️ Múltiplas falhas! Conta bloqueada por 15 minutos.`;
      } else {
        err.innerText = `Credenciais inválidas! Tentativas restantes: ${Auth.maxAttempts - userLock.attempts}`;
      }
      lockDb[username] = userLock;
      localStorage.setItem(LOCK_KEY, JSON.stringify(lockDb));
      err.classList.remove('hidden');
    }
  },

  logout: () => {
    sessionStorage.removeItem('ruas_session');
    localStorage.removeItem(SESSION_PERSIST_KEY); // Limpa o Lembrar-me
    App.currentUser = null;
    clearTimeout(Auth.timeoutTimer);
    document.getElementById('mainNav').classList.add('hidden');
    App.navigate('login');
  }
};

// 2. MÓDULO DE USUÁRIOS
const UserAdmin = {
  init: () => document.getElementById('formAddUser').addEventListener('submit', UserAdmin.handleAddUser),
  renderList: () => {
    const users = Auth.getUsers();
    const tbody = document.getElementById('tabelaUsuarios');
    let html = '';
    for (const [username, data] of Object.entries(users)) {
      const isCurrent = App.currentUser.username === username;
      const badge = data.role === 'admin' ? '<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">Admin</span>' : '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">Voluntário</span>';
      html += `<tr class="border-b hover:bg-emerald-50">
        <td class="p-3 font-bold text-gray-700">${Utils.escapeHTML(username)} ${isCurrent ? '<span class="text-xs text-emerald-500">(Você)</span>' : ''}</td>
        <td class="p-3">${badge}</td>
        <td class="p-3 text-center space-x-2">
          <button onclick="UserAdmin.changePassword('${Utils.escapeHTML(username)}')" class="text-blue-500 hover:text-blue-700 font-bold text-xs">Mudar Senha</button>
          ${!isCurrent ? `<button onclick="UserAdmin.deleteUser('${Utils.escapeHTML(username)}')" class="text-red-500 hover:text-red-700 font-bold text-xs">Excluir</button>` : ''}
        </td></tr>`;
    }
    tbody.innerHTML = html;
  },
  handleAddUser: (e) => {
    e.preventDefault();
    const username = Utils.escapeHTML(document.getElementById('newUsername').value.toLowerCase().trim());
    const pass = Utils.escapeHTML(document.getElementById('newUserPass').value);
    const role = document.getElementById('newUserRole').value;
    if (username.includes(' ')) return alert('Sem espaços no usuário.');
    const users = Auth.getUsers();
    if (users[username]) return alert('Usuário já existe!');
    users[username] = { pass, role };
    Auth.saveUsers(users);
    document.getElementById('formAddUser').reset();
    UserAdmin.renderList();
  },
  deleteUser: (user) => { if(confirm(`Excluir '${user}'?`)) { const u = Auth.getUsers(); delete u[user]; Auth.saveUsers(u); UserAdmin.renderList(); } },
  changePassword: (user) => { const np = prompt(`Nova senha para '${user}':`); if(np) { const u = Auth.getUsers(); u[user].pass = Utils.escapeHTML(np); Auth.saveUsers(u); alert('Senha alterada.'); } }
};

// 3. MOTOR DE FORMULÁRIOS DINÂMICOS
const FormEngine = {
  getSchemas: () => {
    const saved = localStorage.getItem(SCHEMA_KEY);
    return saved ? JSON.parse(saved) : defaultSchemas;
  },
  saveSchemas: (schemas) => localStorage.setItem(SCHEMA_KEY, JSON.stringify(schemas)),
  initAdmin: () => {
    const ts = document.getElementById('newFieldType');
    const oc = document.getElementById('selectOptionsContainer');
    document.getElementById('selectPerfilAdmin').addEventListener('change', () => FormEngine.renderSchemaList());
    ts.addEventListener('change', (e) => e.target.value === 'select' ? oc.classList.remove('hidden') : oc.classList.add('hidden'));
    document.getElementById('formAddField').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = document.getElementById('selectPerfilAdmin').value;
      const nf = { id: Utils.generateId(), label: Utils.escapeHTML(document.getElementById('newFieldLabel').value), type: ts.value };
      if(ts.value === 'select') nf.options = document.getElementById('newFieldOptions').value.split(',').map(o=>Utils.escapeHTML(o.trim())).filter(Boolean);
      const s = FormEngine.getSchemas(); s[p].fields.push(nf); FormEngine.saveSchemas(s);
      document.getElementById('formAddField').reset(); oc.classList.add('hidden');
      FormEngine.renderSchemaList(); FormEngine.renderTriagemForm();
    });
  },
  renderSchemaList: () => {
    const p = document.getElementById('selectPerfilAdmin').value;
    document.getElementById('schemaList').innerHTML = FormEngine.getSchemas()[p].fields.map((f, i) => `
      <li class="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
        <div><span class="font-bold text-emerald-900">${Utils.escapeHTML(f.label)}</span> <span class="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded ml-2">${f.type}</span>
        ${f.type==='select'?`<p class="text-xs text-gray-500 mt-1">Opções: ${f.options.join(', ')}</p>`:''}</div>
        <button onclick="FormEngine.deleteField('${p}', ${i})" class="text-red-500 font-bold px-2 text-sm">Excluir</button>
      </li>`).join('');
  },
  deleteField: (p, i) => { const s = FormEngine.getSchemas(); s[p].fields.splice(i, 1); FormEngine.saveSchemas(s); FormEngine.renderSchemaList(); FormEngine.renderTriagemForm(); },
  initTriagem: () => document.getElementById('selectPerfilTriagem').addEventListener('change', FormEngine.renderTriagemForm),
  renderTriagemForm: () => {
    const p = document.getElementById('selectPerfilTriagem').value;
    document.getElementById('dynamicFieldsContainer').innerHTML = FormEngine.getSchemas()[p].fields.map(f => {
      let h = ''; const b = "w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none";
      if(f.type==='textarea') h = `<textarea id="${f.id}" rows="2" class="${b}" required></textarea>`;
      else if(f.type==='select') h = `<select id="${f.id}" class="${b}">${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
      else h = `<input type="${f.type}" id="${f.id}" class="${b}" required>`;
      return `<div><label class="block text-sm font-bold text-emerald-900 mb-1">${Utils.escapeHTML(f.label)}</label>${h}</div>`;
    }).join('');
  },
  handleTriagemSubmit: (e) => {
    e.preventDefault();
    const p = document.getElementById('selectPerfilTriagem').value;
    const s = FormEngine.getSchemas();
    const r = { id: Utils.generateId(), dataStr: new Date().toLocaleString('pt-BR'), perfilNome: s[p].title, respostas: {}, rawText: '' };
    
    s[p].fields.forEach(f => {
      // Aplica escapeHTML em tudo que o usuário digita no atendimento
      const rawValue = document.getElementById(f.id).value;
      const sanitizedValue = Utils.escapeHTML(rawValue);
      r.respostas[f.label] = sanitizedValue; 
      r.rawText += sanitizedValue + ' ';
    });

    r.urgencia = Utils.calcUrgencia(r.rawText);
    const db = JSON.parse(localStorage.getItem(DB_KEY)||'[]'); db.push(r); localStorage.setItem(DB_KEY, JSON.stringify(db));
    document.getElementById('formTriagemDinamico').reset();
    alert('Atendimento salvo com sucesso!');
    if(App.currentUser.role === 'admin') Dashboard.render();
  }
};

// 4. DASHBOARD DE ADMINISTRAÇÃO AVANÇADO
const Dashboard = {
  charts: { perfil: null, urgencia: null },

  init: () => {
    document.getElementById('dashFilterText').addEventListener('keyup', Dashboard.render);
  },

  render: () => {
    const pacientesRaw = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    
    const fText = document.getElementById('dashFilterText').value.toLowerCase();
    const fPerfil = document.getElementById('dashFilterPerfil').value;
    const fUrgencia = document.getElementById('dashFilterUrgencia').value;

    const pacientes = pacientesRaw.filter(p => {
      const matchText = Object.values(p.respostas).join(' ').toLowerCase().includes(fText);
      const matchPerfil = fPerfil === 'todos' || p.perfilNome === fPerfil;
      const matchUrgencia = fUrgencia === 'todos' || p.urgencia === fUrgencia;
      return matchText && matchPerfil && matchUrgencia;
    }).reverse();

    let qtdAlta = 0, qtdAdulto = 0, qtdCrianca = 0;
    let distUrgencia = { 'ALTA': 0, 'MÉDIA': 0, 'BAIXA': 0 };
    let htmlTabela = '';

    pacientes.forEach(p => {
      if(p.urgencia === 'ALTA') qtdAlta++;
      if(p.perfilNome === 'Perfil Adulto') qtdAdulto++;
      if(p.perfilNome === 'Perfil Criança / Adolescente') qtdCrianca++;
      distUrgencia[p.urgencia]++;
      
      const resHtml = Object.entries(p.respostas).map(([c, v]) => `<div><span class="font-bold text-emerald-900">${Utils.escapeHTML(c)}:</span> ${v}</div>`).join('');
      
      htmlTabela += `
        <tr class="border-b hover:bg-emerald-50">
          <td class="p-3 align-top">
            <div class="whitespace-nowrap font-bold">${p.dataStr.split(' ')[0]}</div>
            <div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(p.perfilNome || '-')}</div>
          </td>
          <td class="p-3 align-top text-xs space-y-1">${resHtml}</td>
          <td class="p-3 align-top"><span class="${Utils.obterCorUrgencia(p.urgencia)} text-xs">${p.urgencia}</span></td>
          <td class="p-3 align-top text-center">
            <button onclick="Dashboard.deletarRegistro('${p.id}')" class="text-red-500 hover:text-red-700 font-bold text-xs">Excluir</button>
          </td>
        </tr>`;
    });

    document.getElementById('tabelaPacientes').innerHTML = htmlTabela || '<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhum registro para estes filtros.</td></tr>';
    document.getElementById('dashLabelExibindo').innerText = `Exibindo ${pacientes.length} registros`;
    
    document.getElementById('dashKpiTotal').innerText = pacientes.length;
    document.getElementById('dashKpiUrgencia').innerText = qtdAlta;
    document.getElementById('dashKpiAdultos').innerText = qtdAdulto;
    document.getElementById('dashKpiCriancas').innerText = qtdCrianca;

    Dashboard.renderCharts(qtdAdulto, qtdCrianca, distUrgencia);
  },

  renderCharts: (qtdAdulto, qtdCrianca, urgData) => {
    const ctxPerfil = document.getElementById('chartPerfil').getContext('2d');
    const ctxUrg = document.getElementById('chartUrgencia').getContext('2d');

    if (Dashboard.charts.perfil) Dashboard.charts.perfil.destroy();
    if (Dashboard.charts.urgencia) Dashboard.charts.urgencia.destroy();

    Dashboard.charts.perfil = new Chart(ctxPerfil, {
      type: 'doughnut',
      data: { labels: ['Adultos', 'Crianças'], datasets: [{ data: [qtdAdulto, qtdCrianca], backgroundColor: ['#3b82f6', '#a855f7'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    Dashboard.charts.urgencia = new Chart(ctxUrg, {
      type: 'bar',
      data: { labels: ['ALTA', 'MÉDIA', 'BAIXA'], datasets: [{ label: 'Atendimentos', data: [urgData['ALTA'], urgData['MÉDIA'], urgData['BAIXA']], backgroundColor: ['#ef4444', '#eab308', '#22c55e'], borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  },

  deletarRegistro: (id) => {
    if(confirm('Apagar registro permanentemente?')) {
      let db = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
      localStorage.setItem(DB_KEY, JSON.stringify(db.filter(p => p.id !== id)));
      Dashboard.render();
    }
  }
};

// 5. CONTROLADOR PRINCIPAL (SPA)
const App = {
  currentUser: null,
  init: () => {
    if(!localStorage.getItem(SCHEMA_KEY)) FormEngine.saveSchemas(defaultSchemas);
    document.getElementById('formTriagemDinamico').addEventListener('submit', FormEngine.handleTriagemSubmit);
    FormEngine.initTriagem(); FormEngine.initAdmin(); Dashboard.init(); UserAdmin.init(); Auth.init();
  },
  startSession: () => {
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('header-user-info').innerText = `Logado como: ${Utils.escapeHTML(App.currentUser.username.toUpperCase())}`;
    const v = App.currentUser.role === 'voluntario';
    document.getElementById('nav-dashboard').classList.toggle('hidden', v);
    document.getElementById('nav-formAdmin').classList.toggle('hidden', v);
    document.getElementById('nav-userAdmin').classList.toggle('hidden', v);
    FormEngine.renderTriagemForm();
    if(!v) { FormEngine.renderSchemaList(); Dashboard.render(); UserAdmin.renderList(); }
    App.navigate('triagem');
  },
  navigate: (viewId) => {
    if(!App.currentUser && viewId !== 'login') return App.navigate('login');
    if(App.currentUser && viewId === 'login') return App.navigate('triagem');
    if(App.currentUser?.role === 'voluntario' && ['dashboard', 'formAdmin', 'userAdmin'].includes(viewId)) return App.navigate('triagem');
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    if (viewId === 'dashboard') { setTimeout(() => Dashboard.render(), 100); }
  }
};

// Inicialização
document.addEventListener('DOMContentLoaded', App.init);