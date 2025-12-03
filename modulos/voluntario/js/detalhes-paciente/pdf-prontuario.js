// Arquivo: /modulos/voluntario/js/detalhes-paciente/pdf-prontuario.js
// Lógica para gerar o PDF do prontuário do paciente.

export async function gerarProntuarioPDF(
  paciente,
  sessoes,
  profissional,
  itensSelecionados
) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Biblioteca jsPDF não carregada.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Configurações de layout
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // --- Funções Auxiliares ---

  // Adiciona Texto com quebra de linha e página
  const addText = (
    text,
    fontSize = 10,
    style = "normal",
    color = "#000000"
  ) => {
    if (!text) return;

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", style);
    doc.setTextColor(color);

    const lines = doc.splitTextToSize(String(text), contentWidth);
    const textHeight = doc.getTextDimensions(lines).h;

    if (cursorY + textHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.text(lines, margin, cursorY);
    cursorY += textHeight + 2; // Espaçamento
  };

  // Adiciona Título de Seção
  const addSectionTitle = (title) => {
    cursorY += 5; // Espaço antes
    if (cursorY > pageHeight - margin - 10) {
      doc.addPage();
      cursorY = margin;
    }

    // Fundo cinza para o título
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, cursorY - 4, contentWidth, 8, "F");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#333333");
    doc.text(title.toUpperCase(), margin + 2, cursorY + 1.5);
    cursorY += 10;
  };

  // Adiciona Linha de Campo: Valor
  const addField = (label, value) => {
    const cleanValue = value ? String(value).trim() : "Não informado";
    const line = `${label}: ${cleanValue}`;

    // Verifica quebra de página
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(line, contentWidth);
    const height = doc.getTextDimensions(lines).h;

    if (cursorY + height > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    // Negrito para o label
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin, cursorY);

    const labelWidth = doc.getTextWidth(label + ": ");
    doc.setFont("helvetica", "normal");

    // Se o valor for longo, imprime na linha de baixo ou continua
    if (labelWidth + doc.getTextWidth(cleanValue) > contentWidth) {
      doc.text(cleanValue, margin, cursorY + 5, { maxWidth: contentWidth });
      cursorY +=
        doc.getTextDimensions(doc.splitTextToSize(cleanValue, contentWidth)).h +
        7;
    } else {
      doc.text(cleanValue, margin + labelWidth, cursorY);
      cursorY += 5;
    }
  };

  // Função para carregar imagem (Logo)
  const loadImage = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Logo não carregada");
      return null;
    }
  };

  // --- Construção do Documento ---

  // 1. Cabeçalho
  const logoUrl = "../../../assets/img/logo-eupsico.png"; // Ajuste o caminho se necessário
  const logoData = await loadImage(logoUrl);
  if (logoData) {
    doc.addImage(logoData, "PNG", margin, margin - 5, 30, 30);
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PRONTUÁRIO PSICOLÓGICO", pageWidth / 2, margin + 10, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString(
      "pt-BR"
    )} às ${new Date().toLocaleTimeString("pt-BR")}`,
    pageWidth / 2,
    margin + 18,
    { align: "center" }
  );

  doc.text(
    `Profissional Responsável: ${profissional?.nome || "N/A"}`,
    pageWidth / 2,
    margin + 24,
    { align: "center" }
  );

  cursorY = margin + 40;

  // 2. Informações Pessoais
  if (itensSelecionados.includes("info_pessoais")) {
    addSectionTitle("Informações do Paciente");
    addField("Nome", paciente.nomeCompleto);
    addField("CPF", paciente.cpf);
    addField(
      "Data de Nascimento",
      paciente.dataNascimento
        ? new Date(paciente.dataNascimento + "T00:00:00").toLocaleDateString(
            "pt-BR"
          )
        : ""
    );
    addField("Telefone", paciente.telefoneCelular);
    addField("E-mail", paciente.email);

    if (paciente.endereco) {
      const end = paciente.endereco;
      const endStr = `${end.logradouro || ""}, ${end.numero || ""} - ${
        end.bairro || ""
      }, ${end.cidade || ""}/${end.estado || ""}`;
      addField("Endereço", endStr);
    }
    if (paciente.responsavel?.nome) {
      addField(
        "Responsável",
        `${paciente.responsavel.nome} (${
          paciente.responsavel.parentesco || ""
        })`
      );
    }
  }

  // 3. Informações Financeiras
  if (itensSelecionados.includes("info_financeiras")) {
    addSectionTitle("Informações Financeiras");
    const valor =
      typeof paciente.valorContribuicao === "number"
        ? paciente.valorContribuicao.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : paciente.valorContribuicao;
    addField("Valor da Contribuição", valor);
  }

  // 4. Acompanhamento Clínico
  const ac = paciente.acompanhamentoClinico || {};
  if (
    itensSelecionados.some((i) =>
      [
        "ac_demanda",
        "ac_objetivos",
        "ac_diagnostico",
        "ac_encerramento",
      ].includes(i)
    )
  ) {
    addSectionTitle("Dados Clínicos");

    if (itensSelecionados.includes("ac_demanda")) {
      addText("Avaliação da Demanda:", 10, "bold");
      addText(ac.avaliacaoDemanda || "Não preenchido.", 10, "normal");
      cursorY += 3;
    }
    if (itensSelecionados.includes("ac_objetivos")) {
      addText("Objetivos do Tratamento:", 10, "bold");
      addText(ac.definicaoObjetivos || "Não preenchido.", 10, "normal");
      cursorY += 3;
    }
    if (itensSelecionados.includes("ac_diagnostico")) {
      addText("Diagnóstico:", 10, "bold");
      addText(ac.diagnostico || "Não preenchido.", 10, "normal");
      cursorY += 3;
    }
    if (itensSelecionados.includes("ac_encerramento")) {
      addText("Registro de Encerramento:", 10, "bold");
      addText(ac.registroEncerramento || "Não preenchido.", 10, "normal");
      cursorY += 3;
    }
  }

  // 5. Lista de Sessões (Tabela Simples)
  if (itensSelecionados.includes("sessoes_lista")) {
    addSectionTitle("Histórico de Sessões");

    // Cabeçalho da Tabela
    const col1 = margin;
    const col2 = margin + 40;
    const col3 = margin + 100;

    doc.setFont("helvetica", "bold");
    doc.text("Data", col1, cursorY);
    doc.text("Horário", col2, cursorY);
    doc.text("Status", col3, cursorY);
    cursorY += 5;
    doc.line(margin, cursorY - 1, pageWidth - margin, cursorY - 1); // Linha
    cursorY += 3;

    sessoes.forEach((sessao) => {
      let dataStr = "Data Inválida";
      let horaStr = "";

      if (sessao.dataHora?.toDate) {
        const d = sessao.dataHora.toDate();
        dataStr = d.toLocaleDateString("pt-BR");
        horaStr = d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (sessao.data) {
        try {
          const d = new Date(
            sessao.data + "T" + (sessao.horaInicio || "00:00")
          );
          dataStr = d.toLocaleDateString("pt-BR");
          horaStr = sessao.horaInicio;
        } catch (e) {}
      }

      let status = sessao.status || "Pendente";
      // Formata status
      if (status === "presente") status = "Presente";
      if (status === "ausente") status = "Ausente";
      if (status === "cancelada_prof") status = "Canc. Profissional";
      if (status === "cancelada_paciente") status = "Canc. Paciente";

      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }

      doc.setFont("helvetica", "normal");
      doc.text(dataStr, col1, cursorY);
      doc.text(horaStr, col2, cursorY);
      doc.text(status, col3, cursorY);
      cursorY += 6;
    });
    cursorY += 5;
  }

  // 6. Detalhamento das Sessões (Evolução e Campos)
  const itensEvolucao = [
    "sessoes_evolucao",
    "sessoes_compartilhado_prof",
    "sessoes_compartilhado_admin",
  ];
  if (itensSelecionados.some((i) => itensEvolucao.includes(i))) {
    addSectionTitle("Evolução e Anotações");

    sessoes.forEach((sessao, index) => {
      // Verifica se a sessão tem alguma anotação relevante para os itens selecionados
      const temEvolucao =
        itensSelecionados.includes("sessoes_evolucao") &&
        sessao.anotacoes?.fichaEvolucao;
      const temCompProf =
        itensSelecionados.includes("sessoes_compartilhado_prof") &&
        sessao.anotacoes?.compartilhadoProf;
      const temCompAdmin =
        itensSelecionados.includes("sessoes_compartilhado_admin") &&
        sessao.anotacoes?.compartilhadoAdmin;

      if (temEvolucao || temCompProf || temCompAdmin) {
        // Data da Sessão como subtítulo
        let dataStr = "";
        if (sessao.dataHora?.toDate) {
          dataStr = sessao.dataHora.toDate().toLocaleDateString("pt-BR");
        } else {
          dataStr = sessao.data
            ? new Date(sessao.data + "T00:00:00").toLocaleDateString("pt-BR")
            : "Data N/D";
        }

        // Verifica quebra antes do bloco da sessão
        if (cursorY + 30 > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }

        doc.setFillColor(230, 230, 250); // Lilás claro
        doc.rect(margin, cursorY - 4, contentWidth, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(
          `Sessão: ${dataStr} (${sessao.status || "Pendente"})`,
          margin + 2,
          cursorY
        );
        cursorY += 6;

        if (temEvolucao) {
          addText("Ficha de Evolução:", 9, "bold", "#0056b3");
          addText(sessao.anotacoes.fichaEvolucao, 9, "normal");
          cursorY += 2;
        }
        if (temCompProf) {
          addText("Compartilhado (Profissionais):", 9, "bold", "#d35400");
          addText(sessao.anotacoes.compartilhadoProf, 9, "normal");
          cursorY += 2;
        }
        if (temCompAdmin) {
          addText("Compartilhado (Admin):", 9, "bold", "#2c3e50");
          addText(sessao.anotacoes.compartilhadoAdmin, 9, "normal");
          cursorY += 2;
        }
        cursorY += 4; // Espaço entre sessões
        doc.setDrawColor(200);
        doc.line(margin, cursorY, pageWidth - margin, cursorY); // Linha separadora
        cursorY += 6;
      }
    });
  }

  // Salvar
  const nomeArquivo = `Prontuario_${paciente.nomeCompleto.replace(/ /g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;
  doc.save(nomeArquivo);
}
