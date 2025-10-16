// Arquivo: /modulos/voluntario/js/view-dashboard-voluntario.js
// Versão: 2.2 (Corrigido erro de permissão do Firestore, sem exclusão de código)

import {
  db,
  doc,
  getDoc,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

export function init(db, user, userData) {
  const summaryContainer = document.getElementById("summary-panel-container");
  const infoCardContainer = document.getElementById("info-card-container");

  if (!summaryContainer || !infoCardContainer) {
    console.error("Elementos do container do dashboard não encontrados.");
    return;
  }

  let dadosDasGrades = {};
  let valoresConfig = {};
  const diasDaSemana = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
  };
  const userRoles = userData.funcoes || [];
  const hasFinanceAccess =
    userRoles.includes("admin") || userRoles.includes("financeiro");

  async function fetchValoresConfig() {
    if (!hasFinanceAccess) {
      console.log(
        "Usuário sem permissão para acessar dados financeiros. Pulando cálculo de valores."
      );
      valoresConfig = { online: 0, presencial: 0 };
      return;
    }

    try {
      const docRef = doc(db, "financeiro", "configuracoes");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        valoresConfig = data.valores || { online: 0, presencial: 0 };
      } else {
        console.error("Documento 'financeiro/configuracoes' não encontrado!");
        valoresConfig = { online: 0, presencial: 0 };
      }
    } catch (error) {
      console.error("Erro ao buscar configurações de valores:", error);
      valoresConfig = { online: 0, presencial: 0 };
    }
  }

  function renderSummaryPanel() {
    if (!userData || !userData.username) {
      summaryContainer.innerHTML =
        '<p class="info-card">Não foi possível identificar o usuário para exibir o resumo.</p>';
      return;
    }

    const { username: userUsername, name: userFullName } = userData;
    let horasOnline = 0;
    let horasPresencial = 0;
    const agendamentosOnline = [];
    const agendamentosPresencial = [];

    for (const path in dadosDasGrades) {
      const nomeNaGrade = dadosDasGrades[path];
      if (nomeNaGrade === userUsername || nomeNaGrade === userFullName) {
        const parts = path.split(".");
        if (parts.length === 4) {
          const [tipo, diaKey, horaRaw] = parts;
          const horaFormatada = horaRaw.replace("-", ":");
          const diaNome = diasDaSemana[diaKey];
          const horarioCompleto = `<li>${diaNome} - ${horaFormatada}</li>`;

          if (tipo === "online") {
            horasOnline++;
            agendamentosOnline.push(horarioCompleto);
          } else if (tipo === "presencial") {
            horasPresencial++;
            agendamentosPresencial.push(horarioCompleto);
          }
        }
      }
    }

    const totalHoras = horasOnline + horasPresencial;

    let financeiroHtml = "";
    if (hasFinanceAccess) {
      const valorOnline = valoresConfig.online || 0;
      const valorPresencial = valoresConfig.presencial || 0;
      const valorTotalAPagar =
        horasOnline * valorOnline + horasPresencial * valorPresencial;
      const valorFormatado = valorTotalAPagar.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      financeiroHtml = `
                <div class="summary-card">
                    <h4>💰 Resumo Financeiro</h4>
                    <ul>
                        <li>
                            <span class="financeiro-horas">Total de horas: <strong>${totalHoras}</strong></span>
                            <span class="financeiro-valor">Valor total a pagar: ${valorFormatado}</span>
                            <small>O pagamento deve ser realizado até o dia 10.</small>
                        </li>
                    </ul>
                </div>`;
    } else {
      financeiroHtml = `
                <div class="summary-card">
                    <h4>⏱️ Horas na Grade</h4>
                     <ul>
                        <li>
                            <span class="financeiro-horas">Total de horas semanais: <strong>${totalHoras}</strong></span>
                        </li>
                    </ul>
                </div>`;
    }

    summaryContainer.innerHTML = `
            <div class="summary-panel">
                <h3>Meu Resumo Semanal</h3>
                <div id="summary-details-container">
                    ${financeiroHtml}
                    <div class="summary-card">
                        <h4>🖥️ Grade Online (${horasOnline})</h4>
                        <ul>${
                          agendamentosOnline.length > 0
                            ? agendamentosOnline.join("")
                            : "<li>Nenhum horário online.</li>"
                        }</ul>
                    </div>
                    <div class="summary-card">
                        <h4>🏢 Grade Presencial (${horasPresencial})</h4>
                        <ul>${
                          agendamentosPresencial.length > 0
                            ? agendamentosPresencial.join("")
                            : "<li>Nenhum horário presencial.</li>"
                        }</ul>
                    </div>
                </div>
            </div>`;
  }

  function renderInfoCard() {
    infoCardContainer.innerHTML = `
            <div class="info-card-grid">
                <div class="info-card">
                    <h3>📢 Avisos Gerais</h3>
                    <ul>
                        <li>Nenhum aviso no momento.</li>
                    </ul>
                </div>
            </div>`;
  }

  async function start() {
    summaryContainer.innerHTML = '<div class="loading-spinner"></div>';
    renderInfoCard();
    await fetchValoresConfig();

    const gradesDocRef = doc(db, "administrativo", "grades");
    onSnapshot(
      gradesDocRef,
      (docSnap) => {
        dadosDasGrades = docSnap.exists() ? docSnap.data() : {};
        renderSummaryPanel();
      },
      (error) => {
        console.error("Erro ao escutar atualizações da grade:", error);
        summaryContainer.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Não foi possível carregar o resumo semanal.</div>`;
      }
    );
  }

  start().catch(console.error);
}
