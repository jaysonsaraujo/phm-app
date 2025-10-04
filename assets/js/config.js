/**
 * Sistema de Configurações
 * Gerenciamento completo das configurações do sistema
 */

class ConfigurationSystem {
    constructor() {
        this.currentSection = 'general';
        this.unsavedChanges = false;
        this.originalValues = {};
        this.configurations = {};
        this.locations = [];
        this.celebrants = [];
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadConfigurations();
        this.trackChanges();
        this.loadStatistics();
        this.setupAutoSave();
        this.checkUnsavedChanges();
    }
    
    setupEventListeners() {
        // Navegação do menu lateral
        document.querySelectorAll('.config-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });
        
        // Sincronização de inputs de cor
        document.querySelectorAll('input[type="color"]').forEach(colorInput => {
            const textInput = document.getElementById(colorInput.id + '-text');
            
            colorInput.addEventListener('input', (e) => {
                if (textInput) {
                    textInput.value = e.target.value;
                }
                this.markAsChanged();
            });
            
            if (textInput) {
                textInput.addEventListener('input', (e) => {
                    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                        colorInput.value = e.target.value;
                        this.markAsChanged();
                    }
                });
            }
        });
        
        // Upload de logo
        const logoUpload = document.getElementById('logo-upload');
        if (logoUpload) {
            logoUpload.addEventListener('change', (e) => {
                this.handleLogoUpload(e);
            });
        }
        
        // Previne saída sem salvar
        window.addEventListener('beforeunload', (e) => {
            if (this.unsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
            }
        });
    }
    
    switchSection(section) {
        // Remove classe active de todos
        document.querySelectorAll('.config-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.config-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        // Adiciona classe active ao selecionado
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        document.getElementById(`${section}-section`).classList.add('active');
        
        this.currentSection = section;
        
        // Carrega dados específicos da seção
        this.loadSectionData(section);
    }
    
    async loadSectionData(section) {
        switch(section) {
            case 'locations':
                await this.loadLocations();
                break;
            case 'celebrants':
                await this.loadCelebrants();
                break;
            case 'reports':
                await this.loadStatistics();
                break;
            case 'backup':
                await this.loadBackups();
                break;
        }
    }
    
    async loadConfigurations() {
        try {
            const response = await fetch('api/carregar-configuracoes.php');
            const data = await response.json();
            
            if (data.success) {
                this.configurations = data.configurations;
                this.applyConfigurations();
                this.storeOriginalValues();
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            this.showToast('error', 'Erro', 'Não foi possível carregar as configurações');
        }
    }
    
    applyConfigurations() {
        // Configurações Gerais
        this.setFieldValue('system-name', this.configurations.nome_sistema);
        this.setFieldValue('parish-name', this.configurations.nome_paroquia);
        this.setFieldValue('parish-phone', this.configurations.telefone_paroquia);
        this.setFieldValue('parish-email', this.configurations.email_paroquia);
        this.setFieldValue('parish-website', this.configurations.website_paroquia);
        this.setFieldValue('parish-address', this.configurations.endereco_paroquia);
        this.setFieldValue('admin-name', this.configurations.nome_responsavel);
        this.setFieldValue('admin-role', this.configurations.cargo_responsavel);
        
        // Configurações de Agendamento
        this.setFieldValue('schedule-start', this.configurations.horario_inicio_agendamento);
        this.setFieldValue('schedule-end', this.configurations.horario_fim_agendamento);
        this.setFieldValue('ceremony-duration', this.configurations.duracao_cerimonia_minutos);
        this.setFieldValue('ceremony-interval', this.configurations.intervalo_entre_cerimonias);
        this.setFieldValue('min-advance', this.configurations.dias_antecedencia_minima);
        this.setFieldValue('max-advance', this.configurations.dias_antecedencia_maxima);
        this.setFieldValue('max-per-day', this.configurations.max_casamentos_dia);
        this.setFieldValue('max-per-celebrant', this.configurations.max_por_celebrante_dia);
        
        // Dias permitidos
        this.setCheckboxValue('allow-sunday', this.configurations.permite_domingo);
        this.setCheckboxValue('allow-monday', this.configurations.permite_segunda);
        this.setCheckboxValue('allow-tuesday', this.configurations.permite_terca);
        this.setCheckboxValue('allow-wednesday', this.configurations.permite_quarta);
        this.setCheckboxValue('allow-thursday', this.configurations.permite_quinta);
        this.setCheckboxValue('allow-friday', this.configurations.permite_sexta);
        this.setCheckboxValue('allow-saturday', this.configurations.permite_sabado);
        
        // Notificações
        this.setFieldValue('reminder-interview', this.configurations.dias_lembrete_entrevista);
        this.setFieldValue('reminder-wedding', this.configurations.dias_lembrete_casamento);
        this.setFieldValue('reminder-documents', this.configurations.dias_lembrete_documentos);
        this.setFieldValue('reminder-payment', this.configurations.dias_lembrete_pagamento);
        this.setCheckboxValue('enable-whatsapp', this.configurations.enviar_lembretes_whatsapp);
        this.setCheckboxValue('enable-email', this.configurations.enviar_lembretes_email);
        this.setCheckboxValue('enable-sms', this.configurations.enviar_lembretes_sms);
        this.setCheckboxValue('enable-push', this.configurations.notificacoes_push);
        this.setFieldValue('template-confirmation', this.configurations.template_confirmacao);
        this.setFieldValue('template-reminder', this.configurations.template_lembrete);
        
        // Aparência
        this.setFieldValue('primary-color', this.configurations.cor_tema_principal);
        this.setFieldValue('primary-color-text', this.configurations.cor_tema_principal);
        this.setFieldValue('secondary-color', this.configurations.cor_tema_secundaria);
        this.setFieldValue('secondary-color-text', this.configurations.cor_tema_secundaria);
        this.setFieldValue('success-color', this.configurations.cor_sucesso);
        this.setFieldValue('success-color-text', this.configurations.cor_sucesso);
        this.setFieldValue('danger-color', this.configurations.cor_erro);
        this.setFieldValue('danger-color-text', this.configurations.cor_erro);
        this.setCheckboxValue('enable-animations', this.configurations.ativar_animacoes);
        this.setCheckboxValue('enable-shadows', this.configurations.mostrar_sombras);
        
        // Backup
        this.setCheckboxValue('enable-auto-backup', this.configurations.backup_automatico);
        this.setFieldValue('backup-frequency', this.configurations.frequencia_backup);
        this.setFieldValue('backup-time', this.configurations.horario_backup);
        this.setFieldValue('backup-retention', this.configurations.retencao_backup_dias);
        
        // Logo preview
        if (this.configurations.logo_url) {
            this.showLogoPreview(this.configurations.logo_url);
        }
    }
    
    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field && value !== undefined && value !== null) {
            field.value = value;
        }
    }
    
    setCheckboxValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.checked = value == 1 || value === true;
        }
    }
    
    storeOriginalValues() {
        document.querySelectorAll('input, select, textarea').forEach(field => {
            if (field.id) {
                if (field.type === 'checkbox') {
                    this.originalValues[field.id] = field.checked;
                } else {
                    this.originalValues[field.id] = field.value;
                }
            }
        });
    }
    
    trackChanges() {
        document.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('change', () => {
                this.checkForChanges();
            });
            
            if (field.tagName === 'INPUT' && field.type !== 'checkbox') {
                field.addEventListener('input', () => {
                    this.checkForChanges();
                });
            }
        });
    }
    
    checkForChanges() {
        let hasChanges = false;
        
        document.querySelectorAll('input, select, textarea').forEach(field => {
            if (field.id) {
                const currentValue = field.type === 'checkbox' ? field.checked : field.value;
                const originalValue = this.originalValues[field.id];
                
                if (currentValue !== originalValue) {
                    hasChanges = true;
                }
            }
        });
        
        this.unsavedChanges = hasChanges;
        
        // Atualiza indicador visual
        if (hasChanges) {
            this.markAsChanged();
        } else {
            this.markAsSaved();
        }
    }
    
    markAsChanged() {
        this.unsavedChanges = true;
        // Adiciona indicador visual se necessário
        const saveButton = document.querySelector('[onclick="saveAllSettings()"]');
        if (saveButton && !saveButton.classList.contains('pulse')) {
            saveButton.classList.add('pulse');
        }
    }
    
    markAsSaved() {
        this.unsavedChanges = false;
        const saveButton = document.querySelector('[onclick="saveAllSettings()"]');
        if (saveButton) {
            saveButton.classList.remove('pulse');
        }
    }
    
    async loadLocations() {
        try {
            const response = await fetch('api/buscar-locais.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.locations = data.locations;
                this.renderLocationsTable();
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
        }
    }
    
    renderLocationsTable() {
        const tbody = document.querySelector('#locations-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.locations.forEach(location => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${location.nome_local}</td>
                <td>${location.endereco || '-'}</td>
                <td>${location.capacidade || '-'}</td>
                <td>${location.total_agendamentos}</td>
                <td>
                    <span class="status-badge ${location.ativo ? 'active' : 'inactive'}">
                        ${location.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-icon" onclick="configSystem.editLocation(${location.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="configSystem.toggleLocation(${location.id}, ${location.ativo})" 
                            title="${location.ativo ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${location.ativo ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    ${location.total_agendamentos === 0 ? `
                        <button class="btn-icon" onclick="configSystem.deleteLocation(${location.id})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    async loadCelebrants() {
        try {
            const response = await fetch('api/buscar-padres.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.celebrants = data.celebrants;
                this.renderCelebrantsTable();
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
        }
    }
    
    renderCelebrantsTable() {
        const tbody = document.querySelector('#celebrants-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.celebrants.forEach(celebrant => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${celebrant.nome_completo}</td>
                <td>
                    <span class="badge">${celebrant.tipo}</span>
                </td>
                <td>${celebrant.telefone_formatado || '-'}</td>
                <td>${celebrant.email || '-'}</td>
                <td>${celebrant.total_celebracoes}</td>
                <td>
                    <span class="status-badge ${celebrant.ativo ? 'active' : 'inactive'}">
                        ${celebrant.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-icon" onclick="configSystem.editCelebrant(${celebrant.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="configSystem.toggleCelebrant(${celebrant.id}, ${celebrant.ativo})" 
                            title="${celebrant.ativo ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${celebrant.ativo ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    ${celebrant.celebracoes_futuras === 0 ? `
                        <button class="btn-icon" onclick="configSystem.deleteCelebrant(${celebrant.id})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    async loadStatistics() {
        try {
            const response = await fetch('api/estatisticas.php');
            const data = await response.json();
            
            if (data.success) {
                this.updateStatisticsDisplay(data.statistics);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }
    
    updateStatisticsDisplay(stats) {
        this.setElementText('total-bookings', stats.total_agendamentos);
        this.setElementText('upcoming-bookings', stats.agendamentos_futuros);
        this.setElementText('total-couples', stats.total_casais);
        this.setElementText('occupancy-rate', stats.taxa_ocupacao + '%');
    }
    
    setElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
    
    async loadBackups() {
        try {
            const response = await fetch('api/listar-backups.php');
            const data = await response.json();
            
            if (data.success) {
                this.renderBackupsList(data.backups);
            }
        } catch (error) {
            console.error('Erro ao carregar backups:', error);
        }
    }
    
    renderBackupsList(backups) {
        const tbody = document.getElementById('backup-list-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (backups.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum backup encontrado</td></tr>';
            return;
        }
        
        backups.forEach(backup => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${this.formatDate(backup.date)}</td>
                <td>${this.formatFileSize(backup.size)}</td>
                <td>
                    <span class="badge">${backup.type === 'auto' ? 'Automático' : 'Manual'}</span>
                </td>
                <td class="actions">
                    <button class="btn-icon" onclick="configSystem.downloadBackup('${backup.filename}')" title="Baixar">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="configSystem.restoreBackup('${backup.filename}')" title="Restaurar">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="btn-icon" onclick="configSystem.deleteBackup('${backup.filename}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validação do arquivo
        if (!file.type.startsWith('image/')) {
            this.showToast('error', 'Erro', 'Por favor, selecione apenas arquivos de imagem');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) { // 2MB
            this.showToast('error', 'Erro', 'A imagem deve ter no máximo 2MB');
            return;
        }
        
        // Preview da imagem
        const reader = new FileReader();
        reader.onload = (e) => {
            this.showLogoPreview(e.target.result);
            this.markAsChanged();
        };
        reader.readAsDataURL(file);
        
        // Atualiza nome do arquivo
        const fileName = document.querySelector('.file-name');
        if (fileName) {
            fileName.textContent = file.name;
        }
    }
    
    showLogoPreview(url) {
        const preview = document.getElementById('logo-preview');
        if (preview) {
            preview.innerHTML = `<img src="${url}" alt="Logo Preview">`;
        }
    }
    
    setupAutoSave() {
        // Auto-save a cada 5 minutos se houver mudanças
        setInterval(() => {
            if (this.unsavedChanges) {
                this.autoSave();
            }
        }, 5 * 60 * 1000);
    }
    
    async autoSave() {
        try {
            const formData = this.collectFormData();
            const response = await fetch('api/salvar-configuracoes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    auto_save: true
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('info', 'Auto-save', 'Configurações salvas automaticamente');
                this.markAsSaved();
                this.storeOriginalValues();
            }
        } catch (error) {
            console.error('Erro no auto-save:', error);
        }
    }
    
    collectFormData() {
        const formData = {
            // Configurações Gerais
            nome_sistema: document.getElementById('system-name').value,
            nome_paroquia: document.getElementById('parish-name').value,
            telefone_paroquia: document.getElementById('parish-phone').value,
            email_paroquia: document.getElementById('parish-email').value,
            website_paroquia: document.getElementById('parish-website').value,
            endereco_paroquia: document.getElementById('parish-address').value,
            nome_responsavel: document.getElementById('admin-name').value,
            cargo_responsavel: document.getElementById('admin-role').value,
            
            // Configurações de Agendamento
            horario_inicio_agendamento: document.getElementById('schedule-start').value,
            horario_fim_agendamento: document.getElementById('schedule-end').value,
            duracao_cerimonia_minutos: document.getElementById('ceremony-duration').value,
            intervalo_entre_cerimonias: document.getElementById('ceremony-interval').value,
            dias_antecedencia_minima: document.getElementById('min-advance').value,
            dias_antecedencia_maxima: document.getElementById('max-advance').value,
            max_casamentos_dia: document.getElementById('max-per-day').value,
            max_por_celebrante_dia: document.getElementById('max-per-celebrant').value,
            
            // Dias permitidos
            permite_domingo: document.getElementById('allow-sunday').checked ? 1 : 0,
            permite_segunda: document.getElementById('allow-monday').checked ? 1 : 0,
            permite_terca: document.getElementById('allow-tuesday').checked ? 1 : 0,
            permite_quarta: document.getElementById('allow-wednesday').checked ? 1 : 0,
            permite_quinta: document.getElementById('allow-thursday').checked ? 1 : 0,
            permite_sexta: document.getElementById('allow-friday').checked ? 1 : 0,
            permite_sabado: document.getElementById('allow-saturday').checked ? 1 : 0,
            
            // Notificações
            dias_lembrete_entrevista: document.getElementById('reminder-interview').value,
            dias_lembrete_casamento: document.getElementById('reminder-wedding').value,
            dias_lembrete_documentos: document.getElementById('reminder-documents').value,
            dias_lembrete_pagamento: document.getElementById('reminder-payment').value,
            enviar_lembretes_whatsapp: document.getElementById('enable-whatsapp').checked ? 1 : 0,
            enviar_lembretes_email: document.getElementById('enable-email').checked ? 1 : 0,
            enviar_lembretes_sms: document.getElementById('enable-sms').checked ? 1 : 0,
            notificacoes_push: document.getElementById('enable-push').checked ? 1 : 0,
            template_confirmacao: document.getElementById('template-confirmation').value,
            template_lembrete: document.getElementById('template-reminder').value,
            
            // Aparência
            cor_tema_principal: document.getElementById('primary-color').value,
            cor_tema_secundaria: document.getElementById('secondary-color').value,
            cor_sucesso: document.getElementById('success-color').value,
            cor_erro: document.getElementById('danger-color').value,
            ativar_animacoes: document.getElementById('enable-animations').checked ? 1 : 0,
            mostrar_sombras: document.getElementById('enable-shadows').checked ? 1 : 0,
            
            // Backup
            backup_automatico: document.getElementById('enable-auto-backup').checked ? 1 : 0,
            frequencia_backup: document.getElementById('backup-frequency').value,
            horario_backup: document.getElementById('backup-time').value,
            retencao_backup_dias: document.getElementById('backup-retention').value
        };
        
        return formData;
    }
    
    checkUnsavedChanges() {
        // Verifica mudanças não salvas ao trocar de seção
        document.querySelectorAll('.config-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (this.unsavedChanges) {
                    if (!confirm('Você tem alterações não salvas. Deseja continuar sem salvar?')) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            });
        });
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Remove automaticamente após 5 segundos
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    // Métodos para ações específicas
    async editLocation(id) {
        const location = this.locations.find(l => l.id === id);
        if (!location) return;
        
        // Abre modal de edição
        this.openEditLocationModal(location);
    }
    
    async toggleLocation(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ativo: currentStatus ? 0 : 1
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Status do local atualizado');
                this.loadLocations();
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao alterar status:', error);
            this.showToast('error', 'Erro', 'Não foi possível alterar o status');
        }
    }
    
    async deleteLocation(id) {
        if (!confirm('Tem certeza que deseja excluir este local?')) return;
        
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Local excluído com sucesso');
                this.loadLocations();
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao excluir:', error);
            this.showToast('error', 'Erro', 'Não foi possível excluir o local');
        }
    }
    
    async editCelebrant(id) {
        const celebrant = this.celebrants.find(c => c.id === id);
        if (!celebrant) return;
        
        // Abre modal de edição
        this.openEditCelebrantModal(celebrant);
    }
    
    async toggleCelebrant(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-padres.php?id=${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ativo: currentStatus ? 0 : 1
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Status do celebrante atualizado');
                this.loadCelebrants();
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao alterar status:', error);
            this.showToast('error', 'Erro', 'Não foi possível alterar o status');
        }
    }
    
    async deleteCelebrant(id) {
        if (!confirm('Tem certeza que deseja excluir este celebrante?')) return;
        
        try {
            const response = await fetch(`api/buscar-padres.php?id=${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Celebrante excluído com sucesso');
                this.loadCelebrants();
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao excluir:', error);
            this.showToast('error', 'Erro', 'Não foi possível excluir o celebrante');
        }
    }
    
    async downloadBackup(filename) {
        window.location.href = `api/download-backup.php?file=${filename}`;
    }
    
    async restoreBackup(filename) {
        if (!confirm('ATENÇÃO: Esta ação irá substituir todos os dados atuais. Deseja continuar?')) return;
        
        try {
            const response = await fetch('api/restaurar-backup.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Backup restaurado com sucesso');
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            this.showToast('error', 'Erro', 'Não foi possível restaurar o backup');
        }
    }
    
    async deleteBackup(filename) {
        if (!confirm('Tem certeza que deseja excluir este backup?')) return;
        
        try {
            const response = await fetch('api/excluir-backup.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('success', 'Sucesso', 'Backup excluído com sucesso');
                this.loadBackups();
            } else {
                this.showToast('error', 'Erro', data.message);
            }
        } catch (error) {
            console.error('Erro ao excluir backup:', error);
            this.showToast('error', 'Erro', 'Não foi possível excluir o backup');
        }
    }
    
    openEditLocationModal(location) {
        // Implementar modal de edição
        console.log('Editar local:', location);
    }
    
    openEditCelebrantModal(celebrant) {
        // Implementar modal de edição
        console.log('Editar celebrante:', celebrant);
    }
}

// Funções globais chamadas pelo HTML
function saveAllSettings() {
    if (configSystem) {
        configSystem.saveAllSettings();
    }
}

function openAddLocationModal() {
    // Implementar abertura de modal
    console.log('Adicionar novo local');
}

function openAddCelebrantModal() {
    // Implementar abertura de modal
    console.log('Adicionar novo celebrante');
}

function generateReport() {
    if (configSystem) {
        configSystem.generateReport();
    }
}

function createBackup() {
    if (configSystem) {
        configSystem.createBackup();
    }
}

function openRestoreModal() {
    // Implementar abertura de modal
    console.log('Restaurar backup');
}

function exportData(type) {
    if (configSystem) {
        configSystem.exportData(type);
    }
}

function closeSaveModal() {
    document.getElementById('save-confirmation-modal').classList.remove('active');
}

function confirmSave() {
    if (configSystem) {
        configSystem.confirmSave();
    }
}

// Inicializa o sistema quando o DOM carregar
let configSystem;

document.addEventListener('DOMContentLoaded', () => {
    configSystem = new ConfigurationSystem();
});
