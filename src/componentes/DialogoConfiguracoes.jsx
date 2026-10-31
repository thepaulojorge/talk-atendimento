import { useCallback, useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { buscarConfiguracoes, criarEstacao, salvarEstacao, salvarLinha, salvarMarca } from "../api.js";
import { ehDiretoria } from "../utilidades/permissoes.js";
import { formatarNumero, normalizar, somenteDigitos } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";

const NOMES_EXCLUSIVAS = { supervisor: "Supervisão", diretoria: "Diretoria" };

/* CONFIGURAÇÕES (supervisão e diretoria):
   - Estações: cada uma com o e-mail e a senha do login, o número de
     WhatsApp e o ID na Meta. Entrou com o e-mail da estação, já está nela
   - Números exclusivos: o da supervisão e o da diretoria
   - Empresa: o nome que aparece no sistema (só a diretoria muda)

   Cada coisa é salva separadamente, na hora (sem um "Salvar" geral):
   com 70 estações, salvar tudo de uma vez seria arriscado e lento */
export default function DialogoConfiguracoes({ aoFechar }) {
  const { estado, despachar } = useEstado();
  const dialogo = useRef(null);
  const token = estado.sessao?.token;
  const diretoria = ehDiretoria(estado);

  const [config, setConfig] = useState(null); // null = carregando
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  // A estação no formulário: null = mostrando a lista; { ... } = editando (id vazio = nova)
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  // Busca (ou busca de novo, depois de salvar) tudo o que a tela mostra
  const carregar = useCallback(
    () =>
      buscarConfiguracoes(token)
        .then(setConfig)
        .catch((problema) => setErro(problema.message)),
    [token],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  /* A busca acha pelo texto (nome, sigla, e-mail) ou pelo NÚMERO em
     qualquer formato: "99000-0045", "21 990000045"... Para o número,
     comparamos só os dígitos dos dois lados */
  const termo = normalizar(busca);
  const digitos = somenteDigitos(busca);
  const combina = (e) =>
    normalizar(`${e.nome} ${e.sigla} ${e.email}`).includes(termo) || (digitos.length >= 3 && e.numero.includes(digitos));
  const estacoes = (config?.estacoes ?? [])
    .filter((e) => !termo || combina(e))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));

  function novaEstacao() {
    // Sugere a próxima sigla e o próximo nome: "Estação 71" / "E71"
    const proximo = String((config?.estacoes.length ?? 0) + 1).padStart(2, "0");
    setEditando({
      id: "",
      nome: `Estação ${proximo}`,
      sigla: `E${proximo}`,
      email: "",
      senha: "",
      numero: "",
      whatsappId: "",
      ativa: true,
    });
  }

  return (
    <dialog className="confirmacao configuracoes" ref={dialogo} onClose={aoFechar} aria-labelledby="titulo-config">
      <div className="config__topo">
        <h2 className="confirmacao__titulo" id="titulo-config">
          Configurações
        </h2>
        <button type="button" className="config__fechar" aria-label="Fechar" onClick={() => dialogo.current.close()}>
          <Icone nome="fechar" />
        </button>
      </div>

      {!config ? (
        <p className="config__dica">{erro || "Carregando configurações…"}</p>
      ) : editando ? (
        <FormularioEstacao
          inicial={editando}
          aoVoltar={() => setEditando(null)}
          aoSalvar={async (dados) => {
            if (dados.id) await salvarEstacao(token, dados.id, dados);
            else await criarEstacao(token, dados);
            avisar(despachar, dados.id ? `${dados.nome} salva` : `${dados.nome} criada`);
            await carregar();
            setEditando(null);
          }}
        />
      ) : (
        <>
          <section className="config__secao">
            <div className="config__secao-topo">
              <h3>Estações ({config.estacoes.length})</h3>
              <button type="button" className="config__botao" onClick={novaEstacao}>
                <Icone nome="adicionar" /> Nova estação
              </button>
            </div>
            <p className="config__dica">
              O login de cada estação é o e-mail dela (criado pela empresa). Quem entra com ele já está na estação, com
              o número dela.
            </p>
            <input
              type="search"
              className="config__busca"
              placeholder="Buscar por nome, sigla, e-mail ou número"
              aria-label="Buscar estação"
              autoComplete="off"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
            <ul className="config__estacoes">
              {estacoes.length === 0 && <li className="lista-vazia">Nenhuma estação encontrada</li>}
              {estacoes.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    // O número vem só com dígitos: no formulário, já formatado ("+55 21 99000-0001")
                    onClick={() => setEditando({ ...e, numero: e.numero ? formatarNumero(e.numero) : "", senha: "" })}
                  >
                    <span className="estacao__sigla">{e.sigla}</span>
                    <span className="config__estacao-info">
                      <strong>
                        {e.nome}
                        {e.whatsappId && <span className="selo selo--whatsapp">WhatsApp</span>}
                        {!e.ativa && <span className="selo selo--desativada">Login bloqueado</span>}
                      </strong>
                      <span>
                        {e.email} · {e.numero ? formatarNumero(e.numero) : "sem número"}
                      </span>
                    </span>
                    <Icone nome="lapis" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="config__secao">
            <h3>Números exclusivos</h3>
            <p className="config__dica">O número da supervisão e o da diretoria (só elas veem essas conversas).</p>
            <div className="config__numeros">
              {config.exclusivas.map((linha) => (
                <LinhaExclusiva
                  key={linha.id}
                  linha={linha}
                  aoSalvar={async (dados) => {
                    await salvarLinha(token, linha.id, dados);
                    avisar(despachar, `Número da ${NOMES_EXCLUSIVAS[linha.papel]} salvo`);
                    await carregar();
                  }}
                />
              ))}
            </div>
          </section>

          <section className="config__secao">
            <h3>Empresa</h3>
            {diretoria ? (
              <NomeDaEmpresa
                inicial={config.marca.nome}
                aoSalvar={async (nome) => {
                  await salvarMarca(token, nome);
                  avisar(despachar, "Nome da empresa salvo");
                }}
              />
            ) : (
              <p className="config__dica">
                Nome no sistema: <strong>{config.marca.nome}</strong> (só a diretoria muda).
              </p>
            )}
          </section>
        </>
      )}
    </dialog>
  );
}

/* Guarda "salvando" e "erro" de um formulário. Recebe a função que salva
   e devolve outra, que já cuida de tudo: botão desligado, mensagem de erro */
function useSalvar(salvar) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(...argumentos) {
    setSalvando(true);
    setErro("");
    try {
      await salvar(...argumentos);
    } catch (problema) {
      setErro(problema.message); // a mensagem vem pronta do servidor
    } finally {
      setSalvando(false);
    }
  }
  return { salvando, erro, enviar, limparErro: () => setErro("") };
}

