/**
 * Arquivo: modulos/rh/js/tabs/tabTriagem.js
 * Versão: 3.5.0 (CORREÇÃO DE IMPORT E AUTH USER)
 */

import { getGlobalState } from "../recrutamento.js";
import {
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// ✅ CORREÇÃO 1: Caminho correto do import (estava ./helpers.js)
import {
  getCurrentUserName,
  formatarDataEnvio,
} from "./entrevistas/helpers.js";

// Elementos do Modal de Triagem
const modalAvaliacaoTriagem = document.getElementById(
  "modal-avaliacao-triagem"
);
const btnFinalizarTriagem = document.getElementById(
  "btn-finalizar-triagem-modal"
);

let dadosCandidatoAtual = null;

// ✅ Checklist Aprimorado com HTML para melhor visualização
const CHECKLIST_TRIAGEM = [
  {
    id: "check-pre-req",
    label:
      "✅ <strong>Requisitos Obrigatórios:</strong> Possui formação, registro no conselho e tempo de experiência exigidos?",
  },
  {
    id: "check-link-curriculo",
    label:
      "📄 <strong>Currículo:</strong> O arquivo/link está acessível, atualizado e bem formatado?",
  },
  {
    id: "check-salario-compativel",
    label:
      "💰 <strong>Expectativa Salarial:</strong> Está dentro da faixa orçamentária da vaga (se informada)?",
  },
  {
    id: "check-fit-cultural",
    label:
      "🤝 <strong>Fit Cultural:</strong> O perfil demonstra alinhamento com a missão e valores da EuPsico?",
  },
];

// =================================================================
// ✅ FUNÇÃO GLOBAL ATUALIZADA: Usa .classList e .hidden
// =================================================================
window.toggleMotivoAprovacaoRejeicao = function () {
  const radioSim = document.getElementById("modal-apto-sim");
  const radioNao = document.getElementById("modal-apto-nao");
  const containerRejeicao = document.getElementById(
    "modal-motivo-rejeicao-container"
  );
  const containerAprovacao = document.getElementById(
    "modal-info-aprovacao-container"
  );
  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");

  if (!containerRejeicao || !containerAprovacao) return;

  if (radioNao && radioNao.checked) {
    // Mostrar campo de reprovação
    containerRejeicao.classList.remove("hidden");
    containerAprovacao.classList.add("hidden");
    if (motivoRejeicaoEl) {
      motivoRejeicaoEl.required = true;
    }
  } else if (radioSim && radioSim.checked) {
    // Mostrar campo de aprovação
    containerRejeicao.classList.add("hidden");
    containerAprovacao.classList.remove("hidden");
    if (motivoRejeicaoEl) {
      motivoRejeicaoEl.required = false;
    }
  } else {
    // Ocultar ambos
    containerRejeicao.classList.add("hidden");
    containerAprovacao.classList.add("hidden");
  }
};

/**
 * Renderiza o checklist com os valores salvos e anexa o auto-save
 */
function renderizarChecklistTriagem(savedChecks = {}) {
  const container = document.getElementById("checklist-triagem-container");
  if (!container) return;

  // HTML do checklist usa .form-check e permite HTML na label
  container.innerHTML = CHECKLIST_TRIAGEM.map((item) => {
    const isChecked = savedChecks[item.id] === true ? "checked" : "";
    return `
      <div class="form-check checklist-item" style="margin-bottom: 8px;">
        <input 
          class="form-check-input" 
          type="checkbox" 
          value="1" 
          id="${item.id}" 
          data-check-id="${item.id}"
          ${isChecked}
        />
        <label class="form-check-label" for="${item.id}" style="cursor: pointer;">
          ${item.label}
        </label>
      </div>
    `;
  }).join("");

  // ✅ Anexa o listener de mudança para salvamento automático
  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.removeEventListener("change", handleSalvarChecklist);
    checkbox.addEventListener("change", handleSalvarChecklist);
  });
}

/**
 * Salva o estado do checklist no Firebase (salvamento automático)
 */
