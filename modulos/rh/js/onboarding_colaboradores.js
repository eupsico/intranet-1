// modulos/rh/js/onboarding.js
// Versão: 2.1 (Fix de Inicialização e Lógica de Modal/Início de Onboarding)

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
  getDoc, // Adicionado para carregar detalhes (necessário para carregarDetalhesOnboarding)
} from "../../../assets/js/firebase-init.js";

// IMPORTAÇÃO MODULAR PARA arrayUnion (Nota: arrayUnion foi movido para o firebase-init.js nos módulos anteriores, mas se for estritamente necessário aqui, mantenha. Vou assumir a versão do firebase-init.js, mas manter o import original se for uma dependência de terceiros)

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

// Variável para armazenar dados do usuário logado (para auditoria)
let currentUserId = "ID_DO_USUARIO_LOGADO"; // Será populado por initonboardingcolaboradores

/**
 * Função para abrir o modal para iniciar um novo Onboarding, resetando o formulário.
 */
function abrirModalNovoOnboarding() {
  if (formOnboarding) {
    formOnboarding.reset();
    // Remove o ID de edição, caso exista
    const onboardingIdInput = document.getElementById("onboarding-id");
    if (onboardingIdInput) onboardingIdInput.value = "";
  }
  if (modalOnboarding) {
    modalOnboarding.style.display = "flex";
    // Oculta as etapas do checklist na criação, exibindo apenas a seleção de candidato
    document.getElementById("onboarding-steps").style.display = "none";
  }
  // Carrega a lista de candidatos no select
  carregarCandidatosAprovados();
}

/**
 * Carrega a lista de candidatos aprovados (status: 'aprovado') e popula o select.
 */
