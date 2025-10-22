// Arquivo: /modulos/voluntario/js/meus-pacientes/actions.js
// --- VERSÃO CORRIGIDA (Opção 1: Alinhamento à Esquerda e Margens Simétricas) ---

// (A função handleEnviarContrato foi removida daqui em versões anteriores)

export async function gerarPdfContrato(pacienteData, meuAtendimento) {
  try {
    // Verifica se jsPDF está carregado
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("Biblioteca jsPDF não carregada.");
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 20; // Mantido em 20
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- INÍCIO DA CORREÇÃO 1 (Margens Simétricas) ---
    // Removemos o buffer de -10 para que a largura útil use apenas as margens.
    // (210mm - 40mm de margem = 170mm de largura útil)
    const usableWidth = pageWidth - margin * 2;
    // --- FIM DA CORREÇÃO 1 ---

    let cursorY = 15; // Início do conteúdo abaixo do topo

    // Função interna para carregar imagem como Base64
    const loadImageAsBase64 = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Erro ao buscar imagem: ${response.statusText}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error(`Falha ao carregar imagem ${url}:`, error);
        return null; // Retorna null se falhar
      }
    };

    // Título Centralizado
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      "CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS",
      pageWidth / 2,
      cursorY + 15, // Ajusta posição inicial do título
      { align: "center" }
    );
    cursorY += 35; // Aumenta espaço após título

    // Função interna para adicionar texto com quebra de linha e página
    const addTextSection = (text, options = {}) => {
      const {
        size = 10,
        style = "normal",
        spaceBefore = 0,
        spaceAfter = 5, // Espaço padrão após parágrafos
        // --- INÍCIO DA CORREÇÃO 2 (Bug do Justify) ---
        // Alterado de "justify" para "left" para evitar o estouro da margem.
        align = "left",
        // --- FIM DA CORREÇÃO 2 ---
        isListItem = false,
      } = options;

      cursorY += spaceBefore;
      doc.setFontSize(size);
      doc.setFont("helvetica", style);

      // Remove espaços extras e normaliza quebras de linha
      const cleanText = text.replace(/\s+/g, " ").trim();
      if (!cleanText) return; // Pula se estiver vazio após limpar

      let textMargin = margin;
      let currentUsableWidth = usableWidth; // Agora é 170mm

      if (isListItem) {
        const indent = 4; // Espaço da indentação
        textMargin = margin + indent; // 24
        currentUsableWidth = usableWidth - indent; // 166
      }

      const lines = doc.splitTextToSize(cleanText, currentUsableWidth);
      const textHeight = doc.getTextDimensions(lines).h;

      // Verifica se precisa adicionar nova página ANTES de adicionar o texto
      if (cursorY + textHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin + 10; // Adiciona margem superior na nova página
      }

      // (Mantém a correção anterior de forçar o maxWidth)
      const textOptions = {
        align: align,
        maxWidth: currentUsableWidth, // Força a largura máxima na renderização
      };

      // Adiciona marcador para itens de lista
      if (isListItem) {
        doc.text("•", margin, cursorY); // Marcador (na margem principal)
        doc.text(lines, textMargin, cursorY, textOptions); // Texto (na margem indentada)
      } else {
        doc.text(lines, textMargin, cursorY, textOptions); // Texto normal (textMargin = margin)
      }

      cursorY += textHeight + spaceAfter;
    };

    // Carrega o conteúdo HTML do contrato
    // Certifique-se que o caminho está correto a partir da RAIZ do site onde o script é executado
    const contratoHtmlUrl = "../../../public/contrato-terapeutico.html"; // Ajuste se necessário
    let htmlString = "";
    try {
      const response = await fetch(contratoHtmlUrl);
      if (!response.ok)
        throw new Error(`Não foi possível carregar ${contratoHtmlUrl}`);
      htmlString = await response.text();
    } catch (fetchError) {
      console.error("Erro ao buscar HTML do contrato:", fetchError);
      alert("Erro ao carregar o modelo do contrato. Verifique o console.");
      return; // Interrompe a geração
    }

    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlString, "text/html");
    const contractContent = htmlDoc.getElementById("contract-content");

    if (!contractContent) {
      alert(
        "Erro: Conteúdo do contrato (ID: contract-content) não encontrado no HTML."
      );
      return;
    }

    // Processa os elementos HTML para adicionar ao PDF
    contractContent
      .querySelectorAll("h2, h3, p, li, ol > li, ul > li")
      .forEach((el) => {
        // Ignora a seção de dados que será adicionada depois
        if (el.closest(".data-section")) return;

        let text = el.textContent; // Pega texto bruto
        if (!text) return; // Pula elementos sem texto

        const tagName = el.tagName.toLowerCase();

        // Tratamento específico por tag
        if (tagName === "h2") {
          addTextSection(text, {
            size: 12,
            style: "bold",
            spaceBefore: 6,
            spaceAfter: 4,
            align: "left",
          });
        } else if (tagName === "h3") {
          addTextSection(text, {
            size: 11,
            style: "bold",
            spaceBefore: 5,
            spaceAfter: 3,
            align: "left",
          });
        } else if (tagName === "li") {
          // Verifica se o pai é <ol> para numeração (simplificado aqui como bullet)
          addTextSection(text, { size: 10, spaceAfter: 2, isListItem: true });
        } else if (tagName === "p") {
          // Parágrafos agora usarão o alinhamento padrão (left) definido na função
          addTextSection(text, { size: 10, spaceAfter: 5 });
        }
        // Ignora tags não mapeadas (como <ul>, <ol> em si)
      });

    // --- FUNÇÃO formatCurrency CORRIGIDA ---
    const formatCurrency = (value) => {
      // 1. Checa null/undefined/string vazia
      if (value == null || value === "") {
        return "A definir";
      }
      // 2. Converte para string PRIMEIRO
      const stringValue = String(value);
      try {
        // 3. Tenta limpar e converter (agora stringValue é garantido ser string)
        const numericString = stringValue
          .replace(/[^\d,]/g, "")
          .replace(",", ".");
        const numberValue = parseFloat(numericString);
        // 4. Checa se o resultado é um número válido
        if (isNaN(numberValue)) {
          console.warn(
            "formatCurrency: Valor não pôde ser convertido para número:",
            value
          );
          return "Valor inválido";
        }
        // 5. Formata como moeda
        return numberValue.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      } catch (e) {
        console.error("Erro formatando moeda:", e, "Valor original:", value);
        return "Erro na formatação"; // Retorna algo indicando erro
      }
    };
    // --- FIM DA CORREÇÃO ---

    // Função auxiliar para formatar datas (DD/MM/AAAA)
    const formatDate = (dateString) => {
      if (!dateString) return "A definir";
      try {
        // Adiciona T03:00:00 para tentar evitar problemas de fuso ao converter só a data
        return new Date(dateString + "T03:00:00").toLocaleDateString("pt-BR");
      } catch (e) {
        console.error("Erro ao formatar data:", dateString, e);
        return "Data inválida";
      }
    };

    // Adiciona caixa de dados formatada
    const addDataBox = (title, data) => {
      addTextSection(title, {
        size: 11,
        style: "bold",
        spaceBefore: 8,
        align: "left",
      });
      const boxStartY = cursorY; // Posição Y antes de adicionar os dados
      data.forEach(([label, value]) =>
        // Adiciona label e valor, tratando valores nulos/undefined
        addTextSection(`${label} ${value ?? "N/A"}`, {
          size: 10,
          spaceAfter: 2,
          align: "left",
        })
      );
      // Desenha o retângulo em volta dos dados adicionados
      // A altura é calculada pela diferença entre a posição atual e a inicial
      doc.setDrawColor(180, 180, 180); // Cor cinza claro para a borda

      // --- INÍCIO DA CORREÇÃO (Largura da Caixa) ---
      // A largura da caixa deve ser a nova usableWidth (170) + 4mm de padding (2mm de cada lado)
      doc.rect(
        margin - 2,
        boxStartY - 4,
        usableWidth + 4, // Corrigido: 170 + 4 = 174mm
        cursorY - boxStartY,
        "S"
      );
      // --- FIM DA CORREÇÃO ---

      cursorY += 5; // Espaço após a caixa
    };

    // Prepara os dados para as caixas
    const horarioInfo = meuAtendimento?.horarioSessao || {};

    // Caixa de Dados: Terapeuta e Paciente
    addDataBox("Dados do Terapeuta e Paciente", [
      ["Terapeuta:", meuAtendimento?.profissionalNome], // Usa ?? 'N/A' dentro de addDataBox
      ["Nome completo do PACIENTE:", pacienteData.nomeCompleto],
      ["Nome do Responsável:", pacienteData.responsavel?.nome], // Será N/A se não houver responsável
      [
        "Data de nascimento do PACIENTE:",
        formatDate(pacienteData.dataNascimento),
      ],
      [
        "Valor da contribuição mensal:",
        formatCurrency(pacienteData.valorContribuicao),
      ], // Chama a função corrigida
    ]);

    // Caixa de Dados: Sessão
    addDataBox("Dados da Sessão", [
      ["Dia da sessão:", horarioInfo.diaSemana],
      ["Horário do atendimento:", horarioInfo.horario],
      ["Tipo de atendimento:", horarioInfo.tipoAtendimento],
      // Adicione a frequência se existir:
      // ["Frequência:", horarioInfo.frequencia || "Semanal (Padrão)"],
    ]);

    // Adiciona informações de assinatura digital se existirem
    // Assume que a assinatura está no objeto 'meuAtendimento' se for PB
    const assinatura = meuAtendimento?.contratoAssinado;
    if (assinatura && assinatura.assinadoEm?.toDate) {
      // Verifica se tem timestamp válido
      const dataAssinatura = assinatura.assinadoEm.toDate();
      const textoAssinatura = `Assinado digitalmente por ${
        assinatura.nomeSignatario || "N/I"
      } (CPF: ${
        assinatura.cpfSignatario || "N/I"
      }) em ${dataAssinatura.toLocaleDateString(
        "pt-BR"
      )} às ${dataAssinatura.toLocaleTimeString("pt-BR")}.`;

      // Verifica se há espaço suficiente na última página, senão adiciona nova
      const assinaturaHeight =
        doc.getTextDimensions(textoAssinatura, { maxWidth: usableWidth }).h +
        15; // Altura estimada
      if (cursorY + assinaturaHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin + 10;
      } else {
        cursorY = pageHeight - 35; // Posiciona perto do rodapé
      }

      addTextSection("Contrato Assinado", {
        size: 12,
        style: "bold",
        spaceAfter: 4,
        align: "left",
      });
      addTextSection(textoAssinatura, {
        size: 9,
        spaceAfter: 0,
        align: "left",
      }); // Fonte menor
    }

    // Adiciona marca d'água (logo) em todas as páginas
    const logoUrl = "../../../assets/img/logo-eupsico.png"; // Ajuste o caminho se necessário
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setGState(new doc.GState({ opacity: 0.1 })); // Define opacidade
        const imgWidth = 90; // Tamanho da logo
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
        doc.setGState(new doc.GState({ opacity: 1 })); // Restaura opacidade
      }
    }

    // Salva o PDF
    doc.save(
      `Contrato_${(pacienteData.nomeCompleto || "Paciente").replace(
        / /g,
        "_"
      )}.pdf`
    );
  } catch (error) {
    console.error("Erro ao gerar PDF do contrato:", error);
    alert(
      "Não foi possível gerar o PDF. Verifique o console para mais detalhes."
    );
  }
}
