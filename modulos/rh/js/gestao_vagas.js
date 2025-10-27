// modulos/rh/js/gestao_vagas.js
import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  FieldValue,
  getDoc, // Adicionado getDoc para buscar uma única vaga na edição
} from "../../../assets/js/firebase-init.js"; // Ajuste o caminho conforme necessário

// Importa a função do novo utilitário user-management
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// Coleção principal no Firestore para as vagas
const vagasCollection = collection(db, "vagas");
const candidatosCollection = collection(db, "candidatos");

// Elementos do DOM globais
const modalVaga = document.getElementById("modal-vaga");
const formVaga = document.getElementById("form-vaga");
const selectGestor = document.getElementById("vaga-gestor");
const btnSalvar = formVaga
  ? formVaga.querySelector('button[type="submit"]')
  : null;
const modalTitle = modalVaga ? modalVaga.querySelector("h3") : null;

let currentUserData = {}; // Para armazenar os dados do usuário logado

/**
 * Função para carregar a lista de gestores e popular o campo select.
 */
async function carregarGestores() {
  // CORRIGIDO: Busca usuários com a função 'gestor' (tudo minúsculo)
  const gestores = await fetchUsersByRole("gestor");

  if (!selectGestor) return;
  selectGestor.innerHTML = '<option value="">Selecione o Gestor...</option>';

  if (gestores.length === 0) {
    // Exibir esta mensagem apenas se não encontrar o gestor.
    console.warn(
      "Nenhum usuário com a função 'gestor' encontrado no banco de dados."
    );
    return;
  }

  gestores.forEach((gestor) => {
    const option = document.createElement("option");
    option.value = gestor.id;
    option.textContent = gestor.nome || gestor.email; // Prefere o nome, senão usa o email
    selectGestor.appendChild(option);
  });
}

/**
 * Função para configurar o modal para criação de uma nova vaga.
 */
function openNewVagaModal() {
  if (formVaga) {
    formVaga.reset();
    formVaga.removeAttribute("data-vaga-id"); // Remove ID para indicar criação
  }
  if (modalTitle) modalTitle.textContent = "Ficha Técnica da Vaga"; // CORRIGIDO: Novo Título
  if (btnSalvar) btnSalvar.textContent = "Salvar e Iniciar Aprovação";
  if (modalVaga) modalVaga.style.display = "flex"; // Implementa o popup
}

/**
 * Função para buscar e exibir os detalhes de uma vaga para edição.
 * @param {string} vagaId
 */
async function handleDetalhesVaga(vagaId) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, "vagas", vagaId);
    const docSnap = await getDoc(vagaRef);

    if (!docSnap.exists()) {
      window.showToast("Vaga não encontrada.", "error");
      return;
    }

    const vaga = docSnap.data();

    // 1. Preenche o formulário
    if (document.getElementById("vaga-nome"))
      document.getElementById("vaga-nome").value = vaga.nome;
    if (document.getElementById("vaga-descricao"))
      document.getElementById("vaga-descricao").value = vaga.descricao;
    // Garante que o select do gestor esteja populado antes de tentar selecionar
    await carregarGestores();
    if (document.getElementById("vaga-gestor"))
      document.getElementById("vaga-gestor").value = vaga.gestorId;

    // 2. Configura o modal para edição
    if (formVaga) formVaga.setAttribute("data-vaga-id", vagaId);
    // CORRIGIDO: Altera o título para refletir a nova nomenclatura "Ficha Técnica da Vaga"
    if (modalTitle) modalTitle.textContent = "Editar Ficha Técnica da Vaga";
    if (btnSalvar) btnSalvar.textContent = "Salvar Alterações";
    if (modalVaga) modalVaga.style.display = "flex"; // Implementa o popup
  } catch (error) {
    console.error("Erro ao carregar detalhes da vaga:", error);
    window.showToast("Erro ao carregar os dados para edição.", "error");
  }
}

