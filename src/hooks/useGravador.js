import { useCallback, useEffect, useRef, useState } from "react";

/* Hook próprio: tudo o que envolve gravar áudio, num lugar só.
     const gravador = useGravador();
     await gravador.iniciar();             // pede o microfone e começa
     const audio = await gravador.parar(true); // { blob, duracao } ou null

   ⚠️ O navegador só libera o microfone em localhost ou HTTPS.
   O "npm run dev" (localhost) e o GitHub Pages (HTTPS) atendem às duas. */
export function useGravador() {
  // O que a TELA precisa mostrar
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);

  /* O que NÃO aparece na tela, mas precisa sobreviver entre renderizações:
     o gravador, a conexão com o microfone, os pedaços do áudio...
     Fica numa ref: mudar uma ref não redesenha nada */
  const recursos = useRef(null);
  const desmontado = useRef(false);

  const iniciar = useCallback(async () => {
    if (recursos.current) return; // já está gravando

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("sem-suporte");
    }

    // Na primeira vez, o navegador pergunta se você permite usar o microfone.
    // Se a pessoa negar, o await "lança" um erro (tratado por quem chamou)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Enquanto o navegador perguntava, a conversa pode ter sido fechada
    if (desmontado.current) {
      stream.getTracks().forEach((faixa) => faixa.stop());
      return;
    }

    // Cada navegador grava num formato: Chrome/Firefox em webm, Safari em mp4
    const formato = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((f) =>
      MediaRecorder.isTypeSupported(f)
    );
    const recorder = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
    const pedacos = [];
    recorder.addEventListener("dataavailable", (evento) => {
      if (evento.data.size > 0) pedacos.push(evento.data); // o áudio chega em pedaços
    });
    recorder.start();

    const inicio = Date.now();
    const cronometro = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 250);

    recursos.current = { stream, recorder, pedacos, inicio, cronometro };
    setSegundos(0);
    setGravando(true);
  }, []);

  /* Para a gravação. enviar=true devolve o áudio pronto; false descarta.
     Devolve uma Promise: o MediaRecorder entrega o último pedaço DEPOIS
     de parar, então "parar" não é instantâneo */
  const parar = useCallback((enviar) => {
    const r = recursos.current;
    if (!r) return Promise.resolve(null);
    recursos.current = null;
    clearInterval(r.cronometro);
    setGravando(false);
    setSegundos(0);

    const duracao = Math.round((Date.now() - r.inicio) / 1000);

    return new Promise((resolver) => {
      r.recorder.addEventListener(
        "stop",
        () => {
          // Desliga o microfone (apaga a luz de "gravando" do navegador)
          r.stream.getTracks().forEach((faixa) => faixa.stop());

          if (!enviar) return resolver(null);
          if (duracao < 1) return resolver({ curto: true });

          /* Junta os pedaços num arquivo (Blob). Quem chamou envia esse
             arquivo para o servidor, como qualquer outro anexo.
             (Antes, ele virava texto e ia dentro da mensagem: pesado demais) */
          const blob = new Blob(r.pedacos, { type: r.recorder.mimeType });
          resolver({ blob, duracao });
        },
        { once: true }
      );
      r.recorder.stop();
    });
  }, []);

  /* Esc durante a gravação: cancela (e só isso).
     O "true" no final = fase de CAPTURA: este ouvinte roda ANTES dos outros,
     e o stopImmediatePropagation impede que o Esc também feche a conversa */
  useEffect(() => {
    if (!gravando) return;
    function aoApertarTecla(evento) {
      if (evento.key !== "Escape") return;
      evento.stopImmediatePropagation();
      parar(false);
    }
    document.addEventListener("keydown", aoApertarTecla, true);
    return () => document.removeEventListener("keydown", aoApertarTecla, true);
  }, [gravando, parar]);

  // O componente saiu da tela (trocou de conversa) no meio da gravação: descarta
  useEffect(() => {
    desmontado.current = false;
    return () => {
      desmontado.current = true;
      parar(false);
    };
  }, [parar]);

  return { gravando, segundos, iniciar, parar };
}
