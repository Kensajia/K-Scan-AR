const JSON_PATH = './assets/IndexSet2.json'; 

// Variables globales esenciales
let sceneEl;
let controls;
// Referencia para el track de video, crucial para el flash
let trackRef = { track: null }; 
let btnFlash;
let btnNextVideo;
let targetContainer;
let assetsContainer;

let videoRotationState = {}; // Almacena el estado de rotación de videos por target
let config = null; // Almacena el JSON de configuración
let activeTargetIndex = null; // Índice del target actualmente detectado
let isGlobalAudioMuted = true; // Estado global del audio

// =======================================================
// === FUNCIONES DE UTILIDAD ===
// =======================================================

// Conversión de color para Chroma Key
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

// Función de utilidad para seleccionar elementos de forma segura
function safeQuerySelector(selector, name) {
    const el = document.querySelector(selector);
    if (!el) {
        console.error(`ERROR FATAL: El elemento UI '${name}' con selector '${selector}' no se encontró.`);
        // Devuelve un objeto simulado para evitar fallos
        return { addEventListener: () => {}, style: { display: 'none' }, innerHTML: `[FALTA ${name}]`, disabled: true, classList: { toggle: () => {} } };
    }
    return el;
}

// Inicializa los selectores de forma segura
function initializeSelectors() {
    sceneEl = safeQuerySelector('#scene-ar', 'Scene A-Frame');
    controls = safeQuerySelector("#ui-controls", 'UI Controls Container');
    btnFlash = safeQuerySelector("#btn-flash", 'Flash Button');
    btnNextVideo = safeQuerySelector("#btn-next-video", 'Next Video Button'); 
    targetContainer = safeQuerySelector("#target-container", 'Target Container');
    assetsContainer = safeQuerySelector("#assets-container", 'Assets Container');
}

// =======================================================
// === COMPONENTES DE A-FRAME ===
// =======================================================

// Componente para mantener el renderizado activo
AFRAME.registerComponent('keep-alive', {
    tick: function () {
        const scene = this.el.sceneEl; 
        if (scene && scene.renderer && scene.renderStarted && !scene.paused) {
            scene.renderer.render(scene.object3D, scene.camera);
        }
    }
});

// Componente para la rotación táctil de objetos 3D
AFRAME.registerComponent('touch-rotation', {
    init: function () {
        this.start = { x: 0, y: 0 };
        this.dragging = false;
        this.rotationY = 0;
        this.el.sceneEl.addEventListener('touchstart', this.handleStart.bind(this));
        this.el.sceneEl.addEventListener('touchmove', this.handleMove.bind(this));
        this.el.sceneEl.addEventListener('touchend', this.handleEnd.bind(this));
    },

    handleStart: function (evt) {
        if (evt.touches.length === 1) {
            this.dragging = true;
            this.start.x = evt.touches[0].clientX;
            this.rotationY = this.el.getAttribute('rotation').y;
        }
    },

    handleMove: function (evt) {
        if (!this.dragging || evt.touches.length !== 1) return;
        const deltaX = evt.touches[0].clientX - this.start.x;
        // Sensibilidad de rotación
        this.el.setAttribute('rotation', `0 ${this.rotationY + deltaX * 0.2} 0`);
    },

    handleEnd: function () {
        this.dragging = false;
    },

    remove: function() {
        this.el.sceneEl.removeEventListener('touchstart', this.handleStart);
        this.el.sceneEl.removeEventListener('touchmove', this.handleMove);
        this.el.sceneEl.removeEventListener('touchend', this.handleEnd);
    }
});

