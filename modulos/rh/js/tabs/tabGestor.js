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
  console.log("🔵 [GESTOR] === INÍCIO renderizarEntrevistaGestor ===");
  console.log("🔵 [GESTOR] State recebido:", state);

  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  console.log("🔵 [GESTOR] vagaSelecionadaId:", vagaSelecionadaId);
  console.log("🔵 [GESTOR] conteudoRecrutamento:", conteudoRecrutamento);
  console.log("🔵 [GESTOR] candidatosCollection:", candidatosCollection);

  if (!vagaSelecionadaId) {
    console.log("❌ [GESTOR] Nenhuma vaga selecionada");
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-info">Nenhuma vaga selecionada.</p>`;
    return;
  }

  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">Carregando candidatos para Entrevista com Gestor...</div>`;

  try {
    console.log("🔵 [GESTOR] Iniciando query no Firestore...");
    console.log("🔵 [GESTOR] Parâmetros da query:");
    console.log("  - vagaid:", vagaSelecionadaId);
    console.log('  - status_recrutamento: "Entrevista Gestor Pendente"');

    // TENTATIVA 1: Com vagaid (minúsculo)
    let q = query(
      candidatosCollection,
      where("vagaid", "==", vagaSelecionadaId),
      where("status_recrutamento", "==", "Entrevista Gestor Pendente")
    );

    console.log("🔵 [GESTOR] Query criada (tentativa 1 - vagaid)");
    let snapshot = await getDocs(q);
    console.log(
      "🔵 [GESTOR] Resultado query 1 - Total de documentos:",
      snapshot.size
    );

    // Se não encontrou nada, tenta com vagaId (camelCase)
    if (snapshot.empty) {
      console.log(
        '⚠️ [GESTOR] Query 1 vazia. Tentando com "vagaId" (camelCase)...'
      );
      q = query(
        candidatosCollection,
        where("vagaId", "==", vagaSelecionadaId),
        where("status_recrutamento", "==", "Entrevista Gestor Pendente")
      );
      snapshot = await getDocs(q);
      console.log(
        "🔵 [GESTOR] Resultado query 2 - Total de documentos:",
        snapshot.size
      );
    }

    // Se ainda está vazio, busca TODOS da vaga para debug
    if (snapshot.empty) {
      console.log(
        "⚠️ [GESTOR] Query 2 vazia. Buscando TODOS os candidatos da vaga para debug..."
      );

      // Tenta com vagaid
      let qDebug = query(
        candidatosCollection,
        where("vagaid", "==", vagaSelecionadaId)
      );
      let snapshotDebug = await getDocs(qDebug);

      if (snapshotDebug.empty) {
        console.log(
          "⚠️ [GESTOR] Nenhum candidato com vagaid. Tentando vagaId..."
        );
        qDebug = query(
          candidatosCollection,
          where("vagaId", "==", vagaSelecionadaId)
        );
        snapshotDebug = await getDocs(qDebug);
      }

      console.log(
        "🔍 [GESTOR DEBUG] Total de candidatos encontrados na vaga:",
        snapshotDebug.size
      );

      snapshotDebug.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`🔍 [GESTOR DEBUG] Candidato ${index + 1}:`, {
          id: doc.id,
          nome: data.nome_completo,
          status_recrutamento: data.status_recrutamento,
          vagaId: data.vagaId,
          vagaid: data.vagaid,
        });
      });

      // Filtra localmente
      const candidatosFiltrados = snapshotDebug.docs.filter((doc) => {
        const status = doc.data().status_recrutamento || "";
        const contemPendente = status.includes("Entrevista Gestor Pendente");
        console.log(
          `🔍 [GESTOR FILTRO] ${doc.data().nome_completo}: "${status}" -> ${
            contemPendente ? "✅ MATCH" : "❌ NÃO"
          }`
        );
        return contemPendente;
      });

      console.log(
        "🔍 [GESTOR DEBUG] Candidatos filtrados localmente:",
        candidatosFiltrados.length
      );

      if (candidatosFiltrados.length > 0) {
        // Usa os candidatos filtrados
        snapshot = {
          docs: candidatosFiltrados,
          size: candidatosFiltrados.length,
          empty: false,
        };
        console.log("✅ [GESTOR] Usando candidatos filtrados localmente");
      }
    }

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs?.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    console.log("🔵 [GESTOR] Tab encontrada:", tab);
    if (tab) {
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
      console.log("✅ [GESTOR] Contagem da aba atualizada:", snapshot.size);
    }

    if (snapshot.empty) {
      console.log(
        "❌ [GESTOR] Nenhum candidato encontrado (após todas as tentativas)"
      );
      conteudoRecrutamento.innerHTML = `
        <p class="alert alert-warning">Nenhuma candidato na fase de Entrevista com Gestor.</p>`;
      return;
    }

    console.log("✅ [GESTOR] Montando HTML com", snapshot.size, "candidatos");

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

    snapshot.docs.forEach((docSnap, index) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const nome = cand.nome_completo || "N/A";
      const statusAtual = cand.status_recrutamento || "N/A";

      console.log(`🔵 [GESTOR] Processando candidato ${index + 1}:`, {
        id: candidatoId,
        nome,
        status: statusAtual,
      });

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
    console.log("✅ [GESTOR] HTML inserido no DOM");

    // Adiciona event listeners
    adicionarEventListeners(state);
    console.log("✅ [GESTOR] Event listeners adicionados");
    console.log("🔵 [GESTOR] === FIM renderizarEntrevistaGestor ===");
  } catch (error) {
    console.error("❌ [GESTOR] ERRO:", error);
    console.error("❌ [GESTOR] Stack trace:", error.stack);
    conteudoRecrutamento.innerHTML = `
      <p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

/**
 * Adiciona event listeners aos botões
 */
function adicionarEventListeners(state) {
  console.log("🔵 [GESTOR] Adicionando event listeners...");

  // Botões Detalhes
  const btnsDetalhes = document.querySelectorAll(".btn-detalhes-gestor");
  console.log(
    '🔵 [GESTOR] Botões "Detalhes" encontrados:',
    btnsDetalhes.length
  );
  btnsDetalhes.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      console.log("🔵 [GESTOR] Clique em Detalhes - candidatoId:", candidatoId);
      await abrirModalDetalhes(candidatoId, state);
    });
  });

  // Botões Avaliar
  const btnsAvaliar = document.querySelectorAll(".btn-avaliar-gestor");
  console.log('🔵 [GESTOR] Botões "Avaliar" encontrados:', btnsAvaliar.length);
  btnsAvaliar.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-candidato-id");
      console.log("🔵 [GESTOR] Clique em Avaliar - candidatoId:", candidatoId);
      await abrirModalAvaliacao(candidatoId, state);
    });
  });
}

/**
 * Modal de Detalhes
 */
async function abrirModalDetalhes(candidatoId, state) {
  console.log("🔵 [GESTOR] Abrindo modal de detalhes para:", candidatoId);
  const { candidatosCollection } = state;

  try {
    const docRef = doc(candidatosCollection, candidatoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log("❌ [GESTOR] Candidato não encontrado");
      alert("Candidato não encontrado");
      return;
    }

    const candidato = docSnap.data();
    console.log("✅ [GESTOR] Dados do candidato carregados:", candidato);

    let modal = document.getElementById("modal-gestor-detalhes");
    if (!modal) {
      console.log("🔵 [GESTOR] Criando modal de detalhes...");
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
    console.log("✅ [GESTOR] Modal de detalhes exibido");
  } catch (error) {
    console.error("❌ [GESTOR] Erro ao abrir detalhes:", error);
    alert("Erro ao carregar detalhes");
  }
}

/**
 * Modal de Avaliação
 */
async function abrirModalAvaliacao(candidatoId, state) {
  console.log("🔵 [GESTOR] Abrindo modal de avaliação para:", candidatoId);
  const { candidatosCollection } = state;

  try {
    const docRef = doc(candidatosCollection, candidatoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log("❌ [GESTOR] Candidato não encontrado");
      alert("Candidato não encontrado");
      return;
    }

    const candidato = docSnap.data();
    console.log("✅ [GESTOR] Dados do candidato carregados:", candidato);

    let modal = document.getElementById("modal-gestor-avaliacao");
    if (!modal) {
      console.log("🔵 [GESTOR] Criando modal de avaliação...");
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

    // Toggle motivo reprovação
    const radios = modalBody.querySelectorAll('input[name="aprovado"]');
    const motivoDiv = modalBody.querySelector("#motivo-reprovacao");
    radios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        motivoDiv.style.display = e.target.value === "Não" ? "block" : "none";
      });
    });

    // Botão salvar
    const btnSalvar = modal.querySelector(".btn-salvar");
    btnSalvar.onclick = () => salvarAvaliacao(candidatoId, state, modal);

    modal.style.display = "block";
    console.log("✅ [GESTOR] Modal de avaliação exibido");
  } catch (error) {
    console.error("❌ [GESTOR] Erro ao abrir modal:", error);
    alert("Erro ao abrir avaliação");
  }
}

/**
 * Salvar Avaliação
 */
async function salvarAvaliacao(candidatoId, state, modal) {
  console.log("🔵 [GESTOR] Salvando avaliação para:", candidatoId);
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

  console.log("🔵 [GESTOR] Dados do formulário:", {
    aprovado,
    nomeGestor,
    comentarios,
    dataEntrevista,
    motivo,
  });

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

    console.log("🔵 [GESTOR] Dados para atualizar no Firestore:", updateData);
    await updateDoc(docRef, updateData);

    console.log("✅ [GESTOR] Avaliação salva com sucesso!");
    alert("Avaliação salva com sucesso!");
    modal.style.display = "none";
    renderizarEntrevistaGestor(state);
  } catch (error) {
    console.error("❌ [GESTOR] Erro ao salvar:", error);
    alert("Erro ao salvar avaliação: " + error.message);
  }
}

/**
 * Criar Modal Detalhes
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
 * Criar Modal Avaliação
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
