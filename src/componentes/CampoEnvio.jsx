import { useCallback, useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { novoId } from "../utilidades/ids.js";
import { enviarArquivo } from "../api.js";
import {
  CATEGORIAS,
  guardarNoCache,
  medirDuracao,
  nomeDoAudioGravado,
  problemaDoArquivo,
  tipoBase,
  tipoDoArquivo,
} from "../utilidades/arquivos.js";
import { nomeDoAutor, preencherModelo, resumoDaMensagem } from "../utilidades/conversas.js";
import { normalizar } from "../utilidades/texto.js";
import { useTelaEstreita } from "../hooks/useTelaEstreita.js";
import { useGravador } from "../hooks/useGravador.js";
import { formatarDuracao } from "../utilidades/texto.js";
import { Citacao } from "./Mensagem.jsx";
import Icone from "./Icone.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";

const LIMITE_AUDIO_SEGUNDOS = 5 * 60; // 5 minutos: depois disso, envia sozinho

/* O campo de mensagem, com:
   - rascunho por conversa (o texto fica no estado global, em "rascunhos")
   - respostas rápidas com "/"
   - barra "Respondendo a..." quando há citação
   - gravação de áudio */
/* edicao (ou null): { msgId, texto, aoMudar, aoSalvar, aoCancelar }
   Editando, o campo mostra o texto da EDIÇÃO; o rascunho continua guardado
   em "rascunhos" sem ser tocado, e volta sozinho quando a edição termina
   modoNota + aoAlternarNota: o botão 📝 (o estado mora no ChatAberto) */
export default function CampoEnvio({ conversa, respondendoA, aoCancelarCitacao, edicao, modoNota, aoAlternarNota }) {
  const { estado, despachar } = useEstado();
  const estreita = useTelaEstreita();
  const campo = useRef(null);
  const gravador = useGravador();

  /* "Componente controlado": o valor do <input> vem do ESTADO, e cada letra
     digitada atualiza o estado. O React é a única "fonte da verdade" */
  const texto = edicao ? edicao.texto : (estado.rascunhos[conversa.id] ?? "");
  const editandoId = edicao?.msgId;
  const msgEditada = edicao ? conversa.mensagens.find((m) => m.id === edicao.msgId) : null;

  /* O campo fica amarelo quando o texto é para a EQUIPE:
     no modo nota, ou editando uma nota que já existe */
  const pareceNota = edicao ? msgEditada?.tipo === "nota" : modoNota;

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

  // Anexos: quantos arquivos estão subindo agora (para o aviso "Enviando…") e o menu "+"
  const [subindo, setSubindo] = useState(0);
  const seletor = useRef(null); // o <input type="file"> escondido
  const categoriaEscolhida = useRef("documento");
  const botaoAnexo = useRef(null);
  const [menuAnexo, setMenuAnexo] = useState(null);
  const fecharMenuAnexo = useCallback(() => setMenuAnexo(null), []);

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

  /* Envio comum para texto, nota, áudio e arquivo.
     conteudo = { tipo: "texto", texto }, { tipo: "nota", texto },
     { tipo: "audio", arquivo, duracao } ou { tipo: "arquivo", arquivo } */
  function despacharEnvio(conteudo) {
    // Id e horário nascem AQUI (o reducer precisa ser puro)
    const id = novoId("m");
    const ehNota = conteudo.tipo === "nota";
    despachar({
      tipo: "enviarMensagem",
      conversaId: conversa.id,
      id,
      agora: new Date().toISOString(),
      conteudo,
      respostaA: ehNota ? null : respondendoA?.id,
    });
    aoCancelarCitacao();

    // Nota não vai para o cliente: ninguém "lê" do outro lado.
    // A simulação só existe no modo demonstração (o servidor recusa fora dele)
    if (ehNota || !estado.modoDemonstracao) return;

    /* ⚠️ SIMULAÇÃO: finge que o cliente leu 3 segundos depois.
       Com o WhatsApp de verdade (B7), quem avisa a leitura é ele */
    const conversaId = conversa.id;
    setTimeout(() => despachar({ tipo: "mensagemLida", conversaId, mensagemId: id }), 3000);
  }

  function enviar(evento) {
    evento.preventDefault(); // sem isso o form recarregaria a página
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (edicao) edicao.aoSalvar(conteudo); // editando: Enter SALVA em vez de enviar
    else despacharEnvio({ tipo: modoNota ? "nota" : "texto", texto: conteudo });
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
    // O áudio gravado vira um arquivo como outro qualquer: "audio-14h32.webm"
    const tipo = tipoBase(audio.blob.type);
    await enviarUmArquivo(audio.blob, { nome: nomeDoAudioGravado(tipo), tipo, duracao: audio.duracao });
  }

  /* ---------- Anexos (o botão "+") ----------
     Enviar um arquivo são dois passos:
     1. o ARQUIVO vai para o servidor (esperamos terminar: pode demorar)
     2. a MENSAGEM que aponta para ele é despachada, como qualquer outra */

  // duracao (só áudio): com ela, a mensagem vira um balão de áudio com ▶
  async function enviarUmArquivo(conteudo, { nome, tipo, duracao }) {
    const id = novoId("arq");
    setSubindo((n) => n + 1);
    try {
      const arquivo = await enviarArquivo(estado.sessao?.token, { id, conteudo, nome, tipo });
      guardarNoCache(id, conteudo); // já temos os bytes: nada de baixar de volta
      despacharEnvio(duracao === undefined ? { tipo: "arquivo", arquivo } : { tipo: "audio", arquivo, duracao });
    } catch (erro) {
      avisar(despachar, `Não foi possível enviar "${nome}": ${erro.message}`);
    } finally {
      setSubindo((n) => n - 1);
    }
  }

  /* Abre a janela de arquivos do sistema. O <input type="file"> fica
     escondido: quem o "clica" é o código, depois que a pessoa escolhe
     a opção no menu. O "accept" filtra o que aparece na janela */
  function escolherArquivos(categoria) {
    categoriaEscolhida.current = categoria;
    seletor.current.accept = CATEGORIAS[categoria].accept;
    seletor.current.value = ""; // sem isso, escolher o MESMO arquivo de novo não dispara o onChange
    seletor.current.click();
  }

  // A pessoa escolheu um ou mais arquivos: confere e envia um por um, na ordem
  async function aoEscolherArquivos(evento) {
    const categoria = categoriaEscolhida.current;
    // [...lista]: os arquivos vêm numa "FileList", que não tem .map; viramos array
    for (const arquivo of [...evento.target.files]) {
      const problema = problemaDoArquivo(arquivo, categoria);
      if (problema) {
        avisar(despachar, problema);
        continue; // pula este e segue com os outros
      }
      const tipo = tipoDoArquivo(arquivo);
      const duracao = categoria === "audio" ? await medirDuracao(arquivo) : undefined;
      await enviarUmArquivo(arquivo, { nome: arquivo.name, tipo, duracao });
    }
  }

  function aoClicarAnexo() {
    if (edicao) return avisar(despachar, "Termine ou cancele a edição primeiro");
    // No modo nota, o botão mostra o 📝 aceso: clicar volta para a mensagem normal
    if (modoNota) {
      aoAlternarNota();
      return campo.current?.focus();
    }
    if (menuAnexo) return fecharMenuAnexo();
    const caixa = botaoAnexo.current.getBoundingClientRect();
    // Abre ACIMA do botão (o campo fica no rodapé da tela)
    setMenuAnexo({ x: caixa.left, y: caixa.top - 8 - 4 * 44 });
  }

  const opcoesAnexo = [
    { id: "documento", rotulo: "Documento", icone: "documento", acao: () => escolherArquivos("documento") },
    { id: "foto", rotulo: "Fotos", icone: "imagem", acao: () => escolherArquivos("foto") },
    { id: "audio", rotulo: "Áudio", icone: "mic", acao: () => escolherArquivos("audio") },
    { divisoria: true },
    {
      id: "nota",
      rotulo: "Nota interna",
      icone: "nota",
      acao: () => {
        aoAlternarNota();
        campo.current?.focus();
      },
    },
  ];

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

  // Celular: textos curtos, senão o placeholder aparece cortado
  let placeholder = estreita ? "Mensagem ou / atalho" : "Digite uma mensagem ou / para respostas rápidas";
  if (pareceNota) placeholder = estreita ? "Nota interna" : "Nota interna: só a equipe vê";

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

      {subindo > 0 && (
        <div className="enviando-arquivo" role="status">
          <span className="enviando-arquivo__giro" aria-hidden="true" />
          Enviando {subindo === 1 ? "arquivo" : `${subindo} arquivos`}…
        </div>
      )}

      {/* multiple: dá para escolher vários de uma vez. Fica escondido (o menu "+" é quem abre) */}
      <input ref={seletor} type="file" multiple hidden onChange={aoEscolherArquivos} />

      {menuAnexo && (
        <MenuFlutuante
          titulo="Anexar"
          opcoes={opcoesAnexo}
          x={menuAnexo.x}
          y={menuAnexo.y}
          folha={estreita}
          ancora={botaoAnexo}
          aoFechar={fecharMenuAnexo}
        />
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
        <form className={pareceNota ? "chat__envio chat__envio--nota" : "chat__envio"} onSubmit={enviar}>
          {/* "+": abre o menu com Documento, Fotos, Áudio e Nota interna.
              No modo nota, vira o 📝 aceso (clicar volta para a mensagem normal) */}
          <button
            type="button"
            ref={botaoAnexo}
            className="botao-nota"
            aria-pressed={pareceNota}
            aria-haspopup={modoNota ? undefined : "menu"}
            aria-expanded={modoNota ? undefined : Boolean(menuAnexo)}
            aria-label={modoNota ? "Sair da nota interna" : "Anexar arquivo ou escrever nota interna"}
            title={modoNota ? "Sair da nota interna" : "Anexar"}
            onClick={aoClicarAnexo}
          >
            <Icone nome={pareceNota ? "nota" : "adicionar"} />
          </button>
          <label htmlFor="campo-mensagem" className="visualmente-oculto">
            Digite uma mensagem
          </label>
          <input
            ref={campo}
            id="campo-mensagem"
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            value={texto}
            onChange={(evento) => mudarTexto(evento.target.value)}
            onKeyDown={aoApertarTecla}
            /* Conversa nova (sem mensagens): o cursor já fica pronto para escrever.
               Funciona porque o chat é recriado a cada conversa (a "key") */
            autoFocus={conversa.mensagens.length === 0}
          />

          {/* Campo vazio: microfone. Com texto: enviar.
              Editando ou no modo nota: sempre o botão (áudio não vira nota nem edição) */}
          {temTexto || edicao || modoNota ? (
            <button
              type="submit"
              id="botao-enviar"
              aria-label={edicao ? "Salvar edição" : modoNota ? "Salvar nota interna" : "Enviar mensagem"}
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
