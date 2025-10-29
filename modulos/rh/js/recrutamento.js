// modulos/rh/js/recrutamento.js
import {
  db,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

// Importa a função para upload de arquivos (a ser implementada ou referenciada)
import { uploadFileToDrive } from "../../../assets/js/utils/firebase-storage-utils.js"; // Presumindo um utilitário de storage

// =====================================================================
// CONSTANTES GLOBAIS E ELEMENTOS DO DOM
// =====================================================================

const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATOS_COLLECTION_NAME = "candidaturas";
const ESTUDOS_COLLECTION_NAME = "estudos_de_caso";
const MSGS_COLLECTION_NAME = "mensagens_rh";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);
const estudosCollection = collection(db, ESTUDOS_COLLECTION_NAME);
const mensagensCollection = collection(db, MSGS_COLLECTION_NAME);

// Elementos do DOM
const filtroVaga = document.getElementById("filtro-vaga");
const statusCandidaturaTabs = document.getElementById(
  "status-candidatura-tabs"
);
const conteudoRecrutamento = document.getElementById("conteudo-recrutamento");
const btnGerenciarConteudo = document.getElementById("btn-gestao-conteudo");

let vagaSelecionadaId = null;
let currentUserData = {};

// =====================================================================
// FUNÇÕES AUXILIARES E DE INJEÇÃO DE CONTEÚDO
// =====================================================================

/**
 * Carrega a lista de vagas com status 'em-divulgacao' e popula o filtro.
 */
async function carregarVagasAtivas() {
  if (!filtroVaga) return;

  try {
    const q = query(vagasCollection, where("status", "==", "em-divulgacao"));
    const snapshot = await getDocs(q);

    let htmlOptions = '<option value="">Selecione uma Vaga...</option>';

    if (snapshot.empty) {
      htmlOptions = '<option value="">Nenhuma vaga em divulgação.</option>';
    } else {
      snapshot.docs.forEach((doc) => {
        const vaga = doc.data();
        htmlOptions += `<option value="${doc.id}">${vaga.nome}</option>`;
      });
    }
    filtroVaga.innerHTML = htmlOptions;

    // Tenta selecionar a primeira vaga se houver
    if (snapshot.size > 0) {
      filtroVaga.value = snapshot.docs[0].id;
      handleFiltroVagaChange();
    }
  } catch (error) {
    console.error("Erro ao carregar vagas ativas:", error);
    window.showToast("Erro ao carregar lista de vagas.", "error");
  }
}

/**
 * Renderiza o conteúdo da aba "Cronograma e Orçamento".
 */
function renderizarCronograma() {
  conteudoRecrutamento.innerHTML = `
        <div class="painel-cronograma">
            <h3>Cronograma e Orçamento da Vaga</h3>
            
            <fieldset>
                <legend>Definições de Cronograma</legend>
                
                <div class="form-group">
                    <label for="cronograma-data-inicio">Data de Início do Processo Seletivo:</label>
                    <input type="date" id="cronograma-data-inicio">
                </div>
                
                <div class="form-group">
                    <label for="cronograma-data-fim">Data Prevista de Contratação:</label>
                    <input type="date" id="cronograma-data-fim">
                </div>

                <div class="form-group">
                    <label for="cronograma-etapas">Etapas do Processo Seletivo (Resumo):</label>
                    <textarea id="cronograma-etapas" rows="3" placeholder="Ex: Triagem -> Teste de Conhecimento -> Entrevista RH -> Entrevista Gestor"></textarea>
                </div>
            </fieldset>

            <fieldset>
                <legend>Orçamento Estimado</legend>
                <div class="form-group">
                    <label for="orcamento-valor-total">Orçamento Total Estimado (R$):</label>
                    <input type="number" id="orcamento-valor-total" step="0.01">
                </div>
                <div class="form-group">
                    <label for="orcamento-detalhes">Detalhes do Orçamento (Fontes de Custos):</label>
                    <textarea id="orcamento-detalhes" rows="3" placeholder="Ex: Divulgação em sites pagos, custo de tempo RH/Gestor, etc."></textarea>
                </div>
            </fieldset>
            
            <button class="btn btn-success" id="btn-salvar-cronograma">
                <i class="fas fa-save"></i> Salvar Cronograma e Orçamento
            </button>
        </div>
    `;
  // TODO: Adicionar lógica para carregar/salvar dados de cronograma do Firestore (subcoleção da vaga)
}

/**
 * Renderiza a listagem de candidatos para a triagem.
 */
