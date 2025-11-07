// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.7.0 (Correção: erro indexOf em abrirModalVerRespostas)

// ✅ IMPORTA DO FIREBASE-INIT.JS
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

  // ============================================
  // MAPEAMENTO DOS ELEMENTOS DO DOM - RELATÓRIOS
  // ============================================
  const relFiltroVagaCand = document.getElementById("rel-filtro-vaga-cand");
  const relFiltroCandidato = document.getElementById("rel-filtro-candidato");
  const relFiltroTeste = document.getElementById("rel-filtro-teste");

  // ============================================
  // ESTADO GLOBAL DOS RELATÓRIOS
  // ============================================
  let candidatosCache = [];
  let tokensCache = [];
  let vagasCache = [];
  let estudosCache = [];

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO - EXCEL (CSV com BOM UTF-8)
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
  // FUNÇÕES DE EXPORTAÇÃO - PDF (JSPDF + autoTable)
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
  // 🆕 NOVA FUNÇÃO: MODAL DE DETALHES DO CANDIDATO
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

    // Busca informações sobre testes
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
      // Busca o token e as respostas
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
      const respostas = tokenData.respostas || [];
      const tempoGasto = tokenData.tempoGasto || "Não registrado";

      // ✅ CORREÇÃO: Verifica se estudoDeCasoId existe antes de buscar
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

      htmlRespostas += `
        </div>
        <div style="margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px;">
          <p style="margin: 0; font-size: 12px; color: #666;">
            💡 <strong>Dica:</strong> Você pode exportar essas respostas individualmente clicando em "Exportar" abaixo.
          </p>
        </div>
      `;

      // Exibe modal com botões de exportação
      Swal.fire({
        title: "Respostas do Teste",
        html: htmlRespostas,
        width: "700px",
        confirmButtonColor: "#667eea",
        confirmButtonText: "Fechar",
        showDenyButton: true,
        denyButtonText: "📄 Exportar PDF",
        showCancelButton: true,
        cancelButtonText: "📊 Exportar Excel",
        cancelButtonColor: "#28a745",
        denyButtonColor: "#dc3545",
      }).then((result) => {
        if (result.isDenied) {
          // Exportar PDF individual
          exportarRespostaIndividualPDF(
            tokenData,
            candidatoNome,
            estudoNome,
            respostas,
            tempoGasto
          );
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          // Exportar Excel individual
          exportarRespostaIndividualExcel(
            tokenData,
            candidatoNome,
            estudoNome,
            respostas,
            tempoGasto
          );
        }
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
  // 🆕 EXPORTAR RESPOSTA INDIVIDUAL - PDF
  // ============================================
  function exportarRespostaIndividualPDF(
    tokenData,
    candidatoNome,
    estudoNome,
    respostas,
    tempoGasto
  ) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Cabeçalho
      doc.setFontSize(16);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico - Respostas do Teste", 105, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text(`Teste: ${estudoNome}`, 20, 35);
      doc.text(`Candidato: ${candidatoNome}`, 20, 42);
      doc.text(`Tempo gasto: ${tempoGasto}`, 20, 49);

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(20, 53, 190, 53);

      // Respostas
      let yPos = 60;
      doc.setFontSize(10);

      respostas.forEach((resposta, index) => {
        const numero = index + 1;
        const pergunta = resposta.pergunta || `Pergunta ${numero}`;
        const respostaCandidato = resposta.resposta || "Não respondida";

        // Verifica espaço na página
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Pergunta
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 51, 51);
        doc.text(`Pergunta ${numero}:`, 20, yPos);
        yPos += 5;

        doc.setFont("helvetica", "normal");
        const perguntaLines = doc.splitTextToSize(pergunta, 170);
        doc.text(perguntaLines, 20, yPos);
        yPos += perguntaLines.length * 5 + 3;

        // Resposta
        doc.setFont("helvetica", "bold");
        doc.text("Resposta:", 20, yPos);
        yPos += 5;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(85, 85, 85);
        const respostaLines = doc.splitTextToSize(respostaCandidato, 170);
        doc.text(respostaLines, 20, yPos);
        yPos += respostaLines.length * 5 + 8;

        // Linha separadora
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(20, yPos, 190, yPos);
        yPos += 8;
      });

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: "center" });
      }

      const nomeArquivo = `respostas_${candidatoNome
        .replace(/\s+/g, "_")
        .toLowerCase()}.pdf`;
      doc.save(nomeArquivo);

      window.showToast?.(`✅ PDF ${nomeArquivo} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF individual:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  }

  // ============================================
  // 🆕 EXPORTAR RESPOSTA INDIVIDUAL - EXCEL
  // ============================================
  function exportarRespostaIndividualExcel(
    tokenData,
    candidatoNome,
    estudoNome,
    respostas,
    tempoGasto
  ) {
    const dados = [];

    dados.push({
      Candidato: candidatoNome,
      Teste: estudoNome,
      "Tempo Gasto": tempoGasto,
      Pergunta: "",
      Resposta: "",
    });

    respostas.forEach((resposta, index) => {
      dados.push({
        Candidato: "",
        Teste: "",
        "Tempo Gasto": "",
        Pergunta: resposta.pergunta || `Pergunta ${index + 1}`,
        Resposta: resposta.resposta || "Não respondida",
      });
    });

    const nomeArquivo = `respostas_${candidatoNome
      .replace(/\s+/g, "_")
      .toLowerCase()}.csv`;
    exportarParaExcel(dados, nomeArquivo);
  }

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

      // Carregar tabelas
      await carregarTabelaVagas(vagas);
      await carregarTabelaOnboarding(onboarding);
      await carregarTabelaComunicados(comunicados);
      await carregarTabelaDesligamentos();

      console.log("✅ Dashboard carregado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao carregar dashboard:", error);
      window.showToast?.("Erro ao carregar métricas", "error");
    }
  }

  // ============================================
  // FUNÇÕES AUXILIARES: TABELAS DO DASHBOARD
  // ============================================
  async function carregarTabelaVagas(vagas) {
    const tbody = document.getElementById("rh-vagas-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (vagas.size === 0) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhuma vaga em aberto.</td></tr>';
      return;
    }

    vagas.forEach((doc) => {
      const vaga = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${vaga.titulo || vaga.tituloVaga || "-"}</td>
        <td>${vaga.departamento || "-"}</td>
        <td><span class="badge bg-success">Aberta</span></td>
        <td>${
          vaga.dataAbertura
            ? new Date(
                vaga.dataAbertura.toDate?.() || vaga.dataAbertura
              ).toLocaleDateString("pt-BR")
            : "-"
        }</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function carregarTabelaOnboarding(onboarding) {
    const tbody = document.getElementById("rh-onboarding-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (onboarding.size === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4">Nenhum colaborador em onboarding.</td></tr>';
      return;
    }

    onboarding.forEach((doc) => {
      const dados = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${dados.nomeColaborador || "-"}</td>
        <td>${dados.departamento || "-"}</td>
        <td>${
          dados.dataInicio
            ? new Date(
                dados.dataInicio.toDate?.() || dados.dataInicio
              ).toLocaleDateString("pt-BR")
            : "-"
        }</td>
        <td><span class="badge bg-warning">Em Andamento</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function carregarTabelaComunicados(comunicados) {
    const tbody = document.getElementById("rh-comunicados-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (comunicados.size === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3">Nenhum comunicado recente.</td></tr>';
      return;
    }

    comunicados.forEach((doc) => {
      const com = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${com.assunto || "-"}</td>
        <td>${
          com.dataEnvio
            ? new Date(
                com.dataEnvio.toDate?.() || com.dataEnvio
              ).toLocaleDateString("pt-BR")
            : "-"
        }</td>
        <td>${com.remetenteNome || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function carregarTabelaDesligamentos() {
    const tbody = document.getElementById("rh-desligamentos-tbody");
    if (!tbody) return;

    try {
      const umMesAtras = new Date();
      umMesAtras.setMonth(umMesAtras.getMonth() - 1);

      const qDesligamentos = query(
        desligamentosCollection,
        where("dataDesligamento", ">=", umMesAtras)
      );
      const desligamentos = await getDocs(qDesligamentos);

      tbody.innerHTML = "";
      if (desligamentos.size === 0) {
        tbody.innerHTML =
          '<tr><td colspan="4">Nenhum desligamento recente.</td></tr>';
        return;
      }

      desligamentos.forEach((doc) => {
        const desl = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${desl.nomeColaborador || "-"}</td>
          <td>${desl.departamento || "-"}</td>
          <td>${
            desl.dataDesligamento
              ? new Date(
                  desl.dataDesligamento.toDate?.() || desl.dataDesligamento
                ).toLocaleDateString("pt-BR")
              : "-"
          }</td>
          <td>${desl.motivo || "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error("❌ Erro ao carregar desligamentos:", error);
      tbody.innerHTML =
        '<tr><td colspan="4">Erro ao carregar desligamentos.</td></tr>';
    }
  }

  // ============================================
  // FUNÇÃO: CARREGAR RELATÓRIOS (ABA 2)
  // ============================================
  async function carregarRelatorios() {
    console.log("📊 Carregando Relatórios de Recrutamento...");

    try {
      // Buscar dados
      const [candidatosSnap, tokensSnap, vagasSnap, estudosSnap] =
        await Promise.all([
          getDocs(candidatosCollection),
          getDocs(tokensAcessoCollection),
          getDocs(vagasCollection),
          getDocs(estudosDeCasoCollection),
        ]);

      // Armazenar em cache
      candidatosCache = candidatosSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      tokensCache = tokensSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      vagasCache = vagasSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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

      // Renderizar relatórios
      renderizarListaCandidatos();
      renderizarInscricoesPorVaga();
      renderizarRespostasTestes();
      preencherFiltros();

      console.log("✅ Relatórios renderizados com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao carregar relatórios:", error);
      window.showToast?.("Erro ao carregar relatórios", "error");
    }
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
  // RENDERIZAR: RESPOSTAS AOS TESTES
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
    // Filtro de vagas (para candidatos)
    if (relFiltroVagaCand) {
      relFiltroVagaCand.innerHTML = '<option value="">Todas as vagas</option>';
      vagasCache.forEach((vaga) => {
        const option = document.createElement("option");
        option.value = vaga.id;
        option.textContent = vaga.titulo || vaga.tituloVaga || "Sem título";
        relFiltroVagaCand.appendChild(option);
      });
    }

    // Filtro de testes (para respostas)
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
  // EVENTOS: FILTROS
  // ============================================
  if (relFiltroCandidato) {
    relFiltroCandidato.addEventListener("input", aplicarFiltrosCandidatos);
  }
  if (relFiltroVagaCand) {
    relFiltroVagaCand.addEventListener("change", aplicarFiltrosCandidatos);
  }
  if (relFiltroTeste) {
    relFiltroTeste.addEventListener("change", aplicarFiltrosTestes);
  }

  function aplicarFiltrosCandidatos() {
    const termoBusca = relFiltroCandidato?.value.toLowerCase() || "";
    const vagaSelecionada = relFiltroVagaCand?.value || "";

    const candidatosFiltrados = candidatosCache.filter((candidato) => {
      const nomeMatch = candidato.nome_completo
        ?.toLowerCase()
        .includes(termoBusca);
      const vagaMatch = vagaSelecionada
        ? candidato.vaga_id === vagaSelecionada
        : true;
      return nomeMatch && vagaMatch;
    });

    const tbody = document.getElementById("rel-tbody-candidatos");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (candidatosFiltrados.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7">Nenhum candidato encontrado com os filtros aplicados.</td></tr>';
      return;
    }

    candidatosFiltrados.forEach((candidato) => {
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

  function aplicarFiltrosTestes() {
    const testeSelecionado = relFiltroTeste?.value || "";

    const tokensFiltrados = tokensCache.filter((token) => {
      if (!token.usado) return false;
      if (testeSelecionado && token.estudoDeCasoId !== testeSelecionado)
        return false;
      return true;
    });

    const tbody = document.getElementById("rel-tbody-respostas");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (tokensFiltrados.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6">Nenhuma resposta encontrada com os filtros aplicados.</td></tr>';
      return;
    }

    tokensFiltrados.forEach((token) => {
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
  // EVENTOS: TROCA DE ABAS
  // ============================================
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetTab = link.getAttribute("data-tab");

      // Remove active de todas as abas
      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Adiciona active na aba clicada
      link.classList.add("active");
      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }

      // Carrega dados conforme a aba
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
  await carregarDashboard(); // Carrega a aba dashboard por padrão
  console.log("✅ Dashboard de RH inicializado com sucesso!");
}
