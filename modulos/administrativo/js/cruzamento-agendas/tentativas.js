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
      updateRowColor(tr, t.status); // Aplica cor inicial

      tr.dataset.status = t.status;
      tr.dataset.id = t.id;
      tr.dataset.pacienteId = t.pacienteId;
      tr.dataset.profissionalId = t.profissionalId;
      tr.dataset.profissionalNome = t.profissionalNome;
      // Salva dados para o modal
      tr.dataset.horario = t.horarioCompativel;
      tr.dataset.valor = t.valorContribuicao;

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
                <td>${
                  t.horarioCompativel || '<span class="text-muted">N/A</span>'
                }</td>
                <td>${
                  t.valorContribuicao || '<span class="text-muted">N/A</span>'
                }</td>
                <td>${t.pacienteTelefone}</td>
                <td>
                    <select class="form-select form-select-sm status-change-select">
                        ${options}
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger btn-excluir-tentativa" title="Excluir Tentativa">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    // Event Listeners
    document.querySelectorAll(".status-change-select").forEach((sel) => {
      sel.addEventListener("change", handleStatusChange);
    });
    document.querySelectorAll(".btn-excluir-tentativa").forEach((btn) => {
      btn.addEventListener("click", handleDeleteAttempt);
    });

    // Re-aplica filtro
    const filtroVal = document.getElementById("filtro-status-tentativa").value;
    if (filtroVal !== "todos") {
      document
        .getElementById("filtro-status-tentativa")
        .dispatchEvent(new Event("change"));
    }
  });
}

