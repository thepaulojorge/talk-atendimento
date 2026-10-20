import { useCallback, useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { contarNaoLidas, contarTotalNaoLidas, nomeDaConversa, ordenarConversas } from "../utilidades/conversas.js";
import { filtrarConversas } from "../utilidades/filtros.js";
import { useAcoesConversa } from "../hooks/useAcoesConversa.jsx";
import ItemConversa from "./ItemConversa.jsx";
import CartaoPrevia from "./CartaoPrevia.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";
import Icone from "./Icone.jsx";
import FiltrosConversas from "./FiltrosConversas.jsx";

const ATRASO_CARTAO_MS = 450; // passar o mouse "de passagem" não abre o cartão
// Celular não tem "passar o mouse". O ?. protege ambientes sem matchMedia
const TEM_MOUSE = window.matchMedia?.("(hover: hover)").matches ?? true;

/* A lista de conversas. Busca, filtro e arquivadas chegam do pai
   (BarraLateral) como props: valor + função para mudar */
export default function PainelConversas({
  busca,
  setBusca,
  filtro,
  setFiltro,
  etiqueta,
  setEtiqueta,
  vendoArquivadas,
  setVendoArquivadas,
}) {
  const { estado } = useEstado();
  const total = contarTotalNaoLidas(estado.conversas);

  /* Tudo DERIVADO: nada disto é guardado. A cada renderização,
     filtramos e ordenamos de novo a partir do estado */
  const visiveis = ordenarConversas(filtrarConversas(estado, { busca, filtro, etiqueta, vendoArquivadas }));
  const arquivadas = estado.conversas.filter((c) => c.arquivada && c.mensagens.length > 0);
  const naoLidasArquivadas = arquivadas.reduce((soma, c) => soma + contarNaoLidas(c), 0);

  /* ---------- Cartão de prévia ----------
     previa = { id, caixa } da conversa sob o mouse (ou null).
     O temporizador fica numa REF: ele não aparece na tela, então
     trocá-lo não deve redesenhar nada */
  const [previa, setPrevia] = useState(null);
  const temporizador = useRef(null);

  function aoEntrarMouse(id, elemento) {
    if (!TEM_MOUSE || menu) return; // com o menu aberto, nada de cartão
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      // Mede a posição só na hora de mostrar (a lista pode ter rolado)
      setPrevia({ id, caixa: elemento.getBoundingClientRect() });
    }, ATRASO_CARTAO_MS);
  }

  function esconderPrevia() {
    clearTimeout(temporizador.current);
    setPrevia(null);
  }

  /* ---------- Menu da conversa (botão direito ou dedo pressionado) ---------- */
  const [menu, setMenu] = useState(null); // { id, x, y, toque }
  const { opcoesDe, dialogo } = useAcoesConversa();
  const fecharMenu = useCallback(() => setMenu(null), []);
  const conversaDoMenu = menu && estado.conversas.find((c) => c.id === menu.id);

  function abrirMenu(id, posicao) {
    esconderPrevia(); // o cartão e o menu não aparecem juntos
    setMenu({ id, ...posicao });
  }

  function aoRolarLista() {
    esconderPrevia();
    if (menu) fecharMenu();
  }

  // Se o painel sumir com um temporizador pendente, ele é cancelado
  useEffect(() => () => clearTimeout(temporizador.current), []);

  // Esc no campo de busca limpa a busca
  function aoApertarTeclaBusca(evento) {
    if (evento.key === "Escape" && busca) {
      evento.stopPropagation();
      setBusca("");
    }
  }

  function entrarOuSairDasArquivadas(evento) {
    if (evento.type === "keydown") {
      if (evento.key !== "Enter" && evento.key !== " ") return;
      evento.preventDefault();
    }
    setVendoArquivadas(!vendoArquivadas);
  }

  let mensagemVazia = "Nenhuma conversa aqui";
  if (busca) mensagemVazia = `Nenhuma conversa encontrada para "${busca}"`;
  else if (vendoArquivadas) mensagemVazia = "Nenhuma conversa arquivada";

  return (
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

      <div className="busca">
        <label htmlFor="campo-busca" className="visualmente-oculto">
          Buscar conversa
        </label>
        <span className="busca__icone">
          <Icone nome="buscar" />
        </span>
        <input
          type="search"
          id="campo-busca"
          placeholder="Buscar nome, número ou mensagem"
          autoComplete="off"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          onKeyDown={aoApertarTeclaBusca}
        />
      </div>

      <FiltrosConversas filtro={filtro} setFiltro={setFiltro} etiqueta={etiqueta} setEtiqueta={setEtiqueta} />

      <ul className="lista-conversas" onScroll={aoRolarLista} onMouseDown={esconderPrevia}>
        {/* Topo da lista: o cabeçalho de quem está nas arquivadas, ou o atalho para elas */}
        {vendoArquivadas ? (
          <li
            className="arquivadas arquivadas--cabecalho"
            tabIndex={0}
            onClick={entrarOuSairDasArquivadas}
            onKeyDown={entrarOuSairDasArquivadas}
          >
            <Icone nome="voltar" className="arquivadas__icone" />
            <span>Arquivadas</span>
            <span className="arquivadas__dica">Não entram no contador</span>
          </li>
        ) : (
          arquivadas.length > 0 &&
          !busca && (
            <li className="arquivadas" tabIndex={0} onClick={entrarOuSairDasArquivadas} onKeyDown={entrarOuSairDasArquivadas}>
              <Icone nome="arquivo" className="arquivadas__icone" />
              <span>Arquivadas</span>
              <span className={`arquivadas__total${naoLidasArquivadas > 0 ? " arquivadas__total--destaque" : ""}`}>
                {naoLidasArquivadas > 0 ? `${naoLidasArquivadas} não lidas` : arquivadas.length}
              </span>
            </li>
          )
        )}

        {visiveis.length === 0 ? (
          <li className="lista-vazia">{mensagemVazia}</li>
        ) : (
          visiveis.map((conversa) => (
            <ItemConversa
              key={conversa.id}
              conversa={conversa}
              termoBusca={busca}
              selecionada={conversaDoMenu?.id === conversa.id}
              aoEntrarMouse={aoEntrarMouse}
              aoSairMouse={esconderPrevia}
              aoAbrirMenu={abrirMenu}
            />
          ))
        )}
      </ul>

      {previa && <CartaoPrevia conversaId={previa.id} caixa={previa.caixa} />}

      {conversaDoMenu && (
        <MenuFlutuante
          opcoes={opcoesDe(conversaDoMenu)}
          x={menu.x}
          y={menu.y}
          folha={menu.toque}
          previa={nomeDaConversa(conversaDoMenu, estado.contatos)}
          aoFechar={fecharMenu}
        />
      )}
      {dialogo}
    </section>
  );
}
