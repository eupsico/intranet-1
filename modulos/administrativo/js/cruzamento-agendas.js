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
} from "../../../assets/js/firebase-init.js";

let allProfessionals = [];
let allPatients = [];
let unsubscribeTentativas;

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

// Helper para converter array de slots em texto simples para salvar no banco
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

// Helper para gerar o Badge colorido da modalidade
function getModalityBadge(modality) {
  const m = normalizeText(modality);
  if (m.includes("online"))
    return '<span class="badge bg-info text-dark">Online</span>';
  if (m.includes("presencial"))
    return '<span class="badge bg-success">Presencial</span>';
  if (m.includes("ambas"))
    return '<span class="badge bg-secondary">Ambas</span>';
  return `<span class="badge bg-light text-dark">${modality}</span>`;
}

// Helper para verificar compatibilidade de período
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

// --- FUNÇÃO DE NORMALIZAÇÃO ---
function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/-/g, "") // Remove hífens (On-line -> Online)
    .trim();
}

export function init(dbInstance, user, userData) {
  const profissionalSelect = document.getElementById("profissional-select");
  const pacienteSelect = document.getElementById("paciente-select");

  const spinner = document.getElementById("loading-spinner");
  const resultadosDiv = document.getElementById("resultados-compatibilidade");
  const tituloResultados = document.getElementById("titulo-resultados");
  const tabelaHeaders = document.getElementById("tabela-headers");
  const compatibilidadeBody = document.getElementById("compatibilidade-tbody");

  const tentativasBody = document.getElementById("tentativas-tbody");
  const disponibilidadeGeralBody = document.getElementById(
    "disponibilidade-geral-tbody"
  );

  const nenhumResultadoMsg = document.getElementById("nenhum-resultado-msg");
  const nenhumaTentativaMsg = document.getElementById("nenhuma-tentativa");
  const nenhumProfissionalDispMsg = document.getElementById(
    "nenhum-profissional-disponibilidade"
  );

  const tabsContainer = document.getElementById("cruzamento-tabs");

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
      activeTab.style.display = "block";
      activeTab.classList.add("active");
    }
  });

  // --- Carregamento de Dados Iniciais ---
  async function loadProfessionals() {
    profissionalSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
      const q = query(
        collection(db, "usuarios"),
        where("fazAtendimento", "==", true)
      );
      const querySnapshot = await getDocs(q);
      allProfessionals = [];
      querySnapshot.forEach((doc) => {
        allProfessionals.push({ id: doc.id, ...doc.data() });
      });
      allProfessionals.sort((a, b) => a.nome.localeCompare(b.nome));

      let optionsHtml =
        '<option value="">Selecione um profissional...</option>';
      allProfessionals.forEach((prof) => {
        optionsHtml += `<option value="${prof.id}">${prof.nome}</option>`;
      });
      profissionalSelect.innerHTML = optionsHtml;

      renderAllProfessionalsAvailability();
    } catch (error) {
      console.error("Erro ao carregar profissionais:", error);
      profissionalSelect.innerHTML =
        '<option value="">Erro ao carregar</option>';
    }
  }

  async function loadPatients() {
    pacienteSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
      const q = query(
        collection(db, "trilhaPaciente"),
        where("status", "in", ["encaminhar_para_plantao", "encaminhar_para_pb"])
      );
      const querySnapshot = await getDocs(q);
      allPatients = [];
      querySnapshot.forEach((doc) => {
        allPatients.push({ id: doc.id, ...doc.data() });
      });
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
      pacienteSelect.innerHTML = optionsHtml;
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
      pacienteSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  function renderAllProfessionalsAvailability() {
    const professionalsWithAvailability = allProfessionals.filter(
      (p) => p.horarios && p.horarios.length > 0
    );

    if (professionalsWithAvailability.length === 0) {
      nenhumProfissionalDispMsg.style.display = "block";
      disponibilidadeGeralBody.innerHTML = "";
      return;
    }

    let rowsHtml = "";
    professionalsWithAvailability.forEach((prof) => {
      const modalidades = [...new Set(prof.horarios.map((h) => h.modalidade))];
      const modalidadesHtml = modalidades
        .map((m) => getModalityBadge(m))
        .join(" ");

      rowsHtml += `
                <tr>
                    <td>${prof.nome}</td>
                    <td>${formatProfGeneralAvailability(prof.horarios)}</td>
                    <td>${modalidadesHtml}</td>
                </tr>
            `;
    });
    disponibilidadeGeralBody.innerHTML = rowsHtml;
  }

  // --- Lógica de Cruzamento 1: Profissional -> Pacientes ---
  function findCompatiblePatients() {
    const professionalId = profissionalSelect.value;

    if (professionalId) {
      pacienteSelect.value = "";
    } else {
      resultadosDiv.style.display = "none";
      return;
    }

    spinner.style.display = "block";
    resultadosDiv.style.display = "none";
    compatibilidadeBody.innerHTML = "";
    nenhumResultadoMsg.style.display = "none";
    tituloResultados.textContent = "Pacientes Compatíveis Encontrados";

    tabelaHeaders.innerHTML = `
        <tr>
            <th scope="col">Nome do Paciente</th>
            <th scope="col">Telefone</th>
            <th scope="col">Disponibilidade Paciente</th>
            <th scope="col">Match (Horário Profissional)</th>
            <th scope="col">Valor Contrib.</th>
            <th scope="col">Modalidade</th>
            <th scope="col">Ação</th>
        </tr>
    `;

    setTimeout(() => {
      try {
        const professional = allProfessionals.find(
          (p) => p.id === professionalId
        );
        const professionalAvailability = professional?.horarios || [];

        const compatiblePatients = [];

        allPatients.forEach((patient) => {
          const patientAvailability = patient.disponibilidadeEspecifica || [];
          const patientModalidade = normalizeText(
            patient.modalidadeAtendimento || "Qualquer"
          );

          let commonSlots = new Set();
          let matchedModalityType = "indefinido";

          professionalAvailability.forEach((profSlot) => {
            if (profSlot.status !== "disponivel") return;

            const profModality = normalizeText(profSlot.modalidade || "");

            const modalityMatch =
              patientModalidade === "qualquer" ||
              profModality === "ambas" ||
              profModality === patientModalidade;

            if (!modalityMatch) return;

            patientAvailability.forEach((patientSlot) => {
              const [periodo, hora] = patientSlot.split("_");
              const horaNum = parseInt(hora.split(":")[0], 10);
              if (
                profSlot.horario === horaNum &&
                checkPeriodMatch(periodo, profSlot.dia)
              ) {
                commonSlots.add(patientSlot);
                matchedModalityType =
                  profModality === "ambas"
                    ? "Ambas"
                    : profModality === "online"
                    ? "Online"
                    : "Presencial";
              }
            });
          });

          if (commonSlots.size > 0) {
            const commonSlotsArray = Array.from(commonSlots);
            const profCommonSlots = professionalAvailability
              .filter((profSlot) =>
                commonSlotsArray.some((pSlot) => {
                  const [period, hora] = pSlot.split("_");
                  return (
                    profSlot.horario === parseInt(hora.split(":")[0], 10) &&
                    checkPeriodMatch(period, profSlot.dia)
                  );
                })
              )
              .map((s) => `${s.dia.toLowerCase()}_${s.horario}:00`);

            compatiblePatients.push({
              ...patient,
              matchingPatientSlots: commonSlotsArray,
              matchingProfSlots: [...new Set(profCommonSlots)],
              matchedModality: matchedModalityType,
            });
          }
        });

        renderPatientsTable(compatiblePatients);
      } catch (error) {
        console.error(
          "Erro no algoritmo de compatibilidade (Prof -> Paciente):",
          error
        );
        window.showToast("Erro ao processar compatibilidade.", "error");
      } finally {
        spinner.style.display = "none";
        resultadosDiv.style.display = "block";
      }
    }, 100);
  }

  // --- Lógica de Cruzamento 2: Paciente -> Profissionais ---
  function findCompatibleProfessionals() {
    const patientId = pacienteSelect.value;

    if (patientId) {
      profissionalSelect.value = "";
    } else {
      resultadosDiv.style.display = "none";
      return;
    }

    spinner.style.display = "block";
    resultadosDiv.style.display = "none";
    compatibilidadeBody.innerHTML = "";
    nenhumResultadoMsg.style.display = "none";
    tituloResultados.textContent = "Profissionais Compatíveis Encontrados";

    tabelaHeaders.innerHTML = `
        <tr>
            <th scope="col">Nome do Profissional</th>
            <th scope="col">Valor Contrib.</th>
            <th scope="col">Match (Horário Profissional)</th>
            <th scope="col">Disponibilidade Paciente</th>
            <th scope="col">Modalidade</th>
            <th scope="col">Ação</th>
        </tr>
    `;

    setTimeout(() => {
      try {
        const patient = allPatients.find((p) => p.id === patientId);
        if (!patient) throw new Error("Paciente não encontrado na lista.");

        const patientAvailability = patient.disponibilidadeEspecifica || [];
        const patientModalidade = normalizeText(
          patient.modalidadeAtendimento || "Qualquer"
        );

        const compatibleProfessionals = [];

        allProfessionals.forEach((prof) => {
          const profAvailability = prof.horarios || [];
          let commonSlots = new Set();
          let matchingProfSlots = new Set();
          let matchTypeScore = 0;
          let displayModality = "Vários";

          profAvailability.forEach((profSlot) => {
            if (profSlot.status !== "disponivel") return;

            const profModality = normalizeText(profSlot.modalidade || "");

            const modalityMatch =
              patientModalidade === "qualquer" ||
              profModality === "ambas" ||
              profModality === patientModalidade;

            if (!modalityMatch) return;

            patientAvailability.forEach((patientSlot) => {
              const [periodo, hora] = patientSlot.split("_");
              const horaNum = parseInt(hora.split(":")[0], 10);

              if (
                profSlot.horario === horaNum &&
                checkPeriodMatch(periodo, profSlot.dia)
              ) {
                commonSlots.add(patientSlot);
                matchingProfSlots.add(
                  `${profSlot.dia.toLowerCase()}_${profSlot.horario}:00`
                );

                if (patientModalidade === "online") {
                  if (profModality === "online") matchTypeScore = 2;
                  else if (profModality === "ambas" && matchTypeScore < 2)
                    matchTypeScore = 1;
                } else {
                  matchTypeScore = 1;
                }

                if (profModality === "ambas") displayModality = "Ambas";
                else if (profModality === "online") displayModality = "Online";
                else if (profModality === "presencial")
                  displayModality = "Presencial";
              }
            });
          });

          if (matchingProfSlots.size > 0) {
            compatibleProfessionals.push({
              ...prof,
              matchingPatientSlots: Array.from(commonSlots),
              matchingProfSlots: Array.from(matchingProfSlots),
              contato:
                prof.telefone || prof.celular || prof.email || "Sem contato",
              matchScore: matchTypeScore,
              matchedModality: displayModality,
            });
          }
        });

        // Ordenação
        compatibleProfessionals.sort((a, b) => {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return a.nome.localeCompare(b.nome);
        });

        renderProfessionalsTable(
          compatibleProfessionals,
          patient.id,
          patient.valorContribuicao
        );
      } catch (error) {
        console.error(
          "Erro no algoritmo de compatibilidade (Paciente -> Prof):",
          error
        );
        window.showToast("Erro ao processar compatibilidade.", "error");
      } finally {
        spinner.style.display = "none";
        resultadosDiv.style.display = "block";
      }
    }, 100);
  }

  // --- Renderização das Tabelas ---

  function renderPatientsTable(patients) {
    if (patients.length === 0) {
      nenhumResultadoMsg.textContent =
        "Nenhum paciente compatível encontrado para este profissional.";
      nenhumResultadoMsg.style.display = "block";
      compatibilidadeBody.innerHTML = "";
      return;
    }

    let rowsHtml = "";
    patients.forEach((patient) => {
      // Gera texto plano dos slots para salvar no DB ao clicar
      const matchText = formatSlotsToText(patient.matchingProfSlots);

      rowsHtml += `
                <tr data-patient-id="${patient.id}" data-patient-name="${
        patient.nomeCompleto
      }" data-match="${matchText}">
                    <td>${patient.nomeCompleto}</td>
                    <td>${patient.telefoneCelular || "N/A"}</td>
                    <td>${formatPatientAvailability(
                      patient.matchingPatientSlots
                    )}</td>
                    <td>${formatProfMatchAvailability(
                      patient.matchingProfSlots
                    )}</td>
                    <td>${patient.valorContribuicao || "N/A"}</td>
                    <td>${getModalityBadge(patient.matchedModality)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary action-button btn-iniciar-tentativa">Iniciar Tentativa</button>
                    </td>
                </tr>
            `;
    });
    compatibilidadeBody.innerHTML = rowsHtml;
  }

  function renderProfessionalsTable(professionals, patientId, patientValue) {
    if (professionals.length === 0) {
      nenhumResultadoMsg.textContent =
        "Nenhum profissional compatível encontrado para este paciente.";
      nenhumResultadoMsg.style.display = "block";
      compatibilidadeBody.innerHTML = "";
      return;
    }

    let rowsHtml = "";
    professionals.forEach((prof) => {
      // Gera texto plano dos slots para salvar no DB ao clicar
      const matchText = formatSlotsToText(prof.matchingProfSlots);

      rowsHtml += `
            <tr data-professional-id="${
              prof.id
            }" data-patient-id="${patientId}" data-match="${matchText}">
                <td>${prof.nome}</td>
                <td>${patientValue || "N/A"}</td>
                <td>${formatProfMatchAvailability(prof.matchingProfSlots)}</td>
                <td>${formatPatientAvailability(prof.matchingPatientSlots)}</td>
                <td>${getModalityBadge(prof.matchedModality)}</td>
                <td>
                    <button class="btn btn-sm btn-success action-button btn-iniciar-tentativa-reverso">Selecionar</button>
                </td>
            </tr>
      `;
    });
    compatibilidadeBody.innerHTML = rowsHtml;
  }

  // --- Tentativas de Agendamento ---

  function listenToSchedulingAttempts() {
    const q = query(collection(db, "agendamentoTentativas"));

    if (unsubscribeTentativas) unsubscribeTentativas();

    unsubscribeTentativas = onSnapshot(q, (snapshot) => {
      const tentativas = [];
      snapshot.forEach((doc) => {
        tentativas.push({ id: doc.id, ...doc.data() });
      });
      renderTentativasTable(tentativas);
    });
  }

  function renderTentativasTable(tentativas) {
    if (tentativas.length === 0) {
      nenhumaTentativaMsg.style.display = "block";
      tentativasBody.innerHTML = "";
      return;
    }

    nenhumaTentativaMsg.style.display = "none";
    tentativas.sort((a, b) =>
      (a.pacienteNome || "").localeCompare(b.pacienteNome || "")
    );

    let rowsHtml = "";
    const statusOptions = [
      "Primeiro Contato",
      "Segundo Contato",
      "Terceiro Contato",
      "Aguardando Confirmação",
      "Aguardando Pagamento",
      "Agendado",
      "Cancelado/Sem Sucesso",
    ];
    tentativas.forEach((item) => {
      const options = statusOptions
        .map(
          (opt) =>
            `<option value="${opt}" ${
              item.status === opt ? "selected" : ""
            }>${opt}</option>`
        )
        .join("");

      rowsHtml += `
                <tr data-tentativa-id="${item.id}">
                    <td>${item.pacienteNome}</td>
                    <td>${item.profissionalNome}</td>
                    <td>${item.horarioCompativel || "-"}</td>
                    <td>${item.valorContribuicao || "-"}</td>
                    <td>${item.pacienteTelefone}</td>
                    <td>
                        <select class="form-select status-select">${options}</select>
                    </td>
                </tr>
            `;
    });
    tentativasBody.innerHTML = rowsHtml;
  }

  // --- Ações de Botões ---

  async function handleStartAttempt(e) {
    const button = e.target;
    const row = button.closest("tr");
    const patientId = row.dataset.patientId;
    const professionalId = profissionalSelect.value;
    const matchInfo = row.dataset.match; // Pega o horário compatível

    if (!professionalId) {
      alert("Erro: Profissional não identificado.");
      return;
    }
    await createAttempt(patientId, professionalId, button, row, matchInfo);
  }

  async function handleStartAttemptReverse(e) {
    const button = e.target;
    const row = button.closest("tr");
    const professionalId = row.dataset.professionalId;
    const patientId = row.dataset.patientId;
    const matchInfo = row.dataset.match; // Pega o horário compatível

    if (!patientId) {
      alert("Erro: Paciente não identificado.");
      return;
    }
    await createAttempt(patientId, professionalId, button, row, matchInfo);
  }

  async function createAttempt(
    patientId,
    professionalId,
    buttonElement,
    rowElement,
    matchInfo
  ) {
    buttonElement.disabled = true;
    buttonElement.textContent = "Iniciando...";
    try {
      const patientDocRef = doc(db, "trilhaPaciente", patientId);
      const professionalDocRef = doc(db, "usuarios", professionalId);
      const [patientDocSnap, professionalDocSnap] = await Promise.all([
        getDoc(patientDocRef),
        getDoc(professionalDocRef),
      ]);

      if (!patientDocSnap.exists() || !professionalDocSnap.exists())
        throw new Error("Dados não encontrados.");
      const patientData = patientDocSnap.data();
      const professionalData = professionalDocSnap.data();

      const tentativaData = {
        pacienteId: patientId,
        pacienteNome: patientData.nomeCompleto,
        pacienteTelefone: patientData.telefoneCelular,
        profissionalId: professionalId,
        profissionalNome: professionalData.nome,
        horarioCompativel: matchInfo || "N/A", // Salva o horário
        valorContribuicao: patientData.valorContribuicao || "N/A", // Salva o valor
        status: "Primeiro Contato",
        criadoEm: serverTimestamp(),
      };

      await addDoc(collection(db, "agendamentoTentativas"), tentativaData);
      window.showToast("Tentativa de agendamento iniciada!", "success");
      rowElement.remove();
    } catch (error) {
      console.error("Erro ao iniciar tentativa:", error);
      window.showToast("Erro ao iniciar tentativa.", "error");
      buttonElement.disabled = false;
      buttonElement.textContent = "Tentar Novamente";
    }
  }

  async function handleStatusChange(e) {
    const select = e.target;
    const tentativaId = select.closest("tr").dataset.tentativaId;
    const newStatus = select.value;
    select.disabled = true;
    try {
      const tentativaRef = doc(db, "agendamentoTentativas", tentativaId);
      await updateDoc(tentativaRef, { status: newStatus });
      window.showToast("Status atualizado!", "success");
    } catch (error) {
      console.error("Erro:", error);
      window.showToast("Erro ao atualizar status.", "error");
    } finally {
      select.disabled = false;
    }
  }

  // --- Event Listeners ---

  profissionalSelect.addEventListener("change", findCompatiblePatients);
  pacienteSelect.addEventListener("change", findCompatibleProfessionals);

  compatibilidadeBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-iniciar-tentativa"))
      handleStartAttempt(e);
    if (e.target.classList.contains("btn-iniciar-tentativa-reverso"))
      handleStartAttemptReverse(e);
  });

  tentativasBody.addEventListener("change", (e) => {
    if (e.target.classList.contains("status-select")) handleStatusChange(e);
  });

  loadProfessionals();
  loadPatients();
  listenToSchedulingAttempts();
}