/* O formulário de UMA estação (nova ou existente) */
function FormularioEstacao({ inicial, aoVoltar, aoSalvar }) {
  const [dados, setDados] = useState(inicial);
  const { salvando, erro, enviar, limparErro } = useSalvar(aoSalvar);
  const nova = !inicial.id;

  // Um "onChange" para todos os campos: o name do input diz qual campo mudou
  function mudar(evento) {
    const { name, value, type, checked } = evento.target;
    setDados((atuais) => ({ ...atuais, [name]: type === "checkbox" ? checked : value }));
    limparErro();
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    enviar(dados);
  }

  return (
    <form className="config__formulario" onSubmit={aoEnviar}>
      <button type="button" className="config__voltar" onClick={aoVoltar}>
        <Icone nome="voltar" /> Voltar para a lista
      </button>
      <h3>{nova ? "Nova estação" : dados.nome}</h3>

      <div className="config__grade">
        <Campo rotulo="Nome" name="nome" value={dados.nome} onChange={mudar} maxLength={40} required />
        <Campo rotulo="Sigla (até 5)" name="sigla" value={dados.sigla} onChange={mudar} maxLength={5} required />
        <Campo rotulo="E-mail do login" name="email" type="email" value={dados.email} onChange={mudar} required />
        <Campo
          rotulo={nova ? "Senha" : "Nova senha (vazio = não muda)"}
          name="senha"
          type="password"
          autoComplete="new-password"
          value={dados.senha}
          onChange={mudar}
          minLength={6}
          required={nova}
        />
        <Campo
          rotulo="Número de WhatsApp"
          name="numero"
          type="tel"
          placeholder="+55 21 99999-0001"
          value={dados.numero}
          onChange={mudar}
          required
        />
        <Campo
          rotulo="ID na Meta (opcional)"
          name="whatsappId"
          inputMode="numeric"
          placeholder="Phone Number ID"
          value={dados.whatsappId}
          onChange={mudar}
        />
      </div>

      {!nova && (
        <label className="config__ativa">
          <input type="checkbox" name="ativa" checked={dados.ativa} onChange={mudar} />
          Login liberado (desmarque para bloquear a entrada sem apagar o histórico da estação)
        </label>
      )}

      {erro && (
        <p className="etiquetas__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="confirmacao__botoes">
        <button type="button" onClick={aoVoltar}>
          Cancelar
        </button>
        <button type="submit" className="confirmacao__ok" disabled={salvando}>
          {salvando ? "Salvando…" : nova ? "Criar estação" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Campo({ rotulo, ...props }) {
  return (
    <label className="config__campo">
      <span>{rotulo}</span>
      <input autoComplete="off" {...props} />
    </label>
  );
}

/* O número da supervisão ou da diretoria, com o próprio "Salvar" */
function LinhaExclusiva({ linha, aoSalvar }) {
  const [numero, setNumero] = useState(formatarNumero(linha.numero));
  const [whatsappId, setWhatsappId] = useState(linha.whatsappId);
  const { salvando, erro, enviar, limparErro } = useSalvar(aoSalvar);

  return (
    <form
      className="config__linha"
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar({ numero, whatsappId });
      }}
    >
      <strong>
        {NOMES_EXCLUSIVAS[linha.papel]}
        {linha.whatsappId && <span className="selo selo--whatsapp">WhatsApp</span>}
      </strong>
      <Campo
        rotulo="Número"
        type="tel"
        value={numero}
        onChange={(e) => {
          setNumero(e.target.value);
          limparErro();
        }}
        required
      />
      <Campo
        rotulo="ID na Meta (opcional)"
        inputMode="numeric"
        value={whatsappId}
        onChange={(e) => {
          setWhatsappId(e.target.value);
          limparErro();
        }}
      />
      {erro && (
        <p className="etiquetas__erro" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" className="config__botao" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

/* O nome da empresa (white-label), com o próprio "Salvar" */
function NomeDaEmpresa({ inicial, aoSalvar }) {
  const [nome, setNome] = useState(inicial);
  const { salvando, erro, enviar, limparErro } = useSalvar(aoSalvar);

  return (
    <form
      className="config__empresa"
      onSubmit={(evento) => {
        evento.preventDefault();
        enviar(nome.trim());
      }}
    >
      <Campo
        rotulo="Nome que aparece no sistema"
        value={nome}
        maxLength={40}
        onChange={(e) => {
          setNome(e.target.value);
          limparErro();
        }}
        required
      />
      <button type="submit" className="config__botao" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {erro && (
        <p className="etiquetas__erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
