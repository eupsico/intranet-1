// Arquivo: /modulos/voluntario/js/agendamento.js
// Versão 3.0 (Integrado com as Configurações do Sistema)

import { obterSlotsValidos } from "./utils/slots.js";
import {
  db,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  doc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// Variáveis de escopo do módulo
let currentUser;
let currentUserData;
let systemConfigs = null; // Cache para as configurações do sistema
const modal = document.getElementById("agendamento-modal");

/**
 * Carrega as configurações do sistema do Firestore.
 * Usa um cache para evitar buscas repetidas.
 */
async function loadSystemConfigs() {
  if (systemConfigs) {
    return systemConfigs; // Retorna do cache se já carregado
  }
  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      systemConfigs = docSnap.data();
      console.log("Configurações do sistema carregadas:", systemConfigs);
      return systemConfigs;
    } else {
      console.warn(
        "Documento de configurações do sistema não encontrado. Usando valores padrão."
      );
      // Define valores padrão para evitar que a aplicação quebre
      systemConfigs = { financeiro: { percentualSupervisao: 20 } };
      return systemConfigs;
    }
  } catch (error) {
    console.error("Erro ao carregar configurações do sistema:", error);
    // Define valores padrão em caso de erro
    systemConfigs = { financeiro: { percentualSupervisao: 20 } };
    return systemConfigs;
  }
}

