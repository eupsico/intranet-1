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
  // Note: arrayRemove is imported in firebase-init but not needed here yet
} from "../../../assets/js/firebase-init.js";

// Importa a função para upload de arquivos (a ser implementada ou referenciada)
// IMPORTANTE: Este utilitário deve ser criado/existir para a funcionalidade de candidatura
// import { uploadFileToDrive } from "../../../assets/js/utils/firebase-storage-utils.js";

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

const modalCandidato = document.getElementById("modal-candidato");
const modalCandidatoBody = document.getElementById("candidato-modal-body");
const modalCandidatoFooter = document.getElementById("candidato-modal-footer");

let vagaSelecionadaId = null;
let currentUserData = {};

// =====================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO E PERSISTÊNCIA
// =====================================================================

/**
 * Carrega a lista de vagas com status 'em-divulgacao' e popula o filtro.
 */
async function carregarVagasAtivas() {
  if (!filtroVaga) return;

  try {
    // Busca vagas aprovadas (status 'em-divulgacao')
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
    if (snapshot.size > 0 && filtroVaga.options.length > 1) {
      vagaSelecionadaId = snapshot.docs[0].id;
      filtroVaga.value = vagaSelecionadaId;
      // Dispara o carregamento inicial da aba
      handleFiltroVagaChange();
    }
  } catch (error) {
    console.error("Erro ao carregar vagas ativas:", error);
    window.showToast("Erro ao carregar lista de vagas.", "error");
  }
}

// =====================================================================
// FUNÇÕES DE RENDERIZAÇÃO POR ABA
// =====================================================================

/**
 * Renderiza o conteúdo da aba "Cronograma e Orçamento".
 */
function renderizarCronograma() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Selecione uma vaga para iniciar a gestão do cronograma.</p>';
    return;
  }

  // Conteúdo simulado (o carregamento dos dados reais seria implementado aqui)
  conteudoRecrutamento.innerHTML = `
        <div class="painel-cronograma">
            <h3>Cronograma e Orçamento da Vaga: ${
              filtroVaga.options[filtroVaga.selectedIndex].text
            }</h3>
            
            <fieldset>
                <legend>Definições de Cronograma</legend>
                
                <div class="form-group">
                    <label for="cronograma-data-inicio">Data de Início do Processo Seletivo:</label>
                    <input type="date" id="cronograma-data-inicio" value="${
                      new Date().toISOString().split("T")[0]
                    }">
                </div>
                
                <div class="form-group">
                    <label for="cronograma-data-fim">Data Prevista de Contratação:</label>
                    <input type="date" id="cronograma-data-fim">
                </div>

                <div class="form-group">
                    <label for="cronograma-etapas">Etapas do Processo Seletivo (Resumo):</label>
                    <textarea id="cronograma-etapas" rows="3" placeholder="Ex: Triagem -> Teste -> Entrevista RH -> Gestor"></textarea>
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
  // TODO: Adicionar evento de salvar cronograma
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
  // Supondo que o status inicial de candidatura seja 'triagem_pendente'
  const q = query(
    candidatosCollection,
    where("vagaId", "==", vagaSelecionadaId),
    where("statusRecrutamento", "==", "triagem_pendente")
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-warning">Nenhuma candidatura pendente de triagem.</p>';
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
    const corStatus = "info"; // Deve ser info, pois ainda está pendente de triagem

    listaHtml += `
            <div class="card card-candidato" data-id="${doc.id}">
                <h4>${cand.nomeCompleto || "Candidato Sem Nome"}</h4>
                <p>Status: <span class="badge badge-${corStatus}">${statusTriagem.replace(
      "_",
      " "
    )}</span></p>
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

  // Configura evento para abrir modal
  document.querySelectorAll(".btn-abrir-candidato").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-id");
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
  if (!modalCandidato || !modalCandidatoBody) return;

  modalCandidatoBody.innerHTML =
    '<div class="loading-spinner">Carregando dados do candidato...</div>';

  try {
    const candRef = doc(db, CANDIDATOS_COLLECTION_NAME, candidatoId);
    const candSnap = await getDoc(candRef);

    if (!candSnap.exists()) {
      modalCandidatoBody.innerHTML =
        '<p class="alert alert-danger">Candidatura não encontrada.</p>';
      return;
    }

    const candidato = candSnap.data();
    document.getElementById(
      "candidato-nome-titulo"
    ).textContent = `Avaliação: ${candidato.nomeCompleto}`;

    // --- Geração do Conteúdo Específico da Etapa ---
    let contentHtml = "";

    if (etapa === "triagem") {
      contentHtml = await gerarConteudoTriagem(candidato, candSnap.id);
    }
    // TODO: Adicionar geração de conteúdo para outras etapas (entrevista_rh, gestor, etc.)

    modalCandidatoBody.innerHTML = contentHtml;
    modalCandidato.style.display = "flex";

    // Garante que o formulário de triagem esteja funcional
    const formTriagem = document.getElementById("form-avaliacao-triagem");
    if (formTriagem) {
      formTriagem.addEventListener("submit", handleAprovarTriagem);
    }
  } catch (error) {
    console.error(`Erro ao abrir modal de candidato (${etapa}):`, error);
    modalCandidatoBody.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar os detalhes da candidatura.</p>';
  }
}

