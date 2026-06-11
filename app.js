// app.js
const App = {
  iniciar: function() {
    
    const form = document.getElementById('formTriagem');
    form.addEventListener('submit', this.salvarRegistro.bind(this));

    
    UI.renderizarLista();
  },

  salvarRegistro: function(evento) {
    evento.preventDefault(); 

   
    const dados = {
      nome: document.getElementById('nome').value,
      idade: document.getElementById('idade').value,
      tempoRua: document.getElementById('tempoRua').value,
      queixa: document.getElementById('queixa').value
    };

    
    Database.salvar(dados);

    document.getElementById('formTriagem').reset();
    UI.renderizarLista();
    
    alert('Atendimento registrado com sucesso!');
  },

  
  deletarRegistro: function(id) {
    if(confirm('Tem certeza que deseja apagar este registro?')) {
      Database.deletar(id);
      UI.renderizarLista();
    }
  }
};

App.iniciar();