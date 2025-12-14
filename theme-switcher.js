document.addEventListener('DOMContentLoaded', (event) => {
    const body = document.getElementById('page-404');
    const currentHour = new Date().getHours();
    let themeClass;

    // --- Lógica del Ciclo Día-Noche ---
    if (currentHour >= 5 && currentHour < 7) {
        // Amanecer: 5 AM - 7 AM
        themeClass = 'theme-dawn'; 
    } else if (currentHour >= 7 && currentHour < 17) {
        // Día: 7 AM - 5 PM
        themeClass = 'theme-day'; 
    } else if (currentHour >= 17 && currentHour < 19) {
        // Atardecer: 5 PM - 7 PM
        themeClass = 'theme-dusk'; 
    } else {
        // Noche: 7 PM - 5 AM (y el resto de la madrugada)
        themeClass = 'theme-night'; 
    }

    body.classList.add(themeClass);

    // --- Generación de Estrellas (Solo en modo Noche) ---
    if (themeClass === 'theme-night' || themeClass === 'theme-dawn') {
        const STAR_COUNT = 80; // Cantidad de estrellas
        const container = document.body;

        for (let i = 0; i < STAR_COUNT; i++) {
            const star = document.createElement('div');
            star.classList.add('star');

            // Posición aleatoria dentro del viewport
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            star.style.left = `${x}px`;
            star.style.top = `${y}px`;

            // Retraso de animación aleatorio para que parpadeen a diferentes ritmos
            star.style.animationDelay = `${Math.random() * 4}s`; 

            container.appendChild(star);
        }
    }
});
