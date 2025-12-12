// main.js (CÓDIGO FINAL: Carga Asíncrona y Control 3D)

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
let isGlobalAudioMuted = true; 

// Función de utilidad para seleccionar elementos de forma segura
function safeQuerySelector(selector, name) {
    const el = document.querySelector(selector);
    if (!el) {
        console.error(`ERROR FATAL: El elemento UI '${name}' con selector '${selector}' no se encontró.`);
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
        
        if (config && Array.isArray(config.Targets)) {
             initializeScene();
        } else {
             throw new Error("La estructura JSON es inválida: falta el array 'Targets'.");
        }
        
    } catch (error) {
        console.error("Error al cargar la configuración JSON. Revisada la ruta y sintaxis.", error);
        alert("No se pudo cargar la configuración de videos. Revisa la ruta JSON y su contenido.");
    }
}

// LÓGICA DE CREACIÓN DE ENTIDADES (SOPORTE 3D, CHROMA Y VIDEO)
function initializeScene() {
    
    const Targets = config.Targets;
    
    if (!assetsContainer.appendChild) return; 

    Targets.forEach(target => {
        
        const { targetIndex, elementos } = target;
        
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: [],
            arEntities: [], 
            videoURLs: [], 
            numVideos: 0, 
            hasVideoContent: false,
            audioEntity: null,
            targetIndex: targetIndex 
        };

        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        let videoCount = 0;
        
        elementos.forEach((contentData, index) => {
            
            if (contentData.type === "3d") {
                
                // === LÓGICA DE MODELOS 3D (GLTF/GLB) ===
                
                const modelAsset = document.createElement('a-asset-item');
                modelAsset.setAttribute('id', contentData.id);
                modelAsset.setAttribute('src', contentData.src);
                assetsContainer.appendChild(modelAsset);
                
                const modelEntity = document.createElement('a-entity');
                modelEntity.setAttribute('id', `ar-model-${targetIndex}-${index}`);
                modelEntity.setAttribute('gltf-model', `#${contentData.id}`);
                
                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 
                
                // 🚨 CRUCIAL: Si es animado, agregar el componente, incluso si es estático (para consistencia)
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }

                if (contentData.audioSrc) {
                    const audioId = `${contentData.id}_audio`;
                    
                    const audioAsset = document.createElement('a-asset-item');
                    audioAsset.setAttribute('id', audioId);
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    assetsContainer.appendChild(audioAsset);
                    
                    // Volumen inicial 0.0 (muteado por defecto)
                    modelEntity.setAttribute('sound', `src: #${audioId}; autoplay: false; loop: true; volume: 0.0; positional: true;`); 
                    
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
                
                if (contentData.chromakey) {
                    videoEntity.setAttribute('material', 'shader: chromakey');
                    videoEntity.setAttribute('chromakey', 'color: #00ff00');
                    // Para Chroma Key, el SRC de A-Frame es necesario para que el shader acceda al video asset
                    videoEntity.setAttribute('src', `#${contentData.id}`); 
                } 
                // 🚨 MODIFICACIÓN CLAVE: No establecer el SRC de A-Frame aquí para videos estándar.
                // Esto previene errores de inicialización (cuadro negro/requestVideoFrameCallback).
                
                videoEntity.setAttribute('width', contentData.width);
                videoEntity.setAttribute('height', contentData.height);
                videoEntity.setAttribute('visible', index === 0); 

                targetEntity.appendChild(videoEntity);
                
                videoRotationState[targetIndex].htmlVideos.push(videoAsset);
                videoRotationState[targetIndex].arEntities.push(videoEntity);
                videoRotationState[targetIndex].videoURLs.push(contentData.src); 
            }
        });
        
        videoRotationState[targetIndex].numVideos = videoCount;
        
        targetContainer.appendChild(targetEntity);
        
        setupTrackingEvents(targetIndex, targetEntity);
    });
}

// === LÓGICA DE ROTACIÓN Y VIDEO ===

function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    state.arEntities.forEach((entityEl, i) => {
        entityEl.setAttribute('visible', i === contentIndex);
    });
    state.currentVideoIndex = contentIndex;
}

