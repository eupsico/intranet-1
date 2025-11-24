/**
 * Arquivo: /modulos/voluntario/js/assinaturas-termos.js
 * Versão: 3.0.0 (Cards Individuais e CSS Melhorado)
 */

import {
  db,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

let currentUser = null;
let solicitacoesCarregadas = []; // Cache local

export async function init(user, userData) {
  currentUser = user;
  const fase1Container = document.getElementById("fase1-container");
  const fase2Container = document.getElementById("fase2-container");
  const historicoContainer = document.getElementById(
    "historico-geral-container"
  );

  if (!fase1Container) return;

  fase1Container.innerHTML = '<div class="loading-spinner"></div>';
  solicitacoesCarregadas = []; // Reset

  try {
    const assinaturasRef = collection(db, "solicitacoes_assinatura");

    // Busca pelo UID do usuário
    const q = query(
      assinaturasRef,
      where("usuarioUid", "==", user.uid),
      orderBy("dataEnvio", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      renderEmptyState(fase1Container, fase2Container);
      return;
    }

    // Salva no cache
    snapshot.forEach((doc) => {
      solicitacoesCarregadas.push({ id: doc.id, ...doc.data() });
    });

    renderizarDocumentos(
      solicitacoesCarregadas,
      fase1Container,
      fase2Container,
      historicoContainer
    );
  } catch (error) {
    console.error("Erro ao carregar termos:", error);
    // Tratamento para erro de índice
    if (error.message.includes("index")) {
      fase1Container.innerHTML =
        '<p class="alert alert-warning">O sistema está otimizando a busca (índice em criação). Tente novamente em alguns minutos.</p>';
    } else {
      fase1Container.innerHTML = `<p class="alert alert-error">Erro ao carregar documentos: ${error.message}</p>`;
    }
  }
}

function renderEmptyState(c1, c2) {
  c1.innerHTML = '<p class="text-muted">Nenhum documento pendente.</p>';
  c2.innerHTML = '<p class="text-muted">Aguardando novos termos.</p>';
}

function renderizarDocumentos(
  listaSolicitacoes,
  containerF1,
  containerF2,
  containerHist
) {
  containerF1.innerHTML = "";
  containerF2.innerHTML = "";
  containerHist.innerHTML = "";

  let temF1 = false;
  let temF2 = false;

  // Itera sobre as solicitações (pacotes de envio)
  listaSolicitacoes.forEach((solicitacao) => {
    const solicitacaoId = solicitacao.id;
    const dataEnvio = solicitacao.dataEnvio
      ? new Date(solicitacao.dataEnvio.seconds * 1000)
      : new Date();
    const dataFormatada = dataEnvio.toLocaleDateString("pt-BR");
    const fase = solicitacao.fase || 1;

    const documentos = solicitacao.documentos || [];

    // Itera sobre CADA DOCUMENTO dentro do pacote para criar cards individuais
    documentos.forEach((docItem, index) => {
      const titulo = docItem.titulo || "Documento sem título";
      const statusItem = docItem.status || "pendente"; // Status individual do item

      // Se estiver pendente, cria Card
      if (statusItem === "pendente") {
        const cardHtml = criarCardAceite(
          solicitacaoId,
          index,
          titulo,
          dataFormatada
        );

        if (fase === 1) {
          containerF1.innerHTML += cardHtml;
          temF1 = true;
        } else {
          containerF2.innerHTML += cardHtml;
          temF2 = true;
        }
      }
      // Se já assinado, cria item de histórico
      else {
        const dataAceite = docItem.dataAceite
          ? new Date(docItem.dataAceite.seconds * 1000).toLocaleDateString(
              "pt-BR"
            )
          : dataFormatada;
        containerHist.innerHTML += criarItemHistorico(
          titulo,
          dataAceite,
          solicitacaoId,
          index
        );
      }
    });
  });

  if (!temF1)
    containerF1.innerHTML =
      '<p class="text-muted">Você está em dia com a Fase 1.</p>';
  if (!temF2)
    containerF2.innerHTML =
      '<p class="text-muted">Nada pendente para a Fase 2.</p>';
  if (containerHist.innerHTML === "")
    containerHist.innerHTML = '<p class="text-muted">Histórico vazio.</p>';

  // Adiciona listeners
  adicionarListenersAceite();
  adicionarListenersVerHistorico();
}

function criarCardAceite(solicitacaoId, docIndex, titulo, dataTexto) {
  return `
        <div class="document-card status-pendente" id="card-${solicitacaoId}-${docIndex}">
            <div class="doc-header">
                <div class="doc-icon-wrapper"><i class="fas fa-file-contract doc-icon"></i></div>
                <div class="doc-info">
                    <h3>${titulo}</h3>
                    <p>Disponibilizado em: ${dataTexto}</p>
                    <span class="doc-meta">Aguardando sua assinatura</span>
                </div>
            </div>
            <div class="doc-actions">
                <button class="btn-assinar btn-ler-aceitar" data-sol-id="${solicitacaoId}" data-index="${docIndex}" data-titulo="${titulo}">
                    Ler e Assinar <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
}

function criarItemHistorico(titulo, dataAceite, solicitacaoId, docIndex) {
  return `
        <div class="doc-item-list">
            <div>
                <strong>${titulo}</strong>
                <br><small style="color:#28a745">Assinado em: ${dataAceite}</small>
            </div>
            <div>
                 <button class="action-button secondary small btn-ver-historico" data-sol-id="${solicitacaoId}" data-index="${docIndex}" title="Ler documento assinado">
                    <i class="fas fa-eye"></i> Ver
                 </button>
            </div>
        </div>
    `;
}

function adicionarListenersAceite() {
  document.querySelectorAll(".btn-ler-aceitar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const solId = e.currentTarget.dataset.solId;
      const index = parseInt(e.currentTarget.dataset.index);
      abrirModalLeitura(solId, index, true); // true = permite assinar
    });
  });
}

function adicionarListenersVerHistorico() {
  document.querySelectorAll(".btn-ver-historico").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const solId = e.currentTarget.dataset.solId;
      const index = parseInt(e.currentTarget.dataset.index);
      abrirModalLeitura(solId, index, false); // false = apenas leitura
    });
  });
}

// --- Lógica do Modal de Leitura ---

async function abrirModalLeitura(solicitacaoId, docIndex, permiteAssinar) {
  const modal = document.getElementById("modal-leitura-documento");
  const tituloEl = document.getElementById("titulo-documento-modal");
  const conteudoEl = document.getElementById("conteudo-documento-viewer");
  const btnConfirmar = document.getElementById("btn-confirmar-leitura-aceite");

  // Encontra a solicitação e o documento específico
  const solicitacao = solicitacoesCarregadas.find(
    (s) => s.id === solicitacaoId
  );
  if (!solicitacao || !solicitacao.documentos[docIndex]) {
    alert("Erro: Documento não encontrado.");
    return;
  }

  const docItem = solicitacao.documentos[docIndex];

  // Configura Modal
  modal.style.display = "flex";
  conteudoEl.innerHTML =
    '<div class="loading-spinner"></div><p style="text-align:center; margin-top:20px;">Carregando documento...</p>';
  tituloEl.textContent = "Visualização de Documento";

  // Configura Botão de Ação
  if (permiteAssinar) {
    btnConfirmar.style.display = "inline-flex";
    // Remove listener antigo para evitar múltiplos disparos
    const novoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);
    novoBtn.onclick = () =>
      confirmarAceiteIndividual(solicitacaoId, docIndex, docItem.titulo);
  } else {
    document.getElementById("btn-confirmar-leitura-aceite").style.display =
      "none";
  }

  // Busca conteúdo
  try {
    const conteudo = await buscarConteudoModelo(docItem.modeloId);

    // Renderiza com a classe de estilo de papel
    let htmlFinal = `
            <div class="document-paper">
                <h1 class="doc-title">${docItem.titulo}</h1>
                ${conteudo}
        `;

    // Adiciona rodapé se já assinado
    if (!permiteAssinar && docItem.dataAceite) {
      const dataAceite = new Date(
        docItem.dataAceite.seconds * 1000
      ).toLocaleString("pt-BR");
      htmlFinal += `
                <div style="margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 0.9em; color: #666;">
                    <p><strong>Assinatura Digital:</strong></p>
                    <p>Este documento foi lido e aceito eletronicamente pelo usuário logado em <strong>${dataAceite}</strong>.</p>
                    <p>ID Usuário: ${currentUser.uid}</p>
                </div>
            </div>`; // Fecha document-paper
    } else {
      htmlFinal += `</div>`; // Fecha document-paper
    }

    conteudoEl.innerHTML = htmlFinal;
  } catch (error) {
    console.error("Erro ao carregar conteúdo:", error);
    conteudoEl.innerHTML = `<p class="alert alert-error">Não foi possível carregar o texto do documento.</p>`;
  }
}

// Helper para buscar o HTML do modelo
async function buscarConteudoModelo(modeloId) {
  if (!modeloId) return "<p><em>Conteúdo não vinculado.</em></p>";

  try {
    // Tenta coleção principal
    let docRef = doc(db, "rh_documentos_modelos", modeloId);
    let docSnap = await getDoc(docRef);

    // Fallback
    if (!docSnap.exists()) {
      docRef = doc(db, "modelos_documentos", modeloId);
      docSnap = await getDoc(docRef);
    }

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Prioriza 'texto_conteudo'
      let texto = data.texto_conteudo || data.conteudo || data.descricao;

      if (texto) {
        // Se o texto não tiver tags HTML, adiciona quebras de linha
        if (!texto.includes("<p>") && !texto.includes("<div>")) {
          return texto.replace(/\n/g, "<br>");
        }
        return texto;
      } else {
        return "<p>Documento sem conteúdo de texto.</p>";
      }
    } else {
      return "<p><em>Erro: Modelo original não encontrado.</em></p>";
    }
  } catch (e) {
    console.error("Erro fetch modelo:", e);
    return "<p><em>Erro ao baixar conteúdo.</em></p>";
  }
}

/**
 * Atualiza APENAS o item específico no array de documentos
 */
async function confirmarAceiteIndividual(solicitacaoId, docIndex, titulo) {
  if (!confirm(`Confirma que leu e está de acordo com "${titulo}"?`)) return;

  const btn = document.getElementById("btn-confirmar-leitura-aceite");
  btn.disabled = true;
  btn.innerHTML = "Assinando...";

  try {
    // 1. Pega o documento atual completo do Firestore
    const solicitacaoRef = doc(db, "solicitacoes_assinatura", solicitacaoId);
    const solicitacaoSnap = await getDoc(solicitacaoRef);

    if (!solicitacaoSnap.exists())
      throw new Error("Solicitação não encontrada.");

    const dadosAtuais = solicitacaoSnap.data();
    const documentosArray = dadosAtuais.documentos;

    // 2. Atualiza o item específico no array
    if (documentosArray[docIndex]) {
      documentosArray[docIndex].status = "assinado";
      documentosArray[docIndex].dataAceite = Timestamp.now(); // Usando Timestamp importado
      documentosArray[docIndex].aceitePorUid = currentUser.uid;
    } else {
      throw new Error("Índice de documento inválido.");
    }

    // 3. Verifica se TODOS foram assinados para atualizar status geral (opcional, mas bom)
    const todosAssinados = documentosArray.every(
      (d) => d.status === "assinado"
    );
    const statusGeral = todosAssinados ? "concluido" : "pendente";

    // 4. Salva o array atualizado de volta
    await updateDoc(solicitacaoRef, {
      documentos: documentosArray,
      status: statusGeral,
      ultimoAceiteEm: serverTimestamp(),
    });

    alert("Documento assinado com sucesso!");
    window.fecharModalLeitura();

    // Recarrega a lista (chamada recursiva do init)
    const { init } = await import("./assinaturas-termos.js");
    // Em produção real, seria melhor ter uma função refresh separada, mas isso funciona.
    // O ideal é manipular o DOM para remover o card.

    const card = document.getElementById(`card-${solicitacaoId}-${docIndex}`);
    if (card) {
      card.style.opacity = "0";
      setTimeout(() => card.remove(), 500);
    }

    // Adiciona visualmente ao histórico (opcional, o reload na próxima visita fará isso)
  } catch (error) {
    console.error("Erro ao registrar aceite:", error);
    alert("Erro ao registrar. Tente novamente.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Li e Estou de Acordo';
  }
}

// Import Timestamp no topo para usar no array
import { Timestamp } from "../../../assets/js/firebase-init.js";

window.fecharModalLeitura = function () {
  document.getElementById("modal-leitura-documento").style.display = "none";
};
