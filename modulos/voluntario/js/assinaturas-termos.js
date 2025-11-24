/**
 * Arquivo: /modulos/voluntario/js/assinaturas-termos.js
 * Versão: 2.2.0 (Leitura Real do Documento)
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
  serverTimestamp,
  getDoc,
} from "../../../assets/js/firebase-init.js";

let currentUser = null;
let solicitacoesCarregadas = []; // Cache local das solicitações

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

    // Salva no cache para usar no modal sem passar parâmetro complexo no HTML
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
    if (error.message.includes("index")) {
      fase1Container.innerHTML =
        '<p class="alert alert-warning">O sistema está otimizando a busca. Tente novamente em alguns minutos.</p>';
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

  listaSolicitacoes.forEach((data) => {
    const docId = data.id;
    const dataEnvio = data.dataEnvio
      ? new Date(data.dataEnvio.seconds * 1000)
      : new Date();
    const dataFormatada = dataEnvio.toLocaleDateString("pt-BR");

    const fase = data.fase || 1;
    const nomesDocs = data.documentos
      ? data.documentos.map((d) => d.titulo).join(", ")
      : "Termos Gerais";

    if (data.status === "pendente") {
      const cardHtml = criarCardAceite(docId, nomesDocs, dataFormatada);
      if (fase === 1) {
        containerF1.innerHTML += cardHtml;
        temF1 = true;
      } else {
        containerF2.innerHTML += cardHtml;
        temF2 = true;
      }
    } else {
      const dataAceite = data.dataAceite
        ? new Date(data.dataAceite.seconds * 1000).toLocaleDateString("pt-BR")
        : dataFormatada;
      containerHist.innerHTML += criarItemHistorico(
        nomesDocs,
        dataAceite,
        docId
      );
    }
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

function criarCardAceite(docId, titulo, dataTexto) {
  return `
        <div class="document-card status-pendente" id="card-${docId}">
            <div class="doc-header">
                <div class="doc-icon"><i class="fas fa-file-contract"></i></div>
                <div class="doc-info">
                    <h3>${titulo}</h3>
                    <p>Disponibilizado em: ${dataTexto}</p>
                    <span class="doc-meta">Requer leitura e aceite</span>
                </div>
            </div>
            <div class="doc-actions">
                <button class="btn-assinar btn-ler-aceitar" data-id="${docId}">
                    <i class="fas fa-book-open"></i> Ler e Assinar
                </button>
            </div>
        </div>
    `;
}

function criarItemHistorico(titulo, dataAceite, docId) {
  return `
        <div class="doc-item-list">
            <div>
                <strong>${titulo}</strong>
                <br><small style="color:#28a745">Aceito em: ${dataAceite}</small>
            </div>
            <div>
                 <button class="action-button secondary small btn-ver-historico" data-id="${docId}" title="Ler documento assinado">
                    <i class="fas fa-eye"></i>
                 </button>
            </div>
        </div>
    `;
}

function adicionarListenersAceite() {
  document.querySelectorAll(".btn-ler-aceitar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.dataset.id;
      abrirModalLeitura(docId, true); // true = permite assinar
    });
  });
}

function adicionarListenersVerHistorico() {
  document.querySelectorAll(".btn-ver-historico").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.dataset.id;
      abrirModalLeitura(docId, false); // false = apenas leitura (já assinado)
    });
  });
}

// --- Lógica do Modal de Leitura ---

async function abrirModalLeitura(solicitacaoId, permiteAssinar) {
  const modal = document.getElementById("modal-leitura-documento");
  const tituloEl = document.getElementById("titulo-documento-modal");
  const conteudoEl = document.getElementById("conteudo-documento-viewer");
  const btnConfirmar = document.getElementById("btn-confirmar-leitura-aceite");

  // Encontra a solicitação nos dados carregados
  const solicitacao = solicitacoesCarregadas.find(
    (s) => s.id === solicitacaoId
  );
  if (!solicitacao) {
    alert("Erro: Solicitação não encontrada.");
    return;
  }

  // Configura Modal
  modal.style.display = "flex";
  conteudoEl.innerHTML =
    '<div class="loading-spinner"></div><p style="text-align:center">Carregando conteúdo do documento...</p>';

  // Configura Botão de Ação
  if (permiteAssinar) {
    btnConfirmar.style.display = "inline-flex";
    btnConfirmar.onclick = () =>
      confirmarAceite(
        solicitacaoId,
        solicitacao.documentos.map((d) => d.titulo).join(", ")
      );
  } else {
    btnConfirmar.style.display = "none"; // Esconde se for histórico
  }

  tituloEl.textContent = solicitacao.documentos.map((d) => d.titulo).join(", ");

  // Busca o conteúdo real dos modelos
  try {
    let htmlFinal = "";

    // Itera sobre os documentos da solicitação (pode ser mais de um no pacote)
    for (const docItem of solicitacao.documentos) {
      const modeloId = docItem.modeloId;

      // Busca o conteúdo na coleção de modelos
      const conteudo = await buscarConteudoModelo(modeloId);

      htmlFinal += `
                <div class="documento-wrapper" style="margin-bottom: 40px; border-bottom: 2px dashed #ccc; padding-bottom: 20px;">
                    <h2 style="color: var(--cor-primaria); text-align: center;">${docItem.titulo}</h2>
                    <div class="documento-texto" style="line-height: 1.6; font-size: 1.1em;">
                        ${conteudo}
                    </div>
                </div>
            `;
    }

    // Adiciona dados de rodapé se já assinado
    if (!permiteAssinar && solicitacao.dataAceite) {
      const dataAceite = new Date(
        solicitacao.dataAceite.seconds * 1000
      ).toLocaleString("pt-BR");
      htmlFinal += `
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; border: 1px solid #c8e6c9;">
                    <p style="color: #2e7d32; font-weight: bold; margin: 0;">
                        <i class="fas fa-check-circle"></i> Documento aceito digitalmente por ${solicitacao.nomeUsuario} em ${dataAceite}.
                    </p>
                </div>
            `;
    }

    conteudoEl.innerHTML = htmlFinal;
  } catch (error) {
    console.error("Erro ao carregar conteúdo:", error);
    conteudoEl.innerHTML = `<p class="alert alert-error">Não foi possível carregar o texto do documento. (${error.message})</p>`;
  }
}

// Helper para buscar o HTML do modelo no Firestore
async function buscarConteudoModelo(modeloId) {
  if (!modeloId) return "<p><em>Conteúdo não vinculado.</em></p>";

  try {
    // Tenta coleção principal
    let docRef = doc(db, "rh_documentos_modelos", modeloId);
    let docSnap = await getDoc(docRef);

    // Fallback para outros nomes de coleção se não achar
    if (!docSnap.exists()) {
      docRef = doc(db, "modelos_documentos", modeloId);
      docSnap = await getDoc(docRef);
    }

    if (docSnap.exists()) {
      // Retorna o campo 'conteudo' (HTML) ou 'descricao'
      return (
        docSnap.data().conteudo ||
        docSnap.data().descricao ||
        "<p>Documento sem conteúdo de texto.</p>"
      );
    } else {
      return "<p><em>Erro: Modelo de documento original não encontrado no sistema.</em></p>";
    }
  } catch (e) {
    console.error("Erro fetch modelo:", e);
    return "<p><em>Erro ao baixar conteúdo.</em></p>";
  }
}

async function confirmarAceite(solicitacaoId, titulo) {
  const btn = document.getElementById("btn-confirmar-leitura-aceite");

  // Confirmação final simples
  if (!confirm(`Confirma que leu e está de acordo com "${titulo}"?`)) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Registrando...";
  }

  try {
    const docRef = doc(db, "solicitacoes_assinatura", solicitacaoId);

    await updateDoc(docRef, {
      status: "assinado",
      dataAceite: serverTimestamp(),
      aceitePorUid: currentUser.uid,
      ip: "registrado_interno",
    });

    alert("Aceite registrado com sucesso!");
    window.fecharModalLeitura();

    // Recarrega a lista chamando init novamente
    // Como init é exportada, podemos chamá-la recursivamente se importarmos ou apenas recarregar via hash
    // Uma forma simples de "refresh" sem reload de página:
    const { init } = await import("./assinaturas-termos.js");
    // Precisa passar os dados do usuário novamente, que estão no escopo global do módulo
    // Mas o ideal é disparar um evento ou apenas manipular o DOM.
    // Vamos remover o card manualmente para dar feedback imediato:

    const card = document.getElementById(`card-${solicitacaoId}`);
    if (card) card.remove();

    // Recarrega tudo para garantir (opcional)
    // window.location.reload();
  } catch (error) {
    console.error("Erro ao registrar aceite:", error);
    alert("Erro ao registrar. Tente novamente.");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-check-circle"></i> Li e Estou de Acordo';
    }
  }
}

// Função global para fechar modal
window.fecharModalLeitura = function () {
  document.getElementById("modal-leitura-documento").style.display = "none";
};
