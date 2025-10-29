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
} from "../../../assets/js/firebase-init.js";

// =====================================================================
// CONSTANTES E VARIÁVEIS GLOBAIS
// =====================================================================

const ESTUDOS_COLLECTION_NAME = "estudos_de_caso";
const estudosCollection = collection(db, ESTUDOS_COLLECTION_NAME);

const formNovoEstudo = document.getElementById("form-novo-estudo");
const listaPerguntas = document.getElementById("lista-perguntas");
const btnAdicionarPergunta = document.getElementById("btn-adicionar-pergunta");
const listaModelosSalvos = document.getElementById("lista-modelos-salvos");

let perguntaCounter = 1;

// =====================================================================
// FUNÇÕES AUXILIARES DE UI
// =====================================================================

/**
 * Adiciona um novo campo de textarea para pergunta ao formulário.
 */
function adicionarCampoPergunta() {
  perguntaCounter++;
  const novoCampo = document.createElement("div");
  novoCampo.className = "pergunta-item form-group";
  novoCampo.innerHTML = `
        <label for="pergunta-${perguntaCounter}">Pergunta ${perguntaCounter}:</label>
        <textarea class="pergunta-texto" data-id="${perguntaCounter}" rows="2" placeholder="Digite o texto da pergunta."></textarea>
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
  itens.forEach((item) => {
    const label = item.querySelector("label");
    const textarea = item.querySelector("textarea");
    if (label) label.textContent = `Pergunta ${count}:`;
    if (textarea) textarea.setAttribute("data-id", count);
    count++;
  });
  perguntaCounter = count - 1;
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
    }
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
  itens.forEach((item) => {
    const textarea = item.querySelector(".pergunta-texto");
    if (textarea && textarea.value.trim()) {
      perguntas.push({
        texto: textarea.value.trim(),
        id: textarea.getAttribute("data-id"),
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

  if (!titulo || !tipo) {
    window.showToast("Título e Tipo de Avaliação são obrigatórios.", "warning");
    return;
  }

  const modeloData = {
    titulo: titulo,
    tipo: tipo,
    conteudo: texto,
    perguntas: perguntas,
    dataCriacao: new Date(),
    // TODO: Adicionar usuário criador
  };

  try {
    const docRef = await addDoc(estudosCollection, modeloData);
    window.showToast("Modelo de avaliação salvo com sucesso!", "success");
    formNovoEstudo.reset(); // Limpa o formulário após o sucesso
    carregarModelosSalvos(); // Atualiza a lista
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

    // TODO: Adicionar eventos para editar/excluir/gerar link
    // Ex: document.querySelectorAll('.btn-gerar-link').forEach(btn => btn.onclick = handleGerarLink);
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

  // 4. Carrega a lista de modelos (se a aba de modelos for a ativa)
  // Inicialmente, a aba "Criar Novo" está ativa, mas a lógica de navegação
  // entre os painéis (Recrutamento/Gestão) pode chamar 'modelos-salvos'
  // Se o usuário clicar em "Modelos Salvos" pela primeira vez, a função
  // `carregarModelosSalvos` será chamada.

  // Se o elemento principal não carregar, inicializa a lista (para o caso de ser o painel padrão)
  if (
    document.querySelector(".tab-content.active").id === "tab-modelos-salvos"
  ) {
    carregarModelosSalvos();
  }
}
