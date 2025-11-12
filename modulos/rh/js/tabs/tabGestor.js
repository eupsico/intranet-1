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
    // ⚠️ QUERY ORIGINAL - NÃO MODIFICADA
    const q = query(
      candidatosCollection,
      where("vagaid", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "Entrevista Gestor Pendente")
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
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

    // ⚠️ HTML ORIGINAL - NÃO MODIFICADO
    let listaHtml = `
      <h3>Candidatos - Entrevista com Gestor</h3>
      <p><strong>Descrição:</strong> Avaliação final antes da comunicação e contratação.</p>
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Etapa</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>`;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const candidatoId = doc.id;
      const nome = cand.nome_completo || "N/A";
      const statusAtual = cand.status_recrutamento || "N/A";

      listaHtml += `
        <tr>
          <td>${nome}</td>
          <td><span class="badge badge-warning">${statusAtual}</span></td>
          <td>Entrevista com Gestor</td>
          <td>
            <button 
              class="btn btn-info btn-sm btn-detalhes-gestor" 
              data-candidato-id="${candidatoId}">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            <button 
              class="btn btn-primary btn-sm btn-avaliar-gestor" 
              data-candidato-id="${candidatoId}">
              <i class="fas fa-edit"></i> Avaliar Gestor
            </button>
          </td>
        </tr>`;
    });

    listaHtml += `
        </tbody>
      </table>`;

    conteudoRecrutamento.innerHTML = listaHtml;

    // ✅ ÚNICA ADIÇÃO: Event listeners para os modals
    adicionarEventListeners(state);
  } catch (error) {
    console.error("Erro ao carregar candidatos (Gestor):", error);
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

/**
 * ✅ NOVA FUNÇÃO: Adiciona event listeners
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
 * ✅ NOVA FUNÇÃO: Modal de Detalhes
 */
async function abrirModalDetalhes(candidatoId, state) {
  const { candidatosCollection } = state;

  try {
    const docRef = doc(candidatosCollection, candidatoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("Candidato não encontrado");
      return;
    }

    const candidato = docSnap.data();

    let modal = document.getElementById("modal-gestor-detalhes");
    if (!modal) {
      modal = criarModalDetalhes();
    }

    const modalBody = modal.querySelector(".modal-body");
    modalBody.innerHTML = `
      <h5>Informações do Candidato</h5>
      <p><strong>Nome:</strong> ${candidato.nome_completo || "N/A"}</p>
      <p><strong>Email:</strong> ${candidato.email || "N/A"}</p>
      <p><strong>Telefone:</strong> ${
        candidato.telefone || candidato.telefonecontato || "N/A"
      }</p>
      
      <hr>
      
      <h5>Triagem RH</h5>
      ${
        candidato.triagem_rh
          ? `
        <p><strong>Apto:</strong> ${
          candidato.triagem_rh.apto_entrevista || "N/A"
        }</p>
        <p><strong>Obs:</strong> ${
          candidato.triagem_rh.observacoes || "N/A"
        }</p>
      `
          : "<p>Não realizada</p>"
      }
      
      <hr>
      
      <h5>Entrevista RH</h5>
      ${
        candidato.entrevista_rh
          ? `
        <p><strong>Aprovado:</strong> ${
          candidato.entrevista_rh.aprovado || "N/A"
        }</p>
        <p><strong>Pontos Fortes:</strong> ${
          candidato.entrevista_rh.pontos_fortes || "N/A"
        }</p>
      `
          : "<p>Não realizada</p>"
      }
      
      <hr>
      
      <h5>Testes/Estudos</h5>
      ${
        candidato.testes_estudos
          ? `
        <p><strong>Status:</strong> ${
          candidato.testes_estudos.status_resultado || "N/A"
        }</p>
      `
          : "<p>Não realizados</p>"
      }
    `;

    modal.style.display = "block";
  } catch (error) {
    console.error("Erro ao abrir detalhes:", error);
    alert("Erro ao carregar detalhes");
  }
}

/**
 * ✅ NOVA FUNÇÃO: Modal de Avaliação
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

    let modal = document.getElementById("modal-gestor-avaliacao");
    if (!modal) {
      modal = criarModalAvaliacao();
    }

    const modalBody = modal.querySelector(".modal-body");
    modalBody.innerHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h5>${candidato.nome_completo || "Candidato"}</h5>
        <p><strong>Email:</strong> ${candidato.email || "N/A"}</p>
      </div>

      <form id="form-avaliacao-gestor">
        <div class="form-group">
          <label><strong>O gestor aprovou o candidato?</strong></label>
          <div>
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

    const radios = modalBody.querySelectorAll('input[name="aprovado"]');
    const motivoDiv = modalBody.querySelector("#motivo-reprovacao");
    radios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        motivoDiv.style.display = e.target.value === "Não" ? "block" : "none";
      });
    });

    const btnSalvar = modal.querySelector(".btn-salvar");
    btnSalvar.onclick = () => salvarAvaliacao(candidatoId, state, modal);

    modal.style.display = "block";
  } catch (error) {
    console.error("Erro ao abrir modal:", error);
    alert("Erro ao abrir avaliação");
  }
}

/**
 * ✅ NOVA FUNÇÃO: Salvar Avaliação
 */
async function salvarAvaliacao(candidatoId, state, modal) {
  const { candidatosCollection } = state;
  const form = modal.querySelector("#form-avaliacao-gestor");

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

    alert("Avaliação salva com sucesso!");
    modal.style.display = "none";
    renderizarEntrevistaGestor(state);
  } catch (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao salvar avaliação: " + error.message);
  }
}

/**
 * ✅ NOVA FUNÇÃO: Criar Modal Detalhes
 */
function criarModalDetalhes() {
  const modal = document.createElement("div");
  modal.id = "modal-gestor-detalhes";
  modal.style.cssText =
    "display:none;position:fixed;z-index:9999;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);";
  modal.innerHTML = `
    <div style="background:white;margin:5% auto;padding:20px;width:80%;max-width:600px;border-radius:8px;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h4>Detalhes do Candidato</h4>
        <button class="btn-fechar" style="background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
      </div>
      <div class="modal-body"></div>
      <div style="margin-top:20px;text-align:right;">
        <button class="btn btn-secondary btn-fechar">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll(".btn-fechar").forEach((btn) => {
    btn.onclick = () => (modal.style.display = "none");
  });

  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  return modal;
}

/**
 * ✅ NOVA FUNÇÃO: Criar Modal Avaliação
 */
function criarModalAvaliacao() {
  const modal = document.createElement("div");
  modal.id = "modal-gestor-avaliacao";
  modal.style.cssText =
    "display:none;position:fixed;z-index:9999;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);";
  modal.innerHTML = `
    <div style="background:white;margin:5% auto;padding:20px;width:80%;max-width:600px;border-radius:8px;max-height:80vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h4>Avaliar Candidato - Entrevista com Gestor</h4>
        <button class="btn-fechar" style="background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
      </div>
      <div class="modal-body"></div>
      <div style="margin-top:20px;text-align:right;">
        <button class="btn btn-secondary btn-fechar" style="margin-right:10px;">Cancelar</button>
        <button class="btn btn-success btn-salvar">Salvar Avaliação</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll(".btn-fechar").forEach((btn) => {
    btn.onclick = () => (modal.style.display = "none");
  });

  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };

  return modal;
}