function updateRowColor(tr, status) {
  // Remove classes anteriores
  tr.classList.remove(
    "status-primeiro-contato",
    "status-segundo-contato",
    "status-terceiro-contato",
    "status-aguardando-confirmacao",
    "status-aguardando-pagamento",
    "status-agendado",
    "status-cancelado-sem-sucesso"
  );

  // Normaliza para classe CSS
  const slug = status.toLowerCase().replace(/ /g, "-").replace(/\//g, "-");
  tr.classList.add(`status-${slug}`);
}

function handleStatusChange(e) {
  const newStatus = e.target.value;
  const row = e.target.closest("tr");
  const id = row.dataset.id;
  const pacienteId = row.dataset.pacienteId;
  const profissionalId = row.dataset.profissionalId;
  const profissionalNome = row.dataset.profissionalNome;
  const horarioTxt = row.dataset.horario;

  // Atualiza cor imediatamente para feedback visual
  updateRowColor(row, newStatus);

  if (newStatus === "Cancelado/Sem Sucesso") {
    openModalDesistencia(id, pacienteId);
    e.target.value = row.dataset.status; // Reseta visualmente até confirmar
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
    updateDoc(doc(firestoreDb, "agendamentoTentativas", id), {
      status: newStatus,
    });
  }
}

async function handleDeleteAttempt(e) {
  if (
    confirm(
      "Tem certeza que deseja excluir esta tentativa? Isso não afeta o paciente na trilha."
    )
  ) {
    const id = e.target.closest("tr").dataset.id;
    await deleteDoc(doc(firestoreDb, "agendamentoTentativas", id));
  }
}

// --- FUNÇÕES DE BANCO DE DADOS (Disponibilidade/Grade) ---

function normalizarDiaParaChave(diaSemana) {
  const mapa = {
    "segunda-feira": "segunda",
    "terça-feira": "terca",
    "quarta-feira": "quarta",
    "quinta-feira": "quinta",
    "sexta-feira": "sexta",
    sábado: "sabado",
    segunda: "segunda",
    terca: "terca",
    quarta: "quarta",
    quinta: "quinta",
    sexta: "sexta",
    sabado: "sabado",
  };
  return mapa[diaSemana.toLowerCase().trim()] || diaSemana.toLowerCase();
}

async function ocuparHorarioProfissional(profissionalId, diaSemana, horaInt) {
  try {
    const userRef = doc(firestoreDb, "usuarios", profissionalId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("Profissional não encontrado");

    const data = userSnap.data();
    const horarios = data.horarios || [];
    let alterou = false;
    const diaAlvo = normalizarDiaParaChave(diaSemana);

    const novosHorarios = horarios.map((h) => {
      const hDia = normalizarDiaParaChave(h.dia);
      if (hDia === diaAlvo && parseInt(h.horario) === parseInt(horaInt)) {
        if (h.status !== "ocupado") {
          alterou = true;
          return { ...h, status: "ocupado" };
        }
      }
      return h;
    });

    if (alterou) {
      await updateDoc(userRef, { horarios: novosHorarios });
    }
    return data.username || data.nome; // Retorna username para usar na grade
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    throw error;
  }
}

async function verificarEAdicionarGrade(
  usernameProfissional,
  modalidade,
  diaSemana,
  horaString
) {
  try {
    if (!usernameProfissional) throw new Error("Username obrigatório.");

    const horaFormatada = horaString.replace(":", "-");
    const diaKey = normalizarDiaParaChave(diaSemana);
    const modKey = modalidade.toLowerCase();

    const gradeRef = doc(firestoreDb, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (!gradeSnap.exists()) throw new Error("Grade não encontrada.");

    const gradeData = gradeSnap.data();
    const slotData = gradeData[modKey]?.[diaKey]?.[horaFormatada] || {};

    const jaCadastrado = Object.values(slotData).some(
      (val) => val === usernameProfissional
    );
    if (jaCadastrado) {
      console.log("Profissional já está na grade.");
      return;
    }

    let targetCol = null;
    for (let i = 0; i < 6; i++) {
      if (!slotData[`col${i}`]) {
        targetCol = `col${i}`;
        break;
      }
    }

    if (!targetCol) {
      alert(`Atenção: Grade cheia para ${diaKey} ${horaString} (${modKey}).`);
      return;
    }

    const updatePath = `${modKey}.${diaKey}.${horaFormatada}.${targetCol}`;
    await updateDoc(gradeRef, { [updatePath]: usernameProfissional });
  } catch (error) {
    console.error("Erro grade:", error);
    throw error;
  }
}

// --- MODAL: DESISTÊNCIA ---

function openModalDesistencia(tentativaId, pacienteId) {
  const modalBody = document.getElementById("modal-acao-body");
  const modalTitle = document.getElementById("modal-acao-titulo");

  modalTitle.textContent = "Registrar Desistência/Cancelamento";
  modalBody.innerHTML = `
        <div class="alert alert-warning">
            O paciente será movido para 'Desistências' e o status na trilha será atualizado.
        </div>
        <div class="form-group">
            <label class="fw-bold">Motivo (Obrigatório):</label>
            <textarea id="modal-motivo" class="form-control" rows="3" placeholder="Descreva o motivo..."></textarea>
        </div>
    `;

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const motivo = document.getElementById("modal-motivo").value.trim();
    if (!motivo) {
      alert("Motivo é obrigatório.");
      return;
    }

    newBtn.disabled = true;
    try {
      await updateDoc(doc(firestoreDb, "trilhaPaciente", pacienteId), {
        status: "desistencia",
        desistenciaMotivo: motivo,
        lastUpdate: serverTimestamp(),
      });
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Cancelado/Sem Sucesso",
        motivoCancelamento: motivo,
        arquivadoEm: serverTimestamp(),
      });

      document.getElementById("modal-acao-cruzamento").style.display = "none";
      alert("Registrado com sucesso.");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      newBtn.disabled = false;
    }
  });

  document.getElementById("modal-acao-cruzamento").style.display = "flex";
}

// --- MODAL: AGENDADO (COM WHATSAPP) ---

