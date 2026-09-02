// ============================================================
// Contabilidad personal — Marvin Matias
// Cuenta real (Firebase Authentication + Firestore) para que los
// datos se sincronicen entre varios dispositivos. La clave numérica
// de 8 dígitos se mantiene como un "bloqueo rápido" de conveniencia
// una vez que el dispositivo ya inició sesión con la cuenta real;
// la seguridad de verdad la dan el login con correo/contraseña y
// las reglas de Firestore, que solo permiten leer y escribir a la
// cuenta autorizada de Marvin.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuJhhM5TbFAHCFaG9nHWBqNnxfb-TtUT8",
  authDomain: "contabilidad-marvin.firebaseapp.com",
  projectId: "contabilidad-marvin",
  storageBucket: "contabilidad-marvin.firebasestorage.app",
  messagingSenderId: "308646534936",
  appId: "1:308646534936:web:bc053731c6b5967582086d",
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
const COLECCION_MOVS = "movimientos";
const COLECCION_CATS = "categorias";

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("No se pudo configurar la persistencia de sesión:", err);
});

const CLAVE_CORRECTA = "41051997";
const CLAVE_MAXIMA_LONGITUD = 8;
const LLAVE_SESION = "contabilidad_unlocked";

const pantallaCarga = document.getElementById("pantalla-carga");
const pantallaLogin = document.getElementById("pantalla-login");
const pantallaAcceso = document.getElementById("pantalla-acceso");
const appContabilidad = document.getElementById("app-contabilidad");
const formAcceso = document.getElementById("form-acceso");
const inputClave = document.getElementById("input-clave");
const accesoError = document.getElementById("acceso-error");
const accesoCaja = document.querySelector("#pantalla-acceso .acceso-caja");
const btnBloquear = document.getElementById("btn-bloquear");
const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
const spanSesionUsuario = document.getElementById("sesion-usuario");

// ============================================================
// Login / crear cuenta (Firebase Authentication)
// ============================================================

const formLogin = document.getElementById("form-login");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmitBtn = document.getElementById("login-submit-btn");
const loginToggleBtn = document.getElementById("login-toggle-btn");
const loginToggleTexto = document.getElementById("login-toggle-texto");
const loginTitulo = document.getElementById("login-titulo");

let modoCrearCuenta = false;

function traducirErrorAuth(err) {
  const codigo = err && err.code;
  const mapa = {
    "auth/invalid-email": "Ese correo no es válido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Intenta iniciar sesión.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e intenta de nuevo.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet e intenta de nuevo.",
  };
  return mapa[codigo] || "No se pudo completar la acción. Intenta de nuevo.";
}

if (loginToggleBtn) {
  loginToggleBtn.addEventListener("click", () => {
    modoCrearCuenta = !modoCrearCuenta;
    loginError.hidden = true;
    if (modoCrearCuenta) {
      loginTitulo.textContent = "Crear cuenta";
      loginSubmitBtn.textContent = "Crear cuenta";
      loginToggleTexto.textContent = "¿Ya tienes cuenta?";
      loginToggleBtn.textContent = "Iniciar sesión";
    } else {
      loginTitulo.textContent = "Iniciar sesión";
      loginSubmitBtn.textContent = "Entrar";
      loginToggleTexto.textContent = "¿No tienes cuenta todavía?";
      loginToggleBtn.textContent = "Crear cuenta";
    }
  });
}

if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    loginSubmitBtn.disabled = true;

    const accion = modoCrearCuenta
      ? createUserWithEmailAndPassword(auth, email, password)
      : signInWithEmailAndPassword(auth, email, password);

    accion
      .catch((err) => {
        loginError.textContent = traducirErrorAuth(err);
        loginError.hidden = false;
      })
      .finally(() => {
        loginSubmitBtn.disabled = false;
      });
  });
}

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", () => {
    desuscribirMovimientos();
    desuscribirCategorias();
    sessionStorage.removeItem(LLAVE_SESION);
    signOut(auth);
  });
}

onAuthStateChanged(auth, (user) => {
  pantallaCarga.hidden = true;
  if (user) {
    pantallaLogin.hidden = true;
    formLogin.reset();
    if (spanSesionUsuario) spanSesionUsuario.textContent = user.email || "";
    if (sessionStorage.getItem(LLAVE_SESION) === "1") {
      desbloquear();
    } else {
      appContabilidad.hidden = true;
      pantallaAcceso.hidden = false;
      inputClave.focus();
    }
  } else {
    desuscribirMovimientos();
    desuscribirCategorias();
    appContabilidad.hidden = true;
    pantallaAcceso.hidden = true;
    sessionStorage.removeItem(LLAVE_SESION);
    pantallaLogin.hidden = false;
  }
});

