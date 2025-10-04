<?php
/**
 * API para Adicionar Novo Celebrante (Padre/Diácono)
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class AdicionarCelebrante {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    public function adicionar($dados) {
        try {
            // Inicia transação
            $this->db->beginTransaction();
            
            // Valida dados obrigatórios
            if (empty($dados['nome_completo'])) {
                throw new Exception('Nome completo é obrigatório');
            }
            
            if (empty($dados['tipo']) || !in_array($dados['tipo'], ['PADRE', 'DIÁCONO'])) {
                throw new Exception('Tipo deve ser PADRE ou DIÁCONO');
            }
            
            // Formata o nome em maiúsculas
            $nomeCompleto = strtoupper(trim($dados['nome_completo']));
            
            // Verifica se já existe um celebrante com este nome
            $sql = "SELECT COUNT(*) as total FROM padres_diaconos 
                    WHERE UPPER(nome_completo) = :nome_completo";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':nome_completo' => $nomeCompleto]);
            $resultado = $stmt->fetch();
            
            if ($resultado['total'] > 0) {
                throw new Exception('Já existe um celebrante com este nome');
            }
            
            // Valida e formata telefone se fornecido
            $telefone = null;
            if (!empty($dados['telefone'])) {
                $telefone = $this->limparTelefone($dados['telefone']);
                
                // Valida formato do telefone
                if (strlen($telefone) !== 10 && strlen($telefone) !== 11) {
                    throw new Exception('Telefone inválido. Use formato com DDD (10 ou 11 dígitos)');
                }
            }
            
            // Valida email se fornecido
            $email = null;
            if (!empty($dados['email'])) {
                $email = strtolower(trim($dados['email']));
                
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    throw new Exception('Email inválido');
                }
            }
            
            // Insere o novo celebrante
            $sql = "INSERT INTO padres_diaconos (
                        nome_completo,
                        tipo,
                        telefone,
                        email,
                        ativo,
                        created_at,
                        updated_at
                    ) VALUES (
                        :nome_completo,
                        :tipo,
                        :telefone,
                        :email,
                        1,
                        NOW(),
                        NOW()
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':nome_completo' => $nomeCompleto,
                ':tipo' => $dados['tipo'],
                ':telefone' => $telefone,
                ':email' => $email
            ]);
            
            $celebranteId = $this->db->lastInsertId();
            
            // Registra no log
            $this->registrarLog('NOVO_CELEBRANTE', 
                "{$dados['tipo']} '{$nomeCompleto}' adicionado ao sistema", 
                $celebranteId);
            
            // Confirma transação
            $this->db->commit();
            
            // Busca o celebrante inserido para retornar
            $sql = "SELECT * FROM padres_diaconos WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $celebranteId]);
            $celebrante = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Formata telefone para exibição
            if ($celebrante['telefone']) {
                $celebrante['telefone_formatado'] = $this->formatarTelefone($celebrante['telefone']);
            }
            
            return [
                'success' => true,
                'message' => 'Celebrante adicionado com sucesso',
                'celebrantId' => $celebranteId,
                'celebrant' => $celebrante
            ];
            
        } catch (Exception $e) {
            // Desfaz transação em caso de erro
            $this->db->rollBack();
            
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    private function limparTelefone($telefone) {
        // Remove todos os caracteres não numéricos
        return preg_replace('/\D/', '', $telefone);
    }
    
    private function formatarTelefone($telefone) {
        $telefoneLimpo = preg_replace('/\D/', '', $telefone);
        
        if (strlen($telefoneLimpo) === 11) {
            return sprintf('(%s) %s-%s',
                substr($telefoneLimpo, 0, 2),
                substr($telefoneLimpo, 2, 5),
                substr($telefoneLimpo, 7)
            );
        } elseif (strlen($telefoneLimpo) === 10) {
            return sprintf('(%s) %s-%s',
                substr($telefoneLimpo, 0, 2),
                substr($telefoneLimpo, 2, 4),
                substr($telefoneLimpo, 6)
            );
        }
        
        return $telefone;
    }
    
    private function registrarLog($acao, $descricao, $celebranteId = null) {
        try {
            $sql = "INSERT INTO log_atividades (
                        acao,
                        descricao,
                        ip_address,
                        user_agent,
                        created_at
                    ) VALUES (
                        :acao,
                        :descricao,
                        :ip_address,
                        :user_agent,
                        NOW()
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':acao' => $acao,
                ':descricao' => $descricao . " (ID: {$celebranteId})",
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
        } catch (Exception $e) {
            // Log é opcional, não interrompe o processo
            error_log("Erro ao registrar log: " . $e->getMessage());
        }
    }
}

// Processa a requisição
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Obtém dados JSON do corpo da requisição
    $json = file_get_contents('php://input');
    $dados = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode([
            'success' => false,
            'message' => 'Dados inválidos recebidos. Erro: ' . json_last_error_msg()
        ]);
        exit;
    }
    
    // Adiciona o celebrante
    $adicionarCelebrante = new AdicionarCelebrante();
    $resultado = $adicionarCelebrante->adicionar($dados);
    
    // Retorna resposta
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido. Use POST'
    ]);
}
?>
