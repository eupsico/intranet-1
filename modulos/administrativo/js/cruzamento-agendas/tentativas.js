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
  // onSnapshot cuida da atualização automática
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
      tr.className = `status-${statusSlug}`;
      tr.dataset.status = t.status;
      tr.dataset.id = t.id;
      tr.dataset.pacienteId = t.pacienteId;
      tr.dataset.profissionalId = t.profissionalId;
      tr.dataset.profissionalNome = t.profissionalNome;
      tr.dataset.horario = t.horarioCompativel;

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

    const filtroVal = document.getElementById("filtro-status-tentativa").value;
    if (filtroVal !== "todos") {
      document
        .getElementById("filtro-status-tentativa")
        .dispatchEvent(new Event("change"));
    }

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
  const profissionalNome = row.dataset.profissionalNome;
  const horarioTxt = row.dataset.horario;

  if (newStatus === "Cancelado/Sem Sucesso") {
    openModalDesistencia(id, pacienteId);
    e.target.value = row.dataset.status;
  } else if (newStatus === "Agendado") {
    openModalAgendado(
      id,
      pacienteId,
      profissionalId,
      profissionalNome,
      horarioTxt
    );
    e.target.value = row.dataset.status;
  } else {
    updateDoc(doc(firestoreDb, "agendamentoTentativas", id), {
      status: newStatus,
    });
  }
}

// --- FUNÇÕES AUXILIARES DE BANCO DE DADOS ---

/**
 * Normaliza strings de dias da semana para o formato curto usado no banco ('segunda', 'terca'...).
 */
function normalizarDiaParaChave(diaSemana) {
  const mapa = {
    "segunda-feira": "segunda",
    "terça-feira": "terca",
    "quarta-feira": "quarta",
    "quinta-feira": "quinta",
    "sexta-feira": "sexta",
    sábado: "sabado",
    domingo: "domingo",
    segunda: "segunda",
    terca: "terca",
    quarta: "quarta",
    quinta: "quinta",
    sexta: "sexta",
    sabado: "sabado",
  };
  return mapa[diaSemana.toLowerCase().trim()] || diaSemana.toLowerCase();
}

/**
 * Altera o status do horário no array 'horarios' do usuário para 'ocupado'.
 */