// ============================================================
// Bloqueo rápido con clave numérica (solo disponible ya con
// sesión real iniciada)
// ============================================================

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
  sembrarDatosHistoricosSiHaceFalta().then(() => migrarCategoriasLegacySiHaceFalta());
  suscribirMovimientos();
  suscribirCategorias();
}

function bloquear() {
  sessionStorage.removeItem(LLAVE_SESION);
  desuscribirMovimientos();
  desuscribirCategorias();
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

// ============================================================
// Categorías (predefinidas + personalizadas, con ícono)
// ============================================================

const GASTO_CATEGORIAS = [
  { id: "Alimentación", icono: "🧺", color: "#27ae60" },
  { id: "Café", icono: "☕", color: "#9b59b6" },
  { id: "Casa", icono: "🏠", color: "#e67e22" },
  { id: "Salud", icono: "❤️", color: "#e74c3c" },
  { id: "Ocio", icono: "🎉", color: "#1abc9c" },
  { id: "Educación", icono: "🎓", color: "#2980b9" },
  { id: "Regalos", icono: "🎁", color: "#e91e63" },
  { id: "Familia", icono: "👨‍👩‍👧", color: "#f39c12" },
  { id: "Rutina", icono: "💪", color: "#d35400" },
  { id: "Transporte", icono: "🚌", color: "#34495e" },
  { id: "Oaca", icono: "🎮", color: "#c2185b" },
  { id: "Servicio Claro", icono: "🌐", color: "#c0392b" },
  { id: "Luz", icono: "💡", color: "#f1c40f" },
  { id: "Ropa", icono: "👕", color: "#2c3e50" },
  { id: "Plataforma", icono: "🎬", color: "#8e44ad" },
  { id: "Despensa", icono: "🧾", color: "#16a085" },
  { id: "Préstamo", icono: "🔄", color: "#7f8c8d" },
  { id: "Tecnología", icono: "💻", color: "#2ecc71" },
  { id: "Discos", icono: "🎵", color: "#8e44ad" },
  { id: "Otros", icono: "❓", color: "#95a5a6" },
];

const INGRESO_CATEGORIAS = [
  { id: "Salario", icono: "💰", color: "#3498db" },
  { id: "Regalo", icono: "🎁", color: "#e91e63" },
  { id: "Interés", icono: "🏛️", color: "#27ae60" },
  { id: "Ventas", icono: "🧾", color: "#9b59b6" },
  { id: "Préstamo", icono: "🔄", color: "#2ecc71" },
  { id: "Otros", icono: "❓", color: "#16a085" },
];

let categoriasPersonalizadas = { gasto: [], ingreso: [] };
let unsubscribeCategorias = null;
let categoriaSeleccionada = "";

function obtenerCategorias(tipo) {
  const base = tipo === "ingreso" ? INGRESO_CATEGORIAS : GASTO_CATEGORIAS;
  const personalizadas = categoriasPersonalizadas[tipo] || [];
  return [...base, ...personalizadas];
}

const PALETA_RESPALDO = ["#607d8b", "#795548", "#009688", "#3f51b5", "#ff5722", "#8bc34a"];

function colorParaCategoria(tipo, nombre) {
  const cat = obtenerCategorias(tipo).find((c) => c.id === nombre);
  if (cat) return cat.color;
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) >>> 0;
  return PALETA_RESPALDO[hash % PALETA_RESPALDO.length];
}

function suscribirCategorias() {
  if (unsubscribeCategorias) return;
  unsubscribeCategorias = onSnapshot(
    collection(db, COLECCION_CATS),
    (snapshot) => {
      const nuevas = { gasto: [], ingreso: [] };
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && (d.tipo === "gasto" || d.tipo === "ingreso") && d.nombre) {
          nuevas[d.tipo].push({ id: d.nombre, icono: d.icono || "⭐", color: d.color || "#607d8b" });
        }
      });
      categoriasPersonalizadas = nuevas;
      renderGridCategorias();
      renderGraficaCategorias();
    },
    (error) => {
      console.error("Error leyendo categorías:", error);
    }
  );
}

function desuscribirCategorias() {
  if (unsubscribeCategorias) {
    unsubscribeCategorias();
    unsubscribeCategorias = null;
  }
  categoriasPersonalizadas = { gasto: [], ingreso: [] };
}