async function carregarCandidatosAprovados() {
  if (!selectCandidato) return;

  selectCandidato.innerHTML =
    '<option value="">Carregando candidatos...</option>';

  // Busca candidatos com status 'aprovado'
  const q = query(candidatosCollection, where("status", "==", "aprovado"));

  try {
    const snapshot = await getDocs(q);
    selectCandidato.innerHTML =
      '<option value="">Selecione o candidato aprovado...</option>';

    if (snapshot.empty) {
      console.log("Nenhum candidato aprovado para iniciar o Onboarding.");
      return;
    }

    snapshot.forEach((doc) => {
      const candidato = doc.data();
      const option = document.createElement("option");
      option.value = doc.id; // ID do documento na coleção candidatos
      option.textContent = candidato.nome || candidato.email;
      selectCandidato.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar candidatos aprovados:", error);
    window.showToast("Erro ao carregar candidatos.", "error");
  }
}

/**
 * Carrega e exibe os colaboradores na fase de onboarding selecionada. (RECONSTRUÇÃO)
 * @param {string} fase
 */
async function carregarColaboradores(fase) {
  if (!listaOnboarding) return;
  listaOnboarding.innerHTML =
    '<div class="loading-spinner">Carregando lista...</div>';

  let q = query(onboardingCollection, where("faseAtual", "==", fase));

  try {
    const snapshot = await getDocs(q);
    let htmlLista = "";
    let count = 0;

    if (snapshot.empty) {
      listaOnboarding.innerHTML = `<p id="mensagem-onboarding">Nenhum colaborador na fase: **${fase.replace(
        /-/g,
        " "
      )}**.</p>`;
      return;
    }

    snapshot.forEach((doc) => {
      const registro = doc.data();
      count++;
      htmlLista += `
<div class="card card-onboarding" data-id="${doc.id}">
<h4>${registro.nomeColaborador || "Colaborador sem Nome"}</h4>
<p>Fase: **${registro.faseAtual.toUpperCase().replace(/-/g, " ")}**</p>
<p>Iniciado em: ${
        registro.dataInicio
          ? new Date(registro.dataInicio.toDate()).toLocaleDateString()
          : "N/A"
      }</p>
<div class="rh-card-actions">               
<button class="btn btn-sm btn-info btn-detalhes-onboarding" data-id="${
        doc.id
      }">Gerenciar Checklist</button>
</div>
</div>
`;
    });

    listaOnboarding.innerHTML = htmlLista; // Adiciona eventos para botões de detalhes/edição

    document.querySelectorAll(".btn-detalhes-onboarding").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        carregarDetalhesOnboarding(e.target.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar colaboradores em Onboarding:", error);
    listaOnboarding.innerHTML =
      '<p class="error">Erro ao carregar a lista de Onboarding.</p>';
  }
}

/**
 * Carrega e popula o modal com os detalhes de um registro de Onboarding existente. (RECONSTRUÇÃO)
 * @param {string} onboardingId
 */
async function carregarDetalhesOnboarding(onboardingId) {
  if (!onboardingId || !modalOnboarding) return;

  try {
    const onboardRef = doc(db, "onboarding", onboardingId);
    const docSnap = await getDoc(onboardRef);

    if (!docSnap.exists()) {
      window.showToast("Registro de Onboarding não encontrado.", "error");
      return;
    }

    const registro = docSnap.data();

    // 1. Preenche o ID (necessário para as ações do handleOnboardingActions)
    document.getElementById("onboarding-id").value = onboardingId;

    // 2. Oculta a seleção de candidato, pois já está em andamento
    selectCandidato.style.display = "none";
    document.querySelector(
      'label[for="onboarding-candidato-id"]'
    ).style.display = "none";

    // 3. Exibe as etapas do checklist
    document.getElementById("onboarding-steps").style.display = "block";

    // 4. Preenche outros campos e status (Lógica simplificada)
    // Você precisará de lógica mais complexa para preencher todos os campos do checklist
    if (registro.documentacao && registro.documentacao.status === "recebido") {
      document.getElementById("status-docs").innerHTML =
        'Status: <span class="badge badge-success">Recebido</span>';
    }

    // Exibe o modal
    modalOnboarding.style.display = "flex";
  } catch (error) {
    console.error("Erro ao carregar detalhes do Onboarding:", error);
    window.showToast("Erro ao carregar detalhes do Onboarding.", "error");
  }
}

// --- LÓGICA DE CRIAÇÃO DO NOVO REGISTRO NO SELECT ---
selectCandidato.addEventListener("change", async (e) => {
  const candidatoId = e.target.value;
  if (!candidatoId) return;

  // Busca o nome/dados do candidato
  const candidatoRef = doc(db, "candidatos", candidatoId);
  const candidatoSnap = await getDoc(candidatoRef);
  const candidato = candidatoSnap.exists() ? candidatoSnap.data() : {};

  // TODO: Verificar se já existe um registro de onboarding para este candidato

  const novoRegistro = {
    candidatoId: candidatoId,
    nomeColaborador: candidato.nome || candidato.email,
    dataInicio: new Date(),
    faseAtual: "pendente-docs", // Inicia na primeira fase
    documentacao: { status: "pendente" },
    integracao: { status: "pendente" },
    acessosTI: { status: "pendente" },
    feedback: {},
    historico: [
      {
        data: new Date(),
        acao: "Onboarding iniciado pelo RH.",
        usuario: currentUserId,
      },
    ],
  };

  try {
    const docRef = await addDoc(onboardingCollection, novoRegistro);
    window.showToast(
      "Onboarding iniciado com sucesso! Preencha os detalhes.",
      "success"
    );
    // Após criar, carrega os detalhes para continuar a gestão no modal
    await carregarDetalhesOnboarding(docRef.id);
    carregarColaboradores("pendente-docs");
  } catch (error) {
    console.error("Erro ao iniciar o Onboarding:", error);
    window.showToast("Ocorreu um erro ao iniciar o Onboarding.", "error");
  }
});

/**
 * Centraliza o tratamento dos eventos de clique nos botões de ação do modal.
 * @param {Event} e
 */
async function handleOnboardingActions(e) {
  if (e.target.tagName !== "BUTTON" || e.target.type !== "button") return; // Ignora clicks que não são botões de ação

  const onboardingId = document.getElementById("onboarding-id").value;
  if (!onboardingId) return;

  const onboardRef = doc(db, "onboarding", onboardingId);

  if (e.target.classList.contains("btn-marcar-docs-recebidos")) {
    await updateDoc(onboardRef, {
      "documentacao.status": "recebido",
      faseAtual: "em-integracao",
      historico: arrayUnion({
        data: new Date(),
        acao: "Documentação marcada como recebida (Manual).",
        usuario: currentUserId,
      }),
    });
    window.showToast(
      "Documentação marcada como recebida. O colaborador avançou para a fase de integração.",
      "success"
    );
    carregarDetalhesOnboarding(onboardingId);
    carregarColaboradores("em-integracao");
  } else if (e.target.classList.contains("btn-marcar-integracao-ok")) {
    // Captura dados dos campos dentro do modal (Agendamento e Checkboxes)
    const dataIntegracao = document.getElementById("data-integracao").value;
    const treinamentos = {
      codigoConduta: document.getElementById("treinamento-codigo-conduta")
        .checked,
      usoSistemas: document.getElementById("treinamento-sistemas").checked,
    };
    // Lógica omitida
    await updateDoc(onboardRef, {
      "integracao.status": "concluido",
      "integracao.dataAgendada": dataIntegracao,
      "integracao.treinamentos": treinamentos,
      historico: arrayUnion({
        data: new Date(),
        acao: "Etapa de Integração/Treinamentos atualizada.",
        usuario: currentUserId,
      }),
    });
    window.showToast("Etapa de Integração atualizada com sucesso.", "success");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-enviar-solicitacao-ti")) {
    const detalhes = document.getElementById("solicitacao-ti-detalhes").value;
    // Lógica de envio de solicitação à TI (criando um novo doc)
    const docSolicitacao = await addDoc(solicitacoesTiCollection, {
      onboardingId: onboardingId,
      detalhes: detalhes,
      dataSolicitacao: new Date(),
      status: "pendente_ti",
      solicitanteId: currentUserId,
    });

    await updateDoc(onboardRef, {
      "acessosTI.status": "solicitado",
      "acessosTI.detalhes": detalhes,
      "acessosTI.solicitacaoId": docSolicitacao.id,
      historico: arrayUnion({
        data: new Date(),
        acao: "Solicitação de TI enviada.",
        usuario: currentUserId,
      }),
    });

    window.showToast(
      "Solicitação de Criação de Usuários enviada à TI.",
      "warning"
    );
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-salvar-feedback-45d")) {
    const feedback = document.getElementById("feedback-45d").value;
    await updateDoc(onboardRef, {
      "feedback.feedback_45d": feedback,
      faseAtual: "acompanhamento", // Assume que a fase de acompanhamento começa após o primeiro feedback
      historico: arrayUnion({
        data: new Date(),
        acao: "Feedback de 45 dias registrado.",
        usuario: currentUserId,
      }),
    });
    window.showToast("Feedback de 45 dias salvo com sucesso.", "success");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-salvar-feedback-3m")) {
    const feedback = document.getElementById("feedback-3m").value;
    await updateDoc(onboardRef, {
      "feedback.feedback_3m": feedback,
      historico: arrayUnion({
        data: new Date(),
        acao: "Feedback de 3 meses registrado.",
        usuario: currentUserId,
      }),
    });
    window.showToast("Feedback de 3 meses salvo com sucesso.", "success");
    carregarDetalhesOnboarding(onboardingId);
  } else if (e.target.classList.contains("btn-concluir-onboarding")) {
    // Validação de conclusão omitida (acessos TI concluídos, feedbacks preenchidos, etc.)
    await updateDoc(onboardRef, {
      faseAtual: "concluido",
      "feedback.statusFase2": "iniciada",
      dataConclusao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Fase 1 do Onboarding concluída. Colaborador passa para Fase 2.",
        usuario: currentUserId,
      }),
    });
    window.showToast(
      "Onboarding concluído com sucesso! Colaborador passa para Fase 2 (efetivação).",
      "success"
    );
    if (modalOnboarding) modalOnboarding.style.display = "none";
    carregarColaboradores("concluido");
  }
}

/**
 * Função de inicialização principal do módulo, chamada pelo rh-painel.js.
 * @param {object} user - Objeto de usuário do Firebase Auth.
 * @param {object} userData - Dados de perfil do usuário logado no Firestore.
 */
export async function initonboardingcolaboradores(user, userData) {
  console.log("🔹 Iniciando Módulo de Onboarding de Colaboradores...");

  // Define o ID do usuário logado para auditoria
  currentUserId = user.uid || "ID_DO_USUARIO_LOGADO";

  // 1. Configura eventos de UI
  const btnIniciarOnboarding = document.getElementById(
    "btn-iniciar-onboarding"
  );
  if (btnIniciarOnboarding) {
    btnIniciarOnboarding.addEventListener("click", abrirModalNovoOnboarding);
  }

  // Configura evento de fechamento do modal
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (modalOnboarding) modalOnboarding.style.display = "none";
    });
  });

  // Adiciona listener aos botões de ação dentro do modal (Checklist steps)
  if (formOnboarding) {
    formOnboarding.addEventListener("click", handleOnboardingActions);
  }

  // 2. Carrega a lista inicial (fase pendente-docs)
  // Garante que a aba 'pendente-docs' esteja ativa por padrão
  document.querySelectorAll(".status-tabs .btn-tab").forEach((b) => {
    b.classList.remove("active");
    if (b.getAttribute("data-fase") === "pendente-docs") {
      b.classList.add("active");
    }
  });

  await carregarColaboradores("pendente-docs");

  // 3. Adiciona eventos aos botões de status (filtragem)
  document.querySelectorAll(".status-tabs .btn-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const fase = e.target.getAttribute("data-fase");
      document
        .querySelectorAll(".status-tabs .btn-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarColaboradores(fase);
    });
  });
}
