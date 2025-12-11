// main.js

const JSON_PATH = './assets/IndexSet2.json'; 
    
let sceneEl;
let controls;
let trackRef = { track: null };
let btnFlash;
let btnNextVideo;
let targetContainer;
let assetsContainer;

let videoRotationState = {}; 
let config = null; 
let activeTargetIndex = null;

// Función de utilidad para seleccionar elementos de forma segura
function safeQuerySelector(selector, name) {
    const el = document.querySelector(selector);
    if (!el) {
        console.error(`ERROR FATAL: El elemento UI '${name}' con selector '${selector}' no se encontró.`);
        // Devolvemos un objeto Dummy para evitar errores en addEventListener
        return { 
            addEventListener: () => {}, 
            style: { display: 'none' }, 
            innerHTML: `[FALTA ${name}]`,
            disabled: true,
            classList: { toggle: () => {} }
        };
    }
    return el;
}

// 1. Inicializa los selectores de forma segura
function initializeSelectors() {
    sceneEl = safeQuerySelector('#scene-ar', 'Scene A-Frame');
    controls = safeQuerySelector("#ui-controls", 'UI Controls Container');
    btnFlash = safeQuerySelector("#btn-flash", 'Flash Button');
    btnNextVideo = safeQuerySelector("#btn-next-video", 'Next Video Button'); 
    targetContainer = safeQuerySelector("#target-container", 'Target Container');
    assetsContainer = safeQuerySelector("#assets-container", 'Assets Container');
}


// === COMPONENTE KEEP-ALIVE ===
AFRAME.registerComponent('keep-alive', {
    tick: function () {
        const scene = this.el.sceneEl; 
        if (scene && scene.renderer && scene.renderStarted && !scene.paused) {
            scene.renderer.render(scene.object3D, scene.camera);
        }
    }
});

// === FUNCIONES DE INICIALIZACIÓN Y CARGA ===

async function loadConfig() {
    try {
        const response = await fetch(JSON_PATH);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        config = await response.json();
        initializeScene();
    } catch (error) {
        console.error("Error al cargar la configuración JSON. Revisada la ruta y sintaxis.", error);
        alert("No se pudo cargar la configuración de videos. Revisa la ruta JSON y su contenido.");
    }
}

function initializeScene() {
    const { Targets } = config; 
    
    if (!assetsContainer.appendChild) return; 

    Targets.forEach(target => {
        const { targetIndex, videos } = target;
        
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: [],
            arVideos: [],
            videoURLs: [], 
            numVideos: videos.length
        };

        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        videos.forEach((videoData, index) => {
            const videoAsset = document.createElement('video');
            videoAsset.setAttribute('id', videoData.id);
            videoAsset.setAttribute('preload', 'none'); 
            videoAsset.setAttribute('loop', 'true');
            videoAsset.setAttribute('playsinline', 'true');
            videoAsset.setAttribute('webkit-playsinline', 'true');
            videoAsset.setAttribute('muted', 'muted'); 
            videoAsset.setAttribute('crossorigin', 'anonymous');
            assetsContainer.appendChild(videoAsset);
            
            const videoEntity = document.createElement('a-video');
            videoEntity.setAttribute('id', `ar-video-${targetIndex}-${index}`);
            videoEntity.setAttribute('src', `#${videoData.id}`);
            videoEntity.setAttribute('width', videoData.width);
            videoEntity.setAttribute('height', videoData.height);
            videoEntity.setAttribute('visible', index === 0); 

            targetEntity.appendChild(videoEntity);
            
            videoRotationState[targetIndex].htmlVideos.push(videoAsset);
            videoRotationState[targetIndex].arVideos.push(videoEntity);
            videoRotationState[targetIndex].videoURLs.push(videoData.src); 
        });
        
        targetContainer.appendChild(targetEntity);
        
        setupTrackingEvents(targetIndex, targetEntity);
    });
}

