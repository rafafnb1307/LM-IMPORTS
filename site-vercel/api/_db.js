// Conexão MySQL compartilhada entre as functions
const mysql = require('mysql2/promise');

module.exports = async function getDb() {
    return mysql.createConnection({
        host    : process.env.DB_HOST,
        port    : parseInt(process.env.DB_PORT || '3306'),
        database: process.env.DB_NAME,
        user    : process.env.DB_USER,
        password: process.env.DB_PASS,
    });
};
