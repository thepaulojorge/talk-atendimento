import { useCallback, useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { usePlayer } from "../audio/usePlayer.js";
import { useAcoesConversa } from "../hooks/useAcoesConversa.jsx";
import { novoId } from "../utilidades/ids.js";
import { podeApagarMensagem, podeEditarMensagem, podeEncaminhar } from "../utilidades/permissoes.js";
import {
  buscarPorId,
  contarTotalNaoLidas,
  estaResolvida,
  nomeDaConversa,
  resumoDaMensagem,
} from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import ListaMensagens from "./ListaMensagens.jsx";
import CampoEnvio from "./CampoEnvio.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";
import DialogoConfirmacao from "./DialogoConfirmacao.jsx";
import DialogoEncaminhar from "./DialogoEncaminhar.jsx";

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
  /* Destaque: começa com a mensagem pedida pela supervisão (se houver).
     useState com função: lido UMA vez, quando a conversa abre */
  const [destacadaId, setDestacadaId] = useState(() => estado.mensagemEmFoco);

  /* Menu e ações das mensagens. Guardamos só os IDs: a mensagem em si
     é buscada na hora, sempre a versão mais nova do estado */
  const [menu, setMenu] = useState(null); // { msgId, x, y, toque }
  const [edicao, setEdicao] = useState(null); // { msgId, texto }
  const [apagandoId, setApagandoId] = useState(null);
  const [encaminhandoId, setEncaminhandoId] = useState(null);
  // Modo nota: o campo escreve para a EQUIPE, não para o cliente
  const [modoNota, setModoNota] = useState(false);
  const player = usePlayer();

  /* Menu ⋮ do topo. A ref do botão serve para duas coisas:
     saber ONDE abrir o menu, e avisar o menu que clicar no botão
     não é "clicar fora" (o botão abre e fecha sozinho) */
  const botaoMenu = useRef(null);
  const [menuTopo, setMenuTopo] = useState(null); // { x, y } ou null
  const fecharMenuTopo = useCallback(() => setMenuTopo(null), []);
  const acoesConversa = useAcoesConversa();

  function alternarMenuTopo() {
    if (menuTopo) return fecharMenuTopo();
    const caixa = botaoMenu.current.getBoundingClientRect();
    // x na direita do botão: o menu "encosta" na borda e fica dentro da tela
    setMenuTopo({ x: caixa.right, y: caixa.bottom + 4 });
  }

  const acharMsg = (id) => (id ? conversa.mensagens.find((m) => m.id === id) : null);
  const respondendoA = acharMsg(respondendoAId);

  /* useCallback: o MenuFlutuante usa "aoFechar" dentro de um useEffect.
     Sem isso, cada renderização criaria uma função nova e o efeito
     removeria e recolocaria os ouvintes à toa */
  const fecharMenu = useCallback(() => setMenu(null), []);

  // Mesma ideia do menu: a função só existe uma vez
  const abrirMenu = useCallback((msgId, posicao) => setMenu({ msgId, ...posicao }), []);

  /* ---------- As ações ---------- */
  function responder(msg) {
    setEdicao(null); // responder e editar ao mesmo tempo não faz sentido
    setModoNota(false); // a resposta vai para o cliente, então sai do modo nota
    setRespondendoAId(msg.id);
  }

  function copiar(msg) {
    // A área de transferência só funciona em localhost ou HTTPS
    if (!navigator.clipboard) return avisar(despachar, "Não foi possível copiar");
    navigator.clipboard
      .writeText(msg.texto)
      .then(() => avisar(despachar, "Texto copiado"))
      .catch(() => avisar(despachar, "Não foi possível copiar"));
  }

  function alternarNota() {
    // Nota não cita mensagem: ao ligar o modo nota, a citação sai
    if (!modoNota) setRespondendoAId(null);
    setModoNota(!modoNota);
  }

  function comecarEdicao(msg) {
    setRespondendoAId(null);
    setEdicao({ msgId: msg.id, texto: msg.texto });
  }

  function salvarEdicao(texto) {
    despachar({
      tipo: "editarMensagem",
      conversaId: conversa.id,
      mensagemId: edicao.msgId,
      texto,
      agora: new Date().toISOString(),
      auditoriaId: novoId("aud"),
    });
    setEdicao(null);
    avisar(despachar, "Mensagem editada");
  }

  function apagar() {
    const id = apagandoId;
    despachar({
      tipo: "apagarMensagem",
      conversaId: conversa.id,
      mensagemId: id,
      agora: new Date().toISOString(),
      auditoriaId: novoId("aud"),
    });
    // Limpa o que dependia da mensagem: edição, citação e o áudio tocando
    if (edicao?.msgId === id) setEdicao(null);
    if (respondendoAId === id) setRespondendoAId(null);
    if (player.tocandoId === id) player.parar();
    avisar(despachar, "Mensagem apagada");
  }

  function encaminhar(destinoId) {
    const msg = acharMsg(encaminhandoId);
    if (!msg) return;
    // Só o conteúdo viaja: autor, horário e citação são da conversa nova
    // O arquivo não é enviado de novo: a mensagem nova aponta para o MESMO arquivo
    let conteudo = { tipo: "texto", texto: msg.texto, encaminhada: true };
    if (msg.tipo === "audio") conteudo = { tipo: "audio", arquivo: msg.arquivo, duracao: msg.duracao, encaminhada: true };
    if (msg.tipo === "arquivo") conteudo = { tipo: "arquivo", arquivo: msg.arquivo, encaminhada: true };

    despachar({
      tipo: "enviarMensagem",
      conversaId: destinoId,
      id: novoId("m"),
      agora: new Date().toISOString(),
      conteudo,
      limparRascunho: false, // o que estava escrito lá continua lá
    });
    const destino = buscarPorId(estado.conversas, destinoId);
    avisar(despachar, `Encaminhada para ${nomeDaConversa(destino, estado.contatos)}`);
  }

  /* As opções do menu, conforme a mensagem e quem está logado.
     Cada opção que não se aplica simplesmente não entra na lista */
  function opcoesDe(msg) {
    const temTexto = (msg.tipo === "texto" || msg.tipo === "nota") && !msg.apagada;
    return [
      !msg.apagada && msg.tipo !== "nota" && { id: "responder", rotulo: "Responder", icone: "responder", acao: () => responder(msg) },
      temTexto && { id: "copiar", rotulo: "Copiar texto", icone: "copiar", acao: () => copiar(msg) },
      podeEncaminhar(msg) && { id: "encaminhar", rotulo: "Encaminhar", icone: "encaminhar", acao: () => setEncaminhandoId(msg.id) },
      podeEditarMensagem(estado, msg) && { id: "editar", rotulo: "Editar", icone: "lapis", acao: () => comecarEdicao(msg) },
      { divisoria: true },
      podeApagarMensagem(estado, msg) && { id: "apagar", rotulo: "Apagar", icone: "lixeira", perigo: true, acao: () => setApagandoId(msg.id) },
    ].filter(Boolean);
  }

  const msgDoMenu = acharMsg(menu?.msgId);
  // Só divisórias? Então não há nada a oferecer (ex.: mensagem apagada de outra pessoa)
  const opcoesDoMenu = msgDoMenu ? opcoesDe(msgDoMenu) : [];
  const menuAberto = opcoesDoMenu.some((opcao) => !opcao.divisoria);
  const msgApagando = acharMsg(apagandoId);
  const msgEncaminhando = acharMsg(encaminhandoId);

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
      // Uma janela aberta (apagar, encaminhar) usa o Esc para fechar a SI MESMA
      if (document.querySelector("dialog[open]")) return;
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
  // Por qual número da empresa esta conversa acontece (só importa com mais de uma linha)
  const linha = estado.linhas.length > 1 ? buscarPorId(estado.linhas, conversa.linhaId) : null;

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
            {linha && ` · Linha ${linha.sigla}`}
          </p>
        </div>

        <div className="menu">
          <button
            type="button"
            ref={botaoMenu}
            className="menu__botao"
            aria-label="Mais opções"
            aria-haspopup="menu"
            aria-expanded={Boolean(menuTopo)}
            onClick={alternarMenuTopo}
          >
            <Icone nome="mais" />
          </button>
        </div>
      </header>

      <ListaMensagens
        conversa={conversa}
        destacadaId={destacadaId}
        menuMsgId={menuAberto ? menu.msgId : null}
        aoResponder={(id) => responder(acharMsg(id))}
        aoIrPara={setDestacadaId}
        aoAbrirMenu={abrirMenu}
        aoRolar={menu ? fecharMenu : undefined}
      />

      <FaixaAtendimento conversa={conversa} acoes={acoesConversa.acoes} />

      <CampoEnvio
        conversa={conversa}
        modoNota={modoNota}
        aoAlternarNota={alternarNota}
        respondendoA={respondendoA}
        aoCancelarCitacao={() => setRespondendoAId(null)}
        edicao={
          edicao && {
            ...edicao,
            aoMudar: (texto) => setEdicao({ ...edicao, texto }),
            aoSalvar: salvarEdicao,
            aoCancelar: () => setEdicao(null),
          }
        }
      />

      {menuTopo && (
        <MenuFlutuante
          opcoes={acoesConversa.opcoesDe(conversa, {
            aoVerDados: () => despachar({ tipo: "abrirDados" }),
            comSimulacao: estado.modoDemonstracao, // ferramenta de teste: só na demonstração
          })}
          x={menuTopo.x}
          y={menuTopo.y}
          ancora={botaoMenu}
          aoFechar={fecharMenuTopo}
        />
      )}
      {acoesConversa.dialogo}

      {menuAberto && (
        <MenuFlutuante
          opcoes={opcoesDoMenu}
          x={menu.x}
          y={menu.y}
          folha={menu.toque}
          previa={resumoDaMensagem(msgDoMenu)}
          aoFechar={fecharMenu}
        />
      )}

      {/* As janelas só existem enquanto estão abertas */}
      {msgApagando && (
        <DialogoConfirmacao
          titulo="Apagar mensagem?"
          texto={
            msgApagando.tipo === "nota"
              ? "A nota será apagada para toda a equipe."
              : "A mensagem será apagada aqui para toda a equipe. O cliente pode já ter visto o conteúdo."
          }
          rotulo="Apagar"
          perigo
          aoConfirmar={apagar}
          aoFechar={() => setApagandoId(null)}
        />
      )}

      {msgEncaminhando && (
        <DialogoEncaminhar msg={msgEncaminhando} aoEscolher={encaminhar} aoFechar={() => setEncaminhandoId(null)} />
      )}
    </section>
  );
}

/* Faixa acima do campo de envio. Mostra quem está atendendo:
   - resolvida: "✓ Atendimento resolvido." + Reabrir
   - sem atendente: "Ninguém está atendendo" + Assumir
   - de outra pessoa: "Carla está atendendo" + Assumir
   - sua: a faixa não aparece (return null) */
function FaixaAtendimento({ conversa, acoes }) {
  const { estado } = useEstado();
  const dono = conversa.atendenteId;

  if (estaResolvida(conversa)) {
    return (
      <div className="faixa faixa--resolvida">
        <span>✓ Atendimento resolvido.</span>
        <button type="button" id="botao-faixa-assumir" onClick={() => acoes.alternarResolvida(conversa)}>
          Reabrir
        </button>
      </div>
    );
  }

  if (dono === estado.atendenteLogadoId) return null;

  return (
    <div className={dono ? "faixa faixa--outro" : "faixa"}>
      <span>
        {dono
          ? `${buscarPorId(estado.atendentes, dono)?.nome || "Outro atendente"} está atendendo esta conversa.`
          : "Ninguém está atendendo esta conversa."}
      </span>
      <button type="button" id="botao-faixa-assumir" onClick={() => acoes.assumir(conversa)}>
        Assumir
      </button>
    </div>
  );
}
