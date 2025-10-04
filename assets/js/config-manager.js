/**
 * Gerenciador de Configurações
 * Métodos avançados de gerenciamento
 */

class ConfigManager {
    constructor(configSystem) {
        this.configSystem = configSystem;
        this.validationRules = this.setupValidationRules();
    }
    
    setupValidationRules() {
        return {
            'system-name': {
                required: true,
                minLength: 3,
                maxLength: 100
            },
            'parish-name': {
                required: true,
                minLength: 3,
                maxLength: 100
            },
            'parish-email': {
                required: false,
                email: true
            },
            'parish-website': {
                required: false,
                url: true
            },
            'schedule-start': {
                required: true,
                time: true,
                beforeField: 'schedule-end'
            },
            'schedule-end': {
                required: true,
                time: true,
                afterField: 'schedule-start'
            },
            'ceremony-duration': {
                required: true,
                min: 30,
                max: 180
            },
            'ceremony-interval': {
                required: true,
                min: 15,
                max: 120
            },
            'min-advance': {
                required: true,
                min: 1,
                max: 365,
                lessThanField: 'max-advance'
            },
            'max-advance': {
                required: true,
                min: 30,
                max: 730,
                greaterThanField: 'min-advance'
            }
        };
    }
    
    validateField(fieldId, value) {
        const rules = this.validationRules[fieldId];
        if (!rules) return { valid: true };
        
        const errors = [];
        
        // Validação de campo obrigatório
        if (rules.required && !value) {
            errors.push('Este campo é obrigatório');
        }
        
        // Validação de comprimento mínimo
        if (rules.minLength && value.length < rules.minLength) {
            errors.push(`Mínimo de ${rules.minLength} caracteres`);
        }
        
        // Validação de comprimento máximo
        if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`Máximo de ${rules.maxLength} caracteres`);
        }
        
        // Validação de valor mínimo
        if (rules.min && parseFloat(value) < rules.min) {
            errors.push(`Valor mínimo: ${rules.min}`);
        }
        
        // Validação de valor máximo
        if (rules.max && parseFloat(value) > rules.max) {
            errors.push(`Valor máximo: ${rules.max}`);
        }
        
        // Validação de email
        if (rules.email && value && !this.isValidEmail(value)) {
            errors.push('Email inválido');
        }
        
        // Validação de URL
        if (rules.url && value && !this.isValidUrl(value)) {
            errors.push('URL inválida');
        }
        
        // Validação de horário
        if (rules.time && value && !this.isValidTime(value)) {
            errors.push('Horário inválido');
        }
        
        // Validação de comparação com outro campo
        if (rules.beforeField) {
            const otherValue = document.getElementById(rules.beforeField).value;
            if (value && otherValue && value >= otherValue) {
                errors.push('Deve ser anterior ao horário final');
            }
        }
        
        if (rules.afterField) {
            const otherValue = document.getElementById(rules.afterField).value;
            if (value && otherValue && value <= otherValue) {
                errors.push('Deve ser posterior ao horário inicial');
            }
        }
        
        if (rules.lessThanField) {
            const otherValue = document.getElementById(rules.lessThanField).value;
            if (value && otherValue && parseFloat(value) >= parseFloat(otherValue)) {
                errors.push('Deve ser menor que a antecedência máxima');
            }
        }
        
        if (rules.greaterThanField) {
            const otherValue = document.getElementById(rules.greaterThanField).value;
            if (value && otherValue && parseFloat(value) <= parseFloat(otherValue)) {
                errors.push('Deve ser maior que a antecedência mínima');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    isValidTime(time) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    }
    
    validateAllFields() {
        let isValid = true;
        const errors = {};
        
        Object.keys(this.validationRules).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                const validation = this.validateField(fieldId, field.value);
                if (!validation.valid) {
                    isValid = false;
                    errors[fieldId] = validation.errors;
                }
            }
        });
        
        return { valid: isValid, errors };
    }
    
    showFieldError(fieldId, errors) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Remove erro anterior
        this.clearFieldError(fieldId);
        
        // Adiciona classe de erro
        field.classList.add('error');
        
        // Cria elemento de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.innerHTML = errors.join('<br>');
        
        field.parentElement.appendChild(errorDiv);
    }
    
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        field.classList.remove('error');
        
        const errorDiv = field.parentElement.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
}

// Extensão da classe ConfigurationSystem
ConfigurationSystem.prototype.saveAllSettings = async function() {
    // Valida todos os campos
    const manager = new ConfigManager(this);
    const validation = manager.validateAllFields();
    
    if (!validation.valid) {
        // Mostra erros
        Object.keys(validation.errors).forEach(fieldId => {
            manager.showFieldError(fieldId, validation.errors[fieldId]);
        });
        
        this.showToast('error', 'Erro de Validação', 'Por favor, corrija os erros antes de salvar');
        return;
    }
    
    // Mostra modal de confirmação
    document.getElementById('save-confirmation-modal').classList.add('active');
};

