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
} from "../../../../assets/js/firebase-init.js"; // Ajuste o caminho conforme necessário

// Importa a função do novo utilitário user-management
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// Coleção principal no Firestore para as vagas
const vagasCollection = collection(db, "vagas");
const candidatosCollection = collection(db, "candidatos");
const selectGestor = document.getElementById("vaga-gestor"); // Elemento Select

/**
 * Função para carregar a lista de gestores e popular o campo select.
 */
async function carregarGestores() {
  // Busca usuários com a função 'Gestor' (ou 'Supervisor', dependendo da estrutura real)
  // Usaremos 'Gestor' como padrão para este módulo.
  const gestores = await fetchUsersByRole("Gestor");

  selectGestor.innerHTML = '<option value="">Selecione o Gestor...</option>';

  if (gestores.length === 0) {
    // Exibir uma mensagem de erro ou desabilitar o formulário, se necessário
    console.warn(
      "Nenhum usuário com a função 'Gestor' encontrado no banco de dados."
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
 * Função para inicializar os eventos e carregar a lista de vagas.
 */
function initGestaoVagas() {
  console.log("Módulo de Gestão de Vagas carregado.");

  const btnNovaVaga = document.getElementById("btn-nova-vaga");
  const modalVaga = document.getElementById("modal-vaga");
  const formVaga = document.getElementById("form-vaga");
  const listaVagas = document.getElementById("lista-vagas"); // Carrega a lista de gestores no início

  carregarGestores(); // Abre o modal de nova vaga

  btnNovaVaga.addEventListener("click", () => {
    modalVaga.style.display = "flex"; // Resetar formulário para nova vaga
    formVaga.reset();
  }); // Fecha o modal

  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalVaga.style.display = "none";
    });
  }); // Submissão do formulário de vaga

  formVaga.addEventListener("submit", handleSalvarVaga); // Carrega a lista inicial (vagas abertas)

  carregarVagas("abertas"); // Adiciona eventos aos botões de status

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

/**
 * Lida com a submissão do formulário de nova vaga.
 * @param {Event} e
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  const nome = document.getElementById("vaga-nome").value;
  const descricao = document.getElementById("vaga-descricao").value;
  const gestorId = document.getElementById("vaga-gestor").value; // Usar ID do gestor
  const status = "aguardando-aprovacao"; // Inicia sempre aguardando aprovação

  try {
    const novaVaga = {
      nome: nome,
      descricao: descricao,
      gestorId: gestorId,
      status: status,
      dataCriacao: new Date(),
      historico: [
        {
          data: new Date(),
          acao: "Vaga criada e enviada para aprovação do gestor.",
          usuario: "ID_DO_USUARIO_LOGADO", // TODO: Substituir pelo ID do usuário logado
        },
      ],
      candidatosCount: 0, // Contador para facilitar dashboard
    };

    await addDoc(vagasCollection, novaVaga);

    alert("Vaga salva com sucesso! Aguardando aprovação.");
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("aguardando-aprovacao"); // Recarrega a lista
  } catch (error) {
    console.error("Erro ao salvar a vaga:", error);
    alert("Ocorreu um erro ao salvar a vaga. Verifique o console.");
  }
}

/**
 * Carrega e exibe as vagas com base no status.
 * @param {string} status
 */
async function carregarVagas(status) {
  const listaVagas = document.getElementById("lista-vagas");
  listaVagas.innerHTML = '<div class="loading-spinner"></div>';

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
    let count = 0;

    if (snapshot.empty) {
      listaVagas.innerHTML = `<p id="mensagem-vagas">Nenhuma vaga encontrada para o status: **${status}**.</p>`;
      return;
    }

    snapshot.forEach((doc) => {
      const vaga = doc.data();
      vaga.id = doc.id;
      count++; // Renderização simplificada para demonstração
      htmlVagas += `
                <div class="card card-vaga" data-id="${vaga.id}">
                    <h4>${vaga.nome}</h4>
                    <p>Status: **${vaga.status
        .toUpperCase()
        .replace("-", " ")}**</p>
                    <p>Candidatos: ${vaga.candidatosCount || 0}</p>
                    <button class="btn btn-sm btn-info btn-detalhes" data-id="${
        vaga.id
      }">Ver Detalhes</button>
                    ${
        vaga.status === "aguardando-aprovacao"
          ? `<button class="btn btn-sm btn-success btn-aprovar" data-id="${vaga.id}">Aprovar Vaga</button>`
          : ""
      }
                </div>
            `;
    });

    listaVagas.innerHTML = htmlVagas; // Atualiza o contador na aba de status

    document.querySelector(
      `.btn-tab[data-status="${status}"]`
    ).textContent = `${status.replace("-", " ").toUpperCase()} (${count})`; // Adiciona eventos para botões de detalhes/aprovação (futuramente em um módulo de controle)

    document.querySelectorAll(".btn-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Implementar lógica para abrir a visualização detalhada da vaga e dos candidatos
        console.log(
          "Abrir detalhes da vaga:",
          e.target.getAttribute("data-id")
        );
      });
    });
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
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Vaga aprovada e liberada para divulgação/recrutamento.",
        usuario: "ID_DO_USUARIO_LOGADO", // TODO: Substituir pelo ID do usuário logado
      }),
    });

    alert("Vaga aprovada com sucesso! Agora está em recrutamento.");
    carregarVagas("em-divulgacao"); // Recarrega para a nova aba
  } catch (error) {
    console.error("Erro ao aprovar vaga:", error);
    alert("Ocorreu um erro ao aprovar a vaga.");
  }
}

// Inicia o módulo quando a página for carregada e a view de gestao_vagas for ativada
// Em uma aplicação de módulo único (SPA), você chamaria esta função após a navegação bem-sucedida.
// Para este projeto, que parece carregar scripts via tipo="module", garantimos que a função seja exposta/chamada
// ou o `app.js` geral precisará orquestrar. Assumindo que o script é carregado na view:
document.addEventListener("DOMContentLoaded", initGestaoVagas);
