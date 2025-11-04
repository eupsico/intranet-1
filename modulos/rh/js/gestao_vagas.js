/**
 * Arquivo: modulos/rh/js/gestao_vagas.js
 * Versão: 3.0.0 (Refatoração Completa com Melhorias)
 * Data: 04/11/2025
 * Descrição: Gerenciamento completo do ciclo de vida de vagas
 */

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
  arrayUnion,
  arrayRemove,
} from "../../../assets/js/firebase-init.js";

import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// ============================================
// CONSTANTES GLOBAIS
// ============================================

const VAGAS_COLLECTION_NAME = "vagas";
const CONFIG_COLLECTION_NAME = "configuracoesSistema";

// IDs dos modais
const ID_MODAL_FICHA_TECNICA = "modal-vaga";
const ID_MODAL_CRIACAO_ARTE = "modal-criacao-arte";
const ID_MODAL_APROVACAO_ARTE = "modal-aprovacao-arte";
const ID_MODAL_DIVULGACAO = "modal-divulgacao";
const ID_MODAL_FECHADAS = "modal-fechadas";

// Mapeamento de status para abas
const STATUS_TAB_MAP = {
  abertas: ["Em Elaboração (Ficha Técnica)", "Em Correção (Ficha Técnica)"],
  correcao: ["Em Correção (Ficha Técnica)", "Em Correção (Arte)"],
  "aprovacao-gestao": ["Ficha Técnica Aprovada (Aguardando Criação de Arte)"],
  "arte-pendente": ["Arte em Criação"],
  "aprovacao-arte": ["Arte Criada (Aguardando Aprovação)"],
  "em-divulgacao": ["Arte Aprovada (Em Divulgação)"],
  fechadas: ["Vaga Encerrada", "Vaga Cancelada"],
};

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================

let vagasCollection;
let configCollection;
let currentUserData = null;
let vagaAtualId = null;
let statusAbaAtiva = "abertas";

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Exibe/oculta o loading spinner global
 */
function showGlobalLoading(show = true) {
  const spinner = document.getElementById("global-loading-spinner");
  if (spinner) {
    spinner.style.display = show ? "flex" : "none";
  }
}

/**
 * Formata data para exibição
 */
function formatarData(data) {
  if (!data) return "Não definida";
  if (typeof data === "string") {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return data.toLocaleDateString("pt-BR");
}

/**
 * Capitaliza primeira letra
 */
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Valida campos obrigatórios do formulário
 */
function validarFormularioVaga() {
  const camposObrigatorios = [
    { id: "vaga-nome", label: "Título da Vaga" },
    { id: "vaga-departamento", label: "Departamento" },
    { id: "vaga-tipo-recrutamento", label: "Tipo de Recrutamento" },
    { id: "vaga-regime-trabalho", label: "Regime de Trabalho" },
    { id: "vaga-modalidade-trabalho", label: "Modalidade de Trabalho" },
    { id: "vaga-responsabilidades", label: "Responsabilidades" },
  ];

  for (const campo of camposObrigatorios) {
    const elemento = document.getElementById(campo.id);
    if (!elemento || !elemento.value.trim()) {
      window.showToast?.(`O campo "${campo.label}" é obrigatório.`, "error");
      elemento?.focus();
      return false;
    }
  }
  return true;
}

/**
 * Limpa o formulário de vaga
 */
function limparFormularioVaga() {
  const form = document.getElementById("form-vaga");
  if (form) {
    form.reset();
    vagaAtualId = null;
  }
}

/**
 * Exibe banner de feedback
 */
function exibirFeedbackBanner(tipo, mensagem, container) {
  const banner = document.createElement("div");
  banner.className = `feedback-banner alert-${tipo}`;
  banner.innerHTML = `
    <i class="fas fa-${
      tipo === "error" ? "exclamation-triangle" : "info-circle"
    }"></i>
    <div>${mensagem}</div>
  `;
  container.insertBefore(banner, container.firstChild);

  // Remove após 5 segundos
  setTimeout(() => banner.remove(), 5000);
}

// ============================================
// GERENCIAMENTO DE MODAIS
// ============================================

/**
 * Abre modal por ID
 */
function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("is-visible");
    console.log(`✅ Modal ${modalId} aberto`);
  } else {
    console.error(`❌ Modal ${modalId} não encontrado`);
  }
}

/**
 * Fecha modal por ID
 */
function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("is-visible");
    console.log(`🔹 Modal ${modalId} fechado`);
  }
}

/**
 * Configura listeners de fechamento de modais
 */
function configurarFechamentoModais() {
  document.querySelectorAll(".close-modal-btn, [data-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modalId =
        e.target.dataset.modal ||
        e.target.closest("[data-modal]")?.dataset.modal;
      if (modalId) {
        fecharModal(modalId);
      }
    });
  });

  // Fecha ao clicar fora do modal-content
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("is-visible");
      }
    });
  });
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

/**
 * Carrega departamentos do Firestore
 */
/**
 * Carrega departamentos do Firestore
 * Caminho: configuracoesSistema/geral/listas.departamentos
 */
