// main.js - Bloque Detección de Flash (Línea ~218)

// Detección de Flash
sceneEl.addEventListener("arReady", () => {
    
    // 🚨 CAMBIO CLAVE: Hacemos el botón visible inmediatamente, ya que AR está listo.
    btnFlash.style.display = "flex";
    
    const mindarComponent = sceneEl.components['mindar-image'];
    let track = null;

    if (mindarComponent && mindarComponent.stream) {
        try {
             track = mindarComponent.stream.getVideoTracks()[0]; 
        } catch (e) {
             console.warn("No se pudo obtener el track de video del stream:", e);
        }
    }
    
    if (track) {
        trackRef.track = track;
        let flashAvailable = false;
        
        try {
            flashAvailable = track.getCapabilities().torch || false;
        } catch (e) {
            console.warn("El dispositivo no soporta la capacidad 'torch' (flash).", e);
        }

        if (flashAvailable) {
            btnFlash.innerHTML = "⚡ FLASH OFF"; 
            btnFlash.disabled = false;
        } else {
            btnFlash.innerHTML = "❌ FLASH NO SOPORTADO";
            btnFlash.disabled = true;
        }
    } else {
        // Si no podemos obtener el track (lo que está sucediendo ahora),
        // simplemente mostramos el botón deshabilitado.
        console.warn("⚠️ No se pudo obtener el Track de video. Flash deshabilitado.");
        btnFlash.innerHTML = "❌ FLASH NO DISPONIBLE"; 
        btnFlash.disabled = true;
    }
});
