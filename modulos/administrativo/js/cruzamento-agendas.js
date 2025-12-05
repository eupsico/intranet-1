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
let allPatients = []; // Cache para pacientes carregados
let unsubscribeTentativas;

// Função para formatar a exibição da disponibilidade do PACIENTE
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

// Função para formatar a exibição da disponibilidade do PROFISSIONAL (MATCH)
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

// Função para formatar a disponibilidade GERAL do PROFISSIONAL
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

  // --- Lógica de Renderização Geral ---

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
        .map((m) => `<span class="modalidade-badge ${m}">${m}</span>`)
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

  // --- Lógica de Cruzamento: Profissional -> Pacientes ---

  function findCompatiblePatients() {
    const professionalId = profissionalSelect.value;

    // Limpa a seleção do outro campo
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

    // Configura Cabeçalho da Tabela
    tabelaHeaders.innerHTML = `
        <tr>
            <th scope="col">Nome do Paciente</th>
            <th scope="col">Telefone</th>
            <th scope="col">Disponibilidade Paciente</th>
            <th scope="col">Match (Horário Profissional)</th>
            <th scope="col">Fila</th>
            <th scope="col">Ação</th>
        </tr>
    `;

    setTimeout(() => {
      // Timeout simulado para não travar UI se array for grande, e usar dados já carregados
      try {
        const professional = allProfessionals.find(
          (p) => p.id === professionalId
        );
        const professionalAvailability = professional?.horarios || [];

        // Filtra os pacientes que já foram carregados em loadPatients
        // Se allPatients estiver vazio (ex: erro no load), buscar novamente seria ideal, mas aqui usamos o cache
        const compatiblePatients = [];

        allPatients.forEach((patient) => {
          const patientAvailability = patient.disponibilidadeEspecifica || [];
          const patientModalidade = patient.modalidadeAtendimento || "Qualquer";
          let commonSlots = new Set();

          professionalAvailability.forEach((profSlot) => {
            if (profSlot.status !== "disponivel") return;

            const modalityMatch =
              patientModalidade === "Qualquer" ||
              profSlot.modalidade === "ambas" ||
              profSlot.modalidade.toLowerCase() ===
                patientModalidade.toLowerCase();

            if (!modalityMatch) return;

            patientAvailability.forEach((patientSlot) => {
              const [periodo, hora] = patientSlot.split("_");
              const horaNum = parseInt(hora.split(":")[0], 10);
              if (
                profSlot.horario === horaNum &&
                checkPeriodMatch(periodo, profSlot.dia)
              ) {
                commonSlots.add(patientSlot);
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
            });
          }
        });

        renderPatientsTable(compatiblePatients);
      } catch (error) {
        console.error(
          "Erro no algoritmo de compatibilidade (Profissional -> Paciente):",
          error
        );
        window.showToast("Erro ao processar compatibilidade.", "error");
      } finally {
        spinner.style.display = "none";
        resultadosDiv.style.display = "block";
      }
    }, 100);
  }

  // --- Lógica de Cruzamento: Paciente -> Profissionais ---

  function findCompatibleProfessionals() {
    const patientId = pacienteSelect.value;

    // Limpa a seleção do outro campo
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

    // Configura Cabeçalho da Tabela
    tabelaHeaders.innerHTML = `
        <tr>
            <th scope="col">Nome do Profissional</th>
            <th scope="col">Contato</th>
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
        const patientModalidade = patient.modalidadeAtendimento || "Qualquer";

        const compatibleProfessionals = [];

        allProfessionals.forEach((prof) => {
          const profAvailability = prof.horarios || [];
          let commonSlots = new Set();
          let matchingProfSlots = new Set();

          profAvailability.forEach((profSlot) => {
            if (profSlot.status !== "disponivel") return;

            const modalityMatch =
              patientModalidade === "Qualquer" ||
              profSlot.modalidade === "ambas" ||
              profSlot.modalidade.toLowerCase() ===
                patientModalidade.toLowerCase();

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
            });
          }
        });

        renderProfessionalsTable(compatibleProfessionals, patient.id);
      } catch (error) {
        console.error(
          "Erro no algoritmo de compatibilidade (Paciente -> Profissional):",
          error
        );
        window.showToast("Erro ao processar compatibilidade.", "error");
      } finally {
        spinner.style.display = "none";
        resultadosDiv.style.display = "block";
      }
    }, 100);
  }

  // --- Funções Auxiliares de Lógica ---

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

  // --- Renderização de Tabelas de Resultados ---

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
      const fila =
        patient.status === "encaminhar_para_plantao" ? "Plantão" : "PB";
      rowsHtml += `
                <tr data-patient-id="${patient.id}" data-patient-name="${
        patient.nomeCompleto
      }">
                    <td>${patient.nomeCompleto}</td>
                    <td>${patient.telefoneCelular || "N/A"}</td>
                    <td>${formatPatientAvailability(
                      patient.matchingPatientSlots
                    )}</td>
                    <td>${formatProfMatchAvailability(
                      patient.matchingProfSlots
                    )}</td>
                    <td><span class="badge bg-secondary">${fila}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary action-button btn-iniciar-tentativa">Iniciar Tentativa</button>
                    </td>
                </tr>
            `;
    });
    compatibilidadeBody.innerHTML = rowsHtml;
  }

  function renderProfessionalsTable(professionals, patientId) {
    if (professionals.length === 0) {
      nenhumResultadoMsg.textContent =
        "Nenhum profissional compatível encontrado para este paciente.";
      nenhumResultadoMsg.style.display = "block";
      compatibilidadeBody.innerHTML = "";
      return;
    }

    let rowsHtml = "";
    professionals.forEach((prof) => {
      rowsHtml += `
            <tr data-professional-id="${
              prof.id
            }" data-patient-id="${patientId}">
                <td>${prof.nome}</td>
                <td>${prof.contato}</td>
                <td>${formatProfMatchAvailability(prof.matchingProfSlots)}</td>
                <td>${formatPatientAvailability(prof.matchingPatientSlots)}</td>
                <td><span class="badge bg-info text-dark">Compatível</span></td>
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

  // Caso 1: Usuário selecionou Profissional -> Clicou em um Paciente da lista
  async function handleStartAttempt(e) {
    const button = e.target;
    const row = button.closest("tr");
    const patientId = row.dataset.patientId;
    // O profissional é o que está no select principal
    const professionalId = profissionalSelect.value;

    if (!professionalId) {
      alert("Erro: Profissional não identificado.");
      return;
    }

    await createAttempt(patientId, professionalId, button, row);
  }

  // Caso 2: Usuário selecionou Paciente -> Clicou em um Profissional da lista
  async function handleStartAttemptReverse(e) {
    const button = e.target;
    const row = button.closest("tr");
    const professionalId = row.dataset.professionalId;
    // O paciente é o que está no select principal (ou passado via data-attribute na row)
    const patientId = row.dataset.patientId;

    if (!patientId) {
      alert("Erro: Paciente não identificado.");
      return;
    }

    await createAttempt(patientId, professionalId, button, row);
  }

  // Função unificada para criar a tentativa no Firebase
  async function createAttempt(
    patientId,
    professionalId,
    buttonElement,
    rowElement
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

      if (!patientDocSnap.exists() || !professionalDocSnap.exists()) {
        throw new Error("Paciente ou profissional não encontrado.");
      }

      const patientData = patientDocSnap.data();
      const professionalData = professionalDocSnap.data();

      const tentativaData = {
        pacienteId: patientId,
        pacienteNome: patientData.nomeCompleto,
        pacienteTelefone: patientData.telefoneCelular,
        profissionalId: professionalId,
        profissionalNome: professionalData.nome,
        status: "Primeiro Contato",
        criadoEm: serverTimestamp(),
      };

      await addDoc(collection(db, "agendamentoTentativas"), tentativaData);

      window.showToast("Tentativa de agendamento iniciada!", "success");
      rowElement.remove(); // Remove da lista de sugestões pois já virou tentativa

      // Se necessário, recarregar a tabela para atualizar dados,
      // mas remover a linha visualmente já dá feedback imediato.
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
      console.error("Erro ao atualizar status:", error);
      window.showToast("Erro ao atualizar status.", "error");
    } finally {
      select.disabled = false;
    }
  }

  // --- Event Listeners ---

  profissionalSelect.addEventListener("change", findCompatiblePatients);
  pacienteSelect.addEventListener("change", findCompatibleProfessionals);

  compatibilidadeBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-iniciar-tentativa")) {
      handleStartAttempt(e);
    }
    if (e.target.classList.contains("btn-iniciar-tentativa-reverso")) {
      handleStartAttemptReverse(e);
    }
  });

  tentativasBody.addEventListener("change", (e) => {
    if (e.target.classList.contains("status-select")) {
      handleStatusChange(e);
    }
  });

  // Inicialização
  loadProfessionals();
  loadPatients();
  listenToSchedulingAttempts();
}