async function carregarDepartamentos() {
  const selectDepartamento = document.getElementById("vaga-departamento");
  if (!selectDepartamento) return;

  console.log("🔹 Carregando departamentos...");

  try {
    // ✅ CAMINHO CORRETO: configuracoesSistema -> geral
    const geralDocRef = doc(configCollection, "geral");
    const geralSnap = await getDoc(geralDocRef);

    if (geralSnap.exists()) {
      const data = geralSnap.data();

      // ✅ Acessa: listas (map) -> departamentos (array)
      const departamentos = data.listas?.departamentos || [];

      if (departamentos.length === 0) {
        selectDepartamento.innerHTML =
          '<option value="">Nenhum departamento cadastrado</option>';
        console.warn("⚠️ Array de departamentos está vazio");
        return;
      }

      // Limpa e preenche o select
      selectDepartamento.innerHTML =
        '<option value="">Selecione o Departamento</option>';

      departamentos.forEach((dept) => {
        const option = document.createElement("option");
        option.value = dept;
        option.textContent = dept;
        selectDepartamento.appendChild(option);
      });

      console.log(
        `✅ ${departamentos.length} departamento(s) carregado(s):`,
        departamentos
      );
    } else {
      selectDepartamento.innerHTML =
        '<option value="">Documento "geral" não encontrado</option>';
      console.error("❌ Documento configuracoesSistema/geral não encontrado");
    }
  } catch (error) {
    console.error("❌ Erro ao carregar departamentos:", error);
    selectDepartamento.innerHTML =
      '<option value="">Erro ao carregar departamentos</option>';

    // Log detalhado do erro
    if (error.code === "permission-denied") {
      console.error("⚠️ Permissão negada. Verifique as regras do Firestore.");
    } else if (error.code === "not-found") {
      console.error("⚠️ Documento não encontrado.");
    }
  }
}

/**
 * Carrega vagas do Firestore por status
 */
async function carregarVagas(statusAba) {
  console.log(`🔹 Carregando vagas para aba: ${statusAba}`);

  const listaVagas = document.getElementById("lista-vagas");
  const mensagemVagas = document.getElementById("mensagem-vagas");

  showGlobalLoading(true);

  try {
    const statusFiltro = STATUS_TAB_MAP[statusAba] || [];

    if (statusFiltro.length === 0) {
      listaVagas.innerHTML =
        '<p class="alert alert-warning">Status de aba inválido.</p>';
      return;
    }

    const q = query(vagasCollection, where("status", "in", statusFiltro));

    const snapshot = await getDocs(q);

    // Atualiza contador na aba
    const tab = document.querySelector(`[data-status="${statusAba}"]`);
    if (tab) {
      const textoOriginal = tab.textContent.split("(")[0].trim();
      tab.innerHTML = `${
        tab.querySelector("i")?.outerHTML || ""
      } ${textoOriginal} (${snapshot.size})`;
    }

    if (snapshot.empty) {
      listaVagas.innerHTML =
        '<p class="alert alert-info">Nenhuma vaga encontrada para este status.</p>';
      return;
    }

    // Renderiza lista de vagas
    let htmlVagas = '<div class="list-vagas-grid">';

    snapshot.forEach((docSnap) => {
      const vaga = docSnap.data();
      const vagaId = docSnap.id;

      htmlVagas += renderizarCardVaga(vagaId, vaga, statusAba);
    });

    htmlVagas += "</div>";
    listaVagas.innerHTML = htmlVagas;

    // Anexa listeners aos botões
    anexarListenersVagas(statusAba);

    console.log(`✅ ${snapshot.size} vaga(s) carregada(s)`);
  } catch (error) {
    console.error("❌ Erro ao carregar vagas:", error);
    listaVagas.innerHTML = `<p class="alert alert-error">Erro ao carregar vagas: ${error.message}</p>`;
  } finally {
    showGlobalLoading(false);
  }
}

/**
 * Renderiza card de vaga
 */
function renderizarCardVaga(vagaId, vaga, statusAba) {
  const status = vaga.status || "N/A";
  const dataCriacao = vaga.data_criacao
    ? formatarData(vaga.data_criacao.toDate())
    : "N/A";

  let corStatus = "info";
  if (status.includes("Aprovada")) corStatus = "success";
  else if (status.includes("Correção")) corStatus = "warning";
  else if (status.includes("Cancelada")) corStatus = "error";

  let botoesAcao = "";

  // Define botões conforme o status da aba
  switch (statusAba) {
    case "abertas":
      botoesAcao = `
        <button class="action-button primary btn-editar-vaga" data-id="${vagaId}">
          <i class="fas fa-edit me-1"></i> Editar
        </button>
        <button class="action-button success btn-enviar-aprovacao" data-id="${vagaId}">
          <i class="fas fa-paper-plane me-1"></i> Enviar p/ Aprovação
        </button>
      `;
      break;

    case "correcao":
      botoesAcao = `
        <button class="action-button info btn-ver-feedback" data-id="${vagaId}">
          <i class="fas fa-exclamation-circle me-1"></i> Ver Feedback
        </button>
        <button class="action-button primary btn-editar-vaga" data-id="${vagaId}">
          <i class="fas fa-edit me-1"></i> Corrigir
        </button>
      `;
      break;

    case "aprovacao-gestao":
      botoesAcao = `
        <button class="action-button info btn-visualizar-vaga" data-id="${vagaId}">
          <i class="fas fa-eye me-1"></i> Visualizar
        </button>
        <button class="action-button success btn-aprovar-ficha" data-id="${vagaId}">
          <i class="fas fa-check me-1"></i> Aprovar
        </button>
        <button class="action-button warning btn-solicitar-correcao-ficha" data-id="${vagaId}">
          <i class="fas fa-edit me-1"></i> Solicitar Correção
        </button>
      `;
      break;

    case "arte-pendente":
      botoesAcao = `
        <button class="action-button primary btn-criar-arte" data-id="${vagaId}">
          <i class="fas fa-palette me-1"></i> Criar Arte
        </button>
      `;
      break;

    case "aprovacao-arte":
      botoesAcao = `
        <button class="action-button info btn-visualizar-arte" data-id="${vagaId}">
          <i class="fas fa-eye me-1"></i> Visualizar Arte
        </button>
        <button class="action-button success btn-aprovar-arte" data-id="${vagaId}">
          <i class="fas fa-check me-1"></i> Aprovar Arte
        </button>
        <button class="action-button warning btn-solicitar-correcao-arte" data-id="${vagaId}">
          <i class="fas fa-edit me-1"></i> Solicitar Correção
        </button>
      `;
      break;

    case "em-divulgacao":
      botoesAcao = `
        <button class="action-button primary btn-gerenciar-divulgacao" data-id="${vagaId}">
          <i class="fas fa-bullhorn me-1"></i> Gerenciar Divulgação
        </button>
      `;
      break;

    case "fechadas":
      botoesAcao = `
        <button class="action-button info btn-visualizar-fechada" data-id="${vagaId}">
          <i class="fas fa-eye me-1"></i> Ver Detalhes
        </button>
        <button class="action-button secondary btn-reaproveitar" data-id="${vagaId}">
          <i class="fas fa-copy me-1"></i> Reaproveitar
        </button>
      `;
      break;
  }

  return `
    <div class="card-vaga-gestao" data-id="${vagaId}">
      <div class="vaga-header">
        <h4>${vaga.nome || "Vaga Sem Nome"}</h4>
        <span class="status-badge status-${corStatus}">${status}</span>
      </div>
      
      <div class="vaga-info">
        <p><strong>Departamento:</strong> ${vaga.departamento || "N/A"}</p>
        <p><strong>Regime:</strong> ${capitalize(
          vaga.regime_trabalho || "N/A"
        )}</p>
        <p><strong>Modalidade:</strong> ${capitalize(
          vaga.modalidade_trabalho || "N/A"
        )}</p>
        <p><strong>Criada em:</strong> ${dataCriacao}</p>
      </div>
      
      <div class="vaga-acoes">
        ${botoesAcao}
      </div>
    </div>
  `;
}

