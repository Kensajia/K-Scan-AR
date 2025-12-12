// main.js (PLANTILLA ÚNICA: Videos Estándar, Chroma, 3D Estático/Animado, Audio)

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

// LÓGICA DE CREACIÓN DE ENTIDADES (SOPORTE 3D, CHROMA Y VIDEO)
function initializeScene() {
    const { Targets } = config; 
    
    if (!assetsContainer.appendChild) return; 

    Targets.forEach(target => {
        const { targetIndex, videos } = target;
        
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: [],
            arEntities: [], 
            videoURLs: [], 
            numVideos: 0, 
            hasVideoContent: false,
            audioEntity: null
        };

        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        let videoCount = 0;
        
        videos.forEach((contentData, index) => {
            
            if (contentData.type === "3d") {
                
                // === LÓGICA DE MODELOS 3D (GLTF/GLB) ===
                
                const modelAsset = document.createElement('a-asset-item');
                modelAsset.setAttribute('id', contentData.id);
                modelAsset.setAttribute('src', contentData.src);
                assetsContainer.appendChild(modelAsset);
                
                const modelEntity = document.createElement('a-entity');
                modelEntity.setAttribute('id', `ar-model-${targetIndex}-${index}`);
                modelEntity.setAttribute('gltf-model', `#${contentData.id}`);
                
                // Aplicar propiedades 3D
                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 
                
                // SOPORTE PARA ANIMACIÓN 3D
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }

                // SOPORTE PARA AUDIO 3D
                if (contentData.audioSrc) {
                    const audioId = `${contentData.id}_audio`;
                    
                    const audioAsset = document.createElement('a-asset-item');
                    audioAsset.setAttribute('id', audioId);
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    assetsContainer.appendChild(audioAsset);
                    
                    // Adjuntar el componente sound al modelo 3D
                    modelEntity.setAttribute('sound', `src: #${audioId}; autoplay: false; loop: true; volume: 0.0; positional: true;`); // 🚨 Volumen inicial 0.0
                    
                    videoRotationState[targetIndex].audioEntity = modelEntity;
                }

                targetEntity.appendChild(modelEntity);
                videoRotationState[targetIndex].arEntities.push(modelEntity);


            } else {
                
                // === LÓGICA DE VIDEOS (Estándar o Chroma) ===
                
                videoCount++;
                videoRotationState[targetIndex].hasVideoContent = true;

                const videoAsset = document.createElement('video');
                videoAsset.setAttribute('id', contentData.id);
                videoAsset.setAttribute('preload', 'none'); 
                videoAsset.setAttribute('loop', 'true');
                videoAsset.setAttribute('playsinline', 'true');
                videoAsset.setAttribute('webkit-playsinline', 'true');
                videoAsset.setAttribute('muted', 'muted'); 
                videoAsset.setAttribute('crossorigin', 'anonymous');
                assetsContainer.appendChild(videoAsset);
                
                const videoEntity = document.createElement('a-video');
                videoEntity.setAttribute('id', `ar-video-${targetIndex}-${index}`);
                
                // LÓGICA DE CHROMA KEY AGREGADA
                if (contentData.chromakey) {
                    videoEntity.setAttribute('material', 'shader: chromakey');
                    videoEntity.setAttribute('chromakey', 'color: #00ff00');
                } else {
                    videoEntity.setAttribute('src', `#${contentData.id}`);
                }
                
                videoEntity.setAttribute('width', contentData.width);
                videoEntity.setAttribute('height', contentData.height);
                videoEntity.setAttribute('visible', index === 0); 

                targetEntity.appendChild(videoEntity);
                
                videoRotationState[targetIndex].htmlVideos.push(videoAsset);
                videoRotationState[targetIndex].arEntities.push(videoEntity);
                videoRotationState[targetIndex].videoURLs.push(contentData.src); 
            }
        });
        
        // Contar videos reales solo si hay videos
        videoRotationState[targetIndex].numVideos = videoCount;
        
        targetContainer.appendChild(targetEntity);
        
        setupTrackingEvents(targetIndex, targetEntity);
    });
}

// === LÓGICA DE ROTACIÓN Y VIDEO ===

function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    // Aplica la visibilidad a la entidad A-Frame correspondiente (Video o 3D)
    state.arEntities.forEach((entityEl, i) => {
        entityEl.setAttribute('visible', i === contentIndex);
    });
    state.currentVideoIndex = contentIndex;
}

