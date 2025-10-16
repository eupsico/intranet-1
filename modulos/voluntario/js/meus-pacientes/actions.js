// Arquivo: /modulos/voluntario/js/meus-pacientes/actions.js

// A função handleEnviarContrato foi removida daqui.

export async function gerarPdfContrato(pacienteData, meuAtendimento) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;
    let cursorY = 15;

    const loadImageAsBase64 = async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      "CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS",
      pageWidth / 2,
      cursorY + 15,
      { align: "center" }
    );
    cursorY += 35;

    const addTextSection = (text, options = {}) => {
      const {
        size = 10,
        style = "normal",
        spaceBefore = 0,
        spaceAfter = 5,
      } = options;
      cursorY += spaceBefore;
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      const lines = doc.splitTextToSize(text, usableWidth);
      const textHeight = doc.getTextDimensions(lines).h;
      if (cursorY + textHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(lines, margin, cursorY);
      cursorY += textHeight + spaceAfter;
    };

    const response = await fetch("../../../public/contrato-terapeutico.html");
    const htmlString = await response.text();
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlString, "text/html");
    const contractContent = htmlDoc.getElementById("contract-content");

    contractContent.querySelectorAll("h2, h3, p, li, ol").forEach((el) => {
      if (el.closest(".data-section")) return;
      let text = el.textContent.trim();
      if (!text) return;
      const tagName = el.tagName.toLowerCase();
      if (tagName === "h2")
        addTextSection(text, {
          size: 12,
          style: "bold",
          spaceBefore: 5,
          spaceAfter: 4,
        });
      else if (tagName === "li" || tagName === "ol")
        addTextSection(`• ${text}`, { size: 10, spaceAfter: 3 });
      else addTextSection(text, { size: 10, spaceAfter: 5 });
    });

    const horarioInfo = meuAtendimento?.horarioSessao || {};
    const formatDate = (dateString) =>
      dateString
        ? new Date(dateString + "T03:00:00").toLocaleDateString("pt-BR")
        : "A definir";
    const formatCurrency = (value) =>
      value
        ? parseFloat(
            value.replace(/[^\d,]/g, "").replace(",", ".")
          ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "A definir";

    const addDataBox = (title, data) => {
      addTextSection(title, { size: 11, style: "bold", spaceBefore: 8 });
      const boxStartY = cursorY;
      data.forEach(([label, value]) =>
        addTextSection(`${label} ${value}`, { size: 10, spaceAfter: 2 })
      );
      doc.rect(
        margin - 2,
        boxStartY - 4,
        usableWidth + 4,
        cursorY - boxStartY,
        "S"
      );
      cursorY += 5;
    };

    addDataBox("Dados do Terapeuta e Paciente", [
      ["Terapeuta:", meuAtendimento?.profissionalNome || "A definir"],
      [
        "Nome completo do PACIENTE:",
        pacienteData.nomeCompleto || "Não informado",
      ],
      [
        "Nome do Responsável:",
        pacienteData.responsavel?.nome || "Não aplicável",
      ],
      [
        "Data de nascimento do PACIENTE:",
        formatDate(pacienteData.dataNascimento),
      ],
      [
        "Valor da contribuição mensal:",
        formatCurrency(pacienteData.valorContribuicao),
      ],
    ]);

    addDataBox("Dados da Sessão", [
      ["Dia da sessão:", horarioInfo.diaSemana || "A definir"],
      ["Horário do atendimento:", horarioInfo.horario || "A definir"],
      ["Tipo de atendimento:", horarioInfo.tipoAtendimento || "A definir"],
    ]);

    if (
      pacienteData.contratoAssinado &&
      pacienteData.contratoAssinado.assinadoEm
    ) {
      const assinatura = pacienteData.contratoAssinado;
      const dataAssinatura = assinatura.assinadoEm.toDate();
      const textoAssinatura = `Assinado digitalmente por ${
        assinatura.nomeSignatario
      } (CPF: ${
        assinatura.cpfSignatario
      }) em ${dataAssinatura.toLocaleDateString(
        "pt-BR"
      )} às ${dataAssinatura.toLocaleTimeString("pt-BR")}.`;
      const pageCount = doc.internal.getNumberOfPages();
      doc.setPage(pageCount);
      cursorY = pageHeight - 35;
      addTextSection("Contrato Assinado", {
        size: 12,
        style: "bold",
        spaceAfter: 4,
      });
      addTextSection(textoAssinatura, { size: 10, spaceAfter: 0 });
    }

    const logoUrl = "../../../assets/img/logo-eupsico.png";
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setGState(new doc.GState({ opacity: 0.1, "stroke-opacity": 0.1 }));
        const imgWidth = 90;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgWidth) / 2;
        doc.addImage(
          logoBase64,
          "PNG",
          x,
          y,
          imgWidth,
          imgWidth,
          undefined,
          "FAST"
        );
        doc.setGState(new doc.GState({ opacity: 1, "stroke-opacity": 1 }));
      }
    }
    doc.save(`Contrato_${pacienteData.nomeCompleto.replace(/ /g, "_")}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Não foi possível gerar o PDF.");
  }
}
