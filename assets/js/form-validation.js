/**
 * Sistema de Validação de Formulários
 * Validações completas e tratamento de dados
 */

class FormValidator {
    constructor() {
        this.forms = {
            booking: document.getElementById('bookingForm'),
            newLocation: document.getElementById('newLocationForm'),
            newCelebrant: document.getElementById('newCelebrantForm')
        };
        
        this.validators = {
            required: (value) => value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            phone: (value) => /^KATEX_INLINE_OPEN\d{2}KATEX_INLINE_CLOSE\s?\d{4,5}-\d{4}$/.test(value.replace(/\s/g, '')),
            date: (value) => !isNaN(Date.parse(value)),
            time: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
            minLength: (value, length) => value.trim().length >= length,
            maxLength: (value, length) => value.trim().length <= length
        };
        
        this.init();
    }
    
    init() {
        this.setupFormListeners();
        this.setupInputMasks();
        this.setupUppercaseInputs();
        this.setupRealTimeValidation();
    }
    
    setupFormListeners() {
        // Formulário de agendamento
        if (this.forms.booking) {
            this.forms.booking.addEventListener('submit', (e) => this.handleBookingSubmit(e));
        }
        
        // Formulário de novo local
        if (this.forms.newLocation) {
            this.forms.newLocation.addEventListener('submit', (e) => this.handleNewLocationSubmit(e));
        }
        
        // Formulário de novo celebrante
        if (this.forms.newCelebrant) {
            this.forms.newCelebrant.addEventListener('submit', (e) => this.handleNewCelebrantSubmit(e));
        }
    }
    
    setupInputMasks() {
        // Máscara para telefone/WhatsApp
        const phoneInputs = document.querySelectorAll('input[type="tel"]');
        phoneInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) value = value.substring(0, 11);
                
                if (value.length > 6) {
                    value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
                } else if (value.length > 2) {
                    value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
                } else if (value.length > 0) {
                    value = `(${value}`;
                }
                
