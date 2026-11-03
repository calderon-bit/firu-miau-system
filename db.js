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

// Se maneja el fallo de conexión para evitar que la aplicación se detenga en Render
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Conectado exitosamente a SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Advertencia: No se pudo conectar a SQL Server:', err.message);
        return null;
    });

module.exports = { sql, poolPromise };
