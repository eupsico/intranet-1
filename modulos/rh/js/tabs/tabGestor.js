// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  getDoc,
  doc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 */
export async function renderizarEntrevistaGestor(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-info">Nenhuma vaga selecionada.</p>`;
    return;
  }

  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">Carregando candidatos para Entrevista com Gestor...</div>`;

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "Entrevista Gestor Pendente")
    );
    const snapshot = await getDocs(q);

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-user-tie"></i> 4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <p class="alert alert-warning">Nenhum candidato na fase de Entrevista com Gestor.</p>`;
      return;
    }

    // ✅ HTML IDÊNTICO à aba de Entrevistas
    let listaHtml = `
      <h3>Candidatos - Entrevista com Gestor</h3>
      <p><strong>Descrição:</strong> Avaliação final antes da comunicação e contratação.</p>
      <div class="candidatos-grid">`;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const nome = cand.nome_completo || "N/A";
      const statusAtual = cand.status_recrutamento || "N/A";
      const telefone = cand.telefone_contato || cand.telefone || "N/A";

      // Badge baseado no status (mesma lógica da aba Entrevistas)
      let badgeClass = "badge-warning";
      let badgeText = statusAtual.replace(/_/g, " ");

      listaHtml += `
        <div class="candidato-card">
          <div class="candidato-nome">${nome}</div>
          <div class="candidato-info">
            <p><strong>Status:</strong> <span class="badge ${badgeClass}">${badgeText}</span></p>
            <p><strong>Telefone:</strong> <span class="telefone-badge">${telefone}</span></p>
          </div>
          <div class="candidato-acoes">
            <button 
              class="btn btn-info btn-detalhes-gestor" 
              data-candidato-id="${candidatoId}"
              onclick="abrirDetalhesGestor('${candidatoId}', ${JSON.stringify(
        cand
      ).replace(/"/g, "&quot;")})">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            <button 
              class="btn btn-primary btn-avaliar-gestor" 
              data-candidato-id="${candidatoId}"
              onclick="abrirModalAvaliacaoGestor('${candidatoId}', ${JSON.stringify(
        cand
      ).replace(/"/g, "&quot;")})">
              <i class="fas fa-clipboard-check"></i> Avaliar Gestor
            </button>
          </div>
        </div>`;
    });

    listaHtml += `</div>`;

    conteudoRecrutamento.innerHTML = listaHtml;
  } catch (error) {
    console.error("Erro ao carregar candidatos (Gestor):", error);
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

// ============================================
// MODAL - DETALHES
// ============================================

window.abrirDetalhesGestor = async function (candidatoId, dadosCandidato) {
  console.log("🔹 Gestor: Abrindo detalhes do candidato");

  const modal = document.getElementById("modal-candidato");
  const modalBody = document.getElementById("candidato-modal-body");
  const modalFooter = document.getElementById("candidato-modal-footer");
  const modalTitulo = document.getElementById("candidato-nome-titulo");

  if (!modal || !modalBody) {
    alert("Modal não disponível");
    return;
  }

  modalTitulo.textContent = dadosCandidato.nome_completo || "Candidato";

  modalBody.innerHTML = `
    <div class="info-box">
      <h5>📋 Informações Básicas</h5>
      <p><strong>Nome:</strong> ${dadosCandidato.nome_completo || "N/A"}</p>
      <p><strong>Email:</strong> ${
        dadosCandidato.email_candidato || dadosCandidato.email || "N/A"
      }</p>
      <p><strong>Telefone:</strong> ${
        dadosCandidato.telefone_contato || dadosCandidato.telefone || "N/A"
      }</p>
    </div>

    <div class="info-box">
      <h5>✅ Triagem RH</h5>
      ${
        dadosCandidato.triagem_rh
          ? `
        <p><strong>Apto para Entrevista:</strong> ${
          dadosCandidato.triagem_rh.apto_entrevista || "N/A"
        }</p>
        <p><strong>Observações:</strong> ${
          dadosCandidato.triagem_rh.observacoes || "N/A"
        }</p>
      `
          : "<p>Triagem não realizada</p>"
      }
    </div>

    <div class="info-box">
      <h5>💬 Entrevista RH</h5>
      ${
        dadosCandidato.entrevista_rh
          ? `
        <p><strong>Resultado:</strong> ${
          dadosCandidato.entrevista_rh.resultado || "N/A"
        }</p>
        <p><strong>Pontos Fortes:</strong> ${
          dadosCandidato.entrevista_rh.pontos_fortes || "N/A"
        }</p>
        <p><strong>Pontos de Atenção:</strong> ${
          dadosCandidato.entrevista_rh.pontos_atencao || "N/A"
        }</p>
      `
          : "<p>Entrevista não realizada</p>"
      }
    </div>

    <div class="info-box">
      <h5>📝 Testes/Estudos</h5>
      ${
        dadosCandidato.testes_estudos
          ? `
        <p><strong>Status:</strong> ${
          dadosCandidato.testes_estudos.status_resultado || "N/A"
        }</p>
        <p><strong>Observações:</strong> ${
          dadosCandidato.testes_estudos.observacoes || "N/A"
        }</p>
      `
          : "<p>Testes não realizados</p>"
      }
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-secondary fechar-modal-candidato">Fechar</button>
  `;

  modalFooter.querySelector(".fechar-modal-candidato").onclick = () => {
    modal.classList.remove("is-visible");
  };

  modal.classList.add("is-visible");
};

// ============================================
// MODAL - AVALIAÇÃO GESTOR
// ============================================

window.abrirModalAvaliacaoGestor = function (candidatoId, dadosCandidato) {
  console.log("🔹 Gestor: Abrindo modal de avaliação");

  const modal = document.getElementById("modal-candidato");
  const modalBody = document.getElementById("candidato-modal-body");
  const modalFooter = document.getElementById("candidato-modal-footer");
  const modalTitulo = document.getElementById("candidato-nome-titulo");

  if (!modal || !modalBody) {
    alert("Modal não disponível");
    return;
  }

  modalTitulo.textContent = `Avaliar Candidato - ${
    dadosCandidato.nome_completo || "Candidato"
  }`;

  modalBody.innerHTML = `
    <div class="info-box" style="background: #e7f3ff; border-left: 4px solid #007bff;">
      <p><strong>Nome:</strong> ${dadosCandidato.nome_completo || "N/A"}</p>
      <p><strong>Email:</strong> ${
        dadosCandidato.email_candidato || dadosCandidato.email || "N/A"
      }</p>
      <p><strong>Telefone:</strong> ${
        dadosCandidato.telefone_contato || dadosCandidato.telefone || "N/A"
      }</p>
    </div>

    <form id="form-avaliacao-gestor">
      <div class="form-group">
        <label><strong>O gestor aprovou o candidato?</strong></label>
        <div class="radio-options">
          <label class="radio-label">
            <input type="radio" name="aprovado_gestor" value="Sim" required>
            <span>Sim - Aprovar para contratação</span>
          </label>
          <label class="radio-label">
            <input type="radio" name="aprovado_gestor" value="Não" required>
            <span>Não - Reprovar candidato</span>
          </label>
        </div>
      </div>

      <div class="form-group" id="motivo-rejeicao-container" style="display: none;">
        <label for="motivo-rejeicao">Motivo da Reprovação: <span class="obrigatorio">*</span></label>
        <textarea 
          id="motivo-rejeicao" 
          name="motivo_rejeicao" 
          class="form-control" 
          rows="3"
          placeholder="Descreva o motivo da reprovação..."></textarea>
      </div>

      <div class="form-group">
        <label for="nome-gestor">Nome do Gestor: <span class="obrigatorio">*</span></label>
        <input 
          type="text" 
          id="nome-gestor" 
          name="nome_gestor" 
          class="form-control" 
          placeholder="Nome completo do gestor"
          required>
      </div>

      <div class="form-group">
        <label for="comentarios-gestor">Comentários da Entrevista:</label>
        <textarea 
          id="comentarios-gestor" 
          name="comentarios_gestor" 
          class="form-control" 
          rows="4"
          placeholder="Feedback geral sobre o candidato..."></textarea>
      </div>

      <div class="form-group">
        <label for="data-entrevista-gestor">Data da Entrevista: <span class="obrigatorio">*</span></label>
        <input 
          type="date" 
          id="data-entrevista-gestor" 
          name="data_entrevista" 
          class="form-control" 
          required>
      </div>
    </form>
  `;

  // Toggle campo de motivo
  const radios = modalBody.querySelectorAll('input[name="aprovado_gestor"]');
  const motivoContainer = modalBody.querySelector("#motivo-rejeicao-container");

  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      motivoContainer.style.display =
        e.target.value === "Não" ? "block" : "none";
      const motivoTextarea = motivoContainer.querySelector("#motivo-rejeicao");
      if (e.target.value === "Não") {
        motivoTextarea.setAttribute("required", "required");
      } else {
        motivoTextarea.removeAttribute("required");
      }
    });
  });

  // Botões do footer
  modalFooter.innerHTML = `
    <button type="button" class="btn btn-secondary fechar-modal-candidato">Cancelar</button>
    <button type="button" class="btn btn-success btn-salvar-avaliacao-gestor">
      <i class="fas fa-check"></i> Salvar Avaliação
    </button>
  `;

  modalFooter.querySelector(".fechar-modal-candidato").onclick = () => {
    modal.classList.remove("is-visible");
  };

  modalFooter.querySelector(".btn-salvar-avaliacao-gestor").onclick =
    async () => {
      await salvarAvaliacaoGestor(candidatoId, dadosCandidato, modal);
    };

  modal.classList.add("is-visible");
};

