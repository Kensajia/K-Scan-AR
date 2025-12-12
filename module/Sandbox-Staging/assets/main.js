// main.js (CÓDIGO FINAL: Fix Chroma Key RGB + Fix Audio 3D con Video Oculto)

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

// === FUNCIÓN DE CONVERSIÓN DE COLOR PARA CHROMA KEY ===
function hexToNormalizedRgb(hex) {
    if (!hex || hex.length !== 7 || hex[0] !== '#') return '0 1 0'; 
    
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);

    const r_norm = (r / 255).toFixed(3);
    const g_norm = (g / 255).toFixed(3);
    const b_norm = (b / 255).toFixed(3);

    return `${r_norm} ${g_norm} ${b_norm}`;
}
// =======================================================

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
            htmlVideos: {}, 
            arEntities: [], 
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
                
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }

                if (contentData.audioSrc) {
                    // 🟢 FIX AUDIO 3D: Usar Video Oculto como fuente de Audio Posicional
                    const audioId = `${contentData.id}_audio_video`; 
                    
                    // 1. Crear un asset <video> HTML para el audio 3D
                    const audioVideoAsset = document.createElement('video');
                    audioVideoAsset.setAttribute('id', audioId);
                    audioVideoAsset.setAttribute('preload', 'auto'); 
                    audioVideoAsset.setAttribute('loop', 'true');
                    audioVideoAsset.setAttribute('playsinline', 'true');
                    audioVideoAsset.setAttribute('webkit-playsinline', 'true');
                    audioVideoAsset.setAttribute('muted', 'muted'); // Empezar muteado
                    audioVideoAsset.setAttribute('crossorigin', 'anonymous');
                    audioVideoAsset.setAttribute('src', contentData.audioSrc); // El MP4 de audio/imagen
                    audioVideoAsset.style.display = 'none'; // CRÍTICO: Ocultar el elemento visual
                    assetsContainer.appendChild(audioVideoAsset);
                    
                    // 2. Asignar el componente sound usando el ID del <video> HTML
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
                    
                    const chromaColor = contentData.chromaColor || '#00ff00';
                    // 🚨 FIX CHROMA KEY: Convertir Hex a RGB normalizado
                    const normalizedRgb = hexToNormalizedRgb(chromaColor); 

                    // 🟢 FIX CHROMA KEY: Intentar asegurar que el shader y el color se apliquen correctamente
                    videoEntity.setAttribute('material', 'shader: chromakey');
                    videoEntity.setAttribute('chromakey', `color: ${normalizedRgb}`); // <--- FIX
                    videoEntity.setAttribute('src', `#${contentData.id}`); 
                } 
                
                videoEntity.dataset.videoSrc = contentData.src; 
                
                videoEntity.setAttribute('width', contentData.width);
                videoEntity.setAttribute('height', contentData.height);
                videoEntity.setAttribute('visible', index === 0); 

                targetEntity.appendChild(videoEntity);
                
                videoRotationState[targetIndex].arEntities.push(videoEntity);
                
                videoRotationState[targetIndex].htmlVideos[contentData.id] = videoAsset;
            }
        });
        
        videoRotationState[targetIndex].numVideos = videoCount;
        targetContainer.appendChild(targetEntity);
        setupTrackingEvents(targetIndex, targetEntity);
    });
}

// === LÓGICA DE ROTACIÓN Y VIDEO ===
// ... (Funciones showVideo y playCurrentVideo sin cambios sustanciales, ya que la lógica de carga es correcta)
function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    state.arEntities.forEach((entityEl, i) => {
        entityEl.setAttribute('visible', i === contentIndex);
    });
    state.currentVideoIndex = contentIndex;
}

