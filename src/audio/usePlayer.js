import { useContext } from "react";
import { ContextoPlayer } from "./contextoPlayer.js";

/* const { tocandoId, tocando, tempo, tocarOuPausar, avancar } = usePlayer(); */
export function usePlayer() {
  const contexto = useContext(ContextoPlayer);
  if (!contexto) throw new Error("usePlayer precisa ser usado dentro do <ProvedorPlayer>");
  return contexto;
}
