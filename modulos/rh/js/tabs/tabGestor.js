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
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Funções locais para evitar conflitos de namespace.
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
      <div class="alert alert-info">
        <p><i class="fas fa-info-circle"></i> Nenhuma vaga selecionada.</p>
      </div>
    `;
    return;
  }

  // Loading spinner
  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    // Query Firestore - AJUSTE OS STATUS CONFORME SEU FIRESTORE
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        // SUBSTITUA POR STATUS REAIS DO SEU FIRESTORE
        "Testes Aprovado",
        "Entrevista Gestor Pendente",
        "Entrevista Gestor Agendada",
        "Aguardando Avaliação Gestor",
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
      conteudoRecrutamento.innerHTML = `
        <div class="alert alert-warning">
          <p><i class="fas fa-exclamation-triangle"></i> Nenhuma candidatura na fase de Entrevista com Gestor.</p>
        </div>
      `;
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
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;
      const vagaId = vagaSelecionadaId;

      let statusClass = "status-info";
      if (
        statusAtual.toLowerCase().includes("pendente") ||
        statusAtual.toLowerCase().includes("aguardando")
      ) {
        statusClass = "status-warning";
      } else if (
        statusAtual.toLowerCase().includes("aprovado") ||
        statusAtual.toLowerCase().includes("concluída")
      ) {
        statusClass = "status-success";
      }

      // Dados encoded para modal
      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo,
        email_candidato: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_id: vagaId,
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-gestor">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Candidato Sem Nome"}
              <span class="status-badge ${statusClass}">
                <i class="fas fa-tag"></i> ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor
            </p>
          </div>

          <div class="info-contato">
            ${
              cand.email_candidato
                ? `<p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>`
                : ""
            }
            ${
              cand.telefone_contato
                ? `<p><i class="fas fa-phone"></i> ${cand.telefone_contato}</p>`
                : ""
            }
          </div>

          <div class="acoes-candidato">
            <button class="action-button primary btn-avaliar-gestor"
                    data-id="${candidaturaId}"
                    data-vaga="${vagaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 140px;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>

            <button class="action-button secondary btn-ver-detalhes"
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 100px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>

            <button class="action-button info btn-agendar-rh"
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 140px;">
              <i class="fas fa-calendar-alt"></i> Agendar Reunião
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;

    // Event listeners para todos os botões
    anexarEventListenersGestor();
  } catch (error) {
    console.error("❌ Gestor: Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger">
        <p><i class="fas fa-exclamation-circle"></i> Erro: ${error.message}</p>
      </div>
    `;
  }
}

// Função local para anexar event listeners
function anexarEventListenersGestor() {
  console.log("🔗 Gestor: Anexando event listeners...");

  // Botão Avaliar Gestor
  document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const candidatoId = btn.getAttribute("data-id");
      const vagaId = btn.getAttribute("data-vaga");
      const dadosCodificados = btn.getAttribute("data-dados");

      console.log(`🔹 Avaliar Gestor clicado - ID: ${candidatoId}`);

      // Chama função local
      abrirModalAvaliacaoGestorLocal(candidatoId, vagaId, dadosCodificados);
    });
  });

  // Botão Detalhes
  document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const candidatoId = btn.getAttribute("data-id");
      const dadosCodificados = btn.getAttribute("data-dados");

      console.log(`🔹 Detalhes clicado - ID: ${candidatoId}`);

      // Chama função local
      abrirModalDetalhesGestorLocal(candidatoId, dadosCodificados);
    });
  });

  // Botão Agendar Reunião
  document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const candidatoId = btn.getAttribute("data-id");
      const dadosCodificados = btn.getAttribute("data-dados");

      console.log(`📅 Agendar Reunião clicado - ID: ${candidatoId}`);

      // Chama função global se existir, senão local
      if (window.abrirModalAgendamentoRH) {
        const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
        window.abrirModalAgendamentoRH(candidatoId, dadosCandidato);
      } else {
        abrirModalAgendamentoGestorLocal(candidatoId, dadosCodificados);
      }
    });
  });
}