function playCurrentVideo(targetIndex) {
    const state = videoRotationState[targetIndex];
    const currentVideoIndex = state.currentVideoIndex; 
    
    const currentVidEntity = state.arEntities[currentVideoIndex];
    
    if (!currentVidEntity || currentVidEntity.tagName !== 'A-VIDEO') {
        return; 
    }

    const videoAssetId = currentVidEntity.hasAttribute('src') 
        ? currentVidEntity.getAttribute('src').substring(1) 
        : currentVidEntity.getAttribute('id').replace('ar-video-', 'Elem-'); 
        
    const currentVidAsset = document.querySelector(`#${videoAssetId}`); 
    const currentUrl = currentVidEntity.dataset.videoSrc; 
    
    if (!currentVidAsset) return; 

    Object.values(videoRotationState).forEach(s => {
        Object.values(s.htmlVideos).forEach(v => {
            if (v !== currentVidAsset) {
                v.pause();
                v.currentTime = 0;
            }
        });
    });

    showVideo(targetIndex, currentVideoIndex);

    if (!currentVidEntity.hasAttribute('src') || 
        (currentVidEntity.components.material && currentVidEntity.components.material.shader.name !== 'chromakey')) {
         currentVidEntity.setAttribute('src', `#${currentVidAsset.id}`);
    }

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

// LÓGICA DE ROTACIÓN MANUAL
function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    
    const totalEntities = state.arEntities.length; 
    
    if (activeTargetIndex === null || totalEntities <= 1) return;
    
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // 1. Detener el elemento actual
    if (currentEntity.tagName === 'A-VIDEO') { 
        const videoAssetId = currentEntity.hasAttribute('src') 
            ? currentEntity.getAttribute('src').substring(1)
            : currentEntity.getAttribute('id').replace('ar-video-', 'Elem-'); 
        const currentVidAsset = document.querySelector(`#${videoAssetId}`);
        
        if (currentVidAsset) {
            currentVidAsset.pause();
            currentVidAsset.currentTime = 0;
            currentVidAsset.onended = null; 
        }
    } else if (state.audioEntity && currentEntity === state.audioEntity) {
        // 🟢 FIX AUDIO 3D: Detener video oculto
        const soundCompStop = state.audioEntity.components.sound;
        if (soundCompStop) {
            const audioVideoId = soundCompStop.attrValue.src.substring(1);
            const audioVideoAsset = document.querySelector(`#${audioVideoId}`);
            if (audioVideoAsset) {
                audioVideoAsset.pause();
                audioVideoAsset.currentTime = 0;
            }
            soundCompStop.stopSound();
        }
    }
    
    // 2. Determinar el siguiente índice
    const nextIndex = (currentIndex + 1) % totalEntities;
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    const nextEntity = state.arEntities[nextIndex];
    
    // 4. Si el siguiente elemento es un video, comenzar la reproducción
    if (nextEntity.tagName === 'A-VIDEO') {
        playCurrentVideo(activeTargetIndex);
    } else if (state.audioEntity && nextEntity === state.audioEntity) { 
        // 5. Si el siguiente elemento es el 3D con audio
        const soundCompPlay = state.audioEntity.components.sound;

        // 🟢 FIX AUDIO 3D: Iniciar video oculto
        const audioVideoId = soundCompPlay.attrValue.src.substring(1);
        const audioVideoAsset = document.querySelector(`#${audioVideoId}`);

        if (audioVideoAsset) {
             audioVideoAsset.muted = isGlobalAudioMuted;
             audioVideoAsset.play().catch(e => console.warn("Fallo al reproducir audio 3D asset video:", e));
        }

        if (soundCompPlay && !isGlobalAudioMuted) {
             soundCompPlay.setVolume(1.0);
             soundCompPlay.playSound();
        }
    }
}

// === LÓGICA DE TRACKING Y EVENTOS ===

