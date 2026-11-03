const express = require('express');
const path = require('path');
const { sql, poolPromise } = require('./db');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Memoria volátil para respaldar estudiantes si la base de datos no está disponible
let estudiantesMemoria = [];
let pagosMemoria = [];

// Endpoint de Inicio de Sesión Principal
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === 'admin' && password === 'admin123') {
        return res.json({ exito: true, mensaje: 'Autenticación exitosa' });
    }
    return res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
});

// Endpoint para obtener todos los estudiantes
app.get('/api/estudiantes/todos', async (req, res) => {
    try {
        const pool = await poolPromise;
        if (pool) {
            const result = await pool.request().query('SELECT * FROM estudiantes');
            return res.json(result.recordset);
        }
        res.json(estudiantesMemoria);
    } catch (err) {
        res.json(estudiantesMemoria);
    }
});

// Endpoint para registrar inscripción
app.post('/api/estudiantes/inscripcion', async (req, res) => {
    const { codigo, nombre, plan, nivel, carrera, seccion } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const nuevoEstudiante = {
        codigo: codigo || '001',
        nombre,
        plan,
        nivel: nivel || 'N/A',
        carrera: carrera || 'N/A',
        seccion: seccion || 'A'
    };

    try {
        const pool = await poolPromise;
        if (pool) {
            await pool.request()
                .input('codigo', sql.VarChar, nuevoEstudiante.codigo)
                .input('nombre', sql.VarChar, nuevoEstudiante.nombre)
                .input('plan', sql.VarChar, nuevoEstudiante.plan)
                .input('nivel', sql.VarChar, nuevoEstudiante.nivel)
                .input('carrera', sql.VarChar, nuevoEstudiante.carrera)
                .input('seccion', sql.VarChar, nuevoEstudiante.seccion)
                .query('INSERT INTO estudiantes (codigo, nombre, [plan], nivel, carrera, seccion) VALUES (@codigo, @nombre, @plan, @nivel, @carrera, @seccion)');
        }
    } catch (err) {
        console.error('Guardando en memoria local:', err.message);
    }

    estudiantesMemoria.push(nuevoEstudiante);

    res.json({
        mensaje: 'Inscripción procesada',
        recibo: {
            noRecibo: 'REC-' + Math.floor(1000 + Math.random() * 9000),
            codigoEstudiante: nuevoEstudiante.codigo,
            nombreEstudiante: nuevoEstudiante.nombre,
            planInscrito: nuevoEstudiante.plan,
            fecha: new Date().toLocaleDateString(),
            montoInscripcion: 350.00
        }
    });
});

// Endpoint para procesar cobros
app.post('/api/pagos/cobrar', async (req, res) => {
    const { codigoEstudiante, mes, monto } = req.body;

    const estudiante = estudiantesMemoria.find(e => e.codigo === codigoEstudiante) || { nombre: 'Estudiante Registrado' };

    const nuevoPago = {
        codigoEstudiante,
        estudiante: estudiante.nombre,
        mes,
        monto: monto || 250,
        estado: 'PAGADO',
        fecha_pago: new Date()
    };

    try {
        const pool = await poolPromise;
        if (pool) {
            await pool.request()
                .input('codigoEstudiante', sql.VarChar, codigoEstudiante)
                .input('mes', sql.VarChar, mes)
                .input('monto', sql.Decimal(10, 2), nuevoPago.monto)
                .query('INSERT INTO pagos (codigoEstudiante, mes, monto, estado, fecha_pago) VALUES (@codigoEstudiante, @mes, @monto, \'PAGADO\', GETDATE())');
        }
    } catch (err) {
        console.error('Guardando pago en memoria local:', err.message);
    }

    pagosMemoria.push(nuevoPago);

    res.json({
        mensaje: 'Pago registrado con éxito',
        reciboPago: {
            estudiante: estudiante.nombre,
            mes: mes,
            fecha: new Date().toLocaleDateString(),
            monto: nuevoPago.monto
        }
    });
});

// Endpoint Estado de Cuenta por Estudiante
app.get('/api/estudiantes/:codigo/estado-cuenta', async (req, res) => {
    const codigo = req.params.codigo;
    try {
        const pool = await poolPromise;
        if (pool) {
            const resEst = await pool.request()
                .input('codigo', sql.VarChar, codigo)
                .query('SELECT * FROM estudiantes WHERE codigo = @codigo');

            const resPagos = await pool.request()
                .input('codigo', sql.VarChar, codigo)
                .query('SELECT * FROM pagos WHERE codigoEstudiante = @codigo');

            if (resEst.recordset.length > 0) {
                return res.json({
                    estudiante: resEst.recordset[0],
                    historialPagos: resPagos.recordset
                });
            }
        }
    } catch (err) {
        console.error('Consultando estado de cuenta local');
    }

    const estMem = estudiantesMemoria.find(e => e.codigo === codigo);
    const pagosMem = pagosMemoria.filter(p => p.codigoEstudiante === codigo);

    if (estMem) {
        res.json({ estudiante: estMem, historialPagos: pagosMem });
    } else {
        res.status(404).json({ mensaje: 'Estudiante no encontrado' });
    }
});

// Endpoint Reporte de Morosos
app.get('/api/reportes/morosos', async (req, res) => {
    res.json({ datos: [] });
});

// Endpoint Reporte de Solventes
app.get('/api/reportes/solventes', async (req, res) => {
    res.json({ datos: estudiantesMemoria });
});

// Endpoint Traslado de Carrera / Sección
app.put('/api/estudiantes/traslado', async (req, res) => {
    const { codigo, nuevaCarrera, nuevaSeccion } = req.body;
    const est = estudiantesMemoria.find(e => e.codigo === codigo);
    if (est) {
        est.carrera = nuevaCarrera;
        est.seccion = nuevaSeccion;
        return res.json({ mensaje: 'Traslado realizado exitosamente' });
    }
    res.status(404).json({ error: 'Estudiante no encontrado' });
});

// Endpoint Eliminar Estudiante
app.delete('/api/estudiantes/:codigo', async (req, res) => {
    const codigo = req.params.codigo;
    estudiantesMemoria = estudiantesMemoria.filter(e => e.codigo !== codigo);
    pagosMemoria = pagosMemoria.filter(p => p.codigoEstudiante !== codigo);
    res.json({ mensaje: `Estudiante ${codigo} eliminado correctamente` });
});

// Ruta principal para entregar la interfaz web
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ESCUCHAR EN EL PUERTO DINÁMICO DE RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Firu Miau escuchando en el puerto ${PORT}`);
});
