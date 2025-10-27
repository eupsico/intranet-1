<div class="painel-onboarding-colaboradores">
    <h2 class="painel-titulo">Onboarding e Acompanhamento de Colaboradores</h2>
    
    <div class="acoes-header">
        <button id="btn-iniciar-onboarding" class="btn btn-primary">
            <i class="fas fa-user-plus"></i> Iniciar Onboarding
        </button>
    </div>

    <div class="card card-filtros">
        <h3>Fases do Onboarding</h3>
        <div class="status-tabs">
            <button class="btn btn-tab active" data-fase="pendente-docs">Aguardando Documentação (0)</button>
            <button class="btn btn-tab" data-fase="em-integracao">Em Integração (0)</button>
            <button class="btn btn-tab" data-fase="acompanhamento">Acompanhamento (45/90 dias) (0)</button>
            <button class="btn btn-tab" data-fase="concluido">Concluído (0)</button>
        </div>
    </div>
    
    <div id="lista-onboarding" class="tabela-dados">
        <p id="mensagem-onboarding">Nenhum colaborador nesta fase.</p>
    </div>

    <div id="modal-onboarding" class="modal-bg">
        <div class="modal-content modal-lg">
            <h3>Checklist de Integração</h3>
            <form id="form-onboarding">
                <input type="hidden" id="onboarding-id">
                    <div class="form-group">
                        <label for="onboarding-candidato-id">Candidato/Novo Colaborador:</label>
                        <select id="onboarding-candidato-id" required>
                            <option value="">Selecione o candidato aprovado...</option>
                            </select>
                    </div>
                
                    <div id="onboarding-steps">
                        <fieldset class="step-card" data-step="documentacao">
                            <legend>1. Documentação e Termos</legend>
                            <p id="status-docs">Status: <span class="badge badge-warning">Aguardando Envio</span></p>
                            <button type="button" class="btn btn-sm btn-info btn-visualizar-docs" style="display: none;">
                                Visualizar Documentos Anexados
                            </button>
                            <p class="small-text">O formulário de documentos é enviado ao candidato aprovado para preenchimento e upload.</p>
                            <button type="button" class="btn btn-sm btn-secondary btn-marcar-docs-recebidos">
                                <i class="fas fa-check"></i> Marcar como Recebido (Manual)
                            </button>
                        </fieldset>

                        <fieldset class="step-card" data-step="integracao">
                            <legend>2. Integração e Treinamentos</legend>
                            <div class="form-group">
                                <label for="data-integracao">Agendamento da Integração:</label>
                                <input type="date" id="data-integracao">
                            </div>
                            <div class="form-group">
                                <label for="treinamentos-iniciais">Treinamentos Iniciais (Checklist):</label>
                                <input type="checkbox" id="treinamento-codigo-conduta"> <label for="treinamento-codigo-conduta" class="inline-label">Código de Conduta</label><br>
                                <input type="checkbox" id="treinamento-sistemas"> <label for="treinamento-sistemas" class="inline-label">Uso de Sistemas Internos</label>
                            </div>
                            <button type="button" class="btn btn-sm btn-success btn-marcar-integracao-ok">
                                <i class="fas fa-check"></i> Finalizar Etapa
                            </button>
                        </fieldset>

                        <fieldset class="step-card" data-step="acessos-ti">
                            <legend>3. Solicitação de Criação de Usuários/Acessos (TI)</legend>
                            <textarea id="solicitacao-ti-detalhes" rows="3" placeholder="Detalhe os acessos necessários (e-mail, sistemas, permissões)..."></textarea>
                            <button type="button" class="btn btn-sm btn-warning btn-enviar-solicitacao-ti">
                                <i class="fas fa-envelope"></i> Enviar Solicitação à TI
                            </button>
                            <p id="status-ti" class="mt-2">Status: Pendente</p>
                        </fieldset>
                    
                        <fieldset class="step-card" data-step="feedback">
                            <legend>4. Acompanhamento e Feedback</legend>
                            
                            <div class="form-group">
                                <label for="feedback-45d">Feedback Fase 1 - 45 Dias:</label>
                                <textarea id="feedback-45d" rows="2" placeholder="Registro do feedback de 45 dias..."></textarea>
                                <button type="button" class="btn btn-sm btn-info btn-salvar-feedback-45d">Salvar Feedback</button>
                            </div>

                            <div class="form-group">
                                <label for="feedback-3m">Feedback Fase 1 - 3 Meses:</label>
                                <textarea id="feedback-3m" rows="2" placeholder="Registro do feedback de 3 meses..."></textarea>
                                <button type="button" class="btn btn-sm btn-info btn-salvar-feedback-3m">Salvar Feedback</button>
                            </div>
                            
                            <button type="button" class="btn btn-lg btn-success btn-concluir-onboarding">
                                <i class="fas fa-trophy"></i> Concluir Fase 1 e Iniciar Fase 2 (Após 3 Meses)
                            </button>
                        </fieldset>
                    
                    </div>
                    </form>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary fechar-modal">Fechar</button>
                    </div>
        </div>
    </input>
</div>
<script type="module" src="../js/onboarding.js"></script>