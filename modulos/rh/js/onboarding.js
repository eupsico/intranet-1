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
  firebase,
} from "../../../assets/js/firebase-init.js";
// Importa as funções do novo utilitário
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

/**
 * Carrega a lista de candidatos que foram APROVADOS no processo seletivo e ainda não iniciaram o onboarding.
 * Esses candidatos são elegíveis para iniciar o Onboarding.
 */
async function carregarCandidatosAprovados() {
  // Busca candidatos com status 'Aprovado' (vindo do módulo de Gestão de Vagas)
  const qCandidatos = query(
    candidatosCollection,
    where("status", "==", "Aprovado")
  );

  try {
    const snapshot = await getDocs(qCandidatos);
    selectCandidato.innerHTML =
      '<option value="">Selecione o candidato aprovado...</option>';

    snapshot.forEach((doc) => {
      const candidato = doc.data();
      const option = document.createElement("option");
      option.value = doc.id; // Verifica se este candidato já tem um onboarding em andamento // Idealmente, isso seria feito com uma Cloud Function ou JOIN
      option.textContent = `${candidato.nomeCandidato} - Vaga: ${
        candidato.vagaNome || "N/A"
      }`;
      selectCandidato.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar candidatos aprovados:", error);
  }
}

/**
 * Abre o modal para iniciar um novo Onboarding para um candidato aprovado.
 */
function abrirModalNovoOnboarding() {
  document.getElementById("onboarding-id").value = ""; // Limpa ID
  formOnboarding.reset();
  selectCandidato.disabled = false; // Permite escolher o novo colaborador // Oculta botões de status e mostra o campo de seleção de candidato
  document.getElementById("onboarding-steps").style.display = "none";
  modalOnboarding.style.display = "flex";
}

/**
 * Processa a criação inicial de um registro de Onboarding.
 */
selectCandidato.addEventListener("change", async (e) => {
  const candidatoId = e.target.value;
  if (!candidatoId) return; // TODO: Verificar se já existe um registro de onboarding para este candidato

  const novoRegistro = {
    candidatoId: candidatoId,
    nome: selectCandidato.options[selectCandidato.selectedIndex].text.split(
      " - "
    )[0],
    vaga: selectCandidato.options[selectCandidato.selectedIndex].text.split(
      " - "
    )[1],
    faseAtual: "pendente-docs",
    dataInicio: new Date(),
    documentacao: {
      status: "pendente",
      urlAnexos: null,
    },
    integracao: {
      status: "pendente",
      dataAgendada: null,
      treinamentos: {},
    },
    acessosTI: {
      status: "pendente",
      detalhes: null,
      solicitacaoId: null,
    },
    feedback: {
      feedback_45d: null,
      feedback_3m: null,
      statusFase2: "pendente",
    },
    historico: [
      {
        data: new Date(),
        acao: "Onboarding iniciado pelo RH.",
      },
    ],
  };

  try {
    const docRef = await addDoc(onboardingCollection, novoRegistro);
    document.getElementById("onboarding-id").value = docRef.id;
    selectCandidato.disabled = true; // Trava a seleção após a criação
    carregarDetalhesOnboarding(docRef.id);
  } catch (error) {
    console.error("Erro ao iniciar Onboarding:", error);
    alert("Erro ao iniciar o registro de Onboarding.");
    selectCandidato.value = ""; // Reseta seleção
  }
});

/**
 * Carrega e exibe os colaboradores na fase de onboarding selecionada.
 * @param {string} fase
 */
async function carregarColaboradores(fase) {
  listaOnboarding.innerHTML = '<div class="loading-spinner"></div>';

  const q = query(onboardingCollection, where("faseAtual", "==", fase));

  try {
    const snapshot = await getDocs(q);
    let htmlColaboradores = "";
    let count = 0;

    if (snapshot.empty) {
      listaOnboarding.innerHTML = `<p id="mensagem-onboarding">Nenhum colaborador na fase: **${fase}**.</p>`;
      return;
    }

    snapshot.forEach((doc) => {
      const onboard = doc.data();
      onboard.id = doc.id;
      count++; // Renderização simplificada

      htmlColaboradores += `
                <div class="card card-onboarding" data-id="${onboard.id}">
                    <h4>${onboard.nome}</h4>
                    <p>Vaga: ${onboard.vaga}</p>
                    <p>Fase: **${onboard.faseAtual
        .toUpperCase()
        .replace("-", " ")}**</p>
                    <button class="btn btn-sm btn-info btn-gerenciar" data-id="${
        onboard.id
      }">Gerenciar Onboarding</button>
                </div>
            `;
    });

    listaOnboarding.innerHTML = htmlColaboradores; // Atualiza o contador na aba de status

    document.querySelector(
      `.btn-tab[data-fase="${fase}"]`
    ).textContent = `${fase.replace("-", " ").toUpperCase()} (${count})`; // Adiciona eventos para botões de gerenciar

    document.querySelectorAll(".btn-gerenciar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        carregarDetalhesOnboarding(e.target.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar colaboradores em Onboarding:", error);
    listaOnboarding.innerHTML =
      '<p class="error">Erro ao carregar a lista.</p>';
  }
}

/**
 * Carrega e popula o modal com os detalhes de um registro de Onboarding existente.
 * @param {string} onboardingId
 */
async function carregarDetalhesOnboarding(onboardingId) {
  const onboardingRef = doc(db, "onboarding", onboardingId);
  try {
    const onboardSnap = await getDocs(onboardingRef);
    if (!onboardSnap.exists()) {
      alert("Registro de Onboarding não encontrado.");
      return;
    }
    const onboardData = onboardSnap.data(); // 1. Popula campos básicos e ID

    document.getElementById("onboarding-id").value = onboardingId; // 2. Desabilita seleção e preenche nome (não há campo, só o select)
    selectCandidato.disabled = true; // 3. Atualiza o status de documentação
    const statusDocsEl = document.getElementById("status-docs");
    statusDocsEl.innerHTML = `Status: <span class="badge badge-${
      onboardData.documentacao.status === "recebido" ? "success" : "warning"
    }">${onboardData.documentacao.status.toUpperCase()}</span>`;
    if (onboardData.documentacao.urlAnexos) {
      document.querySelector(".btn-visualizar-docs").style.display =
        "inline-block";
      document
        .querySelector(".btn-visualizar-docs")
        .setAttribute("data-url", onboardData.documentacao.urlAnexos);
    } // 4. Popula campos de integração

    document.getElementById("data-integracao").value =
      onboardData.integracao.dataAgendada || "";
    document.getElementById("treinamento-codigo-conduta").checked =
      onboardData.integracao.treinamentos["codigo-conduta"] || false;
    document.getElementById("treinamento-sistemas").checked =
      onboardData.integracao.treinamentos["sistemas"] || false; // 5. Popula campos de TI

    document.getElementById("solicitacao-ti-detalhes").value =
      onboardData.acessosTI.detalhes || "";
    document.getElementById(
      "status-ti"
    ).textContent = `Status: ${onboardData.acessosTI.status.toUpperCase()}`; // 6. Popula campos de Feedback

    document.getElementById("feedback-45d").value =
      onboardData.feedback.feedback_45d || "";
    document.getElementById("feedback-3m").value =
      onboardData.feedback.feedback_3m || ""; // Exibe o formulário de steps e o modal

    document.getElementById("onboarding-steps").style.display = "block";
    modalOnboarding.style.display = "flex";
  } catch (error) {
    console.error("Erro ao carregar detalhes do Onboarding:", error);
    alert("Erro ao carregar detalhes. Verifique o console.");
  }
}

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
      historico: firebase.firestore.FieldValue.arrayUnion({
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
    const dataIntegracao = document.getElementById("data-integracao").value;
    const treinamentos = {
      "codigo-conduta": document.getElementById("treinamento-codigo-conduta")
        .checked,
      sistemas: document.getElementById("treinamento-sistemas").checked,
    };

    await updateDoc(onboardRef, {
      "integracao.status": "concluido",
      "integracao.dataAgendada": dataIntegracao,
      "integracao.treinamentos": treinamentos, // A fase atual não muda, pois a TI e o Feedback ainda estão pendentes.
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Etapa de Integração/Treinamentos atualizada.",
      }),
    });
    alert("Etapa de Integração atualizada com sucesso.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-enviar-solicitacao-ti")) {
    const detalhes = document.getElementById("solicitacao-ti-detalhes").value; // 1. Cria o registro de solicitação de TI

    const solicitacao = {
      tipo: "Novo Usuário/Acessos",
      onboardingId: onboardingId,
      detalhes: detalhes,
      status: "Pendente TI",
      dataSolicitacao: new Date(),
    };
    const docSolicitacao = await addDoc(solicitacoesTiCollection, solicitacao); // 2. Atualiza o registro de Onboarding

    await updateDoc(onboardRef, {
      "acessosTI.status": "solicitado",
      "acessosTI.detalhes": detalhes,
      "acessosTI.solicitacaoId": docSolicitacao.id,
      historico: firebase.firestore.FieldValue.arrayUnion({
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
      historico: firebase.firestore.FieldValue.arrayUnion({
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
      historico: firebase.firestore.FieldValue.arrayUnion({
        data: new Date(),
        acao: "Feedback de 3 meses registrado.",
      }),
    });
    alert("Feedback de 3 meses salvo com sucesso.");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-concluir-onboarding")) {
    // Verifica se o feedback de 3 meses está preenchido
    const feedback3m = document.getElementById("feedback-3m").value;
    if (!feedback3m) {
      alert("Preencha o Feedback de 3 Meses antes de concluir o Onboarding.");
      return;
    }

    await updateDoc(onboardRef, {
      faseAtual: "concluido",
      "feedback.statusFase2": "iniciada", // Marca o início da fase 2 (contrato efetivo)
      dataConclusao: new Date(),
      historico: firebase.firestore.FieldValue.arrayUnion({
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

// Exponha a função de inicialização se o app.js a chamar dinamicamente
// window.initOnboarding = initOnboarding;
