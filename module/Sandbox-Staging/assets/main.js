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


// === COMPONENTE: ROTACIÓN TÁCTIL SIMPLE (SOLO ROTACIÓN X/Y) ===
AFRAME.registerComponent('touch-rotation', {
    init: function () {
        this.touchStart = { x: 0, y: 0 };
        this.touchMove = { x: 0, y: 0 };
        this.isTouched = false;
        
        this.currentRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };

        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleStart);
            canvas.addEventListener('touchmove', this.handleMove);
            canvas.addEventListener('touchend', this.handleEnd);
        }
    },

    handleStart: function (evt) {
        if (evt.touches.length === 1) {
            this.isTouched = true;
            this.touchStart.x = evt.touches[0].pageX;
            this.touchStart.y = evt.touches[0].pageY;
            evt.stopPropagation(); 
        } else {
            this.isTouched = false;
        }
    },

    handleMove: function (evt) {
        if (!this.isTouched || evt.touches.length !== 1) return;

        this.touchMove.x = evt.touches[0].pageX;
        this.touchMove.y = evt.touches[0].pageY;

        const dx = this.touchMove.x - this.touchStart.x;
        const dy = this.touchMove.y - this.touchStart.y;
        
        const sensibility = 0.2; 

        const dTheta = dx * sensibility; 
        const dPhi = dy * sensibility; 
        
        this.currentRotation.y += dTheta;
        this.currentRotation.x += dPhi;
        
        this.el.setAttribute('rotation', this.currentRotation);

        this.touchStart.x = this.touchMove.x;
        this.touchStart.y = this.touchMove.y;

        evt.stopPropagation(); 
        evt.preventDefault();
    },

    handleEnd: function () {
        this.isTouched = false;
    },

    remove: function() {
        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.removeEventListener('touchstart', this.handleStart);
            canvas.removeEventListener('touchmove', this.handleMove);
            canvas.removeEventListener('touchend', this.handleEnd);
        }
    }
});

// === COMPONENTE CORREGIDO: DOBLE TAP PARA TOGGLE PANTALLA COMPLETA EN VIDEO ===
AFRAME.registerComponent('video-double-tap-toggle', {
    init: function () {
        this.lastTap = 0;
        this.isDetached = false;
        
        this.originalPosition = this.el.getAttribute('position') || { x: 0, y: 0, z: 0 };
        this.originalScale = this.el.getAttribute('scale') || { x: 1, y: 1, z: 1 };
        this.originalRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
        
        // Guardar referencia al video HTML para control de play/pause
        this.videoAsset = null;
        this.videoAssetId = this.el.getAttribute('id').replace('ar-video-', 'Elem-');

        // Determinar ID de video para obtener el asset
        if (this.el.tagName === 'A-VIDEO' && this.el.hasAttribute('src')) {
             this.videoAssetId = this.el.getAttribute('src').substring(1);
        }
        
        // Esperar a que el DOM esté listo para buscar el asset
        document.addEventListener('DOMContentLoaded', () => {
             this.videoAsset = document.querySelector(`#${this.videoAssetId}`);
        });

        this.el.addEventListener('click', this.handleTap.bind(this));
    },

    handleTap: function (evt) {
        if (!this.el.getAttribute('visible')) return;
        
        evt.stopPropagation(); 

        const now = Date.now();
        const DOUBLE_TAP_TIMEOUT = 300; 

        if (now - this.lastTap < DOUBLE_TAP_TIMEOUT) {
            this.toggleDetachedState();
            this.lastTap = 0; 
        } else {
            this.lastTap = now;
        }
    },

    toggleDetachedState: function () {
        const videoEl = this.el; 
        const targetParent = videoEl.parentNode;
        
        if (activeTargetIndex === null || !targetParent || !btnNextVideo) return; // Validación extra

        this.isDetached = !this.isDetached;

        if (this.isDetached) {
            // DESANCLAR

            // 1. Guardar estado actual antes de mover
            this.originalPosition = videoEl.getAttribute('position');
            this.originalScale = videoEl.getAttribute('scale');
            this.originalRotation = videoEl.getAttribute('rotation');
            
            // 2. Moverlo al frente de la cámara
            videoEl.setAttribute('position', '0 0 -1.5'); 
            videoEl.setAttribute('scale', '2 2 1'); 
            videoEl.setAttribute('rotation', '0 0 0'); 
            
            // 3. Pausar el seguimiento del marcador (lo mantiene fijo)
            if (targetParent.components['mindar-image-target']) {
                 targetParent.pause(); 
            }

            // 4. Ocultar botón de rotación
            btnNextVideo.style.display = 'none';

            // 5. Reproducir si está en silencio
            if (this.videoAsset && this.videoAsset.paused) {
                 this.videoAsset.play().catch(e => console.warn("Fallo al reanudar video en desanclaje:", e));
            }
            
            console.log("Video desanclado a pantalla completa.");

        } else {
            // REANCLAR
            
            // 1. Restablecer la posición y rotación originales
            videoEl.setAttribute('position', this.originalPosition);
            videoEl.setAttribute('scale', this.originalScale);
            videoEl.setAttribute('rotation', this.originalRotation);
            
            // 2. Reanudar el seguimiento del marcador
            if (targetParent.components['mindar-image-target']) {
                 targetParent.play(); 
            }
            
            // 3. Mostrar botón de rotación si aplica
             if (videoRotationState[activeTargetIndex].arEntities.length > 1) {
                btnNextVideo.style.display = 'flex';
             }

            // 4. Pausar el video si el audio global está en silencio, si no, lo deja reproduciéndose
            if (this.videoAsset && isGlobalAudioMuted) {
                this.videoAsset.pause();
            }

            console.log("Video re-anclado al marcador.");
        }
    },

    remove: function() {
        this.el.removeEventListener('click', this.handleTap);
    }
});
// ===============================================


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

