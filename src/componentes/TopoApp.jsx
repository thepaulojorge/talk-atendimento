import { useCallback, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { PAPEIS } from "../utilidades/permissoes.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";
import DialogoConfirmacao from "./DialogoConfirmacao.jsx";
import { useTema } from "../hooks/useTema.js";

/* A barra do topo: a marca (white-label) e quem está logado */
export default function TopoApp() {
  const { estado, despachar, restaurarExemplo } = useEstado();
  const { tema, alternarTema } = useTema();
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
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
  // Separado das opções de login: volta tudo ao estado inicial
  opcoes.push(
    { divisoria: true },
    { id: "restaurar", rotulo: "↺ Restaurar dados de exemplo", teste: true, acao: () => setConfirmandoRestaurar(true) }
  );

  // O botão mostra o tema para onde você VAI: no preto aparece o sol
  const rotuloTema = tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro";

  return (
    <header className="topo-app">
      <div className="topo-app__esquerda">
        {/* O nome vem do estado: quando a empresa trocar, muda aqui sozinho */}
        <span className="topo-app__logo">
          <Icone nome="logo" /> {estado.marca.nome}
        </span>
      </div>

      <div className="topo-app__direita">
        <button type="button" className="botao-tema" aria-label={rotuloTema} title={rotuloTema} onClick={alternarTema}>
          <Icone nome={tema === "claro" ? "lua" : "sol"} />
        </button>

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

      {confirmandoRestaurar && (
        <DialogoConfirmacao
          titulo="Restaurar dados de exemplo?"
          texto="Tudo o que foi feito neste navegador (mensagens, edições, etiquetas, conversas novas) será apagado e os exemplos voltam ao início."
          rotulo="Restaurar"
          perigo
          aoConfirmar={restaurarExemplo}
          aoFechar={() => setConfirmandoRestaurar(false)}
        />
      )}
    </header>
  );
}