// === LÓGICA DE ROTACIÓN Y VIDEO ===

function showVideo(targetIndex, videoIndex) {
    const state = videoRotationState[targetIndex];
    state.arVideos.forEach((vidEl, i) => {
        vidEl.setAttribute('visible', i === videoIndex);
    });
    state.currentVideoIndex = videoIndex;
}

function playCurrentVideo(targetIndex) {
    const state = videoRotationState[targetIndex];
    const currentVidAsset = state.htmlVideos[state.currentVideoIndex];
    const currentUrl = state.videoURLs[state.currentVideoIndex]; 

    // Pausa preventiva de todos los videos para evitar conflictos al cambiar de target
    Object.values(videoRotationState).forEach(s => {
        s.htmlVideos.forEach(v => {
            if (v !== currentVidAsset) {
                v.pause();
                v.currentTime = 0;
            }
        });
    });

    showVideo(targetIndex, state.currentVideoIndex);

    // Corregido: Usar un atributo de datos para asegurar que el SRC se asigne solo una vez (Elimina el bucle de carga).
    if (currentVidAsset.dataset.loadedSrc !== currentUrl) {
        currentVidAsset.src = currentUrl;
        currentVidAsset.load(); 
        currentVidAsset.dataset.loadedSrc = currentUrl; 
        console.log(`[TARGET ${targetIndex}] Asignando SRC y cargando video: ${currentUrl}`);
    }
    
    if (state.numVideos > 1) {
            currentVidAsset.onended = () => {
            const isTracking = sceneEl.components['mindar-image'].data.trackedTargetIndex === targetIndex;
            if (isTracking) {
                const nextIndex = (state.currentVideoIndex + 1) % state.numVideos;
                currentVidAsset.currentTime = 0; 
                showVideo(targetIndex, nextIndex);
                playCurrentVideo(targetIndex);
            } else {
                currentVidAsset.onended = null;
            }
        };
    } else {
        currentVidAsset.onended = null;
    }
    
    currentVidAsset.play().catch(error => {
        console.warn("Fallo al intentar reproducir video. Causa común: Autoplay bloqueado.", error);
    }); 
}

function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    if (activeTargetIndex === null || state.numVideos <= 1) return;
    
    const currentVidAsset = state.htmlVideos[state.currentVideoIndex];
    currentVidAsset.pause();
    currentVidAsset.currentTime = 0;
    currentVidAsset.onended = null; 

    const nextIndex = (state.currentVideoIndex + 1) % state.numVideos;
    showVideo(activeTargetIndex, nextIndex);
    playCurrentVideo(activeTargetIndex);
}

// === LÓGICA DE TRACKING Y EVENTOS ===

function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        // Pausar todos los otros videos antes de empezar la reproducción del nuevo
        Object.keys(videoRotationState).forEach(idx => {
            if (parseInt(idx) !== targetIndex) {
                videoRotationState[idx].htmlVideos.forEach(v => { v.pause(); v.currentTime = 0; });
            }
        });
        
        activeTargetIndex = targetIndex; 
        
        if (videoRotationState[targetIndex].numVideos > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        playCurrentVideo(targetIndex);
    });

    targetEntity.addEventListener("targetLost", () => {
        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';
        }
        
        const state = videoRotationState[targetIndex];
        state.htmlVideos.forEach(vid => {
            vid.pause();
            vid.currentTime = 0;
            vid.onended = null; 
        });
        
        state.arVideos.forEach(el => el.setAttribute('visible', false));
        showVideo(targetIndex, 0); 
    });
}

