// modulos/rh/js/tabs/tabEntrevistas.js

import { getGlobalState } from "../recrutamento.js";
// CORREÇÃO: Caminho do firebase-init ajustado para 4 níveis (../../../../)
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";
import {
  arrayUnion,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

// Elementos do DOM do novo Modal (Atenção: o HTML DEVE ter esses IDs)
const modalEntrevistaRH = document.getElementById("modal-entrevista-rh");
const btnRegistrarEntrevista = document.getElementById(
  "btn-registrar-entrevista-rh"
);
let dadosCandidatoEntrevista = null; // Para armazenar dados do candidato atual

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
   <button 
        data-etapa="${statusAtual}"
    class="action-button primary btn-avaliar-entrevista" 
    data-id="${candidatoId}"
    data-candidato-data='${JSON.stringify(cand).replace(/'/g, "&#39;")}'>
    <i class="fas fa-calendar-check me-1"></i> ${
      statusAtual.includes("Entrevista Pendente")
        ? "Agendar / Avaliar RH"
        : "Avaliar Testes"
    }
   </button>
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
    }); // Configura evento para abrir o NOVO modal de Entrevista RH

    document.querySelectorAll(".btn-avaliar-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = JSON.parse(
          e.currentTarget
            .getAttribute("data-candidato-data")
            .replace(/&#39;/g, "'")
        ); // 🔴 Chama a nova função de modal

        window.abrirModalEntrevistaRH(candidatoId, dados);
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar entrevistas:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
  }
}
/**
 * Abre o modal de avaliação de Entrevista RH.
 * EXPOSTA GLOBALMENTE.
 */
window.abrirModalEntrevistaRH = function (candidatoId, dadosCandidato) {
  if (!modalEntrevistaRH) return;

  dadosCandidatoEntrevista = dadosCandidato;
  modalEntrevistaRH.dataset.candidaturaId = candidatoId; // 1. Preencher a Ficha e Notas Rápidas

  const nomeCompleto = dadosCandidato.nome_completo || "Candidato(a)"; // Tenta obter o motivo de reprovação (novo) ou o comentário geral (antigo)
  const resumoTriagem =
    dadosCandidato.triagem_rh?.motivo_rejeicao ||
    dadosCandidato.triagem_rh?.comentarios_gerais ||
    "N/A";
  const statusAtual = dadosCandidato.status_recrutamento || "N/A";
  const linkCurriculo = dadosCandidato.link_curriculo_drive || "#"; // 🔴 CORREÇÃO 3: Adicionar checagem de null em todos os elementos para evitar falha silenciosa

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
  } // 2. Limpar/Resetar Formulário e Pré-preencher agendamento

  const form = document.getElementById("form-avaliacao-entrevista-rh");
  if (form) form.reset(); // 3. Exibir o Modal

  modalEntrevistaRH.classList.add("is-visible");
};

/**
 * Lógica de Submissão para salvar a avaliação da Entrevista RH.
 */
async function submeterAvaliacaoEntrevistaRH(e) {
  e.preventDefault();

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;
  const candidaturaId = modalEntrevistaRH?.dataset.candidaturaId;

  if (!candidaturaId) return; // 1. Coleta de Dados do Formulário

  const form = document.getElementById("form-avaliacao-entrevista-rh");

  const resultado = form.querySelector(
    'input[name="resultado_entrevista"]:checked'
  )?.value;
  const notaMotivacao = form.querySelector("#nota-motivacao").value;
  const notaAderencia = form.querySelector("#nota-aderencia").value;
  const notaComunicacao = form.querySelector("#nota-comunicacao").value;
  const pontosFortes = form.querySelector("#pontos-fortes").value;
  const pontosAtencao = form.querySelector("#pontos-atencao").value;
  const dataEntrevista = form.querySelector("#data-entrevista-agendada").value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada").value;

  if (!resultado) {
    alert("Por favor, selecione o Resultado da Entrevista.");
    return;
  }

  btnRegistrarEntrevista.disabled = true;
  btnRegistrarEntrevista.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...'; // 2. Determinar Status e Próxima Etapa

  const isAprovado = resultado === "Aprovado";
  const novoStatusCandidato = isAprovado
    ? "Entrevista RH Aprovada (Testes Pendente)"
    : "Rejeitado (Comunicação Pendente)";
  const abaRecarregar = state.statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  const dadosAvaliacao = {
    data_entrevista: new Date().toISOString(),
    avaliador_uid: currentUserData.id || "rh_system_user",
    resultado: resultado,
    notas: {
      motivacao: notaMotivacao,
      aderencia: notaAderencia,
      comunicacao: notaComunicacao,
    },
    pontos_fortes: pontosFortes,
    pontos_atencao: pontosAtencao,
    agendamento: {
      data: dataEntrevista,
      hora: horaEntrevista,
    },
  };

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    await updateDoc(candidaturaRef, {
      status_recrutamento: novoStatusCandidato,
      entrevista_rh: dadosAvaliacao,
      historico: arrayUnion({
        data: new Date().toISOString(),
        acao: `Entrevista RH: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatusCandidato}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast(
      `Avaliação de Entrevista RH registrada. Status: ${novoStatusCandidato}`,
      "success"
    ); // 3. Envio da Mensagem de WhatsApp (com agendamento)

    if (
      dataEntrevista &&
      horaEntrevista &&
      dadosCandidatoEntrevista.telefone_contato
    ) {
      const mensagem = encodeURIComponent(
        `Olá ${
          dadosCandidatoEntrevista.nome_completo || "candidato(a)"
        }! Sua entrevista com RH foi agendada para o dia ${dataEntrevista} às ${horaEntrevista}. Por favor, confirme sua presença.`
      );
      const telefoneLimpo = dadosCandidatoEntrevista.telefone_contato.replace(
        /\D/g,
        ""
      );
      const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagem}`;
      window.open(linkWhatsApp, "_blank");
    } // Fecha o modal e recarrega a aba atual

    modalEntrevistaRH.classList.remove("is-visible");
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("Erro ao salvar avaliação de Entrevista RH:", error);
    window.showToast(`Erro ao registrar a decisão: ${error.message}`, "error");
  } finally {
    btnRegistrarEntrevista.disabled = false;
    btnRegistrarEntrevista.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar e Enviar para Próxima Fase';
  }
}

// 🔴 CORREÇÃO 4: Inicializa listeners estáticos do Modal de Entrevista RH
if (modalEntrevistaRH) {
  // 1. Botão 'Registrar e Enviar para Próxima Fase'
  if (btnRegistrarEntrevista) {
    btnRegistrarEntrevista.removeEventListener(
      "click",
      submeterAvaliacaoEntrevistaRH
    );
    btnRegistrarEntrevista.addEventListener(
      "click",
      submeterAvaliacaoEntrevistaRH
    );
  } // 2. Fechamento do Modal (X no cabeçalho e botão 'Voltar ao Painel')

  document
    .querySelectorAll("[data-modal-id='modal-entrevista-rh']")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        modalEntrevistaRH.classList.remove("is-visible")
      );
    }); // Listener para o botão 'Voltar ao Painel' no footer

  const btnVoltarPainel = modalEntrevistaRH.querySelector(
    "#btn-voltar-painel-rh"
  );
  if (btnVoltarPainel) {
    btnVoltarPainel.addEventListener("click", () =>
      modalEntrevistaRH.classList.remove("is-visible")
    );
  }
}