// Modal Avaliação Gestor Local
function abrirModalAvaliacaoGestorLocal(candidatoId, vagaId, dadosCodificados) {
  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    const agora = new Date();
    const user = getGlobalState()?.usuarioAtual;

    // Remove modal anterior se existir
    const modalExistente = document.getElementById("modal-gestor-local");
    if (modalExistente) {
      modalExistente.remove();
    }

    // Cria modal com estilos inline garantidos
    const modal = document.createElement("div");
    modal.id = "modal-gestor-local";
    modal.innerHTML = `
      <style>
        #modal-gestor-local {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: rgba(0, 0, 0, 0.7) !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          padding: 20px !important;
          box-sizing: border-box !important;
        }
        
        #modal-gestor-local .modal-container {
          position: relative !important;
          z-index: 1000000 !important;
          width: 100% !important;
          max-width: 600px !important;
          max-height: 90vh !important;
          background: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25) !important;
          overflow: hidden !important;
          animation: modalSlideIn 0.3s ease-out !important;
        }
        
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(30px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        #modal-gestor-local .modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          padding: 20px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }
        
        #modal-gestor-local .modal-title {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          margin: 0 !important;
        }
        
        #modal-gestor-local .modal-close {
          background: rgba(255,255,255,0.2) !important;
          border: none !important;
          color: white !important;
          width: 32px !important;
          height: 32px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 16px !important;
        }
        
        #modal-gestor-local .modal-body {
          padding: 25px !important;
          max-height: 500px !important;
          overflow-y: auto !important;
          background: #f8f9fa !important;
        }
        
        #modal-gestor-local .info-section {
          background: white !important;
          padding: 20px !important;
          border-radius: 8px !important;
          margin-bottom: 25px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08) !important;
          border-left: 4px solid #667eea !important;
        }
        
        #modal-gestor-local .form-group {
          margin-bottom: 20px !important;
        }
        
        #modal-gestor-local .form-label {
          font-weight: 600 !important;
          margin-bottom: 8px !important;
          display: block !important;
          color: #333 !important;
        }
        
        #modal-gestor-local .form-textarea {
          width: 100% !important;
          min-height: 120px !important;
          padding: 12px !important;
          border: 1px solid #ddd !important;
          border-radius: 6px !important;
          font-family: inherit !important;
          resize: vertical !important;
          box-sizing: border-box !important;
        }
        
        #modal-gestor-local .resultado-options {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }
        
        #modal-gestor-local .resultado-option {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          cursor: pointer !important;
          padding: 12px !important;
          border: 1px solid #e9ecef !important;
          border-radius: 8px !important;
          transition: all 0.2s !important;
        }
        
        #modal-gestor-local .resultado-option:hover {
          border-color: #667eea !important;
          background: #f8f9ff !important;
        }
        
        #modal-gestor-local .modal-footer {
          padding: 20px !important;
          background: white !important;
          border-top: 1px solid #eee !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
        
        #modal-gestor-local .btn-local {
          padding: 12px 24px !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          transition: all 0.2s !important;
        }
        
        #modal-gestor-local .btn-primary-local {
          background: #667eea !important;
          color: white !important;
        }
        
        #modal-gestor-local .btn-secondary-local {
          background: #6c757d !important;
          color: white !important;
        }
        
        @media (max-width: 768px) {
          #modal-gestor-local .modal-container {
            width: 95% !important;
            max-height: 95vh !important;
            margin: 0 !important;
          }
          
          #modal-gestor-local .modal-body {
            padding: 15px !important;
            max-height: 400px !important;
          }
          
          #modal-gestor-local .modal-footer {
            padding: 15px !important;
            flex-direction: column-reverse !important;
          }
          
          #modal-gestor-local .btn-local {
            width: 100% !important;
          }
        }
      </style>

      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-user-tie"></i>
            <h3>Avaliação Final - Gestor</h3>
          </div>
          <button class="modal-close" onclick="GestorModals.fecharModalLocal('avaliacao')">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="info-section">
            <h4><i class="fas fa-user-circle"></i> ${
              dadosCandidato.nome_completo || "N/A"
            }</h4>
            <p><i class="fas fa-envelope"></i> ${
              dadosCandidato.email_candidato || "N/A"
            }</p>
            <p><i class="fas fa-phone"></i> ${
              dadosCandidato.telefone_contato || "N/A"
            }</p>
            <p><i class="fas fa-briefcase"></i> Vaga ID: ${vagaId}</p>
          </div>

          <form id="form-avaliacao-gestor-local">
            <div class="form-group">
              <label class="form-label">Observações da Avaliação</label>
              <textarea class="form-textarea" name="observacoes" 
                        placeholder="Avalie o candidato com detalhes. Inclua pontos fortes, áreas de melhoria, fit cultural..." 
                        required></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Resultado</label>
              <div class="resultado-options">
                <label class="resultado-option" onclick="GestorModals.selecionarResultado('aprovado')">
                  <input type="radio" name="resultado-local" value="aprovado">
                  <i class="fas fa-check-circle"></i>
                  <span>Aprovado para Contratação</span>
                </label>
                <label class="resultado-option" onclick="GestorModals.selecionarResultado('rejeitado')">
                  <input type="radio" name="resultado-local" value="rejeitado">
                  <i class="fas fa-times-circle"></i>
                  <span>Não Selecionado</span>
                </label>
                <label class="resultado-option" onclick="GestorModals.selecionarResultado('pendente')">
                  <input type="radio" name="resultado-local" value="pendente">
                  <i class="fas fa-clock"></i>
                  <span>Avaliação Pendente</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary-local btn-local" onclick="GestorModals.fecharModalLocal('avaliacao')">
            Cancelar
          </button>
          <button class="btn-primary-local btn-local" onclick="GestorModals.salvarAvaliacaoLocal('${candidaturaId}', '${vagaId}')" 
                  id="btn-salvar-local">
            Salvar Avaliação
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Foco no textarea
    const textarea = modal.querySelector("textarea");
    if (textarea) {
      textarea.focus();
    }
  } catch (error) {
    console.error("❌ Erro ao abrir modal de avaliação:", error);
    alert("Erro ao abrir modal de avaliação");
  }
}

// Modal Detalhes Local
function abrirModalDetalhesGestorLocal(candidatoId, dadosCodificados) {
  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById(
      "modal-detalhes-gestor-local"
    );
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-detalhes-gestor-local";

    // HTML simplificado para detalhes
    modal.innerHTML = `
      <div class="modal-container">
        <div class="modal-header">
          <h3>Detalhes do Candidato</h3>
          <button onclick="GestorModals.fecharModalLocal('detalhes')">×</button>
        </div>

        <div class="modal-body">
          <p><strong>Nome:</strong> ${dadosCandidato.nome_completo}</p>
          <p><strong>Email:</strong> ${dadosCandidato.email_candidato}</p>
          <p><strong>Telefone:</strong> ${dadosCandidato.telefone_contato}</p>
          <p><strong>Status:</strong> ${dadosCandidato.status_recrutamento}</p>
          <p><strong>ID:</strong> ${candidatoId}</p>
          <p><strong>Vaga ID:</strong> ${dadosCandidato.vaga_id}</p>
        </div>

        <div class="modal-footer">
          <button onclick="GestorModals.fecharModalLocal('detalhes')">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("❌ Erro ao abrir modal de detalhes:", error);
    alert("Erro ao abrir modal de detalhes");
  }
}

