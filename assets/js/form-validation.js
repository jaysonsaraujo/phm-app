/**
 * Sistema de Validação de Formulários
 * Validação completa com máscaras
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
            phone: (value) => {
                const cleanPhone = value.replace(/\D/g, '');
                return cleanPhone.length === 10 || cleanPhone.length === 11;
            },
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
    
    setupInputMasks() {
        // Máscara de telefone/WhatsApp
        const phoneInputs = document.querySelectorAll('input[type="tel"]');
        phoneInputs.forEach(input => {
            // Remove listeners anteriores
            input.removeEventListener('input', this.phoneMask);
            input.removeEventListener('keydown', this.preventInvalidChars);
            
            // Adiciona novos listeners
            input.addEventListener('input', this.phoneMask.bind(this));
            input.addEventListener('keydown', this.preventInvalidChars);
            input.addEventListener('paste', this.handlePaste.bind(this));
            
            // Aplica máscara ao valor atual se existir
            if (input.value) {
                input.value = this.formatPhone(input.value);
            }
        });
        
        // Máscara de data
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.validateField(input);
            });
        });
        
        // Máscara de horário
        const timeInputs = document.querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.validateField(input);
            });
        });
    }
    
    preventInvalidChars(e) {
        // Permite: backspace, delete, tab, escape, enter
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
            // Permite: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true) ||
            // Permite: home, end, left, right
            (e.keyCode >= 35 && e.keyCode <= 39)) {
            return;
        }
        
        // Bloqueia se não for número
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
            (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    }
    
    handlePaste(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleanText = pastedText.replace(/\D/g, '');
        e.target.value = this.formatPhone(cleanText);
    }
    
    phoneMask(e) {
        const input = e.target;
        let value = input.value.replace(/\D/g, '');
        
        // Limita a 11 dígitos
        if (value.length > 11) {
            value = value.substring(0, 11);
        }
        
        // Aplica a formatação
        input.value = this.formatPhone(value);
    }
    
    formatPhone(value) {
        // Remove tudo que não é número
        value = value.replace(/\D/g, '');
        
        if (value.length === 0) {
            return '';
        }
        
        if (value.length <= 2) {
            return `(${value}`;
        }
        
        if (value.length <= 6) {
            return `(${value.substring(0, 2)}) ${value.substring(2)}`;
        }
        
        if (value.length <= 10) {
            // Telefone fixo: (00) 0000-0000
            return `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
        }
        
        // Celular: (00) 00000-0000
        return `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7, 11)}`;
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
        const allInputs = document.querySelectorAll('input, select, textarea');
        allInputs.forEach(input => {
            if (input.type !== 'submit' && input.type !== 'button') {
                input.addEventListener('blur', () => {
                    this.validateField(input);
                });
                
                input.addEventListener('input', () => {
                    // Remove erro ao começar a digitar
                    if (input.classList.contains('error')) {
                        this.clearFieldError(input);
                    }
                });
            }
        });
    }
    
    setupFormListeners() {
        Object.values(this.forms).forEach(form => {
            if (form) {
                form.addEventListener('submit', (e) => {
                    if (!this.validateForm(form)) {
                        e.preventDefault();
                        return false;
                    }
                });
            }
        });
    }
    
    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.hasAttribute('required') && !this.validateField(input)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            // Foca no primeiro campo com erro
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        return isValid;
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
                    const cleanPhone = value.replace(/\D/g, '');
                    if (cleanPhone.length < 10) {
                        isValid = false;
                        errorMessage = 'Telefone incompleto. Digite DDD + número';
                    } else if (cleanPhone.length > 11) {
                        isValid = false;
                        errorMessage = 'Telefone inválido';
                    }
                    break;
                    
                case 'date':
                    if (!this.validators.date(value)) {
                        isValid = false;
                        errorMessage = 'Data inválida';
                    } else if (field.id === 'weddingDate') {
                        const selectedDate = new Date(value + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (selectedDate < today) {
                            isValid = false;
                            errorMessage = 'A data não pode ser no passado';
                        }
                    }
                    break;
                    
                case 'time':
                    if (!this.validators.time(value)) {
                        isValid = false;
                        errorMessage = 'Horário inválido';
                    }
                    break;
            }
        }
        
        // Validação de nome completo
        if (isValid && value && (field.id === 'brideName' || field.id === 'groomName')) {
            const names = value.trim().split(/\s+/);
            if (names.length < 2) {
                isValid = false;
                errorMessage = 'Digite o nome completo';
            }
        }
        
        // Aplica ou remove erro
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove mensagem de erro anterior
        let errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
        
        // Adiciona nova mensagem
        errorElement = document.createElement('span');
        errorElement.className = 'error-message show';
        errorElement.textContent = message;
        field.parentElement.appendChild(errorElement);
    }
    
    clearFieldError(field) {
        field.classList.remove('error');
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }
    
    showAlert(type, title, message) {
        const modal = document.getElementById('alertModal');
        const icon = document.getElementById('alertIcon');
        const titleElement = document.getElementById('alertTitle');
        const messageElement = document.getElementById('alertMessage');
        
        // Define ícone baseado no tipo
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        
        icon.className = `alert-icon ${type}`;
        icon.innerHTML = icons[type] || icons.info;
        titleElement.textContent = title;
        messageElement.textContent = message;
        
        modal.classList.add('active');
        
        // Auto-fecha após 3 segundos para sucesso
        if (type === 'success') {
            setTimeout(() => {
                modal.classList.remove('active');
            }, 3000);
        }
    }
}

// Inicializa quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    window.formValidator = new FormValidator();
});

// Exporta para uso global
window.FormValidator = FormValidator;
