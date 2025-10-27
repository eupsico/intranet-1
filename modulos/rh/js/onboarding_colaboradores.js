// modulos/rh/js/onboarding.js

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

// IMPORTAÇÃO MODULAR PARA arrayUnion

import {
  fetchActiveEmployees,
  fetchUsersByRole,
} from "../../../assets/js/utils/user-management.js";

const onboardingCollection = collection(db, "onboarding");
const candidatosCollection = collection(db, "candidatos");
const solicitacoesTiCollection = collection(db, "solicitacoes_ti");

const listaOnboarding = document.getElementById("lista-onboarding");
const modalOnboarding = document.getElementById("modal-onboarding");
const selectCandidato = document.getElementById("onboarding-candidato-id");
const formOnboarding = document.getElementById("form-onboarding");

/**
 * Inicializa o módulo de Onboarding, carrega candidatos aprovados e a lista de colaboradores em integração.
 */
function initOnboarding() {
  console.log("Módulo de Onboarding de Colaboradores carregado.");

  document
    .getElementById("btn-iniciar-onboarding")
    .addEventListener("click", () => abrirModalNovoOnboarding());
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => (modalOnboarding.style.display = "none")
    );
  }); // Eventos para as tabs de filtro

  document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const fase = e.target.getAttribute("data-fase");
      document
        .querySelectorAll(".status-tabs .btn-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarColaboradores(fase);
    });
  }); // Adiciona listener aos botões de ação dentro do modal

  formOnboarding.addEventListener("click", handleOnboardingActions); // Carrega dados iniciais

  carregarCandidatosAprovados();
  carregarColaboradores("pendente-docs"); // Fase inicial
}

// ... (carregarCandidatosAprovados e abrirModalNovoOnboarding omitidas - não sofreram alteração estrutural)

/**
 * Processa a criação inicial de um registro de Onboarding.
 */
selectCandidato.addEventListener("change", async (e) => {
  const candidatoId = e.target.value;
  if (!candidatoId) return; // TODO: Verificar se já existe um registro de onboarding para este candidato

  const novoRegistro = {
    // ... (dados do registro omitidos)
    historico: [
      {
        data: new Date(),
        acao: "Onboarding iniciado pelo RH.",
      },
    ],
  };

  try {
    // ... (código omitido)
  } catch (error) {
    // ... (código omitido)
  }
});

/**
 * Carrega e exibe os colaboradores na fase de onboarding selecionada.
// ... (carregarColaboradores omitida)

/**
 * Carrega e popula o modal com os detalhes de um registro de Onboarding existente.
// ... (carregarDetalhesOnboarding omitida)

/**
 * Centraliza o tratamento dos eventos de clique nos botões de ação do modal.
 * @param {Event} e
 */
async function handleOnboardingActions(e) {
  const onboardingId = document.getElementById("onboarding-id").value;
  if (!onboardingId) return;

  const onboardRef = doc(db, "onboarding", onboardingId);

  if (e.target.classList.contains("btn-marcar-docs-recebidos")) {
    await updateDoc(onboardRef, {
      "documentacao.status": "recebido",
      faseAtual: "em-integracao",
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Documentação marcada como recebida (Manual).",
      }),
    });
    alert(
      "Documentação marcada como recebida. O colaborador avançou para a fase de integração."
    );
    carregarDetalhesOnboarding(onboardingId);
    carregarColaboradores("em-integracao");
  } else if (e.target.classList.contains("btn-marcar-integracao-ok")) {
    // ... (código omitido)

    await updateDoc(onboardRef, {
      "integracao.status": "concluido",
      "integracao.dataAgendada": dataIntegracao,
      "integracao.treinamentos": treinamentos, // A fase atual não muda, pois a TI e o Feedback ainda estão pendentes.
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Etapa de Integração/Treinamentos atualizada.",
      }),
    });
    alert("Etapa de Integração atualizada com sucesso.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-enviar-solicitacao-ti")) {
    // ... (código omitido)

    await updateDoc(onboardRef, {
      "acessosTI.status": "solicitado",
      "acessosTI.detalhes": detalhes,
      "acessosTI.solicitacaoId": docSolicitacao.id,
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Solicitação de TI enviada.",
      }),
    });

    alert("Solicitação de Criação de Usuários enviada à TI.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-salvar-feedback-45d")) {
    const feedback = document.getElementById("feedback-45d").value;
    await updateDoc(onboardRef, {
      "feedback.feedback_45d": feedback,
      faseAtual: "acompanhamento",
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Feedback de 45 dias registrado.",
      }),
    });
    alert("Feedback de 45 dias salvo com sucesso.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-salvar-feedback-3m")) {
    const feedback = document.getElementById("feedback-3m").value;
    await updateDoc(onboardRef, {
      "feedback.feedback_3m": feedback,
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Feedback de 3 meses registrado.",
      }),
    });
    alert("Feedback de 3 meses salvo com sucesso.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-concluir-onboarding")) {
    // ... (código omitido)

    await updateDoc(onboardRef, {
      faseAtual: "concluido",
      "feedback.statusFase2": "iniciada", // Marca o início da fase 2 (contrato efetivo)
      dataConclusao: new Date(),
      historico: arrayUnion({
        // CORREÇÃO APLICADA AQUI
        data: new Date(),
        acao: "Fase 1 do Onboarding concluída. Colaborador passa para Fase 2.",
      }),
    });
    alert(
      "Onboarding concluído com sucesso! Colaborador passa para Fase 2 (efetivação)."
    );
    modalOnboarding.style.display = "none";
    carregarColaboradores("concluido");
  }
}

// Inicia o módulo
document.addEventListener("DOMContentLoaded", initOnboarding);
