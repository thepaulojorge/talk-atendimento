import { useContext } from "react";
import { ContextoEstado } from "./contexto.js";

/* Hook para qualquer componente acessar o estado:
     const { estado, despachar } = useEstado();
   (Hooks são funções que começam com "use" e só podem ser chamadas
   dentro de componentes ou de outros hooks) */
export function useEstado() {
  const contexto = useContext(ContextoEstado);
  if (!contexto) {
    throw new Error("useEstado precisa ser usado dentro do <ProvedorEstado>");
  }
  return contexto;
}
