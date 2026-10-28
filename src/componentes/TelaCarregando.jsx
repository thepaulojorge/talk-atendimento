import { useEffect, useState } from "react";

const DEMORA_MS = 4000; // passou disso, explicamos o motivo da espera

/* "Carregando…". Se demorar, explica: no plano gratuito do Render, o
   servidor "dorme" depois de 15 minutos sem uso e leva cerca de 1 minuto
   para acordar. Sem o aviso, quem visita acharia que o site travou */
export default function TelaCarregando() {
  const [demorando, setDemorando] = useState(false);

  // setDemorando dentro do setTimeout (e não direto no efeito): o efeito só
  // agenda o aviso. A limpeza cancela o agendamento se carregar antes
  useEffect(() => {
    const temporizador = setTimeout(() => setDemorando(true), DEMORA_MS);
    return () => clearTimeout(temporizador);
  }, []);

  return (
    <div className="aviso-carregamento" role="status">
      <p>Carregando…</p>
      {demorando && (
        <p className="aviso-carregamento__dica">
          O servidor gratuito estava descansando e está acordando. Isso pode levar até 1 minuto, só na primeira visita.
        </p>
      )}
    </div>
  );
}
