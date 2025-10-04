<?php
/**
 * Configuração de conexão com o banco de dados MySQL
 * Sistema de Agendamento de Casamentos
 */

class Database {
    private static $instance = null;
    private $connection;
    
    // Configurações do banco de dados
    private $host = 'phmpsj_mysql-phm-app';
    private $port = '3306';
    private $database = 'db-phm-app';
    private $username = 'userphm';
    private $password = 'twU7oGKjs9M33fox76Fr9AnLBFgppTMb3MeWif37Zo8cXw55QYKqcZrV8k24pset';
    
    private function __construct() {
        try {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->database};charset=utf8mb4";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];
            
            $this->connection = new PDO($dsn, $this->username, $this->password, $options);
            
        } catch(PDOException $e) {
            error_log("Erro de conexão com banco de dados: " . $e->getMessage());
            throw new Exception("Erro ao conectar com o banco de dados");
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    // Prevenir clonagem
    private function __clone() {}
    
    // Prevenir deserialização
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
}

// Função helper para obter conexão rapidamente
function getDB() {
    return Database::getInstance()->getConnection();
}
?>
