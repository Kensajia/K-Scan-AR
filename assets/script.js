/* ===============================================================
    VARIABLES GLOBALES
================================================================ */
// 🚨 VARIABLE DE CONTROL DE MANTENIMIENTO 🚨
// Si es 'true', la web mostrará el aviso de actualización y detendrá la ejecución del resto del script.
const IS_MAINTENANCE_MODE = true; // <-- ¡CAMBIA ESTO a 'false' para desactivar el modo y a 'true' para activar el modo!

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
        
        console.log("Modo Mantenimiento Activado. Deteniendo carga del ¨ªndice.");
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

            // eliminar despuÃ©s de 1 segundo
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
        // AsegÃºrate de que esta ruta sea correcta
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

    // Cerrar esc¨¢ner si se cambia de vista para evitar dejar la c¨¢mara encendida
    closeQRScanner();

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


/* ===============================================================
    CONTROL DEL LECTOR QR (OPCIÓN 2: LÓGICA PERSONALIZADA)
================================================================ */
let html5QrcodeInstance = null; // Guarda la instancia activa del esc¨¢ner

async function openQRScanner() {
    // Si ya hay una instancia corriendo, no duplicar
    if (html5QrcodeInstance) return;

    const scannerContainer = document.getElementById("qr-scanner-container");
    const errorMsg = document.getElementById("error-message");
    
    errorMsg.style.display = "none";
    scannerContainer.style.display = "block"; // Mostrar contenedor visual

    // Inicializar la instancia apuntando al div objetivo sin interfaz construida
    html5QrcodeInstance = new Html5Qrcode("qr-video-target");

    try {
        // Iniciar c¨¢mara trasera ('environment')
        await html5QrcodeInstance.start(
            { facingMode: "environment" },
            {
                fps: 10,             // Cuadros por segundo optimizados para legibilidad m¨®vil
                qrbox: { width: 250, height: 250 } // Dimensi¨®n de escaneo efectivo
            },
            (decodedText) => {
                // ?? CASO DE ¨¦XITO: C¨®digo QR detectado de forma efectiva
                document.getElementById("user-code").value = decodedText;
                
                // Apagar la c¨¢mara de inmediato para conservar recursos y cerrar visor
                closeQRScanner();
            },
            (errorMessage) => {
                // Modo silencioso: la librer¨ªa escanea constantemente y arroja fallos anal¨ªticos por milisegundo
                // No los imprimimos para evitar saturar la consola de desarrollo
            }
        );
    } catch (err) {
        console.error("Error al iniciar la c¨¢mara:", err);
        errorMsg.textContent = "No se pudo acceder a la c¨¢mara o no tienes permisos.";
        errorMsg.style.display = "block";
        closeQRScanner();
    }
}

async function closeQRScanner() {
    const scannerContainer = document.getElementById("qr-scanner-container");
    
    // Si el esc¨¢ner est¨¢ activo y transmitiendo, se detiene de forma as¨ªncrona
    if (html5QrcodeInstance && html5QrcodeInstance.isScanning) {
        try {
            await html5QrcodeInstance.stop();
        } catch (err) {
            console.error("Error al detener el esc¨¢ner:", err);
        }
    }
    
    // Resetear variables e interfaz limpia
    html5QrcodeInstance = null;
    if (scannerContainer) {
        scannerContainer.style.display = "none";
    }
}
