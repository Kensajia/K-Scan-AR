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


// === NUEVO COMPONENTE: ROTACIÓN TÁCTIL SIMPLE (SOLO ROTACIÓN X/Y) ===
AFRAME.registerComponent('touch-rotation', {
    init: function () {
        this.touchStart = { x: 0, y: 0 };
        this.touchMove = { x: 0, y: 0 };
        this.isTouched = false;
        
        // Guardar la rotación inicial del modelo si la tiene
        this.currentRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };

        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        // Escuchar los eventos táctiles en el lienzo de la escena para capturarlos sin conflicto.
        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleStart);
            canvas.addEventListener('touchmove', this.handleMove);
            canvas.addEventListener('touchend', this.handleEnd);
        }
    },

    handleStart: function (evt) {
        // Solo si un dedo toca la pantalla
        if (evt.touches.length === 1) {
            this.isTouched = true;
            this.touchStart.x = evt.touches[0].pageX;
            this.touchStart.y = evt.touches[0].pageY;
            // Detener la propagación para evitar que otros elementos UI o controles AR procesen el gesto.
            evt.stopPropagation(); 
        } else {
            this.isTouched = false; // Ignorar gestos de zoom/traslación
        }
    },

    handleMove: function (evt) {
        // Solo procesar si fue un gesto de un solo dedo y estamos en modo touch
        if (!this.isTouched || evt.touches.length !== 1) return;

        this.touchMove.x = evt.touches[0].pageX;
        this.touchMove.y = evt.touches[0].pageY;

        // Calcular el cambio de posición del dedo
        const dx = this.touchMove.x - this.touchStart.x;
        const dy = this.touchMove.y - this.touchStart.y;
        
        // Sensibilidad (ajuste este valor, 0.2 es un buen punto de partida)
        const sensibility = 0.2; 

        // Rotación Y (Giro horizontal) -> Afectado por dx
        const dTheta = dx * sensibility; 
        
        // Rotación X (Giro vertical) -> Afectado por dy
        const dPhi = dy * sensibility; 
        
        // Aplicar la rotación acumulada
        this.currentRotation.y += dTheta;
        this.currentRotation.x += dPhi;
        
        // Opcional: limitar la rotación X (para que no gire completamente al revés)
        // this.currentRotation.x = Math.max(-90, Math.min(90, this.currentRotation.x));
        
        this.el.setAttribute('rotation', this.currentRotation);

        // Actualizar el punto de inicio para el siguiente frame
        this.touchStart.x = this.touchMove.x;
        this.touchStart.y = this.touchMove.y;

        evt.stopPropagation(); 
        evt.preventDefault(); // Evitar el scroll si estamos rotando
    },

    handleEnd: function () {
        this.isTouched = false;
    },

    remove: function() {
        // Limpieza de event listeners al eliminar el componente
        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.removeEventListener('touchstart', this.handleStart);
            canvas.removeEventListener('touchmove', this.handleMove);
            canvas.removeEventListener('touchend', this.handleEnd);
        }
    }
});

