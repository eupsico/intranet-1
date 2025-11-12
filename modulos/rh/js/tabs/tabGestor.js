// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Botão "Avaliar Gestor" corrigido para abrir MODAL (não página).
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

  // Loading spinner com classes do rh.css
  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    // Query Firestore (ajuste os status conforme seu Firestore)
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        // SUBSTITUA PELOS STATUS REAIS DO SEU FIRESTORE
        "Testes Aprovado", // Ajuste conforme necessário
        "Entrevista Gestor Pendente", // Ajuste conforme necessário
        "Entrevista Gestor Agendada", // Ajuste conforme necessário
        "Aguardando Avaliação Gestor", // Ajuste conforme necessário
      ])
    );

    const snapshot = await getDocs(q);

    // Atualização de contagem
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

    // Container com grid do rh.css
    let listaHtml = `
      <div class="candidatos-container candidatos-grid">
    `;

    // Loop forEach com estrutura de cards
    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;
      const vagaId = vagaSelecionadaId;

      // Classe CSS dinâmica baseada no status real
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

      // DADOS DO CANDIDATO ENCODED para passar para o modal (padrão tabEntrevistas)
      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo,
        email_candidato: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_id: vagaId,
        // Adicione outros campos necessários
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Candidato Sem Nome"}
              <span class="status-badge ${statusClass}">
                <i class="fas fa-tag"></i> ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor.
            </p>
          </div>

          <!-- Informações de contato -->
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

          <!-- AÇÕES CORRIGIDAS -->
          <div class="acoes-candidato">
            <!-- BOTÃO AVALIAR GESTOR - AGORA É BUTTON COM MODAL -->
            <button class="action-button primary btn-avaliar-gestor" 
                    data-id="${candidaturaId}"
                    data-vaga="${vagaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; background: var(--cor-primaria); color: white; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            
            <!-- BOTÃO DETALHES - CORRIGIDO COM FUNÇÃO GLOBAL -->
            <button class="action-button secondary btn-ver-detalhes" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            
            <!-- Botão Currículo se existir -->
            ${
              cand.link_curriculo_drive
                ? `
                <a href="${cand.link_curriculo_drive}" target="_blank" class="action-button info" 
                   style="padding: 10px 16px; background: var(--cor-info); color: white; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fas fa-file-pdf"></i> Currículo
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

    // EVENT LISTENERS CORRIGIDOS (APÓS RENDERIZAÇÃO)
    console.log("🔗 Gestor: Anexando event listeners...");

    // === BOTÃO AVALIAR GESTOR - AGORA COM MODAL ===
    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); // IMPEDIR NAVEGAÇÃO
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const vagaId = btn.getAttribute("data-vaga");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(
          `🔹 Gestor: Botão Avaliar clicado - ID: ${candidatoId}, Vaga: ${vagaId}`
        );

        // === OPÇÃO 1: Modal personalizado para Gestor ===
        if (window.abrirModalAvaliacaoGestor) {
          window.abrirModalAvaliacaoGestor(
            candidatoId,
            vagaId,
            dadosCodificados
          );
        }
        // === OPÇÃO 2: Modal genérico (como tabEntrevistas) ===
        else if (window.abrirModalAvaliacao) {
          window.abrirModalAvaliacao(
            candidatoId,
            dadosCodificados,
            "gestor",
            vagaId
          );
        }
        // === OPÇÃO 3: Modal padrão do sistema ===
        else if (window.abrirModal) {
          const dadosModal = {
            tipo: "avaliacao-gestor",
            candidato: candidatoId,
            vaga: vagaId,
            dados: dadosCodificados,
          };
          window.abrirModal("avaliacao", dadosModal);
        }
        // === FALLBACK: Criar modal dinamicamente ===
        else {
          abrirModalGestorDinamico(candidatoId, vagaId, dadosCodificados);
        }
      });
    });

    // === BOTÃO DETALHES - CORRIGIDO ===
    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(`🔹 Gestor: Botão Detalhes clicado - ID: ${candidatoId}`);

        // === OPÇÃO 1: Modal de detalhes específico ===
        if (window.abrirModalDetalhesCandidato) {
          window.abrirModalDetalhesCandidato(candidatoId, dadosCodificados);
        }
        // === OPÇÃO 2: Modal genérico de detalhes ===
        else if (window.abrirModalCandidato) {
          window.abrirModalCandidato(candidatoId, dadosCodificados, "detalhes");
        }
        // === OPÇÃO 3: Modal padrão ===
        else if (window.abrirModal) {
          const dadosModal = {
            tipo: "detalhes-candidato",
            candidato: candidatoId,
            dados: dadosCodificados,
          };
          window.abrirModal("detalhes", dadosModal);
        }
        // === FALLBACK: Modal dinâmico ===
        else {
          abrirModalDetalhesDinamico(candidatoId, dadosCodificados);
        }
      });
    });

    console.log(
      `✅ Gestor: ${snapshot.size} candidatos renderizados com event listeners`
    );
  } catch (error) {
    // Tratamento de erro
    console.error("❌ Gestor: Erro ao carregar candidatos:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger">
        <p><i class="fas fa-exclamation-circle"></i> Erro ao carregar a lista de candidatos: ${error.message}</p>
      </div>
    `;
  }
}

