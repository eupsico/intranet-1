/**
 * Arquivo: modulos/rh/js/tabs/tabTriagem.js
 * Versão: 3.1.0 (Corrigido: Timestamps, Validações e CSS dos Cards)
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

// Elementos do Modal de Triagem
const modalAvaliacaoTriagem = document.getElementById(
  "modal-avaliacao-triagem"
);
const btnFinalizarTriagem = document.getElementById(
  "btn-finalizar-triagem-modal"
);

let dadosCandidatoAtual = null;

// Checklist estático
const CHECKLIST_TRIAGEM = [
  {
    id: "check-pre-req",
    label:
      "Candidato atende aos pré-requisitos básicos (Formação/Conselho/Exp. Mínima).",
  },
  {
    id: "check-link-curriculo",
    label: "Link do currículo (Drive/PDF) está acessível e válido.",
  },
  {
    id: "check-salario-compativel",
    label:
      "Expectativa salarial (se informada) está compatível com a faixa da vaga.",
  },
  {
    id: "check-fit-cultural",
    label: "Perfil aparente (resumo/habilidades) possui bom fit cultural.",
  },
];

// ✅ FUNÇÃO GLOBAL: Toggle do Motivo de Aprovação/Rejeição
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
    containerRejeicao.style.display = "block";
    containerAprovacao.style.display = "none";
    if (motivoRejeicaoEl) {
      motivoRejeicaoEl.required = true;
    }
  } else if (radioSim && radioSim.checked) {
    // Mostrar campo de aprovação
    containerRejeicao.style.display = "none";
    containerAprovacao.style.display = "block";
    if (motivoRejeicaoEl) {
      motivoRejeicaoEl.required = false;
    }
  } else {
    // Ocultar ambos
    containerRejeicao.style.display = "none";
    containerAprovacao.style.display = "none";
  }
};

/**
 * Renderiza o checklist com os valores salvos
 */