ConfigurationSystem.prototype.confirmSave = async function() {
    closeSaveModal();
    
    // Mostra loading
    this.showLoading();
    
    try {
        const formData = this.collectFormData();
        
        // Upload da logo se houver
        const logoFile = document.getElementById('logo-upload').files[0];
        if (logoFile) {
            formData.logo = await this.uploadLogo(logoFile);
        }
        
        const response = await fetch('api/salvar-configuracoes.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        this.hideLoading();
        
        if (data.success) {
            this.showToast('success', 'Sucesso', 'Configurações salvas com sucesso');
            this.markAsSaved();
            this.storeOriginalValues();
            
            // Aplica as novas configurações visuais
            this.applyVisualSettings(formData);
        } else {
            this.showToast('error', 'Erro', data.message || 'Erro ao salvar configurações');
        }
    } catch (error) {
        this.hideLoading();
        console.error('Erro ao salvar:', error);
        this.showToast('error', 'Erro', 'Não foi possível salvar as configurações');
    }
};

ConfigurationSystem.prototype.uploadLogo = async function(file) {
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
        const response = await fetch('api/upload-logo.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.url;
        }
    } catch (error) {
        console.error('Erro ao fazer upload da logo:', error);
    }
    
    return null;
};

ConfigurationSystem.prototype.applyVisualSettings = function(settings) {
    // Aplica cores do tema
    const root = document.documentElement;
    root.style.setProperty('--primary-color', settings.cor_tema_principal);
    root.style.setProperty('--secondary-color', settings.cor_tema_secundaria);
    root.style.setProperty('--success-color', settings.cor_sucesso);
    root.style.setProperty('--danger-color', settings.cor_erro);
    
    // Aplica animações
    if (!settings.ativar_animacoes) {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
    }
    
    // Aplica sombras
    if (!settings.mostrar_sombras) {
        document.body.classList.add('no-shadows');
    } else {
        document.body.classList.remove('no-shadows');
    }
};

ConfigurationSystem.prototype.generateReport = async function() {
    const type = document.getElementById('report-type').value;
    const format = document.getElementById('report-format').value;
    
    this.showLoading();
    
    try {
        const response = await fetch(`api/gerar-relatorio.php?type=${type}&format=${format}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `relatorio_${type}_${new Date().getTime()}.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showToast('success', 'Sucesso', 'Relatório gerado com sucesso');
        } else {
            throw new Error('Erro ao gerar relatório');
        }
    } catch (error) {
        console.error('Erro:', error);
        this.showToast('error', 'Erro', 'Não foi possível gerar o relatório');
    } finally {
        this.hideLoading();
    }
};

ConfigurationSystem.prototype.createBackup = async function() {
    this.showLoading();
    
    try {
        const response = await fetch('api/criar-backup.php', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            this.showToast('success', 'Sucesso', 'Backup criado com sucesso');
            this.loadBackups();
            
            // Download automático
            if (data.download_url) {
                window.location.href = data.download_url;
            }
        } else {
            throw new Error(data.message || 'Erro ao criar backup');
        }
    } catch (error) {
        console.error('Erro:', error);
        this.showToast('error', 'Erro', 'Não foi possível criar o backup');
    } finally {
        this.hideLoading();
    }
};

ConfigurationSystem.prototype.exportData = async function(type) {
    this.showLoading();
    
    try {
        const response = await fetch(`api/exportar-dados.php?type=${type}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_${type}_${new Date().getTime()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showToast('success', 'Sucesso', `Dados de ${type} exportados com sucesso`);
        } else {
            throw new Error('Erro ao exportar dados');
        }
    } catch (error) {
        console.error('Erro:', error);
        this.showToast('error', 'Erro', 'Não foi possível exportar os dados');
    } finally {
        this.hideLoading();
    }
};

ConfigurationSystem.prototype.showLoading = function() {
    const existingLoader = document.querySelector('.config-loading');
    if (existingLoader) return;
    
    const loader = document.createElement('div');
    loader.className = 'config-loading';
    loader.innerHTML = `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>Processando...</p>
        </div>
    `;
    
    document.body.appendChild(loader);
};

ConfigurationSystem.prototype.hideLoading = function() {
    const loader = document.querySelector('.config-loading');
    if (loader) {
        loader.remove();
    }
};

// Estilos adicionais para validação e loading
const configStyles = document.createElement('style');
configStyles.textContent = `
    .field-error {
        color: var(--danger-color);
        font-size: 0.85rem;
        margin-top: 0.25rem;
    }
    
    .config-field input.error,
    .config-field select.error,
    .config-field textarea.error {
        border-color: var(--danger-color);
    }
    
    .config-loading {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .config-loading .loading-overlay {
        text-align: center;
        color: white;
    }
    
    .config-loading .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }
    
    .no-animations * {
        animation: none !important;
        transition: none !important;
    }
    
    .no-shadows * {
        box-shadow: none !important;
    }
    
    .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        background: var(--primary-light);
        color: white;
        border-radius: 4px;
        font-size: 0.85rem;
    }
`;
document.head.appendChild(configStyles);
