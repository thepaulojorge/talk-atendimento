import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProvedorEstado from "./estado/ProvedorEstado.jsx";
import App from "./App.jsx";
import "./estilos.css";

/* Ponto de partida: desenha o <App /> dentro do <div id="root"> do index.html.

   <ProvedorEstado> envolve o app inteiro: assim QUALQUER componente,
   por mais "fundo" que esteja, consegue ler o estado e pedir mudanças.

   <StrictMode> só age durante o desenvolvimento: roda algumas coisas duas
   vezes de propósito, para revelar erros escondidos. Não afeta o site publicado. */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProvedorEstado>
      <App />
    </ProvedorEstado>
  </StrictMode>
);
