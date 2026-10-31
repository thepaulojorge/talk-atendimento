/* Configurações gerais do app.

   MARCA (white-label): o nome que aparece no topo, no login e no título
   da aba. "Talk Atendimento" é o padrão; a diretoria pode trocar pelo
   nome da empresa na tela de Configurações. */
export const MARCA_PADRAO = {
  nome: "Talk Atendimento",
};

// Quantas conversas podem ficar fixadas no topo ao mesmo tempo
export const LIMITE_FIXADAS = 3;

/* ALERTA DE ESPERA: a conversa com mensagem não lida há este tanto de
   minutos (ou mais) fica com a bolinha de não lidas VERMELHA. Conta a
   partir da mensagem não lida MAIS ANTIGA: o cliente que escreveu às
   10h00 e de novo às 10h09 está esperando desde as 10h00 */
export const LIMITE_ESPERA_MIN = 10;

/* Os 3 turnos (os horários da empresa), os mesmos do servidor.
   Quem calcula o turno de cada login é o SERVIDOR; aqui eles só servem
   para mostrar os nomes ("Tarde") e os horários nos filtros */
export const TURNOS = [
  { id: "manha", nome: "Manhã", inicio: 7, fim: 15 },
  { id: "tarde", nome: "Tarde", inicio: 15, fim: 23 },
  { id: "noite", nome: "Noite", inicio: 23, fim: 7 },
];

