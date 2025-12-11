// main.js (Ejecución Inmediata)

// AJUSTE DE RUTA: Asume que main.js y IndexSet2.json están en la misma carpeta (assets/)
const JSON_PATH = './assets/IndexSet2.json'; 
    
const sceneEl = document.querySelector('a-scene');
const controls = document.querySelector("#ui-controls");
const trackRef = { track: null };
const btnFlash = document.querySelector("#btn-flash");
const btnNextVideo = document.querySelector("#btn-next-video");
const targetContainer = document.querySelector("#target-container");
const assetsContainer = document.querySelector("#assets-container");

// Video Rotation State: Objeto para manejar el estado de cada marcador
let videoRotationState = {}; 
let config = null; 
let activeTargetIndex = null;

// Componente custom para mantener el renderizado activo
AFRAME.registerComponent('keep-alive', {
    tick: function () {
        if (this.el.sceneEl.renderStarted && !this.el.el.sceneEl.paused) {
            this.el.sceneEl.renderer.render(this.el.sceneEl.object3D, this.el.sceneEl.camera);
        }
    }
});

// === FUNCIONES DE INICIALIZACIÓN Y CARGA ===

async function loadConfig() {
    try {
        const response = await fetch(JSON_PATH);
        // Verificar si la respuesta fue OK antes de intentar parsear JSON
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        config = await response.json();
        initializeScene();
    } catch (error) {
        console.error("Error al cargar la configuración JSON. Revisada la ruta y sintaxis.", error);
        // Usar un alert genérico, ya que el usuario final no necesita ver el error de la consola
        alert("No se pudo cargar la configuración de videos. Revisa la ruta JSON y su contenido.");
    }
}

// Nueva función para asignar las URLs de video SOLAMENTE después de que A-Frame se cargue
function assignVideoSources() {
    // Itera sobre todos los estados de marcador
    Object.values(videoRotationState).forEach(state => {
        state.htmlVideos.forEach((videoAsset, index) => {
            const url = state.videoURLs[index];
            if (url && !videoAsset.src) {
                videoAsset.src = url;
            }
        });
    });
}


function initializeScene() {
    const { MindARConfig, Targets } = config; 
    
    // 1. Configurar A-Scene con JSON
    const mindarAttrs = 
        `imageTargetSrc: ${MindARConfig.imageTargetSrc}; ` +
        `maxTrack: ${MindARConfig.maxTrack}; ` +
        `filterMinCF: ${MindARConfig.filterMinCF}; ` +
        `filterBeta: ${MindARConfig.filterBeta}`;
        
    // 🚨 ESTA LLAMADA DEBE SER LO MÁS TEMPRANA POSIBLE
    sceneEl.setAttribute('mindar-image', mindarAttrs); 

    // 2. Iterar sobre CADA MARCADOR
    Targets.forEach(target => {
        const { targetIndex, videos } = target;
        
        // Inicializar el estado de rotación para este marcador
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: [],
            arVideos: [],
            videoURLs: [], 
            numVideos: videos.length
        };

        // 3. Crear la entidad MindAR Target
        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        // 4. Crear los elementos <video> y <a-video>
        videos.forEach((videoData, index) => {
            // Elemento <video> en <a-assets>
            const videoAsset = document.createElement('video');
            videoAsset.setAttribute('id', videoData.id);
            videoAsset.setAttribute('preload', 'none'); // Previene la carga y audio prematuros
            
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
            
            // Usar dimensiones específicas del video
            videoEntity.setAttribute('width', videoData.width);
            videoEntity.setAttribute('height', videoData.height);
            
            videoEntity.setAttribute('visible', index === 0); 

            targetEntity.appendChild(videoEntity);
            
            // Almacenar referencias y URLs
            videoRotationState[targetIndex].htmlVideos.push(videoAsset);
            videoRotationState[targetIndex].arVideos.push(videoEntity);
            videoRotationState[targetIndex].videoURLs.push(videoData.src); 
        });
        
        targetContainer.appendChild(targetEntity);
        
        // 5. Asignar Eventos de Tracking
        setupTrackingEvents(targetIndex, targetEntity);
    });
    
    // 6. ASIGNACIÓN TARDÍA DE FUENTES: Llama a la función SOLO cuando A-Frame dispara 'loaded'
    sceneEl.addEventListener('loaded', assignVideoSources, { once: true });
}

// === LÓGICA DE ROTACIÓN DE VIDEOS ===

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

    // Lógica de Rotación Automática al finalizar (si tiene más de un video)
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

    // Reproducir (y manejar promesas de reproducción)
    currentVidAsset.play().catch(error => {
        // Error común si el usuario no ha interactuado.
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

// === LÓGICA DE UI Y FLASH ===

// Detección de Flash
sceneEl.addEventListener("arReady", () => {
    const mindarComponent = sceneEl.components['mindar-image'];
    let track = null;

    if (mindarComponent && mindarComponent.getCameraStream) {
        const stream = mindarComponent.getCameraStream();
        if (stream) {
            track = stream.getVideoTracks()[0];
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
        console.error("🔴 CÁMARA NO DETECTADA");
        btnFlash.style.display = "flex";
        btnFlash.innerHTML = "🔴 CÁMARA NO DETECTADA";
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

