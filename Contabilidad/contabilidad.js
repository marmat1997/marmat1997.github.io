// ============================================================
// Contabilidad personal — Marvin Matias
// Acceso protegido por clave numérica (protección simbólica en
// el cliente, no reemplaza seguridad real: el sitio es público).
// ============================================================

const CLAVE_CORRECTA = "41051997";
const CLAVE_MAXIMA_LONGITUD = 8;
const LLAVE_SESION = "contabilidad_unlocked";
const LLAVE_DATOS = "contabilidad_movimientos";
const LLAVE_SEED = "contabilidad_seed_v1";

const pantallaAcceso = document.getElementById("pantalla-acceso");
const appContabilidad = document.getElementById("app-contabilidad");
const formAcceso = document.getElementById("form-acceso");
const inputClave = document.getElementById("input-clave");
const accesoError = document.getElementById("acceso-error");
const accesoCaja = document.querySelector(".acceso-caja");
const btnBloquear = document.getElementById("btn-bloquear");

// ---------- Solo permitir dígitos en el campo de clave ----------
inputClave.addEventListener("input", () => {
  inputClave.value = inputClave.value
    .replace(/[^0-9]/g, "")
    .slice(0, CLAVE_MAXIMA_LONGITUD);
});

// Bloquea cualquier tecla que no sea dígito, backspace, tab, flechas, etc.
inputClave.addEventListener("keydown", (e) => {
  const permitidas = [
    "Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight",
    "ArrowUp", "ArrowDown", "Home", "End", "Enter",
  ];
  if (permitidas.includes(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
});

function desbloquear() {
  pantallaAcceso.hidden = true;
  appContabilidad.hidden = false;
  sessionStorage.setItem(LLAVE_SESION, "1");
  sembrarDatosHistoricos();
  renderTodo();
}

// ============================================================
// Datos históricos (ene–sep 2026) tomados del resumen financiero
// previo. Se cargan UNA sola vez, solo si todavía no hay ningún
// movimiento guardado en este navegador — así no pisa nada que
// Marvin ya haya capturado a mano.
// Nota: como el resumen original solo traía totales por mes y
// categoría (no el día exacto de cada gasto), cada movimiento se
// fecha el día 1 de su mes correspondiente — es una aproximación,
// no la fecha real de la transacción.
// ============================================================
function sembrarDatosHistoricos() {
  if (localStorage.getItem(LLAVE_SEED) === "1") return;
  if (cargarMovimientos().length > 0) {
    localStorage.setItem(LLAVE_SEED, "1");
    return;
  }

  const fechasMes = [
    "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01",
    "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01",
  ];

  // Gasto promedio/total por categoría y mes (ene–sep), igual que en
  // el resumen financiero: cada valor es el total de esa categoría
  // en ese mes.
  const categoriasHist = [
    { nombre: "Regalos",        categoria: "Variable", data: [425, 40, 500, 1300, 8041, 450, 2280, 290, 0] },
    { nombre: "Tecnología",     categoria: "Variable", data: [110, 110, 0, 0, 0, 4000, 0, 2500, 0] },
    { nombre: "Alimentación",   categoria: "Variable", data: [155, 335, 210, 0, 103, 971.5, 748, 817, 0] },
    { nombre: "Oaca",           categoria: "Variable", data: [50, 0, 720, 250, 0, 258, 314, 1359, 0] },
    { nombre: "Servicio Claro", categoria: "Fijo",     data: [316, 0, 250, 0, 0, 415, 318, 641, 0] },
    { nombre: "Salud/Seguros",  categoria: "Fijo",     data: [205, 205, 205, 205, 205, 205, 205, 205, 0] },
    { nombre: "Plataforma",     categoria: "Fijo",     data: [0, 0, 60, 0, 0, 497, 335, 154, 52] },
    { nombre: "Ocio",           categoria: "Variable", data: [0, 825, 0, 0, 0, 0, 0, 0, 0] },
    { nombre: "Luz",            categoria: "Fijo",     data: [0, 0, 0, 200, 0, 200, 200, 200, 0] },
    { nombre: "Otros",          categoria: "Otro",     data: [600, 0, 0, 0, 0, 0, 0, 100, 0] },
    { nombre: "Educación",      categoria: "Variable", data: [400, 0, 150, 0, 0, 100, 0, 0, 0] },
    { nombre: "Ropa",           categoria: "Variable", data: [0, 0, 0, 0, 0, 130, 350, 0, 0] },
    { nombre: "Discos",         categoria: "Variable", data: [175, 0, 0, 0, 0, 0, 0, 175, 0] },
    { nombre: "Despensa",       categoria: "Variable", data: [0, 0, 0, 0, 0, 91, 0, 143, 0] },
    { nombre: "Transporte",     categoria: "Variable", data: [0, 0, 0, 0, 0, 55, 82, 85, 0] },
  ];

  // Ingresos totales del mes (abril no estaba registrado en el
  // resumen original, así que no se incluye).
  const ingresosMes = [5613, 7166, 2983, null, 4870, 6134, 10544, 6340, null];

  const semilla = [];
  let idBase = Date.now() - 1000000;

  categoriasHist.forEach((cat) => {
    cat.data.forEach((valor, i) => {
      if (valor > 0) {
        semilla.push({
          id: idBase++,
          tipo: "gasto",
          concepto: cat.nombre,
          monto: valor,
          fecha: fechasMes[i],
          categoria: cat.categoria,
        });
      }
    });
  });

  ingresosMes.forEach((valor, i) => {
    if (valor) {
      semilla.push({
        id: idBase++,
        tipo: "ingreso",
        concepto: "Ingresos del mes",
        monto: valor,
        fecha: fechasMes[i],
        categoria: "Otro",
      });
    }
  });

  // Pago de Letty del 1 de septiembre: Q225 de interés es ingreso
  // real; el capital (Q5,000) no se cuenta como ingreso porque es
  // solo el retorno de dinero ya prestado, no ganancia.
  semilla.push({
    id: idBase++,
    tipo: "ingreso",
    concepto: "Interés Letty (pago 1 sep)",
    monto: 225,
    fecha: "2026-09-01",
    categoria: "Otro",
  });

  // Saldo activo del préstamo a Letty después del pago del 1 de
  // septiembre (bajó de Q15,000 a Q10,000).
  semilla.push({
    id: idBase++,
    tipo: "prestamo",
    concepto: "Préstamo a Letty (saldo activo, 1.5%/mes)",
    monto: 10000,
    fecha: "2026-09-01",
    categoria: "Otro",
  });

  guardarMovimientos(semilla);
  localStorage.setItem(LLAVE_SEED, "1");
}

function bloquear() {
  sessionStorage.removeItem(LLAVE_SESION);
  appContabilidad.hidden = true;
  pantallaAcceso.hidden = false;
  inputClave.value = "";
  inputClave.focus();
}

formAcceso.addEventListener("submit", (e) => {
  e.preventDefault();
  if (inputClave.value === CLAVE_CORRECTA) {
    accesoError.hidden = true;
    desbloquear();
  } else {
    accesoError.hidden = false;
    inputClave.value = "";
    accesoCaja.classList.remove("shake");
    void accesoCaja.offsetWidth; // reinicia la animación
    accesoCaja.classList.add("shake");
    inputClave.focus();
  }
});

btnBloquear.addEventListener("click", bloquear);

// Si ya se desbloqueó en esta sesión del navegador, saltar la clave.
if (sessionStorage.getItem(LLAVE_SESION) === "1") {
  desbloquear();
}

// ============================================================
// App de movimientos (ingresos / gastos / préstamos)
// ============================================================

const tabsTipo = document.querySelectorAll(".tab-tipo");
const formMovimiento = document.getElementById("form-movimiento");
const movConcepto = document.getElementById("mov-concepto");
const movMonto = document.getElementById("mov-monto");
const movFecha = document.getElementById("mov-fecha");
const movCategoria = document.getElementById("mov-categoria");
const tablaCuerpo = document.getElementById("tabla-cuerpo");
const tablaVacio = document.getElementById("tabla-vacio");
const btnExportar = document.getElementById("btn-exportar");

let tipoActivo = "ingreso";

// fecha de hoy por defecto
movFecha.valueAsDate = new Date();

tabsTipo.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabsTipo.forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    tipoActivo = btn.dataset.tipo;
  });
});

