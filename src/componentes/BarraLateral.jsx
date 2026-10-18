import { useEstado } from "../estado/useEstado.js";
import { contarTotalNaoLidas, ordenarConversas } from "../utilidades/conversas.js";
import ItemConversa from "./ItemConversa.jsx";

/* Coluna da esquerda. Busca, filtros, arquivadas e contatos
   entram nas próximas etapas */
export default function BarraLateral() {
  const { estado } = useEstado();
  const total = contarTotalNaoLidas(estado.conversas);

  // Lista visível: sem as arquivadas, sem conversas vazias (a não ser a aberta)
  const visiveis = ordenarConversas(
    estado.conversas.filter(
      (c) => !c.arquivada && (c.mensagens.length > 0 || c.id === estado.conversaAbertaId)
    )
  );

  return (
    <aside className="barra-lateral">
      <section className="painel-conversas" aria-label="Conversas">
        <div className="painel-conversas__topo">
          <h2>
            Conversas
            {total > 0 && (
              <span className="contador-total" aria-live="polite">
                {total}
              </span>
            )}
          </h2>
        </div>

        <ul className="lista-conversas">
          {visiveis.map((conversa) => (
            // Cada item recebe a conversa como "prop"
            <ItemConversa key={conversa.id} conversa={conversa} />
          ))}
        </ul>
      </section>
    </aside>
  );
}
