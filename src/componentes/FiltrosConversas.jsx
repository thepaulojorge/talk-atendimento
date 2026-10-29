import { useCallback, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { contarNaoLidas, estaResolvida } from "../utilidades/conversas.js";
import MenuFlutuante from "./MenuFlutuante.jsx";

// À mostra, sempre: os filtros do dia a dia (com o total ao lado)
const PRINCIPAIS = [
  { id: "todas", nome: "Todas" },
  { id: "fila", nome: "Novas" }, // na fila: ninguém assumiu ainda
  { id: "nao-lidas", nome: "Não lidas" },
];

// Os outros, dentro do "Mais ▾"
const OUTROS = [
  { id: "minhas", nome: "Minhas" },
  { id: "resolvidas", nome: "Resolvidas" },
  { id: "grupos", nome: "Grupos" },
];

/* A fileira de filtros da lista de conversas: [Todas] [Novas] [Não lidas] [Mais ▾].
   O "Mais" abre uma lista com Minhas, Resolvidas, Grupos e as etiquetas.
   Escolher um filtro do "Mais" troca o nome do botão: [Grupos ▾] */
export default function FiltrosConversas({ filtro, setFiltro, etiqueta, setEtiqueta }) {
  const { estado } = useEstado();

  const botaoMais = useRef(null);
  const [menu, setMenu] = useState(null);
  const fecharMenu = useCallback(() => setMenu(null), []);

  /* Os totais: só das conversas da lista principal (não arquivadas, com mensagens).
     Calculados a cada renderização: chegou mensagem, o número muda sozinho */
  const naLista = estado.conversas.filter((c) => !c.arquivada && c.mensagens.length > 0);
  const totais = {
    fila: naLista.filter((c) => !c.atendenteId && !estaResolvida(c)).length,
    "nao-lidas": naLista.filter((c) => contarNaoLidas(c) > 0 || c.marcadaNaoLida).length,
  };

  // Filtro e etiqueta funcionam como UMA escolha só: escolher um desliga o outro
  function escolherFiltro(id) {
    setFiltro(id);
    setEtiqueta("");
  }

  function escolherEtiqueta(id) {
    setFiltro("todas");
    setEtiqueta(id);
  }

  function alternarMenu() {
    if (menu) return fecharMenu();
    const caixa = botaoMais.current.getBoundingClientRect();
    setMenu({ x: caixa.left, y: caixa.bottom + 4 });
  }

  const marcar = (ativo, nome) => `${ativo ? "✓ " : ""}${nome}`;

  // O botão "Mais" mostra o nome do filtro escolhido dentro dele (se houver)
  const outroAtivo = OUTROS.find((f) => f.id === filtro);
  const etiquetaAtiva = estado.etiquetas.find((e) => e.id === etiqueta);
  const linhaAtiva = estado.linhas.find((l) => `linha:${l.id}` === filtro);
  const nomeDoMais = outroAtivo?.nome || etiquetaAtiva?.nome || linhaAtiva?.sigla;

  /* Atendendo mais de uma estação? Dá para ver só as conversas de uma delas.
     Com uma linha só, o filtro não teria utilidade e nem aparece */
  const filtrosDeLinha =
    estado.linhas.length > 1
      ? [
          { divisoria: true },
          ...estado.linhas.map((l) => ({
            id: `linha-${l.id}`,
            rotulo: marcar(filtro === `linha:${l.id}`, `Só ${l.nome}`),
            icone: "estacoes",
            acao: () => escolherFiltro(`linha:${l.id}`),
          })),
        ]
      : [];

  const opcoes = [
    ...OUTROS.map((f) => ({ id: f.id, rotulo: marcar(filtro === f.id, f.nome), acao: () => escolherFiltro(f.id) })),
    { divisoria: true },
    ...estado.etiquetas.map((e) => ({
      id: `etiqueta-${e.id}`,
      rotulo: marcar(etiqueta === e.id, e.nome),
      icone: "etiqueta",
      acao: () => escolherEtiqueta(e.id),
    })),
    ...filtrosDeLinha,
  ];

  return (
    <nav className="filtros" aria-label="Filtrar conversas">
      {PRINCIPAIS.map((f) => {
        const ativo = filtro === f.id && !etiqueta;
        const total = totais[f.id] || 0;
        return (
          <button
            key={f.id}
            type="button"
            className={`filtro${ativo ? " ativo" : ""}`}
            aria-pressed={ativo}
            onClick={() => escolherFiltro(f.id)}
          >
            {f.nome}
            {total > 0 && <span className="filtro__total">{total}</span>}
          </button>
        );
      })}

      <button
        type="button"
        ref={botaoMais}
        className={`filtro filtro--mais${nomeDoMais ? " ativo" : ""}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        onClick={alternarMenu}
      >
        {nomeDoMais || "Mais"} ▾
      </button>

      {menu && (
        <MenuFlutuante titulo="Mais filtros" opcoes={opcoes} x={menu.x} y={menu.y} ancora={botaoMais} aoFechar={fecharMenu} />
      )}
    </nav>
  );
}
