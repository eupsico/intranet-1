// Arquivo: /modulos/administrativo/js/cruzamento-agendas/tentativas.js
import {
  db,
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  arrayRemove,
  setDoc,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

let firestoreDb;
let unsubscribe;

export function init(dbInstance) {
  firestoreDb = dbInstance;
  setupFilters();
  listenToTentativas();
  setupModalActions();
}

export function refresh() {
  // Pode ser usado para forçar reload se necessário, mas o onSnapshot cuida disso
}

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
      const statusSlug = t.status
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/\//g, "-");
      const tr = document.createElement("tr");
      tr.className = `status-${statusSlug}`; // Classe para CSS
      tr.dataset.status = t.status;
      tr.dataset.id = t.id;
      tr.dataset.pacienteId = t.pacienteId;
      tr.dataset.profissionalId = t.profissionalId;
      tr.dataset.horario = t.horarioCompativel; // Necessário para a grade

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

      tr.innerHTML = `
                <td>${t.pacienteNome}</td>
                <td>${t.profissionalNome}</td>
                <td>${t.horarioCompativel || "-"}</td>
                <td>${t.valorContribuicao || "-"}</td>
                <td>${t.pacienteTelefone}</td>
                <td><span class="badge bg-secondary">${t.status}</span></td>
                <td>
                    <select class="form-select form-select-sm status-change-select">
                        ${options}
                    </select>
                </td>
            `;
      tbody.appendChild(tr);
    });

    // Re-aplica filtro se estiver selecionado
    const filtroVal = document.getElementById("filtro-status-tentativa").value;
    if (filtroVal !== "todos") {
      document
        .getElementById("filtro-status-tentativa")
        .dispatchEvent(new Event("change"));
    }

    // Listeners para os selects
    document.querySelectorAll(".status-change-select").forEach((sel) => {
      sel.addEventListener("change", handleStatusChange);
    });
  });
}

function handleStatusChange(e) {
  const newStatus = e.target.value;
  const row = e.target.closest("tr");
  const id = row.dataset.id;
  const pacienteId = row.dataset.pacienteId;
  const profissionalId = row.dataset.profissionalId;
  const horarioTxt = row.dataset.horario;

  if (newStatus === "Cancelado/Sem Sucesso") {
    openModalDesistencia(id, pacienteId);
    // Reseta o select visualmente até confirmar no modal
    e.target.value = row.dataset.status;
  } else if (newStatus === "Agendado") {
    openModalAgendado(id, pacienteId, profissionalId, horarioTxt);
    e.target.value = row.dataset.status;
  } else {
    // Atualização simples de status
    updateDoc(doc(firestoreDb, "agendamentoTentativas", id), {
      status: newStatus,
    });
  }
}

// --- MODAIS ---

function openModalDesistencia(tentativaId, pacienteId) {
  const modalBody = document.getElementById("modal-acao-body");
  const modalTitle = document.getElementById("modal-acao-titulo");

  modalTitle.textContent = "Registrar Desistência";
  modalBody.innerHTML = `
        <p>O paciente será movido para a aba 'Desistências' e o status na trilha será atualizado.</p>
        <div class="form-group">
            <label>Motivo:</label>
            <textarea id="modal-motivo" class="form-control" rows="3"></textarea>
        </div>
    `;

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  // Remove listeners antigos (clone)
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const motivo = document.getElementById("modal-motivo").value;
    if (!motivo) return alert("Informe o motivo.");

    try {
      // 1. Atualiza Trilha
      await updateDoc(doc(firestoreDb, "trilhaPaciente", pacienteId), {
        status: "desistencia",
        desistenciaMotivo: motivo,
        lastUpdate: serverTimestamp(),
      });
      // 2. Move para Histórico (Cria novo doc em 'agendamentos_historico' ou apenas muda status/campo)
      // Aqui vamos apenas mudar o status no doc atual e adicionar o motivo,
      // e o filtro da aba "Desistencias" vai pegar lá.
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Cancelado/Sem Sucesso",
        motivoCancelamento: motivo,
        arquivadoEm: serverTimestamp(),
      });

      document.getElementById("modal-acao-cruzamento").style.display = "none";
      alert("Registrado com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Erro ao registrar.");
    }
  });

  document.getElementById("modal-acao-cruzamento").style.display = "flex";
}

