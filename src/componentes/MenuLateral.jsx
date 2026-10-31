import { useCallback, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { useTema } from "../hooks/useTema.js";
import { useTelaEstreita } from "../hooks/useTelaEstreita.js";
import { buscarPorId, contarTotalNaoLidas } from "../utilidades/conversas.js";
import { ehDiretoria, podeConfigurar, podeVerAuditoria } from "../utilidades/permissoes.js";
import { descreverSessao } from "../utilidades/sessao.js";
import { sairNoServidor } from "../api.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";
import MenuFlutuante from "./MenuFlutuante.jsx";
import DialogoConfirmacao from "./DialogoConfirmacao.jsx";
import DialogoConfiguracoes from "./DialogoConfiguracoes.jsx";

/* Barra de ícones, como a do WhatsApp Web.
   No computador fica na esquerda, em pé; no celular vira uma barra
   no rodapé (o CSS cuida disso, o componente é o mesmo).

   Em cima, as SEÇÕES: Conversas, Contatos e Supervisão.
   Embaixo, as ferramentas: Configurações, tema e a sua conta. */
export default function MenuLateral() {
  const { estado, despachar, restaurarExemplo } = useEstado();
  const { tema, alternarTema } = useTema();
  const estreita = useTelaEstreita();
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId);
  const total = contarTotalNaoLidas(estado.conversas);

  const [configurando, setConfigurando] = useState(false);
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);

  // Menu da conta (o avatar): Sair e Restaurar
  const botaoConta = useRef(null);
  const [menuConta, setMenuConta] = useState(null);
  const fecharMenuConta = useCallback(() => setMenuConta(null), []);

  function alternarMenuConta() {
    if (menuConta) return fecharMenuConta();
    const caixa = botaoConta.current.getBoundingClientRect();
    // Ao lado do avatar, para a direita. O MenuFlutuante sobe o menu se faltar espaço embaixo
    setMenuConta({ x: caixa.right + 8, y: caixa.top });
  }

  function sair() {
    /* Avisa o servidor (ele solta as estações que você tinha puxado).
       Não esperamos a resposta: sair tem que ser na hora, mesmo sem
       internet. Se falhar, o próximo login também solta tudo */
    sairNoServidor(estado.sessao?.token).catch(() => {});
    despachar({ tipo: "sair" });
    avisar(despachar, "Você saiu. Até logo!");
  }

  const irPara = (secao) => despachar({ tipo: "irPara", secao });
  const podeRestaurar = estado.modoDemonstracao && ehDiretoria(estado);

  // "Estação 01 · +55 21 99000-0001" (ou o papel, nas contas pessoais)
  const onde = descreverSessao(estado);
  const rotuloTema = tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro";

  return (
    <nav className="menu-lateral" aria-label="Menu principal">
      <div className="menu-lateral__grupo">
        <BotaoMenu
          icone="mensagem"
          rotulo="Conversas"
          ativo={estado.secao === "conversas"}
          aoClicar={() => irPara("conversas")}
          contador={total}
        />
        <BotaoMenu
          icone="contatos"
          rotulo="Contatos"
          ativo={estado.secao === "contatos"}
          aoClicar={() => irPara("contatos")}
        />

        {/* Só quem entrou pelo e-mail de uma ESTAÇÃO pode puxar outras.
            Supervisão e diretoria têm a linha delas e não puxam nenhuma */}
        {estado.sessao?.estacaoId && (
          <BotaoMenu
            icone="estacoes"
            rotulo="Estações"
            ativo={estado.secao === "estacoes"}
            aoClicar={() => irPara("estacoes")}
            contador={estado.linhas.length > 1 ? estado.linhas.length : 0}
            rotuloContador="estações com você"
            neutro
          />
        )}

        {/* Só supervisão e diretoria veem este ícone */}
        {podeVerAuditoria(estado) && (
          <>
            <span className="menu-lateral__divisoria" aria-hidden="true" />
            <BotaoMenu
              icone="escudo"
              rotulo="Supervisão"
              ativo={estado.secao === "supervisao"}
              aoClicar={() => irPara("supervisao")}
            />
          </>
        )}
      </div>

      {/* O espaço vazio empurra o grupo de baixo para o fim da barra */}
      <span className="menu-lateral__espaco" />

      <div className="menu-lateral__grupo">
        {podeConfigurar(estado) && (
          <BotaoMenu icone="engrenagem" rotulo="Configurações" aoClicar={() => setConfigurando(true)} />
        )}
        <BotaoMenu icone={tema === "claro" ? "lua" : "sol"} rotulo={rotuloTema} aoClicar={alternarTema} />

        {atendente && (
          <button
            type="button"
            ref={botaoConta}
            className="menu-lateral__botao menu-lateral__conta"
            aria-label={`${atendente.nome}: menu da conta`}
            title={`${atendente.nome} · ${onde}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(menuConta)}
            onClick={alternarMenuConta}
          >
            <Avatar nome={atendente.nome} />
          </button>
        )}
      </div>

      {menuConta && (
        <MenuFlutuante
          titulo={`${atendente.nome} · ${onde}`}
          opcoes={[
            { id: "sair", rotulo: "Sair", icone: "sair", acao: sair },
            /* Ferramenta de teste: volta o banco ao exemplo. Só no modo
               demonstração e só para a diretoria (o servidor confere também) */
            podeRestaurar && { divisoria: true },
            podeRestaurar && {
              id: "restaurar",
              rotulo: "↺ Restaurar dados de exemplo",
              teste: true,
              acao: () => setConfirmandoRestaurar(true),
            },
          ].filter(Boolean)}
          x={menuConta.x}
          y={menuConta.y}
          // No celular, a conta fica no rodapé: o menu sobe como folha
          folha={estreita}
          ancora={botaoConta}
          aoFechar={fecharMenuConta}
        />
      )}

      {configurando && <DialogoConfiguracoes aoFechar={() => setConfigurando(false)} />}

      {confirmandoRestaurar && (
        <DialogoConfirmacao
          titulo="Restaurar dados de exemplo?"
          texto="Tudo o que foi feito na demonstração (mensagens, edições, etiquetas, conversas novas) será apagado, para todos que estiverem usando, e os exemplos voltam ao início."
          rotulo="Restaurar"
          perigo
          aoConfirmar={restaurarExemplo}
          aoFechar={() => setConfirmandoRestaurar(false)}
        />
      )}
    </nav>
  );
}

/* Um ícone da barra. O nome aparece como dica (title) ao passar o mouse
   e é lido pelo leitor de tela (aria-label), já que não há texto visível.
   aria-current="page": diz ao leitor de tela qual seção está aberta */
function BotaoMenu({ icone, rotulo, ativo = false, contador = 0, rotuloContador = "não lidas", neutro = false, aoClicar }) {
  return (
    <button
      type="button"
      className="menu-lateral__botao"
      aria-label={contador > 0 ? `${rotulo}, ${contador} ${rotuloContador}` : rotulo}
      aria-current={ativo ? "page" : undefined}
      title={rotulo}
      onClick={aoClicar}
    >
      <Icone nome={icone} />
      {contador > 0 && (
        // neutro: um número informativo (cinza), não um alerta como as não lidas
        <span className={`menu-lateral__contador${neutro ? " menu-lateral__contador--neutro" : ""}`} aria-hidden="true">
          {contador > 99 ? "99+" : contador}
        </span>
      )}
    </button>
  );
}