// Modal Agendamento Local (Fallback)
function abrirModalAgendamentoGestorLocal(candidatoId, dadosCodificados) {
  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById(
      "modal-agendamento-gestor-local"
    );
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-agendamento-gestor-local";

    // HTML para agendamento
    modal.innerHTML = `
      <div class="modal-container">
        <div class="modal-header">
          <h3>Agendar Reunião - ${dadosCandidato.nome_completo}</h3>
          <button onclick="GestorModals.fecharModalLocal('agendamento')">×</button>
        </div>

        <div class="modal-body">
          <p><strong>Email:</strong> ${dadosCandidato.email_candidato}</p>
          <p><strong>Telefone:</strong> ${dadosCandidato.telefone_contato}</p>
          <p><strong>Data:</strong> <input type="date" id="data-agendamento-local"></p>
          <p><strong>Horário:</strong> <input type="time" id="hora-agendamento-local"></p>
        </div>

        <div class="modal-footer">
          <button onclick="GestorModals.salvarAgendamentoLocal('${candidatoId}')">Agendar</button>
          <button onclick="GestorModals.fecharModalLocal('agendamento')">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("❌ Erro ao abrir modal de agendamento:", error);
    alert("Erro ao abrir modal de agendamento");
  }
}

// Namespace para funções locais
const GestorModals = {
  // Salvar Avaliação com Firebase
  salvarAvaliacaoLocal: async function (candidatoId, vagaId) {
    try {
      const form = document.querySelector("#form-avaliacao-gestor-local");
      const observacoes = form.querySelector('[name="observacoes"]').value;
      const resultado = form.querySelector(
        '[name="resultado-local"]:checked'
      ).value;

      if (!observacoes || observacoes.trim().length < 10) {
        alert("Observações devem ter pelo menos 10 caracteres");
        return;
      }

      if (!resultado) {
        alert("Selecione um resultado da avaliação");
        return;
      }

      // Determina novo status baseado na decisão
      let novoStatus = "Processo Concluído - Rejeitado";
      if (resultado === "aprovado") {
        novoStatus = "Processo Concluído - Contratado";
      }

      // Atualiza no Firebase
      const candidatoRef = doc(db, "candidatos", candidatoId);
      await updateDoc(candidatoRef, {
        status_recrutamento: novoStatus,
        avaliacao_gestor: {
          aprovado: resultado === "aprovado",
          resultado: resultado,
          observacoes: observacoes.trim(),
          data_avaliacao: new Date(),
          avaliador:
            getGlobalState()?.usuarioAtual?.email || "gestor@eupsico.com",
        },
        historico: arrayUnion({
          acao: `Avaliação ${
            resultado === "aprovado" ? "Aprovada" : "Rejeitada"
          }`,
          data: new Date(),
          usuario: getGlobalState()?.usuarioAtual?.id || "gestor",
          anterior: "Entrevista com Gestor Pendente",
        }),
      });

      alert(
        `${
          resultado === "aprovado" ? "✅ Aprovado" : "❌ Rejeitado"
        }! Status atualizado com sucesso.`
      );

      // Fecha modal
      const modal = document.getElementById("modal-gestor-local");
      if (modal) {
        modal.remove();
        document.body.style.overflow = "";
      }

      // Recarrega lista
      const stateAtual = getGlobalState();
      renderizarEntrevistaGestor(stateAtual);
    } catch (error) {
      console.error("❌ Erro ao salvar avaliação:", error);
      alert(`Erro ao salvar: ${error.message}`);
    }
  },

  // Fechar modal local
  fecharModalLocal: function (tipo) {
    try {
      const modalId =
        tipo === "avaliacao"
          ? "modal-gestor-local"
          : tipo === "detalhes"
          ? "modal-detalhes-gestor-local"
          : tipo === "agendamento"
          ? "modal-agendamento-gestor-local"
          : null;

      const modal = document.getElementById(modalId);
      if (modal) {
        modal.remove();
        document.body.style.overflow = "";
      }
    } catch (error) {
      console.error("❌ Erro ao fechar modal:", error);
    }
  },

  // Salvar Agendamento Local
  salvarAgendamentoLocal: async function (candidatoId) {
    try {
      const data = document.getElementById("data-agendamento-local").value;
      const hora = document.getElementById("hora-agendamento-local").value;

      if (!data || !hora) {
        alert("Selecione data e hora para o agendamento");
        return;
      }

      // Atualiza no Firebase
      const candidatoRef = doc(db, "candidatos", candidatoId);
      await updateDoc(candidatoRef, {
        agendamento_solicitado: {
          data: data,
          hora: hora,
          status: "Pendente",
          data_solicitacao: new Date(),
          solicitante:
            getGlobalState()?.usuarioAtual?.email || "gestor@eupsico.com",
        },
        historico: arrayUnion({
          acao: "Agendamento solicitado pelo Gestor",
          data: new Date(),
          usuario: getGlobalState()?.usuarioAtual?.id || "gestor",
        }),
      });

      alert(`✅ Agendamento solicitado para ${data} às ${hora}`);

      // Fecha modal
      const modal = document.getElementById("modal-agendamento-gestor-local");
      if (modal) {
        modal.remove();
        document.body.style.overflow = "";
      }
    } catch (error) {
      console.error("❌ Erro ao salvar agendamento:", error);
      alert(`Erro ao salvar agendamento: ${error.message}`);
    }
  },

  // Selecionar resultado no modal
  selecionarResultado: function (resultado) {
    const radios = document.querySelectorAll(
      '#form-avaliacao-gestor-local [name="resultado-local"]'
    );
    radios.forEach((radio) => (radio.checked = false));
    const radioSelecionado = document.querySelector(
      `#form-avaliacao-gestor-local [name="resultado-local"][value="${resultado}"]`
    );
    if (radioSelecionado) {
      radioSelecionado.checked = true;
    }
  },
};

// Expor namespace globalmente para onclick handlers
window.GestorModals = GestorModals;
