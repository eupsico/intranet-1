// Arquivo: /modulos/administrativo/js/cruzamento-agendas/tentativas.js
import {
  db,
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  deleteDoc,
} from "../../../../assets/js/firebase-init.js";

let firestoreDb;
let unsubscribe;

export function init(dbInstance) {
  firestoreDb = dbInstance;
  setupFilters();
  listenToTentativas();
  setupModalActions();
}

export function refresh() {}

function setupFilters() {
  const filtro = document.getElementById("filtro-status-tentativa");
  if (filtro) {
    filtro.addEventListener("change", () => {
      const rows = document.querySelectorAll("#tentativas-tbody tr");
      const val = filtro.value;
      rows.forEach((row) => {
        if (val === "todos" || row.dataset.status === val) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  }
}

// --- RENDERING DA TABELA ---
function listenToTentativas() {
  const q = query(collection(firestoreDb, "agendamentoTentativas"));
  const tbody = document.getElementById("tentativas-tbody");

  unsubscribe = onSnapshot(q, (snapshot) => {
    tbody.innerHTML = "";
    const tentativas = [];
    snapshot.forEach((doc) => tentativas.push({ id: doc.id, ...doc.data() }));

    if (tentativas.length === 0) {
      document.getElementById("nenhuma-tentativa").style.display = "block";
      return;
    }
    document.getElementById("nenhuma-tentativa").style.display = "none";

    tentativas.forEach((t) => {
      const tr = document.createElement("tr");

      // Define os dados para uso nos modais
      tr.dataset.status = t.status;
      tr.dataset.id = t.id;
      tr.dataset.pacienteId = t.pacienteId;
      tr.dataset.profissionalId = t.profissionalId;
      tr.dataset.profissionalNome = t.profissionalNome;
      tr.dataset.horario = t.horarioCompativel;
      tr.dataset.valor = t.valorContribuicao;

      // Aplica a cor da linha baseada no status
      updateRowColor(tr, t.status);

      const options = [
        "Primeiro Contato",
        "Segundo Contato",
        "Terceiro Contato",
        "Aguardando Confirmação",
        "Aguardando Pagamento",
        "Agendado",
        "Cancelado/Sem Sucesso",
      ]
        .map(
          (opt) =>
            `<option value="${opt}" ${
              t.status === opt ? "selected" : ""
            }>${opt}</option>`
        )
        .join("");

      // Renderiza as colunas
      // A última coluna (Ação) agora tem o botão de Excluir
      tr.innerHTML = `
                <td>${t.pacienteNome}</td>
                <td>${t.profissionalNome}</td>
                <td>${
                  t.horarioCompativel || '<span class="text-muted">-</span>'
                }</td>
                <td>${
                  t.valorContribuicao || '<span class="text-muted">-</span>'
                }</td>
                <td>${t.pacienteTelefone}</td>
                <td>
                    <select class="form-select form-select-sm status-change-select">
                        ${options}
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger btn-excluir-tentativa" title="Excluir esta tentativa (caso erro)">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    // Event Listeners para os elementos criados dinamicamente
    document.querySelectorAll(".status-change-select").forEach((sel) => {
      sel.addEventListener("change", handleStatusChange);
    });
    document.querySelectorAll(".btn-excluir-tentativa").forEach((btn) => {
      btn.addEventListener("click", handleDeleteAttempt);
    });

    // Re-aplica filtro visual se necessário
    const filtroVal = document.getElementById("filtro-status-tentativa").value;
    if (filtroVal !== "todos") {
      document
        .getElementById("filtro-status-tentativa")
        .dispatchEvent(new Event("change"));
    }
  });
}

/**
 * Atualiza a classe CSS da linha (TR) para mudar a cor de fundo
 */
function updateRowColor(tr, status) {
  // Remove todas as classes de status antigas
  tr.classList.remove(
    "status-primeiro-contato",
    "status-segundo-contato",
    "status-terceiro-contato",
    "status-aguardando-confirmacao",
    "status-aguardando-pagamento",
    "status-agendado",
    "status-cancelado-sem-sucesso"
  );

  // Gera o slug do status (ex: "Primeiro Contato" -> "primeiro-contato")
  if (status) {
    const slug = status
      .toLowerCase()
      .trim()
      .replace(/ /g, "-")
      .replace(/\//g, "-");
    tr.classList.add(`status-${slug}`);
  }
}

function handleStatusChange(e) {
  const newStatus = e.target.value;
  const row = e.target.closest("tr");

  const id = row.dataset.id;
  const pacienteId = row.dataset.pacienteId;
  const profissionalId = row.dataset.profissionalId;
  const profissionalNome = row.dataset.profissionalNome;
  const horarioTxt = row.dataset.horario;

  // Atualiza a cor visualmente na hora
  updateRowColor(row, newStatus);

  if (newStatus === "Cancelado/Sem Sucesso") {
    openModalDesistencia(id, pacienteId);
    e.target.value = row.dataset.status; // Reseta o select visualmente até confirmar no modal
  } else if (newStatus === "Agendado") {
    openModalAgendado(
      id,
      pacienteId,
      profissionalId,
      profissionalNome,
      horarioTxt
    );
    e.target.value = row.dataset.status; // Reseta visualmente até confirmar
  } else {
    // Apenas salva o novo status no banco
    updateDoc(doc(firestoreDb, "agendamentoTentativas", id), {
      status: newStatus,
    });
  }
}

async function handleDeleteAttempt(e) {
  if (
    confirm(
      "Tem certeza que deseja excluir esta tentativa da lista? Isso não remove o paciente da fila, apenas apaga este registro de contato."
    )
  ) {
    const id = e.target.closest("tr").dataset.id;
    try {
      await deleteDoc(doc(firestoreDb, "agendamentoTentativas", id));
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir tentativa.");
    }
  }
}

// ... (Resto do código: normalizarDiaParaChave, ocuparHorarioProfissional, verificarEAdicionarGrade, Modais) ...
// (Mantenha as funções de banco de dados e modais do código anterior aqui)
// Certifique-se de usar o código completo fornecido na resposta anterior para as funções auxiliares e modais.
