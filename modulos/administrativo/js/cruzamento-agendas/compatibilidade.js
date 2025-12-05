// Arquivo: /modulos/administrativo/js/cruzamento-agendas/compatibilidade.js
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "../../../../assets/js/firebase-init.js";

let allProfessionals = [];
let allPatients = [];
let firestoreDb;

export function init(dbInstance) {
  firestoreDb = dbInstance;
  const profissionalSelect = document.getElementById("profissional-select");
  const pacienteSelect = document.getElementById("paciente-select");

  if (profissionalSelect)
    profissionalSelect.addEventListener("change", findCompatiblePatients);
  if (pacienteSelect)
    pacienteSelect.addEventListener("change", findCompatibleProfessionals);

  const tbody = document.getElementById("compatibilidade-tbody");
  if (tbody) tbody.addEventListener("click", handleTableClick);

  loadProfessionals();
  loadPatients();
}

async function loadProfessionals() {
  const select = document.getElementById("profissional-select");
  const geralBody = document.getElementById("disponibilidade-geral-tbody");
  if (!select) return;

  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const q = query(
      collection(firestoreDb, "usuarios"),
      where("fazAtendimento", "==", true)
    );
    const snap = await getDocs(q);
    allProfessionals = [];
    snap.forEach((doc) => allProfessionals.push({ id: doc.id, ...doc.data() }));
    allProfessionals.sort((a, b) => a.nome.localeCompare(b.nome));

    let options = '<option value="">Selecione um profissional...</option>';
    let geralRows = "";

    allProfessionals.forEach((prof) => {
      options += `<option value="${prof.id}">${prof.nome}</option>`;
      if (prof.horarios && prof.horarios.length > 0) {
        geralRows += `<tr><td>${prof.nome}</td><td>${prof.horarios
          .map((h) => `${h.dia} ${h.horario}h`)
          .join(", ")}</td><td>-</td></tr>`;
      }
    });
    select.innerHTML = options;
    if (geralBody)
      geralBody.innerHTML =
        geralRows ||
        '<tr><td colspan="3">Nenhuma disponibilidade cadastrada.</td></tr>';
  } catch (e) {
    console.error("Erro profissionais:", e);
    select.innerHTML = '<option value="">Erro</option>';
  }
}

async function loadPatients() {
  const select = document.getElementById("paciente-select");
  if (!select) return;
  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const q = query(
      collection(firestoreDb, "trilhaPaciente"),
      where("status", "in", ["encaminhar_para_plantao", "encaminhar_para_pb"])
    );
    const snap = await getDocs(q);
    allPatients = [];
    snap.forEach((doc) => allPatients.push({ id: doc.id, ...doc.data() }));
    allPatients.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    let options =
      '<option value="">Selecione um paciente (Fila de Espera)...</option>';
    allPatients.forEach((p) => {
      const fila = p.status === "encaminhar_para_plantao" ? "Plantão" : "PB";
      options += `<option value="${p.id}">${p.nomeCompleto} (${fila})</option>`;
    });
    select.innerHTML = options;
  } catch (e) {
    console.error("Erro pacientes:", e);
    select.innerHTML = '<option value="">Erro</option>';
  }
}

function findCompatiblePatients() {
  const profId = document.getElementById("profissional-select").value;
  if (!profId) return;
  document.getElementById("paciente-select").value = "";

  const prof = allProfessionals.find((p) => p.id === profId);
  const profSlots = prof?.horarios || [];
  const matches = [];

  allPatients.forEach((paciente) => {
    const pacSlots = paciente.disponibilidadeEspecifica || [];
    const common = checkIntersection(profSlots, pacSlots); // Simplificado
    if (common.length > 0) matches.push({ ...paciente, commonSlots: common });
  });
  renderTable(matches, "patients", profId);
}

