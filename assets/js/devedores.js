// assets/js/devedores.js
(function() {
    if (!db) {
        console.error("Instância do Firestore (db) não encontrada.");
        return;
    }

    const appContent = document.getElementById('devedores-content');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    function sanitizeKey(key) {
        if (!key) return '';
        return key.replace(/\.|\$|\[|\]|#|\//g, '_');
    }

    // Calcula a dívida total de um profissional no ano corrente
    function getDividaTotal(profissional, DB) {
        const dividaInfo = { valor: 0, meses: [] };
        if (!profissional || !profissional.nome) return dividaInfo;
        
        const nomeKey = sanitizeKey(profissional.nome);
        const anoAtual = new Date().getFullYear();
        const mesAtualIndex = new Date().getMonth();

        for (let i = 0; i <= mesAtualIndex; i++) {
            const mes = meses[i];
            const dividaDoMes = DB.cobranca?.[anoAtual]?.[nomeKey]?.[mes] || 0;
            const pagamentoDoMes = DB.repasses?.[anoAtual]?.[mes]?.[nomeKey]; // Verifica se a chave existe

            if (dividaDoMes > 0 && !pagamentoDoMes) {
                dividaInfo.valor += dividaDoMes;
                dividaInfo.meses.push(mes.charAt(0).toUpperCase() + mes.slice(1));
            }
        }
        return dividaInfo;
    }

    // Renderiza a tabela de devedores
    function renderDevedores(DB) {
        let devedoresHtml = `<div class="table-wrapper"><table id="devedores-table"><thead><tr><th>Profissional</th><th>Meses Pendentes</th><th>Valor Total Devido (R$)</th></tr></thead><tbody>`;
        let totalGeralDevido = 0;
        const listaDevedores = [];

        (DB.profissionais || []).forEach(prof => {
            // Pula profissionais inativos ou em primeira fase
            if (prof.inativo || prof.primeiraFase) return;
            
            const dividaInfo = getDividaTotal(prof, DB);
            if (dividaInfo.valor > 0) {
                listaDevedores.push({ nome: prof.nome, meses: dividaInfo.meses, valor: dividaInfo.valor });
                totalGeralDevido += dividaInfo.valor;
            }
        });

        // Ordena por quem deve mais
        listaDevedores.sort((a, b) => b.valor - a.valor);

        listaDevedores.forEach(devedor => {
            devedoresHtml += `<tr><td>${devedor.nome}</td><td>${devedor.meses.join(', ')}</td><td>R$ ${devedor.valor.toFixed(2)}</td></tr>`;
        });
        
        devedoresHtml += `</tbody><tfoot><tr><td colspan="2"><strong>Total Geral Devido</strong></td><td><strong>R$ ${totalGeralDevido.toFixed(2)}</strong></td></tr></tfoot></table></div>`;
        appContent.innerHTML = devedoresHtml;
    }

    // Busca todos os dados necessários do Firestore
    async function fetchData() {
        try {
            const [usuariosSnapshot, configSnapshot] = await Promise.all([
                db.collection('usuarios').get(),
                db.collection('financeiro').doc('configuracoes').get()
            ]);

            const DB = {
                profissionais: usuariosSnapshot.docs.map(doc => doc.data()),
                cobranca: configSnapshot.exists ? configSnapshot.data().cobranca : {},
                repasses: configSnapshot.exists ? configSnapshot.data().repasses : {}
            };

            renderDevedores(DB);

        } catch (error) {
            console.error("Erro ao carregar dados para Devedores:", error);
            appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados do Firestore.</p>`;
        }
    }

    fetchData();
})();
