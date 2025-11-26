// Arquivo: /modulos/trilha-paciente/js/auditoria.js

import { db, collection, getDocs } from "../../../assets/js/firebase-init.js";

// Configuração dos campos obrigatórios por STATUS (Fila)
// Formato: "status": ["campo1", "objeto.campoAninhado"]
const REGRAS_VALIDACAO = {
  // Regras gerais (aplicam-se a todos se desejar, ou defina no loop)
  _geral: ["nomeCompleto", "telefoneCelular"],

  // Regras específicas por fila
  inscricao_documentos: ["cpf", "email", "dataNascimento"],

  triagem_agendada: ["dataTriagem", "tipoTriagem"],

  encaminhar_para_plantao: ["plantaoInfo", "plantaoInfo.profissionalNome"],

  em_atendimento_plantao: [
    "plantaoInfo.dataPrimeiraSessao",
    "plantaoInfo.profissionalId",
  ],

  encaminhar_para_pb: ["atendimentosPB"], // Deve ter array de atendimentos

  em_atendimento_pb: ["atendimentosPB"],

  alta: ["plantaoInfo.encerramento.dataEncerramento"],

  desistencia: ["desistenciaMotivo"],
};

/**
 * Função auxiliar para verificar valor em objeto aninhado (ex: "plantaoInfo.nome")
 */
function getValorAninhado(obj, path) {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Varre o banco de dados e gera o CSV de inconsistências.
 */
export async function gerarRelatorioAuditoria() {
  console.log("Iniciando auditoria de dados...");

  try {
    const querySnapshot = await getDocs(collection(db, "trilhaPaciente"));
    let csvContent = "\uFEFFNome do Paciente;Fila (Status);Campos Faltantes\n"; // \uFEFF para UTF-8 no Excel
    let encontrouErros = false;
    let totalAnalisados = 0;
    let totalComErro = 0;

    querySnapshot.forEach((doc) => {
      totalAnalisados++;
      const data = doc.data();
      const status = data.status || "sem_status";
      const camposFaltantes = [];

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

          // Validação especial para array de PB
          if (campo === "atendimentosPB") {
            if (
              !Array.isArray(data.atendimentosPB) ||
              data.atendimentosPB.length === 0
            ) {
              camposFaltantes.push("atendimentosPB (Array Vazio)");
            }
          }
          // Validação padrão
          else if (!valor || valor === "") {
            camposFaltantes.push(campo);
          }
        });
      }

      // 3. Se houver campos faltantes, adiciona ao CSV
      if (camposFaltantes.length > 0) {
        encontrouErros = true;
        totalComErro++;
        // Sanitiza o nome para remover ponto e vírgula que quebra o CSV
        const nomeLimpo = (data.nomeCompleto || "SEM NOME").replace(/;/g, " ");
        const listaCampos = camposFaltantes.join(", ");

        csvContent += `${nomeLimpo};${status};${listaCampos}\n`;
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
    console.log(
      `Auditoria concluída. ${totalComErro} pacientes com dados faltantes.`
    );
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