async function renderizarTriagem() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidaturas...</div>';

  // Busca candidatos para a vaga e que estejam na fase de triagem (status inicial)
  const q = query(
    candidatosCollection,
    where("vagaId", "==", vagaSelecionadaId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-warning">Nenhuma candidatura recebida para esta vaga ainda.</p>';
    return;
  }

  let listaHtml = `
        <div class="list-candidaturas">
            <h3>Triagem de Currículo (${snapshot.size})</h3>
            <p>Clique em um candidato para iniciar a triagem e avaliação de pré-requisitos.</p>
    `;

  snapshot.docs.forEach((doc) => {
    const cand = doc.data();
    const statusTriagem = cand.statusRecrutamento || "Aguardando Triagem";
    const corStatus = statusTriagem.includes("Aprovado")
      ? "success"
      : statusTriagem.includes("Rejeitado")
      ? "danger"
      : "info";

    listaHtml += `
            <div class="card card-candidato" data-id="${doc.id}">
                <h4>${cand.nomeCompleto || "Candidato Sem Nome"}</h4>
                <p>Status: <span class="badge badge-${corStatus}">${statusTriagem}</span></p>
                <p class="small-info">Email: ${cand.email} | Telefone: ${
      cand.telefone || "N/A"
    }</p>
                <button class="btn btn-sm btn-primary btn-abrir-candidato" data-id="${
                  doc.id
                }" data-etapa="triagem">Avaliar Candidatura</button>
            </div>
        `;
  });

  listaHtml += "</div>";
  conteudoRecrutamento.innerHTML = listaHtml;

  document.querySelectorAll(".btn-abrir-candidato").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-id");
      // Abre o modal para iniciar a triagem
      abrirModalCandidato(candidatoId, "triagem");
    });
  });
}

/**
 * Abre o modal de avaliação para o candidato na etapa específica.
 * @param {string} candidatoId
 * @param {string} etapa - 'triagem', 'entrevista_rh', 'teste', 'dinamica', 'entrevista_gestor'
 */
async function abrirModalCandidato(candidatoId, etapa) {
  const modal = document.getElementById("modal-candidato");
  const modalBody = document.getElementById("candidato-modal-body");
  const modalFooter = document.getElementById("candidato-modal-footer");

  if (!modal || !modalBody) return;

  modalBody.innerHTML =
    '<div class="loading-spinner">Carregando dados do candidato...</div>';

  try {
    const candRef = doc(db, CANDIDATOS_COLLECTION_NAME, candidatoId);
    const candSnap = await getDoc(candRef);

    if (!candSnap.exists()) {
      modalBody.innerHTML =
        '<p class="alert alert-danger">Candidatura não encontrada.</p>';
      return;
    }

    const candidato = candSnap.data();
    document.getElementById(
      "candidato-nome-titulo"
    ).textContent = `Avaliação: ${candidato.nomeCompleto}`;

    // Injeta o formulário específico da etapa
    let contentHtml = "";

    if (etapa === "triagem") {
      contentHtml = await gerarConteudoTriagem(candidato, candSnap.id);
    }

    modalBody.innerHTML = contentHtml;
    modal.style.display = "flex";
  } catch (error) {
    console.error(`Erro ao abrir modal de candidato (${etapa}):`, error);
    modalBody.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar os detalhes da candidatura.</p>';
  }
}

// =====================================================================
// FUNÇÕES DE FLUXO DE TRABALHO (Para Triagem e Avaliações)
// =====================================================================

/**
 * Gera o conteúdo da aba de Triagem.
 */
