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
  serverTimestamp, // Adicionado para salvar a atualização
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

// NOVOS: Elementos para o modal de Cronograma (que deve estar no recrutamento.html)
const modalEdicaoCronograma = document.getElementById("modal-edicao-cronograma");
const formEdicaoCronograma = document.getElementById("form-edicao-cronograma");

let vagaSelecionadaId = null;
let currentUserData = {};

// =====================================================================
// FUNÇÕES DE LÓGICA DE NEGÓCIO E PERSISTÊNCIA
// =====================================================================

/**
 * Utilitário para formatar o Timestamp
 */
function formatarTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  // Assumindo que o timestamp do Firebase pode ser um objeto com .seconds
  const date = timestamp.toDate
    ? timestamp.toDate()
    : typeof timestamp.seconds === "number"
    ? new Date(timestamp.seconds * 1000)
    : new Date(timestamp);
  return date.toLocaleDateString("pt-BR");
}

async function carregarVagasAtivas() {
  if (!filtroVaga) return;

  try {
    console.log('🔍 Buscando vagas ativas...');
    
    // ✅ PRIMEIRO: Buscar TODAS as vagas para verificar a estrutura
    const allVagasSnapshot = await getDocs(vagasCollection);
    
    console.log(`📊 Total de vagas no Firestore: ${allVagasSnapshot.size}`);
    
    if (!allVagasSnapshot.empty) {
      const primeiraVaga = allVagasSnapshot.docs[0].data();
      console.log('🔍 Estrutura da primeira vaga:', primeiraVaga);
      console.log('🔑 Campos disponíveis:', Object.keys(primeiraVaga));
    }
    
    // ✅ SEGUNDO: Tentar buscar com filtro (ajuste o nome do campo se necessário)
    // Tente primeiro com "status" (mais comum)
    let q = query(
      vagasCollection,
      where("status", "in", [
        "em-divulgacao",
        "Em Divulgação",
        "Cronograma Pendente",
        "Cronograma Definido (Triagem Pendente)",
        "Entrevista RH Pendente",
        "Testes Pendente",
        "Entrevista Gestor Pendente",
        "Contratado",
        "Encerrada",
      ])
    );
    
    let snapshot = await getDocs(q);
    
    console.log(`✅ Vagas encontradas com filtro "status": ${snapshot.size}`);
    
    // Se não encontrar nada, tenta com "status_vaga"
    if (snapshot.empty) {
      console.log('⚠️ Nenhuma vaga encontrada com "status", tentando "status_vaga"...');
      
      q = query(
        vagasCollection,
        where("status_vaga", "in", [
          "em-divulgacao",
          "Em Divulgação",
          "Cronograma Pendente",
          "Cronograma Definido (Triagem Pendente)",
          "Entrevista RH Pendente",
          "Testes Pendente",
          "Entrevista Gestor Pendente",
          "Contratado",
          "Encerrada",
        ])
      );
      
      snapshot = await getDocs(q);
      console.log(`✅ Vagas encontradas com filtro "status_vaga": ${snapshot.size}`);
    }

    let htmlOptions = '<option value="">Selecione uma Vaga...</option>';

    if (snapshot.empty) {
      htmlOptions = '<option value="">Nenhuma vaga em processo de recrutamento.</option>';
    } else {
      snapshot.docs.forEach((doc) => {
        const vaga = doc.data();
        const titulo = vaga.titulo_vaga || vaga.nome || vaga.titulo || 'Vaga sem título';
        const status = vaga.status_vaga || vaga.status || 'Status desconhecido';
        
        htmlOptions += `<option value="${doc.id}">${titulo} - (${status})</option>`;
      });
    }
    
    filtroVaga.innerHTML = htmlOptions;

    // Tenta carregar vaga do parâmetro da URL ou a primeira vaga
    const urlParams = new URLSearchParams(window.location.search);
    const vagaFromUrl = urlParams.get("vaga");

    if (vagaFromUrl) {
      vagaSelecionadaId = vagaFromUrl;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    } else if (snapshot.size > 0 && filtroVaga.options.length > 1) {
      vagaSelecionadaId = snapshot.docs[0].id;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    }

    const etapaFromUrl = urlParams.get("etapa");
    if (etapaFromUrl) {
      const targetTab = statusCandidaturaTabs.querySelector(
        `[data-status="${etapaFromUrl}"]`
      );
      if (targetTab) {
        handleTabClick({ currentTarget: targetTab });
      }
    }
  } catch (error) {
    console.error("❌ Erro ao carregar vagas ativas:", error);
    if (window.showToast) {
      window.showToast("Erro ao carregar lista de vagas.", "error");
    } else {
      alert("Erro ao carregar lista de vagas.");
    }
  }
}