function playCurrentVideo(targetIndex) {
    const state = videoRotationState[targetIndex];
    const currentVidAsset = state.htmlVideos[state.currentVideoIndex];
    const currentUrl = state.videoURLs[state.currentVideoIndex]; 
    const currentVidEntity = state.arEntities[state.currentVideoIndex]; 

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

    // 🚨 CORRECCIÓN: Si el video no es Chroma, asegurar que la entidad A-Frame tenga su SRC
    // (Esto es necesario si no se asignó en initializeScene)
    if (!currentVidEntity.components.material || currentVidEntity.components.material.shader.name !== 'chromakey') {
         currentVidEntity.setAttribute('src', `#${currentVidAsset.id}`);
    }

    // Evita la recarga constante del SRC: RECARGA el video si no tiene un src registrado O si cambió.
    if (!currentVidAsset.dataset.loadedSrc || currentVidAsset.dataset.loadedSrc !== currentUrl) {
        currentVidAsset.src = currentUrl;
        currentVidAsset.load(); 
        currentVidAsset.dataset.loadedSrc = currentUrl; 
    }
    
    currentVidAsset.muted = isGlobalAudioMuted; 
    
    currentVidAsset.onended = null; 
    
    currentVidAsset.play().catch(error => {
        console.warn("Fallo al intentar reproducir video. Causa común: Autoplay bloqueado.", error);
    }); 
}

// LÓGICA DE BOTÓN SIGUIENTE (ROTACIÓN UNIFICADA: Video y 3D)
function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    
    const totalEntities = state.arEntities.length; 
    
    if (activeTargetIndex === null || totalEntities <= 1) return;
    
    // 1. Pausar el elemento actual SI era un video o detener audio 3D
    const currentIndex = state.currentVideoIndex;

    if (state.hasVideoContent && currentIndex < state.htmlVideos.length) { 
        const currentVidAsset = state.htmlVideos[currentIndex];
        if (currentVidAsset) {
            currentVidAsset.pause();
            currentVidAsset.currentTime = 0;
            currentVidAsset.onended = null; 
        }
    }
    
    // Detener audio 3D si estaba activo
    if (state.audioEntity && state.audioEntity.components.sound && currentIndex === 0) {
        state.audioEntity.components.sound.stopSound();
    }
    
    // 2. Determinar el siguiente índice
    const nextIndex = (currentIndex + 1) % totalEntities;
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    // 4. Si el siguiente elemento es un video, comenzar la reproducción
    const nextContentIsVideo = state.arEntities[nextIndex] && state.arEntities[nextIndex].tagName === 'A-VIDEO';

    if (nextContentIsVideo) {
        playCurrentVideo(activeTargetIndex);
    } else if (state.audioEntity && nextIndex === 0) { 
        // 5. Si el siguiente elemento es el 3D con audio (siempre en índice 0 en este JSON)
        // Intentar reproducir audio 3D
        const soundComp = state.audioEntity.components.sound;
        if (soundComp && !isGlobalAudioMuted) {
             soundComp.setVolume(1.0);
             soundComp.playSound();
        }
    }
}

// === LÓGICA DE TRACKING Y EVENTOS ===

