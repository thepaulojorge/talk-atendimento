import { TURNOS } from "../configuracao.js";
import { buscarPorId } from "./conversas.js";

/* Qual turno é agora? Recebe uma data (o "agora" vem de fora:
   assim a função fica pura e fácil de testar com qualquer horário) */
export function turnoDe(data) {
  const hora = data.getHours();
  return TURNOS.find((t) =>
    t.inicio < t.fim
      ? hora >= t.inicio && hora < t.fim // turno normal: 6h às 14h
      : hora >= t.inicio || hora < t.fim // passa da meia-noite: 22h às 6h
  );
}

// "Estação 01 · Manhã" (ou só o nome, para contas pessoais)
export function descreverSessao(sessao, estado) {
  if (!sessao?.estacaoId) return "";
  const estacao = buscarPorId(estado.estacoes, sessao.estacaoId);
  const turno = TURNOS.find((t) => t.id === sessao.turnoId);
  return [estacao?.nome, turno && `Turno da ${turno.nome.toLowerCase()}`].filter(Boolean).join(" · ");
}
