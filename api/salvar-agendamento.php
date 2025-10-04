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

// Classe para gerenciar agendamentos
class AgendamentoManager {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    /**
     * Salva um novo agendamento
     */
    public function salvarAgendamento($dados) {
        try {
            // Inicia transação
            $this->db->beginTransaction();
            
            // Valida dados obrigatórios
            $validacao = $this->validarDados($dados);
            if (!$validacao['valido']) {
                throw new Exception($validacao['mensagem']);
            }
            
            // Verifica conflitos
            $conflitos = $this->verificarConflitos($dados);
            if ($conflitos['tem_conflito']) {
                throw new Exception($conflitos['mensagem']);
            }
            
            // Verifica duplicidade de pessoas
            $duplicidade = $this->verificarDuplicidadePessoas($dados);
            if ($duplicidade['tem_duplicidade']) {
                throw new Exception($duplicidade['mensagem']);
            }
            
            // Prepara dados para inserção
            $dadosPreparados = $this->prepararDados($dados);
            
            // Insere o agendamento
            $sql = "INSERT INTO agendamentos (
                        id,
                        data_agendamento,
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
                        :data_agendamento,
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
            $stmt->execute($dadosPreparados);
            
            // Obtém o ID inserido (se não foi fornecido)
            $agendamentoId = $dadosPreparados[':id'] ?: $this->db->lastInsertId();
            
            // Insere os proclames
            $this->inserirProclames($agendamentoId, $dados['proclames']);
            
            // Cria lembretes automáticos
            $this->criarLembretes($agendamentoId, $dados);
            
            // Registra no log
            $this->registrarLog('NOVO_AGENDAMENTO', 
                "Agendamento criado para {$dados['nome_noiva']} e {$dados['nome_noivo']}", 
                $agendamentoId);
            
            // Confirma transação
            $this->db->commit();
            
            return [
                'success' => true,
                'message' => 'Agendamento salvo com sucesso!',
                'agendamento_id' => $agendamentoId
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
    
    /**
     * Valida dados obrigatórios
     */
    private function validarDados($dados) {
        $camposObrigatorios = [
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
                    'mensagem' => "O campo '{$nomeCampo}' é obrigatório."
                ];
            }
        }
        
        // Valida formato do WhatsApp
        $telefoneRegex = '/^KATEX_INLINE_OPEN\d{2}KATEX_INLINE_CLOSE\s?\d{4,5}-\d{4}$/';
        if (!preg_match($telefoneRegex, $dados['whatsapp_noiva'])) {
            return [
                'valido' => false,
                'mensagem' => 'WhatsApp da noiva em formato inválido. Use: (00) 00000-0000'
            ];
        }
        
        if (!preg_match($telefoneRegex, $dados['whatsapp_noivo'])) {
            return [
                'valido' => false,
                'mensagem' => 'WhatsApp do noivo em formato inválido. Use: (00) 00000-0000'
            ];
        }
        
        // Valida data do casamento
        $dataCasamento = new DateTime($dados['data_casamento']);
        $hoje = new DateTime();
        $hoje->setTime(0, 0, 0);
        
        if ($dataCasamento < $hoje) {
            return [
                'valido' => false,
                'mensagem' => 'A data do casamento não pode ser no passado.'
            ];
        }
        
        // Valida antecedência mínima e máxima
        $diasAntecedenciaMinima = $this->getConfiguracao('dias_antecedencia_minima', 90);
        $diasAntecedenciaMaxima = $this->getConfiguracao('dias_antecedencia_maxima', 365);
        
        $dataMinima = clone $hoje;
        $dataMinima->add(new DateInterval("P{$diasAntecedenciaMinima}D"));
        
        $dataMaxima = clone $hoje;
        $dataMaxima->add(new DateInterval("P{$diasAntecedenciaMaxima}D"));
        
        if ($dataCasamento < $dataMinima) {
            return [
                'valido' => false,
                'mensagem' => "O casamento deve ser agendado com no mínimo {$diasAntecedenciaMinima} dias de antecedência."
            ];
        }
        
        if ($dataCasamento > $dataMaxima) {
            return [
                'valido' => false,
                'mensagem' => "O casamento pode ser agendado com no máximo {$diasAntecedenciaMaxima} dias de antecedência."
            ];
        }
        
        // Valida horário
        $horario = $dados['horario_casamento'];
        if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $horario)) {
            return [
                'valido' => false,
                'mensagem' => 'Horário inválido.'
            ];
        }
        