// =====================================================================
// INÍCIO: LÓGICA DO MODAL DE EDIÇÃO DE CRONOGRAMA
// =====================================================================

/**
 * Abre o modal de edição e carrega os dados atuais da vaga.
 * @param {string} vagaId O ID da vaga para carregar.
 * @param {object} dadosAtuais Os dados atuais de cronograma e orçamento.
 */
window.abrirModalCronograma = function (vagaId, dadosAtuais) {
    if (!modalEdicaoCronograma) {
        if (window.showToast) {
            window.showToast("Erro: O modal de edição (div#modal-edicao-cronograma) não foi encontrado na página. Por favor, adicione a estrutura HTML do modal ao seu recrutamento.html.", "error");
        } else {
            alert("Erro: Estrutura do Modal de Edição de Cronograma não encontrada.");
        }
        return;
    }
    
    // 1. Preenche os campos do modal com os dados atuais (IDs devem ser os mesmos do HTML do modal)
    document.getElementById("modal-data-inicio-recrutamento").value = dadosAtuais.data_inicio_recrutamento || '';
    document.getElementById("modal-data-fechamento-recrutamento").value = dadosAtuais.data_fechamento_recrutamento || '';
    document.getElementById("modal-data-contratacao-prevista").value = dadosAtuais.data_contratacao_prevista || '';
    // Garante que o orçamento seja formatado como string, se existir
    document.getElementById("modal-orcamento-previsto").value = dadosAtuais.orcamento_previsto ? dadosAtuais.orcamento_previsto.toFixed(2) : '';
    document.getElementById("modal-fonte-orcamento").value = dadosAtuais.fonte_orcamento || '';
    document.getElementById("modal-detalhes-cronograma").value = dadosAtuais.detalhes_cronograma || '';
    
    // 2. Armazena o ID atual para uso na função de salvar
    modalEdicaoCronograma.dataset.vagaId = vagaId;
    
    // 3. Exibe o modal
    modalEdicaoCronograma.classList.add("is-visible");
}

/**
 * Fecha o modal de edição.
 */
function fecharModalCronograma() {
    if (modalEdicaoCronograma) {
        modalEdicaoCronograma.classList.remove("is-visible");
    }
}

/**
 * Função de salvamento para o modal (Ajustar).
 */
async function salvarAjustesCronograma(e) {
    e.preventDefault();

    const btnSalvarModal = document.getElementById("btn-salvar-modal-cronograma");
    const vagaId = modalEdicaoCronograma.dataset.vagaId;
    
    if (!vagaId) {
        alert("Erro: ID da vaga não encontrado.");
        return;
    }
    
    const dataInicio = document.getElementById("modal-data-inicio-recrutamento").value;
    const dataFechamento = document.getElementById("modal-data-fechamento-recrutamento").value;

    if (!dataInicio || !dataFechamento) {
        alert("Por favor, preencha as datas de início e encerramento do recrutamento.");
        return;
    }

    btnSalvarModal.disabled = true;
    btnSalvarModal.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

    const dadosEdicao = {
        data_inicio_recrutamento: dataInicio,
        data_fechamento_recrutamento: dataFechamento,
        data_contratacao_prevista: document.getElementById("modal-data-contratacao-prevista").value,
        orcamento_previsto: parseFloat(document.getElementById("modal-orcamento-previsto").value || 0),
        fonte_orcamento: document.getElementById("modal-fonte-orcamento").value,
        detalhes_cronograma: document.getElementById("modal-detalhes-cronograma").value,
        ultima_atualizacao_recrutamento: serverTimestamp(),
    };

    try {
        const vagaRef = doc(vagasCollection, vagaId);
        await updateDoc(vagaRef, dadosEdicao);

        if (window.showToast) {
            window.showToast("Cronograma e Orçamento ajustados com sucesso!", "success");
        } else {
            alert("Cronograma e Orçamento ajustados com sucesso!");
        }

        // Recarrega a aba Cronograma para atualizar os dados em tela sem sair da página.
        await renderizarCronograma(); 
        
        fecharModalCronograma();

    } catch (error) {
        console.error("❌ Erro ao salvar ajustes:", error);
        
        if (window.showToast) {
            window.showToast("Erro ao salvar os ajustes: " + error.message, "error");
        } else {
            alert("Erro ao salvar os ajustes. Detalhes: " + error.message);
        }
    } finally {
        btnSalvarModal.disabled = false;
        btnSalvarModal.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Ajustes';
    }
}
// =====================================================================
// FIM: LÓGICA DO MODAL DE EDIÇÃO DE CRONOGRAMA
// =====================================================================


