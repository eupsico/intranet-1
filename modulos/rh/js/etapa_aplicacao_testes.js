// modulos/rh/js/etapa_aplicacao_testes.js

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicialização e Referências
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error(
      "ERRO: O SDK do Firebase não está carregado ou configurado corretamente."
    );
    alert(
      "Erro de inicialização: O sistema de banco de dados não está disponível."
    );
    return;
  }

  const db = firebase.firestore();
  const urlParams = new URLSearchParams(window.location.search);
  const candidaturaId = urlParams.get("candidatura");
  const vagaId = urlParams.get("vaga");

  // Referências do DOM
  const alertaStatus = document.getElementById("alerta-status-teste");
  const selectTipoAvaliacao = document.getElementById("tipo-avaliacao");
  const containerSelecaoModelo = document.getElementById(
    "container-selecao-modelo"
  );
  const selectModeloAvaliacao = document.getElementById("modelo-avaliacao");
  const linkAvaliacaoPublico = document.getElementById(
    "link-avaliacao-publico"
  );
  const btnCopiarLink = document.getElementById("btn-copiar-link-envio");
  const btnEnviarWhatsApp = document.getElementById("btn-enviar-whatsapp");
  const formRegistroResultado = document.getElementById(
    "form-registro-resultado"
  );
  const btnFinalizarEtapa = document.getElementById("btn-finalizar-etapa");

  let dadosCandidatura = null;
  let linkModeloBase = null; // Armazena a URL base para o formulário público (ex: https://eupsico.com/avaliacao-publica.html)

  // Navegação de retorno
  document.getElementById("btn-voltar-recrutamento").onclick = () => {
    window.location.href = `recrutamento.html${
      vagaId ? "?vaga=" + vagaId + "&etapa=entrevistas" : ""
    }`;
  };

  if (!candidaturaId) {
    mostrarAlerta(
      "ID da Candidatura não fornecido na URL. Não é possível prosseguir.",
      "danger"
    );
    return;
  }

  // 2. Funções de UI
  function mostrarAlerta(mensagem, tipo = "info") {
    alertaStatus.innerHTML = `<div class="alert alert-${tipo}" role="alert">${mensagem}</div>`;
  }

  function limparLink() {
    linkAvaliacaoPublico.value = "";
    btnEnviarWhatsApp.disabled = true;
  }

  // 3. Carregamento Inicial de Dados
  async function carregarDadosIniciais() {
    try {
      // Carregar dados da Candidatura
      const docCandidatura = await db
        .collection("candidaturas")
        .doc(candidaturaId)
        .get();
      if (!docCandidatura.exists) {
        mostrarAlerta("Candidatura não encontrada.", "danger");
        return;
      }
      dadosCandidatura = docCandidatura.data();

      document.getElementById("nome-candidato-teste").textContent =
        dadosCandidatura.nome_completo || "Candidato(a)";

      // 3.1. Preencher campos de resultado se já existirem dados
      if (dadosCandidatura.testes_estudos) {
        const testes = dadosCandidatura.testes_estudos;
        document.getElementById("resultado-recebido").value =
          testes.status_resultado || "";
        document.getElementById("link-resultado-candidato").value =
          testes.link_resultado_candidato || "";
        document.getElementById("nota-analise").value =
          testes.nota_analise || "";
        mostrarAlerta(
          `Etapa de testes já avaliada em ${formatarTimestamp(
            testes.data_analise
          )}. Status: ${testes.status_resultado}`,
          "info"
        );
      } else {
        mostrarAlerta(
          "Etapa de Testes pendente de envio ou registro de resultado.",
          "warning"
        );
      }

      // 3.2. Carregar Modelos de Avaliação (Estudos de Caso, Testes)
      await carregarModelosAvaliacao();
    } catch (error) {
      console.error("Erro ao carregar dados da candidatura:", error);
      mostrarAlerta(`Erro ao carregar dados: ${error.message}`, "danger");
    }
  }

  // 4. Carregamento dos Modelos de Avaliação
  async function carregarModelosAvaliacao() {
    selectModeloAvaliacao.innerHTML =
      '<option value="">Carregando Modelos...</option>';
    try {
      const q = db
        .collection("estudos_de_caso")
        .where("ativo", "==", true)
        .orderBy("titulo", "asc");
      const snapshot = await q.get();

      let htmlOptions =
        '<option value="" disabled selected>Selecione um Modelo de Conteúdo</option>';

      if (snapshot.empty) {
        htmlOptions =
          '<option value="" disabled>Nenhum modelo ativo encontrado.</option>';
      } else {
        snapshot.forEach((doc) => {
          const modelo = doc.data();
          htmlOptions += `<option value="${doc.id}" data-tipo="${
            modelo.tipo
          }">${modelo.titulo} [${modelo.tipo.toUpperCase()}]</option>`;
        });
      }
      selectModeloAvaliacao.innerHTML = htmlOptions;

      // Tenta obter o link base para geração do link público
      // Assumindo que este link base é armazenado em algum lugar de configuração
      // Ou é um caminho conhecido do front-end público (Public/avaliacao-publica.html)
      linkModeloBase = `${window.location.origin.replace(
        "intranet",
        "public"
      )}/avaliacao-publica.html`;
    } catch (error) {
      console.error("Erro ao carregar modelos de avaliação:", error);
      selectModeloAvaliacao.innerHTML =
        '<option value="" disabled>Erro ao carregar modelos.</option>';
    }
  }

  // 5. Lógica de Geração e Envio de Link
  selectModeloAvaliacao.addEventListener("change", () => {
    const selectedOption =
      selectModeloAvaliacao.options[selectModeloAvaliacao.selectedIndex];
    const modeloId = selectedOption.value;
    const modeloTipo = selectedOption.getAttribute("data-tipo");

    if (modeloId && linkModeloBase) {
      const link = `${linkModeloBase}?tipo=${modeloTipo}&id=${modeloId}&candidato=${candidaturaId}`;
      linkAvaliacaoPublico.value = link;
      btnEnviarWhatsApp.disabled = false;
    } else {
      limparLink();
    }
  });

  selectTipoAvaliacao.addEventListener("change", () => {
    if (selectTipoAvaliacao.value) {
      containerSelecaoModelo.style.display = "block";
      selectModeloAvaliacao.value = "";
    } else {
      containerSelecaoModelo.style.display = "none";
      limparLink();
    }
  });

  btnCopiarLink.addEventListener("click", () => {
    linkAvaliacaoPublico.select();
    document.execCommand("copy");
    alert("Link copiado!");
  });

  btnEnviarWhatsApp.addEventListener("click", () => {
    const link = linkAvaliacaoPublico.value;
    const nomeCandidato = dadosCandidatura.nome_completo || "Candidato(a)";
    const telefone = dadosCandidatura.telefone_contato || "00000000000"; // Assume o telefone no formato com DDD

    if (!link) {
      alert("Gere o link de avaliação primeiro.");
      return;
    }

    // Mensagem padrão para o WhatsApp
    const mensagem = `Olá, ${nomeCandidato}! Chegamos à etapa de Testes/Estudos de Caso para a vaga. 
        Por favor, acesse o link abaixo para realizar a avaliação:
        ${link}
        (Lembre-se de seguir as instruções que enviamos por e-mail.)`;

    // Formato: https://wa.me/<numero>?text=<texto codificado>
    const whatsappUrl = `https://wa.me/${telefone.replace(
      /\D/g,
      ""
    )}?text=${encodeURIComponent(mensagem)}`;

    // Abre o link do WhatsApp em uma nova aba
    window.open(whatsappUrl, "_blank");

    // Opcional: Atualiza o status da candidatura para indicar que a avaliação foi enviada
    // updateStatusEnvio('Avaliação Enviada (Aguardando Resposta)');
  });

  // 6. Lógica de Registro de Resultado
  async function registrarResultado(e) {
    e.preventDefault();

    const statusResultado = document.getElementById("resultado-recebido").value;
    const linkResultado = document
      .getElementById("link-resultado-candidato")
      .value.trim();
    const notaAnalise = document.getElementById("nota-analise").value;

    if (statusResultado === "aprovado" || statusResultado === "reprovado") {
      if (!notaAnalise) {
        alert(
          "O campo de Análise/Comentários é obrigatório ao aprovar ou reprovar o candidato."
        );
        return;
      }
    }

    btnFinalizarEtapa.disabled = true;
    btnFinalizarEtapa.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

    // 6.1. Construção dos dados de avaliação
    const dadosTestes = {
      status_resultado: statusResultado,
      link_resultado_candidato: linkResultado,
      nota_analise: notaAnalise,
      data_analise: firebase.firestore.FieldValue.serverTimestamp(),
      analisado_por_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
    };

    // 6.2. Determinar o novo status no banco de dados para a candidatura
    let novoStatusCandidato = "Testes Pendente"; // Padrão
    let proximaEtapaUrl = "entrevistas";

    if (statusResultado === "aprovado") {
      novoStatusCandidato = "Testes Aprovado (Entrevista Gestor Pendente)";
      proximaEtapaUrl = "gestor"; // Próxima etapa: Entrevista com Gestor
    } else if (statusResultado === "reprovado") {
      novoStatusCandidato = "Rejeitado (Comunicação Pendente)";
      proximaEtapaUrl = "finalizados"; // Rejeitado: Envia para comunicação final
    } else if (statusResultado === "recebido-em-analise") {
      novoStatusCandidato = "Testes Recebido (Em Análise)";
    }

    // 6.3. Atualização no Firebase
    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      const updateData = {
        status_recrutamento: novoStatusCandidato,
        testes_estudos: dadosTestes,
      };

      // Adicionar a rejeição se reprovado
      if (statusResultado === "reprovado") {
        updateData.rejeicao = {
          etapa: "Testes/Estudos de Caso",
          justificativa: `Reprovado nos Testes/Estudos de Caso. Análise RH: ${dadosTestes.nota_analise}`,
          data: dadosTestes.data_analise,
        };
      }

      await candidaturaRef.update(updateData);

      alert(
        "Resultado de Testes/Estudos de Caso registrado com sucesso! O status do candidato foi atualizado."
      );

      // Redirecionar para o painel principal na aba da próxima etapa
      window.location.href = `recrutamento.html?vaga=${vagaId}&etapa=${proximaEtapaUrl}`;
    } catch (error) {
      console.error("Erro ao registrar resultado de testes:", error);
      mostrarAlerta(
        `Erro ao registrar o resultado: ${error.message}`,
        "danger"
      );

      btnFinalizarEtapa.disabled = false;
      btnFinalizarEtapa.innerHTML =
        '<i class="fas fa-check-circle me-2"></i> Salvar e Mudar Status';
    }
  }

  // 7. Inicialização
  carregarDadosIniciais();
  formRegistroResultado.addEventListener("submit", registrarResultado);
});

// Função de utilidade
function formatarTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate
    ? timestamp.toDate()
    : typeof timestamp.seconds === "number"
    ? new Date(timestamp.seconds * 1000)
    : new Date(timestamp);
  return date.toLocaleDateString("pt-BR");
}