async function handleSalvarChecklist(e) {
  const { candidatosCollection } = getGlobalState();
  const candidaturaId = modalAvaliacaoTriagem?.dataset.candidaturaId;
  if (!candidaturaId) return;

  const checklistContainer = document.getElementById(
    "checklist-triagem-container"
  );
  const currentChecks = {};

  checklistContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      currentChecks[checkbox.id] = checkbox.checked;
    });

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);
    await updateDoc(candidaturaRef, {
      "triagem_curriculo.checklist": currentChecks,
    });

    if (dadosCandidatoAtual?.triagem_curriculo) {
      dadosCandidatoAtual.triagem_curriculo.checklist = currentChecks;
    }

    console.log("✅ Checklist de triagem salvo automaticamente.");
  } catch (error) {
    console.error("Erro ao salvar checklist:", error);
    window.showToast?.("Erro ao salvar o checklist automaticamente.", "error");
  }
}

/**
 * Abre o modal de avaliação de triagem
 */
window.abrirModalAvaliacaoTriagem = function (candidatoId, dadosCandidato) {
  if (!modalAvaliacaoTriagem) return;

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoTriagem.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_candidato || "Candidato(a)";

  const candidatoNomeEl = document.getElementById("candidato-modal-nome");
  if (candidatoNomeEl) candidatoNomeEl.textContent = nomeCompleto;

  document.getElementById(
    "avaliacao-modal-title"
  ).textContent = `Avaliação de Currículo - ${nomeCompleto}`;
  document.getElementById("modal-dado-email").textContent =
    dadosCandidato.email_candidato || "Não informado";
  document.getElementById("modal-dado-telefone").textContent =
    dadosCandidato.telefone_candidato || "Não informado";
  document.getElementById("modal-dado-cidade-estado").textContent = `${
    dadosCandidato.cidade_candidato || "N/I"
  } / ${dadosCandidato.estado || "UF"}`;
  document.getElementById("modal-dado-como-conheceu").textContent =
    dadosCandidato.como_conheceu || "Não informado";

  const resumoEl = document.getElementById("modal-dado-resumo-experiencia");
  if (resumoEl)
    resumoEl.textContent =
      dadosCandidato.resumo_experiencia || "Não preenchido no formulário.";

  const habilidadesEl = document.getElementById("modal-dado-habilidades");
  if (habilidadesEl)
    habilidadesEl.textContent =
      dadosCandidato.habilidades_competencias ||
      "Não preenchidas no formulário.";

  // Popula dados de avaliação anterior
  const triagemAnterior = dadosCandidato.triagem_curriculo || {};
  renderizarChecklistTriagem(triagemAnterior.checklist || {});

  const prerequisitosEl = document.getElementById(
    "modal-prerequisitos-atendidos"
  );
  if (prerequisitosEl)
    prerequisitosEl.value = triagemAnterior.prerequisitos_atendidos || "";

  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");
  if (motivoRejeicaoEl)
    motivoRejeicaoEl.value = triagemAnterior.motivo_rejeicao || "";

  const infoAprovacaoEl = document.getElementById("modal-info-aprovacao");
  if (infoAprovacaoEl)
    infoAprovacaoEl.value = triagemAnterior.info_aprovacao || "";

  // Configura rádios
  const radioSim = document.getElementById("modal-apto-sim");
  const radioNao = document.getElementById("modal-apto-nao");

  if (radioSim) radioSim.checked = triagemAnterior.apto_entrevista === "Sim";
  if (radioNao) radioNao.checked = triagemAnterior.apto_entrevista === "Não";

  // Atualiza botão de currículo
  const btnVerCurriculo = document.getElementById("btn-ver-curriculo-triagem");
  if (btnVerCurriculo) {
    btnVerCurriculo.dataset.curriculoLink =
      dadosCandidato.link_curriculo_drive || "";
    btnVerCurriculo.disabled = !dadosCandidato.link_curriculo_drive;
  }

  // Força atualização da UI dos campos de aprovação/reprovação
  window.toggleMotivoAprovacaoRejeicao();

  modalAvaliacaoTriagem.classList.add("is-visible");
};

/**
 * Submete a avaliação de triagem
 */
