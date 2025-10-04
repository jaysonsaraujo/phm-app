-- Criação do banco de dados (se necessário)
CREATE DATABASE IF NOT EXISTS `db-phm-app` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `db-phm-app`;

-- Tabela de locais
CREATE TABLE IF NOT EXISTS `locais` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL UNIQUE,
    `endereco` TEXT,
    `capacidade` INT,
    `ativo` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de celebrantes (Padres/Diáconos)
CREATE TABLE IF NOT EXISTS `celebrantes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL,
    `tipo` ENUM('PADRE', 'DIÁCONO', 'BISPO', 'OUTRO') DEFAULT 'PADRE',
    `telefone` VARCHAR(20),
    `email` VARCHAR(100),
    `ativo` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela principal de agendamentos
CREATE TABLE IF NOT EXISTS `agendamentos` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `data_agendamento` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `nome_noiva` VARCHAR(255) NOT NULL,
    `whatsapp_noiva` VARCHAR(20) NOT NULL,
    `nome_noivo` VARCHAR(255) NOT NULL,
    `whatsapp_noivo` VARCHAR(20) NOT NULL,
    `data_casamento` DATE NOT NULL,
    `horario_casamento` TIME NOT NULL,
    `local_id` INT NOT NULL,
    `celebrante_id` INT NOT NULL,
    `tipo_transferencia` ENUM('NAO', 'ENTRADA_PAROQUIA', 'SAIDA_PAROQUIA', 'ENTRADA_DIOCESE', 'SAIDA_DIOCESE') DEFAULT 'NAO',
    `com_efeito_civil` BOOLEAN DEFAULT FALSE,
    `observacoes` TEXT,
    `data_entrevista` DATE,
    `mensagem_sistema` TEXT,
    `status` ENUM('ATIVO', 'CANCELADO', 'REALIZADO') DEFAULT 'ATIVO',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`local_id`) REFERENCES `locais`(`id`),
    FOREIGN KEY (`celebrante_id`) REFERENCES `celebrantes`(`id`),
    UNIQUE KEY `unique_evento` (`data_casamento`, `horario_casamento`, `local_id`),
    INDEX `idx_data_casamento` (`data_casamento`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de proclamas
CREATE TABLE IF NOT EXISTS `proclamas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `agendamento_id` VARCHAR(36) NOT NULL,
    `primeiro_domingo` DATE NOT NULL,
    `segundo_domingo` DATE NOT NULL,
    `terceiro_domingo` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_agendamento` (`agendamento_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de lembretes
CREATE TABLE IF NOT EXISTS `lembretes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `agendamento_id` VARCHAR(36) NOT NULL,
    `tipo` ENUM('EMAIL', 'SMS', 'WHATSAPP') DEFAULT 'WHATSAPP',
    `data_envio` DATETIME NOT NULL,
    `mensagem` TEXT,
    `enviado` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE,
    INDEX `idx_data_envio` (`data_envio`),
    INDEX `idx_enviado` (`enviado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS `configuracoes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `chave` VARCHAR(100) NOT NULL UNIQUE,
    `valor` TEXT,
    `tipo` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    `descricao` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir configurações padrão
INSERT INTO `configuracoes` (`chave`, `valor`, `tipo`, `descricao`) VALUES
('nome_sistema', 'Sistema de Agendamento de Casamentos', 'STRING', 'Nome do sistema'),
('nome_paroquia', 'Paróquia', 'STRING', 'Nome da paróquia'),
('dias_antecedencia_lembrete', '7', 'NUMBER', 'Dias de antecedência para enviar lembretes'),
('horario_inicio_agendamento', '08:00', 'STRING', 'Horário de início dos agendamentos'),
('horario_fim_agendamento', '20:00', 'STRING', 'Horário de fim dos agendamentos'),
('intervalo_minimo_entre_casamentos', '120', 'NUMBER', 'Intervalo mínimo em minutos entre casamentos no mesmo local'),
('email_notificacao', '', 'STRING', 'Email para notificações do sistema'),
('whatsapp_paroquia', '', 'STRING', 'WhatsApp da paróquia'),
('permitir_agendamento_passado', 'false', 'BOOLEAN', 'Permitir agendamento em datas passadas'),
('dias_minimo_antecedencia', '30', 'NUMBER', 'Dias mínimos de antecedência para agendamento');

-- Inserir alguns locais padrão
INSERT INTO `locais` (`nome`, `endereco`, `capacidade`) VALUES
('IGREJA MATRIZ', 'Centro', 500),
('CAPELA NOSSA SENHORA', 'Bairro Sul', 200),
('SALÃO PAROQUIAL', 'Centro', 300);

-- Inserir alguns celebrantes padrão
INSERT INTO `celebrantes` (`nome`, `tipo`) VALUES
('PE. JOÃO SILVA', 'PADRE'),
('PE. MARCOS SANTOS', 'PADRE'),
('DC. PEDRO OLIVEIRA', 'DIÁCONO');

-- View para visualização completa dos agendamentos
CREATE OR REPLACE VIEW `view_agendamentos_completos` AS
SELECT 
    a.id,
    a.data_agendamento,
    a.nome_noiva,
    a.whatsapp_noiva,
    a.nome_noivo,
    a.whatsapp_noivo,
    a.data_casamento,
    a.horario_casamento,
    l.nome AS nome_local,
    c.nome AS nome_celebrante,
    c.tipo AS tipo_celebrante,
    a.tipo_transferencia,
    a.com_efeito_civil,
    a.observacoes,
    a.data_entrevista,
    a.mensagem_sistema,
    a.status,
    p.primeiro_domingo,
    p.segundo_domingo,
    p.terceiro_domingo
FROM agendamentos a
LEFT JOIN locais l ON a.local_id = l.id
LEFT JOIN celebrantes c ON a.celebrante_id = c.id
LEFT JOIN proclamas p ON a.id = p.agendamento_id
WHERE a.status = 'ATIVO';

-- Trigger para calcular automaticamente as datas dos proclamas
DELIMITER $$
CREATE TRIGGER calcular_proclamas 
AFTER INSERT ON agendamentos
FOR EACH ROW
BEGIN
    DECLARE primeiro_dom DATE;
    DECLARE segundo_dom DATE;
    DECLARE terceiro_dom DATE;
    DECLARE data_ref DATE;
    
    SET data_ref = NEW.data_casamento;
    
    -- Calcular o terceiro domingo antes do casamento
    SET terceiro_dom = DATE_SUB(data_ref, INTERVAL ((WEEKDAY(data_ref) + 1) % 7) DAY);
    IF terceiro_dom >= data_ref THEN
        SET terceiro_dom = DATE_SUB(terceiro_dom, INTERVAL 7 DAY);
    END IF;
    
    -- Calcular segundo e primeiro domingos
    SET segundo_dom = DATE_SUB(terceiro_dom, INTERVAL 7 DAY);
    SET primeiro_dom = DATE_SUB(segundo_dom, INTERVAL 7 DAY);
    
    INSERT INTO proclamas (agendamento_id, primeiro_domingo, segundo_domingo, terceiro_domingo)
    VALUES (NEW.id, primeiro_dom, segundo_dom, terceiro_dom);
END$$
DELIMITER ;
