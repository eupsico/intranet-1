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
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <p class="alert alert-warning">Nenhuma candidato na fase de Entrevista com Gestor.</p>`;
      return;
    }

    // ✅ HTML IDÊNTICO às outras abas - estrutura de CARDS
    let listaHtml = `
      <h3>Candidatos - Entrevista com Gestor</h3>
      <p><strong>Descrição:</strong> Avaliação final antes da comunicação e contratação.</p>
      <div class="candidatos-grid">`;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const nome = cand.nome_completo || "N/A";
      const statusAtual = cand.status_recrutamento || "N/A";
      const telefone = cand.telefone || cand.telefonecontato || "N/A";

      // Badge colorido baseado no status
      let badgeClass = "badge-warning";
      if (statusAtual.includes("Aprovado")) badgeClass = "badge-success";
      else if (statusAtual.includes("Reprovado")) badgeClass = "badge-danger";

      listaHtml += `
        <div class="card-candidato">
          <div class="card-header">
            <h4>${nome}</h4>
          </div>
          <div class="card-body">
            <p><strong>Status:</strong> <span class="badge ${badgeClass}">${statusAtual}</span></p>
            <p><strong>Telefone:</strong> ${telefone}</p>
          </div>
          <div class="card-actions">
            <button class="btn btn-info btn-detalhes-gestor" data-candidato-id="${candidatoId}">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            <button class="btn btn-primary btn-avaliar-gestor" data-candidato-id="${candidatoId}">
              <i class="fas fa-clipboard-check"></i> Avaliar Gestor
            </button>
          </div>
        </div>`;
    });

    listaHtml += `</div>`;

    conteudoRecrutamento.innerHTML = listaHtml;
    adicionarEventListeners(state);
  } catch (error) {
    console.error("Erro ao carregar candidatos (Gestor):", error);
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

/**
 * Adiciona event listeners aos botões
 */
function adicionarEventListeners(state) {
  document.querySelectorAll(".btn-detalhes-gestor").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      await abrirModalDetalhes(candidatoId, state);
    });
  });

  document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      await abrirModalAvaliacao(candidatoId, state);
    });
  });
}

/**
 * Modal de Detalhes - USANDO O MODAL EXISTENTE DO SISTEMA
 */
async function abrirModalDetalhes(candidatoId, state) {
  // Usa a função global que já existe no recrutamento.js
  const { abrirModalCandidato } = await import("../recrutamento.js");
  await abrirModalCandidato(candidatoId, "detalhes");
}

/**
 * Modal de Avaliação - USANDO ESTRUTURA PADRÃO
 */
async function abrirModalAvaliacao(candidatoId, state) {
  const { candidatosCollection } = state;

  try {
    const docRef = doc(candidatosCollection, candidatoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("Candidato não encontrado");
      return;
    }

    const candidato = docSnap.data();

    // Usa o modal global que já existe (modal-candidato)
    const modal = document.getElementById("modal-candidato");
    const modalBody = document.getElementById("candidato-modal-body");
    const modalFooter = document.getElementById("candidato-modal-footer");
    const modalTitulo = document.getElementById("candidato-nome-titulo");

    if (!modal || !modalBody) {
      alert("Modal não disponível");
      return;
    }

    modalTitulo.textContent = `Avaliar Candidato - ${
      candidato.nome_completo || "Candidato"
    }`;

    modalBody.innerHTML = `
      <div class="candidato-info-resumo" style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h5>${candidato.nome_completo || "Candidato"}</h5>
        <p><strong>Email:</strong> ${candidato.email || "N/A"}</p>
        <p><strong>Telefone:</strong> ${
          candidato.telefone || candidato.telefonecontato || "N/A"
        }</p>
      </div>

      <form id="form-avaliacao-gestor">
        <div class="form-group">
          <label><strong>O gestor aprovou o candidato?</strong></label>
          <div style="margin-top: 10px;">
            <label style="display: block; margin: 10px 0;">
              <input type="radio" name="aprovado" value="Sim" required> 
              Sim - Aprovar para contratação
            </label>
            <label style="display: block; margin: 10px 0;">
              <input type="radio" name="aprovado" value="Não" required> 
              Não - Reprovar candidato
            </label>
          </div>
        </div>

        <div class="form-group" id="motivo-reprovacao" style="display: none;">
          <label>Motivo da Reprovação:</label>
          <textarea name="motivo" class="form-control" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label>Nome do Gestor:</label>
          <input type="text" name="nome_gestor" class="form-control" required>
        </div>

        <div class="form-group">
          <label>Comentários:</label>
          <textarea name="comentarios" class="form-control" rows="4"></textarea>
        </div>

        <div class="form-group">
          <label>Data da Entrevista:</label>
          <input type="date" name="data_entrevista" class="form-control" required>
        </div>
      </form>
    `;

    // Toggle motivo reprovação
    const radios = modalBody.querySelectorAll('input[name="aprovado"]');
    const motivoDiv = modalBody.querySelector("#motivo-reprovacao");
    radios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        motivoDiv.style.display = e.target.value === "Não" ? "block" : "none";
      });
    });

    // Botões do footer
    modalFooter.innerHTML = `
      <button class="btn btn-secondary fechar-modal-candidato">Cancelar</button>
      <button class="btn btn-success btn-salvar-avaliacao-gestor">Salvar Avaliação</button>
    `;

    // Event listener para salvar
    modalFooter.querySelector(".btn-salvar-avaliacao-gestor").onclick = () => {
      salvarAvaliacao(candidatoId, state, modal);
    };

    // Event listener para cancelar
    modalFooter.querySelector(".fechar-modal-candidato").onclick = () => {
      modal.classList.remove("is-visible");
    };

    modal.classList.add("is-visible");
  } catch (error) {
    console.error("Erro ao abrir modal:", error);
    alert("Erro ao abrir avaliação");
  }
}

/**
 * Salvar Avaliação
 */
async function salvarAvaliacao(candidatoId, state, modal) {
  const { candidatosCollection } = state;
  const form = document.getElementById("form-avaliacao-gestor");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const aprovado = formData.get("aprovado");
  const nomeGestor = formData.get("nome_gestor");
  const comentarios = formData.get("comentarios");
  const dataEntrevista = formData.get("data_entrevista");
  const motivo = formData.get("motivo");

  try {
    const docRef = doc(candidatosCollection, candidatoId);

    const updateData = {
      entrevista_gestor: {
        aprovado: aprovado,
        nome_gestor: nomeGestor,
        comentarios_gestor: comentarios || "",
        data_entrevista: dataEntrevista,
        data_registro: Timestamp.now(),
      },
      status_recrutamento:
        aprovado === "Sim"
          ? "Entrevista Gestor Aprovada - Comunicação Final (Aprovado - Próximo: Contratar)"
          : "Rejeitado - Comunicação Pendente (Reprovado - Próximo: enviar mensagem)",
      ultima_atualizacao: Timestamp.now(),
    };

    if (aprovado === "Não" && motivo) {
      updateData.rejeicao = {
        etapa: "Entrevista com Gestor",
        motivo: motivo,
        data: Timestamp.now(),
      };
    }

    await updateDoc(docRef, updateData);

    window.showToast?.("Avaliação salva com sucesso!", "success");
    modal.classList.remove("is-visible");
    renderizarEntrevistaGestor(state);
  } catch (error) {
    console.error("Erro ao salvar:", error);
    window.showToast?.("Erro ao salvar avaliação: " + error.message, "error");
  }
}
