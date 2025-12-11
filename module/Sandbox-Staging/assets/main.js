// main.js (Ejecución Inmediata)

// RUTA CORREGIDA: Apunta a la subcarpeta 'assets' donde reside el JSON.
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
        const scene = this.el.sceneEl; // Referencia segura a la escena

        // Chequeos de seguridad antes de intentar renderizar
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

// Función para asignar las URLs de video. Se llama en el evento 'loaded'.
function assignVideoSources() {
    console.log("Asignando URLs de video a elementos <video>...");
    Object.values(videoRotationState).forEach(state => {
        state.htmlVideos.forEach((videoAsset, index) => {
            const url = state.videoURLs[index];
            if (url && !videoAsset.src) {
                // Asignar la URL dispara la carga (fetch) del .mp4
                videoAsset.src = url;
            }
        });
    });
}


function initializeScene() {
    const { Targets } = config; 

    // 1. Iterar sobre CADA MARCADOR
    Targets.forEach(target => {
        const { targetIndex, videos } = target;
        
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: [],
            arVideos: [],
            videoURLs: [], 
            numVideos: videos.length
        };

        // 2. Crear la entidad MindAR Target
        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        // 3. Crear los elementos <video> y <a-video>
        videos.forEach((videoData, index) => {
            // Elemento <video> en <a-assets>
            const videoAsset = document.createElement('video');
            videoAsset.setAttribute('id', videoData.id);
            videoAsset.setAttribute('preload', 'none'); 
            
            videoAsset.setAttribute('loop', 'true');
            videoAsset.setAttribute('playsinline', 'true');
            videoAsset.setAttribute('webkit-playsinline', 'true');
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
        
        // 4. Asignar Eventos de Tracking
        setupTrackingEvents(targetIndex, targetEntity);
    });
    
    // 🚨 Corrección de Timing: Asignamos las URLs cuando A-Frame confirma que los assets están listos.
    sceneEl.addEventListener('loaded', () => {
        assignVideoSources();
    }, { once: true });
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
    showVideo(targetIndex, state.currentVideoIndex);

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
    // Intentar reproducir. (Debe ser en respuesta a una interacción del usuario)
    currentVidAsset.play().catch(error => {
        console.warn("Fallo al intentar reproducir video. Generalmente requiere interacción de usuario.", error);
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

// === LÓGICA DE UI Y FLASH (Ajustada con setTimeout) ===

// Detección de Flash
sceneEl.addEventListener("arReady", () => {
    
    // 🚨 SOLUCIÓN FINAL DE TIMING PARA EL TRACK DE LA CÁMARA
    setTimeout(() => {
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;

        // Intentamos obtener el stream directamente desde el componente MindAR
        if (mindarComponent && mindarComponent.stream) {
            try {
                 // Accedemos a la propiedad 'stream' que MindAR almacena internamente
                 track = mindarComponent.stream.getVideoTracks()[0]; 
            } catch (e) {
                 console.warn("No se pudo obtener el track de video del stream:", e);
            }
        }
        
        if (track) {
            trackRef.track = track;
            const flashAvailable = track.getCapabilities().torch;

            btnFlash.style.display = "flex"; 
            if (flashAvailable) {
                btnFlash.innerHTML = "⚡ FLASH OFF"; 
                btnFlash.disabled = false;
            } else {
                btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
                btnFlash.disabled = true;
            }
        } else {
            // Fallback si no se puede acceder al track 
            console.error("🔴 CÁMARA NO DETECTADA (Fallo asíncrono)");
            btnFlash.style.display = "flex";
            btnFlash.innerHTML = "🔴 CÁMARA NO DETECTADA";
            btnFlash.disabled = true;
        }
    }, 1); // Espera 1ms para que el stream se asigne completamente.
});

// Lógica de click del botón de flash
btnFlash.addEventListener("click", function() {
    if (trackRef.track && !this.disabled) {
        const settings = trackRef.track.getSettings();
        const isCurrentlyOn = settings.torch || false;

        trackRef.track.applyConstraints({ advanced: [{ torch: !isCurrentlyOn }] }).then(() => {
            this.classList.toggle("active", !isCurrentlyOn);
            this.innerHTML = !isCurrentlyOn ? "⚡ FLASH ON" : "⚡ FLASH OFF";
        });
    }
});

// LÓGICA DE AUDIO GLOBAL
document.querySelector("#btn-audio").addEventListener("click", function() {
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
