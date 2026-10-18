import { useCallback, useEffect, useRef, useState } from "react";
import { ContextoPlayer } from "./contextoPlayer.js";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";

/* UM player para o app inteiro: tocar um áudio pausa o outro, como no WhatsApp */
export default function ProvedorPlayer({ children }) {
  const { estado, despachar } = useEstado();

  /* O elemento <audio> fica numa ref: ele precisa EXISTIR entre uma
     renderização e outra, mas trocar de música não deve redesenhar nada.
     "new Audio()" só roda na primeira vez (inicialização preguiçosa) */
  const audioRef = useRef(null);
  if (audioRef.current === null) audioRef.current = new Audio();

  // Qual mensagem está no player. Ref = valor sempre atual dentro das funções
  const idAtualRef = useRef(null);

  // Estado = o que a TELA precisa mostrar
  const [tocandoId, setTocandoId] = useState(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);

  // O próprio <audio> avisa o que está acontecendo
  useEffect(() => {
    const audio = audioRef.current;
    const aoAtualizar = () => setTempo(audio.currentTime); // ~4x por segundo
    const aoTocar = () => setTocando(true);
    const aoPausar = () => setTocando(false);
    const aoTerminar = () => {
      idAtualRef.current = null;
      setTocandoId(null);
      setTocando(false);
      setTempo(0);
    };

    audio.addEventListener("timeupdate", aoAtualizar);
    audio.addEventListener("play", aoTocar);
    audio.addEventListener("pause", aoPausar);
    audio.addEventListener("ended", aoTerminar);
    return () => {
      audio.removeEventListener("timeupdate", aoAtualizar);
      audio.removeEventListener("play", aoTocar);
      audio.removeEventListener("pause", aoPausar);
      audio.removeEventListener("ended", aoTerminar);
      audio.pause();
    };
  }, []);

  /* useCallback: guarda a MESMA função entre renderizações (só recria se
     "despachar" mudar, o que nunca acontece). Assim quem recebe a função
     não é redesenhado à toa */
  const parar = useCallback(() => {
    audioRef.current.pause();
    idAtualRef.current = null;
    setTocandoId(null);
    setTocando(false);
    setTempo(0);
  }, []);

  const tocarOuPausar = useCallback(
    (msg) => {
      const audio = audioRef.current;
      if (!msg.audioUrl) {
        avisar(despachar, "Este é um áudio de exemplo, sem arquivo. Grave um no 🎤 para testar!");
        return;
      }

      // O mesmo áudio: alterna tocar/pausar
      if (idAtualRef.current === msg.id) {
        if (audio.paused) audio.play();
        else audio.pause();
        return;
      }

      // Outro áudio: troca e começa do início
      audio.pause();
      audio.src = msg.audioUrl;
      idAtualRef.current = msg.id;
      setTocandoId(msg.id);
      setTempo(0);
      audio.play().catch(() => avisar(despachar, "Não foi possível tocar este áudio"));
    },
    [despachar]
  );

  /* Clique na barra: "fracao" vai de 0 (início) a 1 (fim).
     Usamos a duração SALVA na mensagem: áudios gravados no Chrome (.webm)
     costumam informar duração "Infinity" */
  const avancar = useCallback((msg, fracao) => {
    if (idAtualRef.current !== msg.id) return;
    const novoTempo = Math.max(0, Math.min(1, fracao)) * msg.duracao;
    audioRef.current.currentTime = novoTempo;
    setTempo(novoTempo);
  }, []);

  /* Trocou de conversa (ou fechou): o áudio pausa.
     Efeitos servem para sincronizar com algo DE FORA do React (aqui, o <audio>),
     e não para mudar o próprio estado: isso causaria uma renderização extra.
     Por isso só pausamos o <audio>; ele mesmo dispara o evento "pause", que
     atualiza o estado pelo caminho normal. De bônus: ao voltar à conversa,
     o áudio está pausado no ponto onde parou */
  useEffect(() => {
    audioRef.current.pause();
  }, [estado.conversaAbertaId]);

  return (
    <ContextoPlayer.Provider value={{ tocandoId, tocando, tempo, tocarOuPausar, avancar, parar }}>
      {children}
    </ContextoPlayer.Provider>
  );
}