function renderGridCategorias() {
  const grid = document.getElementById("grid-categorias");
  const panelCategorias = document.getElementById("panel-categorias");
  if (!grid || !panelCategorias) return;

  if (tipoActivo === "prestamo") {
    panelCategorias.hidden = true;
    categoriaSeleccionada = "Préstamo";
    return;
  }
  panelCategorias.hidden = false;

  const cats = obtenerCategorias(tipoActivo);
  grid.innerHTML = "";
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-boton" + (cat.id === categoriaSeleccionada ? " activo" : "");
    btn.style.setProperty("--cat-color", cat.color);
    btn.dataset.categoria = cat.id;
    btn.innerHTML = `<span class="cat-icono">${cat.icono}</span><span class="cat-nombre">${escaparHtml(cat.id)}</span>`;
    btn.addEventListener("click", () => {
      categoriaSeleccionada = cat.id;
      renderGridCategorias();
    });
    grid.appendChild(btn);
  });

  const btnCrear = document.createElement("button");
  btnCrear.type = "button";
  btnCrear.className = "cat-boton cat-crear";
  btnCrear.innerHTML = `<span class="cat-icono">➕</span><span class="cat-nombre">Crear</span>`;
  btnCrear.addEventListener("click", () => {
    const formNueva = document.getElementById("form-nueva-categoria");
    const inputNombre = document.getElementById("nueva-categoria-nombre");
    if (formNueva) {
      formNueva.hidden = false;
      if (inputNombre) inputNombre.focus();
    }
  });
  grid.appendChild(btnCrear);
}

const formNuevaCategoria = document.getElementById("form-nueva-categoria");
const nuevaCategoriaNombre = document.getElementById("nueva-categoria-nombre");
const btnCancelarNuevaCategoria = document.getElementById("btn-cancelar-nueva-categoria");
const PALETA_NUEVAS_CATEGORIAS = ["#3498db", "#e67e22", "#9b59b6", "#1abc9c", "#e74c3c", "#f1c40f", "#2ecc71", "#e91e63"];

if (formNuevaCategoria) {
  formNuevaCategoria.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = nuevaCategoriaNombre.value.trim();
    if (!nombre) return;
    const tipo = tipoActivo === "ingreso" ? "ingreso" : "gasto";
    const existe = obtenerCategorias(tipo).some((c) => c.id.toLowerCase() === nombre.toLowerCase());
    if (existe) {
      categoriaSeleccionada = nombre;
      nuevaCategoriaNombre.value = "";
      formNuevaCategoria.hidden = true;
      renderGridCategorias();
      return;
    }
    const color = PALETA_NUEVAS_CATEGORIAS[Math.floor(Math.random() * PALETA_NUEVAS_CATEGORIAS.length)];
    const btnGuardar = formNuevaCategoria.querySelector('button[type="submit"]');
    if (btnGuardar) btnGuardar.disabled = true;
    addDoc(collection(db, COLECCION_CATS), { tipo, nombre, icono: "⭐", color })
      .then(() => {
        categoriaSeleccionada = nombre;
        nuevaCategoriaNombre.value = "";
        formNuevaCategoria.hidden = true;
      })
      .catch((err) => {
        console.error("Error creando categoría:", err);
        alert("No se pudo crear la categoría. Revisa tu conexión e intenta de nuevo.");
      })
      .finally(() => {
        if (btnGuardar) btnGuardar.disabled = false;
      });
  });
}

if (btnCancelarNuevaCategoria) {
  btnCancelarNuevaCategoria.addEventListener("click", () => {
    nuevaCategoriaNombre.value = "";
    formNuevaCategoria.hidden = true;
  });
}
// ============================================================
// Migración de datos antiguos: los movimientos sembrados antes de
// que existiera este sistema de categorías con ícono usaban
// "Fijo/Variable/Ahorro/Otro" en el campo categoria. Esta función
// corre UNA sola vez y los ajusta a los nombres de categoría reales
// (que ya vivían en el campo "concepto" para los gastos históricos).
// ============================================================

const MAPEO_MIGRACION_CATEGORIAS = {
  "Salud/Seguros": "Salud",
  "Ingresos del mes": "Otros",
  "Interés Letty (pago 1 sep)": "Interés",
  "Préstamo a Letty (saldo activo, 1.5%/mes)": "Préstamo",
};

