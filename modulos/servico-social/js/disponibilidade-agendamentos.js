// Arquivo: /modulos/servico-social/js/disponibilidade-agendamentos.js
// Versão: 2.0 (Migrado para a sintaxe modular do Firebase v9)

import { db, collection, getDocs } from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const tableBody = document.getElementById("disponibilidade-table-body");
  if (!tableBody) return;

  async function carregarDisponibilidades() {
    tableBody.innerHTML =
      '<tr><td colspan="5"><div class="loading-spinner"></div></td></tr>';

    try {
      // Sintaxe v9 para buscar todos os documentos da coleção
      const snapshot = await getDocs(
        collection(db, "disponibilidadeAssistentes")
      );

      if (snapshot.empty) {
        tableBody.innerHTML =
          '<tr><td colspan="5">Nenhuma disponibilidade informada.</td></tr>';
        return;
      }

      let disponibilidades = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const nomeAssistente = data.assistenteNome;

        if (data.disponibilidade) {
          for (const mesKey in data.disponibilidade) {
            const dadosMes = data.disponibilidade[mesKey];
            // Online
            if (dadosMes.online && dadosMes.online.dias) {
              dadosMes.online.dias.forEach((dia) => {
                disponibilidades.push({
                  nome: nomeAssistente,
                  data: dia,
                  inicio: dadosMes.online.inicio,
                  fim: dadosMes.online.fim,
                  modalidade: "Online",
                });
              });
            }
            // Presencial
            if (dadosMes.presencial && dadosMes.presencial.dias) {
              dadosMes.presencial.dias.forEach((dia) => {
                disponibilidades.push({
                  nome: nomeAssistente,
                  data: dia,
                  inicio: dadosMes.presencial.inicio,
                  fim: dadosMes.presencial.fim,
                  modalidade: "Presencial",
                });
              });
            }
          }
        }
      });

      // Ordenar por data
      disponibilidades.sort((a, b) => new Date(a.data) - new Date(b.data));

      if (disponibilidades.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="5">Nenhuma disponibilidade futura encontrada.</td></tr>';
        return;
      }

      const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
      };

      tableBody.innerHTML = disponibilidades
        .map(
          (d) => `
                <tr>
                    <td>${d.nome}</td>
                    <td>${formatDate(d.data)}</td>
                    <td>${d.inicio}</td>
                    <td>${d.fim}</td>
                    <td>${d.modalidade}</td>
                </tr>
            `
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar disponibilidades: ", error);
      tableBody.innerHTML =
        '<tr><td colspan="5">Ocorreu um erro ao carregar os dados.</td></tr>';
    }
  }

  carregarDisponibilidades();
}
