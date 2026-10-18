import { useEffect, useState } from "react";

/* Hook próprio: diz se a tela é estreita (celular).
     const estreita = useTelaEstreita();

   Um "hook próprio" é uma função que usa outros hooks (useState, useEffect)
   para reaproveitar a mesma lógica em vários componentes. */
export function useTelaEstreita(larguraMaxima = 768) {
  const consulta = `(max-width: ${larguraMaxima}px)`;

  // Valor inicial calculado UMA vez (a função só roda na primeira renderização)
  const [estreita, setEstreita] = useState(() => window.matchMedia(consulta).matches);

  useEffect(() => {
    // matchMedia avisa quando a tela cruza o limite (girar o celular, redimensionar)
    const media = window.matchMedia(consulta);
    const aoMudar = (evento) => setEstreita(evento.matches);
    media.addEventListener("change", aoMudar);

    // Limpeza: ao sair da tela, paramos de "ouvir". Sem isso, o ouvinte
    // continuaria ativo para sempre (um vazamento de memória)
    return () => media.removeEventListener("change", aoMudar);
  }, [consulta]);

  return estreita;
}
