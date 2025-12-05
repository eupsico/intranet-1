// Arquivo: /modulos/administrativo/js/cruzamento-agendas.js
import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  getDoc,
  deleteDoc, // Adicionado deleteDoc
} from "../../../assets/js/firebase-init.js";

let allProfessionals = [];
let allPatients = [];
let unsubscribeTentativas;
let firestoreDb = db; // Garante referência ao DB

// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---

function formatPatientAvailability(availabilityArray) {
  if (!availabilityArray || availabilityArray.length === 0) return "N/A";
  const translations = {
    "manha-semana": "Manhã (Semana)",
    "tarde-semana": "Tarde (Semana)",
    "noite-semana": "Noite (Semana)",
    "manha-sabado": "Manhã (Sábado)",
  };
  const formatted = availabilityArray
    .map((slot) => {
      const [period, time] = slot.split("_");
      return `<li>${translations[period] || period} - ${time}</li>`;
    })
    .join("");
  return `<ul class="availability-list">${formatted}</ul>`;
}

function formatProfMatchAvailability(slots) {
  if (!slots || slots.length === 0) return "N/A";
  const formatted = slots
    .map((slot) => {
      const [dia, hora] = slot.split("_");
      return `<li>${dia.charAt(0).toUpperCase() + dia.slice(1)} - ${hora}</li>`;
    })
    .join("");
  return `<ul class="availability-list">${formatted}</ul>`;
}

