import { useEffect, useRef } from "react";
import { formatarDia } from "../utilidades/datas.js";
import Mensagem from "./Mensagem.jsx";

/* Todas as mensagens da conversa, com o separador quando o dia muda */
export default function ListaMensagens({ conversa, destacadaId, menuMsgId, aoResponder, aoIrPara, aoAbrirMenu, aoRolar }) {
  /* useRef: uma "caixinha" que guarda uma referência ao elemento de verdade
     na página (o <div> das mensagens). Precisamos dele para mexer na rolagem,
     algo que o JSX sozinho não faz */
  const caixa = useRef(null);

  // Rola até o fim ao abrir a conversa e sempre que chegar mensagem nova
  useEffect(() => {
    const el = caixa.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversa.id, conversa.mensagens.length]);

  // Clicou numa citação: rola até a mensagem original
  useEffect(() => {
    if (!destacadaId) return;
    caixa.current
      ?.querySelector(`[data-id="${destacadaId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [destacadaId]);

  if (conversa.mensagens.length === 0) {
    return (
      <div className="chat__mensagens" ref={caixa}>
        <div className="dia">Nenhuma mensagem ainda. Escreva abaixo para começar 👋</div>
      </div>
    );
  }

  /* Monta a lista de elementos: sempre que o dia muda, entra um separador.
     Cada elemento precisa de uma "key" única */
  const itens = [];
  let diaAnterior = null;

  conversa.mensagens.forEach((msg) => {
    const dia = new Date(msg.horario).toDateString();
    if (dia !== diaAnterior) {
      itens.push(
        <div key={`dia-${msg.id}`} className="dia">
          {formatarDia(msg.horario)}
        </div>
      );
      diaAnterior = dia;
    }

    if (msg.tipo === "sistema") {
      itens.push(
        <div key={msg.id} className="evento">
          {msg.texto}
        </div>
      );
    } else {
      itens.push(
        <Mensagem
          key={msg.id}
          msg={msg}
          conversa={conversa}
          destacada={msg.id === destacadaId}
          selecionada={msg.id === menuMsgId}
          aoResponder={aoResponder}
          aoIrPara={aoIrPara}
          aoAbrirMenu={aoAbrirMenu}
        />
      );
    }
  });

  return (
    // Rolou a conversa: o menu aberto fecha (ele ficaria "boiando" no lugar errado)
    <div className="chat__mensagens" ref={caixa} aria-live="polite" onScroll={aoRolar}>
      {itens}
    </div>
  );
}