async function migrarCategoriasLegacySiHaceFalta() {
  try {
    const metaRef = doc(db, "meta", "estado");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().categoriasMigradas) return;

    const nombresGastoValidos = new Set(GASTO_CATEGORIAS.map((c) => c.id));
    const todos = await getDocs(collection(db, COLECCION_MOVS));
    const lote = writeBatch(db);
    let cambios = 0;

    todos.forEach((docSnap) => {
      const m = docSnap.data();
      let nuevaCategoria = null;
      if (Object.prototype.hasOwnProperty.call(MAPEO_MIGRACION_CATEGORIAS, m.concepto)) {
        nuevaCategoria = MAPEO_MIGRACION_CATEGORIAS[m.concepto];
      } else if (
        ["Fijo", "Variable", "Ahorro", "Otro"].includes(m.categoria) &&
        nombresGastoValidos.has(m.concepto)
      ) {
        nuevaCategoria = m.concepto;
      }
      if (nuevaCategoria && nuevaCategoria !== m.categoria) {
        lote.update(doc(db, COLECCION_MOVS, docSnap.id), { categoria: nuevaCategoria });
        cambios++;
      }
    });

    if (cambios > 0) await lote.commit();
    await setDoc(metaRef, { categoriasMigradas: true }, { merge: true });
  } catch (err) {
    console.error("Error migrando categorías antiguas:", err);
  }
}

// ============================================================
// Datos históricos (ene–sep 2026) tomados del resumen financiero
// previo. Se cargan UNA sola vez en Firestore, solo si todavía no
// hay ningún movimiento guardado — así no pisa nada que Marvin ya
// haya capturado a mano, ni se repite en cada dispositivo nuevo.
// Nota: como el resumen original solo traía totales por mes y
// categoría (no el día exacto de cada gasto), cada movimiento se
// fecha el día 1 de su mes correspondiente — es una aproximación,
// no la fecha real de la transacción.
// ============================================================
function construirSemillaHistorica() {
  const fechasMes = [
    "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01",
    "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01",
  ];

  // Gasto total por categoría y mes (ene–sep), igual que en el
  // resumen financiero: cada valor es el total de esa categoría
  // en ese mes.
  const categoriasHist = [
    { nombre: "Regalos",        data: [425, 40, 500, 1300, 8041, 450, 2280, 290, 0] },
    { nombre: "Tecnología",     data: [110, 110, 0, 0, 0, 4000, 0, 2500, 0] },
    { nombre: "Alimentación",   data: [155, 335, 210, 0, 103, 971.5, 748, 817, 0] },
    { nombre: "Oaca",           data: [50, 0, 720, 250, 0, 258, 314, 1359, 0] },
    { nombre: "Servicio Claro", data: [316, 0, 250, 0, 0, 415, 318, 641, 0] },
    { nombre: "Salud",          data: [205, 205, 205, 205, 205, 205, 205, 205, 0] },
    { nombre: "Plataforma",     data: [0, 0, 60, 0, 0, 497, 335, 154, 52] },
    { nombre: "Ocio",           data: [0, 825, 0, 0, 0, 0, 0, 0, 0] },
    { nombre: "Luz",            data: [0, 0, 0, 200, 0, 200, 200, 200, 0] },
    { nombre: "Otros",          data: [600, 0, 0, 0, 0, 0, 0, 100, 0] },
    { nombre: "Educación",      data: [400, 0, 150, 0, 0, 100, 0, 0, 0] },
    { nombre: "Ropa",           data: [0, 0, 0, 0, 0, 130, 350, 0, 0] },
    { nombre: "Discos",         data: [175, 0, 0, 0, 0, 0, 0, 175, 0] },
    { nombre: "Despensa",       data: [0, 0, 0, 0, 0, 91, 0, 143, 0] },
    { nombre: "Transporte",     data: [0, 0, 0, 0, 0, 55, 82, 85, 0] },
  ];

  // Ingresos totales del mes (abril no estaba registrado en el
  // resumen original, así que no se incluye).
  const ingresosMes = [5613, 7166, 2983, null, 4870, 6134, 10544, 6340, null];

  const semilla = [];

  categoriasHist.forEach((cat) => {
    cat.data.forEach((valor, i) => {
      if (valor > 0) {
        semilla.push({
          tipo: "gasto",
          concepto: cat.nombre,
          monto: valor,
          fecha: fechasMes[i],
          categoria: cat.nombre,
        });
      }
    });
  });

  ingresosMes.forEach((valor, i) => {
    if (valor) {
      semilla.push({
        tipo: "ingreso",
        concepto: "Ingresos del mes",
        monto: valor,
        fecha: fechasMes[i],
        categoria: "Otros",
      });
    }
  });

  // Pago de Letty del 1 de septiembre: Q225 de interés es ingreso
  // real; el capital (Q5,000) no se cuenta como ingreso porque es
  // solo el retorno de dinero ya prestado, no ganancia.
  semilla.push({
    tipo: "ingreso",
    concepto: "Interés Letty (pago 1 sep)",
    monto: 225,
    fecha: "2026-09-01",
    categoria: "Interés",
  });

  // Saldo activo del préstamo a Letty después del pago del 1 de
  // septiembre (bajó de Q15,000 a Q10,000).
  semilla.push({
    tipo: "prestamo",
    concepto: "Préstamo a Letty (saldo activo, 1.5%/mes)",
    monto: 10000,
    fecha: "2026-09-01",
    categoria: "Préstamo",
  });

  return semilla;
}