function formatSlotsToText(slots) {
  if (!slots || slots.length === 0) return "N/A";
  return slots
    .map((slot) => {
      const [dia, hora] = slot.split("_");
      return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${hora}`;
    })
    .join(", ");
}

function formatProfGeneralAvailability(horarios) {
  if (!horarios || horarios.length === 0) return "Nenhum horário cadastrado";
  const groupedByDay = horarios.reduce((acc, slot) => {
    const dia = slot.dia.charAt(0).toUpperCase() + slot.dia.slice(1);
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(`${slot.horario}h`);
    return acc;
  }, {});
  let html = '<ul class="availability-list">';
  for (const dia in groupedByDay) {
    html += `<li><strong>${dia}:</strong> ${groupedByDay[dia].join(", ")}</li>`;
  }
  html += "</ul>";
  return html;
}

function getModalityBadge(modality) {
  const m = normalizeText(modality);
  if (m.includes("online"))
    return '<span class="modalidade-badge online">Online</span>';
  if (m.includes("presencial"))
    return '<span class="modalidade-badge presencial">Presencial</span>';
  if (m.includes("ambas"))
    return '<span class="modalidade-badge ambas">Ambas</span>';
  return `<span class="badge bg-light text-dark">${modality}</span>`;
}

function checkPeriodMatch(periodo, diaSemana) {
  const dia = diaSemana.toLowerCase();
  switch (periodo) {
    case "manha-semana":
      return dia !== "sabado" && dia !== "domingo";
    case "tarde-semana":
      return dia !== "sabado" && dia !== "domingo";
    case "noite-semana":
      return dia !== "sabado" && dia !== "domingo";
    case "manha-sabado":
      return dia === "sabado";
    default:
      return false;
  }
}

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, "")
    .trim();
}

function normalizeDiaParaGrade(diaSemana) {
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

// --- INIT PRINCIPAL ---
export function init(dbInstance, user, userData) {
  firestoreDb = dbInstance; // Atualiza referência global

  const profissionalSelect = document.getElementById("profissional-select");
  const pacienteSelect = document.getElementById("paciente-select");
  const tabsContainer = document.getElementById("cruzamento-tabs");

  // Setup de Listeners Iniciais
  if (profissionalSelect)
    profissionalSelect.addEventListener("change", findCompatiblePatients);
  if (pacienteSelect)
    pacienteSelect.addEventListener("change", findCompatibleProfessionals);

  const tbodyCompatibilidade = document.getElementById("compatibilidade-tbody");
  if (tbodyCompatibilidade)
    tbodyCompatibilidade.addEventListener("click", handleTableClick);

  const filtroTentativas = document.getElementById("filtro-status-tentativa");
  if (filtroTentativas) {
    filtroTentativas.addEventListener("change", () => {
      const rows = document.querySelectorAll("#tentativas-tbody tr");
      const val = filtroTentativas.value;
      rows.forEach((row) => {
        if (val === "todos" || row.dataset.status === val) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  }

  // Setup Modal Actions (Fechar/Cancelar)
  const btnCloseModal = document.getElementById("btn-close-modal-acao");
  const btnCancelModal = document.getElementById("btn-cancel-modal-acao");
  const modalAcao = document.getElementById("modal-acao-cruzamento");

  if (btnCloseModal)
    btnCloseModal.onclick = () => (modalAcao.style.display = "none");
  if (btnCancelModal)
    btnCancelModal.onclick = () => (modalAcao.style.display = "none");

  // --- Controle de Abas ---
  tabsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("tab-link")) {
      const tabId = e.target.dataset.tab;
      document
        .querySelectorAll(".tab-link")
        .forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.style.display = "none";
        content.classList.remove("active");
      });
      e.target.classList.add("active");
      const activeTab = document.getElementById(tabId);
      if (activeTab) {
        activeTab.style.display = "block";
        activeTab.classList.add("active");
      }
    }
  });

  // Carregamento Inicial
  loadProfessionals();
  loadPatients();
  listenToSchedulingAttempts(); // Inicia listener da aba Agendamento de Sessão
}

// --- CARREGAMENTO DE DADOS ---
async function loadProfessionals() {
  const select = document.getElementById("profissional-select");
  const geralBody = document.getElementById("disponibilidade-geral-tbody");
  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    const q = query(
      collection(db, "usuarios"),
      where("fazAtendimento", "==", true)
    );
    const querySnapshot = await getDocs(q);
    allProfessionals = [];
    querySnapshot.forEach((doc) =>
      allProfessionals.push({ id: doc.id, ...doc.data() })
    );
    allProfessionals.sort((a, b) => a.nome.localeCompare(b.nome));

    let optionsHtml = '<option value="">Selecione um profissional...</option>';
    allProfessionals.forEach((prof) => {
      optionsHtml += `<option value="${prof.id}">${prof.nome}</option>`;
    });
    select.innerHTML = optionsHtml;
    renderAllProfessionalsAvailability(); // Renderiza aba Disponibilidade Geral
  } catch (error) {
    console.error("Erro profs:", error);
    select.innerHTML = '<option value="">Erro</option>';
  }
}

async function loadPatients() {
  const select = document.getElementById("paciente-select");
  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const q = query(
      collection(db, "trilhaPaciente"),
      where("status", "in", ["encaminhar_para_plantao", "encaminhar_para_pb"])
    );
    const querySnapshot = await getDocs(q);
    allPatients = [];
    querySnapshot.forEach((doc) =>
      allPatients.push({ id: doc.id, ...doc.data() })
    );
    allPatients.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    let optionsHtml =
      '<option value="">Selecione um paciente (Fila de Espera)...</option>';
    allPatients.forEach((paciente) => {
      const fila =
        paciente.status === "encaminhar_para_plantao" ? "Plantão" : "PB";
      optionsHtml += `<option value="${paciente.id}">${paciente.nomeCompleto} (${fila})</option>`;
    });
    select.innerHTML = optionsHtml;
  } catch (error) {
    console.error("Erro pacientes:", error);
    select.innerHTML = '<option value="">Erro</option>';
  }
}

function renderAllProfessionalsAvailability() {
  const tbody = document.getElementById("disponibilidade-geral-tbody");
  if (!tbody) return;

  const professionalsWithAvailability = allProfessionals.filter(
    (p) => p.horarios && p.horarios.length > 0
  );

  if (professionalsWithAvailability.length === 0) {
    document.getElementById(
      "nenhum-profissional-disponibilidade"
    ).style.display = "block";
    tbody.innerHTML = "";
    return;
  }

  let rowsHtml = "";
  professionalsWithAvailability.forEach((prof) => {
    const modalidades = [...new Set(prof.horarios.map((h) => h.modalidade))];
    const modalidadesHtml = modalidades
      .map((m) => getModalityBadge(m))
      .join(" ");
    rowsHtml += `<tr><td>${prof.nome}</td><td>${formatProfGeneralAvailability(
      prof.horarios
    )}</td><td>${modalidadesHtml}</td></tr>`;
  });
  tbody.innerHTML = rowsHtml;
}

// --- LOGICA DE COMPATIBILIDADE ---
function findCompatiblePatients() {
  const professionalId = document.getElementById("profissional-select").value;
  if (professionalId) {
    document.getElementById("paciente-select").value = "";
  } else {
    document.getElementById("resultados-compatibilidade").style.display =
      "none";
    return;
  }
  processCompatibility(professionalId, null);
}

function findCompatibleProfessionals() {
  const patientId = document.getElementById("paciente-select").value;
  if (patientId) {
    document.getElementById("profissional-select").value = "";
  } else {
    document.getElementById("resultados-compatibilidade").style.display =
      "none";
    return;
  }
  processCompatibility(null, patientId);
}

function processCompatibility(profId, pacId) {
  const spinner = document.getElementById("loading-spinner");
  const resultadosDiv = document.getElementById("resultados-compatibilidade");
  const titulo = document.getElementById("titulo-resultados");
  const headers = document.getElementById("tabela-headers");
  const tbody = document.getElementById("compatibilidade-tbody");
  const msgVazio = document.getElementById("nenhum-resultado-msg");

  spinner.style.display = "block";
  resultadosDiv.style.display = "none";
  tbody.innerHTML = "";
  msgVazio.style.display = "none";

  // Define Cabeçalhos
  if (profId) {
    titulo.textContent = "Pacientes Compatíveis Encontrados";
    headers.innerHTML = `<tr><th>Nome do Paciente</th><th>Telefone</th><th>Disp. Paciente</th><th>Match</th><th>Valor</th><th>Modalidade</th><th>Ação</th></tr>`;
  } else {
    titulo.textContent = "Profissionais Compatíveis Encontrados";
    headers.innerHTML = `<tr><th>Nome do Profissional</th><th>Valor</th><th>Match</th><th>Disp. Paciente</th><th>Modalidade</th><th>Ação</th></tr>`;
  }

  setTimeout(() => {
    let matches = [];

    if (profId) {
      // Buscando Pacientes para um Profissional
      const prof = allProfessionals.find((p) => p.id === profId);
      const profSlots = prof?.horarios || [];

      allPatients.forEach((pat) => {
        const patSlots = pat.disponibilidadeEspecifica || [];
        const patMod = normalizeText(pat.modalidadeAtendimento || "Qualquer");

        // Lógica de Match (Simplificada para brevidade, mantendo lógica original)
        let commonSlots = [];
        let matchedMod = "Indefinido";

        profSlots.forEach((ps) => {
          if (ps.status !== "disponivel") return;
          const pMod = normalizeText(ps.modalidade || "");
          const modMatch =
            patMod === "qualquer" || pMod === "ambas" || pMod === patMod;

          if (modMatch) {
            patSlots.forEach((pts) => {
              const [periodo, hora] = pts.split("_");
              const horaNum = parseInt(hora.split(":")[0], 10);
              if (ps.horario === horaNum && checkPeriodMatch(periodo, ps.dia)) {
                commonSlots.push(`${ps.dia} ${ps.horario}h`);
                matchedMod = pMod;
              }
            });
          }
        });

        if (commonSlots.length > 0) {
          matches.push({
            ...pat,
            commonSlots: [...new Set(commonSlots)],
            matchedMod,
            type: "patient",
          });
        }
      });
    } else {
      // Buscando Profissionais para um Paciente
      const pat = allPatients.find((p) => p.id === pacId);
      const patSlots = pat?.disponibilidadeEspecifica || [];
      const patMod = normalizeText(pat.modalidadeAtendimento || "Qualquer");

      allProfessionals.forEach((prof) => {
        const profSlots = prof.horarios || [];
        let commonSlots = [];
        let matchedMod = "Indefinido";

        profSlots.forEach((ps) => {
          if (ps.status !== "disponivel") return;
          const pMod = normalizeText(ps.modalidade || "");
          const modMatch =
            patMod === "qualquer" || pMod === "ambas" || pMod === patMod;

          if (modMatch) {
            patSlots.forEach((pts) => {
              const [periodo, hora] = pts.split("_");
              const horaNum = parseInt(hora.split(":")[0], 10);
              if (ps.horario === horaNum && checkPeriodMatch(periodo, ps.dia)) {
                commonSlots.push(`${ps.dia} ${ps.horario}h`);
                matchedMod = pMod;
              }
            });
          }
        });

        if (commonSlots.length > 0) {
          matches.push({
            ...prof,
            commonSlots: [...new Set(commonSlots)],
            matchedMod,
            type: "professional",
            patientVal: pat.valorContribuicao,
          });
        }
      });
    }

    // Renderiza
    if (matches.length === 0) {
      msgVazio.style.display = "block";
    } else {
      matches.forEach((item) => {
        const matchText = item.commonSlots.join(", ");
        const valor =
          item.type === "professional"
            ? item.patientVal
            : item.valorContribuicao;

        const tr = document.createElement("tr");
        // DATASET CRÍTICO PARA O SAVE FUNCIONAR
        tr.dataset.itemId = item.id;
        tr.dataset.relatedId = profId ? profId : pacId;
        tr.dataset.type = item.type;
        tr.dataset.match = matchText;
        tr.dataset.valor = valor || "0,00";

        if (item.type === "patient") {
          tr.innerHTML = `
                        <td>${item.nomeCompleto}</td>
                        <td>${item.telefoneCelular || "N/A"}</td>
                        <td>${formatPatientAvailability(
                          item.disponibilidadeEspecifica || []
                        )}</td>
                        <td>${matchText}</td>
                        <td>${valor || "N/A"}</td>
                        <td>${getModalityBadge(item.matchedMod)}</td>
                        <td><button class="btn btn-sm btn-primary btn-iniciar">Iniciar Tentativa</button></td>
                    `;
        } else {
          tr.innerHTML = `
                        <td>${item.nome}</td>
                        <td>${valor || "N/A"}</td>
                        <td>${matchText}</td>
                        <td>${formatPatientAvailability(
                          allPatients.find((p) => p.id === pacId)
                            ?.disponibilidadeEspecifica || []
                        )}</td>
                        <td>${getModalityBadge(item.matchedMod)}</td>
                        <td><button class="btn btn-sm btn-success btn-iniciar">Selecionar</button></td>
                    `;
        }
        tbody.appendChild(tr);
      });
    }

    spinner.style.display = "none";
    resultadosDiv.style.display = "block";
  }, 100);
}

// Salva a tentativa no banco
async function handleTableClick(e) {
  if (!e.target.classList.contains("btn-iniciar")) return;

  const row = e.target.closest("tr");
  const matchInfo = row.dataset.match;
  const valor = row.dataset.valor;
  const type = row.dataset.type; // 'patient' ou 'professional'

  let pacId, profId, pacNome, profNome, pacTel;

  if (type === "patient") {
    const pat = allPatients.find((p) => p.id === row.dataset.itemId);
    const prof = allProfessionals.find((p) => p.id === row.dataset.relatedId);
    pacId = pat.id;
    pacNome = pat.nomeCompleto;
    pacTel = pat.telefoneCelular;
    profId = prof.id;
    profNome = prof.nome;
  } else {
    const prof = allProfessionals.find((p) => p.id === row.dataset.itemId);
    const pat = allPatients.find((p) => p.id === row.dataset.relatedId);
    pacId = pat.id;
    pacNome = pat.nomeCompleto;
    pacTel = pat.telefoneCelular;
    profId = prof.id;
    profNome = prof.nome;
  }

  e.target.disabled = true;
  e.target.textContent = "Salvando...";

  try {
    await addDoc(collection(db, "agendamentoTentativas"), {
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
    window.showToast(
      "Tentativa iniciada! Verifique a aba 'Agendamento de Sessão'.",
      "success"
    );
    row.remove();
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar.");
    e.target.disabled = false;
    e.target.textContent = "Tentar Novamente";
  }
}

// --- ABA AGENDAMENTO DE SESSÃO (Tentativas) ---

function listenToSchedulingAttempts() {
  const q = query(collection(db, "agendamentoTentativas"));
  const tbody = document.getElementById("tentativas-tbody");
  const msgVazia = document.getElementById("nenhuma-tentativa");

  if (unsubscribeTentativas) unsubscribeTentativas();

  unsubscribeTentativas = onSnapshot(q, (snapshot) => {
    tbody.innerHTML = "";
    const tentativas = [];
    snapshot.forEach((doc) => tentativas.push({ id: doc.id, ...doc.data() }));

    if (tentativas.length === 0) {
      msgVazia.style.display = "block";
      return;
    }
    msgVazia.style.display = "none";

    tentativas.forEach((t) => {
      const tr = document.createElement("tr");

      // Dados para Modais e Lógica
      tr.dataset.id = t.id;
      tr.dataset.status = t.status;
      tr.dataset.pacienteId = t.pacienteId;
      tr.dataset.profissionalId = t.profissionalId;
      tr.dataset.profissionalNome = t.profissionalNome;
      tr.dataset.horario = t.horarioCompativel;
      tr.dataset.valor = t.valorContribuicao;

      // Aplica Cor
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

      tr.innerHTML = `
                <td>${t.pacienteNome}</td>
                <td>${t.profissionalNome}</td>
                <td>${t.horarioCompativel || "-"}</td>
                <td>${t.valorContribuicao || "-"}</td>
                <td>${t.pacienteTelefone}</td>
                <td>
                    <select class="form-select form-select-sm status-change-select">
                        ${options}
                    </select>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger btn-excluir-tentativa" title="Excluir da lista">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    // Listeners das linhas criadas
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
  tr.className = ""; // Limpa classes
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
  const data = row.dataset;

  updateRowColor(row, newStatus); // Feedback visual imediato

  if (newStatus === "Cancelado/Sem Sucesso") {
    openModalDesistencia(data.id, data.pacienteId);
    e.target.value = data.status; // Reverte visualmente até confirmar
  } else if (newStatus === "Agendado") {
    openModalAgendado(
      data.id,
      data.pacienteId,
      data.profissionalId,
      data.profissionalNome,
      data.horario
    );
    e.target.value = data.status; // Reverte visualmente até confirmar
  } else {
    updateDoc(doc(db, "agendamentoTentativas", data.id), { status: newStatus });
  }
}

async function handleDeleteAttempt(e) {
  if (confirm("Excluir esta tentativa? Isso não afeta a trilha do paciente.")) {
    const id = e.target.closest("tr").dataset.id;
    await deleteDoc(doc(db, "agendamentoTentativas", id));
  }
}

// --- MODAIS E AÇÕES FINAIS ---

function openModalDesistencia(tentativaId, pacienteId) {
  const modal = document.getElementById("modal-acao-cruzamento");
  const title = document.getElementById("modal-acao-titulo");
  const body = document.getElementById("modal-acao-body");
  const btnConfirm = document.getElementById("btn-confirm-modal-acao");

  title.textContent = "Registrar Desistência";
  body.innerHTML = `
        <div class="alert alert-warning">O paciente será movido para 'Desistência' na trilha.</div>
        <div class="form-group"><label>Motivo (Obrigatório):</label>
        <textarea id="modal-motivo" class="form-control" rows="3"></textarea></div>
    `;

  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const motivo = document.getElementById("modal-motivo").value.trim();
    if (!motivo) return alert("Motivo é obrigatório.");

    newBtn.disabled = true;
    try {
      await updateDoc(doc(db, "trilhaPaciente", pacienteId), {
        status: "desistencia",
        desistenciaMotivo: motivo,
        lastUpdate: serverTimestamp(),
      });
      await updateDoc(doc(db, "agendamentoTentativas", tentativaId), {
        status: "Cancelado/Sem Sucesso",
        motivoCancelamento: motivo,
        arquivadoEm: serverTimestamp(),
      });
      modal.style.display = "none";
      alert("Sucesso.");
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      newBtn.disabled = false;
    }
  });
  modal.style.display = "flex";
}

