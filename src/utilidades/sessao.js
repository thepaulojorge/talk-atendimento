import { buscarPorId } from "./conversas.js";
import { PAPEIS, papelDe } from "./permissoes.js";
import { formatarNumero } from "./texto.js";
import { TURNOS } from "../configuracao.js";

/* O que mostrar ao lado do nome de quem está logado:
   - numa estação: o turno e o número de WhatsApp dela ("Tarde · +55 21 99000-0001")
   - supervisão e diretoria: o papel ("Supervisão")
   (O nome em si já é o da estação: "Estação 01") */
export function descreverSessao(estado) {
  const estacaoId = estado.sessao?.estacaoId;
  if (estacaoId) {
    const linha = estado.linhas.find((l) => l.estacaoId === estacaoId);
    // O turno vem do servidor, pelo horário do login
    const turno = TURNOS.find((t) => t.id === estado.sessao?.turnoId)?.nome;
    const numero = linha ? formatarNumero(linha.numero) : buscarPorId(estado.estacoes, estacaoId)?.nome || "";
    return [turno && `Turno da ${turno.toLowerCase()}`, numero].filter(Boolean).join(" · ");
  }
  return PAPEIS[papelDe(estado, estado.atendenteLogadoId)];
}
