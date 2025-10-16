// Arquivo: /modulos/voluntario/js/grade-view.js
// Versão: 3.1 (Corrigido o loop de renderização)

import {
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

// --- FUNÇÕES AUXILIARES GLOBAIS (sem alteração) ---
function generateColorFromString(str) {
  if (!str || str.length === 0) return "#ff0055";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xff;
    value = 160 + (value % 96);
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
}

function isColorDark(hexColor) {
  if (!hexColor || hexColor.length !== 7) return false;
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return brightness < 0.6;
}

// --- FUNÇÃO DE INICIALIZAÇÃO DO MÓDULO ---
export function init(user, userData, tipoGrade) {
  const containerId = `grade-${tipoGrade}`;
  const gradeContent = document.getElementById(containerId);
  if (!gradeContent) return;

  const coresProfissionais = new Map();
  let dadosDasGrades = {};

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
  const diasDaSemana = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
  };
  const colunasPresencial = [
    "Leila Tardivo",
    "Leonardo Abrahão",
    "Karina Okajima Fukumitsu",
    "Maria Júlia Kovacs",
    "Christian Dunker",
    "Maria Célia Malaquias (Grupo)",
  ];

  /**
   * Apenas renderiza a grade na tela com base nos dados atuais.
   */
  function renderGrade(dia) {
    let headers = ["Período", "HORAS"];
    headers = headers.concat(
      tipoGrade === "online" ? Array(6).fill("Online") : colunasPresencial
    );

    const tableBodyHtml = horarios
      .map((hora, index) => {
        const horaFormatada = hora.replace(":", "-");
        let periodoCell = "";

        if (index === 0)
          periodoCell = `<td data-label="Período" class="period-cell" rowspan="5">Manhã</td>`;
        if (index === 5)
          periodoCell = `<td data-label="Período" class="period-cell" rowspan="6">Tarde</td>`;
        if (index === 11)
          periodoCell = `<td data-label="Período" class="period-cell" rowspan="5">Noite</td>`;

        const celulasProfissionais = headers
          .slice(2)
          .map((headerLabel, colIndex) => {
            const path = `${tipoGrade}.${dia}.${horaFormatada}.col${colIndex}`;
            const nomeNaGrade = dadosDasGrades[path] || "";

            const isEmpty = !nomeNaGrade;
            const cellClass = isEmpty ? "cell-empty" : "";

            const cor =
              coresProfissionais.get(nomeNaGrade) ||
              generateColorFromString(nomeNaGrade);
            const textColor = isColorDark(cor) ? "#FFFFFF" : "#333333";
            const estilo = !isEmpty
              ? `background-color: ${cor}; color: ${textColor};`
              : "";
            const isCurrentUser =
              !isEmpty &&
              (nomeNaGrade === userData.username ||
                nomeNaGrade === userData.nome);

            return `<td data-label="${headerLabel}" class="${cellClass}"><div class="professional-cell ${
              isCurrentUser ? "user-highlight" : ""
            }" style="${estilo}">${nomeNaGrade}</div></td>`;
          })
          .join("");

        let rowClass = "";
        if (index < 5) rowClass = "periodo-manha";
        else if (index < 11) rowClass = "periodo-tarde";
        else rowClass = "periodo-noite";

        const horaSimples = hora.replace(":00", "h");
        return `<tr class="${rowClass}">${periodoCell}<td class="hour-cell" data-label="HORAS">${horaSimples}</td>${celulasProfissionais}</tr>`;
      })
      .join("");

    gradeContent.innerHTML = `
            <div class="grade-day-tabs-wrapper">
                ${Object.entries(diasDaSemana)
                  .map(
                    ([key, nome]) =>
                      `<button class="${
                        dia === key ? "active" : ""
                      }" data-day="${key}">${nome}</button>`
                  )
                  .join("")}
            </div>
            <div class="table-wrapper">
                <table class="grade-table grade-${tipoGrade}">
                    <thead><tr>${headers
                      .map((h) => `<th>${h}</th>`)
                      .join("")}</tr></thead>
                    <tbody>${tableBodyHtml}</tbody>
                </table>
            </div>`;
  }

  /**
   * Anexa os event listeners ao container uma única vez.
   */
  function attachEventListeners() {
    gradeContent.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" && e.target.dataset.day) {
        // Ao clicar em um dia, apenas renderiza a grade para aquele dia com os dados já carregados
        renderGrade(e.target.dataset.day);
      }
    });
  }

  /**
   * Inicia o carregamento dos dados e o listener em tempo real.
   */
  async function start() {
    try {
      gradeContent.innerHTML = '<div class="loading-spinner"></div>';

      // Busca as cores dos profissionais
      const usuariosQuery = query(
        collection(db, "usuarios"),
        where("fazAtendimento", "==", true)
      );
      const usuariosSnapshot = await getDocs(usuariosQuery);

      usuariosSnapshot.forEach((doc) => {
        const prof = doc.data();
        const cor = prof.cor || generateColorFromString(prof.username);
        if (prof.username) coresProfissionais.set(prof.username, cor);
        if (prof.nome) coresProfissionais.set(prof.nome, cor);
      });

      // Inicia o listener em tempo real para a grade
      const gradesDocRef = doc(db, "administrativo", "grades");

      onSnapshot(
        gradesDocRef,
        (doc) => {
          dadosDasGrades = doc.exists() ? doc.data() : {};

          // Verifica qual dia está ativo ou usa 'segunda' como padrão
          const activeDayTabEl = gradeContent.querySelector(
            ".grade-day-tabs-wrapper button.active"
          );
          const currentDia = activeDayTabEl
            ? activeDayTabEl.dataset.day
            : "segunda";

          // Re-renderiza a grade com os dados atualizados
          renderGrade(currentDia);
        },
        (error) => {
          console.error("Erro ao escutar atualizações da grade:", error);
          gradeContent.innerHTML = `<p class="alert alert-error">Erro de conexão em tempo real com a grade.</p>`;
        }
      );
    } catch (error) {
      console.error(`Erro fatal ao inicializar a grade ${tipoGrade}:`, error);
      gradeContent.innerHTML = `<p class="alert alert-error">Não foi possível carregar a grade. Tente recarregar a página.</p>`;
    }
  }

  // Ponto de entrada da lógica
  attachEventListeners(); // Configura os cliques primeiro
  start(); // Inicia o carregamento dos dados
}