async function submeterAvaliacaoTriagem(e) {
  e.preventDefault();

  const { candidatosCollection, statusCandidaturaTabs } = getGlobalState();
  const candidaturaId = modalAvaliacaoTriagem?.dataset.candidaturaId;
  if (!candidaturaId) return;

  // ✅ CORREÇÃO 2: Pega o nome do usuário AGORA, garantindo que o Auth está pronto
  const usuarioNome = await getCurrentUserName();

  const aptoEntrevista = document.querySelector(
    'input[name="modal-apto-entrevista"]:checked'
  )?.value;
  const decisao = aptoEntrevista === "Sim";

  const prerequisitosEl = document.getElementById(
    "modal-prerequisitos-atendidos"
  );
  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");
  const infoAprovacaoEl = document.getElementById("modal-info-aprovacao");

  // Validação: Motivo de Rejeição é obrigatório
  if (!decisao && !motivoRejeicaoEl?.value.trim()) {
    window.showToast?.(
      "Por favor, preencha o motivo detalhado da reprovação.",
      "warning"
    );
    return;
  }

  btnFinalizarTriagem.disabled = true;
  btnFinalizarTriagem.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const novoStatusCandidato = decisao
    ? "ENTREVISTA_RH_PENDENTE" // Próxima etapa
    : "REPROVADO_TRIAGEM"; // Finalizado

  const abaRecarregar = decisao ? "entrevistas" : "finalizados";

  const dadosAvaliacao = {
    prerequisitos_atendidos: prerequisitosEl?.value || "",
    motivo_rejeicao: decisao ? "" : motivoRejeicaoEl?.value.trim() || "",
    apto_entrevista: aptoEntrevista,
    info_aprovacao: decisao ? infoAprovacaoEl?.value.trim() || "" : "",
    data_avaliacao: new Date().toISOString(),
    avaliador_uid: usuarioNome,
    checklist: dadosCandidatoAtual?.triagem_curriculo?.checklist || {},
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      triagem_curriculo: dadosAvaliacao,
      historico: arrayUnion({
        data: new Date(),
        acao: `Triagem ${
          decisao ? "APROVADA" : "REPROVADA"
        }. Status: ${novoStatusCandidato}`,
        usuario: usuarioNome, // ✅ Agora salva o nome correto
      }),
    });

    window.showToast?.("Decisão da Triagem registrada com sucesso!", "success");
    modalAvaliacaoTriagem.classList.remove("is-visible");

    // Recarrega a listagem
    renderizarTriagem(getGlobalState());

    // Muda de aba se necessário
    const currentActiveTab = statusCandidaturaTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");

    if (currentActiveTab !== abaRecarregar) {
      const targetTab = statusCandidaturaTabs.querySelector(
        `[data-status="${abaRecarregar}"]`
      );
      if (targetTab) {
        const handleTabClick = getGlobalState().handleTabClick;
        if (handleTabClick) handleTabClick({ currentTarget: targetTab });
      }
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação de triagem:", error);
    window.showToast?.(
      `Erro ao registrar a decisão: ${error.message}`,
      "error"
    );
  } finally {
    btnFinalizarTriagem.disabled = false;
    btnFinalizarTriagem.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  }
}

/**
 * Renderiza a listagem de candidatos para triagem
 */
