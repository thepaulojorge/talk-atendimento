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

/* ---------- Ações nas mensagens ----------
   Só quem escreveu edita ou apaga. Áudio não se edita (só se apaga) */
export function podeEditarMensagem(estado, msg) {
  return (
    !msg.apagada &&
    msg.autor === estado.atendenteLogadoId &&
    ((msg.direcao === "enviada" && msg.tipo === "texto") || msg.tipo === "nota")
  );
}

export function podeApagarMensagem(estado, msg) {
  return !msg.apagada && msg.autor === estado.atendenteLogadoId && (msg.direcao === "enviada" || msg.tipo === "nota");
}

/* Encaminhar: texto, áudio e arquivo, de qualquer pessoa.
   Nota interna NUNCA: ela é da equipe e iria parar no cliente */
export function podeEncaminhar(msg) {
  // Áudio e arquivo só com o arquivo de verdade (os áudios de exemplo não têm)
  return !msg.apagada && (msg.tipo === "texto" || ((msg.tipo === "audio" || msg.tipo === "arquivo") && Boolean(msg.arquivo)));
}

// Configurações (estações e números): supervisão e diretoria
export function podeConfigurar(estado) {
  return ["supervisor", "diretoria"].includes(papelDe(estado, estado.atendenteLogadoId));
}

// O nome da empresa e "Restaurar dados de exemplo": só a diretoria
export function ehDiretoria(estado) {
  return papelDe(estado, estado.atendenteLogadoId) === "diretoria";
}
