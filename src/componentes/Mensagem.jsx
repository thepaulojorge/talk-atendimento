import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { buscarPorId, nomeDoAutor, resumoDaMensagem } from "../utilidades/conversas.js";
import { formatarHoraMensagem } from "../utilidades/datas.js";
import { podeVerAuditoria } from "../utilidades/permissoes.js";
import { formatarDuracao } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";

/* Um balão de mensagem: texto, áudio, nota interna ou apagada.
   Props:
   - msg, conversa: os dados
   - destacada: true quando alguém clicou numa citação desta mensagem
   - aoResponder(id), aoIrPara(id): o que fazer nos cliques (quem decide é o pai) */
export default function Mensagem({ msg, conversa, destacada, aoResponder, aoIrPara }) {
  const { estado, despachar } = useEstado();
  const supervisao = podeVerAuditoria(estado);
  const classeBase = `mensagem mensagem--${msg.direcao}${destacada ? " mensagem--destaque" : ""}`;

  /* ---------- Apagada (soft delete): só o aviso de quem apagou ---------- */
  if (msg.apagada) {
    const quem =
      msg.apagadaPor === estado.atendenteLogadoId
        ? "Você apagou esta mensagem"
        : `Mensagem apagada por ${buscarPorId(estado.atendentes, msg.apagadaPor)?.nome || "Equipe"}`;
    const conteudoOriginal = msg.tipo === "audio" ? `🎤 Áudio de ${formatarDuracao(msg.duracao)}` : msg.texto;

    return (
      <div className={`${classeBase} mensagem--apagada${msg.tipo === "nota" ? " mensagem--nota" : ""}`} data-id={msg.id}>
        <div className="mensagem__texto">🚫 {quem}</div>
        {/* Só supervisão e diretoria veem o que foi apagado */}
        {supervisao && <div className="mensagem__original">{conteudoOriginal}</div>}
        <Rodape msg={msg} />
      </div>
    );
  }

  /* ---------- Nota interna: amarela, sem ↩ e sem ✓✓ ---------- */
  if (msg.tipo === "nota") {
    return (
      <div className={`${classeBase} mensagem--nota`} data-id={msg.id}>
        <div className="mensagem__autor">📝 Nota interna · {nomeDoAutor(msg, conversa, estado)}</div>
        <div className="mensagem__texto">{msg.texto}</div>
        <Rodape msg={msg} supervisao={supervisao} />
      </div>
    );
  }

  /* ---------- Mensagem normal ---------- */
  // Quem falou: participante do grupo, ou OUTRO atendente (útil com vários logins)
  let autor = null;
  if (msg.direcao === "recebida" && conversa.tipo === "grupo" && msg.autor) autor = msg.autor;
  if (msg.direcao === "enviada" && msg.autor !== estado.atendenteLogadoId) autor = nomeDoAutor(msg, conversa, estado);

  const original = msg.respostaA ? conversa.mensagens.find((m) => m.id === msg.respostaA) : null;

  return (
    <div className={classeBase} data-id={msg.id}>
      <button
        type="button"
        className="mensagem__responder"
        aria-label="Responder esta mensagem"
        onClick={() => aoResponder(msg.id)}
      >
        <Icone nome="responder" />
      </button>

      {autor && <div className="mensagem__autor">{autor}</div>}

      {original && (
        <Citacao autor={nomeDoAutor(original, conversa, estado)} texto={resumoDaMensagem(original)} aoClicar={() => aoIrPara(original.id)} />
      )}

      {msg.tipo === "audio" ? (
        <div className="audio">
          <button
            type="button"
            className="audio__play"
            aria-label="Reproduzir áudio"
            onClick={() => avisar(despachar, "A reprodução de áudio chega na etapa 2b 🎧")}
          >
            <Icone nome="tocar" />
          </button>
          <div className="audio__barra">
            <div className="audio__progresso" />
          </div>
          <span className="audio__duracao">{formatarDuracao(msg.duracao)}</span>
        </div>
      ) : (
        <div className="mensagem__texto">{msg.texto}</div>
      )}

      <Rodape msg={msg} supervisao={supervisao} />
    </div>
  );
}

/* O quadrinho com borda que mostra a mensagem citada.
   "export": a barra "Respondendo a..." do campo de envio também usa */
export function Citacao({ autor, texto, aoClicar }) {
  return (
    <div className="citacao" onClick={aoClicar} role={aoClicar ? "button" : undefined}>
      <div className="citacao__autor">{autor}</div>
      <div className="citacao__texto">{texto}</div>
    </div>
  );
}

/* Rodapé: "editada" + hora + ✓✓ (só nas enviadas).
   Um componente pequeno, usado nos três tipos de balão */
function Rodape({ msg, supervisao = false }) {
  const original = msg.versoesAnteriores?.[0];
  return (
    <div className="mensagem__rodape">
      {msg.editadaEm && (
        // O texto original aparece ao passar o mouse, só para a supervisão
        <span className="mensagem__editada" title={supervisao && original ? `Original: ${original}` : undefined}>
          editada
        </span>
      )}
      <span className="mensagem__hora">{formatarHoraMensagem(msg.horario)}</span>
      {msg.direcao === "enviada" && !msg.apagada && (
        <span
          className={`mensagem__status${msg.lida ? " mensagem__status--lida" : ""}`}
          aria-label={msg.lida ? "Lida" : "Entregue"}
        >
          ✓✓
        </span>
      )}
    </div>
  );
}
