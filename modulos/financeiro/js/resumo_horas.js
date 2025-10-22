// Arquivo: /modulos/financeiro/js/resumo_horas.js
// Versão: 2.3 (Atualizado para Firebase v9)
// Descrição: Refatoração de layout aplicada via CSS. Nenhuma alteração de lógica.

import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export function init(db) {
  if (!db) {
    console.error("Instância do Firestore (db) não encontrada.");
    return;
  }

  const contentArea = document.getElementById("content-area");
  if (!contentArea) return;

  const appContent = contentArea.querySelector("#resumo-horas-content");
  const professionalSelector = contentArea.querySelector(
    "#resumo-horas-profissional-selector"
  );

  if (!appContent || !professionalSelector) {
    console.warn(
      "Elementos para 'resumo_horas' não encontrados no DOM após carregamento."
    );
    return;
  }

  let allProfessionals = [];
  let allGrades = {};
  let allValues = {};

  function renderTable(selectedProfName = "todos") {
    let professionalsToRender =
      selectedProfName === "todos"
        ? allProfessionals
        : allProfessionals.filter((p) => p.nome === selectedProfName);

    let resumoCalculado = [];

    professionalsToRender.forEach((prof) => {
      if (!prof.username || prof.inativo || prof.primeiraFase === true) {
        return;
      }

      let horasOnline = 0;
      let horasPresencial = 0;

      for (const key in allGrades) {
        const profissionalNaGrade = allGrades[key];
        if (profissionalNaGrade === prof.username) {
          if (key.startsWith("online.")) {
            horasOnline++;
          } else if (key.startsWith("presencial.")) {
            horasPresencial++;
          }
        }
      }

      const dividaOnline = horasOnline * (allValues.online || 0);
      const dividaPresencial = horasPresencial * (allValues.presencial || 0);

      resumoCalculado.push({
        nome: prof.nome,
        totalDivida: dividaOnline + dividaPresencial,
        horasOnline,
        horasPresencial,
        dividaOnline,
        dividaPresencial,
        totalHoras: horasOnline + horasPresencial,
      });
    });

    let tableHtml = `
            <div class="table-section">
                <table>
                    <thead>
                        <tr>
                            <th>Profissional</th>
                            <th>Horas Presencial</th>
                            <th>Horas Online</th>
                            <th>Total Horas</th>
                            <th>Dívida Presencial (R$)</th>
                            <th>Dívida Online (R$)</th>
                            <th>Total Dívida (R$)</th>
                        </tr>
                    </thead>
                    <tbody>`;

    if (resumoCalculado.length === 0) {
      tableHtml += `<tr><td colspan="7">Nenhum profissional encontrado para o filtro selecionado.</td></tr>`;
    } else {
      resumoCalculado.forEach((resumo) => {
        tableHtml += `
                    <tr>
                        <td>${resumo.nome}</td>
                        <td>${resumo.horasPresencial}</td>
                        <td>${resumo.horasOnline}</td>
                        <td><strong>${resumo.totalHoras}</strong></td>
                        <td>R$ ${resumo.dividaPresencial
                          .toFixed(2)
                          .replace(".", ",")}</td>
                        <td>R$ ${resumo.dividaOnline
                          .toFixed(2)
                          .replace(".", ",")}</td>
                        <td><strong>R$ ${resumo.totalDivida
                          .toFixed(2)
                          .replace(".", ",")}</strong></td>
                    </tr>`;
      });
    }

    appContent.innerHTML = tableHtml + `</tbody></table></div>`;
  }

  async function fetchAndSetup() {
    if (!appContent || !professionalSelector) return;
    appContent.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const usuariosCollectionRef = collection(db, "usuarios");
      const usuariosQuery = query(
        usuariosCollectionRef,
        where("fazAtendimento", "==", true),
        orderBy("nome")
      );

      const gradesDocRef = doc(db, "administrativo", "grades");
      const configDocRef = doc(db, "financeiro", "configuracoes");

      const [usuariosSnapshot, gradesSnapshot, configSnapshot] =
        await Promise.all([
          getDocs(usuariosQuery),
          getDoc(gradesDocRef),
          getDoc(configDocRef),
        ]);

      allProfessionals = usuariosSnapshot.docs.map((doc) => doc.data());
      allGrades = gradesSnapshot.exists() ? gradesSnapshot.data() : {};
      const configData = configSnapshot.exists() ? configSnapshot.data() : {};
      allValues = configData.valores || { online: 0, presencial: 0 };

      professionalSelector.innerHTML =
        '<option value="todos">Todos os Profissionais</option>';
      allProfessionals.forEach((prof) => {
        if (prof.nome && !prof.inativo) {
          const option = document.createElement("option");
          option.value = prof.nome;
          option.textContent = prof.nome;
          professionalSelector.appendChild(option);
        }
      });

      professionalSelector.addEventListener("change", (e) => {
        renderTable(e.target.value);
      });

      renderTable();
    } catch (error) {
      console.error("Erro ao carregar dados para o resumo de horas:", error);
      appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados. Verifique o console.</p>`;
    }
  }

  fetchAndSetup();
}
