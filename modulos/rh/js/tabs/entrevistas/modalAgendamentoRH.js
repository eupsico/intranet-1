/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAgendamentoRH.js
 * Versão: 1.1.0 (Corrigida dependência circular e código completo)
 * Data: 05/11/2025
 * Descrição: Gerencia o modal de agendamento de entrevista com RH.
 */

// ✅ CORREÇÃO: Remove 'getGlobalState' da importação
import {
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../../assets/js/firebase-init.js";
import { getCurrentUserName } from "./helpers.js";

let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DE UTILIDADE (WhatsApp)
// ============================================

/**
 * Formata uma mensagem humanizada de agendamento para WhatsApp
 */
function formatarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  const [ano, mes, dia] = dataEntrevista.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = horaEntrevista.split(":");
  const horaFormatada = `${horas}h${minutos}`;
  const nomeCandidato = candidato.nome_candidato || "Candidato(a)";

  const mensagem = `
🎉 *Parabéns ${nomeCandidato}!* 🎉

Sua candidatura foi *aprovada na Triagem* e você foi *selecionado(a) para a próxima etapa!*

📅 *Data da Entrevista com RH:*
${dataFormatada}

⏰ *Horário:*
${horaFormatada}

📍 *Próximos Passos:*
✅ Confirme sua presença nesta data
✅ Prepare-se para conversar sobre seu perfil
✅ Tenha seus documentos à mão

Estamos ansiosos para conhecê-lo(a) melhor!

*Abraços,*
*Equipe de Recrutamento - EuPsico* 💙
  `.trim();

  return mensagem;
}

/**
 * Envia mensagem de WhatsApp com agendamento
 */
function enviarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  if (!candidato.telefone_contato) {
    console.warn(
      "⚠️ Entrevistas: Telefone não disponível para envio de WhatsApp"
    );
    return;
  }

  try {
    const mensagem = formatarMensagemWhatsApp(
      candidato,
      dataEntrevista,
      horaEntrevista
    );
    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;

    window.open(linkWhatsApp, "_blank");
    console.log("✅ Entrevistas: Link WhatsApp gerado com sucesso");
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao gerar mensagem WhatsApp:", error);
    window.showToast?.(
      "Erro ao gerar link de WhatsApp. Tente novamente.",
      "error"
    );
  }
}

// ============================================
// FUNÇÕES DO MODAL (Abrir/Fechar/Submeter)
// ============================================

/**
 * Fecha o modal de agendamento
 */
function fecharModalAgendamento() {
  console.log("🔹 Entrevistas: Fechando modal de agendamento");
  const modalOverlay = document.getElementById("modal-agendamento-rh");
  if (modalOverlay) {
    modalOverlay.classList.remove("is-visible");
  }
}

/**
 * Abre o modal de agendamento da Entrevista RH
 */
export function abrirModalAgendamentoRH(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Entrevistas: Abrindo modal de agendamento para ${candidatoId}`
  );

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");

  if (!modalAgendamentoRH || !form) {
    window.showToast?.("Erro: Modal de Agendamento não encontrado.", "error");
    console.error(
      "❌ Entrevistas: Elemento modal-agendamento-rh não encontrado"
    );
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  // ==========================================================
  // ✅ CÓDIGO RESTAURADO (Como você solicitou)
  // ==========================================================
  const nomeCompleto = dadosCandidato.nome_candidato || "Candidato(a)";
  const resumoTriagem =
    dadosCandidato.triagem_rh?.prerequisitos_atendidos ||
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
  // ==========================================================
  // FIM DO CÓDIGO RESTAURADO
  // ==========================================================

  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);

  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  modalAgendamentoRH.classList.add("is-visible");
  console.log("✅ Entrevistas: Modal de agendamento aberto");
}

/**
 * Submete o agendamento da Entrevista RH
 */
async function submeterAgendamentoRH(e) {
  e.preventDefault();

  console.log("🔹 Entrevistas: Submetendo agendamento");

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const btnRegistrarAgendamento = document.getElementById(
    "btn-registrar-agendamento-rh"
  );

  // ==========================================================
  // ✅ CÓDIGO RESTAURADO (Como você solicitou)
  // Esta verificação é crucial para a função de submissão.
  // ==========================================================
  const state = window.getGlobalRecrutamentoState();
  if (!state) {
    window.showToast?.("Erro: Estado global não iniciado.", "error");
    return;
  }
  // ==========================================================

  const { candidatosCollection, handleTabClick, statusCandidaturaTabs } = state;
  const candidaturaId = modalAgendamentoRH?.dataset.candidaturaId;

  if (!candidaturaId || !btnRegistrarAgendamento) return;

  const form = document.getElementById("form-agendamento-entrevista-rh");
  if (!form) return;

  const dataEntrevista = form.querySelector("#data-entrevista-agendada").value;
  const horaEntrevista = form.querySelector("#hora-entrevista-agendada").value;

  if (!dataEntrevista || !horaEntrevista) {
    window.showToast?.(
      "Por favor, preencha a data e hora da entrevista.",
      "error"
    );
    return;
  }

  btnRegistrarAgendamento.disabled = true;
  btnRegistrarAgendamento.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

  const statusAtual =
    dadosCandidatoAtual.status_recrutamento ||
    "Triagem Aprovada (Entrevista Pendente)";
  const abaRecarregar = statusCandidaturaTabs
    .querySelector(".tab-link.active")
    .getAttribute("data-status");

  const usuarioNome = await getCurrentUserName();

  try {
    const candidaturaRef = doc(candidatosCollection, candidaturaId);

    const updateData = {
      "entrevista_rh.agendamento": {
        data: dataEntrevista,
        hora: horaEntrevista,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}. Status: ${statusAtual}`,
        usuario: usuarioNome,
      }),
    };

    await updateDoc(candidaturaRef, updateData);

    window.showToast?.(
      `Entrevista RH agendada com sucesso para ${dataEntrevista} às ${horaEntrevista}.`,
      "success"
    );
    console.log("✅ Entrevistas: Agendamento salvo no Firestore");

    if (dadosCandidatoAtual.telefone_contato) {
      setTimeout(() => {
        enviarMensagemWhatsApp(
          dadosCandidatoAtual,
          dataEntrevista,
          horaEntrevista
        );
      }, 500);
    }

    fecharModalAgendamento();
    const activeTab = statusCandidaturaTabs.querySelector(
      `[data-status="${abaRecarregar}"]`
    );
    if (activeTab) handleTabClick({ currentTarget: activeTab });
  } catch (error) {
    console.error("❌ Erro ao salvar agendamento:", error);
    window.showToast?.(
      `Erro ao registrar o agendamento: ${error.message}`,
      "error"
    );
  } finally {
    btnRegistrarAgendamento.disabled = false;
    btnRegistrarAgendamento.innerHTML =
      '<i class="fas fa-calendar-alt me-2"></i> Agendar Entrevista';
  }
}
