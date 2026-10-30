/* Configurações gerais do app.

   MARCA (white-label): o nome que aparece no topo, no login e no título
   da aba. "Talk Atendimento" é o padrão; a diretoria pode trocar pelo
   nome da empresa na tela de Configurações. */
export const MARCA_PADRAO = {
  nome: "Talk Atendimento",
};

// Quantas conversas podem ficar fixadas no topo ao mesmo tempo
export const LIMITE_FIXADAS = 3;

/* Os 3 turnos do dia. "fim" é exclusivo: às 14:00 já é a tarde.
   O turno da noite passa da meia-noite (23h às 7h) */
export const TURNOS = [
  { id: "manha", nome: "Manhã", inicio: 7, fim: 15 },
  { id: "tarde", nome: "Tarde", inicio: 15, fim: 23 },
  { id: "noite", nome: "Noite", inicio: 23, fim: 7 },
];
