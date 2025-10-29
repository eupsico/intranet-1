// modulos/rh/js/gestao_estudos_de_caso.js
import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc,
  arrayUnion, // Adicionado para persistência (embora não usado em todo este bloco)
} from "../../../assets/js/firebase-init.js";

// =====================================================================
// CONSTANTES E VARIÁVEIS GLOBAIS
// =====================================================================

const ESTUDOS_COLLECTION_NAME = "estudos_de_caso";
const estudosCollection = collection(db, ESTUDOS_COLLECTION_NAME);

// Elementos do DOM do HTML (modulos/rh/page/gestao_estudos_de_caso.html)
const formNovoEstudo = document.getElementById("form-novo-estudo");
const listaPerguntas = document.getElementById("lista-perguntas");
const btnAdicionarPergunta = document.getElementById("btn-adicionar-pergunta");
const listaModelosSalvos = document.getElementById("lista-modelos-salvos");
const modalGerarLink = document.getElementById("modal-gerar-link");

let perguntaCounter = 0; // Inicia em 0 e será corrigido pela função init

// =====================================================================
// FUNÇÕES AUXILIARES DE UI E FLUXO
// =====================================================================

/**
 * Adiciona um novo campo de textarea para pergunta ao formulário.
 */
function adicionarCampoPergunta(texto = "") {
  perguntaCounter++;
  const novoCampo = document.createElement("div");
  novoCampo.className = "pergunta-item form-group";
  novoCampo.innerHTML = `
        <label for="pergunta-${perguntaCounter}">Pergunta ${perguntaCounter}:</label>
        <textarea class="pergunta-texto" data-id="${perguntaCounter}" rows="2" placeholder="Digite o texto da pergunta.">${texto}</textarea>
        <button type="button" class="btn btn-sm btn-danger btn-remover-pergunta" style="margin-top: 5px;">
            <i class="fas fa-trash"></i> Remover
        </button>
    `;
  listaPerguntas.appendChild(novoCampo);

  // Adicionar evento de remoção
  novoCampo
    .querySelector(".btn-remover-pergunta")
    .addEventListener("click", (e) => {
      novoCampo.remove();
      atualizarNumeracaoPerguntas();
    });
}

/**
 * Atualiza a numeração das labels de pergunta após remoção.
 */
function atualizarNumeracaoPerguntas() {
  const itens = listaPerguntas.querySelectorAll(".pergunta-item");
  let count = 1;
  let maxId = 0;

  itens.forEach((item) => {
    const label = item.querySelector("label");
    const textarea = item.querySelector("textarea");
    if (label) label.textContent = `Pergunta ${count}:`;
    if (textarea) textarea.setAttribute("data-id", count);

    maxId = count;
    count++;
  });
  perguntaCounter = maxId;
}

/**
 * Lida com o clique nas abas (Criar Novo vs. Modelos Salvos).
 */
function handleTabClick(e) {
  const targetTab = e.currentTarget.getAttribute("data-tab");

  document
    .querySelectorAll(".content-tabs .tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  e.currentTarget.classList.add("active");

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.style.display = "none";
  });

  const contentArea = document.getElementById(`tab-${targetTab}`);
  if (contentArea) {
    contentArea.style.display = "block";
    if (targetTab === "modelos-salvos") {
      carregarModelosSalvos();
    } else if (targetTab === "criar-novo") {
      // Limpar formulário ao voltar para a criação
      formNovoEstudo.reset();
      formNovoEstudo.removeAttribute("data-modelo-id");
      listaPerguntas.innerHTML = "";
      perguntaCounter = 0;
      adicionarCampoPergunta();
    }
  }
}

/**
 * Lida com a abertura do modal de geração de link.
 */