// === CORRECCIÓN CLAVE 1: Componente Doble Toque (Pantalla Completa) ===
AFRAME.registerComponent('video-double-tap-toggle', {
    init: function () {
        this.lastTap = 0;
        this.isDetached = false;
        
        // Inicialización de valores de respaldo
        this.originalPosition = this.el.getAttribute('position') || { x: 0, y: 0, z: 0 };
        this.originalScale = this.el.getAttribute('scale') || { x: 1, y: 1, z: 1 };
        this.originalRotation = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
        
        // Obtener el ID del asset de video HTML
        let videoAssetId = '';
        if (this.el.tagName === 'A-VIDEO' || this.el.tagName === 'A-PLANE') {
            const srcAttr = this.el.getAttribute('src');
            const matAttr = this.el.getAttribute('material');
            // Busca la fuente en 'src' o en 'material.src'
            const src = srcAttr && srcAttr.startsWith('#') ? srcAttr : (matAttr && matAttr.src && matAttr.src.startsWith('#') ? matAttr.src : null);
            if (src) {
                videoAssetId = src.substring(1);
            }
        }
        this.videoAsset = document.querySelector(`#${videoAssetId}`);

        this.handleTap = this.handleTap.bind(this);
        this.el.addEventListener('click', this.handleTap); // Usamos 'click' para la detección de A-Frame
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
        
        const mindarTargetComponent = targetParent.components['mindar-image-target'];

        if (activeTargetIndex === null || !targetParent || !mindarTargetComponent) return; 

        this.isDetached = !this.isDetached;

        if (this.isDetached) {
            // DESANCLAR (PANTALLA COMPLETA)
            
            this.originalPosition = videoEl.getAttribute('position');
            this.originalScale = videoEl.getAttribute('scale');
            this.originalRotation = videoEl.getAttribute('rotation');
            
            videoEl.setAttribute('position', '0 0 -1.5'); 
            videoEl.setAttribute('scale', '2 2 1'); 
            videoEl.setAttribute('rotation', '0 0 0'); 
            
            // Pausar el seguimiento del marcador (lo mantiene fijo)
            mindarTargetComponent.pause(); 

            if(btnNextVideo) btnNextVideo.style.display = 'none';

            if (this.videoAsset) {
                this.videoAsset.muted = false; 
                if (this.videoAsset.paused) {
                    this.videoAsset.play().catch(e => console.warn("Fallo al reanudar video en desanclaje:", e));
                }
            }

        } else {
            // REANCLAR
            
            videoEl.setAttribute('position', this.originalPosition);
            videoEl.setAttribute('scale', this.originalScale);
            videoEl.setAttribute('rotation', this.originalRotation);
            
            // Reanudar el seguimiento del marcador
            mindarTargetComponent.play();
            
            const state = videoRotationState[activeTargetIndex];
            if (state && state.arEntities.length > 1) {
                if(btnNextVideo) btnNextVideo.style.display = 'flex';
            }

            if (this.videoAsset) {
                this.videoAsset.muted = isGlobalAudioMuted;
                if (isGlobalAudioMuted) {
                    this.videoAsset.pause();
                }
            }
        }
    },

    remove: function() {
        this.el.removeEventListener('click', this.handleTap);
    }
});

// =======================================================
// === LÓGICA DE ESCENA, AR Y CONTENIDO ===
// =======================================================

// Muestra la entidad de video correcta según el índice de rotación
function showVideo(targetIndex, contentIndex) {
    const state = videoRotationState[targetIndex];
    if (!state) return;

    // Ocultar todas las entidades
    state.arEntities.forEach(entity => entity.setAttribute('visible', false));

    // Mostrar solo la entidad activa
    const activeEntity = state.arEntities[contentIndex];
    if (activeEntity) {
        activeEntity.setAttribute('visible', true);
        playCurrentVideo(targetIndex);
    }
}

// Controla la reproducción y el mute de los videos
function playCurrentVideo(targetIndex) {
    const state = videoRotationState[targetIndex];
    if (!state || !state.videoAssets) return;
    
    // El índice activo es el que se está mostrando
    const contentIndex = state.activeIndex; 
    const activeVideo = state.videoAssets[contentIndex];

    if (activeVideo) {
        activeVideo.currentTime = 0; // Reiniciar
        activeVideo.muted = isGlobalAudioMuted;
        
        if (!isGlobalAudioMuted) {
            activeVideo.play().catch(e => console.error("Error al reproducir video:", e));
        } else {
            activeVideo.pause();
        }
    }
}

// Lógica del botón de rotación manual
function rotateVideoManually() {
    if (activeTargetIndex !== null) {
        const state = videoRotationState[activeTargetIndex];
        if (state && state.arEntities.length > 1) {
            state.activeIndex = (state.activeIndex + 1) % state.arEntities.length;
            showVideo(activeTargetIndex, state.activeIndex);
        }
    }
}

// Inicia la reproducción del audio 3D (Si aplica)
function startAudio3D(audioEntity, targetIndex, isGlobalAudioMuted) {
    const audioEl = audioEntity.components.sound.pool.children[0].srcEl; 
    if (!audioEl) return;

    if (isGlobalAudioMuted) {
        audioEl.pause();
        audioEl.muted = true;
    } else {
        audioEl.muted = false;
        audioEl.play().catch(e => console.error("Error al reproducir audio:", e));
    }
}

