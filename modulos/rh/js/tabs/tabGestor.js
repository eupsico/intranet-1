// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// Objeto simples para funções do gestor
const GestorModals = {
  // Modal Avaliação
  abrirAvaliacao: function (candidaturaId, vagaId, dadosCodificados) {
    try {
      const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

      // Remove modal anterior
      const modalExistente = document.getElementById("modal-gestor-avaliacao");
      if (modalExistente) modalExistente.remove();

      const modal = document.createElement("div");
      modal.id = "modal-gestor-avaliacao";

      modal.innerHTML = `
        <div class="modal-overlay" id="modal-gestor-overlay">
          <div class="modal-background"></div>
          
          <div class="modal-content">
            <div class="modal-header" style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-user-tie"></i>
                <h3 style="margin: 0; font-size: 18px;">Avaliação Gestor</h3>
              </div>
              <button onclick="GestorModals.fechar()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
              "><i class="fas fa-times"></i></button>
            </div>
            
            <div class="modal-body" style="padding: 25px; max-height: 60vh; overflow-y: auto;">
              <div style="
                background: white;
                padding: 20px;
                border-radius: 6px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              ">
                <h4 style="margin: 0 0 15px 0; color: #667eea;">
                  <i class="fas fa-user"></i> ${dadosCandidato.nome_completo}
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                  <div><strong>Email:</strong> ${dadosCandidato.email_candidato}</div>
                  <div><strong>Telefone:</strong> ${dadosCandidato.telefone_contato}</div>
                  <div><strong>Status:</strong> ${dadosCandidato.status_recrutamento}</div>
                  <div><strong>ID:</strong> ${candidaturaId}</div>
                </div>
              </div>
              
              <form id="form-avaliacao-gestor">
                <div style="margin-bottom: 20px;">
                  <label style="font-weight: 600; margin-bottom: 8px; display: block;">Observações</label>
                  <textarea name="observacoes" style="width: 100%; min-height: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; resize: vertical;" required></textarea>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <label style="font-weight: 600; margin-bottom: 8px; display: block;">Resultado</label>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="radio" name="resultado" value="aprovado">
                      <span style="padding: 8px 12px; background: #d4edda; border-radius: 20px;">
                        <i class="fas fa-check"></i> Aprovado para Contratação
                      </span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="radio" name="resultado" value="rejeitado">
                      <span style="padding: 8px 12px; background: #f8d7da; border-radius: 20px;">
                        <i class="fas fa-times"></i> Não Selecionado
                      </span>
                    </label>
                  </div>
                </div>
              </form>
            </div>
            
            <div class="modal-footer" style="
              padding: 15px 25px;
              background: white;
              border-top: 1px solid #eee;
              display: flex;
              justify-content: flex-end;
              gap: 12px;
            ">
              <button onclick="GestorModals.fechar()" style="
                padding: 10px 20px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
              ">Cancelar</button>
              <button onclick="GestorModals.salvar('${candidaturaId}')" style="
                padding: 10px 20px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                <i class="fas fa-save"></i> Salvar Avaliação
              </button>
            </div>
          </div>
        </div>
        
        <style>
          #modal-gestor-avaliacao {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            background: rgba(0,0,0,0.6) !important;
          }
          
          #modal-gestor-avaliacao .modal-background {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 9998 !important;
          }
          
          #modal-gestor-avaliacao .modal-content {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 90% !important;
            max-width: 600px !important;
            max-height: 90vh !important;
            background: white !important;
            border-radius: 8px !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
            z-index: 10000 !important;
            overflow: hidden !important;
          }
          
          @media (max-width: 768px) {
            #modal-gestor-avaliacao .modal-content {
              width: 95% !important;
              max-height: 95vh !important;
              top: 5% !important;
              left: 2.5% !important;
              transform: none !important;
            }
          }
        </style>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = "hidden";

      // Foco no textarea
      const textarea = modal.querySelector('textarea[name="observacoes"]');
      if (textarea) textarea.focus();
    } catch (error) {
      console.error("Erro ao abrir modal:", error);
      alert("Erro ao abrir modal de avaliação");
    }
  },

  // Função de salvamento (SIMPLIFICADA)
  salvar: async function (candidaturaId) {
    try {
      const form = document.getElementById("form-avaliacao-gestor");
      if (!form) return;

      const formData = new FormData(form);
      const observacoes = formData.get("observacoes");
      const resultado = formData.get("resultado");

      if (!resultado) {
        alert("Selecione um resultado");
        return;
      }

      if (!observacoes || observacoes.trim().length < 10) {
        alert("Adicione observações detalhadas");
        return;
      }

      const novoStatus =
        resultado === "aprovado"
          ? "Processo Concluído - Contratado"
          : "Processo Concluído - Rejeitado";

      // Atualiza no Firebase
      const candidatoRef = doc(db, "candidatos", candidaturaId);
      await updateDoc(candidatoRef, {
        status_recrutamento: novoStatus,
        avaliacao_gestor: {
          aprovado: resultado === "aprovado",
          observacoes: observacoes.trim(),
          data_avaliacao: new Date(),
          avaliador: getGlobalState()?.usuarioAtual?.email || "gestor",
        },
        historico: arrayUnion({
          data: new Date(),
          acao: `Avaliação ${
            resultado === "aprovado" ? "Aprovada" : "Rejeitada"
          }`,
          usuario: "gestor",
          anterior: "Entrevista com Gestor",
        }),
      });

      alert(
        `${resultado === "aprovado" ? "Aprovado" : "Rejeitado"} com sucesso!`
      );
      GestorModals.fechar();

      // Recarrega lista
      const stateAtual = getGlobalState();
      renderizarEntrevistaGestor(stateAtual);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert(`Erro ao salvar: ${error.message}`);
    }
  },

  // Função fechar
  fechar: function () {
    const modal = document.getElementById("modal-gestor-avaliacao");
    if (modal) {
      modal.style.opacity = "0";
      setTimeout(() => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        document.body.style.overflow = "";
      }, 300);
    }
  },
};

// Função principal de renderização
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

  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
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
    `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;
      const vagaId = vagaSelecionadaId;

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

    // Event listeners
    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidaturaId = btn.getAttribute("data-id");
        const vagaId = btn.getAttribute("data-vaga");
        const dadosCodificados = btn.getAttribute("data-dados");

        GestorModals.abrirAvaliacao(candidaturaId, vagaId, dadosCodificados);
      });
    });

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidaturaId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        // Fallback simples para detalhes
        const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
        alert(
          `Detalhes de ${dadosCandidato.nome_completo}:\n\nStatus: ${dadosCandidato.status_recrutamento}\nEmail: ${dadosCandidato.email_candidato}\nTelefone: ${dadosCandidato.telefone_contato}`
        );
      });
    });

    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidaturaId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        // Chama função global se existir
        if (window.abrirModalAgendamentoRH) {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalAgendamentoRH(candidaturaId, dadosCandidato);
        } else {
          alert("Funcionalidade de agendamento será implementada em breve");
        }
      });
    });
  } catch (error) {
    console.error("Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger">
        <p><i class="fas fa-exclamation-circle"></i> Erro: ${error.message}</p>
      </div>
    `;
  }
}
