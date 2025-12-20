const JSON_PATH = './assets/IndexSet2.json'; 

let sceneEl;
let controls;
let trackRef = { track: null };
let btnFlash;
let btnNextVideo;
let btnReset3D;
let targetContainer;
let assetsContainer;

// NUEVAS VARIABLES GLOBALES PARA EL CARGADOR
let loaderBarContainer; 
let loaderText;         
let progressBarFill;    

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
    btnReset3D = safeQuerySelector("#btn-reset-3d", 'Reset 3D Button');
    targetContainer = safeQuerySelector("#target-container", 'Target Container');
    assetsContainer = safeQuerySelector("#assets-container", 'Assets Container');
    
    // NUEVO: Referencias a los componentes de la barra de carga
    loaderBarContainer = safeQuerySelector("#loader-bar-container", 'Loader Bar Container');
    loaderText = safeQuerySelector("#loader-text", 'Loader Text');
    progressBarFill = safeQuerySelector("#progress-bar-fill", 'Progress Bar Fill');
}


// === FUNCIONES DE CONTROL DEL CARGADOR (MODIFICADAS) ===
function showLoader(text = "Cargando multimedia...") {
    if (loaderBarContainer) {
        loaderText.textContent = text;
        
        // Configurar la barra para el modo Indeterminado (animación CSS)
        progressBarFill.style.width = '100%';
        progressBarFill.style.transform = 'translateX(-100%)'; 
        progressBarFill.style.animationPlayState = 'running';

        loaderBarContainer.style.display = 'flex';
    }
}

function hideLoader() {
    if (loaderBarContainer) {
        // Detener la animación
        progressBarFill.style.animationPlayState = 'paused';
        progressBarFill.style.transform = 'translateX(0%)';
        
        loaderBarContainer.style.display = 'none';
    }
}
// ===================================================================


// === COMPONENTE KEEP-ALIVE ===
AFRAME.registerComponent('keep-alive', {
    tick: function () {
        const scene = this.el.sceneEl; 
        if (scene && scene.renderer && scene.renderStarted && !scene.paused) {
            scene.renderer.render(scene.object3D, scene.camera);
        }
    }
});