// ============================================
// SALVAR AVALIAÇÃO
// ============================================

async function salvarAvaliacaoGestor(candidatoId, dadosCandidato, modal) {
  console.log("🔹 Gestor: Salvando avaliação");

  const form = document.getElementById("form-avaliacao-gestor");
  const btnSalvar = document.querySelector(".btn-salvar-avaliacao-gestor");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const state = getGlobalState();
  const {
    candidatosCollection,
    currentUserData,
    handleTabClick,
    statusCandidaturaTabs,
  } = state;

  const formData = new FormData(form);
  const aprovado = formData.get("aprovado_gestor");
  const nomeGestor = formData.get("nome_gestor");
  const comentarios = formData.get("comentarios_gestor");
  const dataEntrevista = formData.get("data_entrevista");
  const motivo = formData.get("motivo_rejeicao");

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

  const isAprovado = aprovado === "Sim";
  const novoStatus = isAprovado
    ? "Entrevista Gestor Aprovada - Comunicação Final (Aprovado - Próximo: Contratar)"
    : "Rejeitado - Comunicação Pendente (Reprovado - Próximo: enviar mensagem)";

  try {
    const docRef = doc(candidatosCollection, candidatoId);

    const updateData = {
      entrevista_gestor: {
        aprovado: aprovado,
        nome_gestor: nomeGestor,
        comentarios_gestor: comentarios || "",
        data_entrevista: dataEntrevista,
        data_avaliacao: new Date(),
        avaliador_uid: currentUserData.id || "rh_system_user",
      },
      status_recrutamento: novoStatus,
      ultima_atualizacao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Entrevista Gestor: ${
          isAprovado ? "APROVADO" : "REPROVADO"
        }. Status: ${novoStatus}`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    };

    if (!isAprovado && motivo) {
      updateData.rejeicao = {
        etapa: "Entrevista com Gestor",
        motivo: motivo,
        data: new Date(),
      };
    }

    await updateDoc(docRef, updateData);

    window.showToast?.(
      `Avaliação registrada. Status: ${novoStatus}`,
      "success"
    );

    modal.classList.remove("is-visible");

    // Recarrega a aba ativa
    const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("❌ Erro ao salvar:", error);
    window.showToast?.(
      `Erro ao registrar avaliação: ${error.message}`,
      "error"
    );
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-check"></i> Salvar Avaliação';
  }
}