function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        
        // PAUSA EXHAUSTIVA AL ENCONTRAR UN MARCADOR
        Object.values(videoRotationState).forEach(s => {
            s.htmlVideos.forEach(v => {
                v.pause();
                v.currentTime = 0;
                if (s.targetIndex !== targetIndex) {
                    v.src = "";
                    v.load();
                }
            });
            const audioEntity = s.audioEntity;
            if (audioEntity && audioEntity.components.sound) {
                audioEntity.components.sound.stopSound();
            }
        });
        
        activeTargetIndex = targetIndex; 
        const state = videoRotationState[targetIndex];

        // Mostrar botón SIGUIENTE
        const totalEntities = state.arEntities.length;
        if (totalEntities > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        // Si el elemento actual (índice 0, ya que se reseteó) es un video, reproducir.
        const initialContentIsVideo = state.arEntities[0] && state.arEntities[0].tagName === 'A-VIDEO';
        
        if (initialContentIsVideo) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); 
        }
        
        // 🚨 MODIFICACIÓN CLAVE: Manejo del Audio 3D Asíncrono
        if (state.audioEntity && state.currentVideoIndex === 0) {
            
             // 1. Añadir listener para el caso de que el componente 'sound' aún no esté cargado (la primera vez)
            state.audioEntity.addEventListener('componentinitialized', (evt) => {
                if (evt.detail.name === 'sound') {
                    const soundComp = state.audioEntity.components.sound;
                    if (soundComp && !isGlobalAudioMuted) {
                        soundComp.setVolume(1.0);
                        soundComp.playSound();
                    }
                }
            });

            // 2. Ejecutar inmediatamente si el componente 'sound' ya existe (veces subsiguientes)
            const soundComp = state.audioEntity.components.sound;
            if (soundComp && !isGlobalAudioMuted) { 
                soundComp.setVolume(1.0);
                soundComp.playSound();
            }
        }
    });

    targetEntity.addEventListener("targetLost", () => {
        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';
        }
        
        const state = videoRotationState[targetIndex];
        
        // PAUSA RIGUROSA: Detener y desligar videos
        state.htmlVideos.forEach(vid => {
            vid.pause();
            vid.currentTime = 0;
            vid.onended = null; 
            
            // Borrar el registro de la URL para forzar la recarga
            vid.dataset.loadedSrc = ""; 

            // Cargar un SRC vacío para liberar el recurso de WebGL/Audio
            vid.src = "";
            vid.load();
        });
        
        // Detener audio del modelo 3D
        if (state.audioEntity && state.audioEntity.components.sound) {
             state.audioEntity.components.sound.stopSound();
        }
        
        // Ocultar todas las entidades y resetear a índice 0
        state.arEntities.forEach(el => el.setAttribute('visible', false));
        showVideo(targetIndex, 0); 
    });
}

// === LÓGICA DE LA INTERFAZ DE USUARIO (UI) ===
function initializeUIListeners() {
    
    // Detección de Flash
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
        
        // Inicializar el botón de audio al estado global Muteado por defecto
        const btnAudio = safeQuerySelector("#btn-audio", 'Audio Button');
        if (isGlobalAudioMuted) {
             btnAudio.style.background = "var(--danger)";
             btnAudio.innerHTML = "🔇 SILENCIO";
        } else {
             btnAudio.style.background = "var(--accent)";
             btnAudio.innerHTML = "🔊 SONIDO";
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

    // LÓGICA DE AUDIO GLOBAL (Guarda el estado global y lo aplica)
    safeQuerySelector("#btn-audio", 'Audio Button').addEventListener("click", function() {
        
        isGlobalAudioMuted = !isGlobalAudioMuted; 
        const targetMutedState = isGlobalAudioMuted; 

        Object.values(videoRotationState).forEach(state => {
            
            // Aplicar a videos HTML
            state.htmlVideos.forEach(v => {
                v.muted = targetMutedState; 
                if (!targetMutedState && v.paused) v.play().catch(e => {}); 
            });
            
            // Aplicar a Modelos 3D con audio
            if (state.audioEntity) { 
                const soundComp = state.audioEntity.components.sound;
                
                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    if (!targetMutedState) { // Objetivo: SONIDO (Desmutear)
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex && state.currentVideoIndex === 0) {
                            soundComp.playSound(); 
                        }
                    } else { // Objetivo: MUTE (Mutear)
                        soundComp.setVolume(0.0); 
                        soundComp.stopSound(); 
                    }
                } else {
                     console.warn(`[Audio 3D] Componente 'sound' no inicializado completamente en Target ${state.targetIndex}.`);
                }
            }
        });

        // 3. Actualizar la UI del botón
        this.style.background = targetMutedState ? "var(--danger)" : "var(--accent)";
        this.innerHTML = targetMutedState ? "🔇 SILENCIO" : "🔊 SONIDO";
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

// 1. Inicializa los selectores inmediatamente
initializeSelectors();

// 2. Ejecutar la carga del JSON y la inicialización de la UI después de que el DOM esté cargado.
document.addEventListener('DOMContentLoaded', () => {
    initializeUIListeners();
    loadConfig(); 
});
