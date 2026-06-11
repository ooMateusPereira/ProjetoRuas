// database.js
const DB_KEY = 'cadastro_ruas_db';

const Database = {
  listarTodos: function() {
    const dados = localStorage.getItem(DB_KEY);
    return dados ? JSON.parse(dados) : [];
  },

  salvar: function(novoRegistro) {
    const registros = this.listarTodos();
    novoRegistro.id = Date.now().toString();
    novoRegistro.data = new Date().toLocaleDateString('pt-BR');
    
    registros.push(novoRegistro);
    localStorage.setItem(DB_KEY, JSON.stringify(registros));
    return novoRegistro;
  },

  deletar: function(id) {
    let registros = this.listarTodos();
    registros = registros.filter(registro => registro.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(registros));
  }
};