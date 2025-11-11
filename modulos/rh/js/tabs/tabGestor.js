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
    formatarTimestamp,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <div class="alerta alerta-aviso">
        <p>Nenhuma vaga selecionada.</p>
      </div>`;
    return;
  }

  conteudoRecrutamento.innerHTML = `
    <div class="alerta alerta-info">
      <p>Carregando candidatos da Entrevista com Gestor...</p>
    </div>`;

  try {
    // ⚠️ CORRIGIDO: Usando status_recrutamento em vez de status_candidatura
    const q = query(
      candidatosCollection,
      where("vagaId", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "Entrevista Gestor Pendente")
    );

    const snapshot = await getDocs(q);

    // Atualiza a contagem na aba
    const tab = statusCandidaturaTabs?.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <div class="alerta alerta-aviso">
          <p>Nenhum candidato na fase de Entrevista com Gestor.</p>
        </div>`;
      return;
    }

    let listaHtml = `
      <div class="lista-candidatos-container">
        <h3>Candidatos - Entrevista com Gestor</h3>
        <p class="subtitulo">Etapa: Entrevista com Gestor</p>
        <table class="tabela-candidatos">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Data da Candidatura</th>
              <th>Status Atual</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>`;

    snapshot.docs.forEach((docSnap) => {
      const candidato = docSnap.data();
      const candidatoId = docSnap.id;
      const nome = candidato.nome_completo || "Nome não informado";
      const dataCandidatura = formatarTimestamp(candidato.data_candidatura);
      const statusAtual =
        candidato.status_recrutamento || "Status desconhecido";

      listaHtml += `
        <tr>
          <td>${nome}</td>
          <td>${dataCandidatura}</td>
          <td><span class="badge badge-info">${statusAtual}</span></td>
          <td class="acoes-cell">
            <button 
              class="btn-acao btn-detalhes-gestor" 
              data-candidato-id="${candidatoId}"
              title="Ver Detalhes">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Detalhes
            </button>
            <button 
              class="btn-acao btn-avaliar-gestor" 
              data-candidato-id="${candidatoId}"
              title="Avaliar Candidato">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Avaliar Gestor
            </button>
          </td>
        </tr>`;
    });

    listaHtml += `
          </tbody>
        </table>
      </div>`;

    conteudoRecrutamento.innerHTML = listaHtml;

    // Adiciona event listeners aos botões
    adicionarEventListenersGestor(state);
  } catch (error) {
    console.error("❌ Erro ao carregar candidatos (Gestor):", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alerta alerta-erro">
        <p>Erro ao carregar a lista de candidatos: ${error.message}</p>
      </div>`;
  }
}

/**
 * Adiciona event listeners aos botões de ação
 */
function adicionarEventListenersGestor(state) {
  // Botões "Detalhes"
  document.querySelectorAll(".btn-detalhes-gestor").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      await abrirModalDetalhesGestor(candidatoId, state);
    });
  });

  // Botões "Avaliar Gestor"
  document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      await abrirModalAvaliacaoGestor(candidatoId, state);
    });
  });
}

/**
 * Abre modal com detalhes do candidato
 */
async function abrirModalDetalhesGestor(candidatoId, state) {
  const { candidatosCollection, formatarTimestamp } = state;

  // Busca dados do candidato
  const docRef = doc(candidatosCollection, candidatoId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    window.showToast?.("Candidato não encontrado", "error");
    return;
  }

  const candidato = docSnap.data();

  // Cria/atualiza modal
  let modal = document.getElementById("modal-gestor-detalhes");
  if (!modal) {
    modal = criarModalDetalhesGestor();
  }

  // Preenche conteúdo
  const modalBody = modal.querySelector(".modal-body");
  modalBody.innerHTML = `
    <div class="candidato-info-section">
      <h4>Informações Básicas</h4>
      <p><strong>Nome:</strong> ${candidato.nome_completo || "N/A"}</p>
      <p><strong>Email:</strong> ${candidato.email || "N/A"}</p>
      <p><strong>Telefone:</strong> ${
        candidato.telefone || candidato.telefonecontato || "N/A"
      }</p>
      <p><strong>Data da Candidatura:</strong> ${formatarTimestamp(
        candidato.data_candidatura
      )}</p>
    </div>

    <div class="candidato-info-section">
      <h4>Triagem RH</h4>
      ${
        candidato.triagem_rh
          ? `
        <p><strong>Apto para Entrevista:</strong> ${
          candidato.triagem_rh.apto_entrevista || "N/A"
        }</p>
        <p><strong>Observações:</strong> ${
          candidato.triagem_rh.observacoes ||
          candidato.triagem_rh.info_aprovacao ||
          "N/A"
        }</p>
      `
          : "<p>Triagem não realizada.</p>"
      }
    </div>

    <div class="candidato-info-section">
      <h4>Entrevista RH</h4>
      ${
        candidato.entrevista_rh
          ? `
        <p><strong>Aprovado:</strong> ${
          candidato.entrevista_rh.aprovado || "N/A"
        }</p>
        <p><strong>Pontos Fortes:</strong> ${
          candidato.entrevista_rh.pontos_fortes || "N/A"
        }</p>
        <p><strong>Pontos de Atenção:</strong> ${
          candidato.entrevista_rh.pontos_atencao || "N/A"
        }</p>
      `
          : "<p>Entrevista RH não realizada.</p>"
      }
    </div>

    <div class="candidato-info-section">
      <h4>Testes/Estudos de Caso</h4>
      ${
        candidato.testes_estudos?.status_resultado
          ? `
        <p><strong>Status:</strong> ${
          candidato.testes_estudos.status_resultado
        }</p>
        <p><strong>Observações:</strong> ${
          candidato.testes_estudos.observacoes || "N/A"
        }</p>
      `
          : "<p>Testes não realizados.</p>"
      }
    </div>
  `;

  // Exibe modal
  modal.classList.add("is-visible");
}

/**
 * Abre modal para avaliação do gestor
 */
async function abrirModalAvaliacaoGestor(candidatoId, state) {
  const { candidatosCollection, formatarTimestamp, vagaSelecionadaId } = state;

  // Busca dados do candidato
  const docRef = doc(candidatosCollection, candidatoId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    window.showToast?.("Candidato não encontrado", "error");
    return;
  }

  const candidato = docSnap.data();

  // Cria/atualiza modal
  let modal = document.getElementById("modal-gestor-avaliacao");
  if (!modal) {
    modal = criarModalAvaliacaoGestor();
  }

  // Preenche conteúdo
  const modalBody = modal.querySelector(".modal-body");
  modalBody.innerHTML = `
    <div class="candidato-info-resumo">
      <h4>${candidato.nome_completo || "Candidato"}</h4>
      <p><strong>Email:</strong> ${candidato.email || "N/A"}</p>
      <p><strong>Telefone:</strong> ${
        candidato.telefone || candidato.telefonecontato || "N/A"
      }</p>
    </div>

    <form id="form-avaliacao-gestor-popup">
      <div class="form-group">
        <label>O gestor aprovou o candidato?</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="aprovado_gestor" value="Sim" required>
            Sim - Aprovar para contratação
          </label>
          <label>
            <input type="radio" name="aprovado_gestor" value="Não" required>
            Não - Reprovar candidato
          </label>
        </div>
      </div>

      <div class="form-group" id="motivo-rejeicao-gestor" style="display: none;">
        <label for="motivo-rejeicao-text">Motivo da Reprovação:</label>
        <textarea 
          id="motivo-rejeicao-text" 
          name="motivo_rejeicao"
          rows="3"
          placeholder="Descreva o motivo da reprovação..."></textarea>
      </div>

      <div class="form-group">
        <label for="nome-gestor">Nome do Gestor:</label>
        <input 
          type="text" 
          id="nome-gestor" 
          name="nome_gestor"
          placeholder="Nome do gestor que avaliou"
          required>
      </div>

      <div class="form-group">
        <label for="observacoes-gestor">Comentários da Entrevista:</label>
        <textarea 
          id="observacoes-gestor" 
          name="observacoes_gestor"
          rows="4"
          placeholder="Comentários sobre o candidato..."></textarea>
      </div>

      <div class="form-group">
        <label for="data-entrevista-gestor">Data da Entrevista:</label>
        <input 
          type="date" 
          id="data-entrevista-gestor" 
          name="data_entrevista_gestor"
          required>
      </div>
    </form>
  `;

  // Event listener para mostrar/ocultar campo de motivo
  const radios = modalBody.querySelectorAll('input[name="aprovado_gestor"]');
  const motivoContainer = modalBody.querySelector("#motivo-rejeicao-gestor");

  radios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "Não") {
        motivoContainer.style.display = "block";
      } else {
        motivoContainer.style.display = "none";
      }
    });
  });

  // Configura botão de salvar
  const btnSalvar = modal.querySelector(".btn-salvar-avaliacao");
  btnSalvar.onclick = async () => {
    await salvarAvaliacaoGestor(candidatoId, state, modal);
  };

  // Exibe modal
  modal.classList.add("is-visible");
}

/**
 * Salva a avaliação do gestor no Firestore
 */
async function salvarAvaliacaoGestor(candidatoId, state, modal) {
  const { candidatosCollection } = state;
  const form = modal.querySelector("#form-avaliacao-gestor-popup");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const aprovado = formData.get("aprovado_gestor");
  const motivoRejeicao = formData.get("motivo_rejeicao");
  const observacoes = formData.get("observacoes_gestor");
  const nomeGestor = formData.get("nome_gestor");
  const dataEntrevista = formData.get("data_entrevista_gestor");

  try {
    const docRef = doc(candidatosCollection, candidatoId);

    // ⚠️ CORRIGIDO: Usando status_recrutamento em vez de status_candidatura
    const updateData = {
      entrevista_gestor: {
        aprovado: aprovado,
        nome_gestor: nomeGestor,
        comentarios_gestor: observacoes || "",
        data_entrevista: dataEntrevista,
        data_registro: Timestamp.now(),
      },
      status_recrutamento:
        aprovado === "Sim"
          ? "Entrevista Gestor Aprovada - Comunicação Final (Aprovado - Próximo: Contratar)"
          : "Rejeitado - Comunicação Pendente (Reprovado - Próximo: enviar mensagem)",
      ultima_atualizacao: Timestamp.now(),
    };

    if (aprovado === "Não" && motivoRejeicao) {
      updateData.rejeicao = {
        etapa: "Entrevista com Gestor",
        motivo: motivoRejeicao,
        justificativa: `Reprovado pelo Gestor. Motivo: ${motivoRejeicao}`,
        data: Timestamp.now(),
      };
    }

    await updateDoc(docRef, updateData);

    window.showToast?.("Avaliação registrada com sucesso!", "success");
    modal.classList.remove("is-visible");

    // Recarrega a lista
    renderizarEntrevistaGestor(state);
  } catch (error) {
    console.error("❌ Erro ao salvar avaliação:", error);
    window.showToast?.("Erro ao salvar avaliação: " + error.message, "error");
  }
}

/**
 * Cria modal de detalhes (se não existir)
 */
function criarModalDetalhesGestor() {
  const modal = document.createElement("div");
  modal.id = "modal-gestor-detalhes";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3>Detalhes do Candidato</h3>
        <button class="close-modal-btn" aria-label="Fechar">×</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn-secundario close-modal-btn">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners para fechar
  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.classList.remove("is-visible");
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("is-visible");
    }
  });

  return modal;
}

/**
 * Cria modal de avaliação (se não existir)
 */
function criarModalAvaliacaoGestor() {
  const modal = document.createElement("div");
  modal.id = "modal-gestor-avaliacao";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3>Avaliar Candidato - Entrevista com Gestor</h3>
        <button class="close-modal-btn" aria-label="Fechar">×</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn-secundario close-modal-btn">Cancelar</button>
        <button class="btn-primario btn-salvar-avaliacao">Salvar Avaliação</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners para fechar
  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.classList.remove("is-visible");
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("is-visible");
    }
  });

  return modal;
}
