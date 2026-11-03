// db.js - Conexión segura con manejo de errores para Render
const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'tu_password',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'ColegioFiruMiau',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Conectado a SQL Server');
        return pool;
    })
    .catch(err => {
        console.log('Modo local/memoria activado:', err.message);
        return null;
    });

module.exports = { sql, poolPromise };
