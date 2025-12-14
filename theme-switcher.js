document.addEventListener('DOMContentLoaded', (event) => {
    const body = document.getElementById('page-404');
    const now = new Date();
    const currentHour = now.getHours(); 
    const currentMinute = now.getMinutes(); 
    // Calcula la hora como un número decimal (ej: 19:30 se convierte en 19.5)
    const timeDecimal = currentHour + (currentMinute / 60);

    let themeClass;

    // --- Lógica del Ciclo Día-Noche con precisión de minutos ---
    // Usamos valores decimales para los límites de tiempo 

    if (timeDecimal >= 5.0 && timeDecimal < 7.0) {
        // Amanecer: 05:00 a 06:59:59
        themeClass = 'theme-dawn'; 
    } else if (timeDecimal >= 7.0 && timeDecimal < 17.0) {
        // Día: 07:00 a 16:59:59
        themeClass = 'theme-day'; 
    } else if (timeDecimal >= 17.0 && timeDecimal < 19.5) { 
        // Atardecer: 17:00 a 19:29:59
        themeClass = 'theme-dusk'; 
    } else {
        // Noche: 19:30 a 04:59:59 (y el resto de la madrugada)
        themeClass = 'theme-night'; 
    }

    body.classList.add(themeClass);

    // --- Generación de Estrellas (Solo en modo Noche/Amanecer) ---
    // Se necesitan estrellas en la noche y al amanecer antes de que el sol sea dominante
    if (themeClass === 'theme-night' || themeClass === 'theme-dawn') {
        const STAR_COUNT = 80; 
        const container = document.body;

        for (let i = 0; i < STAR_COUNT; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            // Posición aleatoria
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            star.style.left = `${x}px`;
            star.style.top = `${y}px`;

            // Retraso de animación aleatorio
            star.style.animationDelay = `${Math.random() * 4}s`; 

            container.appendChild(star);
        }
    }
});
