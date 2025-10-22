// Arquivo: /modulos/administrativo/js/grade.js
// Versão: 3.0 (Integrado com as Configurações do Sistema)

import { db } from "../../../assets/js/firebase-init.js";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  getDoc, // Adicionado
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const gradeContent = document.getElementById("grade-content");
  if (!gradeContent) return;

  let listaProfissionais = [];
  const coresProfissionais = new Map();
  let dadosDasGrades = {};

  // --- INÍCIO DA ALTERAÇÃO ---
  let colunasPresencial = []; // Agora será carregado do Firestore
  // --- FIM DA ALTERAÇÃO ---

  const horarios = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
  ];
  const diasDaSemana = [
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];
  const diasDaSemanaNomes = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];

  // --- INÍCIO DA ALTERAÇÃO ---
  /**
   * Carrega as configurações do sistema, especificamente a lista de salas.
   */
  async function carregarConfiguracoesDaGrade() {
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists() && docSnap.data().listas?.salasPresenciais) {
        colunasPresencial = docSnap.data().listas.salasPresenciais;
        console.log("Salas presenciais carregadas:", colunasPresencial);
      } else {
        console.warn(
          "Lista de salas presenciais não encontrada nas configurações. Usando lista padrão."
        );
        // Lista padrão para evitar que a grade quebre se a configuração não existir
        colunasPresencial = [
          "Leila Tardivo",
          "Leonardo Abrahão",
          "Karina Okajima Fukumitsu",
          "Maria Júlia Kovacs",
          "Christian Dunker",
          "Maria Célia Malaquias (Grupo)",
        ];
      }
    } catch (error) {
      console.error("Erro ao carregar lista de salas:", error);
      colunasPresencial = []; // Define como vazio em caso de erro para indicar o problema.
    }
  }
  // --- FIM DA ALTERAÇÃO ---

  function generateColorFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
      let value = (hash >> (i * 8)) & 0xff;
      value = 100 + (value % 156);
      color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
  }

  function isColorDark(hexColor) {
    if (!hexColor) return false;
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  function aplicarCor(selectElement) {
    const nomeProfissional = selectElement.value;
    const cor = coresProfissionais.get(nomeProfissional);
    if (cor) {
      selectElement.style.backgroundColor = cor;
      selectElement.style.color = isColorDark(cor) ? "white" : "black";
    } else {
      selectElement.style.backgroundColor = "";
      selectElement.style.color = "";
    }
  }

  function createDropdownOptions() {
    return (
      '<option value=""></option>' +
      listaProfissionais
        .map(
          (prof) => `<option value="${prof.username}">${prof.username}</option>`
        )
        .join("")
    );
  }

  function renderGrade(tipo, dia) {
    if (!gradeContent) return;
    gradeContent.innerHTML = "";

    const weekTabsNav = document.createElement("div");
    weekTabsNav.className = "grade-day-tabs";
    diasDaSemanaNomes.forEach((nomeDia, index) => {
      const diaKey = diasDaSemana[index];
      weekTabsNav.innerHTML += `<button class="${
        dia === diaKey ? "active" : ""
      }" data-day="${diaKey}">${nomeDia}</button>`;
    });
    gradeContent.appendChild(weekTabsNav);

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-wrapper";
    const table = document.createElement("table");
    table.className = "grade-table";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    let headers = ["Período", "Horário"];
    headers = headers.concat(
      tipo === "online" ? Array(6).fill("Online") : colunasPresencial
    );
    thead.innerHTML = `<tr>${headers
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr>`;

    horarios.forEach((hora, index) => {
      const row = tbody.insertRow();
      let rowClass = "";
      if (index < 5) rowClass = "periodo-manha";
      else if (index < 11) rowClass = "periodo-tarde";
      else rowClass = "periodo-noite";
      row.className = rowClass;

      if (index === 0)
        row.insertCell().outerHTML = `<td data-label="Período" class="period-cell" rowspan="5">Manhã</td>`;
      if (index === 5)
        row.insertCell().outerHTML = `<td data-label="Período" class="period-cell" rowspan="6">Tarde</td>`;
      if (index === 11)
        row.insertCell().outerHTML = `<td data-label="Período" class="period-cell" rowspan="5">Noite</td>`;

      row.insertCell().outerHTML = `<td data-label="Horário" class="hour-cell">${hora}</td>`;

      const colunasParaIterar =
        tipo === "online" ? 6 : colunasPresencial.length;
      for (let i = 0; i < colunasParaIterar; i++) {
        const cell = row.insertCell();
        const headerLabel = tipo === "online" ? "Online" : colunasPresencial[i];
        cell.setAttribute("data-label", headerLabel);

        const dropdown = document.createElement("select");
        dropdown.innerHTML = createDropdownOptions();
        const horaFormatadaParaBusca = hora.replace(":", "-");
        const fullPath = `${tipo}.${dia}.${horaFormatadaParaBusca}.col${i}`;
        const savedValue = dadosDasGrades[fullPath] || "";
        dropdown.value = savedValue;
        aplicarCor(dropdown);
        cell.appendChild(dropdown);
      }
    });
    table.append(thead, tbody);
    tableWrapper.appendChild(table);
    gradeContent.appendChild(tableWrapper);
  }

  async function autoSaveChange(selectElement) {
    const row = selectElement.closest("tr");
    const horaCell = row.querySelector(".hour-cell");
    if (!horaCell) return;
    const hora = horaCell.textContent.replace(":", "-");
    const colIndex =
      selectElement.closest("td").cellIndex -
      (row.querySelector(".period-cell") ? 2 : 1);
    const newValue = selectElement.value;
    const mainTabsContainer = document.querySelector("#grade-main-tabs");
    if (!mainTabsContainer) return;
    const activeMainTab =
      mainTabsContainer.querySelector("button.active").dataset.tab;
    const activeDayTab = gradeContent.querySelector(
      ".grade-day-tabs button.active"
    ).dataset.day;
    const fieldPath = `${activeMainTab}.${activeDayTab}.${hora}.col${colIndex}`;

    selectElement.classList.add("is-saving");
    selectElement.classList.remove("is-saved", "is-error");
    try {
      const gradesDocRef = doc(db, "administrativo", "grades");
      await setDoc(gradesDocRef, { [fieldPath]: newValue }, { merge: true });

      selectElement.classList.remove("is-saving");
      selectElement.classList.add("is-saved");
      setTimeout(() => selectElement.classList.remove("is-saved"), 1500);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      selectElement.classList.remove("is-saving");
      selectElement.classList.add("is-error");
      setTimeout(() => selectElement.classList.remove("is-error"), 2000);
    }
  }

  function attachEventListeners() {
    const mainTabsContainer = document.querySelector("#grade-main-tabs");
    if (mainTabsContainer) {
      mainTabsContainer.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
          mainTabsContainer
            .querySelectorAll("button")
            .forEach((b) => b.classList.remove("active"));
          e.target.classList.add("active");
          renderGrade(e.target.dataset.tab, "segunda");
        }
      });
    }

    gradeContent.addEventListener("click", (e) => {
      if (
        e.target.tagName === "BUTTON" &&
        e.target.closest(".grade-day-tabs")
      ) {
        const mainTabsContainer = document.querySelector("#grade-main-tabs");
        if (!mainTabsContainer) return;
        const activeMainTab =
          mainTabsContainer.querySelector("button.active").dataset.tab;
        if (e.target.dataset.day) {
          gradeContent
            .querySelectorAll(".grade-day-tabs button")
            .forEach((b) => b.classList.remove("active"));
          e.target.classList.add("active");
          renderGrade(activeMainTab, e.target.dataset.day);
        }
      }
    });

    gradeContent.addEventListener("change", (e) => {
      if (e.target.tagName === "SELECT") {
        aplicarCor(e.target);
        autoSaveChange(e.target);
      }
    });

    gradeContent.addEventListener("keydown", (e) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        e.target.tagName === "SELECT"
      ) {
        e.preventDefault();
        if (e.target.value !== "") {
          e.target.value = "";
          e.target.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  async function start() {
    try {
      // --- INÍCIO DA ALTERAÇÃO ---
      // Carrega as configurações (lista de salas) antes de qualquer outra coisa
      await carregarConfiguracoesDaGrade();
      // --- FIM DA ALTERAÇÃO ---

      const q = query(
        collection(db, "usuarios"),
        where("fazAtendimento", "==", true),
        orderBy("nome")
      );
      const querySnapshot = await getDocs(q);
      listaProfissionais = querySnapshot.docs.map((doc) => doc.data());

      listaProfissionais.forEach((prof) => {
        const color = prof.cor || generateColorFromString(prof.username);
        coresProfissionais.set(prof.username, color);
      });

      const gradesDocRef = doc(db, "administrativo", "grades");
      onSnapshot(gradesDocRef, (doc) => {
        dadosDasGrades = doc.exists() ? doc.data() : {};

        const mainTabsContainer = document.querySelector("#grade-main-tabs");
        if (!mainTabsContainer) return;

        const activeMainTabEl =
          mainTabsContainer.querySelector("button.active");
        const activeDayTabEl = gradeContent.querySelector(
          ".grade-day-tabs button.active"
        );

        if (activeMainTabEl && activeDayTabEl) {
          const activeMainTab = activeMainTabEl.dataset.tab;
          const activeDayTab = activeDayTabEl.dataset.day;
          renderGrade(activeMainTab, activeDayTab);
        }
      });

      attachEventListeners();
      renderGrade("online", "segunda");
    } catch (error) {
      console.error("Erro ao inicializar a grade:", error);
      gradeContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados.</p>`;
    }
  }

  start();
}