// =====================================================================
// FUNÇÕES DE RENDERIZAÇÃO POR ABA
// =====================================================================

async function renderizarCronograma() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Selecione uma vaga para iniciar a gestão do cronograma.</p>';
    return;
  }

  let vagaNome = filtroVaga.options[filtroVaga.selectedIndex].text;

  // Tenta carregar os dados de cronograma da vaga
  let dadosCronograma = {
    data_inicio_recrutamento: "N/A",
    data_fechamento_recrutamento: "N/A",
    data_contratacao_prevista: "N/A",
    orcamento_previsto: 0,
    detalhes_cronograma: "Não informado.",
    fonte_orcamento: "Não informado.",
  };

  try {
    const vagaDoc = await getDoc(doc(vagasCollection, vagaSelecionadaId));
    if (vagaDoc.exists()) {
      const vagaData = vagaDoc.data();
      dadosCronograma = {
        data_inicio_recrutamento: vagaData.data_inicio_recrutamento || "N/A",
        data_fechamento_recrutamento:
          vagaData.data_fechamento_recrutamento || "N/A",
        data_contratacao_prevista: vagaData.data_contratacao_prevista || "N/A",
        orcamento_previsto: vagaData.orcamento_previsto || 0,
        fonte_orcamento: vagaData.fonte_orcamento || "Não informado.",
        detalhes_cronograma: vagaData.detalhes_cronograma || "Não informado.",
      };
    }
  } catch (e) {
    console.error("Erro ao carregar cronograma da vaga:", e);
  }
  
  // Serializa o objeto dadosCronograma e escapa as aspas para usar no onclick
  // Isso permite passar os dados diretamente para a função sem precisar de um novo fetch
  const dadosCronogramaJson = JSON.stringify(dadosCronograma).replace(/"/g, '&quot;');

  conteudoRecrutamento.innerHTML = `
    <div class="painel-cronograma card card-shadow p-4">
      <h3>Cronograma e Orçamento da Vaga: ${vagaNome}</h3>
      
      <div class="detalhes-cronograma-resumo mb-4">
        <p><strong>Início Previsto do Recrutamento:</strong> ${dadosCronograma.data_inicio_recrutamento}</p>
        <p><strong>Término Previsto do Recrutamento:</strong> ${dadosCronograma.data_fechamento_recrutamento}</p>
        <p><strong>Contratação Prevista:</strong> ${dadosCronograma.data_contratacao_prevista}</p>
        <p><strong>Orçamento Estimado:</strong> R$ ${dadosCronograma.orcamento_previsto.toFixed(2)} (${dadosCronograma.fonte_orcamento})</p>
        <p><strong>Observações:</strong> ${dadosCronograma.detalhes_cronograma}</p>
      </div>
      
      <button type="button" class="action-button secondary" 
            onclick='window.abrirModalCronograma("${vagaSelecionadaId}", ${dadosCronogramaJson})'>
        <i class="fas fa-edit me-2"></i> Editar/Ajustar
      </button>
      </div>
  `;
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
    '<div class="loading-spinner">Carregando candidaturas para Triagem...</div>';

  try {
    // Busca candidatos para a vaga que ainda não passaram da triagem (ou foram reprovados nela)
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId), // Usando vaga_id conforme o plano anterior
      where("status_recrutamento", "in", [
        "Candidatura Recebida (Triagem Pendente)", // Novo status inicial
        "Triagem Aprovada (Entrevista Pendente)", // Já passou, mas pode precisar de revisão
        "Triagem Reprovada (Encerrada)", // Rejeitado na triagem
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const triagemTab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="triagem"]'
    );
    if (triagemTab)
      triagemTab.textContent = `2. Triagem de Currículo (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidatura para triagem ou todas já foram processadas.</p>';
      return;
    }

    let listaHtml = `
    <div class="list-candidaturas">
      <h3>Candidaturas na Fase de Triagem (${snapshot.size})</h3>
      <p>Clique em "Avaliar Candidatura" para abrir o painel de avaliação detalhada.</p>
  `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusTriagem = cand.status_recrutamento || "Aguardando Triagem";
      let corStatus = "secondary";

      if (statusTriagem.includes("Aprovada")) {
        corStatus = "success";
      } else if (statusTriagem.includes("Reprovada")) {
        corStatus = "danger";
      } else if (statusTriagem.includes("Recebida")) {
        corStatus = "info";
      }

      listaHtml += `
      <div class="card card-candidato" data-id="${doc.id}">
        <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
        <p>Status: <span class="badge bg-${corStatus}">${statusTriagem.replace(
        "_",
        " "
      )}</span></p>
        <p class="small-info">Email: ${cand.email} | Tel: ${
        cand.telefone_contato || "N/A"
      }</p>
                <div class="acoes-candidato">
        <a href="etapa_triagem.html?candidatura=${
          doc.id
        }&vaga=${vagaSelecionadaId}" class="btn btn-sm btn-primary">
                    <i class="fas fa-file-alt me-2"></i> Avaliar Candidatura
                </a>
                <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
                  doc.id
                }">Detalhes</button>
                </div>
      </div>
    `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // Configura evento para abrir modal de detalhes
    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        abrirModalCandidato(candidatoId, "detalhes");
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar triagem:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações.
 */
async function renderizarEntrevistas() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos em Entrevistas/Avaliações...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Triagem Aprovada (Entrevista Pendente)",
        "Entrevista RH Aprovada (Testes Pendente)",
        "Testes Pendente",
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="entrevistas"]'
    );
    if (tab) tab.textContent = `3. Entrevistas e Avaliações (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidato na fase de Entrevistas/Avaliações.</p>';
      return;
    }

    let listaHtml = `
            <div class="list-candidaturas">
                <h3>Candidaturas em Entrevistas e Testes (${snapshot.size})</h3>
                <p>Gerencie as etapas de Entrevista com RH, Testes e Estudos de Caso. (Link de etapa a ser criado)</p>
        `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      // Lógica para determinar a URL da próxima página (Entrevista RH ou Aplicação de Testes)
      let proximaEtapaUrl = "";
      let acaoBotao = "";
      if (statusAtual.includes("Entrevista Pendente")) {
        proximaEtapaUrl = `etapa_entrevista_rh.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
        acaoBotao = "Entrevista RH";
      } else if (statusAtual.includes("Testes Pendente")) {
        proximaEtapaUrl = `etapa_aplicacao_testes.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
        acaoBotao = "Aplicar Testes";
      } else {
        proximaEtapaUrl = `etapa_entrevista_rh.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
        acaoBotao = "Ver Etapa";
      }

      let corStatus = "primary";
      if (statusAtual.includes("Aprovada")) corStatus = "success";

      listaHtml += `
                <div class="card card-candidato" data-id="${doc.id}">
                    <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
                    <p>Status: <span class="badge bg-${corStatus}">${statusAtual}</span></p>
                    <p class="small-info">Ação: ${acaoBotao}</p>
                    <div class="acoes-candidato">
                    <a href="${proximaEtapaUrl}" class="btn btn-sm btn-info">
                        <i class="fas fa-play me-2"></i> ${acaoBotao}
                    </a>
                    <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
                      doc.id
                    }">Detalhes</button>
                    </div>
                </div>
            `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        abrirModalCandidato(candidatoId, "detalhes");
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar entrevistas:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
  }
}

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 */
async function renderizarEntrevistaGestor() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos para Entrevista com Gestor...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where(
        "status_recrutamento",
        "==",
        "Testes Aprovado (Entrevista Gestor Pendente)"
      )
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidato na fase de Entrevista com Gestor.</p>';
      return;
    }

    let listaHtml = `
            <div class="list-candidaturas">
                <h3>Candidaturas na Fase Entrevista com Gestor (${snapshot.size})</h3>
                <p>Avaliação final antes da comunicação e contratação.</p>
        `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      listaHtml += `
                <div class="card card-candidato" data-id="${doc.id}">
                    <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
                    <p>Status: <span class="badge bg-primary">${statusAtual}</span></p>
                    <p class="small-info">Etapa: Entrevista com Gestor.</p>
                    <div class="acoes-candidato">
                    <a href="etapa_entrevista_gestor.html?candidatura=${
                      doc.id
                    }&vaga=${vagaSelecionadaId}" class="btn btn-sm btn-info">
                        <i class="fas fa-user-tie me-2"></i> Avaliar Gestor
                    </a>
                    <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
                      doc.id
                    }">Detalhes</button>
                    </div>
                </div>
            `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        abrirModalCandidato(candidatoId, "detalhes");
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar entrevista gestor:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}

/**
 * Renderiza a listagem de candidatos na etapa de Finalizados (Contratados ou Rejeitados na fase final).
 */
async function renderizarFinalizados() {
  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos finalizados...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Contratado",
        "Rejeitado (Comunicação Final)",
        "Triagem Reprovada (Encerrada)",
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="finalizados"]'
    );
    if (tab) tab.textContent = `5. Finalizados (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidatura finalizada para esta vaga.</p>';
      return;
    }

    let listaHtml = `
            <div class="list-candidaturas">
                <h3>Candidaturas Finalizadas (${snapshot.size})</h3>
                <p>Lista de candidatos contratados ou que receberam comunicação final de rejeição.</p>
        `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "secondary";
      if (statusAtual.includes("Contratado")) corStatus = "success";
      else if (
        statusAtual.includes("Rejeitado") ||
        statusAtual.includes("Reprovada")
      )
        corStatus = "danger";

      listaHtml += `
                <div class="card card-candidato" data-id="${doc.id}">
                    <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
                    <p>Status: <span class="badge bg-${corStatus}">${statusAtual}</span></p>
                    <div class="acoes-candidato">
                    <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
                      doc.id
                    }">Ver Histórico</button>
                    </div>
                </div>
            `;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        abrirModalCandidato(candidatoId, "detalhes");
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar finalizados:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos finalizados: ${error.message}</p>`;
  }
}

/**
 * Abre o modal de visualização/detalhes do candidato.
 * @param {string} candidatoId
 * @param {string} modo - 'detalhes'
 */
async function abrirModalCandidato(candidatoId, modo) {
  if (!modalCandidato || !modalCandidatoBody) return;

  modalCandidatoBody.innerHTML =
    '<div class="loading-spinner">Carregando dados do candidato...</div>';
  modalCandidatoFooter.innerHTML =
    '<button type="button" class="btn btn-secondary fechar-modal-candidato">Fechar</button>';

  try {
    const candSnap = await getDoc(doc(candidatosCollection, candidatoId));

    if (!candSnap.exists()) {
      modalCandidatoBody.innerHTML =
        '<p class="alert alert-danger">Candidatura não encontrada.</p>';
      return;
    }

    const candidato = candSnap.data();
    document.getElementById("candidato-nome-titulo").textContent = `Detalhes: ${
      candidato.nome_completo || "N/A"
    }`;

    // --- Geração do Conteúdo Detalhes ---
    let contentHtml = `
        <div class="row detalhes-candidato-modal">
            <div class="col-md-6">
                <h5>Informações Pessoais</h5>
                <p><strong>Email:</strong> ${candidato.email}</p>
                <p><strong>Telefone (WhatsApp):</strong> ${
                  candidato.telefone_contato || "N/A"
                }</p>
                <p><strong>Vaga Aplicada:</strong> ${
                  candidato.titulo_vaga_original || "N/A"
                }</p>
                <p><strong>Localidade:</strong> ${
                  candidato.cidade || "N/A"
                } / ${candidato.estado || "UF"}</p>
                <p><strong>Status Atual:</strong> <span class="badge bg-primary">${
                  candidato.status_recrutamento || "N/A"
                }</span></p>
            </div>
            <div class="col-md-6">
                <h5>Experiência e Arquivos</h5>
                <p><strong>Resumo Experiência:</strong> ${
                  candidato.resumo_experiencia || "Não informado"
                }</p>
                <p><strong>Habilidades:</strong> ${
                  candidato.habilidades_competencias || "Não informadas"
                }</p>
                <p><strong>Currículo:</strong> 
                    <a href="${
                      candidato.link_curriculo_drive || "#"
                    }" target="_blank" class="btn btn-sm btn-info ${
      !candidato.link_curriculo_drive ? "disabled" : ""
    }">
                        <i class="fas fa-file-pdf"></i> Ver Currículo
                    </a>
                </p>
            </div>
        </div>
        
        <hr>
        
        <div class="historico-candidatura">
            <h5>Histórico de Avaliações</h5>
            ${
              candidato.triagem_rh
                ? `
                <h6>Triagem RH</h6>
                <p><strong>Decisão:</strong> ${
                  candidato.triagem_rh.apto_entrevista
                } | 
                <strong>Data:</strong> ${formatarTimestamp(
                  candidato.triagem_rh.data_avaliacao
                )}</p>
                <p class="small-info">Comentários: ${
                  candidato.triagem_rh.comentarios_gerais || "N/A"
                }</p>
            `
                : "<p>Ainda não avaliado na Triagem RH.</p>"
            }
            
            ${
              candidato.rejeicao?.etapa
                ? `
                <h6 class="text-danger">Rejeição Registrada</h6>
                <p><strong>Etapa:</strong> ${candidato.rejeicao.etapa} | 
                <strong>Data:</strong> ${formatarTimestamp(
                  candidato.rejeicao.data
                )}</p>
                <p class="small-info">Justificativa: ${
                  candidato.rejeicao.justificativa || "N/A"
                }</p>
            `
                : ""
            }
            
        </div>
    `;

    modalCandidatoBody.innerHTML = contentHtml;
    modalCandidato.style.display = "flex";
  } catch (error) {
    console.error(`Erro ao abrir modal de candidato (${modo}):`, error);
    modalCandidatoBody.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar os detalhes da candidatura.</p>';
  }
}

// Manter a função reprovarCandidatura no escopo global para compatibilidade
window.reprovarCandidatura = async function (
  candidatoId,
  etapa,
  justificativaFicha = null
) {
  let justificativa =
    justificativaFicha ||
    prompt(
      `Confirme a reprovação do candidato nesta etapa (${etapa}). Informe a justificativa:`
    );

  if (!justificativa || justificativa.trim() === "") {
    if (window.showToast) {
      window.showToast(
        "A justificativa de reprovação é obrigatória.",
        "warning"
      );
    } else {
      alert("A justificativa de reprovação é obrigatória.");
    }
    return;
  }

  if (!confirm(`Confirmar reprovação na etapa ${etapa}?`)) return;

  try {
    // Atualiza o status
    const candidatoRef = doc(candidatosCollection, candidatoId);

    await updateDoc(candidatoRef, {
      status_recrutamento: "Rejeitado (Comunicação Pendente)",
      "rejeicao.etapa": etapa,
      "rejeicao.data": firebase.firestore.FieldValue.serverTimestamp(),
      "rejeicao.justificativa": justificativa,
      // Adicionar ao histórico principal (usando arrayUnion)
      historico: arrayUnion({
        data: firebase.firestore.FieldValue.serverTimestamp(),
        acao: `Candidatura REJEITADA na etapa de ${etapa}. Motivo: ${justificativa}`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    if (window.showToast) {
      window.showToast(`Candidatura rejeitada na etapa ${etapa}.`, "error");
    } else {
      alert("Candidatura rejeitada.");
    }
    // Se o modal estiver aberto, feche
    modalCandidato.style.display = "none";

    // Recarrega a listagem atual
    const activeStatus = statusCandidaturaTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");
    if (activeStatus === "triagem") renderizarTriagem();
    else if (activeStatus === "entrevistas") renderizarEntrevistas();
    else if (activeStatus === "gestor") renderizarEntrevistaGestor();
  } catch (error) {
    console.error("Erro ao reprovar candidato:", error);
    if (window.showToast) {
      window.showToast("Erro ao reprovar candidato.", "error");
    } else {
      alert("Erro ao reprovar candidato.");
    }
  }
};

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
      renderizarEntrevistas();
      break;
    case "gestor":
      renderizarEntrevistaGestor();
      break;
    case "finalizados":
      renderizarFinalizados();
      break;
    case "gestao-conteudo":
      // Redirecionamento direto para o módulo de gestão de estudos
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
        const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");
        if (activeTab) handleTabClick({ currentTarget: activeTab });
      });
    });
  }
  
  // 4. NOVO: Configurar eventos do Modal de Edição de Cronograma (agora no recrutamento.js)
  if (formEdicaoCronograma) {
      formEdicaoCronograma.addEventListener("submit", salvarAjustesCronograma);
  }
  
  if (modalEdicaoCronograma) {
      // Listeners para fechar o modal (botão X e botão Cancelar)
      document.querySelectorAll("[data-modal-id='modal-edicao-cronograma']").forEach((btn) => {
          btn.addEventListener("click", fecharModalCronograma);
      });
      // Fechar o modal clicando no overlay
      modalEdicaoCronograma.addEventListener('click', (e) => {
        if (e.target === modalEdicaoCronograma) {
          fecharModalCronograma();
        }
      });
  }
}

// ✅ ADICIONE ESTA LINHA PARA COMPATIBILIDADE COM O ROTEADOR
export { initRecrutamento as init };