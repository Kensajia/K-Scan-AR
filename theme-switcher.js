// --- FUNCIONES DE AYUDA PARA INTERPOLACIÓN ---

// Convierte Hexadecimal a RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

// Interpola entre dos valores numéricos (a, b) basándose en un factor (f)
function interpolate(a, b, f) {
    return Math.round(a + (b - a) * f);
}

// Interpola entre dos colores RGB y devuelve el nuevo color rgb()
function interpolateColor(color1Hex, color2Hex, factor) {
    const rgb1 = hexToRgb(color1Hex);
    const rgb2 = hexToRgb(color2Hex);

    const r = interpolate(rgb1[0], rgb2[0], factor);
    const g = interpolate(rgb1[1], rgb2[1], factor);
    const b = interpolate(rgb1[2], rgb2[2], factor);

    // Asegura que los extremos del factor (0 o 1) devuelvan el color exacto
    if (factor <= 0.01) return `rgb(${rgb1[0]}, ${rgb1[1]}, ${rgb1[2]})`;
    if (factor >= 0.99) return `rgb(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]})`;

    return `rgb(${r}, ${g}, ${b})`;
}
// ----------------------------------------------------


document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('page-404');
    const indicator = document.getElementById('time-indicator');
    const now = new Date();
    const currentHour = now.getHours(); 
    const currentMinute = now.getMinutes(); 
    const timeDecimal = currentHour + (currentMinute / 60);

    // Paleta de Colores Dinámicos y Puntos de Transición
    const colorStops = [
        { time: 4.5, top: '#1A237E', bottom: '#1A237E', theme: 'theme-night' }, // 04:30 AM (Noche Profunda)
        { time: 6.0, top: '#FF7043', bottom: '#FFEE58', theme: 'theme-dawn' },  // 06:00 AM (Amanecer, Inicio del Movimiento)
        { time: 8.0, top: '#81D4FA', bottom: '#E1F5FE', theme: 'theme-day' },   // 08:00 AM (Día, Fin del Movimiento)
        { time: 17.0, top: '#81D4FA', bottom: '#E1F5FE', theme: 'theme-day' },  // 17:00 PM (Día, Fin)
        { time: 19.0, top: '#E91E63', bottom: '#FF9800', theme: 'theme-dusk' }, // 19:00 PM (Atardecer, Inicio del Movimiento)
        { time: 21.0, top: '#1A237E', bottom: '#1A237E', theme: 'theme-night' },// 21:00 PM (Noche, Fin del Movimiento)
        // Punto de cierre para el ciclo de 24 horas
        { time: 28.5, top: '#1A237E', bottom: '#1A237E', theme: 'theme-night' },// 28.5 (4.5 + 24)
    ];

    let startStop = colorStops[0];
    let endStop = colorStops[colorStops.length - 1];
    let currentThemeClass = 'theme-night';

    // Ajustar el tiempo para manejar el cruce de medianoche (ej: 21:00 a 04:30 del día siguiente)
    let adjustedTime = timeDecimal;
    if (adjustedTime < 4.5) { 
        adjustedTime += 24; 
    }
    
    // Encontrar el tramo de color actual
    for (let i = 0; i < colorStops.length - 1; i++) {
        let startTime = colorStops[i].time;
        let endTime = colorStops[i + 1].time;
        
        if (endTime < startTime) {
            endTime += 24; 
        }

        if (adjustedTime >= startTime && adjustedTime < endTime) {
            startStop = colorStops[i];
            endStop = colorStops[i + 1];
            currentThemeClass = startStop.theme;
            break;
        }
    }
    
    // --- Calcular el Factor de Interpolación (0 a 1) ---
    const startTime = startStop.time;
    let endTime = endStop.time;
    if (endTime < startTime) {
        endTime += 24;
    }

    const duration = endTime - startTime;
    const elapsed = adjustedTime - startTime;
    let factor = duration > 0 ? elapsed / duration : 0; 
    factor = Math.max(0, Math.min(1, factor)); // Asegura que esté entre 0 y 1

    // --- 1. Aplicar Color de Fondo (Gradiente Dinámico) ---
    const topColor = interpolateColor(startStop.top, endStop.top, factor);
    const bottomColor = interpolateColor(startStop.bottom, endStop.bottom, factor);

    const gradient = `linear-gradient(to top, ${bottomColor}, ${topColor})`;
    body.style.backgroundImage = gradient;
    
    // Aplicar la clase del tema para el color del texto y elementos
    body.classList.add(currentThemeClass);
    
    // --- 2. Lógica del Movimiento Suave del Sol/Luna ---
    if (indicator) {
        if (currentThemeClass === 'theme-dawn') {
            // Amanecer (Sol sube: de 100vh a 0)
            const sunPosition = (1 - factor) * 100; // Va de 100 (abajo) a 0 (arriba)
            indicator.style.transform = `translateY(${sunPosition}vh)`;
            indicator.style.display = 'block';

        } else if (currentThemeClass === 'theme-dusk') {
            // Atardecer (Sol baja: de 0 a 100vh)
            const sunPosition = factor * 100; // Va de 0 (arriba) a 100 (abajo)
            indicator.style.transform = `translateY(${sunPosition}vh)`;
            indicator.style.display = 'block';

        } else if (currentThemeClass === 'theme-night') {
            // Luna: Posición fija (utiliza el CSS `top: 5%`)
            indicator.style.transform = 'translateY(0)'; 
            indicator.style.display = 'block'; 
        } else {
             // Esconder el indicador (Nube solo necesita la animación flotante)
            indicator.style.display = 'none'; 
        }
    }


    // --- 3. Generación de Estrellas (Solo en Noche/Amanecer) ---
    if (currentThemeClass === 'theme-night' || currentThemeClass === 'theme-dawn') {
        const STAR_COUNT = 80; 
        const container = document.body;

        // Si no hay estrellas, las crea
        if (container.querySelectorAll('.star').length === 0) {
            for (let i = 0; i < STAR_COUNT; i++) {
                const star = document.createElement('div');
                star.classList.add('star');

                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                
                star.style.left = `${x}px`;
                star.style.top = `${y}px`;
                star.style.animationDelay = `${Math.random() * 4}s`; 

                container.appendChild(star);
            }
        }
    } else {
        // Eliminar estrellas
        document.querySelectorAll('.star').forEach(star => star.remove());
    }
});
