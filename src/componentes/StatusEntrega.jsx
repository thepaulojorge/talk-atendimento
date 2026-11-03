/* Os RISQUINHOS de uma mensagem nossa, como no WhatsApp:
   ✓          enviada: saiu daqui, mas ainda não chegou no celular do cliente
   ✓✓ cinza   entregue: chegou no celular, mas o cliente ainda não leu
   ✓✓ azul    lida

   Usado em dois lugares: no balão da mensagem e na prévia da lista de
   conversas. Mensagem recebida, nota interna ou apagada: não desenha nada.

   "entregue" pode não existir (dados guardados antes desta versão):
   por isso a conta é "!== false", e não só "entregue" */
export default function StatusEntrega({ msg, naLista = false }) {
  if (msg.direcao !== "enviada" || msg.apagada) return null;

  // O WhatsApp recusou: no balão, quem avisa é o "⚠ Não entregue"; na lista, só o ⚠
  if (msg.erroEnvio) {
    return naLista ? (
      <span className="status-entrega status-entrega--falhou" title={`Não entregue: ${msg.erroEnvio}`} aria-label="Não entregue">
        ⚠
      </span>
    ) : null;
  }

  const situacao = msg.lida ? "lida" : msg.entregue !== false ? "entregue" : "enviada";
  const rotulos = {
    enviada: "Enviada, ainda não entregue",
    entregue: "Entregue, ainda não lida",
    lida: "Lida",
  };

  return (
    <span
      className={`status-entrega status-entrega--${situacao}${naLista ? " status-entrega--lista" : ""}`}
      aria-label={rotulos[situacao]}
      title={rotulos[situacao]}
    >
      {situacao === "enviada" ? "✓" : "✓✓"}
    </span>
  );
}
