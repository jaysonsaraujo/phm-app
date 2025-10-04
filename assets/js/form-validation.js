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
        
        this.touchedFields = new Set();
        this.blurredFields = new Set(); // Campos que perderam o foco
        
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
        const phoneInputs = document.querySelectorAll('input[type="tel"]');
        phoneInputs.forEach(input => {
            input.removeEventListener('input', this.phoneMask);
            input.removeEventListener('keydown', this.preventInvalidChars);
            
            input.addEventListener('input', this.phoneMask.bind(this));
            input.addEventListener('keydown', this.preventInvalidChars);
            input.addEventListener('paste', this.handlePaste.bind(this));
            
            if (input.value) {
                input.value = this.formatPhone(input.value);
            }
        });
    }
    
    preventInvalidChars(e) {
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
            (e.keyCode === 65 && e.ctrlKey === true) ||
            (e.keyCode === 67 && e.ctrlKey === true) ||
            (e.keyCode === 86 && e.ctrlKey === true) ||
            (e.keyCode === 88 && e.ctrlKey === true) ||
            (e.keyCode >= 35 && e.keyCode <= 39)) {
            return;
        }
        
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
        
        if (value.length > 11) {
            value = value.substring(0, 11);
        }
        
        input.value = this.formatPhone(value);
    }
    
    formatPhone(value) {
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
            return `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
        }
        
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
            if (input.type !== 'submit' && input.type !== 'button' && !input.readOnly) {
                
                // Marca que o campo foi focado
                input.addEventListener('focus', () => {
                    this.touchedFields.add(input);
                });
                
                // Valida SOMENTE quando perde o foco E foi tocado
                input.addEventListener('blur', () => {
                    if (this.touchedFields.has(input)) {
                        this.blurredFields.add(input);
                        this.validateField(input);
                    }
                });
                
                // Remove erro enquanto digita (somente se já tiver erro)
                input.addEventListener('input', () => {
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
        
        // No submit, marca todos como tocados e valida
        inputs.forEach(input => {
            if (input.type !== 'submit' && input.type !== 'button' && !input.readOnly) {
                this.touchedFields.add(input);
                this.blurredFields.add(input);
                if (input.hasAttribute('required') && !this.validateField(input)) {
                    isValid = false;
                }
            }
        });
        
        if (!isValid) {
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        return isValid;
    }
    
    validateField(field) {
        // NÃO valida se o campo não foi "blurred"
        if (!this.blurredFields.has(field)) {
            return true;
        }
        
        const value = field.value;
        let isValid = true;
        let errorMessage = '';
        
        // Validação de campo obrigatório
        if (field.hasAttribute('required') && !this.validators.required(value)) {
            isValid = false;
            errorMessage = 'Este campo é obrigatório';
        }
        
        // Validação específica por tipo (só se tiver valor)
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
        
        // Validação de nome completo (só se tiver valor)
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
        
        let errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
        
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
