import { useEstado } from "../estado/useEstado.js";
import { useMenuDeContexto } from "../hooks/useMenuDeContexto.js";
import { buscarPorId, conteudoParaRegistro, nomeDoAutor, resumoDaMensagem } from "../utilidades/conversas.js";
import { formatarHoraMensagem } from "../utilidades/datas.js";
import { podeVerAuditoria } from "../utilidades/permissoes.js";
import Icone from "./Icone.jsx";
import BalaoAudio from "./BalaoAudio.jsx";
import BalaoArquivo from "./BalaoArquivo.jsx";

/* Um balão de mensagem: texto, áudio, arquivo, nota interna ou apagada.
   Props:
   - msg, conversa: os dados
   - destacada: true quando alguém clicou numa citação desta mensagem
   - selecionada: true enquanto o menu desta mensagem está aberto
   - aoResponder(id), aoIrPara(id), aoAbrirMenu(id, posicao):
     o que fazer em cada gesto (quem decide é o pai) */
export default function Mensagem({ msg, conversa, destacada, selecionada, aoResponder, aoIrPara, aoAbrirMenu }) {
  const { estado } = useEstado();
  const supervisao = podeVerAuditoria(estado);

  /* Botão direito ou dedo pressionado: os eventos vêm prontos do hook.
     Hooks sempre no TOPO do componente, antes de qualquer "return":
     o React conta com eles sendo chamados sempre na mesma ordem */
  const eventosMenu = useMenuDeContexto((posicao) => aoAbrirMenu(msg.id, posicao));

  const classeBase = [
    "mensagem",
    `mensagem--${msg.direcao}`,
    destacada && "mensagem--destaque",
    selecionada && "mensagem--selecionada",
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------- Apagada (soft delete): só o aviso de quem apagou ---------- */
  if (msg.apagada) {
    const quem =
      msg.apagadaPor === estado.atendenteLogadoId
        ? "Você apagou esta mensagem"
        : `Mensagem apagada por ${buscarPorId(estado.atendentes, msg.apagadaPor)?.nome || "Equipe"}`;
    const conteudoOriginal = conteudoParaRegistro(msg);

    return (
      <div className={`${classeBase} mensagem--apagada${msg.tipo === "nota" ? " mensagem--nota" : ""}`} data-id={msg.id} {...eventosMenu}>
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
      <div className={`${classeBase} mensagem--nota`} data-id={msg.id} {...eventosMenu}>
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
    // {...eventosMenu} "espalha" os eventos do hook: onContextMenu, onPointerDown...
    <div className={classeBase} data-id={msg.id} {...eventosMenu}>
      <button
        type="button"
        className="mensagem__responder"
        aria-label="Responder esta mensagem"
        onClick={() => aoResponder(msg.id)}
      >
        <Icone nome="responder" />
      </button>

      {autor && <div className="mensagem__autor">{autor}</div>}

      {msg.encaminhada && (
        <div className="mensagem__encaminhada">
          <Icone nome="encaminhar" /> Encaminhada
        </div>
      )}

      {original && (
        <Citacao autor={nomeDoAutor(original, conversa, estado)} texto={resumoDaMensagem(original)} aoClicar={() => aoIrPara(original.id)} />
      )}

      {msg.tipo === "audio" && <BalaoAudio msg={msg} />}
      {msg.tipo === "arquivo" && <BalaoArquivo arquivo={msg.arquivo} />}
      {/* A legenda de uma foto ou documento (vem do WhatsApp) */}
      {msg.tipo === "arquivo" && msg.texto && <div className="mensagem__texto">{msg.texto}</div>}
      {msg.tipo !== "audio" && msg.tipo !== "arquivo" && <div className="mensagem__texto">{msg.texto}</div>}

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
      {/* B7: o WhatsApp recusou a entrega? O motivo aparece no lugar dos ✓✓ */}
      {msg.erroEnvio && (
        <span className="mensagem__falhou" title={msg.erroEnvio}>
          ⚠ Não entregue
        </span>
      )}
      <span className="mensagem__hora">{formatarHoraMensagem(msg.horario)}</span>
      {msg.direcao === "enviada" && !msg.apagada && !msg.erroEnvio && (
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
