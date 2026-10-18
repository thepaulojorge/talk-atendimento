import { useEffect } from "react";
import { useEstado } from "../estado/useEstado.js";

/* O aviso flutuante ("Mensagem enviada", "Conversa arquivada"...).
   Some sozinho depois de 3 segundos */
export default function Aviso() {
  const { estado, despachar } = useEstado();
  const aviso = estado.aviso;

  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => despachar({ tipo: "esconderAviso", id: aviso.id }), 3000);
    // Chegou outro aviso antes dos 3s? Cancela o temporizador do anterior
    return () => clearTimeout(temporizador);
  }, [aviso, despachar]);

  if (!aviso) return null; // devolver null = não desenhar nada

  return (
    <div className="aviso" role="status">
      {aviso.texto}
    </div>
  );
}
