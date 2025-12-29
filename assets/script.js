/* ===============================================================
    VARIABLES GLOBALES
================================================================ */
// 🚨 VARIABLE DE CONTROL DE MANTENIMIENTO 🚨
// Si es 'true', la web mostrará el aviso de actualización y detendrá la ejecución del resto del script.
const IS_MAINTENANCE_MODE = false; // <-- ¡CAMBIA ESTO a 'false' para desactivar el modo y a 'true' para activar el modo!

let ProyectosAR = {};
const KEY_STORAGE = "arUserCodes";
const KEY_THEME = "arThemePreference";

/* ===============================================================
    FUNCIÓN DE CHEQUEO DE MANTENIMIENTO
================================================================ */
function checkMaintenanceMode() {
    if (IS_MAINTENANCE_MODE) {
        const overlay = document.getElementById('maintenance-overlay');
        const loadingView = document.getElementById("loading-view");
        
        // 1. Mostrar el overlay
        if (overlay) overlay.classList.remove('maintenance-hide');
        
        // 2. Ocultar la vista de carga (si existe)
        if (loadingView) loadingView.style.display = 'none'; 
        
        console.log("Modo Mantenimiento Activado. Deteniendo carga del índice.");
        return true; 
    }
    return false; 
}


/* ===============================================================
    TOOLTIP DE TEMAS (TEXTO TEMPORAL AL SELECCIONAR)
================================================================ */
function setupThemeTooltips() {
    document.querySelectorAll(".circle").forEach(circle => {

        // Usar data-title para tooltip sin que el navegador moleste
        let t = circle.getAttribute("title") || circle.dataset.value;
        circle.setAttribute("data-title", t);
        circle.removeAttribute("title");

        // Mostrar tooltip cuando se selecciona el tema
        circle.addEventListener("click", () => {
            // eliminar tooltip previo
            document.querySelectorAll(".circle")
                .forEach(c => c.classList.remove("show-tooltip"));

            // activar tooltip en el seleccionado
            circle.classList.add("show-tooltip");

            // eliminar después de 1 segundo
            setTimeout(() => {
                circle.classList.remove("show-tooltip");
            }, 1000);
        });
    });
}


/* ===============================================================
    CARGA DE PROYECTOS
================================================================ */
async function loadData() {
    try {
        // Asegúrate de que esta ruta sea correcta
        const r = await fetch("./index-vault/IndexSet.json"); 
        if (!r.ok) throw new Error("Network error or file not found");
        ProyectosAR = await r.json();
        // Ocultar la vista de carga SOLO si no estamos en modo mantenimiento
        document.getElementById("loading-view").style.display = "none";
        init();
    } catch (e) {
        console.error("Error al cargar IndexSet.json:", e);
        document.getElementById("loading-view").innerHTML = "Error al cargar datos.";
    }
}

/* ===============================================================
    APLICAR TEMA
================================================================ */
// Se mantiene como global para el evento DOMContentLoaded
function applyTheme(theme) {
    const body = document.body;

    const finalTheme = (theme === "auto")
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;

    // Quita cualquier tema anterior y aplica el nuevo
    body.className = finalTheme + "-theme"; 
    localStorage.setItem(KEY_THEME, theme);

    document.querySelectorAll(".circle").forEach(c =>
        c.classList.toggle("active", c.dataset.value === theme)
    );
}

/* ===============================================================
    ACCESO
================================================================ */
// Se mantiene como global para el onclick en el HTML
function handleAccess() {
    const code = document.getElementById("user-code").value.trim();
    const name = document.getElementById("user-name").value.trim() || code;

    const err = document.getElementById("error-message");

    if (ProyectosAR[code]) {
        saveCode(code, name, ProyectosAR[code].ruta);
        // Asegúrate de que esta ruta sea correcta
        window.location.href = `./module/${ProyectosAR[code].ruta}/?code=${code}`;
    } else {
        err.textContent = "Código no válido";
        err.style.display = "block";
    }
}

function saveCode(code, name, ruta) {
    let codes = JSON.parse(localStorage.getItem(KEY_STORAGE) || "[]");
    if (!codes.some(c => c.code === code)) {
        codes.push({ code, name, ruta });
        localStorage.setItem(KEY_STORAGE, JSON.stringify(codes));
    }
}

/* ===============================================================
    VISTAS
================================================================ */
// Se mantiene como global para el onclick en el HTML
function toggleViews(view) {
    document.getElementById("input-view").style.display = (view === "input" ? "block" : "none");
    document.getElementById("selection-view").style.display = (view === "selection" ? "block" : "none");

    if (view === "selection") renderList();
}

/* ===============================================================
    LISTA DE USUARIOS GUARDADOS
================================================================ */
function renderList() {
    const list = document.getElementById("selection-list");
    const codes = JSON.parse(localStorage.getItem(KEY_STORAGE) || "[]");

    list.innerHTML = codes.length ? "" : "No hay usuarios guardados.";

    codes.forEach(c => {
        const item = document.createElement("div");
        item.className = "project-selection-item";

        item.innerHTML = `
            <h3>${c.name} (${c.code})</h3>
            <div class="selection-actions">
                <button class="access-btn" onclick="window.location.href='./module/${c.ruta}/?code=${c.code}'">Entrar</button>
                <button class="delete-btn" onclick="removeCode('${c.code}')">Eliminar</button>
            </div>
        `;
        list.appendChild(item);
    });

    document.getElementById("back-button").style.display = (codes.length ? "inline-block" : "none");
}

// Se mantiene como global para el onclick generado en renderList
function removeCode(code) {
    let codes = JSON.parse(localStorage.getItem(KEY_STORAGE) || "[]");
    localStorage.setItem(KEY_STORAGE, JSON.stringify(codes.filter(c => c.code !== code)));
    renderList();
}

/* ===============================================================
    INICIO
================================================================ */
function init() {
    const codes = JSON.parse(localStorage.getItem(KEY_STORAGE) || "[]");
    codes.length ? toggleViews("selection") : toggleViews("input");
}

/* ===============================================================
    EVENTOS DE INICIO
================================================================ */
document.addEventListener("DOMContentLoaded", () => {
    
    // 🚨 0. CHEQUEO GLOBAL DE MANTENIMIENTO Y SALIDA 🚨
    if (checkMaintenanceMode()) {
        // Si el modo mantenimiento está activo, salimos de la función y detenemos la inicialización.
        return; 
    }

    // --- El resto del código solo se ejecuta si NO estamos en modo mantenimiento ---

    // 1. Inicializar Tooltips
    setupThemeTooltips();

    // 2. Aplicar y Configurar Tema
    const saved = localStorage.getItem(KEY_THEME) || "auto";
    applyTheme(saved);

    document.querySelectorAll(".circle").forEach(c => {
        c.onclick = () => applyTheme(c.dataset.value);
    });

    // 3. Cargar Datos y Continuar con Init
    loadData();

    // 4. ENTER para ejecutar "Acceder"
    document.getElementById("user-code").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAccess();
    });
});