async function gerarConteudoTriagem(candidato, candidatoId) {
  // Busca pré-requisitos da vaga
  const vagaDoc = await getDoc(
    doc(db, VAGAS_COLLECTION_NAME, candidato.vagaId)
  );
  const vaga = vagaDoc.data();

  // Supondo que os pré-requisitos são as responsabilidades + formação mínima
  const preRequisitos = [
    ...(vaga.cargo?.responsabilidades ? [vaga.cargo.responsabilidades] : []),
    ...(vaga.formacao?.minima ? [vaga.formacao.minima] : []),
  ];

  let fichaCandidatoHtml = `
        <h3>Ficha de Candidatura (Bloqueada para Edição)</h3>
        <div class="ficha-candidato-detalhes">
            <p><strong>Vaga Aplicada:</strong> ${vaga.nome}</p>
            <p><strong>Telefone (WhatsApp):</strong> ${
              candidato.telefone || "N/A"
            }</p>
            <p><strong>CEP:</strong> ${
              candidato.cep
            } | <strong>Cidade/Estado:</strong> ${candidato.cidade} / ${
    candidato.estado
  }</p>
            <p><strong>Resumo da Experiência:</strong> <textarea rows="4" disabled>${
              candidato.resumoProfissional ||
              candidato.breveApresentacao ||
              "N/A"
            }</textarea></p>
            <p><strong>Habilidades:</strong> ${
              candidato.habilidades || "N/A"
            }</p>
            <p><strong>Como Conheceu:</strong> ${
              candidato.comoConheceu || "N/A"
            }</p>
            <p><strong>Currículo:</strong> <a href="${
              candidato.linkCurriculo || "#"
            }" target="_blank" class="btn btn-sm btn-info">Ver Currículo no Drive</a></p>
        </div>
        
        <hr>

        <form id="form-avaliacao-triagem" data-candidato-id="${candidatoId}">
            <h4>Avaliação da Triagem</h4>
            <fieldset>
                <legend>Pré-Requisitos e Aptidão</legend>
                
                <div class="form-group">
                    <label>1. Quais pré-requisitos o candidato atende?</label>
                    <p class="small-info text-secondary">Baseado na Ficha Técnica da Vaga:</p>
                    <ul class="list-pre-requisitos">
                        ${preRequisitos
                          .map(
                            (req, index) => `
                            <li>
                                <input type="checkbox" id="req-${index}" name="pre-requisito" value="${req}">
                                <label for="req-${index}">${req.substring(
                              0,
                              80
                            )}...</label>
                            </li>
                        `
                          )
                          .join("")}
                    </ul>
                    <textarea name="atende-requisitos-obs" rows="2" placeholder="Observações sobre os pré-requisitos atendidos/faltantes."></textarea>
                </div>
                
                <div class="form-group">
                    <label for="apto-entrevista">2. O(A) candidato(a) está apto(a) para a entrevista?</label>
                    <select id="apto-entrevista" name="apto-entrevista" required>
                        <option value="">Selecione...</option>
                        <option value="sim">Sim (Apto para a próxima etapa)</option>
                        <option value="nao">Não (A ser rejeitado)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="triagem-comentarios">3. Comentários Finais da Triagem:</label>
                    <textarea id="triagem-comentarios" name="triagem-comentarios" rows="3" required></textarea>
                </div>
            </fieldset>

            <div class="modal-footer">
                <button type="button" class="btn btn-danger" onclick="reprovarCandidato('${candidatoId}', 'triagem')">
                    <i class="fas fa-times"></i> Reprovar Candidatura
                </button>
                <button type="submit" class="btn btn-success" id="btn-aprovar-triagem">
                    <i class="fas fa-check"></i> Aprovar para Entrevista
                </button>
            </div>
        </form>
    `;

  return fichaCandidatoHtml;
}

// =====================================================================
// EVENT HANDLERS
// =====================================================================

/**
 * Lida com a mudança na seleção da vaga.
 */
function handleFiltroVagaChange() {
  vagaSelecionadaId = filtroVaga.value;
  const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");
  if (activeTab) {
    handleTabClick({ currentTarget: activeTab });
  } else {
    conteudoRecrutamento.innerHTML =
      '<p id="mensagem-inicial">Selecione uma vaga no filtro acima para iniciar a visualização do processo seletivo.</p>';
  }
}

/**
 * Lida com o clique nas abas de status.
 */
function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");

  document
    .querySelectorAll(".tab-link")
    .forEach((btn) => btn.classList.remove("active"));
  e.currentTarget.classList.add("active");

  if (!vagaSelecionadaId && status !== "gestao-conteudo") {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Por favor, selecione uma vaga para visualizar esta etapa.</p>';
    return;
  }

  switch (status) {
    case "cronograma":
      renderizarCronograma();
      break;
    case "triagem":
      renderizarTriagem();
      break;
    case "entrevistas":
      // TODO: Implementar listagem de candidatos em entrevistas
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Entrevistas em desenvolvimento.</p>";
      break;
    case "gestor":
      // TODO: Implementar listagem de candidatos na entrevista com gestor
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Entrevista com Gestor em desenvolvimento.</p>";
      break;
    case "finalizados":
      // TODO: Implementar listagem de candidatos finalizados
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Finalizados em desenvolvimento.</p>";
      break;
    case "gestao-conteudo":
      // TODO: Implementar a gestão de estudos de caso e testes
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Gerenciar Estudos/Testes em desenvolvimento.</p>";
      break;
    default:
      conteudoRecrutamento.innerHTML =
        "<p>Selecione uma etapa do processo.</p>";
  }
}

/**
 * Função de inicialização principal do módulo.
 */
export async function initRecrutamento(user, userData) {
  console.log("🔹 Iniciando Módulo de Recrutamento e Seleção...");

  currentUserData = userData || {};

  // 1. Carregar lista de vagas ativas
  await carregarVagasAtivas();

  // 2. Configurar eventos de filtro e abas
  if (filtroVaga) {
    filtroVaga.addEventListener("change", handleFiltroVagaChange);
  }

  if (statusCandidaturaTabs) {
    statusCandidaturaTabs.querySelectorAll(".tab-link").forEach((btn) => {
      btn.addEventListener("click", handleTabClick);
    });
  }

  // 3. Configurar evento de fechar modal de candidato
  document.querySelectorAll(".fechar-modal-candidato").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("modal-candidato").style.display = "none";
    });
  });

  // Inicia na aba de cronograma se uma vaga foi pré-selecionada.
  if (vagaSelecionadaId) {
    renderizarCronograma();
  }
}