        // Valida horário permitido
        $horarioInicio = $this->getConfiguracao('horario_inicio_agendamento', '08:00');
        $horarioFim = $this->getConfiguracao('horario_fim_agendamento', '20:00');
        
        if ($horario < $horarioInicio || $horario > $horarioFim) {
            return [
                'valido' => false,
                'mensagem' => "O horário deve estar entre {$horarioInicio} e {$horarioFim}."
            ];
        }
        
        return ['valido' => true];
    }
    
    /**
     * Verifica conflitos de agendamento
     */
    private function verificarConflitos($dados) {
        $dataCasamento = $dados['data_casamento'];
        $horario = $dados['horario_casamento'];
        $localId = $dados['local_id'];
        $celebranteId = $dados['padre_diacono_id'];
        
        // Duração da cerimônia e intervalo entre cerimônias
        $duracaoCerimonia = $this->getConfiguracao('duracao_cerimonia_minutos', 60);
        $intervaloMinimo = $this->getConfiguracao('intervalo_entre_cerimonias', 30);
        
        // Calcula horário de início e fim considerando intervalo
        $horaInicio = new DateTime("{$dataCasamento} {$horario}");
        $horaFim = clone $horaInicio;
        $horaFim->add(new DateInterval("PT{$duracaoCerimonia}M"));
        
        $horaInicioComIntervalo = clone $horaInicio;
        $horaInicioComIntervalo->sub(new DateInterval("PT{$intervaloMinimo}M"));
        
        $horaFimComIntervalo = clone $horaFim;
        $horaFimComIntervalo->add(new DateInterval("PT{$intervaloMinimo}M"));
        
        // Verifica conflito de local
        $sql = "SELECT COUNT(*) as total 
                FROM agendamentos 
                WHERE data_casamento = :data 
                AND local_id = :local_id 
                AND status = 'ATIVO'
                AND (
                    (horario_casamento >= :hora_inicio1 AND horario_casamento < :hora_fim1)
                    OR 
                    (DATE_ADD(CONCAT(data_casamento, ' ', horario_casamento), INTERVAL :duracao MINUTE) > :hora_inicio2 
                     AND horario_casamento < :hora_fim2)
                )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $dataCasamento,
            ':local_id' => $localId,
            ':hora_inicio1' => $horaInicioComIntervalo->format('H:i'),
            ':hora_fim1' => $horaFimComIntervalo->format('H:i'),
            ':duracao' => $duracaoCerimonia,
            ':hora_inicio2' => $horaInicio->format('Y-m-d H:i:s'),
            ':hora_fim2' => $horaFim->format('Y-m-d H:i:s')
        ]);
        
        $resultado = $stmt->fetch();
        
        if ($resultado['total'] > 0) {
            return [
                'tem_conflito' => true,
                'mensagem' => 'Já existe um casamento agendado neste local para este horário ou muito próximo dele. Por favor, escolha outro horário com pelo menos ' . ($duracaoCerimonia + $intervaloMinimo) . ' minutos de diferença.'
            ];
        }
        
        // Verifica conflito de celebrante
        $sql = "SELECT COUNT(*) as total 
                FROM agendamentos 
                WHERE data_casamento = :data 
                AND padre_diacono_id = :celebrante_id 
                AND status = 'ATIVO'
                AND (
                    (horario_casamento >= :hora_inicio1 AND horario_casamento < :hora_fim1)
                    OR 
                    (DATE_ADD(CONCAT(data_casamento, ' ', horario_casamento), INTERVAL :duracao MINUTE) > :hora_inicio2 
                     AND horario_casamento < :hora_fim2)
                )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':data' => $dataCasamento,
            ':celebrante_id' => $celebranteId,
            ':hora_inicio1' => $horaInicioComIntervalo->format('H:i'),
            ':hora_fim1' => $horaFimComIntervalo->format('H:i'),
            ':duracao' => $duracaoCerimonia,
            ':hora_inicio2' => $horaInicio->format('Y-m-d H:i:s'),
            ':hora_fim2' => $horaFim->format('Y-m-d H:i:s')
        ]);
        
        $resultado = $stmt->fetch();
        
        if ($resultado['total'] > 0) {
            return [
                'tem_conflito' => true,
                'mensagem' => 'O celebrante já tem um compromisso neste horário ou muito próximo dele. Por favor, escolha outro horário ou outro celebrante.'
            ];
        }
        
        return ['tem_conflito' => false];
    }
    
    /**
     * Verifica duplicidade de pessoas
     */
    private function verificarDuplicidadePessoas($dados) {
        $dataCasamento = $dados['data_casamento'];
        $nomeNoiva = $dados['nome_noiva'];
        $nomeNoivo = $dados['nome_noivo'];
        
        // Verifica se a noiva já tem casamento marcado
        $sql = "SELECT COUNT(*) as total, 
                GROUP_CONCAT(CONCAT(DATE_FORMAT(data_casamento, '%d/%m/%Y'), ' às ', 
                TIME_FORMAT(horario_casamento, '%H:%i')) SEPARATOR ', ') as datas
                FROM agendamentos 
                WHERE (nome_noiva = :nome OR nome_noivo = :nome2)
                AND data_casamento >= CURDATE()
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':nome' => $nomeNoiva,
            ':nome2' => $nomeNoiva
        ]);
        
        $resultado = $stmt->fetch();
        
        if ($resultado['total'] > 0) {
            return [
                'tem_duplicidade' => true,
                'mensagem' => "A noiva {$nomeNoiva} já possui casamento(s) marcado(s) em: {$resultado['datas']}"
            ];
        }
        
        // Verifica se o noivo já tem casamento marcado
        $stmt->execute([
            ':nome' => $nomeNoivo,
            ':nome2' => $nomeNoivo
        ]);
        
        $resultado = $stmt->fetch();
        
        if ($resultado['total'] > 0) {
            return [
                'tem_duplicidade' => true,
                'mensagem' => "O noivo {$nomeNoivo} já possui casamento(s) marcado(s) em: {$resultado['datas']}"
            ];
        }
        
        return ['tem_duplicidade' => false];
    }
    
    /**
     * Prepara dados para inserção
     */
    private function prepararDados($dados) {
        // Gera UUID se não fornecido
        if (empty($dados['id'])) {
            $dados['id'] = $this->generateUUID();
        }
        
        return [
            ':id' => $dados['id'],
            ':data_agendamento' => $dados['data_agendamento'] ?? date('Y-m-d H:i:s'),
            ':nome_noiva' => strtoupper(trim($dados['nome_noiva'])),
            ':whatsapp_noiva' => $this->limparTelefone($dados['whatsapp_noiva']),
            ':nome_noivo' => strtoupper(trim($dados['nome_noivo'])),
            ':whatsapp_noivo' => $this->limparTelefone($dados['whatsapp_noivo']),
            ':data_casamento' => $dados['data_casamento'],
            ':horario_casamento' => $dados['horario_casamento'],
            ':local_id' => intval($dados['local_id']),
            ':padre_diacono_id' => intval($dados['padre_diacono_id']),
            ':transferencia_tipo' => $dados['transferencia_tipo'] ?? 'NAO',
            ':com_efeito_civil' => intval($dados['com_efeito_civil'] ?? 0),
            ':observacoes' => !empty($dados['observacoes']) ? strtoupper(trim($dados['observacoes'])) : null,
            ':data_entrevista' => !empty($dados['data_entrevista']) ? $dados['data_entrevista'] : null,
            ':mensagem_sistema' => !empty($dados['mensagem_sistema']) ? strtoupper(trim($dados['mensagem_sistema'])) : null
        ];
    }
    
    /**
     * Insere datas dos proclames
     */
    private function inserirProclames($agendamentoId, $proclames) {
        $sql = "INSERT INTO proclames (
                    agendamento_id,
                    primeiro_domingo,
                    segundo_domingo,
                    terceiro_domingo
                ) VALUES (
                    :agendamento_id,
                    :primeiro_domingo,
                    :segundo_domingo,
                    :terceiro_domingo
                )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':agendamento_id' => $agendamentoId,
            ':primeiro_domingo' => $proclames['primeiro_domingo'],
            ':segundo_domingo' => $proclames['segundo_domingo'],
            ':terceiro_domingo' => $proclames['terceiro_domingo']
        ]);
    }
    
    /**
     * Cria lembretes automáticos
     */
    private function criarLembretes($agendamentoId, $dados) {
        $lembretes = [];
        
        // Lembrete da entrevista
        if (!empty($dados['data_entrevista'])) {
            $diasAntesEntrevista = $this->getConfiguracao('dias_lembrete_entrevista', 7);
            $dataLembrete = new DateTime($dados['data_entrevista']);
            $dataLembrete->sub(new DateInterval("P{$diasAntesEntrevista}D"));
            
            $lembretes[] = [
                'tipo' => 'ENTREVISTA',
                'data' => $dataLembrete->format('Y-m-d 09:00:00'),
                'mensagem' => "Entrevista marcada para {$dados['data_entrevista']} - {$dados['nome_noiva']} e {$dados['nome_noivo']}"
            ];
        }
        
        // Lembrete do casamento
        $diasAntesCasamento = $this->getConfiguracao('dias_lembrete_casamento', 3);
        $dataLembreteCasamento = new DateTime($dados['data_casamento']);
        $dataLembreteCasamento->sub(new DateInterval("P{$diasAntesCasamento}D"));
        
        $lembretes[] = [
            'tipo' => 'CASAMENTO',
            'data' => $dataLembreteCasamento->format('Y-m-d 09:00:00'),
            'mensagem' => "Casamento em {$dados['data_casamento']} às {$dados['horario_casamento']} - {$dados['nome_noiva']} e {$dados['nome_noivo']}"
        ];
        
        // Lembretes dos proclames
        if (!empty($dados['proclames'])) {
            foreach (['primeiro_domingo', 'segundo_domingo', 'terceiro_domingo'] as $index => $proclame) {
                $dataProclame = new DateTime($dados['proclames'][$proclame]);
                $dataProclame->sub(new DateInterval('P2D')); // 2 dias antes
                
                $lembretes[] = [
                    'tipo' => 'PROCLAME',
                    'data' => $dataProclame->format('Y-m-d 09:00:00'),
                    'mensagem' => "Proclame " . ($index + 1) . " no domingo {$dados['proclames'][$proclame]} - {$dados['nome_noiva']} e {$dados['nome_noivo']}"
                ];
            }
        }
        
        // Insere os lembretes
        $sql = "INSERT INTO lembretes (
                    agendamento_id,
                    tipo_lembrete,
                    data_lembrete,
                    mensagem
                ) VALUES (
                    :agendamento_id,
                    :tipo,
                    :data,
                    :mensagem
                )";
        
        $stmt = $this->db->prepare($sql);
        
        foreach ($lembretes as $lembrete) {
            $stmt->execute([
                ':agendamento_id' => $agendamentoId,
                ':tipo' => $lembrete['tipo'],
                ':data' => $lembrete['data'],
                ':mensagem' => $lembrete['mensagem']
            ]);
        }
    }
    
    /**
     * Registra atividade no log
     */
    private function registrarLog($acao, $descricao, $agendamentoId = null) {
        $sql = "INSERT INTO log_atividades (
                    acao,
                    descricao,
                    agendamento_id,
                    ip_address,
                    user_agent
                ) VALUES (
                    :acao,
                    :descricao,
                    :agendamento_id,
                    :ip_address,
                    :user_agent
                )";
        
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
    
    /**
     * Gera UUID único
     */
    private function generateUUID() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
    
    /**
     * Limpa formatação do telefone
     */
    private function limparTelefone($telefone) {
        return preg_replace('/[^0-9]/', '', $telefone);
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
            'message' => 'Dados inválidos recebidos'
        ]);
        exit;
    }
    
    // Processa o agendamento
    $manager = new AgendamentoManager();
    $resultado = $manager->salvarAgendamento($dados);
    
    // Retorna resposta
    echo json_encode($resultado);
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido'
    ]);
}
?>
