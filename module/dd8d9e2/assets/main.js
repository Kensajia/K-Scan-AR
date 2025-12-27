const JSON_PATH = './assets/IndexSet2.json'; 

let sceneEl;
let controls;
let trackRef = { track: null };
let btnFlash;
let btnNextVideo;
let btnReset3D;
let btnRotate3D; // NUEVO BOTÓN ROTACIÓN
let btn3DContainer; // NUEVO CONTENEDOR
let targetContainer;
let assetsContainer;

// === NUEVAS VARIABLES DE ESTADO Y UI ===
let statusBar;
let statusText;
let loadTimer = null; // Timer para el retraso de 1 segundo
// =======================================

let videoRotationState = {}; 
let config = null; 
let activeTargetIndex = null;
let isGlobalAudioMuted = true; 

// Variable global para el control del tiempo de gracia.
let gracePeriodTimer = null; 

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
            classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false }
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
    
    // === NUEVOS/ACTUALIZADOS SELECTORES DE BOTONES 3D ===
    btn3DContainer = safeQuerySelector("#btn-3d-controls-container", '3D Controls Container');
    btnRotate3D = safeQuerySelector("#btn-rotate-3d", 'Rotate 3D Button');
    btnReset3D = safeQuerySelector("#btn-reset-3d", 'Reset 3D Button');
    // ====================================================

    targetContainer = safeQuerySelector("#target-container", 'Target Container');
    assetsContainer = safeQuerySelector("#assets-container", 'Assets Container');

    // === NUEVOS SELECTORES DE ESTADO ===
    statusBar = safeQuerySelector("#status-bar", 'Status Bar');
    statusText = safeQuerySelector("#status-text", 'Status Text');
    // ===================================
}

// === NUEVA FUNCIÓN: Gestión de la barra de estado (Toast Notification) ===
/**
 * Muestra un mensaje en la barra de estado y oculta la anterior.
 * @param {string} message - El texto a mostrar.
 * @param {number} durationMs - Duración del mensaje en milisegundos (0 para dejarlo fijo).
 */
function showStatusMessage(message, durationMs = 0) {
    
    // Si el control principal está oculto, no mostrar la barra de estado
    if (controls.classList.contains("hidden")) return;
    
    // Limpiar cualquier timer de ocultación anterior
    if (statusBar.dataset.hideTimer) {
        clearTimeout(parseInt(statusBar.dataset.hideTimer));
    }
    
    statusText.textContent = message;
    statusBar.classList.remove('hidden');

    if (durationMs > 0) {
        const hideTimer = setTimeout(() => {
            statusBar.classList.add('hidden');
            delete statusBar.dataset.hideTimer;
        }, durationMs);
        statusBar.dataset.hideTimer = hideTimer;
    } else {
         delete statusBar.dataset.hideTimer; // Marcar como fijo
    }
}

/**
 * Oculta la barra de estado (si no está fija y está visible).
 */
function hideStatusBar() {
    if (statusBar.dataset.hideTimer) { 
        clearTimeout(parseInt(statusBar.dataset.hideTimer));
        delete statusBar.dataset.hideTimer;
    }
    statusBar.classList.add('hidden');
}

// === NUEVA FUNCIÓN: Control de Posición de la Barra de Estado ===
/**
 * Aplica la clase CSS de posicionamiento a la barra de estado según el entorno.
 * @param {string} environment - 'initial', 'video', '3d', '3daudio'.
 */
function setStatusPosition(environment) {
    if (!statusBar) return;

    // 1. Remover todas las clases de posición existentes
    statusBar.classList.remove('pos-initial', 'pos-video', 'pos-3d', 'pos-3daudio');

    // 2. Aplicar la nueva clase
    const positionClass = `pos-${environment}`;
    statusBar.classList.add(positionClass);
}
// ========================================================================

// === NUEVA FUNCIÓN: Control de Pausa/Reproducción de Animación 3D ===
/**
 * Pausa o reanuda la animación de un modelo 3D usando animation-mixer.
 * @param {HTMLElement} entityEl - La entidad A-Frame con el modelo 3D.
 * @param {boolean} pause - true para pausar, false para reanudar.
 */
function toggleAnimation3D(entityEl, pause) {
    if (!entityEl || entityEl.tagName !== 'A-ENTITY' || !entityEl.hasAttribute('gltf-model')) {
        return;
    }

    const mixerComponent = entityEl.components['animation-mixer'];

    if (mixerComponent) {
        if (pause) {
            mixerComponent.pause();
        } else {
            mixerComponent.play();
        }
    }
}


// === COMPONENTE KEEP-ALIVE, TOUCH-ROTATION (MODIFICADO) ===
AFRAME.registerComponent('keep-alive', {
    tick: function () {
        const scene = this.el.sceneEl; 
        if (scene && scene.renderer && scene.renderStarted && !scene.paused) {
            scene.renderer.render(scene.object3D, scene.camera);
        }
    }
});

