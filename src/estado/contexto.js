import { createContext } from "react";

/* O CONTEXT é um "canal" que leva o estado do topo do app até qualquer
   componente, sem precisar passar de pai para filho em cada nível.
   Aqui só criamos o canal; quem coloca o estado nele é o ProvedorEstado,
   e quem lê é o hook useEstado. */
export const ContextoEstado = createContext(null);
