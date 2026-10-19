import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useEstado } from "../estado/useEstado.js";
import {
  buscarPorId,
  contarNaoLidas,
  estaResolvida,
  nomeDaConversa,
  nomeDoAutor,
  resumoDaMensagem,
  ultimaMensagem,
} from "../utilidades/conversas.js";
import { formatarDia, formatarHoraMensagem } from "../utilidades/datas.js";
import Avatar from "./Avatar.jsx";

/* Cartão que aparece ao passar o mouse numa conversa:
   mostra por inteiro o que a lista mostra cortado.
   Props: conversaId e caixa (a posição do item na tela) */
export default function CartaoPrevia({ conversaId, caixa }) {
  const { estado } = useEstado();
  const cartao = useRef(null);

  /* Posição: ao lado da lista, na altura do item, sem sair da tela.
     Para isso precisamos da ALTURA do cartão, que só existe depois de
     desenhado. useLayoutEffect roda logo após o React montar o HTML e
     ANTES de o navegador pintar a tela: o cartão já aparece no lugar certo,
     sem "pular". Mexemos direto no DOM (style), que é algo de fora do React */
  useLayoutEffect(() => {
    const el = cartao.current;
    const topo = Math.min(caixa.top, window.innerHeight - el.offsetHeight - 12);
    el.style.left = `${caixa.right + 10}px`;
    el.style.top = `${Math.max(12, topo)}px`;
  }, [caixa]);

  const conversa = buscarPorId(estado.conversas, conversaId);
  if (!conversa) return null;

  const nome = nomeDaConversa(conversa, estado.contatos);
  const detalhe =
    conversa.tipo === "grupo"
      ? conversa.participantes.join(", ")
      : buscarPorId(estado.contatos, conversa.contatoId)?.numero || "";
  const resolvida = estaResolvida(conversa);
  const etiquetas = (conversa.etiquetas || []).map((id) => buscarPorId(estado.etiquetas, id)).filter(Boolean);
  const msg = ultimaMensagem(conversa);
  const atendente = buscarPorId(estado.atendentes, conversa.atendenteId);
  const naoLidas = contarNaoLidas(conversa);

  let autor = "";
  if (msg) {
    autor =
      msg.tipo === "nota"
        ? `📝 Nota interna · ${buscarPorId(estado.atendentes, msg.autor)?.nome || "Equipe"}`
        : nomeDoAutor(msg, conversa, estado);
  }

  /* createPortal: o cartão é desenhado direto no <body>, fora da coluna.
     Ele continua sendo "filho" deste componente para o React (lê o estado,
     some junto), mas no HTML fica por cima de tudo, sem ser cortado
     pelo overflow da lista */
  return createPortal(
    <div className="cartao-previa" ref={cartao} aria-hidden="true">
      <div className="cartao-previa__topo">
        <Avatar nome={nome} grupo={conversa.tipo === "grupo"} />
        <div className="cartao-previa__textos">
          <div className="cartao-previa__nome">{nome}</div>
          <div className="cartao-previa__detalhe">{detalhe}</div>
        </div>
      </div>

      {(resolvida || !conversa.atendenteId || etiquetas.length > 0) && (
        <div className="cartao-previa__selos">
          {resolvida && <span className="selo selo--resolvida">✓ Resolvida</span>}
          {!resolvida && !conversa.atendenteId && <span className="selo">Sem atendente</span>}
          {/* Aqui cabem TODAS as etiquetas (na lista, só 2) */}
          {etiquetas.map((e) => (
            <span key={e.id} className="etiqueta" style={{ "--cor-etiqueta": e.cor }}>
              {e.nome}
            </span>
          ))}
        </div>
      )}

      <div className="cartao-previa__mensagem">
        {msg ? (
          <>
            <div className="cartao-previa__autor">{autor}</div>
            <div className="cartao-previa__texto">{resumoDaMensagem(msg)}</div>
            <div className="cartao-previa__hora">
              {formatarDia(msg.horario)}, {formatarHoraMensagem(msg.horario)}
            </div>
          </>
        ) : (
          <div className="cartao-previa__texto">Nenhuma mensagem ainda</div>
        )}
      </div>

      <div className="cartao-previa__rodape">
        <span>{atendente ? `Atendente: ${atendente.nome}` : "Na fila"}</span>
        {naoLidas > 0 && (
          <span className="cartao-previa__pendente">
            {naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}
          </span>
        )}
      </div>
    </div>,
    document.body
  );
}