function cargarMovimientos() {
  try {
    return JSON.parse(localStorage.getItem(LLAVE_DATOS)) || [];
  } catch (e) {
    return [];
  }
}

function guardarMovimientos(movs) {
  localStorage.setItem(LLAVE_DATOS, JSON.stringify(movs));
}

function formatoQ(numero) {
  const n = Number(numero) || 0;
  return "Q" + n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function etiquetaTipo(tipo) {
  return { ingreso: "Ingreso", gasto: "Gasto", prestamo: "Préstamo" }[tipo] || tipo;
}

function renderTabla() {
  const movs = cargarMovimientos();
  const ordenados = [...movs].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  tablaCuerpo.innerHTML = "";
  tablaVacio.hidden = ordenados.length > 0;

  ordenados.forEach((mov) => {
    const tr = document.createElement("tr");
    tr.className = "fila-" + mov.tipo;
    tr.innerHTML = `
      <td>${mov.fecha}</td>
      <td>${escaparHtml(mov.concepto)}</td>
      <td>${escaparHtml(mov.categoria || etiquetaTipo(mov.tipo))}</td>
      <td>${mov.tipo === "gasto" ? "-" : "+"}${formatoQ(mov.monto)}</td>
      <td><button class="btn-eliminar" data-id="${mov.id}" title="Eliminar">&times;</button></td>
    `;
    tablaCuerpo.appendChild(tr);
  });

  tablaCuerpo.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const restantes = cargarMovimientos().filter((m) => String(m.id) !== id);
      guardarMovimientos(restantes);
      renderTodo();
    });
  });
}

function escaparHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderTotales() {
  const movs = cargarMovimientos();
  const suma = (tipo) =>
    movs.filter((m) => m.tipo === tipo).reduce((acc, m) => acc + Number(m.monto), 0);

  const totalIngresos = suma("ingreso");
  const totalGastos = suma("gasto");
  const totalPrestamos = suma("prestamo");
  const balance = totalIngresos - totalGastos;

  document.getElementById("total-ingresos").textContent = formatoQ(totalIngresos);
  document.getElementById("total-gastos").textContent = formatoQ(totalGastos);
  document.getElementById("total-prestamos").textContent = formatoQ(totalPrestamos);
  document.getElementById("total-balance").textContent = formatoQ(balance);
}

function renderTodo() {
  renderTabla();
  renderTotales();
}

formMovimiento.addEventListener("submit", (e) => {
  e.preventDefault();
  const nuevo = {
    id: Date.now(),
    tipo: tipoActivo,
    concepto: movConcepto.value.trim(),
    monto: parseFloat(movMonto.value),
    fecha: movFecha.value,
    categoria: movCategoria.value,
  };
  if (!nuevo.concepto || isNaN(nuevo.monto) || !nuevo.fecha) return;

  const movs = cargarMovimientos();
  movs.push(nuevo);
  guardarMovimientos(movs);

  formMovimiento.reset();
  movFecha.valueAsDate = new Date();
  renderTodo();
});

// ---------- Exportar como imagen ----------
btnExportar.addEventListener("click", () => {
  const elemento = document.getElementById("capturable");
  if (typeof html2canvas === "undefined") {
    alert("No se pudo cargar la herramienta de exportación. Revisa tu conexión e intenta de nuevo.");
    return;
  }
  html2canvas(elemento, { backgroundColor: "#191932", scale: 2 }).then((canvas) => {
    const enlace = document.createElement("a");
    enlace.download = "contabilidad-" + new Date().toISOString().slice(0, 10) + ".png";
    enlace.href = canvas.toDataURL("image/png");
    enlace.click();
  });
});
