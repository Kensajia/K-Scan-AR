document.addEventListener("DOMContentLoaded", function() {
    const JSON_PATH = './IndexSet2.json';
    const sceneEl = document.querySelector('a-scene');
    const controls = document.querySelector("#ui-controls");
    const trackRef = { track: null };
    const btnFlash = document.querySelector("#btn-flash");
    const btnNextVideo = document.querySelector("#btn-next-video");
    const targetContainer = document.querySelector("#target-container");
    const assetsContainer = document.querySelector("#assets-container");
    
    // Video Rotation State: Objeto para manejar el estado de cada marcador
    let videoRotationState = {}; 
    let config = null; 

    // Variable para rastrear qué marcador está actualmente visible para la rotación manual
    let activeTargetIndex = null;

    // Componente custom para mantener el renderizado activo
    AFRAME.registerComponent('keep-alive', {
        tick: function () {
            if (this.el.sceneEl.renderStarted && !this.el.sceneEl.paused) {
                this.el.sceneEl.renderer.render(this.el.sceneEl.object3D, this.el.sceneEl.camera);
            }
        }
    });
    
    // === FUNCIONES DE INICIALIZACIÓN ===

    async function loadConfig() {
        try {
            const response = await fetch(JSON_PATH);
            config = await response.json();
            initializeScene();
        } catch (error) {
            console.error("Error al cargar la configuración JSON:", error);
            alert("No se pudo cargar la configuración de videos. Revisa la ruta JSON.");
        }
    }

    function initializeScene() {
        const { MindARConfig, Targets } = config; 
        
        // 1. Configurar A-Scene con JSON
        const mindarAttrs = 
            `imageTargetSrc: ${MindARConfig.imageTargetSrc}; ` +
            `maxTrack: ${MindARConfig.maxTrack}; ` +
            `filterMinCF: ${MindARConfig.filterMinCF}; ` +
            `filterBeta: ${MindARConfig.filterBeta}`;
        sceneEl.setAttribute('mindar-image', mindarAttrs);

        // 2. Iterar sobre CADA MARCADOR para crear sus videos y estados
        Targets.forEach(target => {
            const { targetIndex, videos } = target;
            
            // Inicializar el estado de rotación para este marcador
            videoRotationState[targetIndex] = {
                currentVideoIndex: 0,
                htmlVideos: [],
                arVideos: [],
                numVideos: videos.length
            };

            // 3. Crear la entidad MindAR Target
            const targetEntity = document.createElement('a-entity');
            targetEntity.setAttribute('id', `target-${targetIndex}`);
            targetEntity.setAttribute('mindar-image-target', `targetIndex: ${targetIndex}`);

            // 4. Crear los elementos <video> y <a-video> para ESTE MARCADOR
            videos.forEach((videoData, index) => {
                // Elemento <video> en <a-assets>
                const videoAsset = document.createElement('video');
                videoAsset.setAttribute('id', videoData.id);
                videoAsset.setAttribute('src', videoData.src);
                videoAsset.setAttribute('loop', 'true');
                videoAsset.setAttribute('playsinline', 'true');
                videoAsset.setAttribute('webkit-playsinline', 'true');
                videoAsset.setAttribute('muted', 'muted');
                videoAsset.setAttribute('crossorigin', 'anonymous');
                assetsContainer.appendChild(videoAsset);
                
                // Elemento <a-video> (entidad AR)
                const videoEntity = document.createElement('a-video');
                videoEntity.setAttribute('id', `ar-video-${targetIndex}-${index}`);
                videoEntity.setAttribute('src', `#${videoData.id}`);
                
                // Usar dimensiones específicas del video
                videoEntity.setAttribute('width', videoData.width);
                videoEntity.setAttribute('height', videoData.height);
                
                videoEntity.setAttribute('visible', index === 0); // Solo el primer video visible

                targetEntity.appendChild(videoEntity);
                
                // Almacenar referencias en el estado del marcador
                videoRotationState[targetIndex].htmlVideos.push(videoAsset);
                videoRotationState[targetIndex].arVideos.push(videoEntity);
            });
            
            targetContainer.appendChild(targetEntity);
            
            // 5. Asignar Eventos de Tracking a CADA MARCADOR
            setupTrackingEvents(targetIndex, targetEntity);
        });
    }
    
    // === LÓGICA DE ROTACIÓN DE VIDEOS ===

    function showVideo(targetIndex, videoIndex) {
        const state = videoRotationState[targetIndex];
        
        // 1. Oculta todos los videos de ESTE MARCADOR
        state.arVideos.forEach((vidEl, i) => {
            vidEl.setAttribute('visible', i === videoIndex);
        });

        // 2. Actualiza el índice en el estado de ESTE MARCADOR
        state.currentVideoIndex = videoIndex;
    }

    function playCurrentVideo(targetIndex) {
        const state = videoRotationState[targetIndex];
        const currentVidAsset = state.htmlVideos[state.currentVideoIndex];

        // 1. Asegurarse de que el video sea visible
        showVideo(targetIndex, state.currentVideoIndex);

        // 2. Lógica de Rotación Automática al finalizar (si tiene más de un video)
        if (state.numVideos > 1) {
             currentVidAsset.onended = () => {
                // Solo rota si el marcador sigue visible
                const isTracking = sceneEl.components['mindar-image'].data.trackedTargetIndex === targetIndex;

                if (isTracking) {
                    const nextIndex = (state.currentVideoIndex + 1) % state.numVideos;
                    
                    // Detiene el video actual antes de cambiar
                    currentVidAsset.currentTime = 0;

                    showVideo(targetIndex, nextIndex); // Muestra el siguiente
                    playCurrentVideo(targetIndex);    // Reproduce el siguiente
                } else {
                    currentVidAsset.onended = null;
                }
            };
        } else {
            currentVidAsset.onended = null;
        }


        // 3. Reproducir (y manejar promesas de reproducción)
        currentVidAsset.play().catch(error => {
            // Este catch es común, puede ignorarse si el usuario no ha interactuado.
        });
    }

    function rotateVideoManually() {
        // Solo rota si HAY un marcador activo y si ese marcador tiene más de un video
        const state = videoRotationState[activeTargetIndex];
        if (activeTargetIndex === null || state.numVideos <= 1) return;
        
        // Pausa y resetea el video actual
        const currentVidAsset = state.htmlVideos[state.currentVideoIndex];
        currentVidAsset.pause();
        currentVidAsset.currentTime = 0;
        currentVidAsset.onended = null; // Quita el evento de rotación automática

        // Calcula el siguiente video
        const nextIndex = (state.currentVideoIndex + 1) % state.numVideos;
        
        // Muestra y reproduce el nuevo video
        showVideo(activeTargetIndex, nextIndex);
        playCurrentVideo(activeTargetIndex);
    }
    
    // === LÓGICA DE TRACKING Y EVENTOS ===

    function setupTrackingEvents(targetIndex, targetEntity) {
        targetEntity.addEventListener("targetFound", () => {
            // Establece el marcador actual para rotación manual
            activeTargetIndex = targetIndex; 
            
            // Si el marcador tiene más de un video, muestra el botón de rotación
            if (videoRotationState[targetIndex].numVideos > 1) {
                btnNextVideo.style.display = 'flex';
            } else {
                btnNextVideo.style.display = 'none';
            }
            
            playCurrentVideo(targetIndex);
        });

        targetEntity.addEventListener("targetLost", () => {
            // Si el marcador perdido es el activo, oculta el botón de rotación
            if (activeTargetIndex === targetIndex) {
                activeTargetIndex = null;
                btnNextVideo.style.display = 'none';
            }
            
            // Pausa y resetea todos los videos de ESTE MARCADOR para liberar recursos
            const state = videoRotationState[targetIndex];
            state.htmlVideos.forEach(vid => {
                vid.pause();
                vid.currentTime = 0;
                vid.onended = null; // Quita el evento de rotación automática
            });
            // Oculta todas las entidades de video de este target
            state.arVideos.forEach(el => el.setAttribute('visible', false));
            
            // IMPORTANTE: Asegúrate de que el primer video de ESTE target sea visible para la próxima detección
            showVideo(targetIndex, 0);
        });
    }
    
    // === LÓGICA DE UI Y FLASH ===
    
    // Detección de Flash
    sceneEl.addEventListener("arReady", () => {
        const mindarComponent = sceneEl.components['mindar-image'];
        let track = null;

        if (mindarComponent && mindarComponent.getCameraStream) {
            const stream = mindarComponent.getCameraStream();
            if (stream) {
                track = stream.getVideoTracks()[0];
            }
        }
        
        // Si el track existe, configura el flash
        if (track) {
            trackRef.track = track;
            const flashAvailable = track.getCapabilities().torch;

            btnFlash.style.display = "flex"; 
            if (flashAvailable) {
                btnFlash.innerHTML = "⚡ FLASH OFF"; 
                btnFlash.disabled = false;
            } else {
                btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
                btnFlash.disabled = true;
            }

        } else {
            console.error("🔴 CÁMARA NO DETECTADA");
            btnFlash.style.display = "flex";
            btnFlash.innerHTML = "🔴 CÁMARA NO DETECTADA";
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
            });
        }
    });

    // LÓGICA DE AUDIO GLOBAL
    document.querySelector("#btn-audio").addEventListener("click", function() {
        // Usamos el estado del primer video del primer marcador como referencia
        const state0 = videoRotationState[0];
        const isCurrentlyMuted = state0 && state0.htmlVideos[0] ? state0.htmlVideos[0].muted : true;

        // Itera sobre TODOS los videos de TODOS los marcadores
        Object.values(videoRotationState).forEach(state => {
            state.htmlVideos.forEach(v => {
                v.muted = !isCurrentlyMuted;
                if (!v.muted && v.paused) v.play();
            });
        });

        this.style.background = !isCurrentlyMuted ? "var(--danger)" : "var(--accent)";
        this.innerHTML = isCurrentlyMuted ? "🔊 SONIDO" : "🔇 SILENCIO";
    });

    document.querySelector("#btn-toggle-ui").addEventListener("click", () => {
        controls.classList.toggle("hidden");
    });
    
    // Botón de Rotación Manual
    btnNextVideo.addEventListener("click", rotateVideoManually);

    // Botón de Calidad (Inicia en SD)
    document.querySelector("#btn-hd").addEventListener("click", function() {
        const isSD = this.innerHTML.includes("SD");
        this.innerHTML = isSD ? "📺 CALIDAD: HD" : "📺 CALIDAD: SD";
        
        // antialias: true es HD, antialias: false es SD (mejora el rendimiento)
        const antialiasValue = isSD ? 'true' : 'false';
        
        sceneEl.setAttribute('renderer', `preserveDrawingBuffer: true; antialias: ${antialiasValue}; colorManagement: true`);
    });


    // --- INICIO DEL CÓDIGO ---
    loadConfig();

});
