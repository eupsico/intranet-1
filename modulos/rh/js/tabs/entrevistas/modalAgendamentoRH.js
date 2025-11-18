/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/modalAgendamentoRH.js
 * Versão: 1.1.0 (Corrigida dependência circular)
 */

// ✅ CORREÇÃO: Remove 'getGlobalState' da importação
import {
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../../assets/js/firebase-init.js";
import { getCurrentUserName } from "./helpers.js";

let dadosCandidatoAtual = null;

// ... (Funções formatarMensagemWhatsApp e enviarMensagemWhatsApp permanecem iguais) ...
function formatarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  const [ano, mes, dia] = dataEntrevista.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const [horas, minutos] = horaEntrevista.split(":");
  const horaFormatada = `${horas}h${minutos}`;
  const nomeCandidato = candidato.nome_candidato || "Candidato(a)";

  const mensagem = `
🎉 *Parabéns ${nomeCandidato}!* 🎉
Sua candidatura foi *aprovada na Triagem* e você foi *selecionado(a) para a próxima etapa!*
📅 *Data da Entrevista com RH:* ${dataFormatada}
⏰ *Horário:* ${horaFormatada}

📍 *Próximos Passos:*
✅ Confirme sua presença nesta data
✅ Prepare-se para conversar sobre seu perfil
✅ Tenha seus documentos à mão

*Abraços,*
*Equipe de Recrutamento - EuPsico* 💙
  `.trim();

  return mensagem;
}
function enviarMensagemWhatsApp(candidato, dataEntrevista, horaEntrevista) {
  if (!candidato.telefone_contato) {
    console.warn("⚠️ Telefone não disponível para envio de WhatsApp");
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
  } catch (error) {
    console.error("❌ Erro ao gerar mensagem WhatsApp:", error);
    window.showToast?.("Erro ao gerar link de WhatsApp.", "error");
  }
}

// ============================================
// FUNÇÕES DO MODAL (Abrir/Fechar/Submeter)
// ============================================

function fecharModalAgendamento() {
  const modalOverlay = document.getElementById("modal-agendamento-rh");
  if (modalOverlay) modalOverlay.classList.remove("is-visible");
}

export function abrirModalAgendamentoRH(candidatoId, dadosCandidato) {
  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");
  if (!modalAgendamentoRH || !form) {
    window.showToast?.("Erro: Modal de Agendamento não encontrado.", "error");
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modalAgendamentoRH.dataset.candidaturaId = candidatoId;

  // ... (Preenchimento dos campos do formulário) ...
  document.getElementById("agendamento-rh-nome-candidato").textContent =
    dadosCandidato.nome_candidato || "Candidato(a)";
  document.getElementById("agendamento-rh-status-atual").textContent =
    dadosCandidato.status_recrutamento || "N/A";
  document.getElementById("agendamento-rh-resumo-triagem").textContent =
    dadosCandidato.triagem_rh?.prerequisitos_atendidos || "N/A";
  document.getElementById("data-entrevista-agendada").value =
    dadosCandidato.entrevista_rh?.agendamento?.data || "";
  document.getElementById("hora-entrevista-agendada").value =
    dadosCandidato.entrevista_rh?.agendamento?.hora || "";

  form.removeEventListener("submit", submeterAgendamentoRH);
  form.addEventListener("submit", submeterAgendamentoRH);

  document
    .querySelectorAll(`[data-modal-id='modal-agendamento-rh']`)
    .forEach((btn) => {
      btn.removeEventListener("click", fecharModalAgendamento);
      btn.addEventListener("click", fecharModalAgendamento);
    });

  modalAgendamentoRH.classList.add("is-visible");
}

async function submeterAgendamentoRH(e) {
  e.preventDefault();

  const modalAgendamentoRH = document.getElementById("modal-agendamento-rh");
  const btnRegistrarAgendamento = document.getElementById(
    "btn-registrar-agendamento-rh"
  );

  // ✅ CORREÇÃO: Obtém o estado do 'window'
  const state = window.getGlobalRecrutamentoState();
  if (!state) {
    window.showToast?.("Erro: Estado global não iniciado.", "error");
    return;
  }
  // =========================================================

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
    await updateDoc(candidaturaRef, {
      "entrevista_rh.agendamento": {
        data: dataEntrevista,
        hora: horaEntrevista,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Agendamento Entrevista RH registrado para ${dataEntrevista} às ${horaEntrevista}. Status: ${statusAtual}`,
        usuario: usuarioNome,
      }),
    });

    window.showToast?.(`Entrevista RH agendada com sucesso!`, "success");

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