function handleGerarLink(e) {
  const modeloId = e.currentTarget.getAttribute("data-id");
  const linkInput = document.getElementById("link-publico");
  // Base do link público (Deve ser o URL de acesso do candidato)
  const linkBase = `${window.location.origin}/public/estudo-de-caso.html?id=${modeloId}`;

  if (linkInput) {
    linkInput.value = linkBase;
  }

  // Configura o evento de cópia
  document.getElementById("btn-copiar-link").onclick = async () => {
    try {
      await navigator.clipboard.writeText(linkBase);
      window.showToast("Link copiado para a área de transferência!", "success");
    } catch (err) {
      console.error("Falha ao copiar link:", err);
      window.showToast(
        "Falha ao copiar link (permita o acesso à área de transferência).",
        "error"
      );
    }
  };

  if (modalGerarLink) {
    modalGerarLink.style.display = "flex";
    // Configura o botão de fechar
    modalGerarLink.querySelector(".fechar-modal-link").onclick = () => {
      modalGerarLink.style.display = "none";
    };
  }
}

/**
 * Lida com a exclusão de um modelo.
 */
async function handleExcluirModelo(e) {
  const modeloId = e.currentTarget.getAttribute("data-id");
  if (!confirm("Tem certeza que deseja excluir este modelo permanentemente?"))
    return;

  try {
    await deleteDoc(doc(estudosCollection, modeloId));
    window.showToast("Modelo excluído com sucesso!", "success");
    carregarModelosSalvos();
  } catch (error) {
    console.error("Erro ao excluir modelo:", error);
    window.showToast("Erro ao excluir modelo.", "error");
  }
}

/**
 * Lida com a edição de um modelo (carrega os dados no formulário de criação).
 */
async function handleEditarModelo(e) {
  const modeloId = e.currentTarget.getAttribute("data-id");

  try {
    const docSnap = await getDoc(doc(estudosCollection, modeloId));
    if (!docSnap.exists()) {
      window.showToast("Modelo não encontrado.", "error");
      return;
    }
    const modelo = docSnap.data();

    // 1. Preenche dados básicos
    document.getElementById("conteudo-titulo").value = modelo.titulo || "";
    document.getElementById("conteudo-tipo").value = modelo.tipo || "";
    document.getElementById("conteudo-texto").value = modelo.conteudo || "";
    formNovoEstudo.setAttribute("data-modelo-id", docSnap.id);

    // 2. Preenche perguntas
    listaPerguntas.innerHTML = "";
    perguntaCounter = 0;
    if (modelo.perguntas && modelo.perguntas.length > 0) {
      modelo.perguntas.forEach((p) => adicionarCampoPergunta(p.texto));
    } else {
      adicionarCampoPergunta();
    }

    // 3. Troca para a aba de criação/edição
    document
      .querySelector('.content-tabs .tab-link[data-tab="criar-novo"]')
      .click();
  } catch (error) {
    console.error("Erro ao carregar modelo para edição:", error);
    window.showToast("Erro ao carregar modelo para edição.", "error");
  }
}

// =====================================================================
// FUNÇÕES CRUD E DE LÓGICA DE NEGÓCIO
// =====================================================================

/**
 * Converte o formulário de perguntas em um array estruturado.
 */
function extrairPerguntasDoForm() {
  const perguntas = [];
  const itens = listaPerguntas.querySelectorAll(".pergunta-item");
  itens.forEach((item, index) => {
    const textarea = item.querySelector(".pergunta-texto");
    if (textarea && textarea.value.trim()) {
      perguntas.push({
        texto: textarea.value.trim(),
        id: index + 1,
      });
    }
  });
  return perguntas;
}

/**
 * Lida com a submissão do formulário de criação/edição de modelo de conteúdo.
 */
