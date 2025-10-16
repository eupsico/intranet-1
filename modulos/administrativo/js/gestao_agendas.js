// Arquivo: /modulos/administrativo/js/gestao_agendas.js
import { functions } from "../../../assets/js/firebase-init.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

let db, user, userData;
let currentAgendaConfig = null;

export function init(dbRef, userRef, userDataRef) {
  db = dbRef;
  user = userRef;
  userData = userDataRef;

  console.log("🚀 Módulo de Gestão de Agendas iniciado.");
  carregarDisponibilidades();

  const saveButton = document.getElementById("saveConfigButton");
  if (saveButton) {
    saveButton.addEventListener("click", salvarConfiguracaoAgenda);
  }
}

async function carregarDisponibilidades() {
  const spinner = document.getElementById("loading-spinner");
  const table = document.getElementById("disponibilidades-table");
  const noDataMessage = document.getElementById("no-data-message");
  const tableBody = document.getElementById("disponibilidades-body");

  spinner.style.display = "block";
  table.style.display = "none";
  noDataMessage.style.display = "none";
  tableBody.innerHTML = "";

  try {
    const getDisponibilidades = httpsCallable(
      functions,
      "getTodasDisponibilidadesAssistentes"
    );
    const result = await getDisponibilidades();
    const disponibilidadesPorAssistente = result.data;

    console.log(
      "📦 Dados recebidos da Cloud Function:",
      JSON.stringify(disponibilidadesPorAssistente, null, 2)
    );

    if (
      !disponibilidadesPorAssistente ||
      disponibilidadesPorAssistente.length === 0
    ) {
      noDataMessage.style.display = "block";
      spinner.style.display = "none";
      return;
    }

    let hasData = false;

    disponibilidadesPorAssistente.forEach((assistente) => {
      const {
        id: assistenteId,
        nome: assistenteNome,
        disponibilidade,
      } = assistente;

      if (disponibilidade && typeof disponibilidade === "object") {
        for (const mes in disponibilidade) {
          const dadosDoMes = disponibilidade[mes];
          for (const modalidade in dadosDoMes) {
            const dispo = dadosDoMes[modalidade];

            if (dispo && Array.isArray(dispo.dias) && dispo.dias.length > 0) {
              hasData = true;
              const diasOrdenados = [...dispo.dias].sort();
              const diasFormatados = diasOrdenados
                .map((dia) => {
                  const [, month, day] = dia.split("-");
                  return `${day}/${month}`;
                })
                .join(", ");

              const row = `
                <tr>
                  <td>${assistenteNome || "N/A"}</td>
                  <td>${mes || "N/A"}</td>
                  <td class="text-capitalize">${modalidade || "N/A"}</td>
                  <td class="text-wrap" style="max-width: 300px;">${diasFormatados}</td>
                  <td>${dispo.inicio || "N/A"} - ${dispo.fim || "N/A"}</td>
                  <td>
                    <button class="btn btn-primary btn-sm config-btn" 
                        data-bs-toggle="modal" 
                        data-bs-target="#configurarAgendaModal"
                        data-assistente-id="${assistenteId}"
                        data-assistente-nome="${assistenteNome}"
                        data-mes="${mes}"
                        data-modalidade="${modalidade}"
                        data-dias='${JSON.stringify(diasOrdenados)}'>
                      <i class="fas fa-cog me-1"></i> Configurar
                    </button>
                  </td>
                </tr>`;
              tableBody.insertAdjacentHTML("beforeend", row);
            }
          }
        }
      }
    });

    if (hasData) {
      table.style.display = "table";
      document.querySelectorAll(".config-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
          const data = event.currentTarget.dataset;
          let dias = [];
          try {
            dias = JSON.parse(data.dias);
          } catch (e) {
            console.error("❌ Erro ao interpretar dias:", e);
            alert("Erro ao abrir configuração. Dias inválidos.");
            return;
          }
          abrirModalConfiguracao(
            data.assistenteId,
            data.assistenteNome,
            data.mes,
            data.modalidade,
            dias
          );
        });
      });
    } else {
      noDataMessage.style.display = "block";
    }
  } catch (error) {
    console.error("❌ Erro detalhado ao carregar disponibilidades:", error);
    noDataMessage.textContent =
      "Erro ao carregar dados. Verifique o console para mais detalhes.";
    noDataMessage.classList.replace("alert-info", "alert-danger");
    noDataMessage.style.display = "block";
  } finally {
    spinner.style.display = "none";
  }
}

function abrirModalConfiguracao(
  assistenteId,
  assistenteNome,
  mes,
  modalidade,
  dias
) {
  currentAgendaConfig = { assistenteId, mes, modalidade };
  const modalTitle = document.getElementById("configurarAgendaModalLabel");
  const modalContent = document.getElementById("agenda-config-content");

  modalTitle.textContent = `Configurar Agenda de ${assistenteNome} (${modalidade} - ${mes})`;
  let contentHTML = '<div class="row g-3">';
  dias.forEach((dia) => {
    const dataFormatada = new Date(dia + "T03:00:00").toLocaleDateString(
      "pt-BR",
      {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
      }
    );
    contentHTML += `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-title">${dataFormatada}</h6>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="tipo-${dia}" id="triagem-${dia}" value="triagem" checked>
              <label class="form-check-label" for="triagem-${dia}">Triagem</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="tipo-${dia}" id="reavaliacao-${dia}" value="reavaliacao">
              <label class="form-check-label" for="reavaliacao-${dia}">Reavaliação</label>
            </div>
          </div>
        </div>
      </div>`;
  });
  contentHTML += "</div>";
  modalContent.innerHTML = contentHTML;
}

async function salvarConfiguracaoAgenda() {
  const button = document.getElementById("saveConfigButton");
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

  const diasConfig = Array.from(
    document.querySelectorAll(
      '#agenda-config-content input[type="radio"]:checked'
    )
  ).map((input) => ({
    dia: input.name.replace("tipo-", ""),
    tipo: input.value,
  }));

  if (diasConfig.length === 0) {
    alert("Nenhum dia foi configurado.");
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-save me-2"></i>Salvar Configuração';
    return;
  }

  if (
    !currentAgendaConfig?.assistenteId ||
    !currentAgendaConfig?.mes ||
    !currentAgendaConfig?.modalidade
  ) {
    alert("Dados da configuração estão incompletos.");
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-save me-2"></i>Salvar Configuração';
    return;
  }

  const payload = { ...currentAgendaConfig, dias: diasConfig };
  console.log("📤 Payload enviado à função definirTipoAgenda:", payload);

  try {
    const definirTipoAgenda = httpsCallable(functions, "definirTipoAgenda");
    const result = await definirTipoAgenda(payload);

    console.log("✅ Resposta da função:", result.data);

    const modalEl = document.getElementById("configurarAgendaModal");
    const modalInstance = window.bootstrap?.Modal?.getInstance?.(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }

    alert(result.data.message);
  } catch (error) {
    console.error("❌ Erro ao definir tipo da agenda:", error);
    if (error.code && error.message) {
      alert(`Erro (${error.code}): ${error.message}`);
    } else {
      alert("Erro inesperado ao salvar a configuração.");
    }
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-save me-2"></i>Salvar Configuração';
  }
}