async function ocuparHorarioProfissional(profissionalId, diaSemana, horaInt) {
  try {
    const userRef = doc(firestoreDb, "usuarios", profissionalId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("Profissional não encontrado");

    const data = userSnap.data();
    const horarios = data.horarios || [];
    let alterou = false;

    const diaAlvo = normalizarDiaParaChave(diaSemana);

    // Mapeia o array para criar um novo com o status atualizado
    const novosHorarios = horarios.map((h) => {
      // Normaliza o dia do item atual do array
      const hDia = normalizarDiaParaChave(h.dia);

      // Compara dia e horário (garantindo que horário seja comparado como número)
      if (hDia === diaAlvo && parseInt(h.horario) === parseInt(horaInt)) {
        // Verifica se já não está ocupado para evitar writes desnecessários (opcional)
        if (h.status !== "ocupado") {
          alterou = true;
          return { ...h, status: "ocupado" };
        }
      }
      return h;
    });

    if (alterou) {
      await updateDoc(userRef, { horarios: novosHorarios });
      console.log(
        `Disponibilidade atualizada: ${diaSemana} às ${horaInt}h marcado como 'ocupado'.`
      );
    } else {
      console.log(
        `Horário ${diaSemana} ${horaInt}h não estava 'disponivel' ou não encontrado.`
      );
    }

    // Retorna o username para uso na grade (aproveita que já leu o doc)
    return data.username || data.nome;
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade do profissional:", error);
    throw error;
  }
}

/**
 * Verifica se o horário está na grade e insere o USERNAME se estiver livre.
 */
async function verificarEAdicionarGrade(
  usernameProfissional,
  modalidade,
  diaSemana,
  horaString
) {
  try {
    if (!usernameProfissional)
      throw new Error(
        "Username do profissional é obrigatório para inserir na grade."
      );

    // Formata a hora para o padrão da grade (Ex: "18:00" -> "18-00")
    const horaFormatada = horaString.replace(":", "-");
    const diaKey = normalizarDiaParaChave(diaSemana);
    const modKey = modalidade.toLowerCase(); // 'online' ou 'presencial'

    const gradeRef = doc(firestoreDb, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);

    if (!gradeSnap.exists())
      throw new Error("Documento de grades não encontrado.");

    const gradeData = gradeSnap.data();

    // Caminho: modalidade.dia.hora (Ex: online.segunda.18-00)
    const slotData = gradeData[modKey]?.[diaKey]?.[horaFormatada] || {};

    // 1. Verifica se o username já existe neste horário em alguma coluna
    const jaCadastrado = Object.values(slotData).some(
      (valor) => valor === usernameProfissional
    );

    if (jaCadastrado) {
      console.log(
        `O username '${usernameProfissional}' já consta na grade neste horário.`
      );
      return;
    }

    // 2. Encontra a primeira coluna vazia (col0 a col5)
    let targetCol = null;
    for (let i = 0; i < 6; i++) {
      if (!slotData[`col${i}`]) {
        targetCol = `col${i}`;
        break;
      }
    }

    if (!targetCol) {
      alert(
        `Atenção: Não há vaga na grade (${modKey} - ${diaKey} - ${horaString}) para inserir o profissional. A grade está cheia.`
      );
      return;
    }

    // 3. Atualiza a grade com o username
    const updatePath = `${modKey}.${diaKey}.${horaFormatada}.${targetCol}`;

    await updateDoc(gradeRef, {
      [updatePath]: usernameProfissional,
    });

    console.log(`Inserido na grade: ${usernameProfissional} em ${updatePath}`);
  } catch (error) {
    console.error("Erro ao atualizar a grade:", error);
    throw error;
  }
}

// --- MODAIS ---

function openModalDesistencia(tentativaId, pacienteId) {
  const modalBody = document.getElementById("modal-acao-body");
  const modalTitle = document.getElementById("modal-acao-titulo");

  modalTitle.textContent = "Registrar Desistência";
  modalBody.innerHTML = `
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            O paciente será movido para a aba 'Desistências' e o status na trilha será atualizado.
        </div>
        <div class="form-group">
            <label class="fw-bold">Motivo (Obrigatório):</label>
            <textarea id="modal-motivo" class="form-control" rows="3" placeholder="Descreva o motivo da desistência ou insucesso no contato..."></textarea>
        </div>
    `;

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const motivo = document.getElementById("modal-motivo").value.trim();

    // Validação Obrigatória
    if (!motivo) {
      alert("Por favor, informe o motivo da desistência.");
      document.getElementById("modal-motivo").focus();
      return;
    }

    newBtn.disabled = true;
    newBtn.textContent = "Registrando...";

    try {
      // 1. Atualiza Trilha
      await updateDoc(doc(firestoreDb, "trilhaPaciente", pacienteId), {
        status: "desistencia",
        desistenciaMotivo: motivo,
        lastUpdate: serverTimestamp(),
      });
      // 2. Move para Histórico
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Cancelado/Sem Sucesso",
        motivoCancelamento: motivo,
        arquivadoEm: serverTimestamp(),
      });

      document.getElementById("modal-acao-cruzamento").style.display = "none";
      alert("Registrado com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Erro ao registrar: " + e.message);
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = "Confirmar";
    }
  });

  document.getElementById("modal-acao-cruzamento").style.display = "flex";
}

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

  // Tenta extrair hora do horarioTxt (ex: "quarta 18h" ou "quarta 18:00")
  let preHora = "";
  const matchHora = horarioTxt ? horarioTxt.match(/(\d{1,2})/) : null;
  if (matchHora) {
    preHora = `${String(matchHora[0]).padStart(2, "0")}:00`;
  }

  modalTitle.textContent = `Confirmar Agendamento (${fila})`;

  modalBody.innerHTML = `
        <div class="alert alert-info">
            Ao confirmar, o sistema irá:<br>
            1. Atualizar a trilha do paciente.<br>
            2. <strong>Remover a disponibilidade</strong> do profissional (Mudar para 'Ocupado').<br>
            3. <strong>Inserir o Username</strong> na Grade Geral (se não existir).
        </div>
        <div class="form-group mb-2">
            <label class="fw-bold">Data de Início:</label>
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
    `;

  const btnConfirm = document.getElementById("btn-confirm-modal-acao");
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const dataInicio = document.getElementById("modal-data-inicio").value;
    const horaInput = document.getElementById("modal-hora").value; // Ex: "18:00"
    const mod = document.getElementById("modal-mod").value;

    if (!dataInicio || !horaInput) return alert("Preencha data e horário.");

    newBtn.disabled = true;
    newBtn.textContent = "Processando...";

    try {
      // Preparação dos dados de data
      const dataObj = new Date(dataInicio + "T00:00:00");
      const diaSemana = dataObj.toLocaleDateString("pt-BR", {
        weekday: "long",
      }); // Ex: "segunda-feira"
      const horaInt = parseInt(horaInput.split(":")[0]); // Ex: 18

      // 1. Atualizar Trilha
      const updateData = {
        status:
          fila === "Plantão"
            ? "agendamento_confirmado_plantao"
            : "em_atendimento_pb",
        lastUpdate: serverTimestamp(),
      };
      await updateDoc(
        doc(firestoreDb, "trilhaPaciente", pacienteId),
        updateData
      );

      // 2. Atualizar Tentativa (Arquivar)
      await updateDoc(doc(firestoreDb, "agendamentoTentativas", tentativaId), {
        status: "Agendado",
        dataInicio: dataInicio,
        horarioFinal: horaInput,
        arquivadoEm: serverTimestamp(),
      });

      // 3. Remover Disponibilidade (Mudar status para 'ocupado') e obter Username
      // Essa função agora retorna o username encontrado no doc do profissional
      const usernameProfissional = await ocuparHorarioProfissional(
        profissionalId,
        diaSemana,
        horaInt
      );

      // 4. Inserir na Grade usando o Username recuperado
      // Se o username não existir no cadastro, usa o nome como fallback (comportamento da função anterior)
      await verificarEAdicionarGrade(
        usernameProfissional,
        mod,
        diaSemana,
        horaInput
      );

      alert(
        "Agendamento confirmado, disponibilidade atualizada e grade preenchida!"
      );
      document.getElementById("modal-acao-cruzamento").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erro ao processar agendamento: " + e.message);
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = "Confirmar";
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