// === INICIALIZACIÓN DE LA INTERFAZ DE USUARIO (UI) ===
function initializeUI() {
    
    // Detección de Flash
    sceneEl.addEventListener("arReady", () => {
        
        // El botón de Flash NO se hace visible automáticamente.
        
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;
        let flashAvailable = false;

        // Intentar obtener el track
        if (mindarComponent && mindarComponent.stream) {
            try {
                 track = mindarComponent.stream.getVideoTracks()[0]; 
            } catch (e) {
                 console.warn("No se pudo obtener el track de video del stream:", e);
            }
        }
        
        if (track) {
            trackRef.track = track;
            
            try {
                // Verificar si el dispositivo soporta 'torch'
                flashAvailable = track.getCapabilities().torch || false;
            } catch (e) {
                console.warn("El dispositivo no soporta la capacidad 'torch' (flash).", e);
            }

            if (flashAvailable) {
                // 🟢 Compatible: Hacemos el botón visible y habilitado.
                btnFlash.style.display = "flex"; 
                btnFlash.innerHTML = "⚡ FLASH OFF"; 
                btnFlash.disabled = false;
            } else {
                // 🔴 No Soportado: Se mantiene invisible (display: none en HTML) y deshabilitado.
                btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
                btnFlash.disabled = true;
            }
        } else {
            // ⚠️ No se detectó el track: Se mantiene invisible (display: none en HTML) y deshabilitado.
            console.warn("⚠️ No se pudo obtener el Track de video. Flash deshabilitado e invisible.");
            btnFlash.innerHTML = "❌ FLASH NO DISPONIBLE"; 
            btnFlash.disabled = true;
        }
    });

    // Lógica de click del botón de flash
    btnFlash.addEventListener("click", function() {
        if (trackRef.track && !this.disabled) {
            const settings = trackRef.track.getSettings();
            const isCurrentlyOn = settings.torch || false;

            trackRef.track.applyConstraints({ advanced: [{ torch: !isCurrentlyOn }] }).then(() => {
                this.classList.toggle("active", !isCurrentlyOn);
                this.innerHTML = !isCurrentlyOn ? "⚡ FLASH ON" : "⚡ FLASH OFF";
            }).catch(error => {
                console.error("Error al intentar aplicar la restricción del flash:", error);
                alert("No se pudo controlar el flash en este dispositivo.");
            });
        }
    });

    // LÓGICA DE AUDIO GLOBAL
    safeQuerySelector("#btn-audio", 'Audio Button').addEventListener("click", function() {
        const state0 = videoRotationState[0];
        const isCurrentlyMuted = state0 && state0.htmlVideos.length > 0 ? state0.htmlVideos[0].muted : true;

        Object.values(videoRotationState).forEach(state => {
            state.htmlVideos.forEach(v => {
                v.muted = !isCurrentlyMuted;
                if (!v.muted && v.paused) v.play().catch(e => {}); 
            });
        });

        this.style.background = !isCurrentlyMuted ? "var(--danger)" : "var(--accent)";
        this.innerHTML = isCurrentlyMuted ? "🔊 SONIDO" : "🔇 SILENCIO";
    });

    // LÓGICA DE TOGGLE UI
    safeQuerySelector("#btn-toggle-ui", 'Toggle UI Button').addEventListener("click", () => {
        controls.classList.toggle("hidden");
    });

    // Botón de Rotación Manual
    btnNextVideo.addEventListener("click", rotateVideoManually);

    // Botón de Calidad
    safeQuerySelector("#btn-hd", 'HD Button').addEventListener("click", function() {
        const isSD = this.innerHTML.includes("SD");
        this.innerHTML = isSD ? "📺 CALIDAD: HD" : "📺 CALIDAD: SD";
        
        const antialiasValue = isSD ? 'true' : 'false';
        
        sceneEl.setAttribute('renderer', `preserveDrawingBuffer: true; antialias: ${antialiasValue}; colorManagement: true`);
    });
}


// --- INICIO DEL CÓDIGO ---

// 1. Inicializa los selectores de forma segura
initializeSelectors();

// 2. Carga la configuración (crea los elementos de video y entidades AR)
loadConfig();

// 3. Inicializa los Listeners de la UI de forma segura después de que el DOM esté cargado.
document.addEventListener('DOMContentLoaded', initializeUI);