function renderizarChecklistTriagem(savedChecks = {}) {
  const container = document.getElementById("checklist-triagem-container");
  if (!container) return;

  container.innerHTML = CHECKLIST_TRIAGEM.map((item) => {
    const isChecked = savedChecks[item.id] === true ? "checked" : "";
    return `
      <div class="form-check checklist-item">
        <input 
          class="form-check-input" 
          type="checkbox" 
          value="1" 
          id="${item.id}" 
          data-check-id="${item.id}"
          ${isChecked}
        />
        <label class="form-check-label" for="${item.id}">
          ${item.label}
        </label>
      </div>
    `;
  }).join("");

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
      "triagem_rh.checklist": currentChecks,
    });

    if (dadosCandidatoAtual?.triagem_rh) {
      dadosCandidatoAtual.triagem_rh.checklist = currentChecks;
    }
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

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";

  // ✅ Atualiza o SPAN dentro do P
  const candidatoNomeEl = document.getElementById("candidato-modal-nome");
  if (candidatoNomeEl) candidatoNomeEl.textContent = nomeCompleto;

  document.getElementById(
    "avaliacao-modal-title"
  ).textContent = `Avaliação de Currículo - ${nomeCompleto}`;
  document.getElementById("modal-dado-email").textContent =
    dadosCandidato.email_candidato || "Não informado";
  document.getElementById("modal-dado-telefone").textContent =
    dadosCandidato.telefone_contato || "Não informado";
  document.getElementById("modal-dado-cidade-estado").textContent = `${
    dadosCandidato.cidade || "N/I"
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
  const triagemAnterior = dadosCandidato.triagem_rh || {};
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

  // ✅ Força atualização da UI
  window.toggleMotivoAprovacaoRejeicao();

  modalAvaliacaoTriagem.classList.add("is-visible");
};

/**
 * Submete a avaliação de triagem
 */
async function submeterAvaliacaoTriagem(e) {
  e.preventDefault();

  const { candidatosCollection, currentUserData, statusCandidaturaTabs } =
    getGlobalState();
  const candidaturaId = modalAvaliacaoTriagem?.dataset.candidaturaId;
  if (!candidaturaId) return;

  const aptoEntrevista = document.querySelector(
    'input[name="modal-apto-entrevista"]:checked'
  )?.value;
  const decisao = aptoEntrevista === "Sim";

  const prerequisitosEl = document.getElementById(
    "modal-prerequisitos-atendidos"
  );
  const motivoRejeicaoEl = document.getElementById("modal-motivo-rejeicao");
  const infoAprovacaoEl = document.getElementById("modal-info-aprovacao");

  // ✅ Validação: Motivo de Rejeição é obrigatório
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
    ? "Triagem Aprovada (Entrevista Pendente)"
    : "Triagem Reprovada (Encerrada)";

  const abaRecarregar = decisao ? "entrevistas" : "finalizados";

  const dadosAvaliacao = {
    prerequisitos_atendidos: prerequisitosEl?.value || "",
    motivo_rejeicao: decisao ? "" : motivoRejeicaoEl?.value.trim() || "",
    apto_entrevista: aptoEntrevista,
    info_aprovacao: decisao ? infoAprovacaoEl?.value.trim() || "" : "",
    data_avaliacao: new Date().toISOString(), // ✅ CORRIGIDO: Use string ISO em vez de serverTimestamp()
    avaliador_uid: currentUserData.id || "rh_system_user",
    checklist: dadosCandidatoAtual?.triagem_rh?.checklist || {},
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      triagem_rh: dadosAvaliacao,
      historico: arrayUnion({
        data: new Date().toISOString(),
        acao: `Triagem ${
          decisao ? "APROVADA" : "REPROVADA"
        }. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
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
      where(
        "status_recrutamento",
        "==",
        "Candidatura Recebida (Triagem Pendente)"
      )
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

    let listaHtml = '<div class="list-candidaturas-triagem">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;

      const statusTriagem = cand.status_recrutamento || "Aguardando Triagem";
      let corStatus = "secondary";
      if (statusTriagem.includes("Aprovada")) corStatus = "success";
      else if (statusTriagem.includes("Reprovada")) corStatus = "danger";
      else if (statusTriagem.includes("Recebida")) corStatus = "info";

      const telefone = cand.telefone_contato?.replace(/\D/g, "") || "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}&text=Olá`
        : "#";

      const jsonCand = JSON.stringify(cand).replace(/'/g, "&#39;");

      listaHtml += `
        <div class="card card-candidato-triagem">
          <div class="card-header">
            <h5 class="card-title">${
              cand.nome_completo || "Candidato Sem Nome"
            }</h5>
            <span class="badge bg-${corStatus}">${statusTriagem.replace(
        /_/g,
        " "
      )}</span>
          </div>
          
          <div class="card-body">
            <p class="card-text">
              <strong>Email:</strong> ${cand.email_candidato || "N/A"}
            </p>
            <p class="card-text">
              <strong>Telefone:</strong> 
              <a href="${linkWhatsApp}" target="_blank" class="text-success ${
        !telefone ? "disabled" : ""
      }">
                <i class="fab fa-whatsapp me-1"></i> ${
                  cand.telefone_contato || "N/A"
                }
              </a>
            </p>
            <p class="card-text text-muted small">
              ${cand.resumo_experiencia || "Sem informações de experiência"}
            </p>
          </div>
          
          <div class="card-footer">
            <button 
              class="btn btn-sm btn-info btn-detalhes-triagem" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-info-circle me-1"></i> Detalhes
            </button>
            <button 
              class="btn btn-sm btn-warning btn-avaliar-triagem" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-edit me-1"></i> Avaliar
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // ✅ Listeners dinâmicos para Detalhes
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

    // ✅ Listeners dinâmicos para Avaliar
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

// ✅ Inicialização de Listeners
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