/**
 * Anexa listeners aos botões de ação das vagas
 */
function anexarListenersVagas(statusAba) {
  // Editar vaga
  document.querySelectorAll(".btn-editar-vaga").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await abrirModalEdicaoVaga(vagaId);
    });
  });

  // Enviar para aprovação
  document.querySelectorAll(".btn-enviar-aprovacao").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await enviarParaAprovacao(vagaId);
    });
  });

  // Ver feedback
  document.querySelectorAll(".btn-ver-feedback").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await exibirFeedbackCorrecao(vagaId);
    });
  });

  // Visualizar vaga
  document.querySelectorAll(".btn-visualizar-vaga").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await visualizarVaga(vagaId);
    });
  });

  // Aprovar ficha
  document.querySelectorAll(".btn-aprovar-ficha").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await aprovarFichaTecnica(vagaId);
    });
  });

  // Solicitar correção ficha
  document.querySelectorAll(".btn-solicitar-correcao-ficha").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await solicitarCorrecaoFicha(vagaId);
    });
  });

  // Criar arte
  document.querySelectorAll(".btn-criar-arte").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await abrirModalCriacaoArte(vagaId);
    });
  });

  // Visualizar arte
  document.querySelectorAll(".btn-visualizar-arte").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await visualizarArte(vagaId);
    });
  });

  // Aprovar arte
  document.querySelectorAll(".btn-aprovar-arte").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await aprovarArte(vagaId);
    });
  });

  // Solicitar correção arte
  document.querySelectorAll(".btn-solicitar-correcao-arte").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await solicitarCorrecaoArte(vagaId);
    });
  });

  // Gerenciar divulgação
  document.querySelectorAll(".btn-gerenciar-divulgacao").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await abrirModalDivulgacao(vagaId);
    });
  });

  // Visualizar fechada
  document.querySelectorAll(".btn-visualizar-fechada").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await visualizarVagaFechada(vagaId);
    });
  });

  // Reaproveitar
  document.querySelectorAll(".btn-reaproveitar").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const vagaId = e.currentTarget.dataset.id;
      await reaproveitarVaga(vagaId);
    });
  });
}

// ============================================
// HANDLERS DE FORMULÁRIOS
// ============================================

/**
 * Salva ou atualiza vaga
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  console.log("🔹 Salvando vaga...");

  if (!validarFormularioVaga()) {
    return;
  }

  const submitButton = document.getElementById("btn-salvar-vaga");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';
  }

  try {
    const dadosVaga = coletarDadosFormularioVaga();

    if (vagaAtualId) {
      // Atualiza vaga existente
      const vagaRef = doc(vagasCollection, vagaAtualId);
      await updateDoc(vagaRef, {
        ...dadosVaga,
        data_atualizacao: new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: "Ficha Técnica atualizada",
          usuario: currentUserData?.id || "sistema",
        }),
      });

      window.showToast?.("Vaga atualizada com sucesso!", "success");
      console.log("✅ Vaga atualizada:", vagaAtualId);
    } else {
      // Cria nova vaga
      const novaVaga = {
        ...dadosVaga,
        status: "Em Elaboração (Ficha Técnica)",
        data_criacao: new Date(),
        criado_por: currentUserData?.id || "sistema",
        historico: [
          {
            data: new Date(),
            acao: "Vaga criada",
            usuario: currentUserData?.id || "sistema",
          },
        ],
      };

      const docRef = await addDoc(vagasCollection, novaVaga);
      window.showToast?.("Vaga criada com sucesso!", "success");
      console.log("✅ Nova vaga criada:", docRef.id);
    }

    fecharModal(ID_MODAL_FICHA_TECNICA);
    limparFormularioVaga();
    carregarVagas(statusAbaAtiva);
  } catch (error) {
    console.error("❌ Erro ao salvar vaga:", error);

    if (error.code === "permission-denied") {
      window.showToast?.("Você não tem permissão para esta ação.", "error");
    } else {
      window.showToast?.(`Erro ao salvar vaga: ${error.message}`, "error");
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-save me-2"></i> Salvar e Próxima Etapa';
    }
  }
}

/**
 * Coleta dados do formulário de vaga
 */
