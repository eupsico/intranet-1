// Arquivo: /modulos/financeiro/js/cobranca_mensal.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const appContent = document.getElementById("cobranca-mensal-content");
  if (!appContent) return;

  let DB = {
    profissionais: [],
    grades: {},
    valores: {},
    cobranca: {},
    Mensagens: {},
  };
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
  let cacheResumoCalculado = [];

  function sanitizeKey(key) {
    if (!key) return "";
    return key.replace(/\.|\$|\[|\]|#|\//g, "_");
  }

  async function fetchData() {
    appContent.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const [usuariosSnapshot, gradesSnapshot, configSnapshot] =
        await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDoc(doc(db, "administrativo", "grades")),
          getDoc(doc(db, "financeiro", "configuracoes")),
        ]);

      DB.profissionais = usuariosSnapshot.docs.map((doc) => doc.data());
      DB.grades = gradesSnapshot.exists() ? gradesSnapshot.data() : {};
      const configData = configSnapshot.exists() ? configSnapshot.data() : {};
      DB.valores = configData.valores || {};
      DB.cobranca = configData.cobranca || {};
      DB.Mensagens = configData.Mensagens || {};
      const d = new Date();
      renderCobranca(d.getFullYear(), d.getMonth());
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados do Firestore.</p>`;
    }
  }

  function renderCobranca(ano, mesIndex) {
    const mes = meses[mesIndex];
    const date = new Date();
    const currentYear = date.getFullYear();
    const currentMonthIndex = date.getMonth();
    const isCurrentMonthView =
      ano === currentYear && mesIndex === currentMonthIndex;
    let years = [];
    for (let i = currentYear - 1; i <= currentYear + 5; i++) {
      years.push(i);
    }

    let selectorHtml = `
            <div class="filter-box">
                <h4>Selecionar Período:</h4>
                <div class="selectors">
                    <select id="cobranca-mes-selector">${meses
                      .map(
                        (m, i) =>
                          `<option value="${i}" ${
                            i === mesIndex ? "selected" : ""
                          }>${m.charAt(0).toUpperCase() + m.slice(1)}</option>`
                      )
                      .join("")}</select>
                    <select id="cobranca-ano-selector">${years
                      .map(
                        (y) =>
                          `<option value="${y}" ${
                            y === ano ? "selected" : ""
                          }>${y}</option>`
                      )
                      .join("")}</select>
                </div>
            </div>
        `;

    let topButtonHtml = isCurrentMonthView
      ? `<div class="controls-section" style="padding-top:0;"><button class="action-button save-btn" id="save-month-btn">Salvar Lançamentos Calculados para este Mês</button></div>`
      : "";

    let resumoDoMes = [];
    DB.profissionais.forEach((prof) => {
      if (
        !prof.username ||
        prof.inativo ||
        prof.primeiraFase === true ||
        prof.fazAtendimento !== true
      ) {
        return;
      }
      let horasOnline = 0,
        horasPresencial = 0;
      for (const key in DB.grades) {
        if (DB.grades[key] === prof.username) {
          if (key.startsWith("online.")) horasOnline++;
          else if (key.startsWith("presencial.")) horasPresencial++;
        }
      }
      const totalDivida =
        horasOnline * (DB.valores.online || 0) +
        horasPresencial * (DB.valores.presencial || 0);
      resumoDoMes.push({
        nome: prof.nome,
        uid: prof.uid,
        totalDivida: totalDivida,
      });
    });
    resumoDoMes.sort((a, b) => a.nome.localeCompare(b.nome));
    cacheResumoCalculado = resumoDoMes;

    let tableHtml = `<div class="table-section"><table id="cobranca-table"><thead><tr>
            <th>Profissional</th><th>Valor Mês Passado (R$)</th><th>Valor do Mês (R$)</th><th>Ações</th><th>WhatsApp</th>
            </tr></thead><tbody>`;

    resumoDoMes.forEach((resumo) => {
      const profId = resumo.uid;
      const nomeKey_antigo = sanitizeKey(resumo.nome);
      let anoPassado = ano;
      let mesPassadoIndex = mesIndex - 1;
      if (mesPassadoIndex < 0) {
        mesPassadoIndex = 11;
        anoPassado--;
      }
      const mesPassado = meses[mesPassadoIndex];
      let valorMesPassado = DB.cobranca[anoPassado]?.[profId]?.[mesPassado];
      if (valorMesPassado === undefined) {
        valorMesPassado =
          DB.cobranca[anoPassado]?.[nomeKey_antigo]?.[mesPassado] || 0;
      }
      let valorParaExibir = DB.cobranca[ano]?.[profId]?.[mes];
      if (valorParaExibir === undefined) {
        valorParaExibir = DB.cobranca[ano]?.[nomeKey_antigo]?.[mes];
      }
      if (valorParaExibir === undefined && isCurrentMonthView) {
        valorParaExibir = resumo.totalDivida;
      }
      valorParaExibir = valorParaExibir || 0;
      tableHtml += `<tr data-prof-id="${profId}" data-valor-original="${valorParaExibir.toFixed(
        2
      )}">
                <td>${resumo.nome}</td>
                <td>R$ ${valorMesPassado.toFixed(2).replace(".", ",")}</td>
                <td>R$ ${valorParaExibir.toFixed(2).replace(".", ",")}</td>
                <td><button class="action-button edit-btn row-edit-btn">Editar</button></td>
                <td><a href="#" class="action-button whatsapp-btn" data-nome="${
                  resumo.nome
                }" data-valor="${valorParaExibir.toFixed(2)}">Enviar</a></td>
            </tr>`;
    });

    appContent.innerHTML =
      selectorHtml + topButtonHtml + tableHtml + `</tbody></table></div>`;

    attachEventListeners();
  }

  function attachEventListeners() {
    const saveMonthBtn = document.getElementById("save-month-btn");
    if (saveMonthBtn) {
      saveMonthBtn.addEventListener("click", handleSaveMonth);
    }

    const table = document.getElementById("cobranca-table");
    if (table) {
      table.addEventListener("click", handleTableClick);
    }

    const mesSelector = document.getElementById("cobranca-mes-selector");
    const anoSelector = document.getElementById("cobranca-ano-selector");
    if (mesSelector) mesSelector.addEventListener("change", handlePeriodChange);
    if (anoSelector) anoSelector.addEventListener("change", handlePeriodChange);
  }

  function handlePeriodChange() {
    const ano = parseInt(
      document.getElementById("cobranca-ano-selector").value
    );
    const mesIndex = parseInt(
      document.getElementById("cobranca-mes-selector").value
    );
    renderCobranca(ano, mesIndex);
  }

  async function handleSaveMonth(e) {
    const target = e.target;
    if (
      !confirm(
        "Tem certeza que deseja salvar todos os valores calculados para o mês atual? Isso irá sobrescrever quaisquer valores editados manualmente para este mês."
      )
    ) {
      return;
    }
    target.disabled = true;
    target.textContent = "Salvando...";
    const ano = new Date().getFullYear();
    const mes = meses[new Date().getMonth()];
    const updates = {};
    cacheResumoCalculado.forEach((resumo) => {
      const profId = resumo.uid;
      if (profId) {
        const path = `cobranca.${ano}.${profId}.${mes}`;
        updates[path] = resumo.totalDivida;
      }
    });
    try {
      const configRef = doc(db, "financeiro", "configuracoes");
      await updateDoc(configRef, updates);
      window.showToast(
        "Todos os lançamentos do mês foram salvos com sucesso!",
        "success"
      );
      await fetchData();
    } catch (err) {
      console.error("Erro ao salvar lançamentos do mês:", err);
      window.showToast("Ocorreu um erro ao salvar os lançamentos.", "error");
      target.disabled = false;
      target.textContent = "Salvar Lançamentos Calculados para este Mês";
    }
  }

  async function handleTableClick(e) {
    const target = e.target;
    const ano = parseInt(
      document.getElementById("cobranca-ano-selector").value
    );
    const mesIndex = parseInt(
      document.getElementById("cobranca-mes-selector").value
    );

    if (target.classList.contains("row-edit-btn")) {
      e.preventDefault();
      const row = target.closest("tr");
      const valorOriginal = parseFloat(row.dataset.valorOriginal);
      const valorCell = row.cells[2];
      const acoesCell = row.cells[3];
      valorCell.innerHTML = `<input type="number" class="edit-valor-input" step="0.01" value="${valorOriginal.toFixed(
        2
      )}">`;
      acoesCell.innerHTML = `
                <div class="action-buttons-cell">
                    <button class="action-button save-btn row-save-btn">Salvar</button>
                    <button class="action-button cancel-btn row-cancel-btn">Cancelar</button>
                </div>
            `;
    } else if (target.classList.contains("row-cancel-btn")) {
      e.preventDefault();
      renderCobranca(ano, mesIndex);
    } else if (target.classList.contains("row-save-btn")) {
      e.preventDefault();
      target.disabled = true;
      target.textContent = "Salvando...";
      const row = target.closest("tr");
      const profId = row.dataset.profId;
      const input = row.querySelector(".edit-valor-input");
      const novoValor = parseFloat(input.value);
      const mes = meses[mesIndex];
      if (isNaN(novoValor) || !profId) {
        window.showToast(
          "Valor inválido ou ID do profissional não encontrado.",
          "error"
        );
        renderCobranca(ano, mesIndex);
        return;
      }
      const path = `cobranca.${ano}.${profId}.${mes}`;
      try {
        const configRef = doc(db, "financeiro", "configuracoes");
        await updateDoc(configRef, { [path]: novoValor });
        if (!DB.cobranca[ano]) DB.cobranca[ano] = {};
        if (!DB.cobranca[ano][profId]) DB.cobranca[ano][profId] = {};
        DB.cobranca[ano][profId][mes] = novoValor;
        window.showToast(`Valor salvo com sucesso!`, "success");
      } catch (err) {
        console.error("Erro ao salvar:", err);
        window.showToast("Ocorreu um erro ao salvar.", "error");
      } finally {
        renderCobranca(ano, mesIndex);
      }
    } else if (target.classList.contains("whatsapp-btn")) {
      e.preventDefault();
      const nome = target.dataset.nome;
      const profInfo = DB.profissionais.find((p) => p.nome === nome);
      const contato = profInfo
        ? (profInfo.contato || "").replace(/\D/g, "")
        : "";
      if (!contato) {
        alert(`Contato para ${nome} não encontrado.`);
        return;
      }
      const template =
        DB.Mensagens.cobranca ||
        "Olá, {nomeProfissional}! Lembrete do repasse de R$ {valor} referente ao mês de {mes}.";
      const mes = meses[document.getElementById("cobranca-mes-selector").value];
      let message = template
        .replace("{nomeProfissional}", nome)
        .replace("{valor}", target.dataset.valor)
        .replace(
          "{mes}",
          `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}`
        );
      window.open(
        `https://wa.me/55${contato}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    }
  }

  fetchData();
}
