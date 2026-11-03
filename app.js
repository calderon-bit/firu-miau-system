const express = require('express');
const { sql, getConnection } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('user', sql.VarChar, usuario)
            .input('pass', sql.VarChar, password)
            .query('SELECT id, usuario FROM Usuarios WHERE usuario = @user AND password = @pass');

        if (result.recordset.length > 0) {
            res.json({ exito: true, mensaje: 'Bienvenido al Sistema Firu Miau', usuario: result.recordset[0] });
        } else {
            res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. REGISTRO DE INSCRIPCIÓN Y RECIBO
app.post('/api/estudiantes/inscripcion', async (req, res) => {
    const { codigo, nombre, plan, nivel, carrera, seccion } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .input('nombre', sql.VarChar, nombre)
            .input('plan', sql.VarChar, plan)
            .input('nivel', sql.VarChar, nivel || 'N/A')
            .input('carrera', sql.VarChar, carrera || 'N/A')
            .input('seccion', sql.VarChar, seccion)
            .query('INSERT INTO Estudiantes (codigo, nombre, [plan], nivel, carrera, seccion) VALUES (@codigo, @nombre, @plan, @nivel, @carrera, @seccion)');

        res.json({
            mensaje: 'Estudiante inscrito exitosamente',
            recibo: {
                noRecibo: `REC-${Math.floor(1000 + Math.random() * 9000)}`,
                codigoEstudiante: codigo,
                nombreEstudiante: nombre,
                planInscrito: plan,
                montoInscripcion: 350.00,
                fecha: new Date().toLocaleDateString()
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. COBRO DE MENSUALIDAD
app.post('/api/pagos/cobrar', async (req, res) => {
    const { codigoEstudiante, mes, monto } = req.body;
    try {
        const pool = await getConnection();

        const checkEstudiante = await pool.request()
            .input('codigo', sql.VarChar, codigoEstudiante)
            .query('SELECT * FROM Estudiantes WHERE codigo = @codigo');

        if (checkEstudiante.recordset.length === 0) {
            return res.status(404).json({ mensaje: 'Código de estudiante no encontrado' });
        }

        await pool.request()
            .input('codigo', sql.VarChar, codigoEstudiante)
            .input('mes', sql.VarChar, mes)
            .input('monto', sql.Decimal(10, 2), monto)
            .query('INSERT INTO Pagos (codigoEstudiante, mes, monto) VALUES (@codigo, @mes, @monto)');

        res.json({
            mensaje: 'Pago registrado exitosamente',
            reciboPago: {
                estudiante: checkEstudiante.recordset[0].nombre,
                mesPagado: mes,
                monto: monto,
                fecha: new Date().toLocaleDateString()
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. OBTENER TODOS LOS ESTUDIANTES
app.get('/api/estudiantes/todos', async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT codigo, nombre, [plan], nivel, carrera, seccion FROM Estudiantes');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. REPORTES DE MOROSOS Y SOLVENTES (CORREGIDO PARA ALUMNOS NUEVOS Y CON PAGOS)
app.get('/api/reportes/:tipo', async (req, res) => {
    const { tipo } = req.params;
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT E.codigo, E.nombre, E.[plan], E.nivel, E.carrera, E.seccion,
                   COUNT(P.id) AS mesesPagados
            FROM Estudiantes E
            LEFT JOIN Pagos P ON E.codigo = P.codigoEstudiante
            GROUP BY E.codigo, E.nombre, E.[plan], E.nivel, E.carrera, E.seccion
        `);

        const pagadosRequeridos = 3;
        let reporte = [];

        if (tipo === 'morosos') {
            reporte = result.recordset
                .filter(e => e.mesesPagados < pagadosRequeridos)
                .map(e => ({
                    ...e,
                    cartaAviso: `CARTA DE AVISO: Se le informa que el estudiante ${e.nombre} presenta morosidad en sus cuotas.`
                }));
        } else if (tipo === 'solventes') {
            reporte = result.recordset.filter(e => e.mesesPagados >= pagadosRequeridos);
        }

        res.json({ tipoReporte: tipo.toUpperCase(), total: reporte.length, datos: reporte });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. TRASLADOS DE CARRERA Y SECCIÓN
app.put('/api/estudiantes/traslado', async (req, res) => {
    const { codigo, nuevaCarrera, nuevaSeccion } = req.body;
    try {
        const pool = await getConnection();
        await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .input('carrera', sql.VarChar, nuevaCarrera)
            .input('seccion', sql.VarChar, nuevaSeccion)
            .query('UPDATE Estudiantes SET carrera = @carrera, seccion = @seccion WHERE codigo = @codigo');

        res.json({ mensaje: 'Traslado realizado con éxito' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. ESTADO DE CUENTA
app.get('/api/estudiantes/:codigo/estado-cuenta', async (req, res) => {
    const { codigo } = req.params;
    try {
        const pool = await getConnection();
        const estudiante = await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .query('SELECT codigo, nombre, [plan], nivel, carrera, seccion FROM Estudiantes WHERE codigo = @codigo');

        if (estudiante.recordset.length === 0) {
            return res.status(404).json({ mensaje: 'Estudiante no encontrado' });
        }

        const pagos = await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .query("SELECT mes, monto, 'PAGADO' AS estado, fecha_pago FROM Pagos WHERE codigoEstudiante = @codigo");

        res.json({
            estudiante: estudiante.recordset[0],
            historialPagos: pagos.recordset
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. ELIMINAR ESTUDIANTE Y SUS PAGOS EN SQL SERVER
app.delete('/api/estudiantes/:codigo', async (req, res) => {
    const { codigo } = req.params;
    try {
        const pool = await getConnection();

        await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .query('DELETE FROM Pagos WHERE codigoEstudiante = @codigo');

        const result = await pool.request()
            .input('codigo', sql.VarChar, codigo)
            .query('DELETE FROM Estudiantes WHERE codigo = @codigo');

        if (result.rowsAffected[0] > 0) {
            res.json({ exito: true, mensaje: 'Estudiante eliminado correctamente de la base de datos' });
        } else {
            res.status(404).json({ exito: false, mensaje: 'Estudiante no encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Firu Miau ejecutándose en http://localhost:${PORT}`);
});