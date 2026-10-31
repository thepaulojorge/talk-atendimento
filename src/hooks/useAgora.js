import { useEffect, useState } from "react";

/* A HORA ATUAL, que se atualiza sozinha.

   Por que um hook? Uma tela só muda quando o ESTADO muda. "Faz 10 minutos
   que o cliente espera" depende do relógio, e o relógio não é estado:
   sem nada acontecendo, a bolinha nunca ficaria vermelha.
   Este hook guarda a hora num estado e a troca a cada "intervalo"
   (30 segundos): a tela se redesenha e recalcula as esperas.

   O "return" do useEffect desliga o relógio quando o componente some
   (sem isso, o setInterval continuaria rodando para sempre) */
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(relogio);
  }, [intervaloMs]);
  return agora;
}