AFRAME.registerComponent('touch-rotation', {
    schema: {
        enableX: { type: 'boolean', default: true },
        enableY: { type: 'boolean', default: true },
        enableZ: { type: 'boolean', default: false }, 
        sensibility: { type: 'number', default: 0.2 },
        enabled: { type: 'boolean', default: true } // Para habilitar/deshabilitar externamente
    },

    init: function () {
        this.touchStart = { x: 0, y: 0 };
        this.touchMove = { x: 0, y: 0 };
        this.isTouched = false;
        
        // Inicializar currentRotation con la rotación actual o por defecto
        this.currentRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
        
        this.data = this.el.components['touch-rotation'].data;

        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.resetState = this.resetState.bind(this); 
        this.syncCurrentRotationWithAttribute = this.syncCurrentRotationWithAttribute.bind(this); // NUEVO BIND

        const canvas = this.el.sceneEl.canvas;
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleStart);
            canvas.addEventListener('touchmove', this.handleMove);
            canvas.addEventListener('touchend', this.handleEnd);
        }
    },

    update: function (oldData) {
        this.data = this.el.components['touch-rotation'].data;
    },

    handleStart: function (evt) {
        if (!this.data.enabled) return; // Verificar si está habilitado
        
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
        if (!this.data.enabled || !this.isTouched || evt.touches.length !== 1) return; // Verificar si está habilitado

        this.touchMove.x = evt.touches[0].pageX;
        this.touchMove.y = evt.touches[0].pageY;

        const dx = this.touchMove.x - this.touchStart.x; 
        const dy = this.touchMove.y - this.touchStart.y; 
        
        if (this.data.enableY) {
            const dThetaY = dx * this.data.sensibility; 
            this.currentRotation.y += dThetaY;
        }
        
        if (this.data.enableX) {
            const dThetaX = dy * this.data.sensibility; 
            this.currentRotation.x += dThetaX;
        }

        if (this.data.enableZ) {
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
    
    resetState: function() {
        // [USADO POR EL BOTÓN RESET 3D] Vuelve a la rotación inicial del JSON
        const initialRotationString = this.el.dataset.initialRotation || '0 0 0';
        const rotComponents = initialRotationString.split(' ').map(Number);
        
        // Resetear el estado interno a la rotación inicial del modelo
        this.currentRotation = { 
            x: rotComponents[0] || 0, 
            y: rotComponents[1] || 0, 
            z: rotComponents[2] || 0 
        };
    },
    
    // NUEVA FUNCIÓN: Sincroniza el estado interno con el atributo de rotación actual.
    // Esto es crucial para reanudar el control táctil desde la posición final de la animación.
    syncCurrentRotationWithAttribute: function() {
        this.currentRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
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
        hideStatusBar();
    }
}

function initializeScene() {
    
    const Targets = config.Targets;
    
    if (!assetsContainer.appendChild) return; 

    Targets.forEach(target => {
        
        const { targetIndex, elementos } = target;
        
        videoRotationState[targetIndex] = {
            currentVideoIndex: 0,
            htmlVideos: {}, // Para videos tradicionales
            audioVideoAssets: {}, // NUEVO: Para videos de audio de 3D-Audio
            arEntities: [], 
            numVideos: 0, 
            hasVideoContent: false,
            targetIndex: targetIndex,
            // NUEVA PROPIEDAD: Para el tiempo de gracia
            lostTargetTimestamp: null 
        };

        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('id', `target-${targetIndex}`);
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        let videoCount = 0;
        
        elementos.forEach((contentData, index) => {
            
            // CAMBIO: "3d-audio" a "3d+audio"
            const is3DModel = contentData.type === "3d" || contentData.type === "3d+audio";
            
            if (is3DModel) {
                
                // === LÓGICA DE MODELOS 3D (GLTF/GLB y 3D-AUDIO) ===
                
                const modelAsset = document.createElement('a-asset-item');
                modelAsset.setAttribute('id', contentData.id);
                modelAsset.setAttribute('src', contentData.src);
                assetsContainer.appendChild(modelAsset);
                
                const modelEntity = document.createElement('a-entity');
                modelEntity.setAttribute('id', `ar-model-${targetIndex}-${index}`);
                
                modelEntity.setAttribute('gltf-model', `#${contentData.id}`);
                
                // Configuración de touch-rotation con valores por defecto si no están en el JSON
                const enableX = contentData.rotationEnableX !== undefined ? contentData.rotationEnableX : true;
                const enableY = contentData.rotationEnableY !== undefined ? contentData.rotationEnableY : true;
                const enableZ = contentData.rotationEnableZ !== undefined ? contentData.rotationEnableZ : false;
                const sensibility = contentData.rotationSensibility !== undefined ? contentData.rotationSensibility : 0.3; 
                
                modelEntity.setAttribute('touch-rotation', 
                    `enableX: ${enableX}; 
                     enableY: ${enableY}; 
                     enableZ: ${enableZ};
                     sensibility: ${sensibility};
                     enabled: true`); // Siempre iniciar habilitado
                
                modelEntity.setAttribute('position', contentData.position || '0 0 0');
                modelEntity.setAttribute('scale', contentData.scale || '1 1 1');
                modelEntity.setAttribute('rotation', contentData.rotation || '0 0 0');
                modelEntity.setAttribute('visible', index === 0); 
                
                // Guardar valores iniciales en el dataset, además de la configuración de giro
                modelEntity.dataset.initialRotation = contentData.rotation || '0 0 0';
                modelEntity.dataset.initialScale = contentData.scale || '1 1 1';
                // Nuevos datos para el giro 360
                modelEntity.dataset.giraEje = contentData.giraEje || 'Y';
                modelEntity.dataset.giraDuracion = contentData.giraDuracion || 1500;
                
                // === LÓGICA ESPECÍFICA DE 3D-AUDIO ===
                // CAMBIO: "3d-audio" a "3d+audio"
                if (contentData.type === "3d+audio" && contentData.audioSrc) {
                    
                    // Crear el ID único para el asset de audio/video
                    const audioVideoAssetId = `AudioAsset-${contentData.id}`;
                    
                    // Crear el elemento de video oculto
                    const audioVideoAsset = document.createElement('video');
                    audioVideoAsset.setAttribute('id', audioVideoAssetId);
                    audioVideoAsset.setAttribute('preload', 'none'); 
                    audioVideoAsset.setAttribute('loop', 'true');
                    audioVideoAsset.setAttribute('playsinline', 'true');
                    audioVideoAsset.setAttribute('webkit-playsinline', 'true');
                    audioVideoAsset.setAttribute('muted', 'muted'); 
                    audioVideoAsset.setAttribute('crossorigin', 'anonymous');
                    // NO establecer src aquí, se hará en playCurrentContent
                    
                    assetsContainer.appendChild(audioVideoAsset);
                    
                    // Guardar referencia
                    videoRotationState[targetIndex].audioVideoAssets[audioVideoAssetId] = audioVideoAsset;
                    
                    // Almacenar el ID del asset de audio en la entidad 3D
                    modelEntity.dataset.audioVideoId = audioVideoAssetId; 
                }
                
                // Configuración de animación del modelo
                if (contentData.animated) {
                    modelEntity.setAttribute('animation-mixer', contentData.animationMixer || 'clip: *'); 
                }
                
                // Listener de Carga (Ya no llama a hideStatusBar directamente, solo para 3D estático)
                // Para 3D-Audio, el listener model-loaded llamará al Gatekeeper en playCurrentContent
                modelEntity.addEventListener('model-loaded', () => {
                    if (contentData.animated) {
                        // CAMBIO: Comparar contra el nuevo tipo "3d+audio"
                        toggleAnimation3D(modelEntity, contentData.type === "3d+audio"); // Pausar si es 3D+Audio, sino se reanuda en playCurrentContent (3D simple)
                    }

                    // Si NO es 3D-Audio, se oculta el mensaje de carga inmediatamente (lógica original)
                    if (contentData.type !== "3d+audio" && modelEntity.dataset.loadingStatusId) {
                        const statusId = parseInt(modelEntity.dataset.loadingStatusId);
                        if (loadTimer === statusId) { 
                            clearTimeout(loadTimer);
                            loadTimer = null;
                            hideStatusBar();
                        }
                        delete modelEntity.dataset.loadingStatusId;
                    }
                });

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

// === FUNCIÓN AUXILIAR DE RESETEO DE ESTADO (ROTACIÓN 3D) ===
function resetEntityState(currentEntity) {
    if (!currentEntity || !currentEntity.dataset.initialRotation) {
        return;
    }
    
    // Detener y eliminar la animación de giro 360 si existe
    stop360RotationAnimation(currentEntity);
    
    const initialRotation = currentEntity.dataset.initialRotation || '0 0 0';
    const initialScale = currentEntity.dataset.initialScale || '1 1 1';
    
    currentEntity.setAttribute('rotation', initialRotation);
    currentEntity.setAttribute('scale', initialScale);
    
    // Resetear el estado interno del componente touch-rotation (llama a resetState)
    const touchRotationComp = currentEntity.components['touch-rotation'];
    if (touchRotationComp && typeof touchRotationComp.resetState === 'function') {
        touchRotationComp.resetState();
    }
    // Asegurar que touch-rotation esté habilitado después del reset
    currentEntity.setAttribute('touch-rotation', 'enabled', true);
}
// =========================================================

// === FUNCIÓN AUXILIAR DE DETENCIÓN DE ROTACIÓN 360 ===
function stop360RotationAnimation(currentEntity) {
    if (currentEntity && currentEntity.hasAttribute('animation')) {
        currentEntity.removeAttribute('animation');
    }
}
// ===================================================

// === NUEVA FUNCIÓN: FINALIZA EL GIRO Y MANTIENE LA POSICIÓN ===
function finalize360Rotation() {
    if (activeTargetIndex === null) return;

    const state = videoRotationState[activeTargetIndex];
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // Verificar si es un modelo 3D
    if (currentEntity && currentEntity.tagName === 'A-ENTITY' && currentEntity.hasAttribute('gltf-model')) {
        
        // 1. Detener animación 360 (quita el componente animation)
        stop360RotationAnimation(currentEntity); 
        
        // 2. Sincronizar el estado interno del componente touch-rotation con la posición final actual del modelo.
        const touchRotationComp = currentEntity.components['touch-rotation'];
        if (touchRotationComp && typeof touchRotationComp.syncCurrentRotationWithAttribute === 'function') {
            touchRotationComp.syncCurrentRotationWithAttribute();
        }
        
        // 3. Re-habilitar touch-rotation
        currentEntity.setAttribute('touch-rotation', 'enabled', true);

        // 4. Si está animado, reanudar la animación del mixer
        if (currentEntity.hasAttribute('animation-mixer')) {
             toggleAnimation3D(currentEntity, false); 
        }

        // 5. Ocultar mensaje de estado
        showStatusMessage("✅ Giro finalizado.", 1000);
		setTimeout(function() {
			showStatusMessage("✅ Puedes interactuar.", 500);
		}, 1000);
    }
}
// ===============================================================

// === FUNCIÓN DE INICIO DE ROTACIÓN 360 (MODIFICADA) ===
function start360Rotation() {
    if (activeTargetIndex === null) return;
    
    const state = videoRotationState[activeTargetIndex];
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    if (!currentEntity || !currentEntity.hasAttribute('gltf-model')) {
        // No es un modelo 3D o no es el modelo activo
        return;
    }
    
    // 1. Detener cualquier animación 360 previa
    stop360RotationAnimation(currentEntity);
    
    // 2. Obtener datos y rotación actual
    const currentRotation = currentEntity.getAttribute('rotation');
    const eje = currentEntity.dataset.giraEje;
    const duracion = parseInt(currentEntity.dataset.giraDuracion);

    if (!eje || isNaN(duracion) || duracion <= 0) {
        console.warn("Faltan datos de giro 360 en JSON o son inválidos.");
        return;
    }

    // 3. Calcular rotación final
    let finalX = currentRotation.x;
    let finalY = currentRotation.y;
    let finalZ = currentRotation.z;
    let rotationTo = '';
    
    // Sumar 360 grados al eje seleccionado (X, Y o Z)
    if (eje === 'X') {
        finalX += 360;
    } else if (eje === 'Y') {
        finalY += 360;
    } else if (eje === 'Z') {
        finalZ += 360;
    }
    
    rotationTo = `${finalX} ${finalY} ${finalZ}`;
    
    // 4. Deshabilitar touch-rotation durante la animación
    currentEntity.setAttribute('touch-rotation', 'enabled', false);
    
    // 5. Aplicar la animación
    currentEntity.setAttribute('animation', {
        property: 'rotation',
        to: rotationTo,
        dur: duracion,
        easing: 'linear',
        loop: 1 // Rotar solo una vez
    });
    
    // 6. Mostrar mensaje de estado
    showStatusMessage("🔄 Girando...", 0); // Fijo hasta que termine la animación
    
    // 7. Ejecutar la finalización por tiempo
    const delay = duracion + 250; // Duración de la animación + 250ms de margen

    setTimeout(() => {
        // Ejecutar el nuevo soft reset que mantiene la posición final
        finalize360Rotation(); 
    }, delay);
}
// ====================================================

// === LÓGICA DE REPRODUCCIÓN/REANUDACIÓN DEL CONTENIDO (Video/3D) ===
function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    state.arEntities.forEach((entityEl, i) => {
        entityEl.setAttribute('visible', i === contentIndex);
    });
    state.currentVideoIndex = contentIndex;
}

// ** NUEVA FUNCIÓN: Gatekeeper de Carga y Sincronización para 3D-Audio **
/**
 * Verifica si tanto el modelo 3D como el audio/video asociado están listos.
 * Si lo están, inicia la reproducción/animación y oculta la barra de estado.
 * @param {HTMLElement} entityEl - La entidad A-Frame (3D)
 * @param {HTMLVideoElement} audioVideoAsset - El elemento de video para el audio
 */
function startContentGatekeeper(entityEl, audioVideoAsset) {
    
    // Usamos el dataset de la entidad para rastrear el estado de carga
    const modelReady = entityEl.dataset.modelLoaded === 'true';
    const audioReady = audioVideoAsset.dataset.audioLoaded === 'true';

    // Si ambos están listos
    if (modelReady && audioReady) {
        
        if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
        }
        hideStatusBar();

        // 1. Iniciar Animación 3D (si existe)
        if (entityEl.hasAttribute('animation-mixer')) {
            toggleAnimation3D(entityEl, false);
        }
        
        // 2. Iniciar Reproducción del Audio/Video
        const playPromise = audioVideoAsset.play();
        
        if (playPromise !== undefined) {
             playPromise.catch(error => {
                console.warn("Fallo al intentar reproducir audio/video. Autoplay bloqueado.", error);
            });
        }
        
        // 3. Limpiar flags
        delete entityEl.dataset.modelLoaded;
        delete audioVideoAsset.dataset.audioLoaded;
        if (entityEl.dataset.loadingStatusId) {
             delete entityEl.dataset.loadingStatusId;
        }
    }
}


function playCurrentContent(targetIndex) {
    
    // --- 0. Lógica de Timer de Carga/Descarga: Limpiar antes de iniciar ---
    // FIX 1A: Asegurar que cualquier timer de carga/descarga se limpie al iniciar una reproducción
    if (loadTimer) {
        clearTimeout(loadTimer);
        loadTimer = null;
    }
    
    const state = videoRotationState[targetIndex];
    const currentContentIndex = state.currentVideoIndex; 
    
    const currentEntity = state.arEntities[currentContentIndex];
    
    if (!currentEntity) return;

    // Pausar y limpiar cualquier contenido anterior (3D o Audio/Video)
    state.arEntities.forEach(entity => {
        if (entity.hasAttribute('gltf-model')) {
            stop360RotationAnimation(entity);
            toggleAnimation3D(entity, true);
            entity.setAttribute('touch-rotation', 'enabled', true);
            // Limpiar flags de carga para el gatekeeper
            delete entity.dataset.modelLoaded;
            if (entity.dataset.loadingStatusId) {
                 delete entity.dataset.loadingStatusId; // Limpiar ID de estado de carga
            }
            
            // Pausar audio/video asociado si existe
            if (entity.dataset.audioVideoId) {
                const audioAsset = state.audioVideoAssets[entity.dataset.audioVideoId];
                if (audioAsset) {
                    audioAsset.pause();
                    delete audioAsset.dataset.audioLoaded;
                }
            }
        }
    });

    showVideo(targetIndex, currentContentIndex);
    
    // --- Lógica para Videos (A-VIDEO / A-PLANE) ---
    if (currentEntity.tagName === 'A-VIDEO' || currentEntity.tagName === 'A-PLANE') {
        
        // ... (Lógica de video tradicional: Sin cambios, llama a showStatusMessage, usa oncanplay, etc.) ...
        
        let videoAssetId = currentEntity.getAttribute('id').replace('ar-video-', 'Elem-');
        
        if (currentEntity.tagName === 'A-VIDEO' && currentEntity.hasAttribute('src')) {
            videoAssetId = currentEntity.getAttribute('src').substring(1);
        }

        const currentVidAsset = document.querySelector(`#${videoAssetId}`); 
        const currentUrl = currentEntity.dataset.videoSrc; 
        
        if (!currentVidAsset) return; 

        // Pausa otros videos en todos los targets
        Object.values(videoRotationState).forEach(s => {
            Object.values(s.htmlVideos).forEach(v => {
                if (v !== currentVidAsset) {
                    v.pause();
                }
            });
        });

        if (currentEntity.tagName === 'A-PLANE' && currentEntity.hasAttribute('material')) {
            const currentMaterial = currentEntity.getAttribute('material');
            currentEntity.setAttribute('material', {...currentMaterial, src: `#${currentVidAsset.id}`});
        } else {
            currentEntity.setAttribute('src', `#${currentVidAsset.id}`);
        }
        
        let needsLoadingMessage = false;

        if (!currentVidAsset.dataset.loadedSrc || currentVidAsset.dataset.loadedSrc !== currentUrl) {
            needsLoadingMessage = true;
            
            loadTimer = setTimeout(() => {
                showStatusMessage("📦 Descargando contenido…");
            }, 1000); 

            currentVidAsset.src = currentUrl;
            currentVidAsset.load(); 
            currentVidAsset.dataset.loadedSrc = currentUrl; 

        } else {
            needsLoadingMessage = true; 

            loadTimer = setTimeout(() => {
                showStatusMessage("⏳ Cargando contenido…");
            }, 1000); 
        }
        
        if (needsLoadingMessage) {
            currentVidAsset.oncanplay = () => {
                if (loadTimer) {
                    clearTimeout(loadTimer);
                    loadTimer = null;
                }
                hideStatusBar();
                currentVidAsset.oncanplay = null; 
            };
        }

        currentVidAsset.muted = isGlobalAudioMuted; 
        currentVidAsset.onended = null; 
        
        currentVidAsset.play().catch(error => {
            console.warn("Fallo al intentar reproducir video. Causa común: Autoplay bloqueado.", error);
            if (loadTimer) {
                clearTimeout(loadTimer);
                loadTimer = null;
            }
            hideStatusBar();
        }); 
    
    // --- Lógica para Modelos 3D (Estático o Animado SIN audio asociado) ---
    } else if (currentEntity.hasAttribute('gltf-model') && !currentEntity.dataset.audioVideoId) { 
        
        // ... (Lógica de 3D simple: Sin cambios, usa model-loaded en initializeScene) ...
        
        if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
        }
        
        const loadingHandle = setTimeout(() => {
            showStatusMessage("⏳ Cargando modelo 3D..."); 
        }, 1000); 

        loadTimer = loadingHandle;
        currentEntity.dataset.loadingStatusId = loadTimer; 

        if (currentEntity.hasAttribute('animation-mixer')) {
            toggleAnimation3D(currentEntity, false); 
        }

    // --- Lógica para Modelos 3D con Audio Asociado (TIPO 3D+AUDIO) ---
    } else if (currentEntity.hasAttribute('gltf-model') && currentEntity.dataset.audioVideoId) {
        
        const audioAssetId = currentEntity.dataset.audioVideoId;
        const audioVideoAsset = state.audioVideoAssets[audioAssetId];
        
        if (!audioVideoAsset) return;

        // 1. Iniciar Mensaje de Carga (único)
        loadTimer = setTimeout(() => {
            showStatusMessage("🔄 Sincronizando: Descargando 3D y Audio..."); 
        }, 1000); 

        currentEntity.dataset.loadingStatusId = loadTimer; // Para limpiar si se pierde el target

        // 2. Carga del Modelo 3D
        // Usamos el listener model-loaded definido en initializeScene, pero re-asignamos la lógica aquí.
        const onModelLoadedHandler = () => {
            // Establecer el flag de modelo cargado
            currentEntity.dataset.modelLoaded = 'true';
            // Intentar iniciar el contenido (Gatekeeper)
            startContentGatekeeper(currentEntity, audioVideoAsset);
            currentEntity.removeEventListener('model-loaded', onModelLoadedHandler); // Limpiar listener one-time
        };
        currentEntity.addEventListener('model-loaded', onModelLoadedHandler);

        // Si el modelo ya está cargado (model-loaded ya se disparó o está en caché)
        if (currentEntity.components['gltf-model'] && currentEntity.components['gltf-model'].model) {
            // Disparar el handler manualmente
            onModelLoadedHandler();
        }

        // 3. Carga del Audio/Video
        const contentData = config.Targets[targetIndex].elementos[currentContentIndex];
        const currentUrl = contentData.audioSrc;
        
        let needsDownload = false;

        if (!audioVideoAsset.dataset.loadedSrc || audioVideoAsset.dataset.loadedSrc !== currentUrl) {
            needsDownload = true;
            audioVideoAsset.src = currentUrl;
            audioVideoAsset.load();
            audioVideoAsset.dataset.loadedSrc = currentUrl; 
        }
        
        // Definir el handler para cuando el audio/video esté listo
        const onAudioReady = () => {
            audioVideoAsset.dataset.audioLoaded = 'true';
            audioVideoAsset.muted = isGlobalAudioMuted; 
            startContentGatekeeper(currentEntity, audioVideoAsset);
            audioVideoAsset.oncanplay = null; // Limpiar listener one-time
        };

        // Si el video está precargado
        if (!needsDownload && audioVideoAsset.readyState >= 3) { // readyState 3: HAVE_FUTURE_DATA (suficiente para canplay)
             onAudioReady();
        } else {
             audioVideoAsset.oncanplay = onAudioReady;
        }

        // Si el modelo está animado, pausar hasta que el gatekeeper inicie
        if (currentEntity.hasAttribute('animation-mixer')) {
            toggleAnimation3D(currentEntity, true); 
        }
    }


    // === Control de botones 3D: Mostrar/Ocultar el contenedor ===
    const currentContentIs3D = currentEntity && currentEntity.hasAttribute('gltf-model');
    btn3DContainer.style.display = currentContentIs3D ? 'flex' : 'none';
}

// LÓGICA DE ROTACIÓN MANUAL (MODIFICADA)
function rotateVideoManually() {
    const state = videoRotationState[activeTargetIndex];
    
    const totalEntities = state.arEntities.length; 
    
    if (activeTargetIndex === null || totalEntities <= 1) return;
    
    if (loadTimer) {
        clearTimeout(loadTimer);
        loadTimer = null;
    }
    hideStatusBar();

    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // 1. Detener/Pausar el elemento actual
    
    // --- Lógica de Pausa para Video Tradicional ---
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
            currentVidAsset.oncanplay = null;
            currentVidAsset.dataset.loadedSrc = ""; 
            currentVidAsset.src = "";
            currentVidAsset.load();
        }
    // --- Lógica de Pausa para 3D (Simple o 3D+Audio) ---
    } else if (currentEntity.hasAttribute('gltf-model')) {
        
        // Pausar Mixer, detener 360, limpiar flags de carga
        stop360RotationAnimation(currentEntity);
        toggleAnimation3D(currentEntity, true); 
        currentEntity.setAttribute('touch-rotation', 'enabled', true); 
        if (currentEntity.dataset.loadingStatusId) {
            delete currentEntity.dataset.loadingStatusId;
        }
        delete currentEntity.dataset.modelLoaded;

        // Si es 3D+Audio, pausar el audio/video
        if (currentEntity.dataset.audioVideoId) {
            const audioAsset = state.audioVideoAssets[currentEntity.dataset.audioVideoId];
            if (audioAsset) {
                audioAsset.pause();
                audioAsset.currentTime = 0;
                audioAsset.oncanplay = null;
                audioAsset.dataset.loadedSrc = ""; 
                audioAsset.src = "";
                audioAsset.load();
                delete audioAsset.dataset.audioLoaded;
            }
        }
    }
    
    // 2. Determinar el siguiente índice
    const nextIndex = (currentIndex + 1) % totalEntities;
    
    // 3. Aplicar la visibilidad al siguiente elemento
    showVideo(activeTargetIndex, nextIndex);
    
    const nextEntity = state.arEntities[nextIndex];

    // === LÓGICA DE POSICIONAMIENTO DE STATUS BAR (NUEVO) ===
    const nextContentData = config.Targets[activeTargetIndex].elementos[nextIndex]; 
    const nextContentType = nextContentData.type; 

    let positionEnv = 'initial'; 
    if (nextContentType === 'video' || nextContentData.chromakey) { 
        positionEnv = 'video'; 
    } else if (nextContentType === '3d') {
        positionEnv = '3d'; 
    } else if (nextContentType === '3d+audio') {
        positionEnv = '3daudio'; 
    }
    
    setStatusPosition(positionEnv); // Establecer la nueva posición.
    // ======================================================

    // Lógica del Contenedor de Botones 3D al Rotar
    const nextContentIs3D = nextEntity && nextEntity.hasAttribute('gltf-model');
    
    btn3DContainer.style.display = nextContentIs3D ? 'flex' : 'none';
    
    // 4. Si el siguiente elemento es un contenido reproducible, comenzar
    if (nextEntity.tagName === 'A-VIDEO' || nextEntity.tagName === 'A-PLANE' || 
        (nextEntity.hasAttribute('gltf-model'))) { 
        playCurrentContent(activeTargetIndex);
    } 
}


// === FUNCIÓN DE RESET DEL MODELO 3D (BOTÓN) (MODIFICADA) ===
function resetActiveModelRotation() {
    if (activeTargetIndex === null) return;

    const state = videoRotationState[activeTargetIndex];
    const currentIndex = state.currentVideoIndex;
    const currentEntity = state.arEntities[currentIndex];

    // Verificar si es un modelo 3D
    if (currentEntity && currentEntity.tagName === 'A-ENTITY' && currentEntity.hasAttribute('gltf-model')) {
        
        // 1. Detener animación 360 antes de resetear
        stop360RotationAnimation(currentEntity); 
        
        // 2. Mostrar mensaje de estado por 2 segundos
        showStatusMessage("🔄 Reiniciando posición 3D…", 2000);
        
        // 3. Reutilizamos la función auxiliar (aplica resetState que va a la posición inicial y re-habilita touch-rotation)
        resetEntityState(currentEntity);
        
        // 4. Si está animado, reiniciamos la animación 
        if (currentEntity.hasAttribute('animation-mixer')) {
             // Si tiene audio asociado, pausar primero, luego el gatekeeper lo reanudará en playCurrentContent
             if (currentEntity.dataset.audioVideoId) {
                 toggleAnimation3D(currentEntity, true); // Pausar
                 // Necesitamos re-iniciar el audio también. Lo más seguro es llamar a playCurrentContent
                 // para reiniciar el proceso de sincronización y reproducción.
                 playCurrentContent(activeTargetIndex); 
             } else {
                 // 3D simple: Reanudar directamente
                 toggleAnimation3D(currentEntity, true); // Pausar
                 toggleAnimation3D(currentEntity, false); // Reanudar desde 0
             }
        } else if (currentEntity.dataset.audioVideoId) {
            // Si es 3D estático con audio, necesitamos re-iniciar el audio.
             playCurrentContent(activeTargetIndex); 
        }
    }
}
// =====================================

// === LÓGICA DE TRACKING Y EVENTOS ===
function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener("targetFound", () => {
        
        const state = videoRotationState[targetIndex];
        
        // ... (Lógica de Tiempo de Gracia) ...
        let shouldReset = true;
        const GRACE_PERIOD_MS = 3000;
        
        if (gracePeriodTimer) {
            clearTimeout(gracePeriodTimer);
            gracePeriodTimer = null;
        }

        const timeLost = state.lostTargetTimestamp;
        
        if (timeLost !== null) {
            const elapsed = Date.now() - timeLost;
            state.lostTargetTimestamp = null;

            if (elapsed < GRACE_PERIOD_MS) {
                shouldReset = false;
            }
        }
        
        // --- 2. Pausa Exhaustiva de OTROS Marcadores ---
        Object.values(videoRotationState).forEach(s => {
             if (s.targetIndex !== targetIndex) {
                 // Pausar videos tradicionales
                 Object.values(s.htmlVideos).forEach(v => {
                    v.pause();
                    v.currentTime = 0;
                    v.oncanplay = null;
                    v.src = "";
                    v.load();
                });
                
                s.arEntities.forEach(entity => {
                    if (entity.hasAttribute('gltf-model')) {
                        stop360RotationAnimation(entity); // Detener rotación 360
                        toggleAnimation3D(entity, true); 
                        if (entity.dataset.loadingStatusId) {
                            delete entity.dataset.loadingStatusId; // Limpiar cualquier ID de carga
                        }
                        // Limpiar flags de carga
                        delete entity.dataset.modelLoaded;
                        
                        // Pausar audio asociado si existe
                        if (entity.dataset.audioVideoId) {
                            const audioAsset = s.audioVideoAssets[entity.dataset.audioVideoId];
                            if (audioAsset) {
                                audioAsset.pause();
                                delete audioAsset.dataset.audioLoaded;
                            }
                        }
                    }
                });
             }
        });
        
        activeTargetIndex = targetIndex; 

        // --- 3. Aplicar Reset o Mantenimiento de Estado ---
        if (shouldReset) {
            state.currentVideoIndex = 0; 
            
            // Resetear videos tradicionales
            Object.values(state.htmlVideos).forEach(v => {
                v.pause();
                v.currentTime = 0; 
                v.oncanplay = null; 
                v.src = "";
                v.load();
            });
            
            // Resetear audios asociados
            Object.values(state.audioVideoAssets).forEach(v => {
                v.pause();
                v.currentTime = 0;
                v.oncanplay = null;
                v.src = "";
                v.load();
            });

            state.arEntities.forEach(entity => {
                if (entity.hasAttribute('gltf-model')) {
                    stop360RotationAnimation(entity); // Detener rotación 360
                    resetEntityState(entity); // Volver a posición inicial
                    toggleAnimation3D(entity, true); 
                }
            });
            showVideo(targetIndex, 0); 
        } else {
            // FIX 2A: LÓGICA DE REANUDACIÓN PARA CONTENIDO 3D/3D+AUDIO DURANTE EL TIEMPO DE GRACIA
            const currentContent = state.arEntities[state.currentVideoIndex];
            
            // MODIFICACIÓN: Comprobar si es un modelo 3D (simple o +audio)
            if (currentContent && currentContent.hasAttribute('gltf-model')) {
                
                // 1. Asegurar Visibilidad del 3D y Controles (Soluciona el problema de 3D simple)
                showVideo(targetIndex, state.currentVideoIndex);
                btn3DContainer.style.display = 'flex'; 

                // 2. Reanudar Animación 3D (si existe)
                if (currentContent.hasAttribute('animation-mixer')) {
                    toggleAnimation3D(currentContent, false); 
                }
            
                // 3. Reanudar Audio para 3D+Audio (si existe)
                if (currentContent.dataset.audioVideoId) {
                     const audioAsset = state.audioVideoAssets[currentContent.dataset.audioVideoId];
                     if (audioAsset) {
                         audioAsset.muted = isGlobalAudioMuted; // Asegurar estado del mute
                         audioAsset.play().catch(e => {
                             console.warn(`[3D+Audio] Fallo al reanudar audio en targetFound: ${e}`);
                         });
                     }
                }
            }
        }
        
        // --- 4. Lógica de UI (Contenedor 3D) ---
        const totalEntities = state.arEntities.length;
        if (totalEntities > 1) {
            btnNextVideo.style.display = 'flex';
        } else {
            btnNextVideo.style.display = 'none';
        }
        
        const currentContent = state.arEntities[state.currentVideoIndex];
        const currentContentIs3D = currentContent && currentContent.hasAttribute('gltf-model');
        
        btn3DContainer.style.display = currentContentIs3D ? 'flex' : 'none';
        
        // === LÓGICA DE POSICIONAMIENTO DE STATUS BAR (NUEVO) ===
        // Obtener el tipo de contenido que se va a mostrar/reproducir
        const currentContentData = config.Targets[targetIndex].elementos[state.currentVideoIndex];
        const contentType = currentContentData.type; 

        let positionEnv = 'initial'; // Entorno Inicial como fallback
        if (contentType === 'video' || currentContentData.chromakey) { 
            positionEnv = 'video'; // Entorno Video
        } else if (contentType === '3d') {
            positionEnv = '3d'; // Entorno 3D
        } else if (contentType === '3d+audio') {
            positionEnv = '3daudio'; // Entorno 3D+Audio
        }
        
        setStatusPosition(positionEnv); // Establecer la nueva posición.
        // ======================================================

        // --- 5. Iniciar Contenido (Video o 3D Animado) ---
        const isCurrentContentVideo = currentContent && 
            (currentContent.tagName === 'A-VIDEO' || 
             currentContent.tagName === 'A-PLANE'); 
        
        const isCurrentContent3D = currentContent && currentContent.hasAttribute('gltf-model');

        // FIX 2B: Solo llamar a playCurrentContent si hubo reset o si es un video.
        // Si es 3D sin reset (grace period), la lógica de visibilidad y audio ya fue reanudada manualmente en el bloque `else` (el 3D simple ya no necesita esta llamada).
        if (shouldReset || isCurrentContentVideo) {
             if (isCurrentContentVideo || isCurrentContent3D) {
                playCurrentContent(targetIndex); 
            }
        } 
    });

    targetEntity.addEventListener("targetLost", () => {
        
        // FIX 1B part 1: Limpiar el timer de carga global inmediatamente
        if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
        }
        hideStatusBar();
        
        // === LÓGICA DE POSICIONAMIENTO DE STATUS BAR (NUEVO) ===
        setStatusPosition('initial'); // Retornar a la posición inicial
        // ======================================================

        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';
            btn3DContainer.style.display = 'none'; // Ocultar contenedor 3D
        }
        
        const state = videoRotationState[targetIndex];
        const currentIndex = state.currentVideoIndex;
        const currentEntity = state.arEntities[currentIndex];

        // 1. Pausa de Contenido y Hard Reset de 3D
        
        // Pausa de videos tradicionales
        Object.values(state.htmlVideos).forEach(vid => {
            vid.pause();
        });
        
        // Pausa de audios asociados
        Object.values(state.audioVideoAssets).forEach(vid => {
            vid.pause();
        });
        
        if (currentEntity && currentEntity.hasAttribute('gltf-model')) {
             stop360RotationAnimation(currentEntity); // Detener rotación 360
             toggleAnimation3D(currentEntity, true); // Pausar mixer
             // FIX 1B part 2: Limpiar los flags y el ID del timer de carga
             if (currentEntity.dataset.loadingStatusId) {
                delete currentEntity.dataset.loadingStatusId; // Limpiar cualquier ID de carga
            }
             delete currentEntity.dataset.modelLoaded;
        }

        // 2. Establecer el Tiempo de Gracia
        state.lostTargetTimestamp = Date.now();
        
        const GRACE_PERIOD_MS = 3000;
        gracePeriodTimer = setTimeout(() => {
            
            // Hard Reset: Resetear videos
            Object.values(state.htmlVideos).forEach(vid => {
                vid.currentTime = 0; 
                vid.dataset.loadedSrc = ""; 
                vid.oncanplay = null; 
                vid.src = "";
                vid.load();
            });
            
            // Hard Reset: Resetear audios asociados
            Object.values(state.audioVideoAssets).forEach(vid => {
                vid.currentTime = 0;
                vid.dataset.loadedSrc = "";
                vid.oncanplay = null;
                vid.src = "";
                vid.load();
                delete vid.dataset.audioLoaded;
            });
            
            // Hard Reset: Resetear posición 3D a la inicial
            state.arEntities.forEach(entity => {
                if (entity.hasAttribute('gltf-model')) {
                    resetEntityState(entity); 
                }
            });

            state.lostTargetTimestamp = null;
            state.currentVideoIndex = 0;
            
        }, GRACE_PERIOD_MS); 

        // 3. Ocultar contenido
        state.arEntities.forEach(el => el.setAttribute('visible', false));
    });
}

