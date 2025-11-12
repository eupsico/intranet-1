// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  db,
  addDoc,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Versão atualizada com layout consistente ao tabEntrevistas.js (grids, cards, badges e ações padronizadas).
 */
export async function renderizarEntrevistaGestor(state) {
  console.log("🔹 Gestor: Iniciando renderização");
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-info" style="border-left: 4px solid var(--cor-info);">
        <i class="fas fa-info-circle"></i> Nenhuma vaga selecionada.
      </div>
    `;
    console.log("ℹ️ Gestor: Vaga não selecionada");
    return;
  }

  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "Entrevista Gestor Pendente")
    );

    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.innerHTML = ` 4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <div class="alert alert-warning" style="border-left: 4px solid var(--cor-warning);">
          <i class="fas fa-exclamation-triangle"></i> Nenhum candidato na fase de Entrevista com Gestor.
        </div>
      `;
      console.log("ℹ️ Gestor: Nenhum candidato encontrado");
      return;
    }

    let listaHtml = `
      <div class="candidatos-container candidatos-grid">
        <h3 class="section-title">
          <i class="fas fa-users"></i> Candidatos para Entrevista com Gestor (${snapshot.size})
        </h3>
    `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const id = doc.id;
      const statusAtual = cand.status_recrutamento || "N/A";
      const statusClass = statusAtual.includes("Pendente")
        ? "status-warning"
        : "status-info";

      // Determina cor do status (similar ao tabEntrevistas)
      let statusCor = "status-info";
      if (statusAtual.includes("Aprovado")) statusCor = "status-success";
      else if (statusAtual.includes("Pendente")) statusCor = "status-warning";
      else if (statusAtual.includes("Rejeitado")) statusCor = "status-danger";

      listaHtml += `
        <div class="card card-candidato-gestor">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Nome não informado"}
              <span class="status-badge ${statusCor}">
                <i class="fas fa-clock${
                  statusAtual.includes("Pendente") ? "" : "-check"
                }"></i>
                ${statusAtual.replace(/_/g, " ")}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor
            </p>
          </div>

          ${
            cand.email_candidato
              ? `
            <div class="info-contato">
              <p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>
              ${
                cand.telefone_contato
                  ? `
                <p><i class="fas fa-phone"></i> ${cand.telefone_contato}</p>
                <a href="#" class="link-contato whatsapp-link" onclick="enviarMensagemWhatsAppGestor('${id}', '${encodeURIComponent(
                      JSON.stringify(cand)
                    )}'); return false;">
                  <i class="fab fa-whatsapp"></i> Enviar WhatsApp
                </a>
              `
                  : ""
              }
            </div>
          `
              : ""
          }

          <div class="acoes-candidato">
            <a href="#" class="action-button secondary" onclick="abrirModalAvaliacaoGestor('${id}', '${encodeURIComponent(
        JSON.stringify(cand)
      )}'); return false;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </a>
            <button class="action-button info" onclick="abrirDetalhesCandidato('${id}');">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            ${
              cand.link_curriculo_drive
                ? `
              <a href="${cand.link_curriculo_drive}" target="_blank" class="action-button primary">
                <i class="fas fa-file-pdf"></i> Ver Currículo
              </a>
            `
                : ""
            }
          </div>
        </div>
      `;
    });

    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;
    console.log(`✅ Gestor: ${snapshot.size} candidatos renderizados`);
  } catch (error) {
    console.error("❌ Gestor: Erro ao carregar candidatos:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger" style="border-left: 4px solid var(--cor-danger);">
        <i class="fas fa-exclamation-circle"></i> Erro ao carregar a lista de candidatos: ${error.message}
      </div>
    `;
  }
}

// ============================================
// FUNÇÕES DE UTILIDADE (reaproveitadas do tabEntrevistas)
// ============================================

/**
 * Envia mensagem de WhatsApp para agendamento com Gestor (adaptada para esta fase).
 */
window.enviarMensagemWhatsAppGestor = function (
  candidatoId,
  dadosCandidatoCodificados
) {
  try {
    const candidato = JSON.parse(decodeURIComponent(dadosCandidatoCodificados));
    if (!candidato.telefone_contato) {
      console.warn("⚠️ Gestor: Telefone não disponível para envio de WhatsApp");
      return;
    }

    const mensagem = `🎉 *Olá ${candidato.nome_completo || "Candidato"}!* 🎉 

Você foi aprovado(a) nos testes e está na fase final! 

📅 *Próximo Passo:* Entrevista com Gestor
⏰ *O que esperar:* Conversa sobre fit cultural e expectativas
📌 *Prepare-se:* Reflita sobre como você pode contribuir para nossa equipe

Estamos empolgados com seu potencial! 💙

*Equipe de Recrutamento - EuPsico*`;

    const mensagemCodificada = encodeURIComponent(mensagem);
    const telefoneLimpo = candidato.telefone_contato.replace(/\D/g, "");
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`;
    window.open(linkWhatsApp, "_blank");
    console.log("✅ Gestor: Link WhatsApp gerado com sucesso");
  } catch (error) {
    console.error("❌ Gestor: Erro ao gerar mensagem WhatsApp:", error);
    window.showToast?.(
      "Erro ao gerar link de WhatsApp. Tente novamente.",
      "error"
    );
  }
};

/**
 * Abre modal de avaliação para Gestor (placeholder para consistência; implemente conforme necessário).
 */
window.abrirModalAvaliacaoGestor = function (
  candidatoId,
  dadosCandidatoCodificados
) {
  console.log(`🔹 Gestor: Abrindo modal de avaliação para ${candidatoId}`);
  // Aqui você pode integrar com o modal existente ou criar novo, similar ao tabEntrevistas
  const dadosCandidato = JSON.parse(
    decodeURIComponent(dadosCandidatoCodificados)
  );
  // Exemplo: Preenche e abre modal (adapte IDs conforme seu HTML)
  const modal = document.getElementById("modal-avaliacao-gestor"); // Assumindo que existe
  if (modal) {
    // Preenche campos como no tabEntrevistas
    document
      .getElementById("gestor-nome-candidato")
      ?.setAttribute("textContent", dadosCandidato.nome_completo || "N/A");
    modal.classList.add("is-visible");
  } else {
    window.showToast?.("Modal de avaliação não configurado.", "warning");
  }
};

/**
 * Abre detalhes do candidato (placeholder para consistência).
 */
window.abrirDetalhesCandidato = function (candidatoId) {
  console.log(`🔹 Gestor: Abrindo detalhes do candidato ${candidatoId}`);
  // Implemente navegação ou modal de detalhes, similar ao tabEntrevistas
  window.showToast?.(`Detalhes do candidato ${candidatoId} abertos.`, "info");
};

// Funções de fechamento de modais (reaproveitadas)
window.fecharModalAvaliacaoGestor = function () {
  const modal = document.getElementById("modal-avaliacao-gestor");
  if (modal) modal.classList.remove("is-visible");
};