                e.target.value = value;
            });
        });
    }
    
    setupUppercaseInputs() {
        const uppercaseInputs = document.querySelectorAll('.uppercase-input');
        uppercaseInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                e.target.value = e.target.value.toUpperCase();
                e.target.setSelectionRange(start, end);
            });
        });
    }
    
    setupRealTimeValidation() {
        // Validação em tempo real para campos obrigatórios
        const requiredInputs = document.querySelectorAll('[required]');
        requiredInputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateField(input);
            });
            
            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }
    
    validateField(field) {
        const value = field.value;
        let isValid = true;
        let errorMessage = '';
        
        // Validação de campo obrigatório
        if (field.hasAttribute('required') && !this.validators.required(value)) {
            isValid = false;
            errorMessage = 'Este campo é obrigatório';
        }
        
        // Validação específica por tipo
        if (isValid && value) {
            switch (field.type) {
                case 'email':
                    if (!this.validators.email(value)) {
                        isValid = false;
                        errorMessage = 'Email inválido';
                    }
                    break;
                    
                case 'tel':
                    if (!this.validators.phone(value)) {
                        isValid = false;
                        errorMessage = 'Telefone inválido. Use o formato (00) 00000-0000';
                    }
                    break;
                    
                case 'date':
                    if (!this.validators.date(value)) {
                        isValid = false;
                        errorMessage = 'Data inválida';
                    } else {
                        // Validação adicional para data do casamento
                        if (field.id === 'weddingDate') {
                            const selectedDate = new Date(value);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            if (selectedDate < today) {
                                isValid = false;
                                errorMessage = 'A data do casamento não pode ser no passado';
                            }
                            
                            // Verifica antecedência mínima (90 dias por padrão)
                            const minDate = new Date();
                            minDate.setDate(minDate.getDate() + 90);
                            
                            if (selectedDate < minDate) {
                                isValid = false;
                                errorMessage = 'O casamento deve ser agendado com no mínimo 90 dias de antecedência';
                            }
                            
                            // Verifica antecedência máxima (365 dias por padrão)
                            const maxDate = new Date();
                            maxDate.setDate(maxDate.getDate() + 365);
                            
                            if (selectedDate > maxDate) {
                                isValid = false;
                                errorMessage = 'O casamento pode ser agendado com no máximo 365 dias de antecedência';
                            }
                        }
                    }
                    break;
                    
                case 'time':
                    if (!this.validators.time(value)) {
                        isValid = false;
                        errorMessage = 'Horário inválido';
                    } else {
                        // Validação de horário permitido
                        const [hours, minutes] = value.split(':').map(Number);
                        const totalMinutes = hours * 60 + minutes;
                        
                        // Horário mínimo: 8:00, máximo: 20:00
                        if (totalMinutes < 480 || totalMinutes > 1200) {
                            isValid = false;
                            errorMessage = 'Horário deve estar entre 08:00 e 20:00';
                        }
                    }
                    break;
            }
        }
        
        // Validação de nome completo
        if (field.id === 'brideName' || field.id === 'groomName') {
            const names = value.trim().split(' ');
            if (names.length < 2 || names.some(name => name.length < 2)) {
                isValid = false;
                errorMessage = 'Digite o nome completo';
            }
        }
        
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove mensagem de erro existente
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Cria nova mensagem de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message show';
        errorDiv.textContent = message;
        field.parentElement.appendChild(errorDiv);
        
        // Adiciona animação de shake
        field.classList.add('shake');
        setTimeout(() => field.classList.remove('shake'), 500);
    }
    
    clearFieldError(field) {
        field.classList.remove('error');
        const errorMessage = field.parentElement.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
    
    async handleBookingSubmit(e) {
        e.preventDefault();
        
        // Valida todos os campos
        const fields = this.forms.booking.querySelectorAll('input[required], select[required]');
        let isValid = true;
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            this.showAlert('error', 'Erro no Formulário', 'Por favor, corrija os erros antes de enviar.');
            return;
        }
        
        // Verifica conflitos de agendamento
        const weddingDate = document.getElementById('weddingDate').value;
        const weddingTime = document.getElementById('weddingTime').value;
        const locationId = document.getElementById('ceremonyLocation').value;
        const celebrantId = document.getElementById('celebrant').value;
        
        const conflicts = await this.checkConflicts(weddingDate, weddingTime, locationId, celebrantId);
        
        if (conflicts.hasConflict) {
            this.showAlert('warning', 'Conflito de Agendamento', conflicts.message);
            return;
        }
        
        // Prepara os dados para envio
        const formData = this.collectFormData();
        
        // Envia os dados
        this.submitBooking(formData);
    }
    
    async checkConflicts(date, time, locationId, celebrantId) {
        try {
            const response = await fetch('api/verificar-conflitos.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    date: date,
                    time: time,
                    location_id: locationId,
                    celebrant_id: celebrantId
                })
            });
            
            const data = await response.json();
            
            if (data.conflicts) {
                let message = 'Os seguintes conflitos foram encontrados:\n\n';
                
                if (data.conflicts.location) {
                    message += `• O local já está reservado para este horário\n`;
                }
                
                if (data.conflicts.celebrant) {
                    message += `• O celebrante já tem compromisso neste horário\n`;
                }
                
                if (data.conflicts.time) {
                    message += `• Existe outro casamento muito próximo deste horário (intervalo mínimo de 30 minutos)\n`;
                }
                
                return {
                    hasConflict: true,
                    message: message
                };
            }
            
            return { hasConflict: false };
            
        } catch (error) {
            console.error('Erro ao verificar conflitos:', error);
            return {
                hasConflict: true,
                message: 'Erro ao verificar disponibilidade. Por favor, tente novamente.'
            };
        }
    }
    
    collectFormData() {
        const formData = {
            id: document.getElementById('bookingId').value,
            data_agendamento: new Date().toISOString(),
            nome_noiva: document.getElementById('brideName').value.toUpperCase(),
            whatsapp_noiva: document.getElementById('brideWhatsapp').value,
            nome_noivo: document.getElementById('groomName').value.toUpperCase(),
            whatsapp_noivo: document.getElementById('groomWhatsapp').value,
            data_casamento: document.getElementById('weddingDate').value,
            horario_casamento: document.getElementById('weddingTime').value,
            local_id: document.getElementById('ceremonyLocation').value,
            padre_diacono_id: document.getElementById('celebrant').value,
            transferencia_tipo: document.getElementById('transferType').value,
            com_efeito_civil: document.getElementById('civilEffect').value,
            data_entrevista: document.getElementById('interviewDate').value || null,
            observacoes: document.getElementById('observations').value.toUpperCase(),
            mensagem_sistema: document.getElementById('systemMessage').value.toUpperCase()
        };
        
        // Calcula as datas dos proclames
        const weddingDate = new Date(formData.data_casamento + 'T00:00:00');
        const sundays = this.calculateProclamesDates(weddingDate);
        
        formData.proclames = {
            primeiro_domingo: sundays[0],
            segundo_domingo: sundays[1],
            terceiro_domingo: sundays[2]
        };
        
        return formData;
    }
    
    calculateProclamesDates(weddingDate) {
        const sundays = [];
        
        for (let i = 3; i >= 1; i--) {
            let sunday = new Date(weddingDate);
            sunday.setDate(sunday.getDate() - (i * 7));
            
            while (sunday.getDay() !== 0) {
                sunday.setDate(sunday.getDate() - 1);
            }
            
            sundays.push(sunday.toISOString().split('T')[0]);
        }
        
        return sundays;
    }
    
    async submitBooking(formData) {
        // Mostra loading
        this.showLoading();
        
        try {
            const response = await fetch('api/salvar-agendamento.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            this.hideLoading();
            
            if (data.success) {
                this.showAlert('success', 'Agendamento Realizado!', 
                    `O casamento de ${formData.nome_noiva} e ${formData.nome_noivo} foi agendado com sucesso.`);
                
                // Limpa o formulário e fecha o modal
                setTimeout(() => {
                    this.forms.booking.reset();
                    closeModal();
                    
                    // Atualiza o calendário
                    if (window.weddingCalendar) {
                        window.weddingCalendar.refresh();
                    }
                }, 2000);
                
            } else {
                this.showAlert('error', 'Erro ao Salvar', 
                    data.message || 'Ocorreu um erro ao salvar o agendamento. Por favor, tente novamente.');
            }
            
        } catch (error) {
            this.hideLoading();
            console.error('Erro ao enviar formulário:', error);
            this.showAlert('error', 'Erro de Conexão', 
                'Não foi possível conectar ao servidor. Por favor, verifique sua conexão.');
        }
    }
    
    async handleNewLocationSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('newLocationName').value.toUpperCase();
        const address = document.getElementById('newLocationAddress').value.toUpperCase();
        const capacity = document.getElementById('newLocationCapacity').value;
        
        if (!name) {
            this.showAlert('error', 'Erro', 'O nome do local é obrigatório');
            return;
        }
        
        try {
            const response = await fetch('api/adicionar-local.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome_local: name,
                    endereco: address,
                    capacidade: capacity
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Local Adicionado', 'O novo local foi adicionado com sucesso.');
                
                // Atualiza a lista de locais
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadLocations();
                }
                
                // Limpa e fecha o modal
                this.forms.newLocation.reset();
                closeLocationModal();
                
                // Seleciona o novo local
                setTimeout(() => {
                    document.getElementById('ceremonyLocation').value = data.locationId;
                }, 500);
                
            } else {
                this.showAlert('error', 'Erro', data.message || 'Não foi possível adicionar o local.');
            }
            
        } catch (error) {
            console.error('Erro ao adicionar local:', error);
            this.showAlert('error', 'Erro', 'Ocorreu um erro ao adicionar o local.');
        }
    }
    
    async handleNewCelebrantSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('newCelebrantName').value.toUpperCase();
        const type = document.getElementById('newCelebrantType').value;
        const phone = document.getElementById('newCelebrantPhone').value;
        const email = document.getElementById('newCelebrantEmail').value;
        
        if (!name) {
            this.showAlert('error', 'Erro', 'O nome é obrigatório');
            return;
        }
        
        try {
            const response = await fetch('api/adicionar-celebrante.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome_completo: name,
                    tipo: type,
                    telefone: phone,
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Celebrante Adicionado', 'O novo celebrante foi adicionado com sucesso.');
                
                // Atualiza a lista de celebrantes
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadCelebrants();
                }
                
                // Limpa e fecha o modal
                this.forms.newCelebrant.reset();
                closeCelebrantModal();
                
                // Seleciona o novo celebrante
                setTimeout(() => {
                    document.getElementById('celebrant').value = data.celebrantId;
                }, 500);
                
            } else {
                this.showAlert('error', 'Erro', data.message || 'Não foi possível adicionar o celebrante.');
            }
            
        } catch (error) {
            console.error('Erro ao adicionar celebrante:', error);
            this.showAlert('error', 'Erro', 'Ocorreu um erro ao adicionar o celebrante.');
        }
    }
    
    showAlert(type, title, message) {
        const modal = document.getElementById('alertModal');
        const icon = document.getElementById('alertIcon');
        const titleElement = document.getElementById('alertTitle');
        const messageElement = document.getElementById('alertMessage');
        
        // Define o ícone baseado no tipo
        icon.className = 'alert-icon ' + type;
        switch(type) {
            case 'success':
                icon.innerHTML = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                icon.innerHTML = '<i class="fas fa-times-circle"></i>';
                break;
            case 'warning':
                icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            case 'info':
                icon.innerHTML = '<i class="fas fa-info-circle"></i>';
                break;
        }
        
        titleElement.textContent = title;
        messageElement.textContent = message;
        
        modal.classList.add('active');
    }
    
    showLoading() {
        const existingLoader = document.querySelector('.loading-overlay');
        if (existingLoader) return;
        
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>Processando...</p>
            </div>
        `;
        
        document.body.appendChild(loader);
    }
    
    hideLoading() {
        const loader = document.querySelector('.loading-overlay');
        if (loader) {
            loader.remove();
        }
    }
}

// Estilos para o loading overlay
const loadingStyles = document.createElement('style');
loadingStyles.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loading-content {
        text-align: center;
        color: white;
    }
    
    .loading-content p {
        margin-top: 1rem;
        font-size: 1.2rem;
    }
`;
document.head.appendChild(loadingStyles);

// Inicializa o validador quando o DOM carregar
let formValidator;

document.addEventListener('DOMContentLoaded', () => {
    formValidator = new FormValidator();
});

// Exporta para uso em outros módulos
window.FormValidator = FormValidator;
