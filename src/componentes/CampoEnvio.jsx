import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { nomeDoAutor, preencherModelo, resumoDaMensagem } from "../utilidades/conversas.js";
import { normalizar } from "../utilidades/texto.js";
import { useTelaEstreita } from "../hooks/useTelaEstreita.js";
import { useGravador } from "../hooks/useGravador.js";
import { formatarDuracao } from "../utilidades/texto.js";
import { Citacao } from "./Mensagem.jsx";
import Icone from "./Icone.jsx";

const LIMITE_AUDIO_SEGUNDOS = 5 * 60; // 5 minutos: depois disso, envia sozinho

/* O campo de mensagem, com:
   - rascunho por conversa (o texto fica no estado global, em "rascunhos")
   - respostas rápidas com "/"
   - barra "Respondendo a..." quando há citação
   - gravação de áudio */
/* edicao (ou null): { msgId, texto, aoMudar, aoSalvar, aoCancelar }
   Editando, o campo mostra o texto da EDIÇÃO; o rascunho continua guardado
   em "rascunhos" sem ser tocado, e volta sozinho quando a edição termina */
export default function CampoEnvio({ conversa, respondendoA, aoCancelarCitacao, edicao }) {
  const { estado, despachar } = useEstado();
  const estreita = useTelaEstreita();
  const campo = useRef(null);
  const gravador = useGravador();

  /* "Componente controlado": o valor do <input> vem do ESTADO, e cada letra
     digitada atualiza o estado. O React é a única "fonte da verdade" */
  const texto = edicao ? edicao.texto : (estado.rascunhos[conversa.id] ?? "");
  const editandoId = edicao?.msgId;

  // Estado LOCAL: só este componente precisa saber disso
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [sugestoesFechadas, setSugestoesFechadas] = useState(false);

  /* VALOR DERIVADO: as sugestões não ficam guardadas em lugar nenhum.
     São CALCULADAS a partir do texto, a cada renderização. Guardar algo
     que dá para calcular é pedir para a tela ficar fora de sincronia */
  const procurandoAtalho = texto.startsWith("/") && !texto.includes(" ") && !sugestoesFechadas;
  const termo = normalizar(texto.slice(1));
  const sugestoes = procurandoAtalho
    ? estado.respostasRapidas.filter(
        (r) => normalizar(r.atalho).includes(termo) || normalizar(r.texto).includes(termo)
      )
    : [];
  const ativa = Math.min(sugestaoAtiva, Math.max(sugestoes.length - 1, 0));

  // Começou a responder uma mensagem: o cursor vai para o campo
  useEffect(() => {
    if (respondendoA) campo.current?.focus();
  }, [respondendoA]);

  // Começou a editar: foco no campo, com o cursor no FIM do texto
  useEffect(() => {
    const el = campo.current;
    if (!editandoId || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editandoId]);

  function mudarTexto(novo) {
    if (edicao) edicao.aoMudar(novo);
    else despachar({ tipo: "definirRascunho", conversaId: conversa.id, texto: novo });
    setSugestaoAtiva(0);
    setSugestoesFechadas(false);
  }

  function escolherSugestao(resposta) {
    mudarTexto(preencherModelo(resposta.texto, conversa, estado));
    setSugestoesFechadas(true);
    campo.current?.focus();
  }

  /* Envio comum para texto e áudio.
     conteudo = { tipo: "texto", texto } ou { tipo: "audio", audioUrl, duracao } */
  function despacharEnvio(conteudo) {
    // Id e horário nascem AQUI (o reducer precisa ser puro)
    const id = `m${Date.now()}`;
    despachar({
      tipo: "enviarMensagem",
      conversaId: conversa.id,
      id,
      agora: new Date().toISOString(),
      conteudo,
      respostaA: respondendoA?.id,
    });
    aoCancelarCitacao();

    /* ⚠️ SIMULAÇÃO: finge que o cliente leu 3 segundos depois.
       Com o backend, quem avisa a leitura é o WhatsApp */
    const conversaId = conversa.id;
    setTimeout(() => despachar({ tipo: "mensagemLida", conversaId, mensagemId: id }), 3000);
  }

  function enviar(evento) {
    evento.preventDefault(); // sem isso o form recarregaria a página
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (edicao) edicao.aoSalvar(conteudo); // editando: Enter SALVA em vez de enviar
    else despacharEnvio({ tipo: "texto", texto: conteudo });
  }

  /* ---------- Áudio ---------- */
  async function comecarGravacao() {
    try {
      await gravador.iniciar();
    } catch (erro) {
      // Cada tipo de erro vira uma explicação que a pessoa entende
      if (erro.name === "NotAllowedError") {
        avisar(despachar, "Permissão do microfone negada. Libere no cadeado ao lado do endereço do site.");
      } else if (erro.message === "sem-suporte") {
        avisar(despachar, "Este navegador não permite gravar áudio aqui (precisa de localhost ou HTTPS)");
      } else {
        avisar(despachar, "Não foi possível acessar o microfone");
      }
    }
  }

  async function enviarGravacao() {
    const audio = await gravador.parar(true);
    if (!audio) return;
    if (audio.curto) return avisar(despachar, "Áudio muito curto");
    if (audio.erro) return avisar(despachar, "Não foi possível processar o áudio");
    despacharEnvio({ tipo: "audio", audioUrl: audio.audioUrl, duracao: audio.duracao });
  }

  // Chegou ao limite de 5 minutos? Envia sozinho
  useEffect(() => {
    if (gravador.gravando && gravador.segundos >= LIMITE_AUDIO_SEGUNDOS) {
      avisar(despachar, "Limite de 5 minutos: o áudio foi enviado");
      enviarGravacao();
    }
  });

  function aoApertarTecla(evento) {
    if (sugestoes.length > 0) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        setSugestaoAtiva((ativa + 1) % sugestoes.length); // depois da última, volta à primeira
        return;
      }
      if (evento.key === "ArrowUp") {
        evento.preventDefault();
        setSugestaoAtiva((ativa - 1 + sugestoes.length) % sugestoes.length);
        return;
      }
      if (evento.key === "Enter" || evento.key === "Tab") {
        evento.preventDefault(); // Enter escolhe a sugestão em vez de enviar
        escolherSugestao(sugestoes[ativa]);
        return;
      }
    }

    if (evento.key === "Escape") {
      /* stopPropagation: o Esc foi "usado" aqui e não sobe até o document
         (lá em cima, ele fecharia a conversa) */
      if (procurandoAtalho) {
        evento.stopPropagation();
        setSugestoesFechadas(true);
      } else if (edicao) {
        evento.stopPropagation();
        edicao.aoCancelar();
      } else if (respondendoA) {
        evento.stopPropagation();
        aoCancelarCitacao();
      }
      // Sem nada para cancelar, o Esc sobe e fecha a conversa (o rascunho fica salvo)
    }
  }

  const temTexto = texto.trim() !== "";

  return (
    <>
      {edicao && (
        <div className="citacao-envio edicao-envio">
          <Citacao autor="✏️ Editando mensagem" texto={conversa.mensagens.find((m) => m.id === edicao.msgId)?.texto} />
          <button type="button" className="botao-cancelar-citacao" aria-label="Cancelar edição" onClick={edicao.aoCancelar}>
            <Icone nome="fechar" />
          </button>
        </div>
      )}

      {respondendoA && (
        <div className="citacao-envio">
          <Citacao
            autor={nomeDoAutor(respondendoA, conversa, estado)}
            texto={resumoDaMensagem(respondendoA)}
          />
          <button type="button" className="botao-cancelar-citacao" aria-label="Cancelar resposta" onClick={aoCancelarCitacao}>
            <Icone nome="fechar" />
          </button>
        </div>
      )}

      {procurandoAtalho && (
        <ul className="sugestoes" role="listbox" aria-label="Respostas rápidas">
          {sugestoes.length === 0 && <li className="lista-vazia">Nenhuma resposta rápida com esse atalho</li>}
          {sugestoes.map((resposta, indice) => (
            <li
              key={resposta.atalho}
              role="option"
              aria-selected={indice === ativa}
              className={`sugestao${indice === ativa ? " sugestao--ativa" : ""}`}
              // onMouseDown em vez de onClick: o clique não tira o foco do campo
              onMouseDown={(evento) => {
                evento.preventDefault();
                escolherSugestao(resposta);
              }}
            >
              <span className="sugestao__atalho">/{resposta.atalho}</span>
              <span className="sugestao__texto">{preencherModelo(resposta.texto, conversa, estado)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Gravando? A barra de gravação aparece NO LUGAR do campo */}
      {gravador.gravando ? (
        <div className="gravacao">
          <span className="gravacao__ponto" aria-hidden="true" />
          <span className="gravacao__tempo" aria-live="off">
            {formatarDuracao(gravador.segundos)}
          </span>
          <button type="button" id="botao-cancelar-audio" onClick={() => gravador.parar(false)}>
            Cancelar
          </button>
          {/* autoFocus: o foco vai para cá ao começar (Enter já envia) */}
          <button type="button" id="botao-enviar-audio" autoFocus onClick={enviarGravacao}>
            Enviar áudio
          </button>
        </div>
      ) : (
        <form className="chat__envio" onSubmit={enviar}>
          <label htmlFor="campo-mensagem" className="visualmente-oculto">
            Digite uma mensagem
          </label>
          <input
            ref={campo}
            id="campo-mensagem"
            type="text"
            autoComplete="off"
            placeholder={estreita ? "Mensagem ou / atalho" : "Digite uma mensagem ou / para respostas rápidas"}
            value={texto}
            onChange={(evento) => mudarTexto(evento.target.value)}
            onKeyDown={aoApertarTecla}
            /* Conversa nova (sem mensagens): o cursor já fica pronto para escrever.
               Funciona porque o chat é recriado a cada conversa (a "key") */
            autoFocus={conversa.mensagens.length === 0}
          />

          {/* Campo vazio: microfone. Com texto: enviar */}
          {/* Editando: sempre o botão de salvar (áudio não entra numa edição) */}
          {temTexto || edicao ? (
            <button
              type="submit"
              id="botao-enviar"
              aria-label={edicao ? "Salvar edição" : "Enviar mensagem"}
              disabled={!temTexto}
            >
              <Icone nome="enviar" />
            </button>
          ) : (
            <button type="button" id="botao-audio" aria-label="Gravar áudio" onClick={comecarGravacao}>
              <Icone nome="mic" />
            </button>
          )}
        </form>
      )}
    </>
  );
}