/**
 * Gera o conteúdo da aba de Triagem (Ficha de Candidatura + Formulário de Avaliação).
 */
async function gerarConteudoTriagem(candidato, candidatoId) {
  // Busca pré-requisitos da vaga
  const vagaDoc = await getDoc(
    doc(db, VAGAS_COLLECTION_NAME, candidato.vagaId)
  );
  const vaga = vagaDoc.data();

  // Supondo que os pré-requisitos são as responsabilidades + formação mínima + competências
  const preRequisitos = [
    ...(vaga.formacao?.minima
      ? [{ label: `Formação: ${vaga.formacao.minima}`, campo: "formacao" }]
      : []),
    ...(vaga.competencias?.tecnicas
      ? [
          {
            label: `Técnicas: ${vaga.competencias.tecnicas}`,
            campo: "tecnicas",
          },
        ]
      : []),
    ...(vaga.competencias?.comportamentais
      ? [
          {
            label: `Comportamentais: ${vaga.competencias.comportamentais}`,
            campo: "comportamentais",
          },
        ]
      : []),
  ];

  // Gerar um link simples para o currículo no Google Drive (usando a URL fornecida na candidatura)
  const linkCurriculo = candidato.linkCurriculo || "#";
  const isCurriculoDisponivel = linkCurriculo !== "#";

  let fichaCandidatoHtml = `
        <h3>Ficha de Candidatura (Vaga: ${vaga.nome})</h3>
        <div class="ficha-candidato-detalhes">
            <p><strong>Telefone (WhatsApp):</strong> ${
              candidato.telefone || "N/A"
            }</p>
            <p><strong>Localidade:</strong> ${candidato.cidade} / ${
    candidato.estado
  } (${candidato.cep})</p>
            <p><strong>Habilidades:</strong> ${
              candidato.habilidades || "N/A"
            }</p>
            <p><strong>Resumo da Experiência:</strong> <textarea rows="4" disabled>${
              candidato.resumoProfissional ||
              candidato.breveApresentacao ||
              "N/A"
            }</textarea></p>
            <p><strong>Currículo:</strong> 
                <a href="${linkCurriculo}" target="_blank" class="btn btn-sm btn-info" ${
    !isCurriculoDisponivel ? "disabled" : ""
  }>
                    <i class="fas fa-file-pdf"></i> Ver Currículo no Drive
                </a>
                ${
                  !isCurriculoDisponivel
                    ? '<span class="text-danger small-info">Link indisponível ou não fornecido.</span>'
                    : ""
                }
            </p>
        </div>
        
        <hr>

        <form id="form-avaliacao-triagem" data-candidato-id="${candidatoId}">
            <h4>Avaliação da Triagem</h4>
            <fieldset>
                <legend>Pré-Requisitos e Aptidão</legend>
                
                <div class="form-group">
                    <label>1. Quais dos pré-requisitos o candidato atende?</label>
                    <p class="small-info text-secondary">Pré-requisitos da Vaga:</p>
                    <div class="list-pre-requisitos">
                        ${preRequisitos
                          .map(
                            (req, index) => `
                            <div style="margin-bottom: 5px;">
                                <input type="checkbox" id="req-${req.campo}-${index}" name="pre-requisito" value="${req.label}">
                                <label for="req-${req.campo}-${index}">${req.label}</label>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                    <textarea name="atende-requisitos-obs" rows="2" placeholder="Observações sobre os pré-requisitos atendidos/faltantes (Opcional)."></textarea>
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
                <button type="button" class="btn btn-danger" onclick="reprovarCandidatura('${candidatoId}', 'triagem')">
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
// HANDLERS DE AÇÃO E FLUXO PRINCIPAL
// =====================================================================

/**
 * Lida com a aprovação da etapa de triagem.
 */
async function handleAprovarTriagem(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const candidatoId = form.getAttribute("data-candidato-id");
  const aptoEntrevista = form.querySelector("#apto-entrevista").value;
  const comentarios = form.querySelector("#triagem-comentarios").value;

  if (aptoEntrevista === "nao") {
    // Se não está apto, chama a função de reprovação com justificativa
    reprovarCandidatura(candidatoId, "triagem", comentarios);
    return;
  }

  const preRequisitosAtendidos = Array.from(
    form.querySelectorAll('input[name="pre-requisito"]:checked')
  ).map((input) => input.value);
  const obsRequisitos = form.querySelector(
    'textarea[name="atende-requisitos-obs"]'
  ).value;

  try {
    await updateDoc(doc(candidatosCollection, candidatoId), {
      statusRecrutamento: "entrevista_rh_pendente", // Próxima etapa
      "avaliacoes.triagem.data": new Date(),
      "avaliacoes.triagem.aptoEntrevista": aptoEntrevista,
      "avaliacoes.triagem.comentarios": comentarios,
      "avaliacoes.triagem.preRequisitosAtendidos": preRequisitosAtendidos,
      "avaliacoes.triagem.obsRequisitos": obsRequisitos,
    });

    window.showToast("Candidato Aprovado para Entrevista RH!", "success");
    document.getElementById("modal-candidato").style.display = "none";
    renderizarTriagem(); // Recarrega a lista de triagem
  } catch (error) {
    console.error("Erro ao aprovar triagem:", error);
    window.showToast("Erro ao aprovar triagem.", "error");
  }
}

/**
 * Lida com a reprovação de um candidato em qualquer etapa.
 */
async function reprovarCandidatura(
  candidatoId,
  etapa,
  justificativaFicha = null
) {
  // Para simplificar, usamos a justificativaFicha (comentarios) como justificativa de reprovação.
  let justificativa =
    justificativaFicha ||
    prompt(
      `Confirme a reprovação do candidato nesta etapa (${etapa}). Informe a justificativa:`
    );

  if (!justificativa || justificativa.trim() === "") {
    window.showToast("A justificativa de reprovação é obrigatória.", "warning");
    return;
  }

  if (!confirm(`Confirmar reprovação na etapa ${etapa}?`)) return;

  try {
    // Atualiza o status e adiciona ao histórico
    await updateDoc(doc(candidatosCollection, candidatoId), {
      statusRecrutamento: "rejeitado",
      "avaliacoes.rejeicao.etapa": etapa,
      "avaliacoes.rejeicao.data": new Date(),
      "avaliacoes.rejeicao.justificativa": justificativa,
      // Adicionar ao histórico principal (usando arrayUnion)
      historico: arrayUnion({
        data: new Date(),
        acao: `Candidatura REJEITADA na etapa de ${etapa}. Motivo: ${justificativa}`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      `Candidatura rejeitada com sucesso na etapa ${etapa}.`,
      "error"
    );
    document.getElementById("modal-candidato").style.display = "none";
    renderizarTriagem(); // Recarrega a listagem atual
  } catch (error) {
    console.error("Erro ao reprovar candidato:", error);
    window.showToast("Erro ao reprovar candidato.", "error");
  }
}

// =====================================================================
// HANDLERS DE UI
// =====================================================================

/**
 * Lida com a mudança na seleção da vaga.
 */
function handleFiltroVagaChange() {
  vagaSelecionadaId = filtroVaga.value;

  const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");

  if (vagaSelecionadaId) {
    // Se houver vaga selecionada, carrega o conteúdo da aba ativa (ou cronograma)
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    } else {
      renderizarCronograma();
    }
  } else {
    // Se a vaga for deselecionada
    conteudoRecrutamento.innerHTML =
      '<p id="mensagem-inicial" class="alert alert-info">Selecione uma vaga no filtro acima para iniciar a visualização do processo seletivo.</p>';
  }
}

/**
 * Lida com o clique nas abas de status.
 */
function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");

  document
    .querySelectorAll("#status-candidatura-tabs .tab-link")
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
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Finalizados em desenvolvimento.</p>";
      break;
    case "contratados":
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Contratados em desenvolvimento.</p>";
      break;
    case "rejeitados":
      conteudoRecrutamento.innerHTML =
        "<p>Conteúdo da aba Rejeitados em desenvolvimento.</p>";
      break;
    case "gestao-conteudo":
      // Redirecionamento (Usar a função de navegação do app.js se houver)
      window.location.hash = "#rh/gestao_estudos_de_caso";
      break;
    default:
      conteudoRecrutamento.innerHTML =
        "<p>Selecione uma etapa do processo.</p>";
  }
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================

/**
 * Ponto de entrada do módulo.
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
  if (modalCandidato) {
    document.querySelectorAll(".fechar-modal-candidato").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalCandidato.style.display = "none";
        // Recarrega a aba de triagem para atualizar o status do candidato
        const triagemTab = statusCandidaturaTabs.querySelector(
          '.tab-link[data-status="triagem"]'
        );
        if (triagemTab && triagemTab.classList.contains("active")) {
          renderizarTriagem();
        }
      });
    });
  }

  // 4. Se não houve vaga selecionada (lista vazia), exibe mensagem inicial
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p id="mensagem-inicial" class="alert alert-info">Nenhuma vaga em divulgação. Crie uma nova vaga no painel de Gestão de Vagas.</p>';
  }
}
