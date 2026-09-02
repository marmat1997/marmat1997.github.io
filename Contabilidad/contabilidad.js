// ============================================================
// Contabilidad personal — Marvin Matias
// Ahora con una cuenta real (Firebase Authentication + Firestore)
// para que los datos se sincronicen entre varios dispositivos.
// La clave numérica de 8 dígitos se mantiene como un "bloqueo
// rápido" de conveniencia una vez que el dispositivo ya inició
// sesión con la cuenta real; la seguridad de verdad la dan el
// login con correo/contraseña y las reglas de Firestore, que solo
// permiten leer y escribir a la cuenta autorizada de Marvin.
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
  sembrarDatosHistoricosSiHaceFalta();
  suscribirMovimientos();
}

function bloquear() {
  sessionStorage.removeItem(LLAVE_SESION);
  desuscribirMovimientos();
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

  categoriasHist.forEach((cat) => {
    cat.data.forEach((valor, i) => {
      if (valor > 0) {
        semilla.push({
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
    tipo: "ingreso",
    concepto: "Interés Letty (pago 1 sep)",
    monto: 225,
    fecha: "2026-09-01",
    categoria: "Otro",
  });

  // Saldo activo del préstamo a Letty después del pago del 1 de
  // septiembre (bajó de Q15,000 a Q10,000).
  semilla.push({
    tipo: "prestamo",
    concepto: "Préstamo a Letty (saldo activo, 1.5%/mes)",
    monto: 10000,
    fecha: "2026-09-01",
    categoria: "Otro",
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
const movCategoria = document.getElementById("mov-categoria");
const tablaCuerpo = document.getElementById("tabla-cuerpo");
const tablaVacio = document.getElementById("tabla-vacio");
const btnExportar = document.getElementById("btn-exportar");

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
      btn.disabled = true;
      deleteDoc(doc(db, COLECCION_MOVS, id)).catch((err) => {
        console.error("Error eliminando movimiento:", err);
        alert("No se pudo eliminar el movimiento. Revisa tu conexión e intenta de nuevo.");
        btn.disabled = false;
      });
    });
  });
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
}

formMovimiento.addEventListener("submit", (e) => {
  e.preventDefault();
  const nuevo = {
    tipo: tipoActivo,
    concepto: movConcepto.value.trim(),
    monto: parseFloat(movMonto.value),
    fecha: movFecha.value,
    categoria: movCategoria.value,
  };
  if (!nuevo.concepto || isNaN(nuevo.monto) || !nuevo.fecha) return;

  const btnEnviar = formMovimiento.querySelector('button[type="submit"]');
  if (btnEnviar) btnEnviar.disabled = true;

  addDoc(collection(db, COLECCION_MOVS), nuevo)
    .then(() => {
      formMovimiento.reset();
      movFecha.valueAsDate = new Date();
    })
    .catch((err) => {
      console.error("Error guardando movimiento:", err);
      alert("No se pudo guardar el movimiento. Revisa tu conexión e intenta de nuevo.");
    })
    .finally(() => {
      if (btnEnviar) btnEnviar.disabled = false;
    });
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
