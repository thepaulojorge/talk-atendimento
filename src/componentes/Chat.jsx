import { useEstado } from "../estado/useEstado.js";
import { buscarPorId, contarTotalNaoLidas, estaResolvida, nomeDaConversa } from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Coluna do meio: a tela vazia ou a conversa aberta.
   Antes: esconder e mostrar seções com "hidden".
   Agora: o componente simplesmente DEVOLVE uma coisa ou a outra */
export default function Chat() {
  const { estado } = useEstado();
  const conversa = buscarPorId(estado.conversas, estado.conversaAbertaId);

  return <main className="chat">{conversa ? <ChatAberto conversa={conversa} /> : <ChatVazio />}</main>;
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
      </div>
    </section>
  );
}

/* A conversa aberta. Nesta etapa só o topo; as mensagens chegam na etapa 2 */
function ChatAberto({ conversa }) {
  const { estado, despachar } = useEstado();
  const nome = nomeDaConversa(conversa, estado.contatos);
  const atendente = buscarPorId(estado.atendentes, conversa.atendenteId);
  const responsavel = atendente ? `Atendente: ${atendente.nome}` : "Sem atendente";
  const detalhe =
    conversa.tipo === "grupo"
      ? conversa.participantes.join(", ")
      : buscarPorId(estado.contatos, conversa.contatoId)?.numero || "";

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
          </div>
          <p className="chat__detalhe">
            {detalhe} · {responsavel}
          </p>
        </div>
      </header>

      <div className="chat__mensagens">
        <div className="dia">As mensagens chegam na etapa 2 da migração 🚧</div>
      </div>
    </section>
  );
}
