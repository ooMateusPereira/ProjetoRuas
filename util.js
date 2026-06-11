// utils.js
const Utils = {
  calcUrgencia: function(queixa) {
    const texto = queixa.toLowerCase();
    if (texto.includes('dor no peito') || texto.includes('falta de ar') || texto.includes('sangramento')) {
      return 'ALTA';
    }
    if (texto.includes('febre') || texto.includes('tosse') || texto.includes('dor')) {
      return 'MÉDIA';
    }
    return 'BAIXA';
  },

  obterCorUrgencia: function(urgencia) {
    switch(urgencia) {
      case 'ALTA': return 'bg-red-100 border-red-300 text-red-800';
      case 'MÉDIA': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'BAIXA': return 'bg-green-100 border-green-300 text-green-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  },

  escaparHtml: function(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
};