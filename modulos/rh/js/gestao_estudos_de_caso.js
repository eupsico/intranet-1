// modulos/rh/js/gestao_estudos_de_caso.js

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicialização e Referências
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error(
      "ERRO: O SDK do Firebase não está carregado ou configurado corretamente."
    );
    alert(
      "Erro de inicialização: O sistema de banco de dados não está disponível."
    );
    return;
  }

  const db = firebase.firestore();
  const COLECAO_ESTUDOS = "estudos_de_caso";

  // Referências do DOM - Abas
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  // Referências do DOM - Criar Novo
  const formNovoEstudo = document.getElementById("form-novo-estudo");
  const listaPerguntas = document.getElementById("lista-perguntas");
  const btnAdicionarPergunta = document.getElementById(
    "btn-adicionar-pergunta"
  );

  // Referências do DOM - Modelos Salvos
  const listaModelosSalvos = document.getElementById("lista-modelos-salvos");
  const modalGerarLink = document.getElementById("modal-gerar-link");
  const linkPublicoInput = document.getElementById("link-publico");
  const btnCopiarLink = document.getElementById("btn-copiar-link");
  const btnFecharModalLink = document.querySelector(".fechar-modal-link");

  let proximoIdPergunta = 2; // Começa em 2 porque o HTML já tem a Pergunta 1

  // =================================================================
  // 2. Lógica de Abas
  // =================================================================
  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetTab = link.getAttribute("data-tab");

      // Remove 'active' de todos os links e conteúdos
      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));

      // Adiciona 'active' ao link clicado e exibe o conteúdo
      link.classList.add("active");
      document.getElementById(`tab-${targetTab}`).style.display = "block";

      // Se for para a aba de Modelos Salvos, recarrega a lista
      if (targetTab === "modelos-salvos") {
        carregarModelosSalvos();
      }
    });
  });

  // =================================================================
  // 3. Lógica de CRUD Local (Perguntas)
  // =================================================================

  /**
   * Cria e adiciona um novo campo de pergunta ao formulário.
   */
  function adicionarCampoPergunta() {
    const perguntaId = proximoIdPergunta++;
    const newPerguntaDiv = document.createElement("div");
    newPerguntaDiv.classList.add("pergunta-item", "form-group");
    newPerguntaDiv.setAttribute("data-pergunta-id", perguntaId);

    newPerguntaDiv.innerHTML = `
            <label for="pergunta-${perguntaId}">Pergunta ${perguntaId}:</label>
            <div class="input-group">
                <textarea
                    class="pergunta-texto form-control"
                    data-id="${perguntaId}"
                    rows="2"
                    placeholder="Ex: Qual seria sua primeira ação neste cenário?"
                    required
                ></textarea>
                <button type="button" class="btn btn-danger btn-sm btn-remover-pergunta ms-2" title="Remover Pergunta">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    listaPerguntas.appendChild(newPerguntaDiv);

    // Adicionar evento de remoção
    newPerguntaDiv
      .querySelector(".btn-remover-pergunta")
      .addEventListener("click", function () {
        newPerguntaDiv.remove();
        reordenarPerguntas();
      });
  }

  /**
   * Reordena os labels das perguntas após uma remoção.
   */
  function reordenarPerguntas() {
    const itens = listaPerguntas.querySelectorAll(".pergunta-item");
    itens.forEach((item, index) => {
      const numero = index + 1;
      item.querySelector("label").textContent = `Pergunta ${numero}:`;
      item.querySelector("textarea").setAttribute("data-id", numero);
      item.querySelector("textarea").id = `pergunta-${numero}`;
    });
    proximoIdPergunta = itens.length + 1;
  }

  btnAdicionarPergunta.addEventListener("click", adicionarCampoPergunta);

  // Adiciona listener de remoção para a primeira pergunta (se ela tiver botão de remoção)
  listaPerguntas.querySelectorAll(".btn-remover-pergunta").forEach((btn) => {
    btn.addEventListener("click", function () {
      btn.closest(".pergunta-item").remove();
      reordenarPerguntas();
    });
  });

  // =================================================================
  // 4. Lógica de Persistência (Criação/Edição)
  // =================================================================

  /**
   * Salva ou atualiza o modelo de estudo de caso/avaliação.
   */
  async function salvarModelo(e) {
    e.preventDefault();

    const btn = formNovoEstudo.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

    const titulo = document.getElementById("conteudo-titulo").value.trim();
    const tipo = document.getElementById("conteudo-tipo").value;
    const textoConteudo = document
      .getElementById("conteudo-texto")
      .value.trim();

    // Coleta as perguntas
    const perguntas = Array.from(
      listaPerguntas.querySelectorAll(".pergunta-texto")
    )
      .map((textarea) => textarea.value.trim())
      .filter((pergunta) => pergunta.length > 0);

    const dadosModelo = {
      titulo: titulo,
      tipo: tipo,
      conteudo_texto: textoConteudo,
      perguntas: perguntas,
      data_criacao: firebase.firestore.FieldValue.serverTimestamp(),
      criado_por_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
      // Adicionar campo para controlar se o modelo está ativo (pode ser usado para soft delete)
      ativo: true,
    };

    try {
      // Em um cenário real, aqui seria verificada se é uma edição ou uma nova criação.
      // Para simplificar, estamos fazendo apenas a criação (POST).
      const docRef = await db.collection(COLECAO_ESTUDOS).add(dadosModelo);

      alert(`Modelo "${tipo}" salvo com sucesso! ID: ${docRef.id}`);

      formNovoEstudo.reset();
      listaPerguntas.innerHTML = ""; // Limpa as perguntas após salvar (e adiciona a primeira de novo se necessário)
      proximoIdPergunta = 1;
      adicionarCampoPergunta(); // Adiciona um campo vazio para o próximo uso

      // Alternar para a aba de modelos salvos para visualização
      document.querySelector('[data-tab="modelos-salvos"]').click();
    } catch (error) {
      console.error("Erro ao salvar modelo:", error);
      alert("Erro ao salvar o modelo de avaliação. Detalhes: " + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';
    }
  }

  // Listener de submissão do formulário
  formNovoEstudo.addEventListener("submit", salvarModelo);

  // =================================================================
  // 5. Lógica de Listagem e Ações
  // =================================================================

  /**
   * Carrega os modelos salvos do Firebase e exibe na tabela.
   */
  async function carregarModelosSalvos() {
    listaModelosSalvos.innerHTML =
      '<p><i class="fas fa-spinner fa-spin me-2"></i> Buscando modelos...</p>';

    try {
      const snapshot = await db
        .collection(COLECAO_ESTUDOS)
        .where("ativo", "==", true)
        .orderBy("data_criacao", "desc")
        .get();

      if (snapshot.empty) {
        listaModelosSalvos.innerHTML =
          '<p class="alert alert-info">Nenhum modelo de avaliação salvo ainda.</p>';
        return;
      }

      let htmlTabela = `
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Tipo</th>
                            <th>Perguntas</th>
                            <th>Criação</th>
                            <th class="text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

      snapshot.forEach((doc) => {
        const modelo = doc.data();
        const dataFormatada = formatarTimestamp(modelo.data_criacao);
        const numPerguntas = modelo.perguntas ? modelo.perguntas.length : 0;

        htmlTabela += `
                    <tr data-id="${doc.id}" data-tipo="${modelo.tipo}">
                        <td>${modelo.titulo}</td>
                        <td>${modelo.tipo.replace(/-/g, " ").toUpperCase()}</td>
                        <td>${numPerguntas}</td>
                        <td>${dataFormatada}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-info btn-editar-modelo me-2" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-primary btn-gerar-link me-2" title="Gerar Link Público">
                                <i class="fas fa-link"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger btn-excluir-modelo" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
      });

      htmlTabela += `</tbody></table>`;
      listaModelosSalvos.innerHTML = htmlTabela;

      // Adicionar listeners aos botões de ação
      document.querySelectorAll(".btn-gerar-link").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.closest("tr").getAttribute("data-id");
          const tipo = e.currentTarget.closest("tr").getAttribute("data-tipo");
          abrirModalGerarLink(id, tipo);
        });
      });

      document.querySelectorAll(".btn-excluir-modelo").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.closest("tr").getAttribute("data-id");
          excluirModelo(id);
        });
      });

      // TODO: Implementar lógica de edição
      document.querySelectorAll(".btn-editar-modelo").forEach((btn) => {
        btn.addEventListener("click", () =>
          alert("Funcionalidade de Edição Pendente.")
        );
      });
    } catch (error) {
      console.error("Erro ao carregar modelos salvos:", error);
      listaModelosSalvos.innerHTML =
        '<p class="alert alert-danger">Erro ao carregar os modelos. Tente recarregar a página.</p>';
    }
  }

  /**
   * Remove (soft delete) um modelo do Firebase.
   * @param {string} id - O ID do documento a ser excluído.
   */
  async function excluirModelo(id) {
    if (!confirm("Tem certeza que deseja excluir (desativar) este modelo?")) {
      return;
    }

    try {
      // Soft delete: Marca como inativo em vez de remover totalmente
      await db.collection(COLECAO_ESTUDOS).doc(id).update({
        ativo: false,
        data_exclusao: firebase.firestore.FieldValue.serverTimestamp(),
      });

      alert("Modelo excluído com sucesso (marcado como inativo)!");
      carregarModelosSalvos(); // Recarrega a lista
    } catch (error) {
      console.error("Erro ao excluir modelo:", error);
      alert("Erro ao excluir o modelo. Detalhes: " + error.message);
    }
  }

  // =================================================================
  // 6. Lógica de Geração de Link (Modal)
  // =================================================================

  /**
   * Abre o modal e gera o link público para a avaliação.
   * @param {string} id - ID do documento (Estudo de Caso).
   * @param {string} tipo - Tipo de avaliação.
   */
  function abrirModalGerarLink(id, tipo) {
    // O link público deve apontar para uma página externa que consome este ID
    // Exemplo: https://meuapp.com/avaliacoes/publico.html?tipo=estudo-caso&id=DOCUMENT_ID
    const urlBase = window.location.origin.replace("intranet", "public"); // Ajuste conforme seu domínio público
    const link = `${urlBase}/avaliacao-publica.html?tipo=${tipo}&id=${id}`;

    linkPublicoInput.value = link;
    modalGerarLink.style.display = "flex";

    // Foco no campo para facilitar a cópia
    setTimeout(() => linkPublicoInput.select(), 100);
  }

  /**
   * Fecha o modal de geração de link.
   */
  function fecharModalGerarLink() {
    modalGerarLink.style.display = "none";
  }

  // Listeners do Modal
  btnFecharModalLink.addEventListener("click", fecharModalGerarLink);

  btnCopiarLink.addEventListener("click", () => {
    linkPublicoInput.select();
    document.execCommand("copy");
    btnCopiarLink.textContent = "Copiado!";
    setTimeout(
      () =>
        (btnCopiarLink.innerHTML = '<i class="fas fa-copy"></i> Copiar Link'),
      2000
    );
  });

  // Função de utilidade
  function formatarTimestamp(timestamp) {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("pt-BR");
  }

  // Inicialização: Garante que a primeira pergunta exista ao carregar
  if (listaPerguntas.children.length === 0) {
    adicionarCampoPergunta();
    // Remove o botão de remoção do primeiro item para garantir que sempre haja pelo menos um campo vazio.
    listaPerguntas.querySelector(".btn-remover-pergunta")?.remove();
    proximoIdPergunta = 2;
  }
});
