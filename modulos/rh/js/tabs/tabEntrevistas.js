// modulos/rh/js/tabs/tabEntrevistas.js

import { getGlobalState } from "../recrutamento.js";
// CORREÇÃO: Caminho do firebase-init ajustado para 4 níveis (../../../../)
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "../../../../assets/js/firebase-init.js";
import {
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// Elementos do DOM dos NOVOS Modais: REMOVIDOS daqui para serem buscados DENTRO das funções.
let dadosCandidatoAtual = null; // Para armazenar dados do candidato atual

// Funções de Fechamento Simples
function fecharModalAgendamento() {
  console.log("--- DEBUG RH: Fechando modal-agendamento-rh.");
  const modal = document.getElementById("modal-agendamento-rh");
  if (modal) modal.classList.remove("is-visible");
}
function fecharModalAvaliacao() {
  console.log("--- DEBUG RH: Fechando modal-avaliacao-rh.");
  const modal = document.getElementById("modal-avaliacao-rh");
  if (modal) modal.classList.remove("is-visible");
}

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações (Layout de Cartão).
 */
export async function renderizarEntrevistas(state) {
  console.log("--- DEBUG RH: INÍCIO renderizarEntrevistas ---");

  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    console.log("--- DEBUG RH: Vaga não selecionada. ---");
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
      }

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
    conteudoRecrutamento.innerHTML = listaHtml;
    // --- INÍCIO DA ATRIBUIÇÃO DE LISTENERS ---
    console.log("--- DEBUG RH: ANEXANDO LISTENERS AOS BOTÕES ---");

    // Anexar listeners de Detalhes
    document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        console.log(
          `--- DEBUG RH: CLIQUE em Detalhes para ID: ${e.currentTarget.getAttribute(
            "data-id"
          )}`
        );
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(candidatoId, "detalhes", dados);
      });
    }); // NOVO: Configura evento para abrir o modal de Agendamento RH
    const btnsAgendar = document.querySelectorAll(".btn-agendar-rh");
    console.log(
      `--- DEBUG RH: Encontrados ${btnsAgendar.length} botões Agendar RH.`
    );
    btnsAgendar.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        console.log(
          `--- DEBUG RH: CLIQUE em Agendar RH para ID: ${e.currentTarget.getAttribute(
            "data-id"
          )}`
        );
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );
        window.abrirModalAgendamentoRH(candidatoId, dados);
      });
    }); // NOVO: Configura evento para abrir o modal de Avaliação RH
    const btnsAvaliar = document.querySelectorAll(".btn-avaliar-rh");
    console.log(
      `--- DEBUG RH: Encontrados ${btnsAvaliar.length} botões Avaliar RH.`
    );
    btnsAvaliar.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        console.log(
          `--- DEBUG RH: CLIQUE em Avaliar RH para ID: ${e.currentTarget.getAttribute(
            "data-id"
          )}`
        );
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        );

        window.abrirModalAvaliacaoRH(candidatoId, dados);
      });
    });
    console.log("--- DEBUG RH: FIM Anexação de LISTENERS ---");
  } catch (error) {
    console.error("Erro ao renderizar entrevistas:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
  }
  console.log("--- DEBUG RH: FIM renderizarEntrevistas ---");
}

/**
 * Abre o modal de AGENDAMENTO da Entrevista RH.
 * EXPOSTA GLOBALMENTE.
 */
window.abrirModalAgendamentoRH = function (candidatoId, dadosCandidato) {
  console.log(
    `--- DEBUG RH: INÍCIO abrirModalAgendamentoRH para ID: ${candidatoId}`
  );

  // Busca o elemento do modal dinamicamente
  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");

  if (!modalAgendamentoRH || !form) {
    window.showToast(
      "Erro: Modal de Agendamento (modal-agendamento-rh) não encontrado.",
      "error"
    );
    console.error(
      "--- DEBUG RH: ERRO - Elemento modal-agendamento-rh ou form não encontrado."
    );
    return;
  }

  console.log(
    "--- DEBUG RH: SUCESSO - Elementos do Modal Agendamento encontrados."
  );

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.motivo_rejeicao ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
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

  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);
  console.log("--- DEBUG RH: Listener SUBMIT Agendamento anexado.");

  // Anexar listeners de fechar
  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  // ✅ CORREÇÃO: Buscar o .modal-overlay pai e adicionar is-visible nele
  const modalOverlay = modalAgendamentoRH.closest(".modal-overlay");
  if (modalOverlay) {
    modalOverlay.classList.add("is-visible");
    console.log("--- DEBUG RH: Classe is-visible adicionada ao modal-overlay.");
  } else {
    // Fallback: se não houver overlay pai, adiciona direto no modal
    modalAgendamentoRH.classList.add("is-visible");
    console.warn(
      "--- DEBUG RH: modal-overlay não encontrado, usando fallback."
    );
  }

  console.log("--- DEBUG RH: FIM abrirModalAgendamentoRH. Modal Visível.");
};

/**
 * Abre o modal de AVALIAÇÃO da Entrevista RH. (Adaptado da função original)
 * EXPOSTA GLOBALMENTE.
 */