async function handleSalvarModelo(e) {
  e.preventDefault();

  const titulo = document.getElementById("conteudo-titulo").value.trim();
  const tipo = document.getElementById("conteudo-tipo").value;
  const texto = document.getElementById("conteudo-texto").value.trim();
  const perguntas = extrairPerguntasDoForm();
  const modeloId = formNovoEstudo.getAttribute("data-modelo-id");
  const isEditing = !!modeloId;

  if (!titulo || !tipo) {
    window.showToast("Título e Tipo de Avaliação são obrigatórios.", "warning");
    return;
  }

  const modeloData = {
    titulo: titulo,
    tipo: tipo,
    conteudo: texto,
    perguntas: perguntas,
    dataAtualizacao: new Date(),
    // TODO: Adicionar usuário criador
  };

  try {
    if (isEditing) {
      await updateDoc(doc(estudosCollection, modeloId), modeloData);
      window.showToast(
        "Modelo de avaliação atualizado com sucesso!",
        "success"
      );
    } else {
      modeloData.dataCriacao = new Date();
      await addDoc(estudosCollection, modeloData);
      window.showToast("Modelo de avaliação salvo com sucesso!", "success");
    }

    // Limpar e redirecionar
    formNovoEstudo.reset();
    formNovoEstudo.removeAttribute("data-modelo-id");
    listaPerguntas.innerHTML = "";
    perguntaCounter = 0;
    adicionarCampoPergunta();

    // Vai para a aba de modelos salvos
    document
      .querySelector('.content-tabs .tab-link[data-tab="modelos-salvos"]')
      .click();
  } catch (error) {
    console.error("Erro ao salvar modelo de avaliação:", error);
    window.showToast("Erro ao salvar modelo. Tente novamente.", "error");
  }
}

/**
 * Carrega e renderiza todos os modelos salvos.
 */
async function carregarModelosSalvos() {
  listaModelosSalvos.innerHTML =
    '<div class="loading-spinner">Carregando modelos salvos...</div>';

  try {
    const snapshot = await getDocs(estudosCollection);

    if (snapshot.empty) {
      listaModelosSalvos.innerHTML =
        '<p class="alert alert-info">Nenhum modelo de avaliação encontrado.</p>';
      return;
    }

    let html = "";
    snapshot.docs.forEach((doc) => {
      const modelo = doc.data();
      const numPerguntas = modelo.perguntas ? modelo.perguntas.length : 0;

      html += `
                <div class="card card-modelo" data-id="${doc.id}">
                    <h4>${modelo.titulo}</h4>
                    <p>Tipo: <strong>${modelo.tipo}</strong> | Perguntas: ${numPerguntas}</p>
                    <div class="rh-card-actions">
                        <button class="btn btn-sm btn-primary btn-gerar-link" data-id="${doc.id}">
                            <i class="fas fa-link"></i> Gerar Link Público
                        </button>
                        <button class="btn btn-sm btn-info btn-editar-modelo" data-id="${doc.id}">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger btn-excluir-modelo" data-id="${doc.id}">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
    });

    listaModelosSalvos.innerHTML = html;

    // Configura eventos nos botões recém-criados
    document.querySelectorAll(".btn-gerar-link").forEach((btn) => {
      btn.addEventListener("click", handleGerarLink);
    });
    document.querySelectorAll(".btn-excluir-modelo").forEach((btn) => {
      btn.addEventListener("click", handleExcluirModelo);
    });
    document.querySelectorAll(".btn-editar-modelo").forEach((btn) => {
      btn.addEventListener("click", handleEditarModelo);
    });
  } catch (error) {
    console.error("Erro ao carregar modelos salvos:", error);
    listaModelosSalvos.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar modelos.</p>';
  }
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================

/**
 * Ponto de entrada do módulo.
 */
export async function initGestaoEstudos(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Estudos e Testes...");

  // 1. Configura eventos de UI
  if (btnAdicionarPergunta) {
    btnAdicionarPergunta.addEventListener("click", adicionarCampoPergunta);
  }

  // 2. Configura a submissão do formulário
  if (formNovoEstudo) {
    formNovoEstudo.addEventListener("submit", handleSalvarModelo);
  }

  // 3. Configura eventos de troca de abas
  document.querySelectorAll(".content-tabs .tab-link").forEach((btn) => {
    btn.addEventListener("click", handleTabClick);
  });

  // 4. Inicializa o campo de perguntas se estiver vazio (na primeira aba)
  if (listaPerguntas && listaPerguntas.children.length === 0) {
    adicionarCampoPergunta();
  }
}