function playCurrentVideo(targetIndex) {
    const state = videoRotationState[targetIndex];
    const currentVidAsset = state.htmlVideos[state.currentVideoIndex];
    const currentUrl = state.videoURLs[state.currentVideoIndex]; 

    // Pausa preventiva de todos los videos al cambiar de target
    Object.values(videoRotationState).forEach(s => {
        s.htmlVideos.forEach(v => {
            if (v !== currentVidAsset) {
                v.pause();
                v.currentTime = 0;
            }
        });
    });

    showVideo(targetIndex, state.currentVideoIndex);

    // Evita la recarga constante del SRC
    if (currentVidAsset.dataset.loadedSrc !== currentUrl) {
        currentVidAsset.src = currentUrl;
        currentVidAsset.load(); 
        currentVidAsset.dataset.loadedSrc = currentUrl; 
    }
    
    // Lógica de bucle de video
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

// LÓGICA DE BOTÓN SIGUIENTE (ROTACIÓN UNIFICADA)
function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    
    // Contar todas las entidades (Videos y 3D) en el bloque
    const totalEntities = state.arEntities.length; 
    
    // Si hay 1 o menos elementos, salir.
    if (activeTargetIndex === null || totalEntities <= 1) return;
    
    // 1. Pausar el elemento actual SI era un video
    const currentIndex = state.currentVideoIndex;

    // Verificar si el índice actual está dentro del rango de videos cargados
    if (state.hasVideoContent && currentIndex < state.htmlVideos.length) { 
        const currentVidAsset = state.htmlVideos[currentIndex];
        // Pausa y resetea SOLO si el elemento actual era un video
        if (currentVidAsset) {
            currentVidAsset.pause();
            currentVidAsset.currentTime = 0;
            currentVidAsset.onended = null; 
        }
    }
    
    // 2. Determinar el siguiente índice
    const nextIndex = (currentIndex + 1) % totalEntities;
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    // 4. Si el siguiente elemento es un video, comenzar la reproducción
    if (state.hasVideoContent && nextIndex < state.htmlVideos.length) {
        playCurrentVideo(activeTargetIndex);
    } 
}

// === LÓGICA DE TRACKING Y EVENTOS ===

function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        // Pausar todos los otros targets
        Object.keys(videoRotationState).forEach(idx => {
            if (parseInt(idx) !== targetIndex) {
                videoRotationState[idx].htmlVideos.forEach(v => { v.pause(); v.currentTime = 0; });
                
                // Detener audio de otros modelos 3D
                const otherAudioEntity = videoRotationState[idx].audioEntity;
                if (otherAudioEntity && otherAudioEntity.components.sound) {
                    otherAudioEntity.components.sound.stopSound();
                }
            }
        });
        
        activeTargetIndex = targetIndex; 
        const state = videoRotationState[targetIndex];

        // Mostrar botón SIGUIENTE si hay MÁS de UN elemento en total (Videos y 3D)
        const totalEntities = state.arEntities.length;
        if (totalEntities > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        // Iniciar reproducción o visibilidad del primer elemento
        if (state.hasVideoContent) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); // Mostrar el primer elemento (modelo 3D)
        }
        
        // 🚨 Iniciar audio si es un modelo 3D con audio
        if (state.audioEntity && state.audioEntity.components.sound) {
             // Aseguramos que solo suene si el volumen no fue seteado a 0.0 por el usuario
             if (state.audioEntity.components.sound.data.volume > 0.0) { 
                 state.audioEntity.components.sound.playSound();
             }
        }
    });

    targetEntity.addEventListener("targetLost", () => {
        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';
        }
        
        const state = videoRotationState[targetIndex];
        
        // Pausar y resetear videos
        state.htmlVideos.forEach(vid => {
            vid.pause();
            vid.currentTime = 0;
            vid.onended = null; 
        });
        
        // 🚨 Detener audio del modelo 3D
        if (state.audioEntity && state.audioEntity.components.sound) {
             state.audioEntity.components.sound.stopSound();
        }
        
        // Ocultar todas las entidades (videos o 3D)
        state.arEntities.forEach(el => el.setAttribute('visible', false));
        showVideo(targetIndex, 0); 
    });
}

// === INICIALIZACIÓN DE LA INTERFAZ DE USUARIO (UI) ===
function initializeUI() {
    
    // Detección de Flash y lógica de UI
    sceneEl.addEventListener("arReady", () => {
        
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;
        let flashAvailable = false;

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
                flashAvailable = track.getCapabilities().torch || false;
            } catch (e) {
                console.warn("El dispositivo no soporta la capacidad 'torch' (flash).", e);
            }

            if (flashAvailable) {
                btnFlash.style.display = "flex"; 
                btnFlash.innerHTML = "⚡ FLASH OFF"; 
                btnFlash.disabled = false;
            } else {
                btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
                btnFlash.disabled = true;
            }
        } else {
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

    // LÓGICA DE AUDIO GLOBAL (Mejorada para control unificado y desbloqueo inicial)
    safeQuerySelector("#btn-audio", 'Audio Button').addEventListener("click", function() {
        
        // Basamos el estado en el texto del botón
        const isCurrentlyMuted = this.innerHTML.includes("🔇"); 

        // 1. Alternar Mute/Unmute para todos los VIDEOS
        Object.values(videoRotationState).forEach(state => {
            state.htmlVideos.forEach(v => {
                v.muted = isCurrentlyMuted; 
                if (!v.muted && v.paused) v.play().catch(e => {}); 
            });
            
            // 2. Alternar Volumen para todos los MODELOS 3D con audio
            if (state.audioEntity && state.audioEntity.components.sound) {
                const soundComp = state.audioEntity.components.sound;
                
                if (isCurrentlyMuted) { // Objetivo: SONIDO (Desmutear)
                    soundComp.setVolume(1.0); 
                    if (activeTargetIndex === state.targetIndex) {
                        soundComp.playSound(); // Reproducir si el target está activo
                    }
                } else { // Objetivo: MUTE (Mutear)
                    soundComp.setVolume(0.0); 
                }
            }
        });

        // 3. Actualizar la UI del botón
        this.style.background = isCurrentlyMuted ? "var(--accent)" : "var(--danger)";
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
