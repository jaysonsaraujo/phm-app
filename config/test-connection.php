<?php
/**
 * Arquivo de teste de conexão com banco de dados
 * Use este arquivo para verificar se a conexão está funcionando
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Teste de Conexão com Banco de Dados</h2>";

try {
    require_once 'database.php';
    
    $db = getDB();
    
    echo "<p style='color: green;'>✓ Conexão estabelecida com sucesso!</p>";
    
    // Testa se as tabelas existem
    $tables = ['locais_cerimonias', 'padres_diaconos', 'agendamentos', 'configuracoes'];
    
    echo "<h3>Verificando tabelas:</h3>";
    foreach ($tables as $table) {
        $sql = "SHOW TABLES LIKE :table";
        $stmt = $db->prepare($sql);
        $stmt->execute([':table' => $table]);
        
        if ($stmt->rowCount() > 0) {
            echo "<p style='color: green;'>✓ Tabela '$table' existe</p>";
            
            // Conta registros
            $sql = "SELECT COUNT(*) as total FROM $table";
            $stmt = $db->query($sql);
            $result = $stmt->fetch();
            echo "<p style='margin-left: 20px;'>→ Total de registros: {$result['total']}</p>";
        } else {
            echo "<p style='color: red;'>✗ Tabela '$table' NÃO existe</p>";
        }
    }
    
    // Testa inserção em locais_cerimonias
    echo "<h3>Teste de Inserção:</h3>";
    
    $testLocal = "LOCAL_TESTE_" . time();
    $sql = "INSERT INTO locais_cerimonias (nome_local, endereco, capacidade, ativo) 
            VALUES (:nome, :endereco, :capacidade, 1)";
    
    $stmt = $db->prepare($sql);
    $result = $stmt->execute([
        ':nome' => $testLocal,
        ':endereco' => 'Endereço de Teste',
        ':capacidade' => 100
    ]);
    
    if ($result) {
        $id = $db->lastInsertId();
        echo "<p style='color: green;'>✓ Inserção teste realizada com sucesso (ID: $id)</p>";
        
        // Remove o registro de teste
        $sql = "DELETE FROM locais_cerimonias WHERE id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute([':id' => $id]);
        echo "<p style='color: blue;'>→ Registro de teste removido</p>";
    } else {
        echo "<p style='color: red;'>✗ Erro na inserção de teste</p>";
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>✗ Erro de conexão: " . $e->getMessage() . "</p>";
    echo "<pre>" . $e->getTraceAsString() . "</pre>";
}
?>
