// Arquivo: /modulos/servico-social/js/agendamentos-triagem.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const tableBody = document.getElementById("triagem-table-body");
  if (!tableBody) return;

  const isAdmin = (userData.funcoes || []).includes("admin");

  async function carregarAgendamentos() {
    tableBody.innerHTML =
      '<tr><td colspan="10"><div class="loading-spinner"></div></td></tr>';

    try {
      // 1. Cria a referência para a coleção
      const trilhaRef = collection(db, "trilhaPaciente");

      // 2. Constrói a lista de condições da query
      const queryConstraints = [
        where("status", "==", "triagem_agendada"),
        orderBy("lastUpdate", "asc"),
      ];

      // 3. Adiciona uma condição extra se o usuário não for admin
      if (!isAdmin) {
        queryConstraints.push(
          where("assistenteSocialNome", "==", userData.nome)
        );
      }

      // 4. Cria a query final
      const q = query(trilhaRef, ...queryConstraints);

      // 5. Executa a query
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        tableBody.innerHTML =
          '<tr><td colspan="10">Nenhum paciente com triagem agendada no momento.</td></tr>';
        return;
      }

      let rowsHtml = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const dataAgendamento = data.dataTriagem
          ? new Date(data.dataTriagem + "T03:00:00").toLocaleDateString("pt-BR")
          : "Não definida";

        rowsHtml += `
                    <tr>
                        <td>${data.tipoTriagem || "N/A"}</td>
                        <td>${data.nomeCompleto || "N/A"}</td>
                        <td>${data.responsavel?.nome || "N/A"}</td>
                        <td>${data.telefoneCelular || "N/A"}</td>
                        <td>${dataAgendamento}</td>
                        <td>${data.horaTriagem || "N/A"}</td>
                        <td>${data.assistenteSocialNome || "N/A"}</td>
                        <td>
                            <a href="#fila-atendimento/${
                              doc.id
                            }" class="action-button">
                                Preencher Ficha
                            </a>
                        </td>
                    </tr>
                `;
      });
      tableBody.innerHTML = rowsHtml;
    } catch (error) {
      console.error("Erro ao carregar agendamentos da trilha:", error);
      tableBody.innerHTML =
        '<tr><td colspan="10">Ocorreu um erro ao carregar os agendamentos.</td></tr>';
    }
  }

  carregarAgendamentos();
}