async function openModalAgendado(
  tentativaId,
  pacienteId,
  profId,
  profNome,
  horarioTxt
) {
  const modal = document.getElementById("modal-acao-cruzamento");
  const title = document.getElementById("modal-acao-titulo");
  const body = document.getElementById("modal-acao-body");
  const btnConfirm = document.getElementById("btn-confirm-modal-acao");

  // Tenta obter dados do paciente e prof
  const pacSnap = await getDoc(doc(db, "trilhaPaciente", pacienteId));
  const pacData = pacSnap.data();
  const profSnap = await getDoc(doc(db, "usuarios", profId));
  const profData = profSnap.data();
  const profTel = profData.contato || profData.telefone || "";

  // Tenta extrair hora
  let preHora = "";
  const match = horarioTxt ? horarioTxt.match(/(\d{1,2})/) : null;
  if (match) preHora = `${String(match[0]).padStart(2, "0")}:00`;

  title.textContent = "Confirmar Agendamento";
  body.innerHTML = `
        <div class="alert alert-info small">Isso atualizará a trilha, a grade e a disponibilidade.</div>
        <div class="form-group mb-2"><label>Data 1ª Sessão:</label><input type="date" id="m-data" class="form-control"></div>
        <div class="form-group mb-2"><label>Horário:</label><input type="time" id="m-hora" class="form-control" value="${preHora}"></div>
        <div class="form-group mb-2"><label>Modalidade:</label>
            <select id="m-mod" class="form-control"><option value="Online">Online</option><option value="Presencial">Presencial</option></select>
        </div>
        <hr>
        <button id="btn-zap" class="btn btn-success w-100" ${
          !profTel ? "disabled" : ""
        }>
            <i class="fab fa-whatsapp"></i> Enviar Mensagem ao Profissional
        </button>
    `;

  // Botão Zap
  document.getElementById("btn-zap").onclick = () => {
    const d = document.getElementById("m-data").value;
    const h = document.getElementById("m-hora").value;
    const m = document.getElementById("m-mod").value;
    if (!d || !h) return alert("Preencha data e hora.");

    const msg = `Olá ${profData.nome}, agendamos um paciente!\n*Paciente:* ${
      pacData.nomeCompleto
    }\n*Contato:* ${pacData.telefoneCelular}\n*Início:* ${new Date(
      d
    ).toLocaleDateString(
      "pt-BR"
    )} às ${h}\n*Modalidade:* ${m}\n\nO paciente já consta na sua aba 'Meus Pacientes'.`;
    window.open(
      `https://wa.me/55${profTel.replace(/\D/g, "")}?text=${encodeURIComponent(
        msg
      )}`,
      "_blank"
    );
  };

  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener("click", async () => {
    const d = document.getElementById("m-data").value;
    const h = document.getElementById("m-hora").value;
    const m = document.getElementById("m-mod").value;
    if (!d || !h) return alert("Preencha tudo.");

    newBtn.disabled = true;
    try {
      const dataObj = new Date(d + "T00:00:00");
      const diaSemana = dataObj.toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      const horaInt = parseInt(h.split(":")[0]);

      // 1. Atualizar Trilha
      const fila = pacData.status.includes("plantao") ? "Plantão" : "PB";
      const updateData = {
        status:
          fila === "Plantão"
            ? "agendamento_confirmado_plantao"
            : "em_atendimento_pb",
        lastUpdate: serverTimestamp(),
      };
      if (fila === "Plantão") {
        updateData["plantaoInfo.dataPrimeiraSessao"] = d;
        updateData["plantaoInfo.horaPrimeiraSessao"] = h;
        updateData["plantaoInfo.profissionalId"] = profId;
        updateData["plantaoInfo.profissionalNome"] = profNome;
        updateData["plantaoInfo.tipoAtendimento"] = m;
      }
      await updateDoc(doc(db, "trilhaPaciente", pacienteId), updateData);

      // 2. Arquivar Tentativa
      await updateDoc(doc(db, "agendamentoTentativas", tentativaId), {
        status: "Agendado",
        dataInicio: d,
        horarioFinal: h,
        arquivadoEm: serverTimestamp(),
      });

      // 3. Atualizar Disponibilidade Profissional
      const username = await ocuparHorarioProfissional(
        profId,
        diaSemana,
        horaInt
      );

      // 4. Inserir na Grade
      await verificarEAdicionarGrade(username, m, diaSemana, h);

      alert("Sucesso!");
      modal.style.display = "none";
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      newBtn.disabled = false;
    }
  });
  modal.style.display = "flex";
}

