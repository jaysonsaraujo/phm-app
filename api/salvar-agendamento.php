/**
 * Validação corrigida para telefones
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
    
    // CORREÇÃO: Validação melhorada para formato do WhatsApp
    // Remove todos os caracteres não numéricos para validação
    $telefoneNoivaLimpo = preg_replace('/\D/', '', $dados['whatsapp_noiva']);
    $telefoneNoivoLimpo = preg_replace('/\D/', '', $dados['whatsapp_noivo']);
    
    // Verifica se tem 10 ou 11 dígitos
    if (strlen($telefoneNoivaLimpo) < 10 || strlen($telefoneNoivaLimpo) > 11) {
        return [
            'valido' => false,
            'mensagem' => 'WhatsApp da noiva inválido. Digite DDD + número (10 ou 11 dígitos)'
        ];
    }
    
    if (strlen($telefoneNoivoLimpo) < 10 || strlen($telefoneNoivoLimpo) > 11) {
        return [
            'valido' => false,
            'mensagem' => 'WhatsApp do noivo inválido. Digite DDD + número (10 ou 11 dígitos)'
        ];
    }
    
    // Valida o formato com máscara (aceita com ou sem espaço após o parêntese)
    $telefoneRegex = '/^KATEX_INLINE_OPEN\d{2}KATEX_INLINE_CLOSE\s?\d{4,5}-\d{4}$/';
    
    if (!preg_match($telefoneRegex, $dados['whatsapp_noiva'])) {
        // Tenta formatar o telefone se veio sem máscara
        if (strlen($telefoneNoivaLimpo) === 10) {
            $dados['whatsapp_noiva'] = sprintf('(%s) %s-%s',
                substr($telefoneNoivaLimpo, 0, 2),
                substr($telefoneNoivaLimpo, 2, 4),
                substr($telefoneNoivaLimpo, 6)
            );
        } elseif (strlen($telefoneNoivaLimpo) === 11) {
            $dados['whatsapp_noiva'] = sprintf('(%s) %s-%s',
                substr($telefoneNoivaLimpo, 0, 2),
                substr($telefoneNoivaLimpo, 2, 5),
                substr($telefoneNoivaLimpo, 7)
            );
        }
    }
    
    if (!preg_match($telefoneRegex, $dados['whatsapp_noivo'])) {
        // Tenta formatar o telefone se veio sem máscara
        if (strlen($telefoneNoivoLimpo) === 10) {
            $dados['whatsapp_noivo'] = sprintf('(%s) %s-%s',
                substr($telefoneNoivoLimpo, 0, 2),
                substr($telefoneNoivoLimpo, 2, 4),
                substr($telefoneNoivoLimpo, 6)
            );
        } elseif (strlen($telefoneNoivoLimpo) === 11) {
            $dados['whatsapp_noivo'] = sprintf('(%s) %s-%s',
                substr($telefoneNoivoLimpo, 0, 2),
                substr($telefoneNoivoLimpo, 2, 5),
                substr($telefoneNoivoLimpo, 7)
            );
        }
    }
    
    // Resto da validação permanece igual...
    
    return ['valido' => true];
}

/**
 * Método auxiliar melhorado para limpar telefone
 */
private function limparTelefone($telefone) {
    // Remove todos os caracteres não numéricos
    $telefoneL

impo = preg_replace('/\D/', '', $telefone);
    
    // Garante que tenha 10 ou 11 dígitos
    if (strlen($telefoneLimpo) === 10 || strlen($telefoneLimpo) === 11) {
        return $telefoneLimpo;
    }
    
    return $telefone; // Retorna original se não for válido
}

/**
 * Método auxiliar para formatar telefone
 */
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
