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
   O turno da noite passa da meia-noite (22h às 6h) */
export const TURNOS = [
  { id: "manha", nome: "Manhã", inicio: 6, fim: 14 },
  { id: "tarde", nome: "Tarde", inicio: 14, fim: 22 },
  { id: "noite", nome: "Noite", inicio: 22, fim: 6 },
];

/* Modo demonstração (portfólio): mostra o botão "Entrar na demonstração"
   na tela de login, para quem visita o site conseguir entrar sem senha.
   Com o backend e os logins de verdade, mude para false */
export const MODO_DEMONSTRACAO = true;