async function sembrarDatosHistoricosSiHaceFalta() {
  try {
    const metaRef = doc(db, "meta", "estado");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().sembrado) return;

    const primerDoc = await getDocs(query(collection(db, COLECCION_MOVS), limit(1)));
    if (!primerDoc.empty) {
      await setDoc(metaRef, { sembrado: true }, { merge: true });
      return;
    }

    const semilla = construirSemillaHistorica();
    const lote = writeBatch(db);
    semilla.forEach((mov) => {
      const ref = doc(collection(db, COLECCION_MOVS));
      lote.set(ref, mov);
    });
    lote.set(metaRef, { sembrado: true }, { merge: true });
    await lote.commit();
  } catch (err) {
    console.error("Error sembrando datos históricos:", err);
  }
}
// ============================================================
// App de movimientos (ingresos / gastos / préstamos)
// ============================================================

const tabsTipo = document.querySelectorAll(".tab-tipo");
const formMovimiento = document.getElementById("form-movimiento");
const movConcepto = document.getElementById("mov-concepto");
const movMonto = document.getElementById("mov-monto");
const movFecha = document.getElementById("mov-fecha");
const tablaCuerpo = document.getElementById("tabla-cuerpo");
const tablaVacio = document.getElementById("tabla-vacio");

let tipoActivo = "ingreso";
let movimientosCache = [];
let unsubscribeMovs = null;

// fecha de hoy por defecto
movFecha.valueAsDate = new Date();

tabsTipo.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabsTipo.forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    tipoActivo = btn.dataset.tipo;
    categoriaSeleccionada = tipoActivo === "prestamo" ? "Préstamo" : "";
    renderGridCategorias();
  });
});

function suscribirMovimientos() {
  if (unsubscribeMovs) return; // ya suscrito
  unsubscribeMovs = onSnapshot(
    collection(db, COLECCION_MOVS),
    (snapshot) => {
      movimientosCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      renderTodo();
    },
    (error) => {
      console.error("Error leyendo movimientos:", error);
    }
  );
}

function desuscribirMovimientos() {
  if (unsubscribeMovs) {
    unsubscribeMovs();
    unsubscribeMovs = null;
  }
  movimientosCache = [];
}

function formatoQ(numero) {
  const n = Number(numero) || 0;
  return "Q" + n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function etiquetaTipo(tipo) {
  return { ingreso: "Ingreso", gasto: "Gasto", prestamo: "Préstamo" }[tipo] || tipo;
}

function renderTabla() {
  const ordenados = [...movimientosCache].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  tablaCuerpo.innerHTML = "";
  tablaVacio.hidden = ordenados.length > 0;

  ordenados.forEach((mov) => {
    const tr = document.createElement("tr");
    tr.className = "fila-" + mov.tipo;
    const icono = mov.tipo === "prestamo" ? "🔄" : colorIconoParaTabla(mov);
    tr.innerHTML = `
      <td>${mov.fecha}</td>
      <td>${escaparHtml(mov.concepto)}</td>
      <td>${icono} ${escaparHtml(mov.categoria || etiquetaTipo(mov.tipo))}</td>
      <td>${mov.tipo === "gasto" ? "-" : "+"}${formatoQ(mov.monto)}</td>
      <td><button class="btn-eliminar" data-id="${mov.id}" title="Eliminar">&times;</button></td>
    `;
    tablaCuerpo.appendChild(tr);
  });

  tablaCuerpo.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      deleteDoc(doc(db, COLECCION_MOVS, id)).catch((err) => {
        console.error("Error eliminando movimiento:", err);
        alert("No se pudo eliminar el movimiento. Revisa tu conexión e intenta de nuevo.");
        btn.disabled = false;
      });
    });
  });
}

function colorIconoParaTabla(mov) {
  const tipo = mov.tipo === "ingreso" ? "ingreso" : "gasto";
  const cat = obtenerCategorias(tipo).find((c) => c.id === mov.categoria);
  return cat ? cat.icono : "";
}

function escaparHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderTotales() {
  const suma = (tipo) =>
    movimientosCache.filter((m) => m.tipo === tipo).reduce((acc, m) => acc + Number(m.monto), 0);

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
  renderGraficas();
  renderProyeccion();
}

