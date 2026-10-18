import { useEffect, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { buscarPorId, contarTotalNaoLidas, estaResolvida, nomeDaConversa } from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import ListaMensagens from "./ListaMensagens.jsx";
import CampoEnvio from "./CampoEnvio.jsx";

/* Coluna do meio: a tela vazia ou a conversa aberta.
   Antes: esconder e mostrar seções com "hidden".
   Agora: o componente simplesmente DEVOLVE uma coisa ou a outra */
export default function Chat() {
  const { estado } = useEstado();
  const conversa = buscarPorId(estado.conversas, estado.conversaAbertaId);

  return (
    <main className="chat">
      {/* key={conversa.id}: trocou de conversa, o React trata como OUTRO
          componente e começa do zero. Assim a citação e o destaque de uma
          conversa não "vazam" para a outra, sem nenhum código de limpeza */}
      {conversa ? <ChatAberto key={conversa.id} conversa={conversa} /> : <ChatVazio />}
    </main>
  );
}

/* Tela "Nenhuma conversa aberta", com o resumo das pendências */
function ChatVazio() {
  const { estado } = useEstado();
  const naoLidas = contarTotalNaoLidas(estado.conversas);
  const naFila = estado.conversas.filter(
    (c) => !c.atendenteId && !estaResolvida(c) && !c.arquivada && c.mensagens.length > 0
  ).length;

  const partes = [];
  if (naoLidas > 0) partes.push(`${naoLidas} ${naoLidas === 1 ? "mensagem não lida" : "mensagens não lidas"}`);
  if (naFila > 0) partes.push(`${naFila} ${naFila === 1 ? "conversa na fila" : "conversas na fila"}`);

  return (
    <section className="chat__vazio">
      <div className="vazio">
        <div className="vazio__icone">
          <Icone nome="mensagem" />
        </div>
        <h2 className="vazio__titulo">Nenhuma conversa aberta</h2>
        <p className="vazio__texto">Escolha uma conversa na lista ao lado.</p>
        <p className="vazio__resumo" aria-live="polite">
          {partes.length > 0 ? partes.join(" · ") : "Tudo em dia por aqui ✓"}
        </p>
        <p className="vazio__dica">
          <kbd>Esc</kbd> fecha a conversa aberta
        </p>
      </div>
    </section>
  );
}

/* A conversa aberta: topo, mensagens e campo de envio */
function ChatAberto({ conversa }) {
  const { estado, despachar } = useEstado();

  // Estado local desta conversa (zera sozinho ao trocar, por causa da key)
  const [respondendoAId, setRespondendoAId] = useState(null);
  const [destacadaId, setDestacadaId] = useState(null);

  const respondendoA = respondendoAId ? conversa.mensagens.find((m) => m.id === respondendoAId) : null;

  // O destaque (a mensagem "pisca") some depois da animação
  useEffect(() => {
    if (!destacadaId) return;
    const temporizador = setTimeout(() => setDestacadaId(null), 1600);
    return () => clearTimeout(temporizador);
  }, [destacadaId]);

  /* Esc fecha a conversa (menos quando se está digitando num campo FORA
     do chat, como a busca, que tem um Esc próprio).
     Um ouvinte no document inteiro, criado ao abrir e removido ao fechar */
  useEffect(() => {
    function aoApertarTecla(evento) {
      if (evento.key !== "Escape") return;
      const ativo = document.activeElement;
      const digitandoForaDoChat = ativo?.matches("input, textarea, select") && !ativo.closest(".chat");
      if (!digitandoForaDoChat) despachar({ tipo: "fecharConversa" });
    }
    document.addEventListener("keydown", aoApertarTecla);
    return () => document.removeEventListener("keydown", aoApertarTecla);
  }, [despachar]);

  const nome = nomeDaConversa(conversa, estado.contatos);
  const atendente = buscarPorId(estado.atendentes, conversa.atendenteId);
  const responsavel = atendente ? `Atendente: ${atendente.nome}` : "Sem atendente";
  const detalhe =
    conversa.tipo === "grupo"
      ? conversa.participantes.join(", ")
      : buscarPorId(estado.contatos, conversa.contatoId)?.numero || "";
  const etiquetas = (conversa.etiquetas || []).map((id) => buscarPorId(estado.etiquetas, id)).filter(Boolean);

  return (
    <section className="chat__aberto">
      <header className="chat__topo">
        {/* Só aparece no celular (o CSS cuida disso) */}
        <button
          type="button"
          className="chat__voltar"
          aria-label="Voltar para conversas"
          onClick={() => despachar({ tipo: "fecharConversa" })}
        >
          <Icone nome="voltar" />
        </button>
        <Avatar nome={nome} grupo={conversa.tipo === "grupo"} />
        <div className="chat__info">
          <div className="chat__linha-nome">
            <h1 className="chat__nome">{nome}</h1>
            <div className="chat__etiquetas">
              {etiquetas.map((etiqueta) => (
                <span key={etiqueta.id} className="etiqueta" style={{ "--cor-etiqueta": etiqueta.cor }}>
                  {etiqueta.nome}
                </span>
              ))}
            </div>
          </div>
          <p className="chat__detalhe">
            {detalhe} · {responsavel}
          </p>
        </div>
      </header>

      <ListaMensagens
        conversa={conversa}
        destacadaId={destacadaId}
        aoResponder={setRespondendoAId}
        aoIrPara={setDestacadaId}
      />

      <CampoEnvio
        conversa={conversa}
        respondendoA={respondendoA}
        aoCancelarCitacao={() => setRespondendoAId(null)}
      />
    </section>
  );
}