function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        
        // PAUSA EXHAUSTIVA AL ENCONTRAR UN MARCADOR
        Object.values(videoRotationState).forEach(s => {
            Object.values(s.htmlVideos).forEach(v => {
                v.pause();
                v.currentTime = 0;
                if (s.targetIndex !== targetIndex) {
                    v.src = "";
                    v.load();
                }
            });
            const audioEntity = s.audioEntity;
            if (audioEntity && audioEntity.components.sound) {
                 // 🟢 FIX AUDIO 3D: Detener el video oculto de otros marcadores
                 const soundCompStop = audioEntity.components.sound;
                 const audioVideoId = soundCompStop.attrValue.src.substring(1);
                 const audioVideoAsset = document.querySelector(`#${audioVideoId}`);
                 if (audioVideoAsset) {
                     audioVideoAsset.pause();
                     audioVideoAsset.currentTime = 0;
                 }
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
        
        // Si el elemento inicial (índice 0) es un video, reproducir.
        const initialContentIsVideo = state.arEntities[0] && state.arEntities[0].tagName === 'A-VIDEO';
        
        if (initialContentIsVideo) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); 
        }
        
        // 🚨 CRÍTICO: Manejo del Audio 3D Asíncrono
        if (state.audioEntity && state.currentVideoIndex === 0) {
            
            const soundComp = state.audioEntity.components.sound;
            
            // 🟢 FIX AUDIO 3D: Iniciar el asset de video oculto
            if (soundComp) {
                const audioVideoId = soundComp.attrValue.src.substring(1);
                const audioVideoAsset = document.querySelector(`#${audioVideoId}`);
                
                if (audioVideoAsset) {
                     audioVideoAsset.muted = isGlobalAudioMuted;
                     audioVideoAsset.play().catch(e => console.warn("Fallo al reproducir audio 3D asset video:", e));
                }
            }
            
             // 1. Añadir listener para el caso de que el componente 'sound' aún no esté cargado (la primera vez)
            state.audioEntity.addEventListener('componentinitialized', (evt) => {
                if (evt.detail.name === 'sound') {
                    const soundCompInit = state.audioEntity.components.sound;
                    if (soundCompInit && !isGlobalAudioMuted) {
                        soundCompInit.setVolume(1.0);
                        soundCompInit.playSound();
                    }
                }
            });

            // 2. Ejecutar inmediatamente si el componente 'sound' ya existe (veces subsiguientes)
            if (soundComp && typeof soundComp.setVolume === 'function' && !isGlobalAudioMuted) { 
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
        Object.values(state.htmlVideos).forEach(vid => {
            vid.pause();
            vid.currentTime = 0;
            vid.onended = null; 
            
            vid.dataset.loadedSrc = ""; 
            vid.src = "";
            vid.load();
        });
        
        // Detener audio del modelo 3D
        if (state.audioEntity && state.audioEntity.components.sound) {
            const soundComp = state.audioEntity.components.sound;
            // 🟢 FIX AUDIO 3D: Detener el asset <video> oculto
            const audioVideoId = soundComp.attrValue.src.substring(1);
            const audioVideoAsset = document.querySelector(`#${audioVideoId}`);
            if (audioVideoAsset) {
                audioVideoAsset.pause();
                audioVideoAsset.currentTime = 0;
            }
             soundComp.stopSound();
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
        // ... (lógica de flash)
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
            Object.values(state.htmlVideos).forEach(v => {
                v.muted = targetMutedState; 
                if (!targetMutedState && v.paused) v.play().catch(e => {}); 
            });
            
            // Aplicar a Modelos 3D con audio
            if (state.audioEntity) { 
                const soundComp = state.audioEntity.components.sound;
                
                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    // 🟢 FIX AUDIO 3D: Asegurar que el asset de video oculto refleje el estado Mute
                    const audioVideoId = soundComp.attrValue.src.substring(1);
                    const audioVideoAsset = document.querySelector(`#${audioVideoId}`);
                    
                    if (audioVideoAsset) {
                        audioVideoAsset.muted = targetMutedState;
                        if (!targetMutedState && audioVideoAsset.paused) {
                            audioVideoAsset.play().catch(e => {});
                        }
                    }

                    if (!targetMutedState) { // Objetivo: SONIDO (Desmutear)
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex) {
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