function formatarMoeda(input) {
  let value = input.value.replace(/\D/g, "");
  if (value === "") {
    input.value = "";
    return;
  }
  value = (parseInt(value) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  input.value = value;
}

function parseCurrency(currencyString) {
  if (!currencyString) return 0;
  const numericString = currencyString
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return parseFloat(numericString) || 0;
}

function calculateCapacity(inicio, fim) {
  try {
    const [startH, startM] = inicio.split(":").map(Number);
    const [endH, endM] = fim.split(":").map(Number);
    return Math.floor((endH * 60 + endM - (startH * 60 + startM)) / 30);
  } catch (e) {
    console.error("Erro ao calcular capacidade do horário:", e);
    return 0;
  }
}

function updateSupervisionCost() {
  if (!modal || !systemConfigs) return;
  const numeroPacientesInput = modal.querySelector("#numero-pacientes");
  if (!numeroPacientesInput) return;

  const numeroPacientes = parseInt(numeroPacientesInput.value, 10) || 0;
  let valorTotalContribuicao = 0;

  for (let i = 1; i <= numeroPacientes; i++) {
    const contribuicaoInput = modal.querySelector(
      `#paciente-contribuicao-${i}`
    );
    if (contribuicaoInput) {
      valorTotalContribuicao += parseCurrency(contribuicaoInput.value);
    }
  }

  const percentual =
    parseFloat(systemConfigs.financeiro?.percentualSupervisao) || 20;
  const valorSupervisao = valorTotalContribuicao * (percentual / 100);

  const totalEl = modal.querySelector("#total-contribuicoes-valor");
  const supervisaoEl = modal.querySelector("#valor-supervisao-calculado");

  if (totalEl) {
    totalEl.textContent = valorTotalContribuicao.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  if (supervisaoEl) {
    supervisaoEl.textContent = valorSupervisao.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
}

function renderPatientInputs(count) {
  if (!modal) return;
  const container = modal.querySelector("#pacientes-container");
  if (!container) return;

  container.innerHTML = "";
  if (isNaN(count) || count < 1) {
    updateSupervisionCost();
    return;
  }

  for (let i = 1; i <= count; i++) {
    container.innerHTML += `
              <div class="form-row" style="gap: 15px; align-items: flex-end; border-left: 3px solid #f0f0f0; padding-left: 15px; margin-bottom: 10px;">
                  <div class="form-group" style="flex-grow: 2;">
                      <label for="paciente-iniciais-${i}">Iniciais do Paciente ${i}</label>
                      <input type="text" id="paciente-iniciais-${i}" class="form-control" placeholder="Ex: A.B.C.">
                  </div>
                  <div class="form-group" style="flex-grow: 1;">
                      <label for="paciente-contribuicao-${i}">Valor Contribuição</label>
                      <input type="text" id="paciente-contribuicao-${i}" class="form-control" placeholder="R$ 0,00">
                  </div>
              </div>`;
  }

  container
    .querySelectorAll('input[id^="paciente-contribuicao-"]')
    .forEach((input) => {
      input.addEventListener("input", () => {
        formatarMoeda(input);
        updateSupervisionCost();
      });
    });

  updateSupervisionCost();
}

function renderDates(horariosDisponiveis) {
  if (!modal) return;
  const datasContainer = modal.querySelector("#datas-disponiveis-container");
  const confirmBtn = modal.querySelector("#agendamento-confirm-btn");
  if (!datasContainer || !confirmBtn) return;

  datasContainer.innerHTML = "";

  const availableSlots = horariosDisponiveis.filter(
    (slot) => slot.capacity - slot.booked > 0
  );

  if (availableSlots.length === 0) {
    datasContainer.innerHTML = `<p class="alert alert-info">Não há vagas disponíveis para agendamento no momento.</p>`;
    confirmBtn.disabled = true;
    return;
  }

  availableSlots.forEach((slot, index) => {
    const formattedDate = slot.date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const diaSemana = slot.date.toLocaleDateString("pt-BR", {
      weekday: "long",
    });
    const horarioInfo = `${
      diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
    } - ${slot.horario.inicio}`;
    const vagasRestantes = slot.capacity - slot.booked;
    const radioId = `date-${index}`;

    datasContainer.innerHTML += `
              <div class="date-option">
                  <input type="radio" id="${radioId}" name="data_agendamento" value="${slot.date.toISOString()}">
                  <label for="${radioId}">
                      <strong>${formattedDate}</strong> (${horarioInfo}) <span>Vagas restantes: ${vagasRestantes}</span>
                  </label>
              </div>`;
  });

  confirmBtn.disabled = false;
}

async function handleConfirmAgendamento(currentSupervisorData) {
  if (!modal || !systemConfigs) return;
  const nome = modal.querySelector("#agendamento-profissional-nome").value;
  const email = modal.querySelector("#agendamento-profissional-email").value;
  const telefone = modal.querySelector(
    "#agendamento-profissional-telefone"
  ).value;
  const selectedRadio = modal.querySelector(
    'input[name="data_agendamento"]:checked'
  );

  if (!selectedRadio) {
    alert("Por favor, selecione uma data para o agendamento.");
    return;
  }
  if (!nome) {
    alert("Seus dados não foram encontrados. Por favor, recarregue a página.");
    return;
  }

  const confirmBtn = modal.querySelector("#agendamento-confirm-btn");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Aguarde...";

  const numeroPacientes =
    parseInt(modal.querySelector("#numero-pacientes").value, 10) || 0;

  if (numeroPacientes > 0) {
    const iniciaisPaciente1 = modal.querySelector(
      "#paciente-iniciais-1"
    )?.value;
    if (!iniciaisPaciente1 || iniciaisPaciente1.trim() === "") {
      alert(
        "O preenchimento das informações do Paciente 1 (iniciais) é obrigatório."
      );
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirmar Agendamento";
      return;
    }
  }

  const pacientes = [];
  let valorTotalContribuicao = 0;
  for (let i = 1; i <= numeroPacientes; i++) {
    const iniciais = modal.querySelector(`#paciente-iniciais-${i}`).value;
    const contribuicaoString = modal.querySelector(
      `#paciente-contribuicao-${i}`
    ).value;
    if (iniciais) {
      pacientes.push({ iniciais, contribuicao: contribuicaoString });
      valorTotalContribuicao += parseCurrency(contribuicaoString);
    }
  }

  const percentual =
    parseFloat(systemConfigs.financeiro?.percentualSupervisao) || 20;
  const valorSupervisao = valorTotalContribuicao * (percentual / 100);

  const agendamentoData = {
    supervisorUid: currentSupervisorData.uid,
    supervisorNome: currentSupervisorData.nome,
    dataAgendamento: Timestamp.fromDate(new Date(selectedRadio.value)),
    profissionalUid: currentUser.uid,
    profissionalNome: nome,
    profissionalEmail: email,
    profissionalTelefone: telefone,
    pacientes,
    valorTotalContribuicao,
    valorSupervisao,
    criadoEm: serverTimestamp(),
  };

  try {
    const agendamentosRef = collection(db, "agendamentos");
    await addDoc(agendamentosRef, agendamentoData);

    modal.querySelector("#agendamento-step-1").style.display = "none";
    modal.querySelector("#agendamento-step-2").style.display = "block";
    modal.querySelector("#footer-step-1").style.display = "none";
    modal.querySelector("#footer-step-2").style.display = "block";
  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    alert(
      "Não foi possível realizar o agendamento. Verifique o console para mais detalhes."
    );
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirmar Agendamento";
  }
}

async function open(user, userData, supervisorData) {
  if (!modal) return;
  if (!userData || !supervisorData) {
    console.error(
      "[Agendamento] Tentativa de abrir o modal com dados incompletos."
    );
    if (!userData) {
      console.error(
        `[Agendamento] Erro Crítico: Não foi possível carregar os dados do usuário logado (ID: ${user?.uid}). Verifique se um documento para este usuário existe na coleção 'users'.`
      );
      alert(
        "Erro grave: Seus dados de perfil não foram encontrados no banco de dados. Não é possível continuar. Por favor, contate o suporte técnico."
      );
    }
    if (!supervisorData) {
      console.error(
        "[Agendamento] Erro Crítico: Os dados do supervisor selecionado não foram fornecidos."
      );
      alert(
        "Erro grave: Os dados do supervisor não foram carregados. Por favor, contate o suporte técnico."
      );
    }
    return;
  }

  await loadSystemConfigs();

  currentUser = user;
  currentUserData = userData;

  modal.querySelector("#agendamento-step-1").style.display = "block";
  modal.querySelector("#agendamento-step-2").style.display = "none";
  modal.querySelector("#footer-step-1").style.display = "flex";
  modal.querySelector("#footer-step-2").style.display = "none";

  modal.querySelector("#agendamento-supervisor-nome").textContent =
    supervisorData.nome;
  modal.querySelector("#agendamento-profissional-nome").value =
    userData.nome || "";
  modal.querySelector("#agendamento-profissional-email").value =
    user.email || "";
  modal.querySelector("#agendamento-profissional-telefone").value =
    userData.contato || "";

  const numeroPacientesInput = modal.querySelector("#numero-pacientes");
  if (numeroPacientesInput) {
    const newNumeroPacientesInput = numeroPacientesInput.cloneNode(true);
    numeroPacientesInput.parentNode.replaceChild(
      newNumeroPacientesInput,
      numeroPacientesInput
    );

    newNumeroPacientesInput.addEventListener("input", (e) => {
      const count = parseInt(e.target.value, 10);
      renderPatientInputs(count);
    });
    renderPatientInputs(parseInt(newNumeroPacientesInput.value, 10));
  }

  modal.style.display = "flex";

  const confirmBtn = modal.querySelector("#agendamento-confirm-btn");
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  newConfirmBtn.addEventListener("click", () =>
    handleConfirmAgendamento(supervisorData)
  );

  const datasContainer = modal.querySelector("#datas-disponiveis-container");
  datasContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    let potentialSlots = [];
    if (
      supervisorData.diasHorarios &&
      Array.isArray(supervisorData.diasHorarios)
    ) {
      potentialSlots = await obterSlotsValidos(supervisorData.diasHorarios);
    }

    const agendamentosRef = collection(db, "agendamentos");
    const slotChecks = potentialSlots.map(async (slot) => {
      const q = query(
        agendamentosRef,
        where("supervisorUid", "==", supervisorData.uid),
        where("dataAgendamento", "==", Timestamp.fromDate(slot.date))
      );

      const querySnapshot = await getDocs(q);
      slot.booked = querySnapshot.size;
      slot.capacity = calculateCapacity(slot.horario.inicio, slot.horario.fim);
      return slot;
    });

    const finalSlots = await Promise.all(slotChecks);
    renderDates(finalSlots);
  } catch (error) {
    console.error("Erro ao buscar e calcular datas disponíveis:", error);
    datasContainer.innerHTML = `<p class="alert alert-error">Ocorreu um erro ao buscar os horários.</p>`;
  }
}

if (modal) {
  const closeModal = () => {
    modal.style.display = "none";
  };
  modal.querySelector(".close-modal-btn").addEventListener("click", closeModal);
  modal
    .querySelector("#agendamento-cancel-btn")
    .addEventListener("click", closeModal);
  modal
    .querySelector("#agendamento-ok-btn")
    .addEventListener("click", closeModal);
}

export const agendamentoController = {
  open,
};