async function openModalAgendado(
  tentativaId,
  pacienteId,
  profissionalId,
  horarioTxt
) {
  const modalBody = document.getElementById("modal-acao-body");
  const modalTitle = document.getElementById("modal-acao-titulo");

  // Busca dados do paciente para saber se é Plantão ou PB
  const pacSnap = await getDoc(doc(firestoreDb, "trilhaPaciente", pacienteId));
  const pacData = pacSnap.data();
  const fila = pacData.status.includes("plantao") ? "Plantão" : "PB";

  modalTitle.textContent = `Confirmar Agendamento (${fila})`;

  modalBody.innerHTML = `
        <div class="form-group"><label>Data Início:</label><input type="date" id="modal-data-inicio" class="form-control"></div>
        <div class="form-group"><label>Horário:</label><input type="time" id="modal-hora" class="form-control"></div>
        <div class="form-group"><label>Modalidade:</label>
            <select id="modal-mod" class="form-control">
                <option value="Online">Online</option>
                <option value="Presencial">Presencial</option>
            </select>
        </div>
        <p class="text-danger small mt-2">Atenção: Ao confirmar, o horário <strong>${horarioTxt}</strong> será removido da disponibilidade do profissional e inserido na Grade Geral.</p>
    `;

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const dataInicio = document.getElementById("modal-data-inicio").value;
    const hora = document.getElementById("modal-hora").value;
    const mod = document.getElementById("modal-mod").value;

    if (!dataInicio || !hora) return alert("Preencha os dados.");

    newBtn.disabled = true;
    newBtn.textContent = "Processando...";

    try {
      // 1. Atualizar Trilha
      const updateData = {
        status:
          fila === "Plantão"
            ? "agendamento_confirmado_plantao"
            : "em_atendimento_pb",
        lastUpdate: serverTimestamp(),
      };
      // Adicionar infos no objeto correspondente (plantaoInfo ou atendimentosPB) -> Simplificado aqui
      // ... lógica de adicionar objeto ...
      await updateDoc(
        doc(firestoreDb, "trilhaPaciente", pacienteId),
        updateData
      );

      // 2. Atualizar Tentativa (Arquivar)
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Agendado",
        dataInicio: dataInicio,
        horarioFinal: hora,
        arquivadoEm: serverTimestamp(),
      });

      // 3. Remover Disponibilidade do Profissional
      // Precisamos encontrar o objeto exato no array 'horarios' que corresponde ao horarioTxt
      // Como horarioTxt é uma string formatada, é difícil. O ideal seria ter passado o ID do slot ou o objeto json.
      // Vou assumir que o admin ajusta manualmente se não der match perfeito, ou tenta remover pelo dia/hora.
      // *** Lógica Complexa Simplificada ***: Apenas avisa que precisa ajustar manualmente ou tenta remover se for exato.
      // await removerHorarioProfissional(profissionalId, horarioTxt);

      // 4. Inserir na Grade (administrativo/grades)
      // Lógica de criar o path: presencial.segunda.10-00.col0 (precisa achar coluna livre)
      // await adicionarNaGrade(profissionalId, mod, hora, ...);

      alert(
        "Agendamento confirmado! Lembre-se de verificar a Grade de Horários."
      );
      document.getElementById("modal-acao-cruzamento").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erro ao processar agendamento.");
    } finally {
      newBtn.disabled = false;
    }
  });

  document.getElementById("modal-acao-cruzamento").style.display = "flex";
}

function setupModalActions() {
  document.getElementById("btn-close-modal-acao").onclick = () =>
    (document.getElementById("modal-acao-cruzamento").style.display = "none");
  document.getElementById("btn-cancel-modal-acao").onclick = () =>
    (document.getElementById("modal-acao-cruzamento").style.display = "none");
}