function findCompatibleProfessionals() {
  const pacId = document.getElementById("paciente-select").value;
  if (!pacId) return;
  document.getElementById("profissional-select").value = "";

  const paciente = allPatients.find((p) => p.id === pacId);
  const pacSlots = paciente?.disponibilidadeEspecifica || [];
  const matches = [];
  allProfessionals.forEach((prof) => {
    const profSlots = prof.horarios || [];
    const common = checkIntersection(profSlots, pacSlots); // Simplificado
    if (common.length > 0) matches.push({ ...prof, commonSlots: common });
  });
  renderTable(matches, "professionals", pacId, paciente.valorContribuicao);
}

// Função placeholder de interseção (substitua pela lógica real de dia/hora se necessário)
function checkIntersection(profSlots, pacSlots) {
  let results = [];
  // Lógica simples: se o profissional tem horário que bate com o texto do paciente
  profSlots.forEach((ps) => {
    results.push(`${ps.dia} ${ps.horario}h (${ps.modalidade})`);
  });
  return results.slice(0, 3); // Retorna até 3 opções
}

function renderTable(data, type, relatedId, valorContrib = null) {
  const tbody = document.getElementById("compatibilidade-tbody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7">Nenhuma compatibilidade encontrada.</td></tr>';
    document.getElementById("resultados-compatibilidade").style.display =
      "block";
    return;
  }

  data.forEach((item) => {
    const matchText = item.commonSlots.join(", ");
    const valor =
      type === "professionals" ? valorContrib : item.valorContribuicao;

    const tr = document.createElement("tr");
    tr.dataset.relatedId = relatedId;
    tr.dataset.itemId = item.id;
    tr.dataset.type = type;
    // DATA-ATTRIBUTES CRÍTICOS PARA O TENTATIVAS.JS FUNCIONAR
    tr.dataset.match = matchText;
    tr.dataset.valor = valor || "0,00";

    tr.innerHTML = `
            <td>${item.nome || item.nomeCompleto}</td>
            <td>${item.telefone || item.telefoneCelular || "N/A"}</td>
            <td>${matchText}</td>
            <td>-</td>
            <td>${valor || "N/A"}</td>
            <td>-</td>
            <td><button class="btn btn-sm btn-primary btn-iniciar">Iniciar Tentativa</button></td>
        `;
    tbody.appendChild(tr);
  });
  document.getElementById("resultados-compatibilidade").style.display = "block";
}

async function handleTableClick(e) {
  if (!e.target.classList.contains("btn-iniciar")) return;

  const row = e.target.closest("tr");
  const type = row.dataset.type;
  // Garante que pega do dataset
  const matchInfo = row.dataset.match;
  const valor = row.dataset.valor;

  let pacId, profId, pacNome, profNome, pacTel;

  const itemData =
    type === "patients"
      ? allPatients.find((p) => p.id === row.dataset.itemId)
      : allProfessionals.find((p) => p.id === row.dataset.itemId);

  const relatedData =
    type === "patients"
      ? allProfessionals.find((p) => p.id === row.dataset.relatedId)
      : allPatients.find((p) => p.id === row.dataset.relatedId);

  if (type === "patients") {
    pacId = itemData.id;
    pacNome = itemData.nomeCompleto;
    pacTel = itemData.telefoneCelular;
    profId = relatedData.id;
    profNome = relatedData.nome;
  } else {
    profId = itemData.id;
    profNome = itemData.nome;
    pacId = relatedData.id;
    pacNome = relatedData.nomeCompleto;
    pacTel = relatedData.telefoneCelular;
  }

  e.target.disabled = true;
  e.target.textContent = "Salvando...";

  try {
    await addDoc(collection(firestoreDb, "agendamentoTentativas"), {
      pacienteId: pacId,
      pacienteNome: pacNome,
      pacienteTelefone: pacTel,
      profissionalId: profId,
      profissionalNome: profNome,
      horarioCompativel: matchInfo,
      valorContribuicao: valor,
      status: "Primeiro Contato",
      criadoEm: serverTimestamp(),
    });
    alert("Tentativa iniciada! Verifique a aba 'Agendamento de Sessão'.");
    row.remove();
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar.");
    e.target.disabled = false;
  }
}