formMovimiento.addEventListener("submit", (e) => {
  e.preventDefault();
  if (tipoActivo !== "prestamo" && !categoriaSeleccionada) {
    alert("Elige una categoría para este movimiento.");
    return;
  }
  const nuevo = {
    tipo: tipoActivo,
    concepto: movConcepto.value.trim(),
    monto: parseFloat(movMonto.value),
    fecha: movFecha.value,
    categoria: tipoActivo === "prestamo" ? "Préstamo" : categoriaSeleccionada,
  };
  if (!nuevo.concepto || isNaN(nuevo.monto) || !nuevo.fecha) return;

  const btnEnviar = formMovimiento.querySelector('button[type="submit"]');
  if (btnEnviar) btnEnviar.disabled = true;

  addDoc(collection(db, COLECCION_MOVS), nuevo)
    .then(() => {
      formMovimiento.reset();
      movFecha.valueAsDate = new Date();
      categoriaSeleccionada = tipoActivo === "prestamo" ? "Préstamo" : "";
      renderGridCategorias();
    })
    .catch((err) => {
      console.error("Error guardando movimiento:", err);
      alert("No se pudo guardar el movimiento. Revisa tu conexión e intenta de nuevo.");
    })
    .finally(() => {
      if (btnEnviar) btnEnviar.disabled = false;
    });
});
// ============================================================
// Gráficas (Chart.js): histórico mensual + gasto por categoría
// ============================================================

const NOMBRES_MES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
let chartHistorial = null;
let chartCategorias = null;
let periodoGraficaCategorias = "mes"; // "mes" | "todo"

function agruparPorMes(movs) {
  const mapa = {};
  movs.forEach((m) => {
    if (!m.fecha) return;
    const clave = m.fecha.slice(0, 7); // "2026-01"
    if (!mapa[clave]) mapa[clave] = { ingreso: 0, gasto: 0 };
    if (m.tipo === "ingreso") mapa[clave].ingreso += Number(m.monto) || 0;
    if (m.tipo === "gasto") mapa[clave].gasto += Number(m.monto) || 0;
  });
  return mapa;
}

function renderGraficaHistorial() {
  const canvas = document.getElementById("chart-historial");
  if (!canvas || typeof Chart === "undefined") return;
  const mapa = agruparPorMes(movimientosCache);
  const claves = Object.keys(mapa).sort();
  const labels = claves.map((c) => {
    const [anio, mes] = c.split("-");
    return NOMBRES_MES_CORTOS[parseInt(mes, 10) - 1] + " " + anio.slice(2);
  });
  const datosIngresos = claves.map((c) => mapa[c].ingreso);
  const datosGastos = claves.map((c) => mapa[c].gasto);

  if (chartHistorial) chartHistorial.destroy();
  chartHistorial = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: datosIngresos, backgroundColor: "rgba(126,217,87,0.8)", borderRadius: 4 },
        { label: "Gastos", data: datosGastos, backgroundColor: "rgba(255,107,107,0.8)", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#cdd3f0" } },
        tooltip: { callbacks: { label: (ctx) => " " + ctx.dataset.label + ": " + formatoQ(ctx.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: "#9aa1c9" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9aa1c9", callback: (v) => "Q" + v }, grid: { color: "rgba(255,255,255,0.06)" } },
      },
    },
  });
}

function renderGraficaCategorias() {
  const canvas = document.getElementById("chart-categorias");
  if (!canvas || typeof Chart === "undefined") return;
  const mesActualClave = new Date().toISOString().slice(0, 7);
  const gastos = movimientosCache.filter((m) => {
    if (m.tipo !== "gasto") return false;
    if (periodoGraficaCategorias === "mes") return (m.fecha || "").slice(0, 7) === mesActualClave;
    return true;
  });
  const totalesPorCat = {};
  gastos.forEach((m) => {
    const cat = m.categoria || "Otros";
    totalesPorCat[cat] = (totalesPorCat[cat] || 0) + (Number(m.monto) || 0);
  });
  const entradas = Object.entries(totalesPorCat).sort((a, b) => b[1] - a[1]);
  const labels = entradas.map((e) => e[0]);
  const datos = entradas.map((e) => e[1]);
  const colores = entradas.map((e) => colorParaCategoria("gasto", e[0]));

  if (chartCategorias) chartCategorias.destroy();
  chartCategorias = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: datos, backgroundColor: colores, borderRadius: 4 }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => " " + formatoQ(ctx.parsed.x) } },
      },
      scales: {
        x: { ticks: { color: "#9aa1c9", callback: (v) => "Q" + v }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#cdd3f0" }, grid: { display: false } },
      },
    },
  });
}

function renderGraficas() {
  renderGraficaHistorial();
  renderGraficaCategorias();
}

const btnCatMes = document.getElementById("toggle-cat-mes");
const btnCatTodo = document.getElementById("toggle-cat-todo");

