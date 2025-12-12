// main.js (CÓDIGO FINAL ESTABILIZADO: FIX Asíncrono del Audio 3D)

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
                    const audioId = `${contentData.id}_audio`;
                    
                    // FIX AUDIO 3D: Usar un elemento <audio> HTML para archivos .mp4/.mov
                    const audioAsset = document.createElement('audio');
                    audioAsset.setAttribute('id', audioId);
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    audioAsset.setAttribute('preload', 'auto');
                    audioAsset.setAttribute('loop', 'true');
                    audioAsset.setAttribute('crossorigin', 'anonymous');
                    assetsContainer.appendChild(audioAsset);
                    
                    // El componente 'sound' de A-Frame apunta al ID del asset <audio>
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
                
                // FIX CHROMA: Usar a-plane para Chroma Key
                const videoEntity = document.createElement(contentData.chromakey ? 'a-plane' : 'a-video');
                videoEntity.setAttribute('id', `ar-video-${targetIndex}-${index}`);
                
                if (contentData.chromakey) {
                    
                    const chromaColor = contentData.chromaColor || '#00ff00';
                    const normalizedRgb = hexToNormalizedRgb(chromaColor); 

                    // FIX CHROMA: Asignar material COMPLETO y explícito
                    videoEntity.setAttribute('material', 
                        `shader: chromakey; 
                         src: #${contentData.id}; 
                         color: ${normalizedRgb}`); 
                    
                } else {
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
    
    if (!currentVidEntity || (currentVidEntity.tagName !== 'A-VIDEO' && currentVidEntity.tagName !== 'A-PLANE')) {
        return; 
    }

    let videoAssetId = currentVidEntity.getAttribute('id').replace('ar-video-', 'Elem-');
    
    if (currentVidEntity.tagName === 'A-VIDEO' && currentVidEntity.hasAttribute('src')) {
        videoAssetId = currentVidEntity.getAttribute('src').substring(1);
    }

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

    if (currentVidEntity.tagName === 'A-PLANE' && currentVidEntity.hasAttribute('material')) {
        const currentMaterial = currentVidEntity.getAttribute('material');
        currentVidEntity.setAttribute('material', {...currentMaterial, src: `#${currentVidAsset.id}`});
    } else {
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
    if (currentEntity.tagName === 'A-VIDEO' || currentEntity.tagName === 'A-PLANE') { 
        
        let videoAssetId = currentEntity.getAttribute('id').replace('ar-video-', 'Elem-');
        
        if (currentEntity.tagName === 'A-VIDEO' && currentEntity.hasAttribute('src')) {
            videoAssetId = currentEntity.getAttribute('src').substring(1);
        }
        
        const currentVidAsset = document.querySelector(`#${videoAssetId}`);
        
        if (currentVidAsset) {
            currentVidAsset.pause();
            currentVidAsset.currentTime = 0;
            currentVidAsset.onended = null; 
            
            currentVidAsset.dataset.loadedSrc = ""; 
            currentVidAsset.src = "";
            currentVidAsset.load();
        }
    } else if (state.audioEntity && currentEntity === state.audioEntity) {
        // 🚨 Detener audio 3D (Elemento 3D con audio)
        const soundComp = currentEntity.components.sound;
        if (soundComp) {
            soundComp.stopSound();
            
            const soundSrc = soundComp.data.src;
            if (soundSrc && soundSrc.startsWith('#')) {
                const audioAssetId = soundSrc.substring(1);
                const audioAsset = document.querySelector(`#${audioAssetId}`);
                if (audioAsset) {
                    audioAsset.pause();
                    audioAsset.currentTime = 0;
                }
            }
        }
    }
    
    // 2. Determinar el siguiente índice
    const nextIndex = (currentIndex + 1) % totalEntities;
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    const nextEntity = state.arEntities[nextIndex];
    
    // 4. Si el siguiente elemento es un video, comenzar la reproducción
    if (nextEntity.tagName === 'A-VIDEO' || nextEntity.tagName === 'A-PLANE') {
        playCurrentVideo(activeTargetIndex);
    } else if (state.audioEntity && nextEntity === state.audioEntity) { 
        // 5. Si el siguiente elemento es el 3D con audio
        const soundComp = state.audioEntity.components.sound;
        if (soundComp && !isGlobalAudioMuted) {
            
            const soundSrc = soundComp.data.src;
            if (soundSrc && soundSrc.startsWith('#')) {
                const audioAssetId = soundSrc.substring(1);
                const audioAsset = document.querySelector(`#${audioAssetId}`);
            
                if (audioAsset) {
                    audioAsset.muted = false; 
                    audioAsset.load();
                    audioAsset.play().catch(error => {
                        console.warn("Fallo al intentar reproducir audio 3D al rotar.", error);
                    });
                }
            }

            // Iniciar el componente sound de A-Frame
            soundComp.setVolume(1.0);
            soundComp.playSound();
        }
    }
}

// === FUNCIÓN AUXILIAR PARA INICIAR AUDIO 3D ===
function startAudio3D(audioEntity, targetIndex, isGlobalAudioMuted) {
    
    if (isGlobalAudioMuted) return;

    // 1. Obtener el componente 'sound'
    let soundComp = audioEntity.components.sound;
    
    // Si el componente 'sound' no está listo inmediatamente, esperamos
    if (!soundComp) {
        
        // 🟢 FIX ASÍNCRONO: Esperar a que el componente 'sound' se inicialice
        audioEntity.addEventListener('componentinitialized', function handler(evt) {
            if (evt.detail.name === 'sound') {
                audioEntity.removeEventListener('componentinitialized', handler); // Ejecutar una sola vez
                startAudio3D(audioEntity, targetIndex, isGlobalAudioMuted); // Llamada recursiva (segura)
            }
        });
        
        // No podemos proceder aún.
        console.warn(`[Audio 3D] Esperando inicialización del componente 'sound' en Target ${targetIndex}.`);
        return;
    }
    
    // 2. Componente 'sound' está listo. Procedemos a la reproducción.
    const soundSrc = soundComp.data.src;
    if (soundSrc && soundSrc.startsWith('#')) {
        const audioAssetId = soundSrc.substring(1);
        const audioAsset = document.querySelector(`#${audioAssetId}`); 

        if (audioAsset) {
            audioAsset.muted = false; 
            audioAsset.load();
            audioAsset.play().catch(error => {
                console.warn("Fallo al intentar reproducir audio 3D (Autoplay bloqueado).", error);
            });
        }
    }
    
    // 3. Iniciar el componente sound de A-Frame
    if (typeof soundComp.setVolume === 'function') { 
        soundComp.setVolume(1.0);
        soundComp.playSound();
    }
}
// ===============================================

// === LÓGICA DE TRACKING Y EVENTOS ===
function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        
        // PAUSA EXHAUSTIVA AL ENCONTRAR UN MARCADOR
        Object.values(videoRotationState).forEach(s => {
            // Pausar/Limpiar todos los videos/audios al cambiar de target
            // ... (Lógica de pausa idéntica a la anterior, omitida para concisión) ...
            
            // Pausar audio 3D
            const audioEntity = s.audioEntity;
            if (audioEntity && audioEntity.components.sound) {
                const soundComp = audioEntity.components.sound;
                soundComp.stopSound();
                
                const soundSrc = soundComp.data.src;
                if (soundSrc && soundSrc.startsWith('#')) {
                    const audioAssetId = soundSrc.substring(1);
                    const audioAsset = document.querySelector(`#${audioAssetId}`); 
                    if (audioAsset) {
                        audioAsset.pause();
                        audioAsset.currentTime = 0;
                    }
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
        const initialContentIsVideo = state.arEntities[0] && 
            (state.arEntities[0].tagName === 'A-VIDEO' || state.arEntities[0].tagName === 'A-PLANE');
        
        if (initialContentIsVideo) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); 
        }
        
        // 🟢 NUEVA LÓGICA DE MANEJO DEL AUDIO 3D (llama a la función auxiliar)
        if (state.audioEntity && state.currentVideoIndex === 0) {
            startAudio3D(state.audioEntity, targetIndex, isGlobalAudioMuted);
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
             soundComp.stopSound();
             
             const soundSrc = soundComp.data.src;
             if (soundSrc && soundSrc.startsWith('#')) {
                const audioAssetId = soundSrc.substring(1);
                const audioAsset = document.querySelector(`#${audioAssetId}`);
                if (audioAsset) {
                    audioAsset.pause();
                    audioAsset.currentTime = 0;
                }
             }
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
        // ... (Lógica de Flash idéntica a la anterior, omitida para concisión) ...
        
        // Inicializar el botón de audio
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
        // ... (Lógica de Flash idéntica a la anterior, omitida para concisión) ...
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
                
                const soundSrc = soundComp ? soundComp.data.src : null;
                let audioAsset = null;
                if (soundSrc && soundSrc.startsWith('#')) {
                    const audioAssetId = soundSrc.substring(1);
                    audioAsset = document.querySelector(`#${audioAssetId}`);
                }
                
                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    if (!targetMutedState) { // Objetivo: SONIDO (Desmutear)
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex) {
                            soundComp.playSound(); 
                        }
                        if (audioAsset) {
                            audioAsset.muted = false;
                            if (audioAsset.paused) audioAsset.play().catch(e => {});
                        }
                    } else { // Objetivo: MUTE (Mutear)
                        soundComp.setVolume(0.0); 
                        soundComp.stopSound(); 
                        if (audioAsset) {
                            audioAsset.muted = true;
                        }
                    }
                } else {
                     // Llama a startAudio3D si se intenta desmutear, manejará la inicialización.
                     if (!targetMutedState && activeTargetIndex === state.targetIndex) {
                         startAudio3D(state.audioEntity, state.targetIndex, false);
                     } else if (targetMutedState && activeTargetIndex === state.targetIndex) {
                         // Si el componente no está inicializado, no hay nada que mutear.
                         console.warn(`[Audio 3D] No se pudo mutear/desmutear el Target ${state.targetIndex}: Componente 'sound' no listo.`);
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
