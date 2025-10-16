// Arquivo: /modulos/servico-social/js/dashboard-servico-social.js
// Versão 4.0: Migrado para a sintaxe modular do Firebase v9

import {
  db,
  functions,
  httpsCallable,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const summaryContainer = document.getElementById("summary-panel-container");
  const agendamentosContainer = document.getElementById(
    "agendamentos-card-container"
  );

  if (!summaryContainer || !agendamentosContainer) return;

  const isAdmin = userData.funcoes && userData.funcoes.includes("admin");

  if (isAdmin) {
    renderDisponibilidadeAdmin();
  } else {
    renderDisponibilidadeAssistente();
  }

  renderAgendamentos();

  async function renderDisponibilidadeAdmin() {
    try {
      const getTodasDisponibilidades = httpsCallable(
        functions,
        "getTodasDisponibilidadesAssistentes"
      );
      const result = await getTodasDisponibilidades();
      const todasDisponibilidades = result.data;

      let disponibilidadeHtml =
        '<p style="padding: 0 15px;">Nenhuma disponibilidade informada pelas assistentes.</p>';

      if (todasDisponibilidades && todasDisponibilidades.length > 0) {
        disponibilidadeHtml = "";
        todasDisponibilidades.forEach((assistente) => {
          disponibilidadeHtml += `<h4 class="assistente-nome-titulo">${assistente.nome}</h4>`;

          const disponibilidadeMap = assistente.disponibilidade;
          if (
            !disponibilidadeMap ||
            Object.keys(disponibilidadeMap).length === 0
          ) {
            disponibilidadeHtml +=
              '<p class="sem-dispo-assistente">Nenhuma disponibilidade futura informada.</p>';
            return;
          }

          const hoje = new Date();
          hoje.setDate(1);
          hoje.setHours(0, 0, 0, 0);

          const mesesOrdenados = Object.keys(disponibilidadeMap)
            .filter((mesKey) => {
              const [ano, mes] = mesKey.split("-");
              const dataKey = new Date(ano, parseInt(mes) - 1, 1);
              return dataKey >= hoje;
            })
            .sort();

          if (mesesOrdenados.length === 0) {
            disponibilidadeHtml +=
              '<p class="sem-dispo-assistente">Nenhuma disponibilidade futura informada.</p>';
            return;
          }

          mesesOrdenados.forEach((mesKey) => {
            const [ano, mes] = mesKey.split("-");
            const dataReferencia = new Date(ano, parseInt(mes) - 1, 1);
            const nomeMes = dataReferencia.toLocaleString("pt-BR", {
              month: "long",
            });
            const nomeMesCapitalizado =
              nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

            const dadosDoMes = disponibilidadeMap[mesKey];
            const onlineHtml = formatarModalidade(dadosDoMes.online);
            const presencialHtml = formatarModalidade(dadosDoMes.presencial);

            disponibilidadeHtml += `
                            <div class="disponibilidade-mes">
                                <strong class="mes-titulo">${nomeMesCapitalizado}</strong>
                                <strong>Online:</strong> <ul>${onlineHtml}</ul>
                                <strong>Presencial:</strong> <ul>${presencialHtml}</ul>
                            </div>
                        `;
          });
        });
      }

      summaryContainer.innerHTML = `
                <div class="summary-card">
                    <h4>🗓️ Disponibilidade da Equipe</h4>
                    ${disponibilidadeHtml}
                    <a href="#disponibilidade-assistente" class="card-footer-link">Gerenciar disponibilidades</a>
                </div>`;
    } catch (error) {
      console.error("Erro ao carregar disponibilidade para admin:", error);
      summaryContainer.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Não foi possível carregar as disponibilidades.</div>`;
    }
  }

  async function renderDisponibilidadeAssistente() {
    try {
      const docRef = doc(db, "disponibilidadeAssistentes", user.uid);
      const docSnap = await getDoc(docRef);

      let disponibilidadeHtml =
        '<p style="padding: 0 15px;">Nenhuma disponibilidade futura informada.</p>';

      if (docSnap.exists()) {
        const data = docSnap.data();
        const disponibilidadeMap = data.disponibilidade;

        if (disponibilidadeMap && Object.keys(disponibilidadeMap).length > 0) {
          const hoje = new Date();
          hoje.setDate(1);
          hoje.setHours(0, 0, 0, 0);

          const mesesOrdenados = Object.keys(disponibilidadeMap)
            .filter((mesKey) => {
              const [ano, mes] = mesKey.split("-");
              const dataKey = new Date(ano, parseInt(mes) - 1, 1);
              return dataKey >= hoje;
            })
            .sort();

          if (mesesOrdenados.length > 0) {
            disponibilidadeHtml = "";
            mesesOrdenados.forEach((mesKey) => {
              const [ano, mes] = mesKey.split("-");
              const dataReferencia = new Date(ano, parseInt(mes) - 1, 1);
              const nomeMes = dataReferencia.toLocaleString("pt-BR", {
                month: "long",
              });
              const nomeMesCapitalizado =
                nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

              const dadosDoMes = disponibilidadeMap[mesKey];
              const onlineHtml = formatarModalidade(dadosDoMes.online);
              const presencialHtml = formatarModalidade(dadosDoMes.presencial);

              disponibilidadeHtml += `
                                <div class="disponibilidade-mes">
                                    <strong class="mes-titulo">${nomeMesCapitalizado}</strong>
                                    <strong>Online:</strong> <ul>${onlineHtml}</ul>
                                    <strong>Presencial:</strong> <ul>${presencialHtml}</ul>
                                </div>
                            `;
            });
          }
        }
      }

      summaryContainer.innerHTML = `
                <div class="summary-card">
                    <h4>🗓️ Minha Disponibilidade</h4>
                    ${disponibilidadeHtml}
                    <a href="#disponibilidade-assistente" class="card-footer-link">Clique aqui para modificar</a>
                </div>`;
    } catch (error) {
      console.error("Erro ao carregar disponibilidade:", error);
      summaryContainer.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Não foi possível carregar a disponibilidade.</div>`;
    }
  }

  function formatarModalidade(dados) {
    if (!dados?.dias || dados.dias.length === 0) {
      return "<li>Nenhum horário informado.</li>";
    }
    const diasFormatados = dados.dias.map((d) => d.split("-")[2]).join(", ");
    return `<li>Dias ${diasFormatados} (das ${dados.inicio} às ${dados.fim})</li>`;
  }

  async function renderAgendamentos() {
    try {
      const inscricoesRef = collection(db, "inscricoes");
      const q = query(
        inscricoesRef,
        where("status", "==", "aguardando_triagem"),
        limit(5)
      );
      const snapshot = await getDocs(q);
      let agendamentosHtml = "";

      if (snapshot.empty) {
        agendamentosHtml = "<li>Nenhuma triagem aguardando agendamento.</li>";
      } else {
        snapshot.forEach((doc) => {
          const data = doc.data();
          const dataInscricao =
            data.timestamp?.toDate().toLocaleDateString("pt-BR") || "N/D";
          agendamentosHtml += `<li><strong>${data.nomeCompleto}</strong> - Inscrito em ${dataInscricao}</li>`;
        });
      }

      agendamentosContainer.innerHTML = `
                <div class="info-card">
                    <h3>✅ Próximos Agendamentos de Triagem</h3>
                    <ul>
                        ${agendamentosHtml}
                    </ul>
                     <a href="#agendamentos-triagem" class="card-footer-link">Ver todos</a>
                </div>`;
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      agendamentosContainer.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Não foi possível carregar os agendamentos.</div>`;
    }
  }

  const style = document.createElement("style");
  style.textContent = `
        .disponibilidade-mes {
            padding: 10px 15px;
            border-top: 1px solid var(--cor-borda);
        }
        .disponibilidade-mes:first-child {
            border-top: none;
            padding-top: 0;
        }
        .mes-titulo {
            display: block;
            font-size: 1.1em;
            color: var(--cor-primaria);
            margin-bottom: 8px;
        }
        .assistente-nome-titulo {
            background-color: var(--cor-fundo-sutil);
            color: var(--cor-primaria);
            padding: 8px 15px;
            margin: 10px -15px 0 -15px;
            border-top: 1px solid var(--cor-borda);
            border-bottom: 1px solid var(--cor-borda);
        }
        .summary-card > .assistente-nome-titulo:first-of-type {
             margin-top: 0;
             border-top: none;
        }
        .sem-dispo-assistente {
            padding: 0 15px 10px 15px;
            font-style: italic;
            color: #888;
        }
    `;
  document.head.appendChild(style);
}
