// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.6.1 (Correção: respostas.forEach)

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

export async function initDashboard(user, userData) {
  console.log("📈 Iniciando Dashboard de RH...");

  const db = window.db;
  if (!db) {
    console.error(
      "Firebase Firestore não inicializado. Não é possível carregar os dados."
    );
    document.getElementById("content-area").innerHTML =
      "<h2>Erro</h2><p>Falha ao conectar com o banco de dados.</p>";
    return;
  }

  // ============================================
  // DEFINIÇÃO DAS COLEÇÕES
  // ============================================
  const usuariosCollection = collection(db, "usuarios");
  const vagasCollection = collection(db, "vagas");
  const onboardingCollection = collection(db, "onboarding");
  const comunicadosCollection = collection(db, "comunicados");
  const desligamentosCollection = collection(db, "desligamentos");
  const candidatosCollection = collection(db, "candidaturas");
  const tokensAcessoCollection = collection(db, "tokens_acesso");
  const estudosDeCasoCollection = collection(db, "estudos_de_caso");

  // ============================================
  // MAPEAMENTO DOS ELEMENTOS DO DOM - DASHBOARD
  // ============================================
  const metricAtivos = document.getElementById("rh-metric-ativos");
  const metricVagas = document.getElementById("rh-metric-vagas");
  const metricOnboarding = document.getElementById("rh-metric-onboarding");
  const metricComunicados = document.getElementById("rh-metric-comunicados");

  const funcoesChartCtx = document
    .getElementById("rh-funcoes-chart")
    ?.getContext("2d");
  const rhProfissaoChartCtx = document
    .getElementById("rh-profissao-chart")
    ?.getContext("2d");
  const desligamentoChartCtx = document
    .getElementById("rh-desligamento-chart")
    ?.getContext("2d");

  // ============================================
  // MAPEAMENTO DOS ELEMENTOS DO DOM - RELATÓRIOS
  // ============================================
  const relTotalInscricoes = document.getElementById("rel-total-inscricoes");
  const relTestesRespondidos = document.getElementById(
    "rel-testes-respondidos"
  );
  const relTestesPendentes = document.getElementById("rel-testes-pendentes");
  const relTaxaResposta = document.getElementById("rel-taxa-resposta");
  const relFiltroVaga = document.getElementById("rel-filtro-vaga");
  const relFiltroStatus = document.getElementById("rel-filtro-status");
  const relBuscaCandidato = document.getElementById("rel-busca-candidato");
  const relFiltroTeste = document.getElementById("rel-filtro-teste");
  const btnAtualizarRelatorios = document.getElementById(
    "btn-atualizar-relatorios"
  );

  // ============================================
  // ESTADO GLOBAL DOS RELATÓRIOS
  // ============================================
  let candidatosCache = [];
  let tokensCache = [];
  let vagasCache = [];
  let estudosCache = [];

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO - EXCEL
  // ============================================
  function exportarParaExcel(dados, nomeArquivo = "relatorio.csv") {
    console.log("📊 Exportando para Excel (CSV UTF-8 com BOM)...", dados);

    if (!dados || dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    try {
      let csv = [];
      const headers = Object.keys(dados[0]);

      const headerRow = headers
        .map((h) => {
          let header = String(h).replace(/"/g, '""');
          return `"${header}"`;
        })
        .join(",");
      csv.push(headerRow);

      dados.forEach((linha) => {
        const row = headers
          .map((h) => {
            let valor = linha[h] || "";
            if (valor === null || valor === undefined) {
              valor = "";
            } else if (typeof valor === "object") {
              valor = JSON.stringify(valor);
            } else {
              valor = String(valor);
            }
            valor = valor.replace(/"/g, '""');
            return `"${valor}"`;
          })
          .join(",");
        csv.push(row);
      });

      const csvContent = csv.join("\n");
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const nomeComExtenso = nomeArquivo.includes(".")
        ? nomeArquivo
        : nomeArquivo + ".csv";
      link.setAttribute("download", nomeComExtenso);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("✅ CSV gerado com sucesso!");
      window.showToast?.(`✅ Arquivo ${nomeComExtenso} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar CSV:", error);
      window.showToast?.("❌ Erro ao exportar arquivo", "error");
    }
  }

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO - PDF
  // ============================================
  function exportarParaPDF(elementId, nomeArquivo = "relatorio.pdf") {
    console.log("📄 Exportando para PDF...", elementId);

    const element = document.getElementById(elementId);
    if (!element) {
      console.error("❌ Elemento não encontrado:", elementId);
      window.showToast?.("❌ Elemento não encontrado para exportar", "error");
      return;
    }

    const tabela = element.querySelector("table");
    if (!tabela) {
      window.showToast?.(
        "⚠️ Nenhuma tabela encontrada para exportar",
        "warning"
      );
      return;
    }

    const linhas = tabela.querySelectorAll("tbody tr");
    if (linhas.length === 0) {
      window.showToast?.("⚠️ Nenhum dado para exportar", "warning");
      return;
    }

    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      console.log("⚠️ Bibliotecas PDF já devem estar carregadas no HTML");
      window.showToast?.("Bibliotecas PDF não carregadas", "error");
      return;
    }

    gerarPDFComJsPDF(tabela, nomeArquivo);
  }

  function gerarPDFComJsPDF(tabela, nomeArquivo) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // CABEÇALHO
      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 148, 22, {
        align: "center",
      });

      doc.setFontSize(14);
      doc.setTextColor(51, 51, 51);
      const tituloRelatorio = nomeArquivo
        .replace(".pdf", "")
        .replace(/_/g, " ")
        .toUpperCase();
      doc.text(tituloRelatorio, 148, 32, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(153, 153, 153);
      const dataHora = `Data: ${new Date().toLocaleDateString(
        "pt-BR"
      )} | Hora: ${new Date().toLocaleTimeString("pt-BR")}`;
      doc.text(dataHora, 148, 38, { align: "center" });

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, 42, 283, 42);

      // EXTRAI DADOS DA TABELA
      const cabecalhos = [];
      const linhas = [];

      tabela.querySelectorAll("thead th").forEach((th) => {
        cabecalhos.push(th.textContent.trim());
      });

      tabela.querySelectorAll("tbody tr").forEach((tr) => {
        const linha = [];
        tr.querySelectorAll("td").forEach((td) => {
          const texto = td.textContent.trim();
          linha.push(texto);
        });
        if (linha.length > 0) {
          linhas.push(linha);
        }
      });

      console.log("📊 Cabeçalhos:", cabecalhos);
      console.log("📊 Linhas:", linhas.length);

      // CRIA A TABELA COM AUTOTABLE
      doc.autoTable({
        head: [cabecalhos],
        body: linhas,
        startY: 48,
        theme: "striped",
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [249, 249, 249],
        },
        margin: { top: 48, left: 14, right: 14, bottom: 35 },
        styles: {
          overflow: "linebreak",
          cellWidth: "wrap",
        },
        columnStyles: {
          0: { cellWidth: "auto" },
        },
      });

      // RODAPÉ
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 182, 283, 182);

        const endereco =
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290";
        const whatsapp = "WhatsApp: 11 99794-9071";

        doc.text(endereco, 148, 187, { align: "center", maxWidth: 260 });
        doc.text(whatsapp, 148, 191, { align: "center" });

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 148, 195, { align: "center" });
        doc.text(
          "Relatório gerado automaticamente pelo sistema EuPsico © 2025",
          148,
          198,
          { align: "center" }
        );
      }

      doc.save(nomeArquivo);
      console.log("✅ PDF gerado com sucesso!");
      window.showToast?.(`✅ Arquivo ${nomeArquivo} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao gerar PDF. Tente novamente.", "error");
    }
  }

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO INDIVIDUAIS - EXCEL
  // ============================================
  window.exportarInscricoesExcel = function () {
    console.log("📊 Exportando Inscrições por Vaga...");
    const tabelaBody = document.getElementById("rel-tbody-inscricoes");
    if (!tabelaBody) {
      window.showToast?.("Tabela não encontrada", "error");
      return;
    }

    const dados = [];
    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length > 0) {
        dados.push({
          Vaga: cells[0].textContent.trim(),
          "Número de Inscrições": cells[1].textContent.trim(),
        });
      }
    });

    if (dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "inscricoes_por_vaga.csv");
  };

  window.exportarInscricoesPDF = function () {
    exportarParaPDF("rel-tabela-inscricoes", "inscricoes_por_vaga.pdf");
  };

  window.exportarCandidatosExcel = function () {
    console.log("📊 Exportando Lista de Candidatos com todos os dados...");

    const dados = [];
    candidatosCache.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vaga_id);
      const vagaNome = vaga?.titulo || vaga?.tituloVaga || "-";

      const testeEnviado = tokensCache.some(
        (t) => t.candidatoId === candidato.id
      );
      const testeRespondido = tokensCache.some(
        (t) => t.candidatoId === candidato.id && t.usado
      );

      let statusTeste = "Não enviado";
      if (testeEnviado && testeRespondido) {
        statusTeste = "✅ Respondido";
      } else if (testeEnviado) {
        statusTeste = "📤 Enviado";
      }

      dados.push({
        "Nome Completo": candidato.nome_completo || "-",
        Email: candidato.email_candidato || "-",
        Telefone: candidato.telefone_contato || "-",
        Vaga: vagaNome,
        "Status do Recrutamento": candidato.status_recrutamento || "-",
        "Status do Teste": statusTeste,
        "Data da Candidatura": candidato.data_candidatura
          ? new Date(
              candidato.data_candidatura.toDate?.() ||
                candidato.data_candidatura
            ).toLocaleDateString("pt-BR")
          : "-",
      });
    });

    if (dados.length === 0) {
      window.showToast?.("⚠️ Nenhum candidato para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "candidatos_completo.csv");
  };

  window.exportarCandidatosPDF = function () {
    exportarParaPDF("rel-tabela-candidatos", "candidatos.pdf");
  };

  window.exportarRespostasExcel = function () {
    console.log("📊 Exportando Respostas aos Testes...");
    const tabelaBody = document.getElementById("rel-tbody-respostas");
    if (!tabelaBody) {
      window.showToast?.("Tabela não encontrada", "error");
      return;
    }

    const dados = [];
    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length >= 5) {
        dados.push({
          Candidato: cells[0].textContent.trim(),
          Teste: cells[1].textContent.trim(),
          "Data de Resposta": cells[2].textContent.trim(),
          "Tempo Gasto": cells[3].textContent.trim(),
          Status: cells[4].textContent.trim(),
        });
      }
    });

    if (dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "respostas_testes.csv");
  };

  window.exportarRespostasPDF = function () {
    exportarParaPDF("rel-tabela-respostas", "respostas_testes.pdf");
  };

  // ============================================
  // MODAL DE DETALHES DO CANDIDATO
  // ============================================
  window.abrirModalDetalhesCandidato = async function (candidatoId) {
    console.log("🔍 Abrindo detalhes do candidato:", candidatoId);

    const candidato = candidatosCache.find((c) => c.id === candidatoId);
    if (!candidato) {
      Swal.fire({
        icon: "error",
        title: "Candidato não encontrado",
        text: "Não foi possível localizar este candidato na lista.",
        confirmButtonColor: "#667eea",
      });
      return;
    }

    const vaga = vagasCache.find((v) => v.id === candidato.vaga_id);
    const vagaNome = vaga?.titulo || vaga?.tituloVaga || "Não especificada";

    const tokenCandidato = tokensCache.find(
      (t) => t.candidatoId === candidato.id
    );
    let statusTeste = "Teste não enviado";
    let dataTeste = "-";
    let tempoGasto = "-";

    if (tokenCandidato) {
      if (tokenCandidato.usado) {
        statusTeste = "✅ Teste respondido";
        if (tokenCandidato.dataUso) {
          dataTeste = new Date(
            tokenCandidato.dataUso.toDate?.() || tokenCandidato.dataUso
          ).toLocaleString("pt-BR");
        }
        if (tokenCandidato.tempoGasto) {
          tempoGasto = tokenCandidato.tempoGasto;
        }
      } else {
        statusTeste = "📤 Teste enviado (Aguardando resposta)";
      }
    }

    const dataCandidatura = candidato.data_candidatura
      ? new Date(
          candidato.data_candidatura.toDate?.() || candidato.data_candidatura
        ).toLocaleDateString("pt-BR")
      : "-";

    Swal.fire({
      title: `<strong>Detalhes do Candidato</strong>`,
      html: `
        <div style="text-align: left; padding: 10px;">
          <h4 style="color: #667eea; margin-bottom: 15px;">${
            candidato.nome_completo || "Nome não informado"
          }</h4>
          
          <p><strong>📧 Email:</strong> ${candidato.email_candidato || "-"}</p>
          <p><strong>📱 Telefone:</strong> ${
            candidato.telefone_contato || "-"
          }</p>
          <p><strong>💼 Vaga:</strong> ${vagaNome}</p>
          <p><strong>📊 Status do Recrutamento:</strong> ${
            candidato.status_recrutamento || "-"
          }</p>
          <p><strong>📅 Data da Candidatura:</strong> ${dataCandidatura}</p>
          
          <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
          
          <h5 style="color: #667eea;">Status do Teste:</h5>
          <p><strong>${statusTeste}</strong></p>
          ${
            tokenCandidato && tokenCandidato.usado
              ? `
            <p><strong>📅 Data de resposta:</strong> ${dataTeste}</p>
            <p><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
          `
              : ""
          }
          
          ${
            candidato.observacoes
              ? `
            <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
            <h5 style="color: #667eea;">Observações:</h5>
            <p>${candidato.observacoes}</p>
          `
              : ""
          }
        </div>
      `,
      width: "600px",
      confirmButtonColor: "#667eea",
      confirmButtonText: "Fechar",
    });
  };

  // ============================================
  // 🆕 FUNÇÃO: MODAL VER RESPOSTAS (✅ CORRIGIDA)
  // ============================================
  window.abrirModalVerRespostas = async function (tokenId, candidatoNome) {
    console.log(
      "🔍 Abrindo respostas do candidato:",
      candidatoNome,
      "Token:",
      tokenId
    );

    try {
      const tokenDoc = await getDoc(doc(db, "tokens_acesso", tokenId));
      if (!tokenDoc.exists()) {
        Swal.fire({
          icon: "error",
          title: "Token não encontrado",
          text: "Não foi possível localizar o token de acesso.",
          confirmButtonColor: "#667eea",
        });
        return;
      }

      const tokenData = tokenDoc.data();

      // ✅ CORREÇÃO: Garantir que respostas seja um array
      let respostas = tokenData.respostas || [];
      if (!Array.isArray(respostas)) {
        console.warn("⚠️ Respostas não é um array:", respostas);
        respostas = [];
      }

      const tempoGasto = tokenData.tempoGasto || "Não registrado";

      // ✅ CORREÇÃO: Verifica se estudoDeCasoId existe
      let estudoNome = "Estudo não encontrado";
      if (tokenData.estudoDeCasoId) {
        try {
          const estudoDoc = await getDoc(
            doc(db, "estudos_de_caso", tokenData.estudoDeCasoId)
          );
          if (estudoDoc.exists()) {
            estudoNome = estudoDoc.data().titulo || "Sem título";
          }
        } catch (err) {
          console.warn(
            "⚠️ Aviso: Não foi possível carregar dados do estudo:",
            err
          );
        }
      }

      if (respostas.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Sem respostas",
          text: "Este candidato ainda não respondeu ao teste.",
          confirmButtonColor: "#667eea",
        });
        return;
      }

      // Monta HTML das respostas
      let htmlRespostas = `
        <div style="text-align: left; padding: 15px;">
          <h4 style="color: #667eea;">📝 ${estudoNome}</h4>
          <p><strong>Candidato:</strong> ${candidatoNome}</p>
          <p><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
          <hr style="margin: 15px 0;">
      `;

      respostas.forEach((resposta, index) => {
        const numero = index + 1;
        const pergunta = resposta.pergunta || `Pergunta ${numero}`;
        const respostaCandidato = resposta.resposta || "Não respondida";

        htmlRespostas += `
          <div style="margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-left: 3px solid #667eea;">
            <p style="margin: 0; font-weight: bold;">Pergunta ${numero}:</p>
            <p style="margin: 5px 0 10px 0;">${pergunta}</p>
            <p style="margin: 0; color: #555;"><strong>Resposta:</strong></p>
            <p style="margin: 5px 0; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px;">
              ${respostaCandidato}
            </p>
          </div>
        `;
      });

      htmlRespostas += `</div>`;

      Swal.fire({
        title: "Respostas do Teste",
        html: htmlRespostas,
        width: "700px",
        confirmButtonColor: "#667eea",
        confirmButtonText: "Fechar",
      });
    } catch (error) {
      console.error("❌ Erro ao abrir respostas:", error);
      Swal.fire({
        icon: "error",
        title: "Erro ao carregar respostas",
        text: error.message,
        confirmButtonColor: "#667eea",
      });
    }
  };

  // ============================================
  // FUNÇÃO: CARREGAR DASHBOARD (ABA 1)
  // ============================================
  async function carregarDashboard() {
    console.log("📊 Carregando métricas do Dashboard...");

    try {
      // Profissionais ativos
      const qAtivos = query(
        usuariosCollection,
        where("perfil", "in", ["Voluntário", "Colaborador"]),
        where("ativo", "==", true)
      );
      const ativos = await getDocs(qAtivos);
      if (metricAtivos) metricAtivos.textContent = ativos.size;

      // Vagas em aberto
      const qVagas = query(vagasCollection, where("status", "==", "Aberta"));
      const vagas = await getDocs(qVagas);
      if (metricVagas) metricVagas.textContent = vagas.size;

      // Colaboradores em onboarding
      const onboarding = await getDocs(onboardingCollection);
      if (metricOnboarding) metricOnboarding.textContent = onboarding.size;

      // Comunicados recentes (última semana)
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
      const qComunicados = query(
        comunicadosCollection,
        where("dataEnvio", ">=", umaSemanaAtras)
      );
      const comunicados = await getDocs(qComunicados);
      if (metricComunicados) metricComunicados.textContent = comunicados.size;

      // Carregar gráficos
      await carregarGraficos(ativos);

      console.log("✅ Dashboard carregado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao carregar dashboard:", error);
      window.showToast?.("Erro ao carregar métricas", "error");
    }
  }

  // ============================================
  // FUNÇÃO: CARREGAR GRÁFICOS
  // ============================================
  async function carregarGraficos(ativos) {
    if (!funcoesChartCtx || !rhProfissaoChartCtx || !desligamentoChartCtx) {
      console.warn("⚠️ Canvas dos gráficos não encontrados");
      return;
    }

    // Gráfico: Distribuição por Função
    const funcoesCounts = {};
    ativos.forEach((doc) => {
      const funcoes = doc.data().funcoes || [];
      funcoes.forEach((funcao) => {
        funcoesCounts[funcao] = (funcoesCounts[funcao] || 0) + 1;
      });
    });

    new Chart(funcoesChartCtx, {
      type: "bar",
      data: {
        labels: Object.keys(funcoesCounts),
        datasets: [
          {
            label: "Quantidade",
            data: Object.values(funcoesCounts),
            backgroundColor: "rgba(102, 126, 234, 0.7)",
          },
        ],
      },
    });

    // Gráfico: Distribuição por Profissão
    const profissoesCounts = {};
    ativos.forEach((doc) => {
      const profissao = doc.data().profissao || "Não informado";
      profissoesCounts[profissao] = (profissoesCounts[profissao] || 0) + 1;
    });

    new Chart(rhProfissaoChartCtx, {
      type: "pie",
      data: {
        labels: Object.keys(profissoesCounts),
        datasets: [
          {
            data: Object.values(profissoesCounts),
            backgroundColor: ["#667eea", "#764ba2", "#f093fb", "#4facfe"],
          },
        ],
      },
    });

    // Gráfico: Desligamentos (últimos 12 meses)
    const desligamentos = await getDocs(desligamentosCollection);
    const desligamentosPorMes = {};
    desligamentos.forEach((doc) => {
      const data = doc.data().dataDesligamento?.toDate();
      if (data) {
        const mes = data.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        desligamentosPorMes[mes] = (desligamentosPorMes[mes] || 0) + 1;
      }
    });

    new Chart(desligamentoChartCtx, {
      type: "line",
      data: {
        labels: Object.keys(desligamentosPorMes),
        datasets: [
          {
            label: "Desligamentos",
            data: Object.values(desligamentosPorMes),
            borderColor: "#f093fb",
            fill: false,
          },
        ],
      },
    });
  }

  // ============================================
  // FUNÇÃO: CARREGAR RELATÓRIOS (ABA 2)
  // ============================================
  async function carregarRelatorios() {
    console.log("📊 Carregando Relatórios de Recrutamento...");

    try {
      const [candidatosSnap, tokensSnap, vagasSnap, estudosSnap] =
        await Promise.all([
          getDocs(candidatosCollection),
          getDocs(tokensAcessoCollection),
          getDocs(vagasCollection),
          getDocs(estudosDeCasoCollection),
        ]);

      candidatosCache = candidatosSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      tokensCache = tokensSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      vagasCache = vagasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      estudosCache = estudosSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("✅ Dados carregados:", {
        candidatos: candidatosCache.length,
        tokens: tokensCache.length,
        vagas: vagasCache.length,
        estudos: estudosCache.length,
      });

      // Atualizar métricas consolidadas
      atualizarMetricasConsolidadas();

      // Renderizar tabelas
      renderizarInscricoesPorVaga();
      renderizarListaCandidatos();
      renderizarRespostasTestes();

      // Preencher filtros
      preencherFiltros();

      console.log("✅ Relatórios carregados com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao carregar relatórios:", error);
      window.showToast?.("Erro ao carregar relatórios", "error");
    }
  }

  // ============================================
  // ATUALIZAR MÉTRICAS CONSOLIDADAS
  // ============================================
  function atualizarMetricasConsolidadas() {
    const totalInscricoes = candidatosCache.length;
    const testesRespondidos = tokensCache.filter((t) => t.usado).length;
    const testesPendentes = totalInscricoes - testesRespondidos;
    const taxaResposta =
      totalInscricoes > 0
        ? ((testesRespondidos / totalInscricoes) * 100).toFixed(0)
        : 0;

    if (relTotalInscricoes) relTotalInscricoes.textContent = totalInscricoes;
    if (relTestesRespondidos)
      relTestesRespondidos.textContent = testesRespondidos;
    if (relTestesPendentes) relTestesPendentes.textContent = testesPendentes;
    if (relTaxaResposta) relTaxaResposta.textContent = `${taxaResposta}%`;
  }

  // ============================================
  // RENDERIZAR: INSCRIÇÕES POR VAGA
  // ============================================
  function renderizarInscricoesPorVaga() {
    const tbody = document.getElementById("rel-tbody-inscricoes");
    if (!tbody) return;

    tbody.innerHTML = "";

    const inscricoesPorVaga = {};
    candidatosCache.forEach((candidato) => {
      const vagaId = candidato.vaga_id;
      if (!inscricoesPorVaga[vagaId]) {
        inscricoesPorVaga[vagaId] = 0;
      }
      inscricoesPorVaga[vagaId]++;
    });

    const vagasComInscricoes = Object.keys(inscricoesPorVaga);

    if (vagasComInscricoes.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="2">Nenhuma inscrição encontrada.</td></tr>';
      return;
    }

    vagasComInscricoes.forEach((vagaId) => {
      const vaga = vagasCache.find((v) => v.id === vagaId);
      const vagaNome = vaga?.titulo || vaga?.tituloVaga || "Vaga desconhecida";
      const numInscricoes = inscricoesPorVaga[vagaId];

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${vagaNome}</td>
        <td>${numInscricoes}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ============================================
  // RENDERIZAR: LISTA DE CANDIDATOS
  // ============================================
  function renderizarListaCandidatos() {
    const tbody = document.getElementById("rel-tbody-candidatos");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (candidatosCache.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7">Nenhum candidato encontrado.</td></tr>';
      return;
    }

    candidatosCache.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vaga_id);
      const vagaNome = vaga?.titulo || vaga?.tituloVaga || "-";

      const testeEnviado = tokensCache.some(
        (t) => t.candidatoId === candidato.id
      );
      const testeRespondido = tokensCache.some(
        (t) => t.candidatoId === candidato.id && t.usado
      );

      let badgeTeste = '<span class="badge bg-secondary">Não enviado</span>';
      if (testeEnviado && testeRespondido) {
        badgeTeste = '<span class="badge bg-success">✅ Respondido</span>';
      } else if (testeEnviado) {
        badgeTeste = '<span class="badge bg-warning">📤 Enviado</span>';
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${candidato.nome_completo || "-"}</td>
        <td>${candidato.email_candidato || "-"}</td>
        <td>${candidato.telefone_contato || "-"}</td>
        <td>${vagaNome}</td>
        <td>${candidato.status_recrutamento || "-"}</td>
        <td>${badgeTeste}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirModalDetalhesCandidato('${
            candidato.id
          }')" title="Ver detalhes">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ============================================
  // RENDERIZAR: RESPOSTAS TESTES
  // ============================================
  function renderizarRespostasTestes() {
    const tbody = document.getElementById("rel-tbody-respostas");
    if (!tbody) return;

    tbody.innerHTML = "";

    const tokensUsados = tokensCache.filter((t) => t.usado);

    if (tokensUsados.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6">Nenhuma resposta de teste encontrada.</td></tr>';
      return;
    }

    tokensUsados.forEach((token) => {
      const candidato = candidatosCache.find((c) => c.id === token.candidatoId);
      const candidatoNome =
        candidato?.nome_completo || "Candidato desconhecido";

      const estudo = estudosCache.find((e) => e.id === token.estudoDeCasoId);
      const estudoNome = estudo?.titulo || "Teste desconhecido";

      const dataResposta = token.dataUso
        ? new Date(token.dataUso.toDate?.() || token.dataUso).toLocaleString(
            "pt-BR"
          )
        : "-";
      const tempoGasto = token.tempoGasto || "Não registrado";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${candidatoNome}</td>
        <td>${estudoNome}</td>
        <td>${dataResposta}</td>
        <td>${tempoGasto}</td>
        <td><span class="badge bg-success">✅ Respondido</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirModalVerRespostas('${token.id}', '${candidatoNome}')" title="Ver respostas">
            <i class="fas fa-eye"></i> Ver Respostas
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ============================================
  // PREENCHER FILTROS
  // ============================================
  function preencherFiltros() {
    if (relFiltroVaga) {
      relFiltroVaga.innerHTML = '<option value="">Todas as vagas</option>';
      vagasCache.forEach((vaga) => {
        const option = document.createElement("option");
        option.value = vaga.id;
        option.textContent = vaga.titulo || vaga.tituloVaga || "Sem título";
        relFiltroVaga.appendChild(option);
      });
    }

    if (relFiltroTeste) {
      relFiltroTeste.innerHTML = '<option value="">Todos os testes</option>';
      estudosCache.forEach((estudo) => {
        const option = document.createElement("option");
        option.value = estudo.id;
        option.textContent = estudo.titulo || "Sem título";
        relFiltroTeste.appendChild(option);
      });
    }
  }

  // ============================================
  // EVENTOS: TROCA DE ABAS
  // ============================================
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetTab = link.getAttribute("data-tab");

      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      link.classList.add("active");
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }

      if (targetTab === "dashboard") {
        carregarDashboard();
      } else if (targetTab === "relatorios") {
        carregarRelatorios();
      }
    });
  });

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  console.log("🚀 Iniciando Dashboard de RH...");
  await carregarDashboard();
  console.log("✅ Dashboard de RH inicializado com sucesso!");
}