// Configura los eventos de seguimiento (Found/Lost)
function setupTrackingEvents(targetIndex, targetEntity) {
    targetEntity.addEventListener('targetFound', () => {
        activeTargetIndex = targetIndex;
        const state = videoRotationState[targetIndex];

        // Mostrar u ocultar el botón de rotación si hay más de un video
        btnNextVideo.style.display = (state && state.arEntities.length > 1) ? 'flex' : 'none';

        // Asegurar que el video actual se reproduzca/mutee correctamente
        showVideo(targetIndex, state.activeIndex);
    });

    targetEntity.addEventListener('targetLost', () => {
        if (activeTargetIndex === targetIndex) {
            activeTargetIndex = null;
            btnNextVideo.style.display = 'none';

            // Pausar todos los videos y audios de este target
            const state = videoRotationState[targetIndex];
            state.videoAssets.forEach(v => {
                v.pause();
                v.currentTime = 0;
            });
            if (state.audioEntities) {
                state.audioEntities.forEach(a => {
                    const audioEl = a.components.sound.pool.children[0].srcEl;
                    if (audioEl) audioEl.pause();
                });
            }
        }
    });
}

// Carga la configuración JSON y construye la escena AR
async function loadConfig() {
    try {
        const response = await fetch(JSON_PATH);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
        initializeScene();
    } catch (error) {
        console.error("Fallo al cargar la configuración JSON:", error);
        alert("Error al cargar la configuración de la experiencia AR.");
    }
}

// Construcción dinámica de la escena A-Frame
function initializeScene() {
    if (!config || !config.targets) return;

    config.targets.forEach((targetData, targetIndex) => {
        
        // Inicializar el estado de rotación para este target
        videoRotationState[targetIndex] = {
            activeIndex: 0,
            arEntities: [],
            videoAssets: [],
            audioEntities: []
        };

        const state = videoRotationState[targetIndex];

        // 1. Crear a-entity (Target Container)
        const targetEntity = document.createElement('a-entity');
        targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

        targetData.contents.forEach((content, contentIndex) => {
            
            // 2. Crear Asset de Video (si es un video)
            if (content.type === 'video' || content.type === 'chroma-video') {
                const videoId = `video-${targetIndex}-${contentIndex}`;
                
                const videoAsset = document.createElement('video');
                videoAsset.setAttribute('id', videoId);
                videoAsset.setAttribute('src', content.src);
                videoAsset.setAttribute('preload', 'auto');
                videoAsset.setAttribute('loop', content.loop !== false); // Por defecto loop: true
                videoAsset.setAttribute('crossorigin', 'anonymous');
                videoAsset.setAttribute('playsinline', true);
                videoAsset.setAttribute('muted', true);
                
                assetsContainer.appendChild(videoAsset);
                state.videoAssets.push(videoAsset);

                // 3. Crear Entidad AR (a-plane o a-video)
                const arEntity = document.createElement('a-plane');
                
                arEntity.setAttribute('position', content.position || '0 0 0');
                arEntity.setAttribute('scale', content.scale || '1 1 1');
                arEntity.setAttribute('rotation', content.rotation || '0 0 0');
                
                // Configurar material (chroma key o normal)
                if (content.type === 'chroma-video' && content.chromaColor) {
                    const normalizedColor = hexToNormalizedRgb(content.chromaColor);
                    arEntity.setAttribute('material', `shader: chromakey; src: #${videoId}; color: ${normalizedColor};`);
                } else {
                    arEntity.setAttribute('material', `src: #${videoId};`);
                }

                // Agregar componentes interactivos
                arEntity.setAttribute('touch-rotation', '');
                arEntity.setAttribute('video-double-tap-toggle', ''); // Implementación de doble toque
                arEntity.setAttribute('visible', contentIndex === 0); // Solo la primera es visible inicialmente

                targetEntity.appendChild(arEntity);
                state.arEntities.push(arEntity);
            } 
            // 4. Crear Asset de Audio 3D (si es un audio)
            else if (content.type === 'audio') {
                const audioId = `audio-${targetIndex}-${contentIndex}`;
                
                const audioAsset = document.createElement('audio');
                audioAsset.setAttribute('id', audioId);
                audioAsset.setAttribute('src', content.src);
                audioAsset.setAttribute('preload', 'auto');
                audioAsset.setAttribute('loop', content.loop !== false);
                audioAsset.setAttribute('crossorigin', 'anonymous');
                
                assetsContainer.appendChild(audioAsset);

                // Crear Entidad de Audio (sound component)
                const audioEntity = document.createElement('a-entity');
                audioEntity.setAttribute('position', content.position || '0 0 0');
                audioEntity.setAttribute('sound', `src: #${audioId}; volume: 1; loop: ${content.loop !== false}; rolloffFactor: 1; distanceModel: inverse;`);
                
                targetEntity.appendChild(audioEntity);
                state.audioEntities.push(audioEntity);
            }
            // Puedes expandir con más tipos (modelos 3D, imágenes...)
        });

        // 5. Configurar eventos de seguimiento
        setupTrackingEvents(targetIndex, targetEntity);
        targetContainer.appendChild(targetEntity);
    });

    // Reproducir los videos inicialmente si no hay audio global mudo
    if (!isGlobalAudioMuted) {
        Object.keys(videoRotationState).forEach(targetIndex => {
            playCurrentVideo(parseInt(targetIndex));
        });
    }
}

