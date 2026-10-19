import { useEffect, useRef } from "react";

const TEMPO_PRESSIONAR_MS = 500; // segurar meio segundo, como no WhatsApp
const TOLERANCIA_PX = 10; // mexeu mais que isso? Era rolagem, não pressão

/* Abre um menu de duas formas, com o MESMO código para quem usa:
   - mouse: botão direito (evento "contextmenu")
   - toque: pressionar e segurar o dedo sobre o elemento

   Uso:
     const eventos = useMenuDeContexto((posicao) => abrirMenu(posicao));
     <div {...eventos}>...</div>

   "posicao" = { x, y, toque }: onde abrir, e se veio do dedo
   (no celular o menu aparece como uma folha embaixo da tela).

   Por que não só o "contextmenu"? O Android dispara esse evento ao
   segurar o dedo, mas o iPhone NÃO. Então cronometramos o toque nós mesmos. */
export function useMenuDeContexto(abrir) {
  // Refs: valores que mudam durante o gesto, mas não aparecem na tela
  const temporizador = useRef(null);
  const inicio = useRef(null); // onde o dedo encostou
  const ultimoFoiToque = useRef(false);
  const abriuPeloToque = useRef(false);

  function cancelar() {
    clearTimeout(temporizador.current);
    temporizador.current = null;
  }

  // Se o balão sumir no meio do gesto, o cronômetro não fica "solto"
  useEffect(() => cancelar, []);

  function abrirPeloToque() {
    cancelar();
    abriuPeloToque.current = true;
    navigator.vibrate?.(15); // vibradinha de confirmação (Android; o iPhone ignora)
    abrir({ ...inicio.current, toque: true });
  }

  return {
    onPointerDown(evento) {
      ultimoFoiToque.current = evento.pointerType === "touch";
      if (!ultimoFoiToque.current) return; // mouse usa o botão direito
      abriuPeloToque.current = false;
      inicio.current = { x: evento.clientX, y: evento.clientY };
      temporizador.current = setTimeout(abrirPeloToque, TEMPO_PRESSIONAR_MS);
    },

    onPointerMove(evento) {
      if (!temporizador.current) return;
      const distancia = Math.hypot(evento.clientX - inicio.current.x, evento.clientY - inicio.current.y);
      if (distancia > TOLERANCIA_PX) cancelar(); // está rolando a conversa
    },

    // Soltou antes do tempo, ou o navegador assumiu o gesto (rolagem)
    onPointerUp: cancelar,
    onPointerCancel: cancelar,

    onContextMenu(evento) {
      evento.preventDefault(); // sem o menu padrão do navegador
      if (ultimoFoiToque.current) {
        // Android: o próprio navegador avisou o toque longo. Se o nosso
        // cronômetro ainda não disparou, abrimos agora (uma vez só)
        if (!abriuPeloToque.current && inicio.current) abrirPeloToque();
        return;
      }
      abrir({ x: evento.clientX, y: evento.clientY, toque: false });
    },

    /* Ao soltar o dedo depois de abrir o menu, o navegador ainda manda
       um "click". Sem isto, ele tocaria o áudio ou abriria a citação.
       "Capture" = pegamos o clique ANTES dos botões de dentro do balão */
    onClickCapture(evento) {
      if (abriuPeloToque.current) {
        evento.preventDefault();
        evento.stopPropagation();
        abriuPeloToque.current = false;
      }
    },
  };
}