function coletarDadosFormularioVaga() {
  return {
    nome: document.getElementById("vaga-nome").value.trim(),
    departamento: document.getElementById("vaga-departamento").value,
    tipo_recrutamento: document.getElementById("vaga-tipo-recrutamento").value,
    regime_trabalho: document.getElementById("vaga-regime-trabalho").value,
    modalidade_trabalho: document.getElementById("vaga-modalidade-trabalho")
      .value,
    responsabilidades: document
      .getElementById("vaga-responsabilidades")
      .value.trim(),
    resultados: document.getElementById("vaga-resultados").value.trim(),
    nova_substituicao: document
      .getElementById("vaga-nova-substituicao")
      .value.trim(),
    valor_salario: document.getElementById("vaga-valor-salario").value.trim(),
    data_fechamento: document.getElementById("vaga-data-fechamento").value,
    formacao_minima: document
      .getElementById("vaga-formacao-minima")
      .value.trim(),
    conselho: document.getElementById("vaga-conselho").value.trim(),
    especializacoes: document
      .getElementById("vaga-especializacoes")
      .value.trim(),
    comp_tecnicas: document.getElementById("vaga-comp-tecnicas").value.trim(),
    comp_comportamentais: document
      .getElementById("vaga-comp-comportamentais")
      .value.trim(),
    certificacoes: document.getElementById("vaga-certificacoes").value.trim(),
    nivel_experiencia: document.getElementById("vaga-nivel-experiencia").value,
    contextos_similares: document
      .getElementById("vaga-contextos-similares")
      .value.trim(),
    atuacao_grupos: document.getElementById("vaga-atuacao-grupos").value.trim(),
    fit_valores: document.getElementById("vaga-fit-valores").value.trim(),
    estilo_equipe: document.getElementById("vaga-estilo-equipe").value.trim(),
    perfil_destaque: document
      .getElementById("vaga-perfil-destaque")
      .value.trim(),
    oportunidades: document.getElementById("vaga-oportunidades").value.trim(),
    desafios: document.getElementById("vaga-desafios").value.trim(),
    plano_carreira: document.getElementById("vaga-plano-carreira").value.trim(),
  };
}
// ============================================
// OPERAÇÕES DE VAGA
// ============================================

/**
 * Abre modal para edição de vaga
 */