function actualizarTogglePeriodoCat() {
  if (btnCatMes) btnCatMes.classList.toggle("activo", periodoGraficaCategorias === "mes");
  if (btnCatTodo) btnCatTodo.classList.toggle("activo", periodoGraficaCategorias === "todo");
}
if (btnCatMes) {
  btnCatMes.addEventListener("click", () => {
    periodoGraficaCategorias = "mes";
    actualizarTogglePeriodoCat();
    renderGraficaCategorias();
  });
}
if (btnCatTodo) {
  btnCatTodo.addEventListener("click", () => {
    periodoGraficaCategorias = "todo";
    actualizarTogglePeriodoCat();
    renderGraficaCategorias();
  });
}
actualizarTogglePeriodoCat();

// ============================================================
// Proyección (calculada en vivo con los movimientos registrados)
// ============================================================

function renderProyeccion() {
  const elGastoMes = document.getElementById("proy-gasto-mes");
  const elAhorroProm = document.getElementById("proy-ahorro-promedio");
  const elPatrimonioDic = document.getElementById("proy-patrimonio-dic");
  const elPatrimonioActual = document.getElementById("proy-patrimonio-actual");
  if (!elGastoMes || !elAhorroProm || !elPatrimonioDic) return;

  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActualIdx = hoy.getMonth(); // 0-11
  const diaActual = hoy.getDate();
  const diasEnMes = new Date(anioActual, mesActualIdx + 1, 0).getDate();
  const mesActualClave = hoy.toISOString().slice(0, 7);

  // 1. Gasto proyectado del mes actual
  const gastoMesActual = movimientosCache
    .filter((m) => m.tipo === "gasto" && (m.fecha || "").slice(0, 7) === mesActualClave)
    .reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
  const gastoProyectado = diaActual > 0 ? (gastoMesActual / diaActual) * diasEnMes : 0;

  // 2. Ahorro mensual promedio (meses con al menos un ingreso registrado, sin contar el mes en curso)
  const mapaMeses = agruparPorMes(movimientosCache);
  const clavesCompletas = Object.keys(mapaMeses).filter((c) => c !== mesActualClave && mapaMeses[c].ingreso > 0);
  let ahorroPromedio = 0;
  if (clavesCompletas.length > 0) {
    const sumaAhorros = clavesCompletas.reduce((acc, c) => acc + (mapaMeses[c].ingreso - mapaMeses[c].gasto), 0);
    ahorroPromedio = sumaAhorros / clavesCompletas.length;
  }

  // 3. Patrimonio proyectado a diciembre
  const totalIngresos = movimientosCache.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const totalGastos = movimientosCache.filter((m) => m.tipo === "gasto").reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const totalPrestamos = movimientosCache.filter((m) => m.tipo === "prestamo").reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const patrimonioActual = totalIngresos - totalGastos + totalPrestamos;
  const mesesRestantes = Math.max(0, 11 - mesActualIdx);
  const patrimonioDic = patrimonioActual + ahorroPromedio * mesesRestantes;

  elGastoMes.textContent = formatoQ(gastoProyectado);
  elAhorroProm.textContent = formatoQ(ahorroPromedio);
  elPatrimonioDic.textContent = formatoQ(patrimonioDic);
  if (elPatrimonioActual) elPatrimonioActual.textContent = formatoQ(patrimonioActual);
}
// ============================================================
// Exportar a Excel por periodo (día / semana / mes / año)
// ============================================================

const btnExportarExcel = document.getElementById("btn-exportar-excel");
const panelExportar = document.getElementById("panel-exportar");
const btnCancelarExportar = document.getElementById("btn-cancelar-exportar");
const btnConfirmarExportar = document.getElementById("btn-confirmar-exportar");
const tabsPeriodo = document.querySelectorAll(".tab-periodo");
const exportInputContainer = document.getElementById("export-input-container");

let periodoExportActivo = "mes";

function crearInputPeriodo(tipo) {
  if (!exportInputContainer) return;
  const hoy = new Date();
  if (tipo === "dia") {
    exportInputContainer.innerHTML = '<input type="date" id="export-valor" class="controls">';
  } else if (tipo === "semana") {
    exportInputContainer.innerHTML = '<input type="week" id="export-valor" class="controls">';
  } else if (tipo === "mes") {
    exportInputContainer.innerHTML = '<input type="month" id="export-valor" class="controls">';
  } else {
    exportInputContainer.innerHTML = '<input type="number" id="export-valor" class="controls" min="2000" max="2100" step="1">';
  }
  const input = document.getElementById("export-valor");
  if (!input) return;
  if (tipo === "dia") {
    input.valueAsDate = hoy;
  } else if (tipo === "semana") {
    const primerEnero = new Date(hoy.getFullYear(), 0, 1);
    const dias = Math.floor((hoy - primerEnero) / 86400000);
    const semanaIso = Math.ceil((dias + primerEnero.getDay() + 1) / 7);
    input.value = hoy.getFullYear() + "-W" + String(semanaIso).padStart(2, "0");
  } else if (tipo === "mes") {
    input.value = hoy.toISOString().slice(0, 7);
  } else {
    input.value = String(hoy.getFullYear());
  }
}

