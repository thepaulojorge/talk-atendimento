import { useCallback, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { PAPEIS } from "../utilidades/permissoes.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";

/* A barra do topo: a marca (white-label) e quem está logado */
export default function TopoApp() {
  const { estado, despachar } = useEstado();
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId);

  /* ⚠️ SIMULAÇÃO de login: clicar no seu nome deixa "entrar" como outra
     pessoa, para testar a visão de cada um (atendente, supervisão, diretoria).
     Na parte 4c, isto dá lugar à tela de login de verdade */
  const botao = useRef(null);
  const [menu, setMenu] = useState(null);
  const fecharMenu = useCallback(() => setMenu(null), []);

  function alternarMenu() {
    if (menu) return fecharMenu();
    const caixa = botao.current.getBoundingClientRect();
    setMenu({ x: caixa.right, y: caixa.bottom + 6 });
  }

  function trocar(id) {
    if (id === estado.atendenteLogadoId) return;
    despachar({ tipo: "trocarAtendente", id });
    avisar(despachar, `Agora você está como ${buscarPorId(estado.atendentes, id).nome}`);
  }

  const opcoes = estado.atendentes.map((a) => {
    // Mostra o papel de quem não é atendente: "Beatriz · Supervisão"
    const papel = a.papel && a.papel !== "atendente" ? ` · ${PAPEIS[a.papel]}` : "";
    const atual = a.id === estado.atendenteLogadoId;
    return { id: a.id, rotulo: `${atual ? "✓ " : ""}${a.nome}${papel}`, acao: () => trocar(a.id) };
  });

  return (
    <header className="topo-app">
      <div className="topo-app__esquerda">
        {/* O nome vem do estado: quando a empresa trocar, muda aqui sozinho */}
        <span className="topo-app__logo">
          <Icone nome="logo" /> {estado.marca.nome}
        </span>
      </div>

      <div className="topo-app__direita">
        {/* && no JSX: "se tiver atendente, mostra isto". Enquanto os dados
            carregam, a lista de atendentes está vazia e nada aparece */}
        {atendente && (
          <button
            type="button"
            ref={botao}
            className="atendente-logado"
            aria-haspopup="menu"
            aria-expanded={Boolean(menu)}
            aria-label="Trocar atendente (simulação)"
            onClick={alternarMenu}
          >
            <span className="atendente-logado__nome">{atendente.nome}</span>
            <Avatar nome={atendente.nome} />
          </button>
        )}
      </div>

      {menu && (
        <MenuFlutuante
          titulo="Simular login como"
          opcoes={opcoes}
          x={menu.x}
          y={menu.y}
          ancora={botao}
          aoFechar={fecharMenu}
        />
      )}
    </header>
  );
}
