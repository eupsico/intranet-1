// modulos/rh/js/tabs/tabEntrevistas.js

import { getGlobalState } from "../recrutamento.js";
// CORREÇÃO: Caminho do firebase-init ajustado para 4 níveis (../../../../)
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "../../../../assets/js/firebase-init.js"; // Adicionado doc e updateDoc para submissão
import {
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// Elementos do DOM dos NOVOS Modais
const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
const btnRegistrarAgendamento = document.getElementById(
  "btn-registrar-agendamento-rh"
);

const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
const btnRegistrarAvaliacao = document.getElementById(
  "btn-registrar-entrevista-rh" // Mantido ID original no HTML para Avaliação (Registrar Decisão)
);
let dadosCandidatoAtual = null; // Para armazenar dados do candidato atual (dadosCandidatoEntrevista renomeado)

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações (Layout de Cartão).
 */
export async function renderizarEntrevistas(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos em Entrevistas/Avaliações...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Triagem Aprovada (Entrevista Pendente)",
        "Entrevista RH Aprovada (Testes Pendente)",
        "Testes Pendente",
      ])
    );
    const snapshot = await getDocs(q); // Atualiza contagem na aba

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="entrevistas"]'
    );
    if (tab) tab.textContent = `3. Entrevistas e Avaliações (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidato na fase de Entrevistas/Avaliações.</p>';
      return;
    }

    let listaHtml = `
 <div class="list-candidaturas">
  <h3>Candidaturas em Entrevistas e Testes (${snapshot.size})</h3>
 `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "info";
      if (statusAtual.includes("Aprovada")) {
        corStatus = "success";
      } else if (statusAtual.includes("Testes")) {
        corStatus = "warning";
      } // Formatação de contato e WhatsApp, idêntica à Triagem

      const telefone = cand.telefone_contato
        ? cand.telefone_contato.replace(/\D/g, "")
        : "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}`
        : "#";

      listaHtml += `
<div class="card card-candidato-triagem" data-id="${candidatoId}">
 <div class="info-primaria">
 <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
 <p>Status: <span class="badge bg-${corStatus}">${statusAtual.replace(
        "_",
        " "
      )}</span></p>
 </div>
 
 <div class="info-contato">
 <a href="${linkWhatsApp}" target="_blank" class="whatsapp" ${
        !telefone ? "disabled" : ""
      }>
  <i class="fab fa-whatsapp me-1"></i> ${
    cand.telefone_contato || "N/A (Sem WhatsApp)"
  }
 </a>
 </div>
 
 <div class="acoes-candidato">
 <button 
  class="action-button info btn-detalhes-entrevista" 
  data-id="${candidatoId}"
  data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
  <i class="fas fa-info-circle me-1"></i> Detalhes
 </button>
 
 `;
      // NOVO: Lógica de exibição dos botões separados

      if (statusAtual.includes("Entrevista Pendente")) {
        listaHtml += `
  <button 
    data-etapa="${statusAtual}"
    class="action-button secondary btn-agendar-rh" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-calendar-alt me-1"></i> Agendar RH
  </button>
  <button 
    data-etapa="${statusAtual}"
    class="action-button primary btn-avaliar-rh" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-edit me-1"></i> Avaliar RH
  </button>
 `;
      } else if (statusAtual.includes("Testes Pendente")) {
        listaHtml += `
  <button 
    data-etapa="${statusAtual}"
    class="action-button primary btn-avaliar-rh" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-vial me-1"></i> Avaliar Testes
  </button>
 `;
      } else {
        listaHtml += `
  <button 
    class="action-button primary btn-avaliar-rh" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-eye me-1"></i> Ver Avaliação
  </button>
 `;
      }
      listaHtml += `
 </div>
</div>
`;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml; // Configura evento para abrir modal de detalhes (modalCandidato)
    document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(candidatoId, "detalhes", dados);
      });
    }); // NOVO: Configura evento para abrir o modal de Agendamento RH
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAgendamentoRH(candidatoId, dados);
      });
    }); // NOVO: Configura evento para abrir o modal de Avaliação RH
    document.querySelectorAll(".btn-avaliar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );

        window.abrirModalAvaliacaoRH(candidatoId, dados);
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar entrevistas:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
  }
}

/**
 * Abre o modal de AGENDAMENTO da Entrevista RH.
 * EXPOSTA GLOBALMENTE.
 */
