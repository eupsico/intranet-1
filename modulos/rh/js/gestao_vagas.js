/**
 * Arquivo: modulos/rh/js/gestao_vagas.js
 * Versão: 4.0.0 (Auto-save, Feedback em Destaque, Status Separados)
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
const ID_MODAL_CORRECAO = "modal-solicitar-correcao";

// Mapeamento de status para abas
const STATUS_TAB_MAP = {
  abertas: ["Em Elaboração (Ficha Técnica)"],
  correcao: ["Em Correção (Ficha Técnica)", "Em Correção (Arte)"],
  "aprovacao-gestao": ["Aguardando Aprovação de Ficha"],
  "arte-pendente": [
    "Ficha Técnica Aprovada (Aguardando Criação de Arte)",
    "Arte em Criação",
  ],
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
  if (data.toDate) {
    return data.toDate().toLocaleDateString("pt-BR");
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
 * Mostra indicador visual de auto-save
 */
function mostrarIndicadorAutoSave(mensagem, tipo = "info") {
  let indicador = document.getElementById("autosave-indicator");

  if (!indicador) {
    indicador = document.createElement("div");
    indicador.id = "autosave-indicator";
    indicador.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      z-index: 10000;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    document.body.appendChild(indicador);
  }

  const cores = {
    info: { bg: "#17a2b8", color: "#fff" },
    success: { bg: "#28a745", color: "#fff" },
    error: { bg: "#dc3545", color: "#fff" },
  };

  const cor = cores[tipo] || cores.info;
  indicador.style.backgroundColor = cor.bg;
  indicador.style.color = cor.color;
  indicador.textContent = mensagem;
  indicador.style.opacity = "1";

  if (tipo === "success") {
    setTimeout(() => {
      indicador.style.opacity = "0";
    }, 2000);
  }
}

// ============================================
// AUTO-SAVE
// ============================================

/**
 * Configura auto-save nos campos do formulário de vaga
 */
function configurarAutoSave() {
  const form = document.getElementById("form-vaga");
  if (!form) return;

  let saveTimeout;
  const AUTOSAVE_DELAY = 2000;

  const campos = form.querySelectorAll("input, textarea, select");

  campos.forEach((campo) => {
    campo.addEventListener("input", () => {
      clearTimeout(saveTimeout);
      mostrarIndicadorAutoSave("Salvando...");

      saveTimeout = setTimeout(async () => {
        if (vagaAtualId) {
          await salvarAutoSave();
        }
      }, AUTOSAVE_DELAY);
    });
  });

  console.log("✅ Auto-save configurado");
}

/**
 * Salva automaticamente as alterações da vaga
 */
async function salvarAutoSave() {
  if (!vagaAtualId) return;

  try {
    const dadosVaga = coletarDadosFormularioVaga();
    const vagaRef = doc(vagasCollection, vagaAtualId);

    await updateDoc(vagaRef, {
      ...dadosVaga,
      data_atualizacao: new Date(),
    });

    mostrarIndicadorAutoSave("✓ Salvo automaticamente", "success");
    console.log("✅ Auto-save realizado:", vagaAtualId);
  } catch (error) {
    console.error("❌ Erro no auto-save:", error);
    mostrarIndicadorAutoSave("Erro ao salvar", "error");
  }
}

// ============================================
// GERENCIAMENTO DE MODAIS
// ============================================

function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("is-visible");
    console.log(`✅ Modal ${modalId} aberto`);
  } else {
    console.error(`❌ Modal ${modalId} não encontrado`);
  }
}

function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("is-visible");
    console.log(`🔹 Modal ${modalId} fechado`);
  }
}

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
 * Estrutura: configuracoesSistema/geral/listas/departamentos
 */
