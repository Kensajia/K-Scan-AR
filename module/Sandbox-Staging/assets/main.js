// main.js (CÓDIGO FINAL: Fix de Selectores y Audio Autoplay)

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
            // 🚨 CAMBIO: Almacenaremos el ID del video HTML, NO el objeto directo.
            htmlVideoIds: {}, 
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
                    // 🚨 CAMBIO: Video Oculto para Audio 3D
                    
                    const audioVideoId = `${contentData.id}_audio_vid`;
                    
                    const audioAsset = document.createElement('video');
                    audioAsset.setAttribute('id', audioVideoId);
                    audioAsset.setAttribute('preload', 'auto'); // Usar 'auto' para carga inicial
                    audioAsset.setAttribute('loop', 'true');
                    audioAsset.setAttribute('playsinline', 'true');
                    audioAsset.setAttribute('webkit-playsinline', 'true');
                    audioAsset.setAttribute('muted', 'muted'); 
                    audioAsset.setAttribute('crossorigin', 'anonymous');
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    audioAsset.style.display = 'none'; 
                    
                    // 🚨 FIX AUTOPLAY: Pausar inmediatamente después de configurar el SRC
                    audioAsset.pause(); 
                    audioAsset.currentTime = 0;
                    
                    assetsContainer.appendChild(audioAsset);
                    
                    // Apuntamos el componente 'sound' al ID del video HTML (el selector)
                    modelEntity.setAttribute('sound', `src: #${audioVideoId}; autoplay: false; loop: true; volume: 0.0; positional: true;`); 
                    
                    videoRotationState[targetIndex].audioEntity = modelEntity;
                    
                    // Almacenamos el ID del asset, no el objeto.
                    videoRotationState[targetIndex].htmlVideoIds[audioVideoId] = audioVideoId; 
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
                    videoEntity.setAttribute('material', 'shader: chromakey');
                    videoEntity.setAttribute('chromakey', `color: ${chromaColor}`);
                } 
                
                videoEntity.dataset.videoSrc = contentData.src; 
                
                videoEntity.setAttribute('width', contentData.width);
                videoEntity.setAttribute('height', contentData.height);
                videoEntity.setAttribute('visible', index === 0); 

                targetEntity.appendChild(videoEntity);
                
                videoRotationState[targetIndex].arEntities.push(videoEntity);
                
                // Almacenamos el ID del asset
                videoRotationState[targetIndex].htmlVideoIds[contentData.id] = contentData.id;
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
    const currentVideoIndex = state.currentVideoIndex; 
    
    const currentVidEntity = state.arEntities[currentVideoIndex];
    
    if (!currentVidEntity || currentVidEntity.tagName !== 'A-VIDEO') {
        return; 
    }

    const videoAssetId = currentVidEntity.hasAttribute('src') 
        ? currentVidEntity.getAttribute('src').substring(1) 
        : currentVidEntity.getAttribute('id').replace('ar-video-', 'Elem-'); 
        
    // 🚨 FIX SELECTOR: Siempre usamos querySelector con el ID
    const currentVidAsset = document.querySelector(`#${videoAssetId}`); 
    const currentUrl = currentVidEntity.dataset.videoSrc; 
    
    if (!currentVidAsset) return; 

    // Pausa preventiva de todos los videos (Usando IDs)
    Object.values(videoRotationState).forEach(s => {
        // 🚨 FIX SELECTOR: Iteramos sobre los IDs
        Object.values(s.htmlVideoIds).forEach(id => {
            const v = document.querySelector(`#${id}`);
            if (v && v !== currentVidAsset) {
                v.pause();
                v.currentTime = 0;
            }
        });
    });

    showVideo(targetIndex, currentVideoIndex);

    // 🚨 FIX CHROMA: Forzar la asignación del SRC
    currentVidEntity.setAttribute('src', `#${currentVidAsset.id}`);

    // Recarga y reproducción del video
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
        // 🚨 FIX SELECTOR: Siempre usamos querySelector con el ID
        const currentVidAsset = document.querySelector(`#${videoAssetId}`);
        
        if (currentVidAsset) {
            currentVidAsset.pause();
            currentVidAsset.currentTime = 0;
            currentVidAsset.onended = null; 
        }
    } else if (state.audioEntity && currentEntity === state.audioEntity) {
        // Detener audio 3D si estaba activo (Y su video subyacente)
        const soundComp = state.audioEntity.components.sound;
        if (soundComp) {
            soundComp.stopSound();
            const audioVidAsset = document.querySelector(soundComp.attrValue.src);
            if(audioVidAsset) {
                audioVidAsset.pause();
                audioVidAsset.currentTime = 0;
            }
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
        
        const soundComp = state.audioEntity.components.sound;
        if (soundComp && !isGlobalAudioMuted) {
             
             // 🚨 CRÍTICO: Tocar el video HTML subyacente primero
             const audioVidAsset = document.querySelector(soundComp.attrValue.src);
             if (audioVidAsset) {
                 audioVidAsset.muted = false; 
                 audioVidAsset.play().catch(e => console.error("Fallo al reproducir video de audio", e));
             }
            
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
            // 🚨 FIX SELECTOR: Iteramos sobre los IDs
            Object.values(s.htmlVideoIds).forEach(id => {
                const v = document.querySelector(`#${id}`);
                if (v) {
                    v.pause();
                    v.currentTime = 0;
                    if (s.targetIndex !== targetIndex) {
                        v.src = "";
                        v.load();
                    }
                }
            });
            
            const audioEntity = s.audioEntity;
            if (audioEntity && audioEntity.components.sound) {
                audioEntity.components.sound.stopSound();
                // Pausar el video de audio 3D
                const audioVidAsset = document.querySelector(audioEntity.components.sound.attrValue.src);
                if(audioVidAsset) {
                    audioVidAsset.pause();
                    audioVidAsset.currentTime = 0;
                }
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
            
            // 1. Ejecutar inmediatamente si el componente 'sound' ya existe 
            if (soundComp && typeof soundComp.setVolume === 'function' && !isGlobalAudioMuted) { 
                
                // 🚨 Tocar el video HTML subyacente
                const audioVidAsset = document.querySelector(soundComp.attrValue.src);
                if (audioVidAsset) {
                    audioVidAsset.muted = false; 
                    audioVidAsset.play().catch(e => console.error("Fallo al reproducir video de audio", e));
                }
                
                soundComp.setVolume(1.0);
                soundComp.playSound();
            }
            
             // 2. Añadir listener para el caso de que el componente 'sound' aún no esté cargado
            state.audioEntity.addEventListener('componentinitialized', (evt) => {
                if (evt.detail.name === 'sound') {
                    const comp = state.audioEntity.components.sound;
                    if (comp && !isGlobalAudioMuted) {
                         // 🚨 Tocar el video HTML subyacente
                        const audioVidAsset = document.querySelector(comp.attrValue.src);
                        if (audioVidAsset) {
                            audioVidAsset.muted = false; 
                            audioVidAsset.play().catch(e => console.error("Fallo al reproducir video de audio", e));
                        }
                        comp.setVolume(1.0);
                        comp.playSound();
                    }
                }
            });
        }
    });

    targetEntity.addEventListener("targetLost", () => {
        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';
        }
        
        const state = videoRotationState[targetIndex];
        
        // PAUSA RIGUROSA: Detener y desligar videos (incluidos los de audio)
        // 🚨 FIX SELECTOR: Iteramos sobre los IDs
        Object.values(state.htmlVideoIds).forEach(id => {
            const v = document.querySelector(`#${id}`);
            if (v) {
                v.pause();
                v.currentTime = 0;
                v.onended = null; 
                v.dataset.loadedSrc = ""; 
                v.src = "";
                v.load();
            }
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
        
        // ... (El resto de initializeUIListeners es el mismo)
        
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
            
            // Aplicar a videos HTML (Incluye los videos ocultos usados para audio 3D)
            Object.values(state.htmlVideoIds).forEach(id => {
                const v = document.querySelector(`#${id}`);
                if (v) {
                    v.muted = targetMutedState; 
                    // Intentar reproducir si se desmutea
                    if (!targetMutedState && v.paused) v.play().catch(e => {}); 
                }
            });
            
            // Aplicar a Modelos 3D con audio
            if (state.audioEntity) { 
                const soundComp = state.audioEntity.components.sound;
                
                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    if (!targetMutedState) { // Objetivo: SONIDO (Desmutear)
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex) {
                            soundComp.playSound(); 
                        }
                    } else { // Objetivo: MUTE (Mutear)
                        soundComp.setVolume(0.0); 
                        soundComp.stopSound(); 
                    }
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