// LÓGICA DE CREACIÓN DE ENTIDADES
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
            audioAsset: null, 
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
                modelEntity.setAttribute('touch-rotation', ''); 
                modelEntity.setAttribute('data-has-touch-rotation', true); 

                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 
                
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }

                if (contentData.audioSrc) {
                    const audioId = `${contentData.id}_audio`;
                    
                    const audioAsset = document.createElement('audio');
                    audioAsset.setAttribute('id', audioId);
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    audioAsset.setAttribute('preload', 'auto');
                    audioAsset.setAttribute('loop', 'true');
                    audioAsset.setAttribute('playsinline', 'true');
                    audioAsset.setAttribute('muted', 'muted'); 
                    audioAsset.setAttribute('crossorigin', 'anonymous');
                    assetsContainer.appendChild(audioAsset);
                    
                    // Componente 'sound' de A-Frame (volumen 0.0 inicialmente)
                    modelEntity.setAttribute('sound', `src: #${audioId}; autoplay: false; loop: true; volume: 0.0; positional: true;`); 
                    
                    videoRotationState[targetIndex].audioEntity = modelEntity;
                    videoRotationState[targetIndex].audioAsset = audioAsset;
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
                
                // APLICACIÓN DEL COMPONENTE DE DOBLE TOQUE
                videoEntity.setAttribute('video-double-tap-toggle', ''); 

                if (contentData.chromakey) {
                    
                    const chromaColor = contentData.chromaColor || '#00ff00';
                    const normalizedRgb = hexToNormalizedRgb(chromaColor); 

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
        // Asegurar que el desanclaje se resetea si cambiamos de video/modelo manualmente
        if (entityEl.components['video-double-tap-toggle'] && entityEl.components['video-double-tap-toggle'].isDetached) {
            entityEl.components['video-double-tap-toggle'].toggleDetachedState();
        }
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

    // Pausa otros videos en todos los targets
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
    
    // Desanclaje: Si el elemento actual está desanclado, reanclarlo antes de rotar
    if (currentEntity.components['video-double-tap-toggle'] && currentEntity.components['video-double-tap-toggle'].isDetached) {
        currentEntity.components['video-double-tap-toggle'].toggleDetachedState();
    }
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
        const audioAsset = state.audioAsset; 
        
        if (audioAsset) { 
            audioAsset.pause();
            audioAsset.currentTime = 0;
        }
        if (soundComp && typeof soundComp.setVolume === 'function') { 
            soundComp.setVolume(0.0);
            if (typeof soundComp.stopSound === 'function') { 
                soundComp.stopSound(); 
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
        startAudio3D(state.audioEntity, activeTargetIndex, isGlobalAudioMuted);
    }
}

// === FUNCIÓN AUXILIAR PARA INICIAR AUDIO 3D (VERSION FINAL ACTIVA) ===
function startAudio3D(audioEntity, targetIndex, isGlobalAudioMuted) {
    
    if (isGlobalAudioMuted) return;

    const state = videoRotationState[targetIndex];
    let soundComp = audioEntity.components.sound;
    const audioAsset = state.audioAsset; 

    if (!audioAsset) {
        console.error(`[Audio 3D] ERROR: Elemento <audio> HTML no encontrado para Target ${targetIndex}.`);
        return;
    }
    
    const soundSystem = sceneEl.components.sound;
    if (soundSystem && soundSystem.context && soundSystem.context.state !== 'running') {
        soundSystem.initContext(); 
        console.log(`[Audio 3D] Web Audio Context reanudado/iniciado.`);
    }

    audioAsset.muted = false;
    audioAsset.load();

    audioAsset.play().then(() => {
        console.log(`[Audio 3D] Asset HTML de audio #${audioAsset.id} reproduciéndose. Conectando 3D.`);
        
        if (soundComp && typeof soundComp.setVolume === 'function') {
             soundComp.setVolume(1.0);
             soundComp.playSound(); 
        } else {
             console.warn(`[Audio 3D] Componente 'sound' no listo, el audio HTML está reproduciéndose. El 3D se conectará cuando el componente se inicialice.`);
             
             audioEntity.addEventListener('componentinitialized', function handler(evt) {
                 if (evt.detail.name === 'sound') {
                     audioEntity.removeEventListener('componentinitialized', handler);
                     const newSoundComp = audioEntity.components.sound;
                     if (newSoundComp) {
                         newSoundComp.setVolume(1.0);
                         newSoundComp.playSound();
                         console.log(`[Audio 3D] Componente 'sound' conectado con éxito por evento.`);
                     }
                 }
             }, { once: true });
        }

    }).catch(error => {
        console.warn(`[Audio 3D] Fallo al iniciar reproducción del asset HTML #${audioAsset.id}. - `, error);
        
        if (soundComp && typeof soundComp.setVolume === 'function') { 
            soundComp.setVolume(1.0); 
        }
    });
    
    console.log(`[Audio 3D] Lógica de Audio 3D iniciada en Target ${targetIndex}.`); 
}
// ===============================================

// === LÓGICA DE TRACKING Y EVENTOS ===
function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        
        // PAUSA EXHAUSTIVA AL ENCONTRAR UN MARCADOR
        Object.values(videoRotationState).forEach(s => {
            // Pausar/Limpiar videos HTML
            Object.values(s.htmlVideos).forEach(v => {
                v.pause();
                v.currentTime = 0;
                if (s.targetIndex !== targetIndex) {
                    v.src = "";
                    v.load();
                }
            });
            
            // Pausar audio 3D
            const audioEntity = s.audioEntity;
            const audioAsset = s.audioAsset; 
            
            if (audioAsset) {
                audioAsset.pause();
                audioAsset.currentTime = 0;
            }
            if (audioEntity) { 
                const soundComp = audioEntity.components.sound;
                if (soundComp && typeof soundComp.setVolume === 'function') {
                    soundComp.setVolume(0.0);
                    if (typeof soundComp.stopSound === 'function') { 
                        soundComp.stopSound(); 
                    }
                }
            }
        });
        
        activeTargetIndex = targetIndex; 
        const state = videoRotationState[targetIndex];

        // Mostrar botón SIGUIENTE (Si hay más de 1 elemento en el array 'elementos')
        const totalEntities = state.arEntities.length;
        if (totalEntities > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        // === LÓGICA DE INICIO DEL CONTENIDO ACTUAL (Índice 0) ===
        const initialContentIsVideo = state.arEntities[0] && 
            (state.arEntities[0].tagName === 'A-VIDEO' || state.arEntities[0].tagName === 'A-PLANE');
        
        if (initialContentIsVideo) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); 
        }
        
        // Iniciar Audio 3D si el elemento actual es el modelo 3D
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
        
        // ANTES DE PAUSAR: asegurar que no haya videos desanclados
        state.arEntities.forEach(entityEl => {
             if (entityEl.components['video-double-tap-toggle'] && entityEl.components['video-double-tap-toggle'].isDetached) {
                 entityEl.components['video-double-tap-toggle'].toggleDetachedState();
             }
        });
        
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
        const audioEntity = state.audioEntity;
        const audioAsset = state.audioAsset; 
        
        if (audioAsset) {
            audioAsset.pause();
            audioAsset.currentTime = 0;
        }
        if (audioEntity) {
            const soundComp = audioEntity.components.sound;
            if (soundComp && typeof soundComp.setVolume === 'function') {
                soundComp.setVolume(0.0);
                if (typeof soundComp.stopSound === 'function') { 
                    soundComp.stopSound(); 
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
    
    // --- LÓGICA DE DETECCIÓN Y DEBUGGING DEL FLASH MEJORADA ---
    sceneEl.addEventListener("arReady", () => {
        
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;
        let flashAvailable = false;

        // Intentar obtener el track de video de la cámara
        if (mindarComponent && mindarComponent.getCameraStream) {
            const stream = mindarComponent.getCameraStream();
            if (stream) {
                track = stream.getVideoTracks()[0];
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
                btnFlash.style.display = "none"; // Ocultar si no está disponible
            }
        } else {
            console.warn("⚠️ No se pudo obtener el Track de video. Flash deshabilitado e invisible.");
            btnFlash.innerHTML = "❌ FLASH NO DISPONIBLE"; 
            btnFlash.disabled = true;
            btnFlash.style.display = "none";
        }
        
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
    // ------------------------------------------------------------------

    // Lógica de click del botón de flash (MISMA LÓGICA DE TU CÓDIGO ANTERIOR)
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
        
        isGlobalAudioMuted = !isGlobalAudioMuted; 
        const targetMutedState = isGlobalAudioMuted; 

        Object.values(videoRotationState).forEach(state => {
            
            // --- LÓGICA DE VIDEOS ---
            Object.values(state.htmlVideos).forEach(v => {
                v.muted = targetMutedState; 
                if (!targetMutedState && activeTargetIndex === state.targetIndex && v.paused) {
                    v.play().catch(e => {
                        console.warn(`[Video] Fallo al intentar reanudar video al desmutear: ${e}`);
                    }); 
                }
            });
            
            // --- LÓGICA DE AUDIO 3D (MODELOS) ---
            if (state.audioEntity) { 
                
                const audioAsset = state.audioAsset; 
                
                if (audioAsset) {
                    audioAsset.muted = targetMutedState;
                    if (!targetMutedState && activeTargetIndex === state.targetIndex) {
                        startAudio3D(state.audioEntity, state.targetIndex, false);
                    } else if (targetMutedState) {
                        audioAsset.pause(); 
                    }
                }

                const soundComp = state.audioEntity.components.sound;

                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    if (!targetMutedState) { 
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex) {
                            soundComp.playSound(); 
                        }
                    } else { 
                        soundComp.setVolume(0.0); 
                        soundComp.stopSound(); 
                    }
                } else if (!targetMutedState && activeTargetIndex === state.targetIndex) {
                    console.warn(`[Audio 3D] Componente 'sound' no listo, forzando inicialización al desmutear.`);
                    startAudio3D(state.audioEntity, state.targetIndex, false);
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
