const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Memoria volátil para mantener el sistema 100% funcional en Render
let estudiantesMemoria = [
    { codigo: '001', nombre: 'AXEL ESTEBAN SINAY POP', plan: 'DIARIO', nivel: 'Primaria', carrera: '1ro Primaria', seccion: 'A' },
    { codigo: '002', nombre: 'anderson rafael ixcot puluc', plan: 'DIARIO', nivel: 'Diversificado', carrera: 'Perito Contador', seccion: 'A' },
    { codigo: '0001', nombre: 'alejandro esteban calderon sinay', plan: 'FIN_DE_SEMANA', nivel: 'Primaria', carrera: '1ro Primaria', seccion: 'B' }
];
let pagosMemoria = [];

// Login Principal
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === 'admin' && password === 'admin123') {
        return res.json({ exito: true });
    }
    return res.status(401).json({ exito: false, mensaje: 'Credenciales incorrectas' });
});

// Estudiantes
app.get('/api/estudiantes/todos', (req, res) => {
    res.json(estudiantesMemoria);
});

// Inscripcion
app.post('/api/estudiantes/inscripcion', (req, res) => {
    const { codigo, nombre, plan, nivel, carrera, seccion } = req.body;
    const nuevo = { codigo: codigo || '001', nombre, plan, nivel: nivel || 'N/A', carrera: carrera || 'N/A', seccion: seccion || 'A' };
    
    estudiantesMemoria.push(nuevo);
    res.json({
        recibo: {
            noRecibo: 'REC-' + Math.floor(1000 + Math.random() * 9000),
            codigoEstudiante: nuevo.codigo,
            nombreEstudiante: nuevo.nombre,
            planInscrito: nuevo.plan,
            fecha: new Date().toLocaleDateString(),
            montoInscripcion: 350.00
        }
    });
});

// Cobros
app.post('/api/pagos/cobrar', (req, res) => {
    const { codigoEstudiante, mes, monto } = req.body;
    const est = estudiantesMemoria.find(e => e.codigo === codigoEstudiante) || { nombre: 'Estudiante' };
    const pago = { codigoEstudiante, estudiante: est.nombre, mes, monto: monto || 250, estado: 'PAGADO', fecha_pago: new Date() };
    
    pagosMemoria.push(pago);
    res.json({
        reciboPago: { estudiante: est.nombre, mes, fecha: new Date().toLocaleDateString(), monto: pago.monto }
    });
});

// Estado de cuenta
app.get('/api/estudiantes/:codigo/estado-cuenta', (req, res) => {
    const est = estudiantesMemoria.find(e => e.codigo === req.params.codigo);
    const pagos = pagosMemoria.filter(p => p.codigoEstudiante === req.params.codigo);
    if (est) res.json({ estudiante: est, historialPagos: pagos });
    else res.status(404).json({ mensaje: 'No encontrado' });
});

// Reportes
app.get('/api/reportes/morosos', (req, res) => res.json({ datos: [] }));
app.get('/api/reportes/solventes', (req, res) => res.json({ datos: estudiantesMemoria }));

// Traslados y Eliminar
app.put('/api/estudiantes/traslado', (req, res) => {
    const est = estudiantesMemoria.find(e => e.codigo === req.body.codigo);
    if (est) {
        est.carrera = req.body.nuevaCarrera;
        est.seccion = req.body.nuevaSeccion;
        return res.json({ mensaje: 'Traslado realizado' });
    }
    res.status(404).json({ error: 'No encontrado' });
});

app.delete('/api/estudiantes/:codigo', (req, res) => {
    estudiantesMemoria = estudiantesMemoria.filter(e => e.codigo !== req.params.codigo);
    res.json({ mensaje: 'Eliminado correctamente' });
});

// Entrega de la interfaz web (index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Puerto asignado por Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Colegio Firu Miau corriendo en puerto ${PORT}`));