// === LÓGICA DE LA INTERFAZ DE USUARIO (UI) ===
function initializeUIListeners() {
    
    showStatusMessage("📱 Iniciando experiencia AR…", 4000); 

    sceneEl.addEventListener("arReady", () => {
        
        hideStatusBar(); 

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

    safeQuerySelector("#btn-audio", 'Audio Button').addEventListener("click", function() {
        
        isGlobalAudioMuted = !isGlobalAudioMuted; 
        const targetMutedState = isGlobalAudioMuted; 

        Object.values(videoRotationState).forEach(state => {
            
            // Control de videos tradicionales
            Object.values(state.htmlVideos).forEach(v => {
                v.muted = targetMutedState; 
                if (!targetMutedState && activeTargetIndex === state.targetIndex && v.paused) {
                    v.play().catch(e => {
                        console.warn(`[Video] Fallo al intentar reanudar video al desmutear: ${e}`);
                    }); 
                }
            });
            
            // Control de audios asociados a 3D
            Object.values(state.audioVideoAssets).forEach(v => {
                v.muted = targetMutedState; 
                if (!targetMutedState && activeTargetIndex === state.targetIndex && v.paused) {
                     v.play().catch(e => {
                        console.warn(`[Audio 3D] Fallo al intentar reanudar audio al desmutear: ${e}`);
                    }); 
                }
            });
        });

        this.style.background = targetMutedState ? "var(--danger)" : "var(--accent)";
        this.innerHTML = targetMutedState ? "🔇 SILENCIO" : "🔊 SONIDO";
    });

    // LÓGICA DE TOGGLE UI: Ocultar/Mostrar controles y el contenedor 3D
    safeQuerySelector("#btn-toggle-ui", 'Toggle UI Button').addEventListener("click", () => {
        const isHidden = controls.classList.toggle("hidden");
        btn3DContainer.classList.toggle("hidden", isHidden); 
        statusBar.classList.toggle("hidden", isHidden); 
    });

    // Botón de Rotación Manual
    btnNextVideo.addEventListener("click", rotateVideoManually);

    // Botón de Reset 3D
    btnReset3D.addEventListener("click", resetActiveModelRotation);
    
    // Botón de Rotación 360 (NUEVO)
    btnRotate3D.addEventListener("click", start360Rotation);
    
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