// =======================================================
// === LÓGICA DE INTERFAZ DE USUARIO (UI) ===
// =======================================================

// === CORRECCIÓN CLAVE 2: Lógica de Inicialización de UI (FLASH) ===
function initializeUIListeners() {
    
    // Espera a que la realidad aumentada esté lista para obtener el stream
    sceneEl.addEventListener("arReady", () => {
        
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;
        let flashAvailable = false;

        // 1. OBTENER el track de video de la cámara (Método más confiable con MindAR)
        if (mindarComponent && mindarComponent.getCameraStream) {
            const stream = mindarComponent.getCameraStream();
            if (stream) {
                // El track de video es el primero en la lista
                track = stream.getVideoTracks()[0]; 
            }
        }
        
        if (track) {
            trackRef.track = track;
            
            // 2. Comprobar la capacidad 'torch'
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
                btnFlash.style.display = "none";
            }
        } else {
            console.warn("⚠️ No se pudo obtener el Track de video. Flash deshabilitado e invisible.");
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

    // Lógica de click del botón de flash
    btnFlash.addEventListener("click", function() {
        if (trackRef.track && !this.disabled) {
            const settings = trackRef.track.getSettings();
            const isCurrentlyOn = settings.torch || false; 

            // Alternar el estado del flash
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
        this.style.background = isGlobalAudioMuted ? "var(--danger)" : "var(--accent)";
        this.innerHTML = isGlobalAudioMuted ? "🔇 SILENCIO" : "🔊 SONIDO";

        // Iterar sobre todos los videos y audios para aplicar el nuevo estado
        Object.keys(videoRotationState).forEach(targetIndex => {
            const state = videoRotationState[targetIndex];
            
            // Videos
            if (state.videoAssets && state.videoAssets.length > 0) {
                const activeVideo = state.videoAssets[state.activeIndex];
                if (activeVideo) {
                    activeVideo.muted = isGlobalAudioMuted;
                    if (!isGlobalAudioMuted) {
                        // Solo reproducir si el target está visible
                        if (activeTargetIndex === parseInt(targetIndex)) {
                            activeVideo.play().catch(e => console.error("Fallo al reanudar video:", e));
                        }
                    } else {
                        activeVideo.pause();
                    }
                }
            }

            // Audios 3D
            if (state.audioEntities) {
                state.audioEntities.forEach(audioEntity => {
                    if (activeTargetIndex === parseInt(targetIndex)) {
                        startAudio3D(audioEntity, parseInt(targetIndex), isGlobalAudioMuted);
                    }
                });
            }
        });
    });

    // LÓGICA DE TOGGLE UI
    safeQuerySelector("#btn-toggle-ui", 'Toggle UI Button').addEventListener("click", () => {
        controls.classList.toggle("hidden");
    });

    // Botón de Rotación Manual
    btnNextVideo.addEventListener("click", rotateVideoManually);

    // Botón de Calidad
    safeQuerySelector("#btn-hd", 'HD Button').addEventListener("click", function() {
        // Lógica para cambiar la calidad (Ejemplo: cambiar atributo del renderizador)
        const currentRenderer = sceneEl.getAttribute('renderer');
        const newQuality = currentRenderer.antialias === true ? false : true; 
        
        sceneEl.setAttribute('renderer', `preserveDrawingBuffer: true; antialias: ${newQuality}; colorManagement: true`);
        this.innerHTML = newQuality ? "📺 CALIDAD: HD" : "📺 CALIDAD: BAJA";
    });
}


// =======================================================
// === PUNTO DE ENTRADA PRINCIPAL ===
// =======================================================

// 1. Inicializa los selectores inmediatamente
initializeSelectors();

// 2. Ejecutar la carga del JSON y la inicialización de la UI después de que el DOM esté cargado.
document.addEventListener('DOMContentLoaded', () => {
    initializeUIListeners();
    loadConfig(); 
});