if (tabsPeriodo.length) {
  tabsPeriodo.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsPeriodo.forEach((b) => b.classList.remove("activo"));
      btn.classList.add("activo");
      periodoExportActivo = btn.dataset.periodo;
      crearInputPeriodo(periodoExportActivo);
    });
  });
}

if (btnExportarExcel) {
  btnExportarExcel.addEventListener("click", () => {
    panelExportar.hidden = false;
    crearInputPeriodo(periodoExportActivo);
  });
}
if (btnCancelarExportar) {
  btnCancelarExportar.addEventListener("click", () => {
    panelExportar.hidden = true;
  });
}

function calcularRangoFechas(tipo, valor) {
  if (!valor) return null;
  if (tipo === "dia") {
    return { inicio: valor, fin: valor, etiqueta: valor };
  }
  if (tipo === "mes") {
    const [anio, mes] = valor.split("-");
    const ultimoDia = new Date(parseInt(anio, 10), parseInt(mes, 10), 0).getDate();
    return {
      inicio: `${anio}-${mes}-01`,
      fin: `${anio}-${mes}-${String(ultimoDia).padStart(2, "0")}`,
      etiqueta: `${NOMBRES_MES_CORTOS[parseInt(mes, 10) - 1]} ${anio}`,
    };
  }
  if (tipo === "anio") {
    const anio = String(parseInt(valor, 10));
    return { inicio: `${anio}-01-01`, fin: `${anio}-12-31`, etiqueta: anio };
  }
  if (tipo === "semana") {
    const [anioStr, semanaStr] = valor.split("-W");
    const anio = parseInt(anioStr, 10);
    const semana = parseInt(semanaStr, 10);
    const enero4 = new Date(anio, 0, 4);
    const diaSemanaEnero4 = (enero4.getDay() + 6) % 7; // lunes=0
    const lunesSemana1 = new Date(enero4);
    lunesSemana1.setDate(enero4.getDate() - diaSemanaEnero4);
    const inicioSemana = new Date(lunesSemana1);
    inicioSemana.setDate(lunesSemana1.getDate() + (semana - 1) * 7);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { inicio: fmt(inicioSemana), fin: fmt(finSemana), etiqueta: `Semana ${semana}, ${anio}` };
  }
  return null;
}

if (btnConfirmarExportar) {
  btnConfirmarExportar.addEventListener("click", () => {
    const inputValor = document.getElementById("export-valor");
    const valor = inputValor ? inputValor.value : "";
    const rango = calcularRangoFechas(periodoExportActivo, valor);
    if (!rango) {
      alert("Elige un periodo válido.");
      return;
    }
    if (typeof XLSX === "undefined") {
      alert("No se pudo cargar la herramienta de exportación. Revisa tu conexión e intenta de nuevo.");
      return;
    }

    const filtrados = movimientosCache.filter((m) => m.fecha >= rango.inicio && m.fecha <= rango.fin);
    const ingresos = filtrados.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const gastos = filtrados.filter((m) => m.tipo === "gasto").reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const prestamos = filtrados.filter((m) => m.tipo === "prestamo").reduce((a, m) => a + (Number(m.monto) || 0), 0);

    const hojaResumen = XLSX.utils.aoa_to_sheet([
      ["Contabilidad Personal — Marvin Matias"],
      ["Periodo", rango.etiqueta],
      [],
      ["Concepto", "Monto (Q)"],
      ["Ingresos", ingresos],
      ["Gastos", gastos],
      ["Préstamos", prestamos],
      ["Balance", ingresos - gastos],
    ]);

    const filasDetalle = [...filtrados]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((m) => ({
        Fecha: m.fecha,
        Tipo: etiquetaTipo(m.tipo),
        Concepto: m.concepto,
        Categoría: m.categoria || "",
        "Monto (Q)": Number(m.monto) || 0,
      }));
    const hojaDetalle = XLSX.utils.json_to_sheet(filasDetalle);

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen");
    XLSX.utils.book_append_sheet(libro, hojaDetalle, "Movimientos");

    const nombreArchivo = "contabilidad-" + periodoExportActivo + "-" + String(valor).replace(/\s+/g, "") + ".xlsx";
    XLSX.writeFile(libro, nombreArchivo);
    panelExportar.hidden = true;
  });
}
