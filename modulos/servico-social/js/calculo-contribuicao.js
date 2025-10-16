// Arquivo: /modulos/servico-social/js/calculo-contribuicao.js
// Versão: 3.2 (Corrigida a formatação da exibição das faixas)

import { db, doc, getDoc } from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const rendaInput = document.getElementById("renda-input");
  const tableContainer = document.getElementById("tabela-calculo-container");
  if (!rendaInput || !tableContainer) return;

  let faixasDeContribuicao = [];
  let percentualFamiliar = 1.4;

  async function carregarFaixas() {
    tableContainer.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        const configs = docSnap.data();
        faixasDeContribuicao = configs.financeiro?.faixasContribuicao || [];

        const adicionalFamilia = parseFloat(
          configs.financeiro?.percentualAdicionalFamilia
        );
        if (!isNaN(adicionalFamilia) && adicionalFamilia > 0) {
          percentualFamiliar = 1 + adicionalFamilia / 100;
        }

        if (faixasDeContribuicao.length > 0) {
          construirTabela();
          atualizarResultados();
        } else {
          tableContainer.innerHTML =
            '<p class="alert alert-warning">Nenhuma faixa de contribuição configurada no sistema.</p>';
        }
      } else {
        tableContainer.innerHTML =
          '<p class="alert alert-warning">Faixas de contribuição não encontradas nas configurações.</p>';
      }
    } catch (error) {
      console.error("Erro ao carregar faixas de contribuição:", error);
      tableContainer.innerHTML =
        '<p class="alert alert-error">Erro ao carregar as faixas de cálculo.</p>';
    }
  }

  // --- INÍCIO DA ALTERAÇÃO ---
  /**
   * Formata um número para exibição, removendo o '.0' de inteiros.
   * Ex: 1.5 -> "1.5", 3.0 -> "3"
   */
  function formatarNumeroFaixa(numero) {
    if (numero % 1 === 0) {
      return numero.toFixed(0); // Se for inteiro, mostra sem casas decimais
    }
    return numero.toString(); // Se tiver decimal, mostra como está
  }

  function construirTabela() {
    const adicionalFormatado = ((percentualFamiliar - 1) * 100).toFixed(0);
    let tableHtml = `
            <table class="tabela-calculo">
                <thead>
                    <tr>
                        <th>Faixa de Renda (Salários Mínimos)</th>
                        <th>%</th>
                        <th>Valor Sugerido (Individual)</th>
                        <th>Valor Sugerido (Família - Adicional de ${adicionalFormatado}%)</th>
                    </tr>
                </thead>
                <tbody>
        `;
    faixasDeContribuicao.forEach((faixa, index) => {
      const faixaAnterior =
        index > 0 ? faixasDeContribuicao[index - 1].ateSalarios : 0;
      // Usa a nova função de formatação
      tableHtml += `
                <tr>
                    <td>De ${formatarNumeroFaixa(
                      faixaAnterior
                    )} a ${formatarNumeroFaixa(faixa.ateSalarios)}</td>
                    <td>${faixa.percentual}%</td>
                    <td id="resultado-individual-${index}">-</td>
                    <td id="resultado-familia-${index}">-</td>
                </tr>
            `;
    });
    tableHtml += "</tbody></table>";
    tableContainer.innerHTML = tableHtml;
  }
  // --- FIM DA ALTERAÇÃO ---

  const formatarMoeda = (valor) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function arredondarValorContribuicao(valor) {
    let valorInteiro = Math.ceil(valor);
    const ultimoDigito = valorInteiro % 10;
    if (ultimoDigito >= 1 && ultimoDigito <= 4) {
      valorInteiro = valorInteiro - ultimoDigito + 5;
    } else if (ultimoDigito >= 6 && ultimoDigito <= 9) {
      valorInteiro = valorInteiro - ultimoDigito + 10;
    }
    return valorInteiro;
  }

  function atualizarResultados() {
    const renda = parseFloat(rendaInput.value) || 0;
    if (faixasDeContribuicao.length === 0) return;

    faixasDeContribuicao.forEach((faixa, index) => {
      const valorCalculado = renda * (faixa.percentual / 100);
      const valorIndividualArredondado =
        arredondarValorContribuicao(valorCalculado);
      const valorFamiliaArredondado = arredondarValorContribuicao(
        valorIndividualArredondado * percentualFamiliar
      );

      const resultadoIndividualEl = document.getElementById(
        `resultado-individual-${index}`
      );
      const resultadoFamiliaEl = document.getElementById(
        `resultado-familia-${index}`
      );

      if (resultadoIndividualEl) {
        resultadoIndividualEl.textContent = formatarMoeda(
          valorIndividualArredondado
        );
      }
      if (resultadoFamiliaEl) {
        resultadoFamiliaEl.textContent = formatarMoeda(valorFamiliaArredondado);
      }
    });
  }

  rendaInput.addEventListener("input", atualizarResultados);

  // Ponto de entrada
  await carregarFaixas();
}
