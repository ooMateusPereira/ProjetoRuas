// ui.js
const UI = {
  container: document.getElementById('listaRegistros'),

  renderizarLista: function() {
    const registros = Database.listarTodos();
    
    if (registros.length === 0) {
      this.container.innerHTML = '<p class="text-center text-emerald-600 text-sm mt-4">Nenhum atendimento registrado hoje.</p>';
      return;
    }

    registros.reverse();

    const html = registros.map(r => {
      const nome = Utils.escaparHtml(r.nome);
      const idadeStr = r.idade ? `${Utils.escaparHtml(r.idade)} anos` : 'Idade não informada';
      const queixa = Utils.escaparHtml(r.queixa) || 'Nenhuma queixa registrada';
      const urgencia = Utils.calcUrgencia(r.queixa);
      const corUrgencia = Utils.obterCorUrgencia(urgencia);

      return `
        <div class="p-4 rounded-lg border shadow-sm relative ${corUrgencia}">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h3 class="font-bold font-display">${nome}</h3>
              <p class="text-xs opacity-80">${idadeStr} • ${r.data} • Tempo de rua: ${r.tempoRua}</p>
            </div>
            <button onclick="App.deletarRegistro('${r.id}')" class="text-red-500 hover:text-red-700 font-bold px-2">X</button>
          </div>
          <p class="text-sm bg-white bg-opacity-50 p-2 rounded"><strong>Queixa:</strong> ${queixa}</p>
          <div class="mt-2 text-xs font-bold tracking-wide">
            URGÊNCIA: ${urgencia}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = html;
  }
};