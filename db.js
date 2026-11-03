const sql = require('mssql');

const config = {
    user: 'ALEX_HACKS_SQLLogin_1',
    password: 'be4d6s6m4o',
    server: 'customs.mssql.somee.com',
    database: 'customs',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function getConnection() {
    try {
        const pool = await sql.connect(config);
        return pool;
    } catch (error) {
        console.error("Error al conectar a SQL Server:", error);
    }
}

module.exports = {
    sql,
    getConnection
};