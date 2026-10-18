/* Regras de permissão num lugar só. Quando o login de verdade existir
   (com o backend), as mesmas regras também serão conferidas no servidor */
import { buscarPorId } from "./conversas.js";

export const PAPEIS = {
  atendente: "Atendente",
  supervisor: "Supervisão",
  diretoria: "Diretoria",
};

export function papelDe(estado, atendenteId) {
  return buscarPorId(estado.atendentes, atendenteId)?.papel || "atendente";
}

// Supervisão e diretoria veem o conteúdo original de mensagens editadas e apagadas
export function podeVerAuditoria(estado) {
  return ["supervisor", "diretoria"].includes(papelDe(estado, estado.atendenteLogadoId));
}