/**
 * Lida com a submissão do formulário de nova vaga ou edição.
 * @param {Event} e
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  const vagaId = formVaga.getAttribute("data-vaga-id");
  const isEditing = !!vagaId;
  const submitButton = e.submitter;
  if (submitButton) submitButton.disabled = true;
  const nome = document.getElementById("vaga-nome").value;
  const descricao = document.getElementById("vaga-descricao").value;
  const gestorId = document.getElementById("vaga-gestor").value; // Usar ID do gestor

  try {
    const vagaData = {
      nome: nome,
      descricao: descricao,
      gestorId: gestorId,
    }; // Campo de histórico baseado na ação
    const historicoEntry = {
      data: new Date(),
      usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
    };

    if (isEditing) {
      // Ação de Edição
      vagaData.historico = FieldValue.arrayUnion({
        ...historicoEntry,
        acao: "Vaga editada.",
      });

      const vagaRef = doc(db, "vagas", vagaId);
      await updateDoc(vagaRef, vagaData);
      window.showToast("Vaga atualizada com sucesso!", "success");
    } else {
      // Ação de Criação
      vagaData.status = "aguardando-aprovacao"; // Inicia sempre aguardando aprovação
      vagaData.dataCriacao = new Date();
      vagaData.candidatosCount = 0;
      vagaData.historico = [
        {
          ...historicoEntry,
          acao: "Vaga criada e enviada para aprovação do gestor.",
        },
      ];

      await addDoc(vagasCollection, vagaData);
      window.showToast(
        "Vaga salva com sucesso! Aguardando aprovação.",
        "success"
      );
    }

    document.getElementById("modal-vaga").style.display = "none"; // Recarrega a lista para o status que for mais provável de ser o atual após a ação
    const activeTab = document.querySelector(".status-tabs .btn-tab.active");
    const newStatus = isEditing
      ? activeTab.getAttribute("data-status")
      : "aguardando-aprovacao";
    carregarVagas(newStatus);
  } catch (error) {
    console.error("Erro ao salvar/atualizar a vaga:", error);
    window.showToast("Ocorreu um erro ao salvar/atualizar a vaga.", "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

/**
 * Carrega e exibe as vagas com base no status.
 * @param {string} status
 */
async function carregarVagas(status) {
  const listaVagas = document.getElementById("lista-vagas");
  if (!listaVagas) return;
  listaVagas.innerHTML =
    '<div class="loading-spinner">Carregando vagas...</div>';

  let q;
  if (status === "abertas") {
    // 'Abertas' pode incluir 'aguardando-aprovacao' e 'em-divulgacao'
    q = query(
      vagasCollection,
      where("status", "in", ["aguardando-aprovacao", "em-divulgacao"])
    );
  } else {
    q = query(vagasCollection, where("status", "==", status));
  }

  try {
    const snapshot = await getDocs(q);
    let htmlVagas = "";
    let count = 0; // Dicionário para contagem de status

    const counts = {
      abertas: 0,
      "aprovacao-gestao": 0,
      "em-divulgacao": 0,
      fechadas: 0,
    };

    // Contagem e Renderização
    snapshot.docs.forEach((doc) => {
      const vaga = doc.data(); // Atualiza contadores para as abas
      if (
        vaga.status === "aguardando-aprovacao" ||
        vaga.status === "em-divulgacao"
      ) {
        counts["abertas"]++;
      }
      if (vaga.status === "aguardando-aprovacao") counts["aprovacao-gestao"]++;
      if (vaga.status === "em-divulgacao") counts["em-divulgacao"]++;
      if (vaga.status === "fechadas") counts["fechadas"]++; // Verifica se a vaga pertence à aba ativa para renderizar o HTML
      const shouldRender =
        (status === "abertas" &&
          (vaga.status === "aguardando-aprovacao" ||
            vaga.status === "em-divulgacao")) ||
        vaga.status === status;

      if (shouldRender) {
        vaga.id = doc.id;
        count++;
        htmlVagas += `
                <div class="card card-vaga" data-id="${vaga.id}">
                    <h4>${vaga.nome}</h4>
                    <p>Status: **${vaga.status
          .toUpperCase()
          .replace(/-/g, " ")}**</p>
                    <p>Candidatos: ${vaga.candidatosCount || 0}</p>
                    <div class="rh-card-actions">
                    <button class="btn btn-sm btn-info btn-detalhes" data-id="${
          vaga.id
        }">Ver/Editar Detalhes</button>
                    ${
          vaga.status === "aguardando-aprovacao"
            ? `<button class="btn btn-sm btn-success btn-aprovar" data-id="${vaga.id}">Aprovar Vaga</button>`
            : ""
        }
                    </div>
                </div>
            `;
      }
    });

    // Atualiza os contadores em todos os botões de status
    document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
      const btnStatus = btn.getAttribute("data-status");
      const countValue = counts[btnStatus] || 0;
      // O nome da aba de aprovação é 'aprovacao-gestao' mas o status é 'aguardando-aprovacao' no banco. Corrigido na contagem acima.
      btn.textContent = `${btnStatus
        .replace(/-/g, " ")
        .replace("aprovacao gestao", "Aguardando Aprovação")
        .toUpperCase()} (${countValue})`;
    });

    if (count === 0) {
      listaVagas.innerHTML = `<p id="mensagem-vagas">Nenhuma vaga encontrada para o status: **${status.replace(
        /-/g,
        " "
      )}**.</p>`;
      return;
    }

    listaVagas.innerHTML = htmlVagas; // Adiciona eventos para botões de detalhes/edição

    document.querySelectorAll(".btn-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        handleDetalhesVaga(e.target.getAttribute("data-id"));
      });
    }); // Adiciona eventos para botões de aprovação
    document.querySelectorAll(".btn-aprovar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        handleAprovarVaga(e.target.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar vagas:", error);
    listaVagas.innerHTML = '<p class="error">Erro ao carregar as vagas.</p>';
  }
}