async function openModalAgendado(
  tentativaId,
  pacienteId,
  profissionalId,
  profissionalNome,
  horarioTxt
) {
  const modalBody = document.getElementById("modal-acao-body");
  const modalTitle = document.getElementById("modal-acao-titulo");

  const pacSnap = await getDoc(doc(firestoreDb, "trilhaPaciente", pacienteId));
  const pacData = pacSnap.data();
  const fila = pacData.status.includes("plantao") ? "Plantão" : "PB";

  // Pega telefone do profissional para o botão do WhatsApp
  const profSnap = await getDoc(doc(firestoreDb, "usuarios", profissionalId));
  const profData = profSnap.data();
  const profTel =
    profData.contato || profData.telefone || profData.celular || "";

  let preHora = "";
  const matchHora = horarioTxt ? horarioTxt.match(/(\d{1,2})/) : null;
  if (matchHora) preHora = `${String(matchHora[0]).padStart(2, "0")}:00`;

  modalTitle.textContent = `Confirmar Agendamento (${fila})`;

  modalBody.innerHTML = `
        <div class="form-group mb-2">
            <label class="fw-bold">Data 1ª Sessão:</label>
            <input type="date" id="modal-data-inicio" class="form-control">
        </div>
        <div class="form-group mb-2">
            <label class="fw-bold">Horário:</label>
            <input type="time" id="modal-hora" class="form-control" value="${preHora}">
        </div>
        <div class="form-group mb-2">
            <label class="fw-bold">Modalidade:</label>
            <select id="modal-mod" class="form-control">
                <option value="Online">Online</option>
                <option value="Presencial">Presencial</option>
            </select>
        </div>
        <hr>
        <button id="btn-whatsapp-prof" class="btn btn-success w-100 mb-3" ${
          !profTel ? "disabled" : ""
        }>
            <i class="fab fa-whatsapp"></i> Enviar Mensagem ao Profissional
        </button>
        <div class="alert alert-info small">
            Ao confirmar, o sistema irá atualizar a trilha, ocupar a disponibilidade e inserir na grade.
        </div>
    `;

  // Lógica do Botão WhatsApp
  const btnZap = document.getElementById("btn-whatsapp-prof");
  btnZap.onclick = () => {
    const d = document.getElementById("modal-data-inicio").value;
    const h = document.getElementById("modal-hora").value;
    const m = document.getElementById("modal-mod").value;

    if (!d || !h) {
      alert("Preencha data e hora antes de enviar.");
      return;
    }

    const dataF = new Date(d).toLocaleDateString("pt-BR");
    const msg = `Olá ${profissionalNome}, agendamos um paciente para você!\n\n*Paciente:* ${pacData.nomeCompleto}\n*Contato:* ${pacData.telefoneCelular}\n*Data 1ª Sessão:* ${dataF}\n*Horário:* ${h}\n*Modalidade:* ${m}\n\nO paciente já está disponível na sua aba 'Meus Pacientes'.`;

    const link = `https://wa.me/55${profTel.replace(
      /\D/g,
      ""
    )}?text=${encodeURIComponent(msg)}`;
    window.open(link, "_blank");
  };

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const dataInicio = document.getElementById("modal-data-inicio").value;
    const horaInput = document.getElementById("modal-hora").value;
    const mod = document.getElementById("modal-mod").value;

    if (!dataInicio || !horaInput) return alert("Preencha data e horário.");

    newBtn.disabled = true;
    newBtn.textContent = "Processando...";

    try {
      const dataObj = new Date(dataInicio + "T00:00:00");
      const diaSemana = dataObj.toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      const horaInt = parseInt(horaInput.split(":")[0]);

      // 1. Atualizar Trilha
      const updateData = {
        status:
          fila === "Plantão"
            ? "agendamento_confirmado_plantao"
            : "em_atendimento_pb",
        lastUpdate: serverTimestamp(),
      };
      // Adiciona info extra dependendo da fila
      if (fila === "Plantão") {
        updateData["plantaoInfo.dataPrimeiraSessao"] = dataInicio;
        updateData["plantaoInfo.horaPrimeiraSessao"] = horaInput;
        updateData["plantaoInfo.profissionalId"] = profissionalId;
        updateData["plantaoInfo.profissionalNome"] = profissionalNome;
      } else {
        // Lógica PB (adicionar ao array atendimentosPB - simplificado aqui)
        // updateData["atendimentosPB"] = arrayUnion(...)
      }

      await updateDoc(
        doc(firestoreDb, "trilhaPaciente", pacienteId),
        updateData
      );

      // 2. Arquivar Tentativa
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Agendado",
        dataInicio: dataInicio,
        horarioFinal: horaInput,
        arquivadoEm: serverTimestamp(),
      });

      // 3. Ocupar Horário e Pegar Username
      const username = await ocuparHorarioProfissional(
        profissionalId,
        diaSemana,
        horaInt
      );

      // 4. Inserir na Grade
      await verificarEAdicionarGrade(username, mod, diaSemana, horaInput);

      alert("Agendamento concluído com sucesso!");
      document.getElementById("modal-acao-cruzamento").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erro ao processar: " + e.message);
    } finally {
      newBtn.disabled = false;
    }
  });

  document.getElementById("modal-acao-cruzamento").style.display = "flex";
}

function setupModalActions() {
  const closeBtn = document.getElementById("btn-close-modal-acao");
  const cancelBtn = document.getElementById("btn-cancel-modal-acao");
  const modal = document.getElementById("modal-acao-cruzamento");

  if (closeBtn) closeBtn.onclick = () => (modal.style.display = "none");
  if (cancelBtn) cancelBtn.onclick = () => (modal.style.display = "none");
}