async function abrirModalEdicaoVaga(vagaId) {
  console.log(`🔹 Abrindo modal de edição para vaga: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();
    vagaAtualId = vagaId;

    // Preenche os campos
    document.getElementById("vaga-nome").value = vaga.nome || "";
    document.getElementById("vaga-departamento").value =
      vaga.departamento || "";
    document.getElementById("vaga-tipo-recrutamento").value =
      vaga.tipo_recrutamento || "";
    document.getElementById("vaga-regime-trabalho").value =
      vaga.regime_trabalho || "";
    document.getElementById("vaga-modalidade-trabalho").value =
      vaga.modalidade_trabalho || "";
    document.getElementById("vaga-responsabilidades").value =
      vaga.responsabilidades || "";
    document.getElementById("vaga-resultados").value = vaga.resultados || "";
    document.getElementById("vaga-nova-substituicao").value =
      vaga.nova_substituicao || "";
    document.getElementById("vaga-valor-salario").value =
      vaga.valor_salario || "";
    document.getElementById("vaga-data-fechamento").value =
      vaga.data_fechamento || "";
    document.getElementById("vaga-formacao-minima").value =
      vaga.formacao_minima || "";
    document.getElementById("vaga-conselho").value = vaga.conselho || "";
    document.getElementById("vaga-especializacoes").value =
      vaga.especializacoes || "";
    document.getElementById("vaga-comp-tecnicas").value =
      vaga.comp_tecnicas || "";
    document.getElementById("vaga-comp-comportamentais").value =
      vaga.comp_comportamentais || "";
    document.getElementById("vaga-certificacoes").value =
      vaga.certificacoes || "";
    document.getElementById("vaga-nivel-experiencia").value =
      vaga.nivel_experiencia || "";
    document.getElementById("vaga-contextos-similares").value =
      vaga.contextos_similares || "";
    document.getElementById("vaga-atuacao-grupos").value =
      vaga.atuacao_grupos || "";
    document.getElementById("vaga-fit-valores").value = vaga.fit_valores || "";
    document.getElementById("vaga-estilo-equipe").value =
      vaga.estilo_equipe || "";
    document.getElementById("vaga-perfil-destaque").value =
      vaga.perfil_destaque || "";
    document.getElementById("vaga-oportunidades").value =
      vaga.oportunidades || "";
    document.getElementById("vaga-desafios").value = vaga.desafios || "";
    document.getElementById("vaga-plano-carreira").value =
      vaga.plano_carreira || "";

    // Atualiza título do modal
    document.getElementById("ficha-title").textContent = `Editando: ${
      vaga.nome || "Vaga"
    }`;

    abrirModal(ID_MODAL_FICHA_TECNICA);
    console.log("✅ Modal de edição aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de edição:", error);
    window.showToast?.(`Erro ao carregar vaga: ${error.message}`, "error");
  }
}

/**
 * Envia vaga para aprovação de ficha técnica
 */
async function enviarParaAprovacao(vagaId) {
  console.log(`🔹 Enviando vaga para aprovação: ${vagaId}`);

  const confirmacao = confirm(
    "Deseja enviar esta vaga para aprovação da Ficha Técnica?"
  );
  if (!confirmacao) return;

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Ficha Técnica Aprovada (Aguardando Criação de Arte)",
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga enviada para aprovação",
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.("Vaga enviada para aprovação!", "success");
    carregarVagas(statusAbaAtiva);
    console.log("✅ Vaga enviada para aprovação");
  } catch (error) {
    console.error("❌ Erro ao enviar para aprovação:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Aprova ficha técnica
 */
async function aprovarFichaTecnica(vagaId) {
  console.log(`🔹 Aprovando ficha técnica: ${vagaId}`);

  const confirmacao = confirm("Deseja APROVAR a Ficha Técnica desta vaga?");
  if (!confirmacao) return;

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Arte em Criação",
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Ficha Técnica aprovada",
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.(
      "Ficha Técnica aprovada! Aguardando criação da arte.",
      "success"
    );
    carregarVagas(statusAbaAtiva);
    console.log("✅ Ficha Técnica aprovada");
  } catch (error) {
    console.error("❌ Erro ao aprovar ficha:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Solicita correção na ficha técnica
 */
async function solicitarCorrecaoFicha(vagaId) {
  console.log(`🔹 Abrindo modal de correção para ficha: ${vagaId}`);

  try {
    // Carrega dados da vaga para exibir informações
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();

    // Configura o modal
    document.getElementById("vaga-id-correcao").value = vagaId;
    document.getElementById("tipo-correcao").value = "ficha";
    document.getElementById(
      "modal-correcao-title"
    ).textContent = `Solicitar Correção - ${vaga.nome || "Vaga"}`;
    document.getElementById("motivo-correcao").value = "";

    abrirModal("modal-solicitar-correcao");
    console.log("✅ Modal de correção aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de correção:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Abre modal para criar arte
 */
async function abrirModalCriacaoArte(vagaId) {
  console.log(`🔹 Abrindo modal de criação de arte: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();
    vagaAtualId = vagaId;

    // Preenche informações da arte
    document.getElementById("vaga-id-arte-criacao").value = vagaId;
    document.getElementById("vaga-resumo-arte").value = vaga.resumo || "";
    document.getElementById("vaga-link-arte").value = "";
    document.getElementById("vaga-texto-divulgacao").value = "";

    abrirModal(ID_MODAL_CRIACAO_ARTE);
    console.log("✅ Modal de criação de arte aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de arte:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Envia arte para aprovação
 */
async function handleEnviarAprovacaoArte(e) {
  e.preventDefault();

  const vagaId = document.getElementById("vaga-id-arte-criacao").value;
  const linkArte = document.getElementById("vaga-link-arte").value.trim();
  const textoDiv = document
    .getElementById("vaga-texto-divulgacao")
    .value.trim();

  if (!linkArte || !textoDiv) {
    window.showToast?.(
      "Por favor, preencha o link da arte e o texto de divulgação.",
      "error"
    );
    return;
  }

  console.log(`🔹 Enviando arte para aprovação: ${vagaId}`);

  const submitButton = document.getElementById("btn-enviar-aprovacao-arte");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';
  }

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Arte Criada (Aguardando Aprovação)",
      arte_link: linkArte,
      texto_divulgacao: textoDiv,
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Arte enviada para aprovação",
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.("Arte enviada para aprovação!", "success");
    fecharModal(ID_MODAL_CRIACAO_ARTE);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Arte enviada");
  } catch (error) {
    console.error("❌ Erro ao enviar arte:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-paper-plane me-2"></i> Enviar para Aprovação';
    }
  }
}

/**
 * Aprova arte
 */
async function aprovarArte(vagaId) {
  console.log(`🔹 Aprovando arte: ${vagaId}`);

  const confirmacao = confirm("Deseja APROVAR a arte de divulgação?");
  if (!confirmacao) return;

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Arte Aprovada (Em Divulgação)",
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Arte aprovada",
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.(
      "Arte aprovada! Vaga pronta para divulgação.",
      "success"
    );
    carregarVagas(statusAbaAtiva);
    console.log("✅ Arte aprovada");
  } catch (error) {
    console.error("❌ Erro ao aprovar arte:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Solicita correção na arte
 */
async function solicitarCorrecaoArte(vagaId) {
  console.log(`🔹 Abrindo modal de correção para arte: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();

    // Configura o modal
    document.getElementById("vaga-id-correcao").value = vagaId;
    document.getElementById("tipo-correcao").value = "arte";
    document.getElementById(
      "modal-correcao-title"
    ).textContent = `Solicitar Correção na Arte - ${vaga.nome || "Vaga"}`;
    document.getElementById("motivo-correcao").value = "";

    abrirModal("modal-solicitar-correcao");
    console.log("✅ Modal de correção de arte aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de correção:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Processa a solicitação de correção (ficha ou arte)
 */
async function handleSolicitarCorrecao(e) {
  e.preventDefault();

  const vagaId = document.getElementById("vaga-id-correcao").value;
  const tipo = document.getElementById("tipo-correcao").value;
  const motivo = document.getElementById("motivo-correcao").value.trim();

  if (!motivo) {
    window.showToast?.("Por favor, descreva o motivo da correção.", "error");
    return;
  }

  console.log(`🔹 Enviando solicitação de correção (${tipo}): ${vagaId}`);

  const submitButton = document.getElementById("btn-confirmar-correcao");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';
  }

  try {
    const vagaRef = doc(vagasCollection, vagaId);

    let updateData = {};
    let mensagemSucesso = "";

    if (tipo === "ficha") {
      updateData = {
        status: "Em Correção (Ficha Técnica)",
        feedback_correcao: motivo,
        data_atualizacao: new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: `Correção de Ficha Técnica solicitada: ${motivo}`,
          usuario: currentUserData?.id || "sistema",
        }),
      };
      mensagemSucesso = "Solicitação de correção da Ficha Técnica enviada!";
    } else if (tipo === "arte") {
      updateData = {
        status: "Em Correção (Arte)",
        feedback_arte: motivo,
        data_atualizacao: new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: `Correção de Arte solicitada: ${motivo}`,
          usuario: currentUserData?.id || "sistema",
        }),
      };
      mensagemSucesso = "Solicitação de correção da Arte enviada!";
    }

    await updateDoc(vagaRef, updateData);

    window.showToast?.(mensagemSucesso, "success");
    fecharModal("modal-solicitar-correcao");

    // Fecha também o modal de aprovação se estiver aberto
    if (tipo === "arte") {
      fecharModal("modal-aprovacao-arte");
    }

    carregarVagas(statusAbaAtiva);
    console.log("✅ Correção solicitada com sucesso");
  } catch (error) {
    console.error("❌ Erro ao solicitar correção:", error);
    window.showToast?.(`Erro ao enviar solicitação: ${error.message}`, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-paper-plane me-2"></i> Enviar Solicitação';
    }
  }
}

/**
 * Abre modal para gerenciar divulgação
 */
async function abrirModalDivulgacao(vagaId) {
  console.log(`🔹 Abrindo modal de divulgação: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();

    // Preenche informações
    document.getElementById("vaga-id-divulgacao").value = vagaId;
    document.getElementById("divulgacao-link-clicavel").href =
      vaga.arte_link || "#";
    document.getElementById("divulgacao-texto-aprovado").textContent =
      vaga.texto_divulgacao || "N/A";
    document.getElementById("vaga-periodo-divulgacao").value =
      vaga.periodo_divulgacao || "";

    // Seleciona canais
    const canaisSelect = document.getElementById("vaga-canais-divulgacao");
    const canais = vaga.canais_divulgacao || [];
    Array.from(canaisSelect.options).forEach((option) => {
      option.selected = canais.includes(option.value);
    });

    abrirModal(ID_MODAL_DIVULGACAO);
    console.log("✅ Modal de divulgação aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de divulgação:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Salva divulgação
 */
async function handleSalvarDivulgacao(e) {
  e.preventDefault();

  const vagaId = document.getElementById("vaga-id-divulgacao").value;
  const periodo = document
    .getElementById("vaga-periodo-divulgacao")
    .value.trim();
  const canaisSelect = document.getElementById("vaga-canais-divulgacao");
  const canais = Array.from(canaisSelect.selectedOptions).map(
    (opt) => opt.value
  );

  if (!periodo || canais.length === 0) {
    window.showToast?.("Por favor, preencha todos os campos.", "error");
    return;
  }

  console.log(`🔹 Salvando divulgação: ${vagaId}`);

  const submitButton = document.getElementById("btn-salvar-divulgacao");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';
  }

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      periodo_divulgacao: periodo,
      canais_divulgacao: canais,
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `Divulgação registrada nos canais: ${canais.join(", ")}`,
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.("Divulgação salva com sucesso!", "success");
    fecharModal(ID_MODAL_DIVULGACAO);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Divulgação salva");
  } catch (error) {
    console.error("❌ Erro ao salvar divulgação:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-save me-2"></i> Salvar Divulgação';
    }
  }
}

/**
 * Encerra vaga
 */
async function handleEncerrarVaga() {
  const vagaId = document.getElementById("vaga-id-divulgacao").value;
  const motivo = prompt("Qual o motivo do encerramento da vaga?");

  if (!motivo) return;

  console.log(`🔹 Encerrando vaga: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Vaga Encerrada",
      motivo_encerramento: motivo,
      data_encerramento: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `Vaga encerrada: ${motivo}`,
        usuario: currentUserData?.id || "sistema",
      }),
    });

    window.showToast?.("Vaga encerrada com sucesso!", "success");
    fecharModal(ID_MODAL_DIVULGACAO);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Vaga encerrada");
  } catch (error) {
    console.error("❌ Erro ao encerrar vaga:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Visualiza vaga fechada
 */
async function visualizarVagaFechada(vagaId) {
  console.log(`🔹 Visualizando vaga fechada: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();
    vagaAtualId = vagaId;

    // Renderiza ficha completa
    const fichaParts = [
      `<p><strong>Cargo:</strong> ${vaga.nome}</p>`,
      `<p><strong>Departamento:</strong> ${vaga.departamento}</p>`,
      `<p><strong>Regime:</strong> ${capitalize(vaga.regime_trabalho)}</p>`,
      `<p><strong>Salário:</strong> ${vaga.valor_salario || "A combinar"}</p>`,
    ];

    document.getElementById("visualizacao-ficha-completa").innerHTML =
      fichaParts.join("");

    // Renderiza arte
    const arteParts = [
      `<p><strong>Link:</strong> <a href="${vaga.arte_link}" target="_blank">Ver Arte</a></p>`,
      `<p><strong>Texto:</strong> ${vaga.texto_divulgacao || "N/A"}</p>`,
      `<p><strong>Canais:</strong> ${
        (vaga.canais_divulgacao || []).join(", ") || "N/A"
      }</p>`,
    ];

    document.getElementById("visualizacao-arte-completa").innerHTML =
      arteParts.join("");

    // Renderiza histórico
    const historico = vaga.historico || [];
    const historicoHtml = historico
      .map(
        (item) =>
          `<p>${formatarData(item.data)} - ${item.acao} (${item.usuario})</p>`
      )
      .join("");

    document.getElementById("visualizacao-historico").innerHTML =
      historicoHtml || "<p>Sem histórico</p>";

    document.getElementById("vaga-id-fechadas").value = vagaId;
    document.getElementById(
      "fechadas-title"
    ).textContent = `Vaga: ${vaga.nome}`;

    abrirModal(ID_MODAL_FECHADAS);
    console.log("✅ Vaga fechada visualizada");
  } catch (error) {
    console.error("❌ Erro ao visualizar vaga:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

/**
 * Reaproveita vaga
 */
async function reaproveitarVaga(vagaId) {
  console.log(`🔹 Reaproveitando vaga: ${vagaId}`);

  const confirmacao = confirm(
    "Deseja reaproveitar esta vaga? Uma cópia será criada em status 'Em Elaboração'."
  );
  if (!confirmacao) return;

  try {
    const vagaOriginal = await getDoc(doc(vagasCollection, vagaId));

    if (!vagaOriginal.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const dados = vagaOriginal.data();
    const novaVaga = { ...dados };
    delete novaVaga.status;
    delete novaVaga.data_criacao;
    delete novaVaga.data_atualizacao;
    delete novaVaga.historico;

    novaVaga.status = "Em Elaboração (Ficha Técnica)";
    novaVaga.data_criacao = new Date();
    novaVaga.vaga_original_id = vagaId;
    novaVaga.historico = [
      {
        data: new Date(),
        acao: `Reaproveitada da vaga ${dados.nome}`,
        usuario: currentUserData?.id || "sistema",
      },
    ];

    const docRef = await addDoc(vagasCollection, novaVaga);

    window.showToast?.("Vaga reaproveita com sucesso!", "success");
    fecharModal(ID_MODAL_FECHADAS);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Vaga reaproveita:", docRef.id);
  } catch (error) {
    console.error("❌ Erro ao reaproveitar vaga:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

// ============================================
// VISUALIZAÇÃO DE DADOS
// ============================================

async function visualizarVaga(vagaId) {
  // Similar a abrirModalEdicaoVaga, mas em modo somente leitura
  await abrirModalEdicaoVaga(vagaId);
  // Desabilitar campos
  document
    .querySelectorAll(
      "#form-vaga input, #form-vaga textarea, #form-vaga select"
    )
    .forEach((input) => {
      input.disabled = true;
    });
}

async function visualizarArte(vagaId) {
  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) return;

    const vaga = vagaSnap.data();

    document.getElementById("vaga-id-arte-aprovacao").value = vagaId;
    document.getElementById("aprovacao-salario").textContent =
      vaga.valor_salario || "A combinar";
    document.getElementById("aprovacao-regime").textContent = capitalize(
      vaga.regime_trabalho || ""
    );
    document.getElementById("aprovacao-modalidade").textContent = capitalize(
      vaga.modalidade_trabalho || ""
    );
    document.getElementById("link-arte-clicavel").href = vaga.arte_link || "#";
    document.getElementById("aprovacao-texto-divulgacao-visual").textContent =
      vaga.texto_divulgacao || "N/A";

    abrirModal(ID_MODAL_APROVACAO_ARTE);
  } catch (error) {
    console.error("❌ Erro ao visualizar arte:", error);
  }
}

async function exibirFeedbackCorrecao(vagaId) {
  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) return;

    const vaga = vagaSnap.data();
    const feedback = vaga.feedback_correcao || "Sem feedback";

    alert(`Feedback para correção:\n\n${feedback}`);
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

// ============================================
// GERENCIAMENTO DE ABAS
// ============================================

/**
 * Configura listeners das abas
 */
function configurarAbas() {
  document.querySelectorAll(".tab-link").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const status = e.currentTarget.getAttribute("data-status");
      statusAbaAtiva = status;

      // Remove ativa de todos
      document
        .querySelectorAll(".tab-link")
        .forEach((t) => t.classList.remove("active"));
      e.currentTarget.classList.add("active");

      // Carrega vagas
      carregarVagas(status);
    });
  });
}

// ============================================
// INICIALIZAÇÃO
// ============================================

/**
 * Inicializa o módulo
 */
/**
 * Inicializa o módulo de Gestão de Vagas
 * @param {Object} user - Objeto do usuário autenticado (Firebase Auth)
 * @param {Object} userData - Dados adicionais do usuário (Firestore)
 */
export async function initGestaoVagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas...");

  // ============================================
  // INICIALIZAÇÃO DE VARIÁVEIS GLOBAIS
  // ============================================
  currentUserData = userData || {};
  vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
  configCollection = collection(db, CONFIG_COLLECTION_NAME);

  // ============================================
  // CARREGAMENTO INICIAL
  // ============================================

  // Carrega departamentos do Firebase
  await carregarDepartamentos();

  // ============================================
  // CONFIGURAÇÃO DE LISTENERS GLOBAIS
  // ============================================

  // Configura sistema de abas
  configurarAbas();

  // Configura fechamento de modais (X e clique fora)
  configurarFechamentoModais();

  // ============================================
  // LISTENERS DE FORMULÁRIOS
  // ============================================

  // Formulário de Ficha Técnica (criar/editar vaga)
  const formVaga = document.getElementById("form-vaga");
  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
    console.log("✅ Listener: form-vaga");
  }

  // Formulário de Criação de Arte
  const formCriacaoArte = document.getElementById("form-criacao-arte");
  if (formCriacaoArte) {
    formCriacaoArte.addEventListener("submit", (e) => {
      e.preventDefault();
      // handleEnviarAprovacaoArte é chamado pelo botão diretamente
    });
    console.log("✅ Listener: form-criacao-arte");
  }

  // Formulário de Divulgação
  const formDivulgacao = document.getElementById("form-divulgacao");
  if (formDivulgacao) {
    formDivulgacao.addEventListener("submit", handleSalvarDivulgacao);
    console.log("✅ Listener: form-divulgacao");
  }

  // Formulário de Solicitação de Correção
  const formSolicitarCorrecao = document.getElementById(
    "form-solicitar-correcao"
  );
  if (formSolicitarCorrecao) {
    formSolicitarCorrecao.addEventListener("submit", handleSolicitarCorrecao);
    console.log("✅ Listener: form-solicitar-correcao");
  }

  // ============================================
  // LISTENERS DE BOTÕES PRINCIPAIS
  // ============================================

  // Botão: Criar Nova Vaga
  const btnNovaVaga = document.getElementById("btn-nova-vaga");
  if (btnNovaVaga) {
    btnNovaVaga.addEventListener("click", () => {
      limparFormularioVaga();
      document.getElementById("ficha-title").textContent = "Nova Vaga";
      vagaAtualId = null;
      abrirModal(ID_MODAL_FICHA_TECNICA);
      console.log("🔹 Abrindo modal para nova vaga");
    });
    console.log("✅ Listener: btn-nova-vaga");
  }

  // Botão: Enviar Arte para Aprovação
  const btnEnviarAprovacaoArte = document.getElementById(
    "btn-enviar-aprovacao-arte"
  );
  if (btnEnviarAprovacaoArte) {
    btnEnviarAprovacaoArte.addEventListener("click", handleEnviarAprovacaoArte);
    console.log("✅ Listener: btn-enviar-aprovacao-arte");
  }

  // Botão: Aprovar Arte Final
  const btnAprovarArteFinal = document.getElementById("btn-aprovar-arte-final");
  if (btnAprovarArteFinal) {
    btnAprovarArteFinal.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-arte-aprovacao").value;
      await aprovarArte(vagaId);
    });
    console.log("✅ Listener: btn-aprovar-arte-final");
  }

  // Botão: Solicitar Alterações na Arte
  const btnSolicitarAlteracoesArte = document.getElementById(
    "btn-solicitar-alteracoes-arte"
  );
  if (btnSolicitarAlteracoesArte) {
    btnSolicitarAlteracoesArte.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-arte-aprovacao").value;
      fecharModal(ID_MODAL_APROVACAO_ARTE); // Fecha o modal de aprovação
      await solicitarCorrecaoArte(vagaId);
    });
    console.log("✅ Listener: btn-solicitar-alteracoes-arte");
  }

  // Botão: Salvar Divulgação
  const btnSalvarDivulgacao = document.getElementById("btn-salvar-divulgacao");
  if (btnSalvarDivulgacao) {
    btnSalvarDivulgacao.addEventListener("click", async () => {
      const form = document.getElementById("form-divulgacao");
      if (form) {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });
    console.log("✅ Listener: btn-salvar-divulgacao");
  }

  // Botão: Encerrar Vaga
  const btnEncerrarVaga = document.getElementById("btn-encerrar-vaga");
  if (btnEncerrarVaga) {
    btnEncerrarVaga.addEventListener("click", handleEncerrarVaga);
    console.log("✅ Listener: btn-encerrar-vaga");
  }

  // Botão: Cancelar Vaga Fechada
  const btnCancelarVagaFechada = document.getElementById(
    "btn-cancelar-vaga-fechada"
  );
  if (btnCancelarVagaFechada) {
    btnCancelarVagaFechada.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-fechadas").value;

      const confirmacao = confirm(
        "Tem certeza que deseja CANCELAR esta vaga? Esta ação não pode ser desfeita."
      );

      if (!confirmacao) return;

      try {
        const vagaRef = doc(vagasCollection, vagaId);
        await updateDoc(vagaRef, {
          status: "Vaga Cancelada",
          data_cancelamento: new Date(),
          historico: arrayUnion({
            data: new Date(),
            acao: "Vaga cancelada manualmente",
            usuario: currentUserData?.id || "sistema",
          }),
        });

        window.showToast?.("Vaga cancelada com sucesso.", "success");
        fecharModal(ID_MODAL_FECHADAS);
        carregarVagas(statusAbaAtiva);
        console.log("✅ Vaga cancelada:", vagaId);
      } catch (error) {
        console.error("❌ Erro ao cancelar vaga:", error);
        window.showToast?.(`Erro ao cancelar vaga: ${error.message}`, "error");
      }
    });
    console.log("✅ Listener: btn-cancelar-vaga-fechada");
  }

  // Botão: Reaproveitar Vaga
  const btnReaproveitarVaga = document.getElementById("btn-reaproveitar-vaga");
  if (btnReaproveitarVaga) {
    btnReaproveitarVaga.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-fechadas").value;
      await reaproveitarVaga(vagaId);
    });
    console.log("✅ Listener: btn-reaproveitar-vaga");
  }

  // ============================================
  // CARREGAMENTO INICIAL DE VAGAS
  // ============================================

  try {
    await carregarVagas(statusAbaAtiva);
    console.log("✅ Vagas iniciais carregadas");
  } catch (error) {
    console.error("❌ Erro ao carregar vagas iniciais:", error);
    const listaVagas = document.getElementById("lista-vagas");
    if (listaVagas) {
      listaVagas.innerHTML = `
        <p class="alert alert-error">
          Erro ao carregar vagas: ${error.message}
        </p>
      `;
    }
  }

  // ============================================
  // FINALIZAÇÃO
  // ============================================

  console.log("✅ Módulo de Gestão de Vagas inicializado com sucesso!");
  console.log(`   - Usuário: ${currentUserData?.nome || "Desconhecido"}`);
  console.log(`   - Role: ${currentUserData?.role || "N/A"}`);
  console.log(`   - Aba ativa: ${statusAbaAtiva}`);
}

// ============================================
// EXPORTAÇÃO PARA COMPATIBILIDADE COM ROTEADOR
// ============================================

/**
 * Alias para compatibilidade com o sistema de rotas
 */
export { initGestaoVagas as init };

// Compatibilidade com roteador
export { initGestaoVagas as init };
