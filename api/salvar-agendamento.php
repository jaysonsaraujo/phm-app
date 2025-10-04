<?php
/**
 * API para Salvar Agendamento de Casamento
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

class AgendamentoSalvar {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    /**
     * Salva um novo agendamento
     */
    public function salvar($dados) {
        try {
            // Inicia transação
            $this->db->beginTransaction();
            
            // Valida dados
            $validacao = $this->validarDados($dados);
            if (!$validacao['valido']) {
                throw new Exception($validacao['mensagem']);
            }
            
            // Verifica conflitos
            $conflitos = $this->verificarConflitos($dados);
            if ($conflitos['has_conflicts']) {
                throw new Exception('Existem conflitos de agendamento: ' . json_encode($conflitos['conflicts']));
            }
            
            // Prepara dados para inserção
            $dadosLimpos = $this->prepararDados($dados);
            
            // Insere agendamento
            $sql = "INSERT INTO agendamentos (
                        id,
                        nome_noiva,
                        whatsapp_noiva,
                        nome_noivo,
                        whatsapp_noivo,
                        data_casamento,
                        horario_casamento,
                        local_id,
                        padre_diacono_id,
                        transferencia_tipo,
                        com_efeito_civil,
                        observacoes,
                        data_entrevista,
                        mensagem_sistema,
                        status
                    ) VALUES (
                        :id,
                        :nome_noiva,
                        :whatsapp_noiva,
                        :nome_noivo,
                        :whatsapp_noivo,
                        :data_casamento,
                        :horario_casamento,
                        :local_id,
                        :padre_diacono_id,
                        :transferencia_tipo,
                        :com_efeito_civil,
                        :observacoes,
                        :data_entrevista,
                        :mensagem_sistema,
                        'ATIVO'
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($dadosLimpos);
            
            $agendamentoId = $dadosLimpos[':id'];
            
            // Cria lembretes automáticos
            $this->criarLembretes($agendamentoId, $dadosLimpos[':data_casamento']);
            
            // Registra log
            $this->registrarLog('AGENDAMENTO_CRIADO', 
                "Casamento agendado: {$dadosLimpos[':nome_noiva']} e {$dadosLimpos[':nome_noivo']}", 
                $agendamentoId);
            
            // Commit da transação
            $this->db->commit();
            
            return [
                'success' => true,
                'message' => 'Agendamento salvo com sucesso!',
                'agendamento_id' => $agendamentoId
            ];
            
        } catch (Exception $e) {
            // Rollback em caso de erro
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Validação de dados
     */
    private function validarDados($dados) {
        $camposObrigatorios = [
            'id' => 'ID do agendamento',
            'nome_noiva' => 'Nome da noiva',
            'whatsapp_noiva' => 'WhatsApp da noiva',
            'nome_noivo' => 'Nome do noivo',
            'whatsapp_noivo' => 'WhatsApp do noivo',
            'data_casamento' => 'Data do casamento',
            'horario_casamento' => 'Horário do casamento',
            'local_id' => 'Local da cerimônia',
            'padre_diacono_id' => 'Padre/Diácono'
        ];
        
        foreach ($camposObrigatorios as $campo => $nomeCampo) {
            if (empty($dados[$campo])) {
                return [
                    'valido' => false,
                    'mensagem' => "O campo '{$nomeCampo}' é obrigatório"
                ];
            }
        }
        
        // Validação de telefones
        $telefoneNoiva = preg_replace('/\D/', '', $dados['whatsapp_noiva']);
        $telefoneNoivo = preg_replace('/\D/', '', $dados['whatsapp_noivo']);
        
        if (strlen($telefoneNoiva) < 10 || strlen($telefoneNoiva) > 11) {
            return [
                'valido' => false,
                'mensagem' => 'WhatsApp da noiva inválido. Digite DDD + número (10 ou 11 dígitos)'
            ];
        }
        
        if (strlen($telefoneNoivo) < 10 || strlen($telefoneNoivo) > 11) {
            return [
                'valido' => false,
                'mensagem' => 'WhatsApp do noivo inválido. Digite DDD + número (10 ou 11 dígitos)'
            ];
        }
        
        // Validação de data
        $dataCasamento = strtotime($dados['data_casamento']);
        $hoje = strtotime(date('Y-m-d'));
        
        if ($dataCasamento < $hoje) {
            return [
                'valido' => false,
                'mensagem' => 'A data do casamento não pode ser no passado'
            ];
        }
        
        // Validação de antecedência
        $diasAntecedencia = ($dataCasamento - $hoje) / (60 * 60 * 24);
        $minAntecedencia = $this->getConfiguracao('dias_antecedencia_minima', 90);
        $maxAntecedencia = $this->getConfiguracao('dias_antecedencia_maxima', 365);
        
        if ($diasAntecedencia < $minAntecedencia) {
            return [
                'valido' => false,
                'mensagem' => "O casamento deve ser agendado com no mínimo {$minAntecedencia} dias de antecedência"
            ];
        }
        
        if ($diasAntecedencia > $maxAntecedencia) {
            return [
                'valido' => false,
                'mensagem' => "O casamento pode ser agendado com no máximo {$maxAntecedencia} dias de antecedência"
            ];
        }
        
        return ['valido' => true];
    }
    
    /**
     * Verifica conflitos de agendamento
     */
    private function verificarConflitos($dados) {
        $sql = "SELECT COUNT(*) FROM agendamentos 
                WHERE data_casamento = :data 
                AND horario_casamento = :horario 
                AND local_id = :local_id 
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $dados['data_casamento'],
            ':horario' => $dados['horario_casamento'],
            ':local_id' => $dados['local_id']
        ]);
        
        if ($stmt->fetchColumn() > 0) {
            return [
                'has_conflicts' => true,
                'conflicts' => ['location' => 'Local já reservado neste horário']
            ];
        }
        
        return ['has_conflicts' => false];
    }
    
    /**
     * Prepara dados para inserção
     */
    private function prepararDados($dados) {
        return [
            ':id' => $dados['id'],
            ':nome_noiva' => strtoupper(trim($dados['nome_noiva'])),
            ':whatsapp_noiva' => $dados['whatsapp_noiva'],
            ':nome_noivo' => strtoupper(trim($dados['nome_noivo'])),
            ':whatsapp_noivo' => $dados['whatsapp_noivo'],
            ':data_casamento' => $dados['data_casamento'],
            ':horario_casamento' => $dados['horario_casamento'],
            ':local_id' => $dados['local_id'],
            ':padre_diacono_id' => $dados['padre_diacono_id'],
            ':transferencia_tipo' => $dados['transferencia_tipo'] ?? 'NAO',
            ':com_efeito_civil' => $dados['com_efeito_civil'] ?? 0,
            ':observacoes' => !empty($dados['observacoes']) ? strtoupper(trim($dados['observacoes'])) : null,
            ':data_entrevista' => !empty($dados['data_entrevista']) ? $dados['data_entrevista'] : null,
            ':mensagem_sistema' => !empty($dados['mensagem_sistema']) ? strtoupper(trim($dados['mensagem_sistema'])) : null
        ];
    }
    
    /**
     * Cria lembretes automáticos
     */
    private function criarLembretes($agendamentoId, $dataCasamento) {
        $diasLembreteEntrevista = $this->getConfiguracao('dias_lembrete_entrevista', 7);
        $diasLembreteCasamento = $this->getConfiguracao('dias_lembrete_casamento', 3);
        
        $lembretes = [
            [
                'tipo' => 'ENTREVISTA',
                'dias_antes' => $diasLembreteEntrevista,
                'mensagem' => 'Lembrete: Agendar entrevista com os noivos'
            ],
            [
                'tipo' => 'CASAMENTO',
                'dias_antes' => $diasLembreteCasamento,
                'mensagem' => 'Lembrete: Casamento se aproxima'
            ]
        ];
        
        foreach ($lembretes as $lembrete) {
            $dataLembrete = date('Y-m-d H:i:s', strtotime($dataCasamento . " -{$lembrete['dias_antes']} days"));
            
            $sql = "INSERT INTO lembretes (agendamento_id, tipo_lembrete, data_lembrete, mensagem) 
                    VALUES (:agendamento_id, :tipo, :data_lembrete, :mensagem)";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':agendamento_id' => $agendamentoId,
                ':tipo' => $lembrete['tipo'],
                ':data_lembrete' => $dataLembrete,
                ':mensagem' => $lembrete['mensagem']
            ]);
        }
    }
    
    /**
     * Registra atividade no log
     */
    private function registrarLog($acao, $descricao, $agendamentoId = null) {
        $sql = "INSERT INTO log_atividades (acao, descricao, agendamento_id, ip_address, user_agent) 
                VALUES (:acao, :descricao, :agendamento_id, :ip_address, :user_agent)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':acao' => $acao,
            ':descricao' => $descricao,
            ':agendamento_id' => $agendamentoId,
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    }
    
    /**
     * Obtém configuração do sistema
     */
    private function getConfiguracao($chave, $padrao = null) {
        $sql = "SELECT valor FROM configuracoes WHERE chave = :chave";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':chave' => $chave]);
        
        $resultado = $stmt->fetch();
        return $resultado ? $resultado['valor'] : $padrao;
    }
}

// Processa a requisição
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    $dados = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode([
            'success' => false,
            'message' => 'Dados inválidos recebidos'
        ]);
        exit;
    }
    
    $salvar = new AgendamentoSalvar();
    $resultado = $salvar->salvar($dados);
    
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    
} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido. Use POST'
    ]);
}
?>
