// Arquivo: /modulos/voluntario/js/assinaturas-termos.js
// Versão: 1.0.0
// Descrição: Gerencia a exibição de contratos e termos institucionais, dividindo por fases.

import {
  db,
  collection,
  query,
  where,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const fase1Container = document.getElementById("fase1-container");
  const fase2Container = document.getElementById("fase2-container");
  const historicoContainer = document.getElementById(
    "historico-geral-container"
  );

  if (!fase1Container) return;

  fase1Container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // 1. Busca a candidatura do usuário para pegar os documentos e a data de início
    const candidaturasRef = collection(db, "candidaturas");

    // Tenta buscar pelo email corporativo (padrão)
    let q = query(
      candidaturasRef,
      where("admissaoinfo.email_solicitado", "==", user.email)
    );
    let snapshot = await getDocs(q);

    // Fallback: Tenta email pessoal se não achar pelo corporativo
    if (snapshot.empty) {
      q = query(candidaturasRef, where("email_candidato", "==", user.email));
      snapshot = await getDocs(q);
    }

    if (snapshot.empty) {
      renderEmptyState(fase1Container, fase2Container);
      return;
    }

    const candidaturaData = snapshot.docs[0].data();
    const documentosEnviados = candidaturaData.documentos_enviados || [];

    // Data de Início (Usa data_candidatura ou timestamp atual como fallback)
    const dataInicio = candidaturaData.data_candidatura
      ? candidaturaData.data_candidatura.toDate()
      : new Date();

    renderizarDocumentosPorFase(
      documentosEnviados,
      dataInicio,
      fase1Container,
      fase2Container,
      historicoContainer
    );
  } catch (error) {
    console.error("Erro ao carregar termos:", error);
    fase1Container.innerHTML =
      '<p class="alert alert-error">Erro ao carregar documentos.</p>';
  }
}

function renderEmptyState(c1, c2) {
  c1.innerHTML =
    '<p class="text-muted">Nenhum documento de admissão encontrado.</p>';
  c2.innerHTML = '<p class="text-muted">Aguardando período de efetivação.</p>';
}

function renderizarDocumentosPorFase(
  envios,
  dataInicio,
  containerF1,
  containerF2,
  containerHist
) {
  containerF1.innerHTML = "";
  containerF2.innerHTML = "";
  containerHist.innerHTML = "";

  let temF1 = false;
  let temF2 = false;

  // Calcula data de corte (3 meses = 90 dias)
  const dataCorteFase2 = new Date(dataInicio);
  dataCorteFase2.setDate(dataCorteFase2.getDate() + 90);

  // Itera sobre os envios
  envios.forEach((envio) => {
    if (!envio.data_envio) return;

    const dataEnvioDoc = new Date(envio.data_envio.seconds * 1000);

    // LÓGICA DE FASES: Se enviado antes de 90 dias do início, é Fase 1.
    const isFase1 = dataEnvioDoc <= dataCorteFase2;

    const nomesDocs = envio.documentos
      ? envio.documentos.map((d) => d.titulo).join(", ")
      : "Documentos Diversos";
    const dataFormatada = dataEnvioDoc.toLocaleDateString("pt-BR");

    // Cria o Card
    const cardHtml = criarCardDocumento(envio, nomesDocs, dataFormatada);
    const itemListaHtml = criarItemLista(envio, nomesDocs, dataFormatada);

    // Distribui nos containers
    if (envio.status === "enviado") {
      // Se está pendente/enviado (Card Principal)
      if (isFase1) {
        containerF1.innerHTML += cardHtml;
        temF1 = true;
      } else {
        containerF2.innerHTML += cardHtml;
        temF2 = true;
      }
    } else {
      // Se já foi assinado ou arquivado, vai para o histórico
      containerHist.innerHTML += itemListaHtml;
    }
  });

  if (!temF1)
    containerF1.innerHTML =
      '<p class="text-muted">Todos os documentos desta fase foram processados.</p>';
  if (!temF2)
    containerF2.innerHTML =
      '<p class="text-muted">Nenhum documento para a 2ª fase ainda.</p>';
  if (containerHist.innerHTML === "")
    containerHist.innerHTML = '<p class="text-muted">Histórico vazio.</p>';
}

function criarCardDocumento(envio, titulo, data) {
  return `
        <div class="document-card status-pendente">
            <div class="doc-header">
                <div class="doc-icon"><i class="fas fa-file-contract"></i></div>
                <div class="doc-info">
                    <h3>${titulo}</h3>
                    <p>Disponibilizado em: ${data}</p>
                    <span class="doc-meta">Requer assinatura digital Gov.br</span>
                </div>
            </div>
            <div class="doc-actions">
                <a href="${envio.link}" target="_blank" class="btn-assinar">
                    Assinar Documento <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    `;
}

function criarItemLista(envio, titulo, data) {
  // Status visual simples
  const statusLabel =
    envio.status === "enviado" ? "Pendente" : envio.status || "Arquivado";

  return `
        <div class="doc-item-list">
            <div>
                <strong>${titulo}</strong> <span style="font-size:0.85em; color:#666;">(${data})</span>
            </div>
            <div>
                 <span class="status-badge" style="background:#eee; padding:4px 8px; border-radius:4px; font-size:0.8em;">${statusLabel}</span>
            </div>
        </div>
    `;
}