// === NUEVO COMPONENTE: DOBLE TAP PARA TOGGLE PANTALLA COMPLETA EN VIDEO ===
AFRAME.registerComponent('video-double-tap-toggle', {
    init: function () {
        this.lastTap = 0;
        this.isDetached = false;
        
        // Almacenar las propiedades originales de la entidad de A-Frame
        this.originalPosition = this.el.getAttribute('position') || { x: 0, y: 0, z: 0 };
        this.originalScale = this.el.getAttribute('scale') || { x: 1, y: 1, z: 1 };
        this.originalRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };

        // Escuchar 'click' en la entidad
        this.el.addEventListener('click', this.handleTap.bind(this));
    },

    handleTap: function (evt) {
        // Solo procesar si la entidad es visible y estamos en el target activo
        if (!this.el.getAttribute('visible')) return;
        
        evt.stopPropagation(); // Prevenir la propagación a la escena

        const now = Date.now();
        const DOUBLE_TAP_TIMEOUT = 300; // 300ms entre taps

        if (now - this.lastTap < DOUBLE_TAP_TIMEOUT) {
            // DOBLE TAP DETECTADO
            this.toggleDetachedState();
            this.lastTap = 0; // Reset para prevenir triple-tap
        } else {
            // Primer tap, registrar tiempo
            this.lastTap = now;
        }
    },

    toggleDetachedState: function () {
        const videoEl = this.el; // La entidad A-Frame
        
        // No permitir el desanclaje si hay otro target activo o si no es el target activo
        if (activeTargetIndex === null) return;
        
        this.isDetached = !this.isDetached;

        if (this.isDetached) {
            // DESANCLAR (Pantalla Completa Simulada)

            // 1. Guardar estado actual (si ha sido modificado por otros componentes)
            this.originalPosition = videoEl.getAttribute('position');
            this.originalScale = videoEl.getAttribute('scale');
            this.originalRotation = videoEl.getAttribute('rotation');
            
            // 2. Moverlo al frente de la cámara del usuario (fuera del marcador)
            // Se puede ajustar la posición Z (-1.5) y la escala (2) para el efecto deseado.
            videoEl.setAttribute('position', '0 0 -1.5'); 
            videoEl.setAttribute('scale', '2 2 1'); 
            videoEl.setAttribute('rotation', '0 0 0'); 
            
            // Opcional: Deshabilitar el componente de seguimiento del marcador (mindar-image-target)
            // Esto requiere acceder al target padre, que es la entidad con el mindar-image-target.
            const targetParent = videoEl.parentNode;
            if (targetParent && targetParent.components['mindar-image-target']) {
                 targetParent.pause(); // Pausar el seguimiento en A-Frame (la entidad permanece en su posición)
            }
            
            console.log("Video desanclado a pantalla completa.");

        } else {
            // REANCLAR (Volver a la posición original)
            
            // 1. Restablecer la posición y rotación originales
            videoEl.setAttribute('position', this.originalPosition);
            videoEl.setAttribute('scale', this.originalScale);
            videoEl.setAttribute('rotation', this.originalRotation);
            
            // 2. Reanudar el seguimiento del marcador
            const targetParent = videoEl.parentNode;
            if (targetParent && targetParent.components['mindar-image-target']) {
                 targetParent.play(); // Reanudar el seguimiento
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
                
                // 1. Carga del modelo 3D (DEJAR ESTA LÍNEA)
                modelEntity.setAttribute('gltf-model', `#${contentData.id}`);
                
                // 2. Control Táctil (APLICANDO EL COMPONENTE PERSONALIZADO)
                modelEntity.setAttribute('touch-rotation', ''); 
                modelEntity.setAttribute('data-has-touch-rotation', true); // Marca para re-aplicar

                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 
                
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }

                if (contentData.audioSrc) {
                    const audioId = `${contentData.id}_audio`;
                    
                    // 1. Crear el elemento <audio> HTML (La fuente real de audio)
                    const audioAsset = document.createElement('audio');
                    audioAsset.setAttribute('id', audioId);
                    audioAsset.setAttribute('src', contentData.audioSrc);
                    audioAsset.setAttribute('preload', 'auto');
                    audioAsset.setAttribute('loop', 'true');
                    audioAsset.setAttribute('playsinline', 'true');
                    audioAsset.setAttribute('muted', 'muted'); 
                    audioAsset.setAttribute('crossorigin', 'anonymous');
                    assetsContainer.appendChild(audioAsset);
                    
                    // 2. Componente 'sound' de A-Frame (SOLO para la posicionalidad 3D)
                    modelEntity.setAttribute('sound', `src: #${audioId}; autoplay: false; loop: true; volume: 0.0; positional: true;`); 
                    
                    // 3. Almacenar ambas referencias en el estado
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
                
                // NUEVA CARACTERÍSTICA: Doble tap para desanclaje de video
                videoEntity.setAttribute('video-double-tap-toggle', ''); 
                // FIN NUEVA CARACTERÍSTICA

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
            
            // Limpiar la fuente del video para liberar recursos
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
        // Verificar setVolume antes de usar soundComp
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
    const audioAsset = state.audioAsset; // Referencia al <audio> HTML

    if (!audioAsset) {
        console.error(`[Audio 3D] ERROR: Elemento <audio> HTML no encontrado para Target ${targetIndex}.`);
        return;
    }
    
    // 1. Reanudar el Web Audio Context si está suspendido (debe haber ocurrido un clic de usuario)
    const soundSystem = sceneEl.components.sound;
    if (soundSystem && soundSystem.context && soundSystem.context.state !== 'running') {
        // Inicializa o reanuda el AudioContext de A-Frame
        soundSystem.initContext(); 
        console.log(`[Audio 3D] Web Audio Context reanudado/iniciado.`);
    }

    // 2. Intentar Reproducir el Asset HTML (Esto es el desbloqueo del audio)
    audioAsset.muted = false;
    audioAsset.load();

    audioAsset.play().then(() => {
        console.log(`[Audio 3D] Asset HTML de audio #${audioAsset.id} reproduciéndose. Conectando 3D.`);
        
        // 3. Conectar el componente A-Frame si ya está listo
        if (soundComp && typeof soundComp.setVolume === 'function') {
             soundComp.setVolume(1.0);
             soundComp.playSound(); 
        } else {
             // Si el componente 'sound' AÚN no está listo, esperamos al evento.
             console.warn(`[Audio 3D] Componente 'sound' no listo, el audio HTML está reproduciéndose. El 3D se conectará cuando el componente se inicialice.`);
             
             // Agregamos un listener de una sola vez para capturar la inicialización.
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
        console.warn(`[Audio 3D] Fallo al iniciar reproducción del asset HTML #${audioAsset.id}. (Posiblemente Autoplay bloqueado o URL incorrecta) - `, error);
        
        // Si falla el play, al menos aseguramos que el componente 3D tenga volumen 1.0.
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
                // SOLO si el componente está listo, lo controlamos
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
            // SOLO si el componente está listo, lo controlamos
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
                // Intentar obtener capacidades (falla si no se soporta torch)
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

    // Lógica de click del botón de flash (REVISADA)
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

    // LÓGICA DE AUDIO GLOBAL (Mejorada para manejar la asincronía)
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
                
                const audioAsset = state.audioAsset; // Referencia al <audio> HTML
                
                if (audioAsset) {
                    audioAsset.muted = targetMutedState;
                    if (!targetMutedState && activeTargetIndex === state.targetIndex) {
                        // Si se desmutea, intentar reproducir el asset HTML
                        // startAudio3D se encarga de reanudar el Web Audio Context y hacer play
                        startAudio3D(state.audioEntity, state.targetIndex, false);
                    } else if (targetMutedState) {
                        audioAsset.pause(); // Pausar el asset HTML subyacente al mutear
                    }
                }

                const soundComp = state.audioEntity.components.sound;

                if (soundComp && typeof soundComp.setVolume === 'function') {
                    
                    if (!targetMutedState) { // Objetivo: SONIDO (Desmutear)
                        soundComp.setVolume(1.0); 
                        if (activeTargetIndex === state.targetIndex) {
                            soundComp.playSound(); // Activar el nodo Panner 3D
                        }
                    } else { // Objetivo: MUTE (Mutear)
                        soundComp.setVolume(0.0); 
                        soundComp.stopSound(); 
                    }
                } else if (!targetMutedState && activeTargetIndex === state.targetIndex) {
                    // Si el componente no está listo y se intenta DESMUTEAR en el target activo:
                    // Forzar la inicialización, que se maneja dentro de startAudio3D.
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