async function carregarDepartamentos() {
  const selectDepartamento = document.getElementById("vaga-departamento");
  if (!selectDepartamento) {
    console.warn("⚠️ Elemento select #vaga-departamento não encontrado");
    return;
  }

  console.log("🔹 Carregando departamentos do Firebase...");

  try {
    const geralDocRef = doc(configCollection, "geral");
    const geralSnap = await getDoc(geralDocRef);

    if (geralSnap.exists()) {
      const data = geralSnap.data();
      const departamentos = data.listas?.departamentos || [];

      if (departamentos.length === 0) {
        selectDepartamento.innerHTML =
          '<option value="">Nenhum departamento cadastrado</option>';
        console.warn(
          "⚠️ Array de departamentos está vazio em listas.departamentos"
        );
        return;
      }

      selectDepartamento.innerHTML =
        '<option value="">Selecione o Departamento</option>';

      departamentos.forEach((dept) => {
        const option = document.createElement("option");
        option.value = dept;
        option.textContent = dept;
        selectDepartamento.appendChild(option);
      });

      console.log(`✅ ${departamentos.length} departamento(s) carregado(s)`);
    } else {
      selectDepartamento.innerHTML =
        '<option value="">Documento "geral" não encontrado</option>';
      console.error(
        "❌ Documento configuracoesSistema/geral não existe no Firestore"
      );
    }
  } catch (error) {
    console.error("❌ Erro ao carregar departamentos:", error);
    selectDepartamento.innerHTML =
      '<option value="">Erro ao carregar departamentos</option>';
  }
}
// ============================================
// OPERAÇÕES DE VAGA
// ============================================

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
      const vagaRef = doc(vagasCollection, vagaAtualId);
      await updateDoc(vagaRef, {
        ...dadosVaga,
        data_atualizacao: new Date(),
        historico: arrayUnion({
          data: new Date(),
          acao: "Ficha Técnica salva",
          usuario: currentUserData?.id || "sistema",
        }),
      });

      window.showToast?.("Vaga atualizada com sucesso!", "success");
      console.log("✅ Vaga atualizada:", vagaAtualId);
    } else {
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
      vagaAtualId = docRef.id; // ✅ Define o ID para ativar auto-save
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

async function enviarParaAprovacao(vagaId) {
  console.log(`🔹 Enviando vaga para aprovação: ${vagaId}`);

  const confirmacao = confirm(
    "Deseja enviar esta vaga para aprovação da Ficha Técnica?"
  );
  if (!confirmacao) return;

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Aguardando Aprovação de Ficha",
      data_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga enviada para aprovação da Ficha Técnica",
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

async function aprovarFichaTecnica(vagaId) {
  console.log(`🔹 Aprovando ficha técnica: ${vagaId}`);

  const confirmacao = confirm("Deseja APROVAR a Ficha Técnica desta vaga?");
  if (!confirmacao) return;

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    await updateDoc(vagaRef, {
      status: "Ficha Técnica Aprovada (Aguardando Criação de Arte)",
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

async function solicitarCorrecaoFicha(vagaId) {
  console.log(`🔹 Abrindo modal de correção para ficha: ${vagaId}`);

  try {
    const vagaRef = doc(vagasCollection, vagaId);
    const vagaSnap = await getDoc(vagaRef);

    if (!vagaSnap.exists()) {
      window.showToast?.("Vaga não encontrada.", "error");
      return;
    }

    const vaga = vagaSnap.data();

    document.getElementById("vaga-id-correcao").value = vagaId;
    document.getElementById("tipo-correcao").value = "ficha";
    document.getElementById(
      "modal-correcao-title"
    ).textContent = `Solicitar Correção - ${vaga.nome || "Vaga"}`;
    document.getElementById("motivo-correcao").value = "";

    abrirModal(ID_MODAL_CORRECAO);
    console.log("✅ Modal de correção aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de correção:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

// ============================================
// OPERAÇÕES DE ARTE
// ============================================

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
    fecharModal(ID_MODAL_APROVACAO_ARTE);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Arte aprovada");
  } catch (error) {
    console.error("❌ Erro ao aprovar arte:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

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

    document.getElementById("vaga-id-correcao").value = vagaId;
    document.getElementById("tipo-correcao").value = "arte";
    document.getElementById(
      "modal-correcao-title"
    ).textContent = `Solicitar Correção na Arte - ${vaga.nome || "Vaga"}`;
    document.getElementById("motivo-correcao").value = "";

    abrirModal(ID_MODAL_CORRECAO);
    console.log("✅ Modal de correção de arte aberto");
  } catch (error) {
    console.error("❌ Erro ao abrir modal de correção:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

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
    fecharModal(ID_MODAL_CORRECAO);
    fecharModal(ID_MODAL_APROVACAO_ARTE);

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

// ============================================
// DIVULGAÇÃO E ENCERRAMENTO
// ============================================

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

    document.getElementById("vaga-id-divulgacao").value = vagaId;
    document.getElementById("divulgacao-link-clicavel").href =
      vaga.arte_link || "#";
    document.getElementById("divulgacao-texto-aprovado").textContent =
      vaga.texto_divulgacao || "N/A";
    document.getElementById("vaga-periodo-divulgacao").value =
      vaga.periodo_divulgacao || "";

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

// ============================================
// VISUALIZAÇÃO E REAPROVEITAMENTO
// ============================================

async function visualizarVaga(vagaId) {
  await abrirModalEdicaoVaga(vagaId);
  document
    .querySelectorAll(
      "#form-vaga input, #form-vaga textarea, #form-vaga select"
    )
    .forEach((input) => {
      input.disabled = true;
    });
}

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

    const fichaParts = [
      `<p><strong>Cargo:</strong> ${vaga.nome}</p>`,
      `<p><strong>Departamento:</strong> ${vaga.departamento}</p>`,
      `<p><strong>Regime:</strong> ${capitalize(vaga.regime_trabalho)}</p>`,
      `<p><strong>Salário:</strong> ${vaga.valor_salario || "A combinar"}</p>`,
    ];

    document.getElementById("visualizacao-ficha-completa").innerHTML =
      fichaParts.join("");

    const arteParts = [
      `<p><strong>Link:</strong> <a href="${vaga.arte_link}" target="_blank">Ver Arte</a></p>`,
      `<p><strong>Texto:</strong> ${vaga.texto_divulgacao || "N/A"}</p>`,
      `<p><strong>Canais:</strong> ${
        (vaga.canais_divulgacao || []).join(", ") || "N/A"
      }</p>`,
    ];

    document.getElementById("visualizacao-arte-completa").innerHTML =
      arteParts.join("");

    const historico = vaga.historico || [];
    const historicoHtml = historico
      .map(
        (item) =>
          `<p>${formatarData(item.data.toDate?.() || item.data)} - ${
            item.acao
          } (${item.usuario})</p>`
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

    window.showToast?.("Vaga reaproveitada com sucesso!", "success");
    fecharModal(ID_MODAL_FECHADAS);
    carregarVagas(statusAbaAtiva);
    console.log("✅ Vaga reaproveitada:", docRef.id);
  } catch (error) {
    console.error("❌ Erro ao reaproveitar vaga:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  }
}

// ============================================
// GERENCIAMENTO DE ABAS
// ============================================

function configurarAbas() {
  document.querySelectorAll(".tab-link").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const status = e.currentTarget.getAttribute("data-status");
      statusAbaAtiva = status;

      document
        .querySelectorAll(".tab-link")
        .forEach((t) => t.classList.remove("active"));
      e.currentTarget.classList.add("active");

      carregarVagas(status);
    });
  });
}

// ============================================
// INICIALIZAÇÃO COMPLETA
// ============================================

export async function initGestaoVagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas...");

  currentUserData = userData || {};
  vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
  configCollection = collection(db, CONFIG_COLLECTION_NAME);

  await carregarDepartamentos();

  configurarAbas();
  configurarFechamentoModais();
  configurarAutoSave();

  // Formulários
  const formVaga = document.getElementById("form-vaga");
  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  }

  const formCriacaoArte = document.getElementById("form-criacao-arte");
  if (formCriacaoArte) {
    formCriacaoArte.addEventListener("submit", handleEnviarAprovacaoArte);
  }

  const formDivulgacao = document.getElementById("form-divulgacao");
  if (formDivulgacao) {
    formDivulgacao.addEventListener("submit", handleSalvarDivulgacao);
  }

  const formSolicitarCorrecao = document.getElementById(
    "form-solicitar-correcao"
  );
  if (formSolicitarCorrecao) {
    formSolicitarCorrecao.addEventListener("submit", handleSolicitarCorrecao);
  }

  // Botões principais
  const btnNovaVaga = document.getElementById("btn-nova-vaga");
  if (btnNovaVaga) {
    btnNovaVaga.addEventListener("click", () => {
      limparFormularioVaga();
      document.getElementById("ficha-title").textContent = "Nova Vaga";
      vagaAtualId = null;
      abrirModal(ID_MODAL_FICHA_TECNICA);
    });
  }

  const btnEnviarAprovacaoArte = document.getElementById(
    "btn-enviar-aprovacao-arte"
  );
  if (btnEnviarAprovacaoArte) {
    btnEnviarAprovacaoArte.addEventListener("click", handleEnviarAprovacaoArte);
  }

  const btnAprovarArteFinal = document.getElementById("btn-aprovar-arte-final");
  if (btnAprovarArteFinal) {
    btnAprovarArteFinal.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-arte-aprovacao").value;
      await aprovarArte(vagaId);
    });
  }

  const btnSolicitarAlteracoesArte = document.getElementById(
    "btn-solicitar-alteracoes-arte"
  );
  if (btnSolicitarAlteracoesArte) {
    btnSolicitarAlteracoesArte.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-arte-aprovacao").value;
      fecharModal(ID_MODAL_APROVACAO_ARTE);
      await solicitarCorrecaoArte(vagaId);
    });
  }

  const btnSalvarDivulgacao = document.getElementById("btn-salvar-divulgacao");
  if (btnSalvarDivulgacao) {
    btnSalvarDivulgacao.addEventListener("click", async () => {
      const form = document.getElementById("form-divulgacao");
      if (form) {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });
  }

  const btnEncerrarVaga = document.getElementById("btn-encerrar-vaga");
  if (btnEncerrarVaga) {
    btnEncerrarVaga.addEventListener("click", handleEncerrarVaga);
  }

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
  }

  const btnReaproveitarVaga = document.getElementById("btn-reaproveitar-vaga");
  if (btnReaproveitarVaga) {
    btnReaproveitarVaga.addEventListener("click", async () => {
      const vagaId = document.getElementById("vaga-id-fechadas").value;
      await reaproveitarVaga(vagaId);
    });
  }

  // Carrega vagas iniciais
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

  console.log("✅ Módulo de Gestão de Vagas inicializado com sucesso!");
  console.log(`   - Usuário: ${currentUserData?.nome || "Desconhecido"}`);
  console.log(`   - Role: ${currentUserData?.role || "N/A"}`);
  console.log(`   - Aba ativa: ${statusAbaAtiva}`);
}

// Exportação para compatibilidade
export { initGestaoVagas as init };
