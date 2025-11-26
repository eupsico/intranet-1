// Arquivo: /modulos/trilha-paciente/js/auditoria.js

import { db, collection, getDocs } from "../../../assets/js/firebase-init.js";

// Configuração dos campos obrigatórios por STATUS (Fila)
const REGRAS_VALIDACAO = {
  // Regras gerais
  _geral: ["nomeCompleto", "telefoneCelular"],

  // Regras específicas por fila
  inscricao_documentos: ["cpf", "email", "dataNascimento"],
  triagem_agendada: ["dataTriagem", "tipoTriagem"],
  encaminhar_para_plantao: ["plantaoInfo"], // Verifica se o objeto existe
  em_atendimento_plantao: ["plantaoInfo.dataPrimeiraSessao"], // O nome do profissional já vamos tentar buscar na coluna dedicada
  encaminhar_para_pb: ["atendimentosPB"],
  em_atendimento_pb: ["atendimentosPB"],
  alta: ["plantaoInfo.encerramento.dataEncerramento"],
  desistencia: ["desistenciaMotivo"],
};

/**
 * Função auxiliar para verificar valor em objeto aninhado
 */
function getValorAninhado(obj, path) {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Varre o banco de dados e gera o CSV de inconsistências e profissionais.
 */
export async function gerarRelatorioAuditoria() {
  console.log("Iniciando auditoria de dados...");

  try {
    const querySnapshot = await getDocs(collection(db, "trilhaPaciente"));

    // ADICIONADO: Colunas para os profissionais no cabeçalho
    let csvContent =
      "\uFEFFNome do Paciente;Fila (Status);Profissional Plantão;Profissional PB;Campos Faltantes\n";

    let encontrouErros = false;
    let totalAnalisados = 0;
    let totalComErro = 0;

    querySnapshot.forEach((doc) => {
      totalAnalisados++;
      const data = doc.data();
      const status = data.status || "sem_status";
      const camposFaltantes = [];

      // --- LÓGICA PARA RECUPERAR NOMES DOS PROFISSIONAIS ---

      // 1. Profissional Plantão (Tenta o campo da imagem, senão tenta dentro do objeto plantaoInfo)
      let nomeProfPlantao = data.profissionalPlantao || "";
      if (
        !nomeProfPlantao &&
        data.plantaoInfo &&
        data.plantaoInfo.profissionalNome
      ) {
        nomeProfPlantao = data.plantaoInfo.profissionalNome;
      }

      // 2. Profissional PB (Tenta o campo da imagem, senão procura um ativo no array)
      let nomeProfPB = data.profissionalPB || "";
      if (!nomeProfPB && Array.isArray(data.atendimentosPB)) {
        const atendimentoAtivo = data.atendimentosPB.find(
          (at) => at.statusAtendimento === "ativo"
        );
        if (atendimentoAtivo) {
          nomeProfPB = atendimentoAtivo.profissionalNome;
        }
      }

      // Sanitização para CSV (remove ponto e vírgula dos nomes para não quebrar colunas)
      nomeProfPlantao = nomeProfPlantao.replace(/;/g, " ");
      nomeProfPB = nomeProfPB.replace(/;/g, " ");

      // --- FIM DA LÓGICA DOS PROFISSIONAIS ---

      // 1. Verificar Campos Gerais
      REGRAS_VALIDACAO["_geral"].forEach((campo) => {
        const valor = getValorAninhado(data, campo);
        if (
          !valor ||
          valor === "" ||
          (Array.isArray(valor) && valor.length === 0)
        ) {
          camposFaltantes.push(campo);
        }
      });

      // 2. Verificar Campos Específicos do Status Atual
      if (REGRAS_VALIDACAO[status]) {
        REGRAS_VALIDACAO[status].forEach((campo) => {
          const valor = getValorAninhado(data, campo);

          if (campo === "atendimentosPB") {
            if (
              !Array.isArray(data.atendimentosPB) ||
              data.atendimentosPB.length === 0
            ) {
              camposFaltantes.push("atendimentosPB (Array Vazio)");
            }
          } else if (!valor || valor === "") {
            camposFaltantes.push(campo);
          }
        });
      }

      // Se houver campos faltantes OU se quiser listar todos (neste caso, lista apenas quem tem erro ou quem tem profissional)
      // Para ser útil, vamos listar se tiver erro.
      // Se você quiser listar TODOS os pacientes independente de erro, remova o "if (camposFaltantes.length > 0)"

      if (camposFaltantes.length > 0) {
        encontrouErros = true;
        totalComErro++;

        const nomeLimpo = (data.nomeCompleto || "SEM NOME").replace(/;/g, " ");
        const listaCampos = camposFaltantes.join(", ");

        // Adiciona a linha no CSV com as novas colunas
        csvContent += `${nomeLimpo};${status};${nomeProfPlantao};${nomeProfPB};${listaCampos}\n`;
      }
    });

    if (!encontrouErros) {
      alert(
        "Parabéns! Nenhum dado faltante encontrado em " +
          totalAnalisados +
          " pacientes."
      );
      return;
    }

    // 4. Download do Arquivo
    downloadCSV(
      csvContent,
      `auditoria_pacientes_${new Date().toISOString().slice(0, 10)}.csv`
    );
    console.log(`Auditoria concluída. ${totalComErro} pacientes listados.`);
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    alert("Erro ao gerar relatório. Verifique o console.");
  }
}

function downloadCSV(content, fileName) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