export async function renderizarTriagem(state) {
  const { vagaSelecionadaId, conteudoRecrutamento, candidatosCollection } =
    state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidaturas para Triagem...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "TRIAGEM_PENDENTE")
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const triagemTab = document
      .getElementById("status-candidatura-tabs")
      ?.querySelector('.tab-link[data-status="triagem"]');
    if (triagemTab) {
      triagemTab.textContent = `2. Avaliação de Currículo (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidatura para triagem ou todas já foram processadas.</p>';
      return;
    }

    let listaHtml = '<div class="candidatos-container modules-grid">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;

      const statusTriagem = cand.status_recrutamento || "TRIAGEM_PENDENTE";

      let statusClass = "status-pendente";
      if (
        statusTriagem.toLowerCase().includes("pendente") ||
        statusTriagem.toLowerCase().includes("recebida")
      ) {
        statusClass = "status-pendente";
      } else if (statusTriagem.toLowerCase().includes("aprovada")) {
        statusClass = "status-concluída";
      } else if (statusTriagem.toLowerCase().includes("reprovada")) {
        statusClass = "status-rejeitada";
      }

      const telefone = cand.telefone_candidato?.replace(/\D/g, "") || "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}&text=Olá`
        : "#";

      const jsonCand = JSON.stringify(cand).replace(/'/g, "&#39;");

      listaHtml += `
  <div class="module-card" data-id="${candidatoId}">
    
    <div class="card-icon">
      <div>
        <h3>
          ${cand.nome_candidato || "Candidato Sem Nome"}
        </h3>
        <p class="text-muted" style="font-size: 0.9rem;">
          <i class="fas fa-briefcase me-2"></i> Etapa: Avaliação de Currículo
        </p>
      </div>
      <span class="status-badge ${statusClass}">
        ${statusTriagem.replace(/_/g, " ")}
      </span>
    </div>

    <div class="card-content">
      <a href="mailto:${cand.email_candidato || ""}" 
         class="contact-link ${!cand.email_candidato ? "disabled" : ""}">
        <i class="fas fa-envelope"></i> 
        ${cand.email_candidato || "Email não informado"}
      </a>

      <a href="${linkWhatsApp}" target="_blank" 
         class="contact-link ${!telefone ? "disabled" : ""}">
        <i class="fab fa-whatsapp"></i> 
        ${cand.telefone_candidato || "WhatsApp não informado"}
      </a>

      <a href="${cand.portfolio_url_candidato || ""}" target="_blank" 
         class="contact-link ${
           !cand.portfolio_url_candidato ? "disabled" : ""
         }">
        <i class="fab fa-instagram"></i> 
        ${cand.portfolio_url_candidato || "Instagram não informado"}
      </a>

      <a href="${cand.linkedin_url_candidato || ""}" target="_blank" 
         class="contact-link ${!cand.linkedin_url_candidato ? "disabled" : ""}">
        <i class="fab fa-linkedin"></i> 
        ${cand.linkedin_url_candidato || "LinkedIn não informado"}
      </a>

      <p><strong>PCD:</strong> ${cand.pcd_candidato || "Não informado"}</p>
      <p><strong>Formação:</strong> ${
        cand.area_formacao_candidato || "Não informado"
      }</p>
      <p><strong>Experiência:</strong> ${
        cand.resumo_experiencia || "Não informado"
      }</p>
    </div>

    <div class="modal-footer">
      <button 
        class="action-button secondary btn-detalhes-triagem" 
        data-id="${candidatoId}"
        data-candidato-data='${jsonCand}'>
        <i class="fas fa-eye me-2"></i> Detalhes
      </button>
      <button 
        class="action-button warning btn-avaliar-triagem" 
        data-id="${candidatoId}"
        data-candidato-data='${jsonCand}'>
        <i class="fas fa-edit me-2"></i> Avaliar Currículo
      </button>
    </div>
    
  </div>
`;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // Listeners dinâmicos para Detalhes
    document.querySelectorAll(".btn-detalhes-triagem").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(candidatoId, "detalhes", dados);
      });
    });

    // Listeners dinâmicos para Avaliar
    document.querySelectorAll(".btn-avaliar-triagem").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoTriagem(candidatoId, dados);
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar triagem:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// =================================================================
// INICIALIZAÇÃO DE LISTENERS
// =================================================================
if (modalAvaliacaoTriagem && btnFinalizarTriagem) {
  btnFinalizarTriagem.addEventListener("click", submeterAvaliacaoTriagem);
}

// Listeners do modal
document
  .querySelectorAll("[data-modal-id='modal-avaliacao-triagem']")
  .forEach((btn) => {
    btn.addEventListener("click", () => {
      modalAvaliacaoTriagem?.classList.remove("is-visible");
    });
  });

// Botão Ver Currículo
const btnVerCurriculo = document.getElementById("btn-ver-curriculo-triagem");
if (btnVerCurriculo) {
  btnVerCurriculo.addEventListener("click", (e) => {
    const link = e.currentTarget.dataset.curriculoLink;
    if (link) {
      window.open(link, "_blank");
    } else {
      window.showToast?.("Link do currículo não disponível.", "warning");
    }
  });
}

// Rádios de decisão
const radioSim = document.getElementById("modal-apto-sim");
const radioNao = document.getElementById("modal-apto-nao");

if (radioSim)
  radioSim.addEventListener("change", window.toggleMotivoAprovacaoRejeicao);
if (radioNao)
  radioNao.addEventListener("change", window.toggleMotivoAprovacaoRejeicao);