window.abrirModalAvaliacaoRH = function (candidatoId, dadosCandidato) {
  console.log(
    `--- DEBUG RH: INÍCIO abrirModalAvaliacaoRH para ID: ${candidatoId}`
  );

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const form = document.getElementById("form-avaliacao-entrevista-rh");

  if (!modalAvaliacaoRH || !form) {
    window.showToast(
      "Erro: Modal de Avaliação (modal-avaliacao-rh) não encontrado.",
      "error"
    );
    console.error(
      "--- DEBUG RH: ERRO - Elemento modal-avaliacao-rh ou form não encontrado."
    );
    return;
  }

  console.log(
    "--- DEBUG RH: SUCESSO - Elementos do Modal Avaliação encontrados."
  );

  dadosCandidatoAtual = dadosCandidato;
  modalAvaliacaoRH.dataset.candidaturaId = candidatoId;

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)";
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
  }

  if (form) form.reset();

  const avaliacaoExistente = dadosCandidato.entrevista_rh;
  if (avaliacaoExistente) {
    if (form) {
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
    }
  }

  form.removeEventListener("submit", submeterAvaliacaoRH);
  form.addEventListener("submit", submeterAvaliacaoRH);
  console.log("--- DEBUG RH: Listener SUBMIT Avaliação anexado.");

  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAvaliacao);
      btn.addEventListener("click", fecharModalAvaliacao);
    });

  // ✅ CORREÇÃO: Buscar o .modal-overlay pai e adicionar is-visible nele
  const modalOverlay = modalAvaliacaoRH.closest(".modal-overlay");
  if (modalOverlay) {
    modalOverlay.classList.add("is-visible");
    console.log("--- DEBUG RH: Classe is-visible adicionada ao modal-overlay.");
  } else {
    // Fallback: se não houver overlay pai, adiciona direto no modal
    modalAvaliacaoRH.classList.add("is-visible");
    console.warn(
      "--- DEBUG RH: modal-overlay não encontrado, usando fallback."
    );
  }

  console.log("--- DEBUG RH: FIM abrirModalAvaliacaoRH. Modal Visível.");
};

/**
 * Lógica de Submissão para salvar o AGENDAMENTO da Entrevista RH. (Novo)
 */
async function submeterAgendamentoRH(e) {
  e.preventDefault();

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const btnRegistrarAgendamento = document.getElementById(
    "btn-registrar-agendamento-rh"
  );

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAgendamentoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAgendamento) return;

  const form = document.getElementById("form-agendamento-entrevista-rh");
  if (!form) return;

  const dataEntrevista = form.querySelector("#data-entrevista-agendada").value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada").value;

  if (!dataEntrevista || !horaEntrevista) {
    window.showToast(
      "Por favor, preencha a data e hora da entrevista.",
      "error"
    );
    return;
  }

  console.log(
    `--- DEBUG RH: Submetendo Agendamento para ID: ${candidaturaId}. Data: ${dataEntrevista} ${horaEntrevista}`
  );

  btnRegistrarAgendamento.disabled = true;
  btnRegistrarAgendamento.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const statusAtual =
    dadosCandidatoAtual.status_recrutamento ||
    "Triagem Aprovada (Entrevista Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    // ✅ CORREÇÃO: Usar new Date() em vez de serverTimestamp() dentro de arrayUnion
    const updateData = {
      "entrevista_rh.agendamento": {
        data: dataEntrevista,
        hora: horaEntrevista,
      },
      historico: arrayUnion({
        data: new Date(), // ✅ Usa Date() do JavaScript
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}. Status: ${statusAtual}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    };

    await updateDoc(candidaturaRef, updateData);

    window.showToast(
      `Entrevista RH agendada com sucesso para ${dataEntrevista} às ${horaEntrevista}.`,
      "success"
    );
    console.log("--- DEBUG RH: SUCESSO - Agendamento salvo no Firestore.");

    // WhatsApp opcional
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

    fecharModalAgendamento();
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

  const modalAvaliacaoRH = document.getElementById("modal-avaliacao-rh");
  const btnRegistrarAvaliacao = document.getElementById(
    "btn-registrar-entrevista-rh"
  );

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalAvaliacaoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAvaliacao) return;

  // 1. Coleta de Dados do Formulário
  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (!form) return;

  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;

  if (!resultado) {
    window.showToast(
      "Por favor, selecione o Resultado da Entrevista.",
      "error"
    );
    return;
  }
  console.log(
    `--- DEBUG RH: Submetendo Avaliação para ID: ${candidaturaId}. Resultado: ${resultado}`
  );

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

    // Update para o Firestore: Manter agendamento anterior e adicionar/atualizar a avaliação
    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: {
        ...(dadosCandidatoAtual.entrevista_rh || {}), // Manter o objeto entrevista_rh existente (incluindo agendamento)
        ...dadosAvaliacao, // Sobrescrever com os novos dados de avaliação
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
    console.log("--- DEBUG RH: SUCESSO - Avaliação salva no Firestore.");

    // Fecha o modal e recarrega a aba atual
    fecharModalAvaliacao();
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