// === COMPONENTE: ROTACIÓN TÁCTIL SIMPLE (SOPORTE X/Y/Z Y SENSIBILIDAD DINÁMICA) ===
AFRAME.registerComponent('touch-rotation', {
    // COMENTARIOS SOBRE CÓMO ACTIVAR/DESACTIVAR EJES (X, Y, Z):
    // El componente 'touch-rotation' tiene propiedades booleanas que se leen desde el JSON.
    schema: {
        enableX: { type: 'boolean', default: true },  // Rotación Vertical/Pitch
        enableY: { type: 'boolean', default: true },  // Giro Horizontal/Yaw
        enableZ: { type: 'boolean', default: false }, // Alabeo/Roll
        sensibility: { type: 'number', default: 0.2 } // Valor numérico para la velocidad
    },

    init: function () {
        this.touchStart = { x: 0, y: 0 };
        this.touchMove = { x: 0, y: 0 };
        this.isTouched = false;
        
        this.currentRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
        this.data = this.el.components['touch-rotation'].data;

        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.resetState = this.resetState.bind(this); 

        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleStart);
            canvas.addEventListener('touchmove', this.handleMove);
            canvas.addEventListener('touchend', this.handleEnd);
        }
    },

    update: function (oldData) {
        // Asegura que this.data siempre tenga los valores del esquema, incluso después de un update de atributo
        this.data = this.el.components['touch-rotation'].data; 
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
        
        // Uso de los datos del esquema para activar/desactivar ejes
        if (this.data.enableY) {
            const dThetaY = dx * this.data.sensibility; 
            this.currentRotation.y += dThetaY;
        }
        
        if (this.data.enableX) {
            const dThetaX = dy * this.data.sensibility; 
            this.currentRotation.x += dThetaX;
        }

        if (this.data.enableZ) {
            // Rotación Z (alabeo)
            const dThetaZ = -(dx / 2) * this.data.sensibility; 
            this.currentRotation.z += dThetaZ;
        }
        
        this.el.setAttribute('rotation', this.currentRotation);

        this.touchStart.x = this.touchMove.x;
        this.touchStart.y = this.touchMove.y;

        evt.stopPropagation(); 
        evt.preventDefault(); 
    },

    handleEnd: function () {
        this.isTouched = false;
    },
    
    // MÉTODO PARA EL RESETEO EXTERNO
    resetState: function() {
        const initialRotationString = this.el.dataset.initialRotation || '0 0 0';
        const rotComponents = initialRotationString.split(' ').map(Number);
        
        this.currentRotation = { 
            x: rotComponents[0] || 0, 
            y: rotComponents[1] || 0, 
            z: rotComponents[2] || 0 
        };
        this.el.setAttribute('rotation', this.currentRotation);
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
                
                // 1. Carga del modelo 3D
                modelEntity.setAttribute('gltf-model', `#${contentData.id}`);
                
                // 2. Listener de Carga 3D: Oculta el cargador cuando el modelo termine de cargar
                modelEntity.addEventListener('model-loaded', () => {
                    // Solo ocultamos si este modelo es el contenido activo/inicial en el momento de la carga
                    if (activeTargetIndex === targetIndex && videoRotationState[targetIndex].currentVideoIndex === index) {
                         hideLoader();
                    }
                }, { once: true });
                
                // 3. Control Táctil (Configuración desde JSON: touchRotation)
                modelEntity.setAttribute('touch-rotation', contentData.touchRotation || ''); 
                
                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 

                // Guardar valores iniciales en el dataset
                modelEntity.dataset.initialRotation = contentData.rotation || '0 0 0';
                modelEntity.dataset.initialScale = contentData.scale || '1 1 1';
                                         
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
                
                const videoEntity = document.createElement(contentData.chromakey ? 'a-plane' : 'a-video');
                videoEntity.setAttribute('id', `ar-video-${targetIndex}-${index}`);
                
                if (contentData.chromakey) {
                    
                    const chromaColor = contentData.chromaColor || '#00ff00';
                    const normalizedRgb = hexToNormalizedRgb(chromaColor); 
                    const similarity = contentData.chromaSimilarity || 0.45; 

                    videoEntity.setAttribute('material', 
                        `shader: chromakey; 
                         src: #${contentData.id}; 
                         color: ${normalizedRgb};
                         similarity: ${similarity}`); 
                    
                } else {
                    videoEntity.setAttribute('src', `#${contentData.id}`); 
                } 
                
                videoEntity.dataset.videoSrc = contentData.src; 
                
                videoEntity.setAttribute('width', contentData.width);
                videoEntity.setAttribute('height', contentData.height);
                videoEntity.setAttribute('position', contentData.position || '0 0 0');
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

// === FUNCIÓN AUXILIAR DE RESETEO DE ESTADO ===
function resetEntityState(currentEntity) {
    if (!currentEntity || !currentEntity.dataset.initialRotation) {
        return;
    }
    
    const initialRotation = currentEntity.dataset.initialRotation || '0 0 0';
    const initialScale = currentEntity.dataset.initialScale || '1 1 1';
    
    currentEntity.setAttribute('rotation', initialRotation);
    currentEntity.setAttribute('scale', initialScale);
    
    // Resetear el estado interno del componente 'touch-rotation'
    const touchRotationComp = currentEntity.components['touch-rotation'];
    if (touchRotationComp && typeof touchRotationComp.resetState === 'function') {
        touchRotationComp.resetState();
    }
}
// ====================================================


// === LÓGICA DE ROTACIÓN Y VIDEO ===

function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    state.arEntities.forEach((entityEl, i) => {
        entityEl.setAttribute('visible', i === contentIndex);
    });
    state.currentVideoIndex = contentIndex;
}