window.abrirModalAgendamentoRH = function (candidatoId, dadosCandidato) {
  if (!modalAgendamentoRH) return;

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.motivo_rejeicao ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A"; // Pré-preencher agendamento se já houver
  const dataAgendada = dadosCandidato.entrevista_rh?.agendamento?.data || "";
  const horaAgendada = dadosCandidato.entrevista_rh?.agendamento?.hora || "";

  const nomeEl = document.getElementById("agendamento-rh-nome-candidato");
  const statusEl = document.getElementById("agendamento-rh-status-atual");
  const resumoEl = document.getElementById("agendamento-rh-resumo-triagem");
  const dataEl = document.getElementById("data-entrevista-agendada");
  const horaEl = document.getElementById("hora-entrevista-agendada");

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;
  if (dataEl) dataEl.value = dataAgendada;
  if (horaEl) horaEl.value = horaAgendada;

  modalAgendamentoRH.classList.add("is-visible");
};

/**
 * Abre o modal de AVALIAÇÃO da Entrevista RH. (Adaptado da função original)
 * EXPOSTA GLOBALMENTE.
 */
window.abrirModalAvaliacaoRH = function (candidatoId, dadosCandidato) {
  if (!modalAvaliacaoRH) return;

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId; // 1. Preencher a Ficha e Notas Rápidas

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)"; // Tenta obter o motivo de reprovação (novo) ou o comentário geral (antigo)
  const resumoTriagem =
    dadosCandidato.triagem_rh?.motivo_rejeicao ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const linkCurriculo = dadosCandidato.link_curriculo_drive || "#";

  const nomeEl = document.getElementById("entrevista-rh-nome-candidato");
  const statusEl = document.getElementById("entrevista-rh-status-atual");
  const resumoEl = document.getElementById("entrevista-rh-resumo-triagem");
  const btnVerCurriculo = document.getElementById(
    "entrevista-rh-ver-curriculo"
  );

  if (nomeEl) nomeEl.textContent = nomeCompleto;
  if (statusEl) statusEl.textContent = statusAtual;
  if (resumoEl) resumoEl.textContent = resumoTriagem;

  if (btnVerCurriculo) {
    btnVerCurriculo.href = linkCurriculo;
    btnVerCurriculo.disabled = !linkCurriculo || linkCurriculo === "#";
  } // 2. Limpar/Resetar Formulário

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (form) form.reset(); // 3. Preencher dados de avaliação se já existirem
  const avaliacaoExistente = dadosCandidato.entrevista_rh;
  if (avaliacaoExistente) {
    form.querySelector("#nota-motivacao").value =
      avaliacaoExistente.notas?.motivacao || "";
    form.querySelector("#nota-aderencia").value =
      avaliacaoExistente.notas?.aderencia || "";
    form.querySelector("#nota-comunicacao").value =
      avaliacaoExistente.notas?.comunicacao || "";
    form.querySelector("#pontos-fortes").value =
      avaliacaoExistente.pontos_fortes || "";
    form.querySelector("#pontos-atencao").value =
      avaliacaoExistente.pontos_atencao || "";
    if (avaliacaoExistente.resultado) {
      const radio = form.querySelector(
        `input[name="resultado_entrevista"][value="${avaliacaoExistente.resultado}"]`
      );
      if (radio) radio.checked = true;
    }
  } // 4. Exibir o Modal

  modalAvaliacaoRH.classList.add("is-visible");
};

/**
 * Lógica de Submissão para salvar o AGENDAMENTO da Entrevista RH. (Novo)
 */
