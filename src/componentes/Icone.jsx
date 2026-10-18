import { ICONES } from "./icones.js";

/* Um ícone SVG pelo nome: <Icone nome="mic" />

   dangerouslySetInnerHTML coloca HTML "cru" dentro do elemento. O nome
   assusta de propósito: com texto vindo de usuários, isso abriria brecha
   para código malicioso (XSS). Aqui é seguro porque o conteúdo vem só do
   NOSSO arquivo icones.js, nunca de algo digitado. */
export default function Icone({ nome, className = "" }) {
  return (
    <span className={`icone ${className}`.trim()} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ICONES[nome] }}
      />
    </span>
  );
}