// FUNCIÓN CLAVE: Ahora oculta el loader basado en la promesa de play(), asegurando estabilidad.
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

    // FIX CHROMA: Asegurar que el material del A-PLANE (Chroma) tenga la nueva fuente
    if (currentVidEntity.tagName === 'A-PLANE' && currentVidEntity.hasAttribute('material')) {
        const currentMaterial = currentVidEntity.getAttribute('material');
        currentVidEntity.setAttribute('material', {...currentMaterial, src: `#${currentVidAsset.id}`});
    } else {
        currentVidEntity.setAttribute('src', `#${currentVidAsset.id}`);
    }
    
    // Si el video necesita ser cargado (primera vez o cambio de fuente)
    if (!currentVidAsset.dataset.loadedSrc || currentVidAsset.dataset.loadedSrc !== currentUrl) {
        
        // 1. Mostrar cargador y actualizar el origen
        showLoader("Cargando video..."); 
        currentVidAsset.src = currentUrl;
        currentVidAsset.load(); 
        currentVidAsset.dataset.loadedSrc = currentUrl; 
    } else {
        // 1. Si ya estaba cargado, ocultar el loader inmediatamente y reproducir
        hideLoader(); 
    }
    
    currentVidAsset.muted = isGlobalAudioMuted; 
    currentVidAsset.onended = null; 
    
    // 2. Intentar Reproducir. Esto es una promesa y solo se resuelve cuando el video está listo para reproducir.
    currentVidAsset.play().then(() => {
        // ÉXITO DE REPRODUCCIÓN: El video ha cargado y ha comenzado (o continuado)
        hideLoader();
    }).catch(error => {
        // ERROR: Autoplay bloqueado o error de carga
        console.warn("Fallo al intentar reproducir video. Causa común: Autoplay bloqueado. Intenta desmutear.", error);
        hideLoader(); // Ocultar cargador para no confundir al usuario
    }); 
}

// LÓGICA DE ROTACIÓN MANUAL (SIGUIENTE)
function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    
    const totalEntities = state.arEntities.length; 
    
    if (activeTargetIndex === null || totalEntities <= 1) return;
    
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // 1. Detener el elemento actual y liberar recursos
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
        // Detener audio 3D (Elemento 3D con audio)
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
    
    showLoader("Cargando contenido siguiente..."); // Mostrar el cargador antes de cambiar
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    const nextEntity = state.arEntities[nextIndex];

    // Lógica del Botón de Reset 3D al Rotar
    const nextContentIs3D = nextEntity && nextEntity.hasAttribute('gltf-model');
    
    if (nextContentIs3D) {
        btnReset3D.style.display = 'flex';
        // Si el modelo 3D ya está en caché
        if (nextEntity.components['gltf-model'] && nextEntity.components['gltf-model'].model) {
            hideLoader();
        } 
    } else {
        btnReset3D.style.display = 'none';
    }
    
    // 4. Si el siguiente elemento es un video, comenzar la reproducción
    if (nextEntity.tagName === 'A-VIDEO' || nextEntity.tagName === 'A-PLANE') {
        playCurrentVideo(activeTargetIndex);
    } else if (state.audioEntity && nextEntity === state.audioEntity) { 
        // 5. Si el siguiente elemento es el 3D con audio
        startAudio3D(state.audioEntity, activeTargetIndex, isGlobalAudioMuted);
    } else {
        hideLoader(); // Si es un elemento estático simple, ocultar inmediatamente
    }
}