/**
 * Função mock para simular a aprovação de uma vaga pelo gestor.
 * Numa arquitetura robusta, isso seria uma Cloud Function ou um processo de permissão.
 * @param {string} vagaId
 */
async function handleAprovarVaga(vagaId) {
  if (
    !confirm(
      "Tem certeza que deseja aprovar esta vaga e iniciar o recrutamento?"
    )
  ) {
    return;
  }

  try {
    const vagaRef = doc(db, "vagas", vagaId);
    await updateDoc(vagaRef, {
      status: "em-divulgacao", // Passa para a fase de recrutamento/divulgação
      dataAprovacao: new Date(),
      historico: FieldValue.arrayUnion({
        data: new Date(),
        acao: "Vaga aprovada e liberada para divulgação/recrutamento.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO", // TODO: Substituir pelo ID do usuário logado
      }),
    });

    window.showToast(
      "Vaga aprovada com sucesso! Agora está em recrutamento.",
      "success"
    );
    carregarVagas("em-divulgacao"); // Recarrega para a nova aba
  } catch (error) {
    console.error("Erro ao aprovar vaga:", error);
    window.showToast("Ocorreu um erro ao aprovar a vaga.", "error");
  }
}

/**
 * Função de inicialização principal do módulo, chamada pelo rh-painel.js.
 * @param {object} user - Objeto de usuário do Firebase Auth.
 * @param {object} userData - Dados de perfil do usuário logado no Firestore.
 */
export async function initgestaovagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas e Recrutamento...");

  // Armazena dados do usuário para uso em logs de auditoria/histórico
  currentUserData = userData || {};

  const btnNovaVaga = document.getElementById("btn-nova-vaga");

  // 1. Carrega a lista de gestores (assíncrono)
  await carregarGestores();

  // 2. Configura eventos de UI
  if (btnNovaVaga) {
    btnNovaVaga.addEventListener("click", openNewVagaModal);
  }

  // Configura evento de fechamento do modal
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (modalVaga) modalVaga.style.display = "none";
    });
  });

  // Configura submissão do formulário (criação/edição)
  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  }

  // 3. Carrega a lista inicial (vagas abertas)
  // Garante que a aba 'abertas' esteja ativa por padrão
  document.querySelectorAll(".status-tabs .btn-tab").forEach((b) => {
    b.classList.remove("active");
    if (b.getAttribute("data-status") === "abertas") {
      b.classList.add("active");
    }
  });

  await carregarVagas("abertas");

  // 4. Adiciona eventos aos botões de status (filtragem)
  document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .btn-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarVagas(status);
    });
  });
}
