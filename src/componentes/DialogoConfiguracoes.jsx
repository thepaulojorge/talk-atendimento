import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { TURNOS } from "../configuracao.js";

/* Configurações da empresa (só a diretoria abre esta janela):
   - o nome que aparece no topo, no login e na aba (white-label)
   - a escala: quem cobre cada turno em cada estação

   As mudanças ficam num RASCUNHO local até clicar em "Salvar".
   Assim "Cancelar" (ou Esc) desfaz tudo sem nenhum código extra */
export default function DialogoConfiguracoes({ aoFechar }) {
  const { estado, despachar } = useEstado();
  const dialogo = useRef(null);

  /* useState com uma FUNÇÃO: o valor inicial é calculado só uma vez,
     quando a janela abre. structuredClone: um rascunho independente,
     mexer nele não mexe no estado de verdade */
  const [nome, setNome] = useState(estado.marca.nome);
  const [estacoes, setEstacoes] = useState(() => structuredClone(estado.estacoes));
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  // Só quem atende pode ser escalado (supervisão e diretoria acompanham)
  const atendentes = estado.atendentes.filter((a) => (a.papel || "atendente") === "atendente");

  // Troca UMA célula da escala, sem mexer no resto (imutável, como no reducer)
  function escalar(estacaoId, turnoId, atendenteId) {
    setEstacoes((atuais) =>
      atuais.map((e) => (e.id === estacaoId ? { ...e, escala: { ...e.escala, [turnoId]: atendenteId || null } } : e))
    );
  }

  function salvar(evento) {
    evento.preventDefault(); // quem fecha a janela somos nós, só se der certo
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return setErro("O nome da empresa não pode ficar vazio.");

    despachar({ tipo: "salvarConfiguracoes", marca: { ...estado.marca, nome: nomeLimpo }, estacoes });
    avisar(despachar, "Configurações salvas");
    dialogo.current.close();
  }

  return (
    <dialog className="confirmacao configuracoes" ref={dialogo} onClose={aoFechar} aria-labelledby="titulo-config">
      <form onSubmit={salvar}>
        <h2 className="confirmacao__titulo" id="titulo-config">
          Configurações
        </h2>

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
          {erro && (
            <p className="etiquetas__erro" role="alert">
              {erro}
            </p>
          )}
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

        <div className="confirmacao__botoes">
          <button type="button" onClick={() => dialogo.current.close()}>
            Cancelar
          </button>
          <button type="submit" className="confirmacao__ok">
            Salvar
          </button>
        </div>
      </form>
    </dialog>
  );
}
