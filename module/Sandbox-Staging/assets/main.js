// main.js (Ejecución Inmediata)

// RUTA CORRECTA: Asume que main.js está en assets/ y el JSON está en assets/IndexSet2.json
const JSON_PATH = './assets/IndexSet2.json'; 
    
const sceneEl = document.querySelector('a-scene');
const controls = document.querySelector("#ui-controls");
const trackRef = { track: null };
const btnFlash = document.querySelector("#btn-flash");
const btnNextVideo = document.querySelector("#btn-next-video");
const targetContainer = document.querySelector("#target-container");
const assetsContainer = document.querySelector("#assets-container");

let videoRotationState = {}; 
let config = null; 
let activeTargetIndex = null;

// === COMPONENTE KEEP-ALIVE CORREGIDO ===
// Componente custom para mantener el renderizado activo, con chequeo de seguridad
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
            // Elemento <video> en <a-assets> - Se deja el SRC vacío.
            const videoAsset = document.createElement('video');
            videoAsset.setAttribute('id', videoData.id);
            videoAsset.setAttribute('preload', 'none'); 
            
            videoAsset.setAttribute('loop', 'true');
            videoAsset.setAttribute('playsinline', 'true');
            videoAsset.setAttribute('webkit-playsinline', 'true');
            // Nota: Inicialmente mutes para permitir autoplay en la mayoría de navegadores.
            videoAsset.setAttribute('muted', 'muted'); 
            videoAsset.setAttribute('crossorigin', 'anonymous');
            assetsContainer.appendChild(videoAsset);
            
            // Elemento <a-video> (entidad AR)
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

    showVideo(targetIndex, state.currentVideoIndex);

    // SOLUCIÓN CLAVE: Asignar el SRC y forzar la carga justo antes de reproducir
    if (currentVidAsset.src !== currentUrl) {
        currentVidAsset.src = currentUrl;
        currentVidAsset.load(); // Forzar al navegador a iniciar el fetch
        console.log(`[TARGET ${targetIndex}] Iniciando carga de video: ${currentUrl}`);
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

// === LÓGICA DE UI Y FLASH (CORREGIDA) ===

// Detección de Flash
sceneEl.addEventListener("arReady", () => {
    
    // SOLUCIÓN DE TIMING: Espera 100ms para asegurar la asignación del stream
    setTimeout(() => {
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;

        if (mindarComponent && mindarComponent.el.components['mindar-image'] && mindarComponent.stream) {
            try {
                 track = mindarComponent.stream.getVideoTracks()[0]; 
            } catch (e) {
                 // Advertencia si no se puede obtener el track
                 console.warn("No se pudo obtener el track de video del stream, pero MindAR inició.", e);
            }
        }
        
        if (track) {
            trackRef.track = track;
            let flashAvailable = false;
            
            // Chequeo de capacidades más tolerante
            try {
                flashAvailable = track.getCapabilities().torch || false;
            } catch (e) {
                // Captura el error si el navegador no tiene el método getCapabilities() para 'torch'
                console.warn("El dispositivo no soporta la capacidad 'torch' (flash).", e);
            }

            btnFlash.style.display = "flex"; 
            if (flashAvailable) {
                btnFlash.innerHTML = "⚡ FLASH OFF"; 
                btnFlash.disabled = false;
            } else {
                // Si no es compatible, se muestra deshabilitado con un mensaje neutral.
                btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
                btnFlash.disabled = true;
            }
        } else {
            // Si el track sigue siendo nulo después del timeout, mostramos un mensaje neutral.
            console.error("🔴 CÁMARA NO DETECTADA (No se pudo obtener el Track de video para Flash).");
            btnFlash.style.display = "flex";
            btnFlash.innerHTML = "🔴 CÁMARA NO DISPONIBLE"; 
            btnFlash.disabled = true;
        }
    }, 100); 
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
document.querySelector("#btn-audio").addEventListener("click", function() {
    // Tomamos el estado actual de mute del primer video como referencia
    const state0 = videoRotationState[0];
    const isCurrentlyMuted = state0 && state0.htmlVideos.length > 0 ? state0.htmlVideos[0].muted : true;

    Object.values(videoRotationState).forEach(state => {
        state.htmlVideos.forEach(v => {
            v.muted = !isCurrentlyMuted;
            // Intentar reproducir si no estaba muteado y estaba en pausa
            if (!v.muted && v.paused) v.play().catch(e => {}); 
        });
    });

    // Nota: El usuario debe hacer la corrección en el HTML para que inicie correctamente
    this.style.background = !isCurrentlyMuted ? "var(--danger)" : "var(--accent)";
    this.innerHTML = isCurrentlyMuted ? "🔊 SONIDO" : "🔇 SILENCIO";
});

document.querySelector("#btn-toggle-ui").addEventListener("click", () => {
    controls.classList.toggle("hidden");
});

// Botón de Rotación Manual
btnNextVideo.addEventListener("click", rotateVideoManually);

// Botón de Calidad
document.querySelector("#btn-hd").addEventListener("click", function() {
    const isSD = this.innerHTML.includes("SD");
    this.innerHTML = isSD ? "📺 CALIDAD: HD" : "📺 CALIDAD: SD";
    
    const antialiasValue = isSD ? 'true' : 'false';
    
    sceneEl.setAttribute('renderer', `preserveDrawingBuffer: true; antialias: ${antialiasValue}; colorManagement: true`);
});


// --- INICIO DEL CÓDIGO (EJECUCIÓN INMEDIATA) ---
loadConfig();