async function submeterAgendamentoRH(e) {
  e.preventDefault();

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAgendamentoRH?.dataset.candidaturaId;

  if (!candidaturaId) return;

  // 1. Coleta de Dados do Formulário (Apenas agendamento)
  const form = document.getElementById("form-agendamento-entrevista-rh");
  const dataEntrevista = form.querySelector("#data-entrevista-agendada").value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada").value;

  if (!dataEntrevista || !horaEntrevista) {
    window.showToast(
      "Por favor, preencha a data e hora da entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAgendamento.disabled = true;
  btnRegistrarAgendamento.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  // Manter o status atual, pois apenas o agendamento está sendo feito
  const statusAtual =
    dadosCandidatoAtual.status_recrutamento ||
    "Triagem Aprovada (Entrevista Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    // Update para o Firestore: Adiciona ou sobrescreve apenas a parte de agendamento dentro de entrevista_rh
    const updateData = {
      "entrevista_rh.agendamento.data": dataEntrevista,
      "entrevista_rh.agendamento.hora": horaEntrevista,
      historico: arrayUnion({
        data: serverTimestamp(),
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}. Status: ${statusAtual}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    };

    await updateDoc(candidaturaRef, updateData);

    window.showToast(
      `Entrevista RH agendada com sucesso para ${dataEntrevista} às ${horaEntrevista}.`,
      "success"
    );

    // Opcional: Envio de Mensagem de WhatsApp (apenas agendamento)
    if (dadosCandidatoAtual.telefone_contato) {
      const mensagem = encodeURIComponent(
        `Olá ${
          dadosCandidatoAtual.nome_completo || "candidato(a)"
        }! Sua entrevista com RH foi AGENDADA para o dia ${dataEntrevista} às ${horaEntrevista}. Por favor, confirme sua presença.`
      );
      const telefoneLimpo = dadosCandidatoAtual.telefone_contato.replace(
        /\D/g,
        ""
      );
      const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagem}`;
      window.open(linkWhatsApp, "_blank");
    }

    // Fecha o modal e recarrega a aba atual
    modalAgendamentoRH.classList.remove("is-visible");
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("Erro ao salvar agendamento de Entrevista RH:", error);
    window.showToast(
      `Erro ao registrar o agendamento: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAgendamento.disabled = false;
    btnRegistrarAgendamento.innerHTML =
      '<i class="fas fa-calendar-alt me-2"></i> Agendar Entrevista';
  }
}

/**
 * Lógica de Submissão para salvar a AVALIAÇÃO da Entrevista RH. (Antiga submeterAvaliacaoEntrevistaRH, adaptada)
 */
async function submeterAvaliacaoRH(e) {
  e.preventDefault();

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAvaliacaoRH?.dataset.candidaturaId;

  if (!candidaturaId) return;

  // 1. Coleta de Dados do Formulário
  const form = document.getElementById("form-avaliacao-entrevista-rh");

  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;

  // Os campos de agendamento foram removidos desta função.

  if (!resultado) {
    window.showToast(
      "Por favor, selecione o Resultado da Entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAvaliacao.disabled = true;
  btnRegistrarAvaliacao.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...'; // 2. Determinar Status e Próxima Etapa

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado
    ? "Entrevista RH Aprovada (Testes Pendente)"
    : "Rejeitado (Comunicação Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  // Dados da avaliação
  const dadosAvaliacao = {
    data_avaliacao: serverTimestamp(),
    avaliador_uid: currentUserData.id || "rh_system_user",
    resultado: resultado,
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontos_fortes: pontosFortes,
    pontos_atencao: pontosAtencao,
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    // Update para o Firestore
    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: {
        ...(dadosCandidatoAtual.entrevista_rh || {}), // Manter agendamento e outros dados anteriores se houver
        ...dadosAvaliacao,
      },
      historico: arrayUnion({
        data: serverTimestamp(),
        acao: `Avaliação Entrevista RH: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast(
      `Avaliação de Entrevista RH registrada. Status: ${novoStatusCandidato}`,
      "success"
    );

    // Fecha o modal e recarrega a aba atual
    modalAvaliacaoRH.classList.remove("is-visible");
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("Erro ao salvar avaliação de Entrevista RH:", error);
    window.showToast(`Erro ao registrar a decisão: ${error.message}`, "error");
  } finally {
    btnRegistrarAvaliacao.disabled = false;
    btnRegistrarAvaliacao.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Avaliação';
  }
}

// Listener para o formulário de Agendamento
if (modalAgendamentoRH) {
  document
    .getElementById("form-agendamento-entrevista-rh")
    ?.addEventListener("submit", submeterAgendamentoRH);

  // Fechamento do Modal (X no cabeçalho e botão 'Cancelar')
  document
    .querySelectorAll("[data-modal-id='modal-agendamento-rh']")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        modalAgendamentoRH.classList.remove("is-visible")
      );
    });
}

// Listener para o formulário de Avaliação
if (modalAvaliacaoRH) {
  // 1. Botão 'Registrar Decisão' (usando submit do form)
  document
    .getElementById("form-avaliacao-entrevista-rh")
    ?.addEventListener("submit", submeterAvaliacaoRH);

  // 2. Fechamento do Modal (X no cabeçalho e botão 'Voltar ao Painel')
  document
    .querySelectorAll("[data-modal-id='modal-avaliacao-rh']")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        modalAvaliacaoRH.classList.remove("is-visible")
      );
    });

  // Listener para o botão 'Voltar ao Painel' no footer
  const btnVoltarPainel = modalAvaliacaoRH.querySelector(
    "#btn-voltar-painel-rh"
  );
  if (btnVoltarPainel) {
    btnVoltarPainel.addEventListener("click", () =>
      modalAvaliacaoRH.classList.remove("is-visible")
    );
  }
}
