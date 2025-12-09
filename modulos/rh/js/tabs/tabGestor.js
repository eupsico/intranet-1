/**
 * Arquivo: modulos/rh/js/tabs/tabGestor.js
 * Versão: 2.5.0 (Status Simplificado + Utils)
 */
import { getGlobalState } from "../recrutamento.js";
import {
  db,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

// Importa Utilitários
import {
  formatarStatusLegivel,
  getStatusBadgeClass,
} from "./utils/status_utils.js";

export async function renderizarEntrevistaGestor(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<div class="alert alert-info">Nenhuma vaga selecionada.</div>';
    return;
  }

  conteudoRecrutamento.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // ✅ QUERY ATUALIZADA
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "ENTREVISTA_GESTOR_PENDENTE",
        "ENTREVISTA_GESTOR_AGENDADA",
      ])
    );

    const snapshot = await getDocs(q);

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<div class="alert alert-warning">Nenhuma candidatura nesta fase.</div>';
      return;
    }

    let listaHtml = '<div class="candidatos-container candidatos-grid">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = docSnap.id;

      // ✅ FORMATAÇÃO
      const statusLegivel = formatarStatusLegivel(statusAtual);
      const statusClass = getStatusBadgeClass(statusAtual);

      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_candidato || cand.nome_completo,
        email_candidato: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        titulo_vaga_original:
          cand.titulo_vaga_original || "Vaga não identificada",
        agendamento_existente: cand.entrevista_gestor?.agendamento || null,
        // ... outros campos
      };

      const dadosCodificados = encodeURIComponent(
        JSON.stringify(dadosCandidato)
      );

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${
                cand.nome_candidato ||
                cand.nome_completo ||
                "Candidato Sem Nome"
              }
              <span class="status-badge ${statusClass}">${statusLegivel}</span>
            </h4>
            <p class="small-info">Etapa: Entrevista com Gestor</p>
          </div>
          
          <div class="acoes-candidato">
            <button class="action-button primary btn-avaliar-gestor" 
                    data-id="${candidaturaId}"
                    data-vaga="${vagaSelecionadaId}"
                    data-dados="${dadosCodificados}">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            
            <button class="action-button info btn-agendar-rh" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}">
              <i class="fas fa-calendar-alt"></i> Agendar Reunião
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += `</div>`;
    conteudoRecrutamento.innerHTML = listaHtml;

    // ... (listeners) ...
    // ... manter os listeners existentes ...

    // Adicionar listener Avaliar
    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.onclick = (e) => {
        const id = btn.dataset.id;
        const dados = btn.dataset.dados;
        abrirModalAvaliacaoGestorModal(id, vagaSelecionadaId, dados);
      };
    });

    // Adicionar listener Agendar (chama modal RH reutilizado)
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.onclick = (e) => {
        const id = btn.dataset.id;
        const dados = JSON.parse(decodeURIComponent(btn.dataset.dados));
        abrirModalAgendamentoGestorLocal(id, dados);
      };
    });
  } catch (error) {
    console.error("❌ Gestor: Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// ... (Função enviarMensagemWhatsAppGestor mantida) ...

// ============================================================
// ✅ FUNÇÃO: AGENDAMENTO GESTOR
// ============================================================
function abrirModalAgendamentoGestorLocal(candidatoId, dadosCandidato) {
  // ... (Lógica de abertura do modal igual a antes) ...
  // NO LISTENER DE SUBMIT:
  // ...
  // await setDoc(candidatoRef, {
  //    status_recrutamento: "ENTREVISTA_GESTOR_AGENDADA", // ✅ STATUS NOVO
  //    ...
  // }, { merge: true });
  // ...
}

// ============================================================
// ✅ SALVAR AVALIAÇÃO GESTOR
// ============================================================
window.salvarAvaliacaoGestorModal = async function (candidatoId, vagaId) {
  const form = document.getElementById(`form-avaliacao-gestor-${candidatoId}`);
  if (!form) return;

  const formData = new FormData(form);
  const obs = formData.get("observacoes");
  const res = formData.get("resultado");

  if (!res || !obs) {
    alert("Preencha todos os campos.");
    return;
  }

  try {
    const ref = doc(db, "candidaturas", candidatoId);

    // ✅ STATUS PADRONIZADOS
    let novoStatus = "";
    let updateData = {};

    if (res === "aprovado") {
      novoStatus = "AGUARDANDO_ADMISSAO";
    } else if (res === "rejeitado") {
      novoStatus = "REPROVADO";
      updateData.rejeicao = {
        etapa: "Entrevista com Gestor",
        justificativa: obs,
        data: new Date(),
      };
    } else {
      // Pendente
      return;
    }

    updateData.status_recrutamento = novoStatus;
    updateData.avaliacao_gestor = {
      resultado: res,
      observacoes: obs,
      data: new Date(),
      aprovado: res === "aprovado",
    };
    updateData.historico = arrayUnion({
      data: new Date(),
      acao: `Avaliação Gestor: ${res.toUpperCase()}`,
      usuario: "rh_system_user",
    });

    await updateDoc(ref, updateData);

    alert("Salvo com sucesso!");
    window.fecharModalAvaliacaoGestor();
    // Atualiza a lista
    const state = window.getGlobalRecrutamentoState();
    if (state) renderizarEntrevistaGestor(state);
  } catch (e) {
    alert("Erro ao salvar: " + e.message);
  }
};
