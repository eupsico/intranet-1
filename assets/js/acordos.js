(function() {
    if (!db) {
        console.error("Instância do Firestore (db) não encontrada.");
        appContent.innerHTML = `<p style="color:red;">Erro de conexão com o banco de dados.</p>`;
        return;
    }

    const appContent = document.getElementById('acordos-content');
    const taxaGeralInput = document.getElementById('acordo-taxa-geral');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    let DB = { profissionais: [], cobranca: {}, acordos: [], repasses: {}, Mensagens: {}, valores: {} };

    const sanitizeKey = (key) => !key ? '' : key.replace(/\.|\$|\[|\]|#|\//g, '_');
    
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Bom dia';
        if (hour >= 12 && hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const getDividaTotal = (profissional, dbData) => {
        const dividaInfo = { valor: 0, meses: [] };
        if (!profissional || !profissional.nome) return dividaInfo;
        const nomeKey = sanitizeKey(profissional.nome);
        const anoAtual = new Date().getFullYear();
        const mesAtualIndex = new Date().getMonth();
        for (let i = 0; i <= mesAtualIndex; i++) {
            const mes = meses[i];
            const dividaDoMes = dbData.cobranca?.[anoAtual]?.[nomeKey]?.[mes] || 0;
            const pagamentoDoMes = dbData.repasses?.[anoAtual]?.[mes]?.[nomeKey];
            if (dividaDoMes > 0 && !pagamentoDoMes) {
                dividaInfo.valor += dividaDoMes;
            }
        }
        return dividaInfo;
    };

    const generateContract = (content, acordoSalvo = {}) => {
        const parcelas = parseInt(content.querySelector('.acordo-parcelas').value) || 0;
        const entrada = parseFloat(content.querySelector('.acordo-entrada').value) || 0;
        const valorFinal = parseFloat(content.querySelector('.acordo-valor-final').value) || 0;
        const parcelasTable = content.querySelector('.parcelas-table');
        const dataAcordoInput = content.querySelector('.acordo-data').value;
        const dataEntradaInput = content.querySelector('.acordo-data-entrada').value;
        parcelasTable.innerHTML = `<thead><tr><th>Item</th><th>Mês Ref.</th><th>Valor</th><th>Vencimento</th><th>Data Pag.</th><th>Ações</th></tr></thead><tbody></tbody>`;
        const tbody = parcelasTable.querySelector('tbody');

        if (entrada > 0) {
            const pagamentoSalvo = acordoSalvo.pagamentos?.find(p => p.item === 'Entrada');
            const dataVencimento = dataEntradaInput;
            const dataPagamento = pagamentoSalvo ? pagamentoSalvo.dataPagamento : '';
            const nomeMes = meses[new Date(dataVencimento + 'T00:00:00').getMonth()];
            tbody.innerHTML += `<tr>
                <td>Entrada</td>
                <td>${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</td>
                <td>R$ ${entrada.toFixed(2)}</td>
                <td><input type="date" class="data-vencimento" value="${dataVencimento}" readonly></td>
                <td><input type="date" class="data-pagamento-efetivo" value="${dataPagamento}"></td>
                <td><button class="action-button whatsapp-parcela-btn" data-item="Entrada" data-valor="${entrada.toFixed(2)}" data-vencimento="${dataVencimento}">Enviar</button></td>
            </tr>`;
        }
        if (parcelas > 0) {
            let calculationBaseDate = entrada > 0 && dataEntradaInput ? new Date(dataEntradaInput + 'T00:00:00') : new Date(dataAcordoInput + 'T00:00:00');
            const valorParcela = valorFinal / parcelas;
            for (let i = 0; i < parcelas; i++) {
                const mesVencimento = new Date(calculationBaseDate.getFullYear(), calculationBaseDate.getMonth() + 1 + i, 10);
                const nomeMes = meses[mesVencimento.getMonth()].charAt(0).toUpperCase() + meses[mesVencimento.getMonth()].slice(1);
                const itemParcela = `Parcela ${i+1}/${parcelas}`;
                const pagamentoSalvo = acordoSalvo.pagamentos?.find(p => p.item === itemParcela);
                const dataVencimento = pagamentoSalvo ? (pagamentoSalvo.dataVencimento || pagamentoSalvo.data) : mesVencimento.toISOString().split('T')[0];
                const dataPagamento = pagamentoSalvo ? pagamentoSalvo.dataPagamento : '';
                tbody.innerHTML += `<tr>
                    <td>${itemParcela}</td>
                    <td>${nomeMes}</td>
                    <td>R$ ${valorParcela.toFixed(2)}</td>
                    <td><input type="date" class="data-vencimento" value="${dataVencimento}" readonly></td>
                    <td><input type="date" class="data-pagamento-efetivo" value="${dataPagamento}"></td>
                    <td><button class="action-button whatsapp-parcela-btn" data-item="${itemParcela}" data-valor="${valorParcela.toFixed(2)}" data-vencimento="${dataVencimento}">Enviar</button></td>
                </tr>`;
            }
        }
    };
            
    const calculateAndUpdate = (content) => {
        const nome = content.closest('.accordion').dataset.nome;
        const acordoSalvo = DB.acordos.find(a => a.prof === nome) || {};
        const divida = parseFloat(content.querySelector('.acordo-divida').value) || 0;
        const entrada = parseFloat(content.querySelector('.acordo-entrada').value) || 0;
        const taxa = parseFloat(taxaGeralInput.value) || 0;
        const valorComJuros = divida * (1 + (taxa / 100));
        const valorFinal = valorComJuros - entrada;
        content.querySelector('.acordo-valor-final').value = valorFinal.toFixed(2);
        const parcelas = parseInt(content.querySelector('.acordo-parcelas').value) || 0;
        const resultsArea = content.querySelector('.results-area');
        if (parcelas > 0 || entrada > 0) {
            resultsArea.style.display = 'block';
            generateContract(content, acordoSalvo);
        } else {
            resultsArea.style.display = 'none';
        }
    };
            
    const renderAccordions = (devedores) => {
        appContent.innerHTML = '';
        if (devedores.length === 0) {
            appContent.innerHTML = '<p>Nenhum profissional com dívidas pendentes.</p>';
            return;
        }
        const hoje = new Date().toISOString().split('T')[0];
        devedores.forEach(devedor => {
            const acordoSalvo = DB.acordos.find(a => a.prof === devedor.nome) || {};
            const accordion = document.createElement('div');
            accordion.className = 'accordion';
            accordion.dataset.nome = devedor.nome;
            accordion.innerHTML = `
                <button class="accordion-trigger">${devedor.nome}  (Dívida: R$ ${devedor.valor.toFixed(2)})</button>
                <div class="accordion-content">
                    <div class="form-grid">
                        <div class="form-group"><label>Valor Dívida (R$)</label><input class="acordo-divida" value="${devedor.valor.toFixed(2)}" readonly></div>
                        <div class="form-group"><label>Data do Acordo</label><input type="date" class="acordo-data" value="${acordoSalvo.dataAcordo || hoje}"></div>
                        <div class="form-group"><label>Entrada (R$)</label><input type="number" step="0.01" class="acordo-entrada" value="${acordoSalvo.entrada || ''}"></div>
                        <div class="form-group"><label>Pagamento Entrada</label><input type="date" class="acordo-data-entrada" value="${acordoSalvo.dataEntrada || hoje}"></div>
                        <div class="form-group"><label>Valor Final (R$)</label><input class="acordo-valor-final" value="${acordoSalvo.valorFinal || devedor.valor.toFixed(2)}" readonly></div>
                        <div class="form-group"><label>Nº Parcelas</label><input type="number" class="acordo-parcelas" value="${acordoSalvo.parcelas || ''}"></div>
                    </div>
                    <div class="results-area" style="display: none;">
                        <h4>Parcelamento:</h4>
                        <div class="table-wrapper"><table class="parcelas-table"></table></div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                            <button class="action-button whatsapp-btn">Enviar Resumo (WhatsApp)</button>
                            <button class="action-button save-btn">Salvar Acordo</button>
                        </div>
                    </div>
                </div>`;
            appContent.appendChild(accordion);
            if (acordoSalvo.prof) {
                calculateAndUpdate(accordion.querySelector('.accordion-content'));
            }
        });
    };

    async function fetchData() {
        try {
            const [usuariosSnap, configSnap, acordosSnap] = await Promise.all([
                db.collection('usuarios').get(),
                db.collection('financeiro').doc('configuracoes').get(),
                db.collection('acordos').get()
            ]);

            const configData = configSnap.exists ? configSnap.data() : {};
            DB.profissionais = usuariosSnap.docs.map(doc => doc.data());
            DB.acordos = acordosSnap.docs.map(doc => doc.data());
            DB.cobranca = configData.cobranca || {};
            DB.repasses = configData.repasses || {};
            DB.Mensagens = configData.Mensagens || {};
            DB.valores = configData.valores || {};

            taxaGeralInput.value = DB.valores.taxaAcordo || 0;
            const listaDevedores = DB.profissionais
                .filter(prof => prof.nome && !prof.primeiraFase && !prof.inativo)
                .map(prof => ({ nome: prof.nome, valor: getDividaTotal(prof, DB).valor }))
                .filter(devedor => devedor.valor > 0)
                .sort((a, b) => a.nome.localeCompare(b.nome));
            renderAccordions(listaDevedores);
        } catch (error) {
            console.error("Erro ao carregar dados para Acordos:", error);
            appContent.innerHTML = `<p style="color:red;">Erro ao carregar dados. Verifique o console.</p>`;
        }
    }
    
    taxaGeralInput.addEventListener('input', () => {
        db.collection('financeiro').doc('configuracoes').set({ valores: { taxaAcordo: parseFloat(taxaGeralInput.value) || 0 } }, { merge: true });
        appContent.querySelectorAll('.accordion-content').forEach(calculateAndUpdate);
    });
    
    appContent.addEventListener('input', (e) => {
        if (e.target.classList.contains('data-pagamento-efetivo')) return;
        const content = e.target.closest('.accordion-content');
        if (content) calculateAndUpdate(content);
    });
            
    appContent.addEventListener('click', async (e) => {
        const target = e.target;
        const accordion = target.closest('.accordion');
        if (!accordion) return;
        const content = accordion.querySelector('.accordion-content');
        
        if (target.classList.contains('accordion-trigger')) {
            const isActive = target.classList.toggle('active');
            content.classList.toggle('active');
            if(isActive) {
                // Força o recálculo para obter o scrollHeight correto
                calculateAndUpdate(content);
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = null;
            }
        }

        if(target.classList.contains('save-btn')) {
            target.disabled = true;
            target.textContent = 'Salvando...';
            const nome = accordion.dataset.nome;
            const nomeKey = sanitizeKey(nome);
            const pagamentos = [];
            content.querySelectorAll('.parcelas-table tbody tr').forEach(row => {
                pagamentos.push({
                    item: row.cells[0].textContent,
                    valor: parseFloat(row.cells[2].textContent.replace('R$ ', '')),
                    dataVencimento: row.querySelector('.data-vencimento').value,
                    dataPagamento: row.querySelector('.data-pagamento-efetivo').value
                });
            });
            const acordoData = {
                prof: nome,
                dataAcordo: content.querySelector('.acordo-data').value,
                dataEntrada: content.querySelector('.acordo-data-entrada').value,
                divida: parseFloat(content.querySelector('.acordo-divida').value) || 0,
                entrada: parseFloat(content.querySelector('.acordo-entrada').value) || 0,
                taxa: parseFloat(taxaGeralInput.value) || 0,
                valorFinal: parseFloat(content.querySelector('.acordo-valor-final').value) || 0,
                parcelas: parseInt(content.querySelector('.acordo-parcelas').value) || 0,
                pagamentos: pagamentos,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            try {
                await db.collection('acordos').doc(nomeKey).set(acordoData);
                window.showToast(`Acordo para ${nome} salvo com sucesso!`, 'success');
                const index = DB.acordos.findIndex(a => a.prof === nome);
                if (index > -1) { DB.acordos[index] = acordoData; } else { DB.acordos.push(acordoData); }
            } catch (err) {
                window.showToast('Erro ao salvar acordo.', 'error');
                console.error('Erro ao salvar acordo:', err);
            } finally {
                target.disabled = false;
                target.textContent = 'Salvar Acordo';
            }
        }
        
        if(target.classList.contains('whatsapp-btn')) { 
            const nome = accordion.dataset.nome;
            const profInfo = DB.profissionais.find(p => p.nome === nome);
            const contato = profInfo ? profInfo.contato.replace(/\D/g, '') : '';
            if(!contato) { return alert(`Contato para ${nome} não encontrado.`); }

            const divida = parseFloat(content.querySelector('.acordo-divida').value) || 0;
            const entrada = parseFloat(content.querySelector('.acordo-entrada').value) || 0;
            const taxa = parseFloat(taxaGeralInput.value) || 0;
            const valorFinal = parseFloat(content.querySelector('.acordo-valor-final').value) || 0;
            const parcelas = parseInt(content.querySelector('.acordo-parcelas').value) || 0;
            let listaParcelasTexto = '';
            content.querySelectorAll('.parcelas-table tbody tr').forEach(row => {
                const [item, , valor, dataVenc] = Array.from(row.cells).map(cell => cell.textContent || cell.querySelector('input')?.value);
                const [ano, mes, dia] = dataVenc.split('-');
                listaParcelasTexto += `${item}: ${valor} (Venc. ${dia}/${mes}/${ano})\n`;
            });
            
            const template = DB.Mensagens.contrato || '{{greeting}}, {{nomeProfissional}}!\n\nSegue um resumo do seu acordo com a EuPsico.\n\n- Valor da Dívida: R$ {{divida}}\n- Entrada: R$ {{entrada}}\n- Taxa Aplicada: {{taxa}}%\n- Valor Final: R$ {{valorFinal}}\n- Nº de Parcelas: {{parcelas}}\n\nAs parcelas serão:\n{{listaParcelas}}';
            const mensagemFinal = template.replace('{{greeting}}', getGreeting()).replace(/{{nomeProfissional}}/g, nome).replace('{{divida}}', divida.toFixed(2).replace('.',',')).replace('{{entrada}}', entrada.toFixed(2).replace('.',',')).replace('{{taxa}}', taxa).replace('{{valorFinal}}', valorFinal.toFixed(2).replace('.',',')).replace('{{parcelas}}', parcelas).replace('{{listaParcelas}}', listaParcelasTexto.trim());
            
            window.open(`https://wa.me/55${contato}?text=${encodeURIComponent(mensagemFinal)}`, '_blank');
        }

        if(target.classList.contains('whatsapp-parcela-btn')) {
            const nome = accordion.dataset.nome;
            const profInfo = DB.profissionais.find(p => p.nome === nome);
            const contato = profInfo ? profInfo.contato.replace(/\D/g, '') : '';
            if(!contato) { return alert(`Contato para ${nome} não encontrado.`); }

            const item = target.dataset.item;
            const valor = parseFloat(target.dataset.valor);
            const vencimento = target.dataset.vencimento;
            const [ano, mes, dia] = vencimento.split('-');
            const valorTotalDivida = parseFloat(content.querySelector('.acordo-divida').value) || 0;
            let valorTotalPago = 0;
            content.querySelectorAll('.parcelas-table tbody tr').forEach(row => {
                if (row.querySelector('.data-pagamento-efetivo').value) { 
                    valorTotalPago += parseFloat(row.cells[2].textContent.replace('R$ ', ''));
                }
            });
            const valorRestante = valorTotalDivida - valorTotalPago;

            const template = DB.Mensagens.acordo || '{{greeting}}, {{nome}}!\n\nLembrete do acordo.\n\n- Item: {{item}}\n- Vencimento: {{vencimento}}\n- Valor: R$ {{valor}}';
            const mensagemParcela = template.replace('{{greeting}}', getGreeting()).replace(/{{nome}}/g, nome).replace('{{item}}', item).replace('{{vencimento}}', `${dia}/${mes}/${ano}`).replace('{{valor}}', valor.toFixed(2).replace('.',',')).replace('{{valorRestante}}', valorRestante.toFixed(2).replace('.',','));
            
            window.open(`https://wa.me/55${contato}?text=${encodeURIComponent(mensagemParcela)}`, '_blank');
        }
    });

    fetchData();
})();