// === FUNCIÓN AUXILIAR PARA INICIAR AUDIO 3D ===
function startAudio3D(audioEntity, targetIndex, isGlobalAudioMuted) {
    
    if (isGlobalAudioMuted) return;

    const state = videoRotationState[targetIndex];
    let soundComp = audioEntity.components.sound;
    const audioAsset = state.audioAsset; 

    if (!audioAsset) {
        console.error(`[Audio 3D] ERROR: Elemento <audio> HTML no encontrado para Target ${targetIndex}.`);
        return;
    }
    
    // 1. Reanudar el Web Audio Context si está suspendido
    const soundSystem = sceneEl.components.sound;
    if (soundSystem && soundSystem.context && soundSystem.context.state !== 'running') {
        soundSystem.initContext(); 
    }

    // 2. Intentar Reproducir el Asset HTML
    audioAsset.muted = false;
    audioAsset.load();

    audioAsset.play().then(() => {
        
        hideLoader(); // Ocultar cargador si el audio comienza
        
        // 3. Conectar el componente A-Frame
        if (soundComp && typeof soundComp.setVolume === 'function') {
             soundComp.setVolume(1.0);
             soundComp.playSound(); 
        } else {
             // Si el componente 'sound' AÚN no está listo, esperamos al evento.
             audioEntity.addEventListener('componentinitialized', function handler(evt) {
                 if (evt.detail.name === 'sound') {
                     audioEntity.removeEventListener('componentinitialized', handler);
                     const newSoundComp = audioEntity.components.sound;
                     if (newSoundComp) {
                         newSoundComp.setVolume(1.0);
                         newSoundComp.playSound();
                     }
                 }
             }, { once: true });
        }

    }).catch(error => {
        console.warn(`[Audio 3D] Fallo al iniciar reproducción del asset HTML #${audioAsset.id}.`, error);
        hideLoader(); // Ocultar si falló
        if (soundComp && typeof soundComp.setVolume === 'function') { 
            soundComp.setVolume(1.0); 
        }
    });
}
    // ===============================================

    // === FUNCIÓN DE RESET DEL MODELO 3D ===
    function resetActiveModelRotation() {
    if (activeTargetIndex === null) return;

    const state = videoRotationState[activeTargetIndex];
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // Verificar si es un modelo 3D
    if (currentEntity && currentEntity.tagName === 'A-ENTITY' && currentEntity.hasAttribute('gltf-model')) {
        
        // Reutilizamos la función auxiliar
        resetEntityState(currentEntity);
    }
}
// =====================================

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

        showLoader("Preparando contenido..."); // Mostrar cargador al encontrar el marcador

        // Mostrar botón SIGUIENTE (Si hay más de 1 elemento en el array 'elementos')
        const totalEntities = state.arEntities.length;
        if (totalEntities > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        const initialContent = state.arEntities[0];

        // LÓGICA DE RESETEO AUTOMÁTICO AL ENCONTRAR MARCADOR
        if (initialContent && initialContent.hasAttribute('gltf-model')) {
            // Esto asegura que el modelo 3D siempre inicie en su posición original
            resetEntityState(initialContent); 
            btnReset3D.style.display = 'flex';
        } else {
            btnReset3D.style.display = 'none';
        }
        
        // === LÓGICA DE INICIO DEL CONTENIDO ACTUAL (Índice 0) ===
        const initialContentIsVideo = initialContent && 
            (initialContent.tagName === 'A-VIDEO' || initialContent.tagName === 'A-PLANE');
        
        if (initialContentIsVideo) {
            playCurrentVideo(targetIndex);
        } else {
            showVideo(targetIndex, 0); 
            
            const modelLoaded = initialContent && initialContent.components['gltf-model'] && initialContent.components['gltf-model'].model;
            
            // Si el modelo 3D ya está en caché o es un elemento simple estático, ocultamos el loader.
            if (modelLoaded || !initialContent) {
                hideLoader();
            }
            // Si es un modelo 3D que DEBE cargarse, 'model-loaded' lo ocultará.
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
            btnReset3D.style.display = 'none';
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
        hideLoader(); // Ocultar el cargador al perder el marcador
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
        
        // Inicializar el botón de audio
        const btnAudio = safeQuerySelector("#btn-audio", 'Audio Button');
        if (isGlobalAudioMuted) {
             btnAudio.style.background = "var(--danger)";
             btnAudio.innerHTML = "🔇 SILENCIO";
        } else {
             btnAudio.style.background = "var(--accent)";
             btnAudio.innerHTML = "🔊 SONIDO";
        }
        
        // Ocultar el cargador una vez que la escena AR esté lista
        hideLoader(); 
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
        btnReset3D.classList.toggle("hidden");
    });

    // Botón de Rotación Manual
    btnNextVideo.addEventListener("click", rotateVideoManually);

    // Botón de Reset 3D
    btnReset3D.addEventListener("click", resetActiveModelRotation);
    
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
    // Muestra el cargador justo al inicio (mientras carga MindAR)
    showLoader("Iniciando AR..."); 
    initializeUIListeners();
    loadConfig(); 
});