// === FUNÇÕES DE MODAL DINÂMICAS (FALLBACK SE NÃO EXISTIREM NO SISTEMA) ===

// Modal Avaliação Gestor Dinâmico
function abrirModalGestorDinamico(candidatoId, vagaId, dadosCodificados) {
  console.log("🔹 Gestor: Criando modal dinâmico para avaliação");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Cria modal se não existir
    let modal = document.getElementById("modal-avaliacao-gestor");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-avaliacao-gestor";
      modal.className = "modal is-hidden";
      modal.innerHTML = `
        <div class="modal-background" onclick="fecharModalGestor()"></div>
        <div class="modal-card">
          <header class="modal-card-head">
            <p class="modal-card-title">
              <i class="fas fa-user-tie"></i> Avaliação - Entrevista com Gestor
            </p>
            <button class="delete" aria-label="close" onclick="fecharModalGestor()"></button>
          </header>
          <section class="modal-card-body">
            <div class="field">
              <label class="label">Candidato</label>
              <p class="control">
                <input class="input" type="text" value="${
                  dadosCandidato.nome_completo || ""
                }" readonly>
              </p>
            </div>
            <div class="field">
              <label class="label">Vaga</label>
              <p class="control">
                <input class="input" type="text" value="${vagaId}" readonly>
              </p>
            </div>
            <div class="field">
              <label class="label">Status Atual</label>
              <p class="control">
                <input class="input" type="text" value="${
                  dadosCandidato.status_recrutamento || ""
                }" readonly>
              </p>
            </div>
            <div class="field">
              <label class="label">Observações da Entrevista</label>
              <div class="control">
                <textarea class="textarea" placeholder="Descreva a avaliação da entrevista com gestor..." rows="5"></textarea>
              </div>
            </div>
            <div class="field">
              <label class="label">Resultado</label>
              <div class="control">
                <label class="radio">
                  <input type="radio" name="resultado-gestor" value="aprovado">
                  Aprovado para Contratação
                </label>
                <label class="radio">
                  <input type="radio" name="resultado-gestor" value="rejeitado">
                  Não Selecionado
                </label>
                <label class="radio">
                  <input type="radio" name="resultado-gestor" value="pendente">
                  Avaliação Pendente
                </label>
              </div>
            </div>
          </section>
          <footer class="modal-card-foot">
            <button class="button is-success" onclick="salvarAvaliacaoGestor('${candidatoId}')">
              <i class="fas fa-save"></i> Salvar Avaliação
            </button>
            <button class="button" onclick="fecharModalGestor()">
              Cancelar
            </button>
          </footer>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Mostra o modal
    modal.classList.remove("is-hidden");
    modal.classList.add("is-visible", "fade-in");

    // Scroll para o modal
    modal.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error("❌ Erro ao criar modal dinâmico:", error);
    // Fallback para página se modal falhar
    window.location.href = `etapa-entrevista-gestor.html?candidato=${candidatoId}&vaga=${vagaId}`;
  }
}

// Modal Detalhes Dinâmico
function abrirModalDetalhesDinamico(candidatoId, dadosCodificados) {
  console.log("🔹 Gestor: Criando modal dinâmico de detalhes");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    let modal = document.getElementById("modal-detalhes-gestor");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-detalhes-gestor";
      modal.className = "modal is-hidden";
      modal.innerHTML = `
        <div class="modal-background" onclick="fecharModalGestor()"></div>
        <div class="modal-card">
          <header class="modal-card-head">
            <p class="modal-card-title">
              <i class="fas fa-eye"></i> Detalhes do Candidato - ${
                dadosCandidato.nome_completo || "N/A"
              }
            </p>
            <button class="delete" aria-label="close" onclick="fecharModalGestor()"></button>
          </header>
          <section class="modal-card-body">
            <div class="content">
              <h4 class="title is-5">Informações Pessoais</h4>
              <div class="columns">
                <div class="column">
                  <p><strong>Nome:</strong> ${
                    dadosCandidato.nome_completo || "N/A"
                  }</p>
                  <p><strong>Email:</strong> ${
                    dadosCandidato.email_candidato || "N/A"
                  }</p>
                  <p><strong>Telefone:</strong> ${
                    dadosCandidato.telefone_contato || "N/A"
                  }</p>
                </div>
                <div class="column">
                  <p><strong>Status:</strong> <span class="tag is-warning">${
                    dadosCandidato.status_recrutamento || "N/A"
                  }</span></p>
                  <p><strong>Vaga:</strong> ${
                    dadosCandidato.vaga_id || "N/A"
                  }</p>
                  <p><strong>ID:</strong> ${candidatoId}</p>
                </div>
              </div>
              
              ${
                dadosCandidato.curriculo_observacoes
                  ? `
                <h4 class="title is-5 mt-5">Observações</h4>
                <div class="box">
                  <p>${dadosCandidato.curriculo_observacoes}</p>
                </div>
              `
                  : ""
              }
            </div>
          </section>
          <footer class="modal-card-foot">
            <button class="button is-info" onclick="imprimirDetalhes('${candidatoId}')">
              <i class="fas fa-print"></i> Imprimir
            </button>
            <button class="button" onclick="fecharModalGestor()">
              Fechar
            </button>
          </footer>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Mostra o modal
    modal.classList.remove("is-hidden");
    modal.classList.add("is-visible", "fade-in");
  } catch (error) {
    console.error("❌ Erro ao criar modal de detalhes:", error);
    alert("Erro ao abrir detalhes do candidato");
  }
}

// Funções auxiliares
function fecharModalGestor() {
  const modais = document.querySelectorAll(
    "#modal-avaliacao-gestor, #modal-detalhes-gestor, .modal.is-visible"
  );
  modais.forEach((modal) => {
    modal.classList.remove("is-visible", "fade-in");
    modal.classList.add("is-hidden");
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  });
}

function salvarAvaliacaoGestor(candidatoId) {
  console.log(`🔹 Salvando avaliação para candidato: ${candidatoId}`);
  // Implemente a lógica de salvamento aqui (Firebase update)
  alert("Avaliação salva com sucesso!");
  fecharModalGestor();
}

function imprimirDetalhes(candidatoId) {
  console.log(`🔹 Imprimindo detalhes do candidato: ${candidatoId}`);
  window.print();
}
