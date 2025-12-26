document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN ---
    
    // Lista de rutas de tus imágenes (deben estar en assets/404/Img/)
    const IMAGES = [
        '/K-Scan-AR/assets/404/Img/01.webp',
        '/K-Scan-AR/assets/404/Img/02.webp',
        // Añade más rutas si tienes más imágenes
    ];

	// --- 1. CONFIGURACIÓN ---
    // Horarios (en 24H) para la transición de temas
	// Usamos horas en formato decimal (e.g., 6.5 = 6:30 AM, 19.0 = 7:00 PM) 6:35 AM (6 + 35/60 ≈ 6.58)
	const HOUR_CONFIG = {
		SUNRISE_START: 6.58, // 06:35 a.m. (Amanecer)
		DAY_START: 7.0,      // 07:00 a.m. (Día)
		TWILIGHT_START: 18.3, // 06:30 p.m. (Atardecer)
		NIGHT_START: 19.0     // 07:00 p.m. (Noche)
	};

    // --- 2. SELECCIÓN DE IMAGEN ALEATORIA ---
    
    const illustrationContainer = document.getElementById('illustration-container');
    
    if (IMAGES.length > 0) {
        const randomIndex = Math.floor(Math.random() * IMAGES.length);
        const selectedImageSrc = IMAGES[randomIndex];
        
        const imgElement = document.createElement('img');
        imgElement.src = selectedImageSrc;
        imgElement.alt = "Ilustración de error 404";
        
        illustrationContainer.appendChild(imgElement);
    }

    // --- 3. LÓGICA DE TEMAS DINÁMICOS Y ANIMACIÓN NOCTURNA ---

    const body = document.body;
    const starField = document.getElementById('star-field');
    
   /**
     * Determina el tema basado en la hora y minutos actuales.
     * @param {Date} now El objeto Date actual.
     * @returns {string} La clase CSS del tema: 'theme-day', 'theme-night', o 'theme-twilight'.
     */
    function getTheme(now) {
        // Calcula la hora actual como un número decimal 
        // (Ej: 6:35 AM = 6 + 35/60 ≈ 6.58)
        const currentHourDecimal = now.getHours() + now.getMinutes() / 60; 
        
        const { SUNRISE_START, DAY_START, TWILIGHT_START, NIGHT_START } = HOUR_CONFIG;

        if (currentHourDecimal >= DAY_START && currentHourDecimal < TWILIGHT_START) {
            // Día: 7:00 a.m. hasta 5:59 p.m.
            return 'theme-day';
        } else if (currentHourDecimal >= NIGHT_START || currentHourDecimal < SUNRISE_START) {
            // Noche: 7:00 p.m. hasta 6:34 a.m.
            return 'theme-night';
        } else {
            // Amanecer (6:35 a.m. - 6:59 a.m.) O Atardecer (6:00 p.m. - 6:59 p.m.)
            return 'theme-twilight';
        }
    }

	/**
     * Crea un número aleatorio de estrellas y las posiciona.
     */
    function createStars() {
        // Solo para el tema nocturno, usa un número razonable de estrellas
        const numberOfStars = 50; 
        
        // Limpia las estrellas existentes antes de crearlas
        starField.innerHTML = '';
        
        for (let i = 0; i < numberOfStars; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            
            // Posición aleatoria
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;

            // Tamaño y opacidad aleatorios para variar (0.5px a 2px)
            const size = Math.random() * 1.5 + 0.5;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            
            // Retardo de la animación para un parpadeo asíncrono
            star.style.animationDelay = `${Math.random() * 2}s`;

            starField.appendChild(star);
        }
    }

    /**
     * Aplica el tema CSS al cuerpo del documento y gestiona la animación.
     */
    function applyTheme() {
        const now = new Date();
        const newTheme = getTheme(now); 
        
        // Limpia cualquier clase de tema anterior
        body.classList.remove('theme-day', 'theme-night', 'theme-twilight');
        
        // Aplica la nueva clase de tema
        if (newTheme !== 'theme-day') {
             body.classList.add(newTheme);
        }

        // Gestión de la animación de estrellas
        if (newTheme === 'theme-night') {
            // Solo crea estrellas si es de noche y aún no hay estrellas
            if (starField.children.length === 0) {
                 createStars();
            }
        } else {
            // Si no es de noche, simplemente el CSS hará que la capa sea invisible (opacity: 0)
        }

        console.log(`Tema aplicado: ${newTheme}`);
    }

    // Aplica el tema al cargar la página
    applyTheme();

    // Revisa y aplica el tema cada minuto para capturar los cambios de hora y minuto exactos.
    setInterval(applyTheme, 60000); // 60,000 ms = 1 minuto
});
