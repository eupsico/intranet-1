// Arquivo: /modulos/financeiro/js/relatorios.js
// Versão: 2.1 (Atualizado para Firebase v9)
// Descrição: Corrige população do filtro de inadimplentes e a lógica/layout do relatório de horas.

import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export function init(db) {
  if (!db) {
    console.error("Instância do Firestore (db) não encontrada.");
    return;
  }

  const viewContent = document.querySelector(".view-relatorios");
  if (!viewContent) return;

  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  let DB = { profissionais: [], cobranca: {}, repasses: {}, grades: {} };

  // --- Funções Utilitárias ---
  const sanitizeKey = (key) =>
    !key ? "" : key.replace(/\.|\$|\[|\]|#|\//g, "_");
  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob(["\uFEFF" + content], { type: mimeType });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const formatDate = (dateString) => {
    if (!dateString) return "---";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };
  const formatCurrency = (value) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  // ALTERAÇÃO: Busca os dados iniciais para popular os filtros
  async function fetchDataAndRenderLayout() {
    const [usuariosSnap] = await Promise.all([
      getDocs(collection(db, "usuarios")),
    ]);
    DB.profissionais = usuariosSnap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    renderLayout();
  }

  function renderLayout() {
    const currentYear = new Date().getFullYear();
    let years = [];
    for (let i = currentYear - 2; i <= currentYear + 5; i++) {
      years.push(i);
    }

    const profissionaisAtivos = DB.profissionais
      .filter((p) => p.nome && !p.primeiraFase)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    // Popula seletores de ano
    viewContent.querySelector("#backup-ano-selector").innerHTML = years
      .map(
        (y) =>
          `<option value="${y}" ${
            y === currentYear ? "selected" : ""
          }>${y}</option>`
      )
      .join("");

    // Popula seletores de mês
    viewContent.querySelector("#backup-mes-selector").innerHTML = meses
      .map(
        (m, i) =>
          `<option value="${i}">${
            m.charAt(0).toUpperCase() + m.slice(1)
          }</option>`
      )
      .join("");

    // Popula seletor de inadimplentes
    const debtorSelector = viewContent.querySelector(
      "#debtor-professional-selector"
    );
    debtorSelector.innerHTML = `<option value="todos">Todos os Profissionais</option>`;
    debtorSelector.innerHTML += profissionaisAtivos
      .map((p) => `<option value="${p.uid}">${p.nome}</option>`)
      .join("");

    // ALTERAÇÃO: Adiciona HTML e popula os filtros para o Relatório de Horas
    const hoursTab = viewContent.querySelector(
      "#RelatorioHoras .report-controls"
    );
    const hoursFilterHtml = `
            <div class="filter-box">
                <label>Selecionar Período:</label>
                <div class="selectors">
                    <select id="hours-mes-selector">${meses
                      .map(
                        (m, i) =>
                          `<option value="${i}" ${
                            i === new Date().getMonth() ? "selected" : ""
                          }>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`
                      )
                      .join("")}</select>
                    <select id="hours-ano-selector">${years
                      .map(
                        (y) =>
                          `<option value="${y}" ${
                            y === currentYear ? "selected" : ""
                          }>${y}</option>`
                      )
                      .join("")}</select>
                </div>
            </div>
        `;
    // Insere o filtro antes dos botões de ação
    hoursTab.insertAdjacentHTML("afterbegin", hoursFilterHtml);

    attachEventListeners();
  }

  function setupTabs() {
    const tabContainer = viewContent.querySelector(".tabs-container");
    tabContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-link")) {
        const tabId = e.target.dataset.tab;
        tabContainer
          .querySelectorAll(".tab-link")
          .forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");

        viewContent
          .querySelectorAll(".tab-content")
          .forEach((content) => (content.style.display = "none"));
        viewContent.querySelector(`#${tabId}`).style.display = "block";
      }
    });
  }

  function attachEventListeners() {
    document
      .getElementById("btn-debtors-csv")
      .addEventListener("click", () => generateDebtorsReport("csv"));
    document
      .getElementById("btn-debtors-pdf")
      .addEventListener("click", () => generateDebtorsReport("pdf"));
    document
      .getElementById("btn-hours-csv")
      .addEventListener("click", () => generateHoursReport("csv"));
    document
      .getElementById("btn-hours-pdf")
      .addEventListener("click", () => generateHoursReport("pdf"));
    document
      .getElementById("btn-backup-pdf")
      .addEventListener("click", generateMonthlyBackup);
  }

  async function getLatestData() {
    const [usuariosSnap, configSnap, gradesSnap] = await Promise.all([
      getDocs(collection(db, "usuarios")),
      getDoc(doc(db, "financeiro", "configuracoes")),
      getDoc(doc(db, "administrativo", "grades")), // Busca a grade de horários
    ]);
    const configData = configSnap.exists() ? configSnap.data() : {};
    return {
      profissionais: usuariosSnap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })),
      cobranca: configData.cobranca || {},
      repasses: configData.repasses || {},
      grades: gradesSnap.exists() ? gradesSnap.data() : {},
    };
  }

  async function generateDebtorsReport(format) {
    window.showToast("Gerando relatório de inadimplentes...", "info");
    const DB = await getLatestData();
    const selectedProfId = document.getElementById(
      "debtor-professional-selector"
    ).value;
    const selectedProfessional = DB.profissionais.find(
      (p) => p.uid === selectedProfId
    );

    const debtors = [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();

    let profissionaisAChecar =
      selectedProfId === "todos"
        ? DB.profissionais.filter((p) => p.nome && !p.primeiraFase)
        : [selectedProfessional];

    profissionaisAChecar.forEach((prof) => {
      let totalDebt = 0;
      let pendingMonths = [];
      for (const year in DB.cobranca) {
        if (parseInt(year) > currentYear) continue;

        const profId = prof.uid;
        const profKey_antigo = sanitizeKey(prof.nome);

        if (
          DB.cobranca[year] &&
          (DB.cobranca[year][profId] || DB.cobranca[year][profKey_antigo])
        ) {
          const cobrancasDoProf =
            DB.cobranca[year][profId] || DB.cobranca[year][profKey_antigo];
          for (const month in cobrancasDoProf) {
            const monthIndex = meses.indexOf(month);
            if (
              parseInt(year) === currentYear &&
              monthIndex > currentMonthIndex
            )
              continue;

            const cobranca = cobrancasDoProf[month] || 0;
            const repasse =
              DB.repasses[year]?.[month]?.[profId] ||
              DB.repasses[year]?.[month]?.[profKey_antigo];

            if (cobranca > 0 && !repasse) {
              totalDebt += cobranca;
              pendingMonths.push(
                `${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`
              );
            }
          }
        }
      }
      if (totalDebt > 0) {
        debtors.push({
          nome: prof.nome,
          contato: prof.contato || "N/A",
          valor: totalDebt,
          meses: pendingMonths.join(", "),
        });
      }
    });

    const data = debtors.sort((a, b) => b.valor - a.valor);

    if (data.length === 0) {
      window.showToast("Nenhum inadimplente encontrado.", "info");
      return;
    }

    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    let fileNameBase =
      selectedProfId === "todos"
        ? "relatorio_inadimplentes"
        : `inadimplencia_${selectedProfessional.nome.replace(/\s/g, "_")}`;

    if (format === "csv") {
      let csvContent =
        "Profissional;Contato;Valor Devido (R$);Meses Pendentes\n";
      data.forEach((d) => {
        csvContent += `"${d.nome}";"${d.contato}";"${d.valor
          .toFixed(2)
          .replace(".", ",")}";"${d.meses}"\n`;
      });
      downloadFile(
        csvContent,
        `${fileNameBase}_${dateStr}.csv`,
        "text/csv;charset=utf-8;"
      );
    } else if (format === "pdf") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(
        selectedProfId === "todos"
          ? "Relatório de Inadimplentes"
          : `Inadimplência: ${selectedProfessional.nome}`,
        14,
        22
      );
      const head = [
        ["Profissional", "Contato", "Valor Devido (R$)", "Meses Pendentes"],
      ];
      const body = data.map((d) => [
        d.nome,
        d.contato,
        d.valor.toFixed(2),
        d.meses,
      ]);
      doc.autoTable({ head, body, startY: 35 });
      doc.save(`${fileNameBase}_${dateStr}.pdf`);
    }
  }

  async function generateHoursReport(format) {
    window.showToast("Gerando relatório de horas...", "info");
    const DB = await getLatestData();
    const profissionaisAtivos = DB.profissionais.filter(
      (p) => p.nome && !p.primeiraFase && p.fazAtendimento === true
    );
    let hoursData = [];

    // ALTERAÇÃO: Lógica de busca de horas corrigida para iterar corretamente na grade
    profissionaisAtivos.forEach((prof) => {
      let horasOnline = 0,
        horasPresencial = 0;
      if (prof.username) {
        for (const key in DB.grades) {
          if (DB.grades[key] === prof.username) {
            if (key.startsWith("online.")) horasOnline++;
            else if (key.startsWith("presencial.")) horasPresencial++;
          }
        }
      }
      if (horasOnline > 0 || horasPresencial > 0) {
        hoursData.push({
          nome: prof.nome,
          online: horasOnline,
          presencial: horasPresencial,
          total: horasOnline + horasPresencial,
        });
      }
    });

    if (hoursData.length === 0) {
      window.showToast("Nenhum profissional com horas na grade atual.", "info");
      return;
    }
    hoursData.sort((a, b) => b.total - a.total);

    const mesNome = meses[document.getElementById("hours-mes-selector").value];
    const ano = document.getElementById("hours-ano-selector").value;
    const fileNameBase = `relatorio_horas_${mesNome}_${ano}`;

    if (format === "csv") {
      let csvContent =
        "Profissional;Horas Online;Horas Presencial;Total de Horas\n";
      hoursData.forEach((d) => {
        csvContent += `"${d.nome}";${d.online};${d.presencial};${d.total}\n`;
      });
      downloadFile(
        csvContent,
        `${fileNameBase}.csv`,
        "text/csv;charset=utf-8;"
      );
    } else if (format === "pdf") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(
        `Relatório de Horas - ${
          mesNome.charAt(0).toUpperCase() + mesNome.slice(1)
        }/${ano}`,
        14,
        22
      );
      const head = [
        ["Profissional", "Horas Online", "Horas Presencial", "Total"],
      ];
      const body = hoursData.map((d) => [
        d.nome,
        d.online,
        d.presencial,
        d.total,
      ]);
      doc.autoTable({ head, body, startY: 35 });
      doc.save(`${fileNameBase}.pdf`);
    }
  }

  async function generateMonthlyBackup() {
    window.showToast("Gerando backup mensal...", "info");
    const DB = await getLatestData();
    const mesIndex = document.getElementById("backup-mes-selector").value;
    const ano = document.getElementById("backup-ano-selector").value;
    const mes = meses[mesIndex].toLowerCase();
    const profissionaisAtivos = DB.profissionais.filter(
      (p) => p.nome && !p.primeiraFase
    );
    let backupData = [];
    let totalCobrado = 0,
      totalRecebido = 0;

    profissionaisAtivos.forEach((prof) => {
      const profId = prof.uid;
      const profKey_antigo = sanitizeKey(prof.nome);
      const valorCobrado =
        DB.cobranca[ano]?.[profId]?.[mes] ||
        DB.cobranca[ano]?.[profKey_antigo]?.[mes] ||
        0;

      if (valorCobrado > 0) {
        const dataPagamento =
          DB.repasses[ano]?.[mes]?.[profId] ||
          DB.repasses[ano]?.[mes]?.[profKey_antigo] ||
          "Pendente";
        let status = dataPagamento !== "Pendente" ? "Pago" : "Pendente";
        if (status === "Pago") totalRecebido += valorCobrado;
        backupData.push({
          nome: prof.nome,
          valor: valorCobrado,
          status: status,
          dataPg:
            dataPagamento === "Pendente" ? "---" : formatDate(dataPagamento),
        });
        totalCobrado += valorCobrado;
      }
    });

    if (backupData.length === 0) {
      window.showToast(`Nenhum dado para o backup de ${mes}/${ano}.`, "info");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Backup Financeiro - ${meses[mesIndex]}/${ano}`, 14, 22);
    const head = [["Profissional", "Valor Cobrado", "Status", "Data Pag."]];
    const body = backupData.map((d) => [
      d.nome,
      formatCurrency(d.valor),
      d.status,
      d.dataPg,
    ]);
    doc.autoTable({ head, body, startY: 35 });
    const finalY = doc.autoTable.previous.finalY;
    doc.autoTable({
      startY: finalY + 10,
      theme: "plain",
      body: [
        ["Total Cobrado:", formatCurrency(totalCobrado)],
        ["Total Recebido:", formatCurrency(totalRecebido)],
        ["Balanço (Pendente):", formatCurrency(totalCobrado - totalRecebido)],
      ],
    });
    doc.save(`backup_${mes}_${ano}.pdf`);
  }

  // --- Ponto de Partida ---
  setupTabs();
  fetchDataAndRenderLayout();
}
