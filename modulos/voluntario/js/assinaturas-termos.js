/**
 * Arquivo: /modulos/voluntario/js/assinaturas-termos.js
 * Versão: 2.1.0 (Aceite Interno)
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
} from "../../../assets/js/firebase-init.js";

let currentUser = null;

export async function init(user, userData) {
  currentUser = user;
  const fase1Container = document.getElementById("fase1-container");
  const fase2Container = document.getElementById("fase2-container");
  const historicoContainer = document.getElementById(
    "historico-geral-container"
  );

  if (!fase1Container) return;

  fase1Container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const assinaturasRef = collection(db, "solicitacoes_assinatura");

    // ✅ Busca direta pelo UID do usuário logado
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

    renderizarDocumentos(
      snapshot,
      fase1Container,
      fase2Container,
      historicoContainer
    );
  } catch (error) {
    console.error("Erro ao carregar termos:", error);
    if (error.message.includes("index")) {
      console.warn("Erro de índice. Tentando sem ordenação.");
      // Retry logic sem orderBy se necessário
      fase1Container.innerHTML =
        '<p class="alert alert-warning">Índice em criação. Tente novamente em instantes.</p>';
    } else {
      fase1Container.innerHTML =
        '<p class="alert alert-error">Erro ao carregar documentos.</p>';
    }
  }
}

function renderEmptyState(c1, c2) {
  c1.innerHTML = '<p class="text-muted">Nenhum documento pendente.</p>';
  c2.innerHTML = '<p class="text-muted">Aguardando novos termos.</p>';
}

function renderizarDocumentos(
  snapshot,
  containerF1,
  containerF2,
  containerHist
) {
  containerF1.innerHTML = "";
  containerF2.innerHTML = "";
  containerHist.innerHTML = "";

  let temF1 = false;
  let temF2 = false;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const docId = docSnap.id;
    const dataEnvio = data.dataEnvio
      ? new Date(data.dataEnvio.seconds * 1000)
      : new Date();
    const dataFormatada = dataEnvio.toLocaleDateString("pt-BR");

    const fase = data.fase || 1;
    const nomesDocs = data.documentos
      ? data.documentos.map((d) => d.titulo).join(", ")
      : "Termos Gerais";

    // Se estiver pendente, exibe o Card de Ação
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
      // Se já aceitou, vai para o histórico
      const dataAceite = data.dataAceite
        ? new Date(data.dataAceite.seconds * 1000).toLocaleDateString("pt-BR")
        : dataFormatada;
      containerHist.innerHTML += criarItemHistorico(nomesDocs, dataAceite);
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

  // Adiciona listeners aos botões criados dinamicamente
  adicionarListenersAceite();
}

function criarCardAceite(docId, titulo, dataTexto) {
  return `
        <div class="document-card status-pendente" id="card-${docId}">
            <div class="doc-header">
                <div class="doc-icon"><i class="fas fa-file-signature"></i></div>
                <div class="doc-info">
                    <h3>${titulo}</h3>
                    <p>Disponibilizado em: ${dataTexto}</p>
                    <span class="doc-meta">Ação necessária</span>
                </div>
            </div>
            <div class="doc-actions">
                <button class="btn-assinar btn-aceite" data-id="${docId}" data-titulo="${titulo}">
                    <i class="fas fa-check-circle"></i> Ler e Dar o "De Acordo"
                </button>
            </div>
        </div>
    `;
}

function criarItemHistorico(titulo, dataAceite) {
  return `
        <div class="doc-item-list">
            <div>
                <strong>${titulo}</strong>
                <br><small style="color:#28a745">Aceito em: ${dataAceite}</small>
            </div>
            <div>
                 <span class="status-badge" style="background:#d4edda; color:#155724; padding:4px 8px; border-radius:4px; font-size:0.8em;">Concluído</span>
            </div>
        </div>
    `;
}

function adicionarListenersAceite() {
  document.querySelectorAll(".btn-aceite").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.dataset.id;
      const titulo = e.currentTarget.dataset.titulo;
      confirmarAceite(docId, titulo);
    });
  });
}

async function confirmarAceite(docId, titulo) {
  // Aqui você poderia abrir um modal para mostrar o texto completo do termo antes de aceitar.
  // Por simplicidade, vamos usar um confirm nativo, mas o ideal é um modal.

  const confirmacao = confirm(
    `Você confirma que leu e está de acordo com os termos de:\n\n"${titulo}"?\n\nAo clicar em OK, será registrado seu aceite digital.`
  );

  if (!confirmacao) return;

  const btn = document.querySelector(`button[data-id="${docId}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Registrando...";
  }

  try {
    const docRef = doc(db, "solicitacoes_assinatura", docId);

    await updateDoc(docRef, {
      status: "assinado",
      dataAceite: serverTimestamp(),
      aceitePorUid: currentUser.uid,
      ip: "registrado_pelo_sistema", // Em backend real pegaria o IP
    });

    alert("Aceite registrado com sucesso!");

    // Recarrega a tela
    // O ideal seria remover o card visualmente e adicionar ao histórico sem reload,
    // mas chamar init() novamente garante consistência.
    const { init } = await import("./assinaturas-termos.js"); // Re-importa para garantir contexto ou chama a lógica de recarga
    // Como estamos dentro do módulo, podemos chamar init recursivamente se tivermos user e userData no escopo,
    // ou simplesmente recarregar a view via hash se o roteador permitir.
    // Vamos simular um refresh removendo o card:

    const card = document.getElementById(`card-${docId}`);
    if (card) card.remove();

    // Adiciona ao histórico visualmente (opcional, ou espera reload do usuário)
    const historicoContainer = document.getElementById(
      "historico-geral-container"
    );
    const hoje = new Date().toLocaleDateString("pt-BR");
    historicoContainer.innerHTML += criarItemHistorico(titulo, hoje);
  } catch (error) {
    console.error("Erro ao registrar aceite:", error);
    alert("Erro ao registrar. Tente novamente.");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-check-circle"></i> Ler e Dar o "De Acordo"';
    }
  }
}
