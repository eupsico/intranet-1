/**
 * Arquivo: modulos/rh/js/tabs/tabAvaliacao3Meses.js
 * Versão: 1.0.0 (Baseado em tabTriagem.js)
 * Descrição: Gerencia a etapa de Avaliação de Experiência (3 Meses).
 */

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";
import {
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAvaliacao3Meses(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores em período de experiência...</div>';

  try {
    // Busca candidatos que estão aguardando a avaliação de 3 meses
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_AVALIACAO_3MESES")
    );
    const snapshot = await getDocs(q); // Atualiza contagem na aba

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="avaliacao-3-meses"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-calendar-check me-2"></i> 5. Avaliação (3 Meses) (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando avaliação de 3 meses.</p>';
      return;
    }

    let listaHtml = `
    	<div class="description-box" style="margin-top: 15px;">
      	<p>Colaboradores que completaram a integração e estão no período de experiência. Registre a avaliação de 3 meses para movê-los para a etapa final.</p>
    	</div>
    	<div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      const statusClass = "status-warning"; // Sempre pendente

      const dadosCandidato = {
        id: candidatoId,
        nome_completo: cand.nome_completo,
        email_novo: cand.admissao_info?.email_solicitado || "Não solicitado",
        telefone_contato: cand.telefone_contato,
        vaga_titulo: vagaTitulo,
        data_integracao: cand.integracao?.agendamento?.data || "N/A",
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidatoId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Colaborador Sem Nome"}
            	<span class="status-badge ${statusClass}">
              	<i class="fas fa-tag"></i> Em Experiência
            	</span>
            </h4>
          	<p class="small-info">
              <i class="fas fa-briefcase"></i> Cargo: ${
        cand.admissao_info?.cargo_final || vagaTitulo
      }
            </p>
          	<p class="small-info">
              <i class="fas fa-calendar-alt"></i> Integração: ${
        dadosCandidato.data_integracao
      }
            </p>
          </div>
          
          <div class="acoes-candidato">
          	<button 
            	class="action-button primary btn-avaliar-3meses" 
            	data-id="${candidatoId}"
            	data-dados="${dadosCodificados}"
          		style="background: var(--cor-primaria);">
            	<i class="fas fa-clipboard-check me-1"></i> Registrar Avaliação
          	</button>
          	<button 
            	class="action-button secondary btn-ver-detalhes-admissao" 
            	data-id="${candidatoId}"
            	data-dados="${dadosCodificados}">
            	<i class="fas fa-eye me-1"></i> Detalhes
          	</button>
          </div>
        </div>
      `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml; // Listeners de Avaliar

    document.querySelectorAll(".btn-avaliar-3meses").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAvaliacao3Meses(
          candidatoId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    }); // Listeners de Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
        }
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Avaliação 3 Meses): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// LÓGICA DO MODAL DE AVALIAÇÃO (3 MESES)
// ============================================

/**
 * Abre o modal de avaliação de 3 meses
 */
function abrirModalAvaliacao3Meses(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Admissão: Abrindo modal de avaliação 3 meses para ${candidatoId}`
  ); // ID esperado no admissao.html (copie o modal-avaliacao-triagem e renomeie)
  const modal = document.getElementById("modal-avaliacao-3meses");
  const form = document.getElementById("form-avaliacao-3meses");

  if (!modal || !form) {
    window.showToast?.(
      "Erro: Modal de Avaliação 3 Meses não encontrado no HTML.",
      "error"
    );
    console.error(
      "❌ Admissão: Elemento #modal-avaliacao-3meses não encontrado"
    );
    return;
  }

  dadosCandidatoAtual = dadosCandidato;
  modal.dataset.candidaturaId = candidatoId; // Preenche o modal

  const nomeEl = document.getElementById("avaliacao-3meses-nome");
  if (nomeEl) nomeEl.textContent = dadosCandidato.nome_completo; // Limpa o formulário e preenche dados anteriores (se houver)

  form.reset();
  const avaliacaoAnterior = dadosCandidato.avaliacao_3meses || {};
  const feedbackPositivoEl = document.getElementById(
    "avaliacao-3meses-positivo"
  );
  const feedbackDesenvolverEl = document.getElementById(
    "avaliacao-3meses-desenvolver"
  );
  const radioAprovado = document.getElementById("avaliacao-3meses-aprovado");
  const radioReprovado = document.getElementById("avaliacao-3meses-reprovado");

  if (feedbackPositivoEl)
    feedbackPositivoEl.value = avaliacaoAnterior.feedback_positivo || "";
  if (feedbackDesenvolverEl)
    feedbackDesenvolverEl.value = avaliacaoAnterior.feedback_desenvolver || "";
  if (radioAprovado)
    radioAprovado.checked = avaliacaoAnterior.resultado === "Aprovado";
  if (radioReprovado)
    radioReprovado.checked = avaliacaoAnterior.resultado === "Reprovado"; // Listeners

  form.removeEventListener("submit", submeterAvaliacao3Meses);
  form.addEventListener("submit", submeterAvaliacao3Meses);

  document
    .querySelectorAll(`[data-modal-id='modal-avaliacao-3meses']`)
    .forEach((btn) => {
      btn.removeEventListener("click", () =>
        modal.classList.remove("is-visible")
      );
      btn.addEventListener("click", () => modal.classList.remove("is-visible"));
    });

  modal.classList.add("is-visible");
}

/**
 * Submete a avaliação de 3 meses
 */
async function submeterAvaliacao3Meses(e) {
  e.preventDefault();
  const { candidatosCollection, currentUserData } = getGlobalState();
  const modal = document.getElementById("modal-avaliacao-3meses");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const candidaturaId = modal.dataset.candidaturaId;

  if (!candidaturaId) return;

  const form = document.getElementById("form-avaliacao-3meses");
  const resultado = form.querySelector(
    'input[name="resultado_3meses"]:checked'
  )?.value;
  const feedbackPositivo = document.getElementById(
    "avaliacao-3meses-positivo"
  ).value;
  const feedbackDesenvolver = document.getElementById(
    "avaliacao-3meses-desenvolver"
  ).value;

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione um resultado (Aprovado ou Reprovado).",
      "warning"
    );
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  const isAprovado = resultado === "Aprovado"; // Se aprovado, vai para docs finais. Se reprovado, vai para reprovados.
  const novoStatusCandidato = isAprovado
    ? "AGUARDANDO_DOCS_POS_3MESES"
    : "Reprovado (Admissão)";
  const acaoHistorico = `Avaliação de 3 Meses: ${resultado}.`;

  try {
    const candidatoRef = doc(candidatosCollection, candidaturaId);
    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatusCandidato,
      avaliacao_3meses: {
        resultado: resultado,
        feedback_positivo: feedbackPositivo,
        feedback_desenvolver: feedbackDesenvolver,
        data_avaliacao: new Date(),
        avaliador_uid: currentUserData.id || "rh_system_user",
      },
      historico: arrayUnion({
        data: new Date(),
        acao: acaoHistorico,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    window.showToast?.(
      "Avaliação de 3 meses registrada com sucesso!",
      "success"
    );
    modal.classList.remove("is-visible");
    renderizarAvaliacao3Meses(getGlobalState()); // Recarrega a aba
  } catch (error) {
    console.error("Erro ao salvar avaliação de 3 meses:", error);
    window.showToast?.(`Erro ao registrar: ${error.message}`, "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  }
}