// --- LOGICA DE GRADE ---

async function ocuparHorarioProfissional(profId, diaSemana, horaInt) {
  const userRef = doc(db, "usuarios", profId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("Profissional não encontrado");

  const data = snap.data();
  const diaAlvo = normalizeDiaParaGrade(diaSemana);
  const horarios = data.horarios || [];
  let alterou = false;

  const novosHorarios = horarios.map((slot) => {
    const slotDia = normalizeDiaParaGrade(slot.dia);
    if (slotDia === diaAlvo && parseInt(slot.horario) === horaInt) {
      if (slot.status !== "ocupado") {
        alterou = true;
        return { ...slot, status: "ocupado" };
      }
    }
    return slot;
  });

  if (alterou) await updateDoc(userRef, { horarios: novosHorarios });
  return data.username || data.nome;
}

async function verificarEAdicionarGrade(
  username,
  modalidade,
  diaSemana,
  horaStr
) {
  if (!username) throw new Error("Username não encontrado.");
  const horaFmt = horaStr.replace(":", "-");
  const diaKey = normalizeDiaParaGrade(diaSemana);
  const modKey = modalidade.toLowerCase();

  const gradeRef = doc(db, "administrativo", "grades");
  const snap = await getDoc(gradeRef);
  if (!snap.exists()) return; // Grade não existe

  const gradeData = snap.data();
  const slotData = gradeData[modKey]?.[diaKey]?.[horaFmt] || {};

  const jaExiste = Object.values(slotData).some((v) => v === username);
  if (jaExiste) return; // Já está na grade

  let targetCol = null;
  for (let i = 0; i < 6; i++) {
    if (!slotData[`col${i}`]) {
      targetCol = `col${i}`;
      break;
    }
  }

  if (targetCol) {
    await updateDoc(gradeRef, {
      [`${modKey}.${diaKey}.${horaFmt}.${targetCol}`]: username,
    });
  } else {
    alert("Atenção: Não há vaga na grade para inserir visualmente.");
  }
}
