import { createContext } from "react";

/* Canal separado só para o player de áudio.
   Por que não colocar no estado principal? Durante a reprodução, o tempo
   muda ~4 vezes por segundo. Num canal próprio, só quem usa o player
   (os balões de áudio) é redesenhado, e não o app inteiro */
export const ContextoPlayer = createContext(null);
