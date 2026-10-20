import { useCallback, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { PAPEIS, papelDe, podeConfigurar } from "../utilidades/permissoes.js";
import { descreverSessao } from "../utilidades/turnos.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";
import DialogoConfirmacao from "./DialogoConfirmacao.jsx";
import DialogoConfiguracoes from "./DialogoConfiguracoes.jsx";
import { useTema } from "../hooks/useTema.js";

/* A barra do topo: a marca (white-label) e quem está logado */
export default function TopoApp() {
  const { estado, despachar, restaurarExemplo } = useEstado();
  const { tema, alternarTema } = useTema();
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId);

  // Menu do seu nome: configurações (diretoria), sair e restaurar
  const botao = useRef(null);
  const [menu, setMenu] = useState(null);
  const fecharMenu = useCallback(() => setMenu(null), []);

  function alternarMenu() {
    if (menu) return fecharMenu();
    const caixa = botao.current.getBoundingClientRect();
    setMenu({ x: caixa.right, y: caixa.bottom + 6 });
  }

  function sair() {
    despachar({ tipo: "sair" });
    avisar(despachar, "Você saiu. Até logo!");
  }

  /* Título do menu: de onde você entrou.
     Estação: "Estação 01 · Turno da manhã". Conta pessoal: o papel */
  const onde = descreverSessao(estado.sessao, estado) || PAPEIS[papelDe(estado, estado.atendenteLogadoId)];

  const opcoes = [
    podeConfigurar(estado) && { id: "configuracoes", rotulo: "Configurações", icone: "engrenagem", acao: () => setConfigurando(true) },
    { id: "sair", rotulo: "Sair", icone: "sair", acao: sair },
    { divisoria: true },
    // Ferramenta de teste: volta tudo ao estado inicial
    { id: "restaurar", rotulo: "↺ Restaurar dados de exemplo", teste: true, acao: () => setConfirmandoRestaurar(true) },
  ].filter(Boolean);

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
            aria-label={`${atendente.nome}: menu da conta`}
            onClick={alternarMenu}
          >
            <span className="atendente-logado__nome">{atendente.nome}</span>
            <Avatar nome={atendente.nome} />
          </button>
        )}
      </div>

      {menu && (
        <MenuFlutuante
          titulo={onde}
          opcoes={opcoes}
          x={menu.x}
          y={menu.y}
          ancora={botao}
          aoFechar={fecharMenu}
        />
      )}

      {configurando && <DialogoConfiguracoes aoFechar={() => setConfigurando(false)} />}

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
