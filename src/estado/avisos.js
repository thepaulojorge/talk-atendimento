/* Atalho para mostrar o aviso flutuante:
     avisar(despachar, "Mensagem enviada");
   O id (o horário em milissegundos) serve para o aviso saber se,
   quando o tempo dele acabar, ainda é ele que está na tela */
export function avisar(despachar, texto) {
  despachar({ tipo: "mostrarAviso", id: Date.now(), texto });
}
