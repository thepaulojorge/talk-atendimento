import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { TURNOS } from "../configuracao.js";
import { buscarConfiguracoes, salvarConfiguracoes } from "../api.js";
import { formatarNumero } from "../utilidades/texto.js";

/* Configurações da empresa (só a diretoria abre esta janela):
   - o nome que aparece no topo, no login e na aba (white-label)
   - a escala: quem cobre cada turno em cada estação
   - os números de WhatsApp: um por estação, e os exclusivos da
     supervisão e da diretoria

   Agora tudo mora no SERVIDOR: a janela busca a configuração ao abrir
   e manda de volta ao salvar. Até lá, as mudanças ficam num RASCUNHO
   local: "Cancelar" (ou Esc) desfaz tudo sem nenhum código extra */
export default function DialogoConfiguracoes({ aoFechar }) {
  const { estado, despachar, recarregar } = useEstado();
  const dialogo = useRef(null);
  const token = estado.sessao?.token;

  // null = ainda carregando do servidor
  const [nome, setNome] = useState("");
  const [estacoes, setEstacoes] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  // Busca a configuração atual. "cancelado": a janela pode fechar antes da resposta
  useEffect(() => {
    let cancelado = false;
    buscarConfiguracoes(token)
      .then((config) => {
        if (cancelado) return;
        setNome(config.marca.nome);
        setEstacoes(config.estacoes);
        // O número vai para o campo já formatado: "+55 21 99000-0001"
        // Ordem da tela: as estações primeiro, depois supervisão e diretoria
        const ordem = (l) => (l.estacaoId ? 0 : l.papel === "supervisor" ? 1 : 2);
        const ordenadas = [...config.linhas].sort((a, b) => ordem(a) - ordem(b) || a.id.localeCompare(b.id));
        setLinhas(ordenadas.map((l) => ({ ...l, numero: formatarNumero(l.numero) })));
      })
      .catch((problema) => !cancelado && setErro(problema.message));
    return () => {
      cancelado = true;
    };
  }, [token]);

  // Nome de cada linha na tela: a estação dela, ou "Supervisão"/"Diretoria"
  function nomeDaLinha(linha) {
    if (linha.papel === "supervisor") return "Supervisão";
    if (linha.papel === "diretoria") return "Diretoria";
    return estacoes?.find((e) => e.id === linha.estacaoId)?.nome || "Linha sem estação";
  }

  function trocarNumero(linhaId, numero) {
    setLinhas((atuais) => atuais.map((l) => (l.id === linhaId ? { ...l, numero } : l)));
    setErro("");
  }

  // Só quem atende pode ser escalado (supervisão e diretoria acompanham)
  const atendentes = estado.atendentes.filter((a) => (a.papel || "atendente") === "atendente");

  // Troca UMA célula da escala, sem mexer no resto (imutável, como no reducer)
  function escalar(estacaoId, turnoId, atendenteId) {
    setEstacoes((atuais) =>
      atuais.map((e) => (e.id === estacaoId ? { ...e, escala: { ...e.escala, [turnoId]: atendenteId || null } } : e)),
    );
  }

  async function salvar(evento) {
    evento.preventDefault(); // quem fecha a janela somos nós, só se der certo
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return setErro("O nome da empresa não pode ficar vazio.");

    setSalvando(true);
    try {
      await salvarConfiguracoes(token, {
        marca: { nome: nomeLimpo },
        estacoes: estacoes.map((e) => ({ id: e.id, escala: e.escala })),
        // O servidor tira os espaços, o "+" e o "-": fica só o número
        linhas: linhas.map((l) => ({ id: l.id, numero: l.numero })),
      });
      await recarregar(); // o nome novo, a escala e os números aparecem no app
      avisar(despachar, "Configurações salvas");
      dialogo.current?.close();
    } catch (problema) {
      // A mensagem vem pronta do servidor ("Duas linhas não podem ter o mesmo número.")
      setErro(problema.message);
      setSalvando(false);
    }
  }

  return (
    <dialog className="confirmacao configuracoes" ref={dialogo} onClose={aoFechar} aria-labelledby="titulo-config">
      <form onSubmit={salvar}>
        <h2 className="confirmacao__titulo" id="titulo-config">
          Configurações
        </h2>

        {estacoes === null ? (
          <p className="config__dica">{erro || "Carregando configurações…"}</p>
        ) : (
          <>
            <section className="config__secao">
              <h3>Empresa</h3>
              <label className="config__campo">
                <span>Nome que aparece no sistema</span>
                <input
                  type="text"
                  maxLength={40}
                  value={nome}
                  onChange={(evento) => {
                    setNome(evento.target.value);
                    setErro("");
                  }}
                />
              </label>
            </section>

            <section className="config__secao">
              <h3>Escala de turnos</h3>
              <p className="config__dica">
                Quem entra com o e-mail de uma estação é a pessoa escalada para o turno daquele horário. É esse nome que
                aparece nas mensagens e na auditoria.
              </p>

              {/* Uma tabela de verdade: estações nas linhas, turnos nas colunas */}
              <div className="escala">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Estação</th>
                      {TURNOS.map((t) => (
                        <th key={t.id} scope="col">
                          {t.nome}
                          <small>
                            {t.inicio}h às {t.fim}h
                          </small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {estacoes.map((estacao) => (
                      <tr key={estacao.id}>
                        <th scope="row">{estacao.nome}</th>
                        {TURNOS.map((t) => (
                          <td key={t.id}>
                            <select
                              aria-label={`${estacao.nome}, turno da ${t.nome.toLowerCase()}`}
                              value={estacao.escala?.[t.id] || ""}
                              onChange={(evento) => escalar(estacao.id, t.id, evento.target.value)}
                            >
                              <option value="">Ninguém</option>
                              {atendentes.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="config__dica">A escala vale para os próximos logins: quem já entrou continua até sair.</p>
            </section>

            <section className="config__secao">
              <h3>Números de WhatsApp</h3>
              <p className="config__dica">
                Cada estação atende por um número. Supervisão e diretoria têm o número exclusivo delas. Use o DDD e o 55
                do Brasil.
              </p>
              <div className="config__numeros">
                {linhas.map((linha) => (
                  <label key={linha.id} className="config__campo">
                    <span>{nomeDaLinha(linha)}</span>
                    {/* type="tel": no celular, abre o teclado de números */}
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="+55 21 99999-0001"
                      value={linha.numero}
                      onChange={(evento) => trocarNumero(linha.id, evento.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>

            {erro && (
              <p className="etiquetas__erro" role="alert">
                {erro}
              </p>
            )}
          </>
        )}

        <div className="confirmacao__botoes">
          <button type="button" onClick={() => dialogo.current.close()}>
            Cancelar
          </button>
          <button type="submit" className="confirmacao__ok" disabled={estacoes === null || salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
