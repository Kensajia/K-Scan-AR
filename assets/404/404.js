document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN ---
    
    // Lista de rutas de tus imágenes (deben estar en /K-Scan-AR/assets/404/Img/)
    const IMAGES = [
        '/K-Scan-AR/assets/404/Img/01.webp',
        '/K-Scan-AR/assets/404/Img/02.webp',
        // Añade más rutas si tienes más imágenes
    ];

    // Horarios (en 24H) para la transición de temas.
    // Usamos horas en formato decimal (e.g., 6.58 = 6:35 AM, 19.0 = 7:00 PM).
    const HOUR_CONFIG = {
        SUNRISE_START: 6.58,    // 06:35 (Inicio Amanecer)
        DAY_START: 7.0,         // 07:00 (Inicio Día)
        TWILIGHT_START: 18.58,  // 18:35 (Inicio Atardecer)
        NIGHT_START: 19.0       // 19:00 (Inicio Noche)
    };

    // --- 2. SELECCIÓN DE IMAGEN ALEATORIA ---
    
    const mobileContainer = document.getElementById('mobile-illustration');
    const desktopContainer = document.getElementById('desktop-illustration');
    
    if (IMAGES.length > 0) {
        const randomIndex = Math.floor(Math.random() * IMAGES.length);
        const selectedImageSrc = IMAGES[randomIndex];
        
        // Función auxiliar para crear y configurar la imagen
        const createAndInsertImage = (container) => {
             const imgElement = document.createElement('img');
             imgElement.src = selectedImageSrc;
             imgElement.alt = "Ilustración de error 404";
             container.appendChild(imgElement);
        };

        // Insertar la misma imagen aleatoria en ambos contenedores
        if (mobileContainer) {
            createAndInsertImage(mobileContainer);
        }
        if (desktopContainer) {
            createAndInsertImage(desktopContainer);
        }
    }

    // --- 3. LÓGICA DE TEMAS DINÁMICOS Y ANIMACIÓN NOCTURNA ---

    const body = document.body;
    const starField = document.getElementById('star-field');
    
    /**
     * Determina el tema basado en la hora y minutos actuales.
     * @param {Date} now El objeto Date actual.
     * @returns {string} La clase CSS del tema.
     */
    function getTheme(now) {
        // Calcula la hora actual como un número decimal 
        const currentHourDecimal = now.getHours() + now.getMinutes() / 60; 
        
        const { SUNRISE_START, DAY_START, TWILIGHT_START, NIGHT_START } = HOUR_CONFIG;

        if (currentHourDecimal >= DAY_START && currentHourDecimal < TWILIGHT_START) {
            // Día
            return 'theme-day';
        } else if (currentHourDecimal >= NIGHT_START || currentHourDecimal < SUNRISE_START) {
            // Noche
            return 'theme-night';
        } else {
            // Transición (Amanecer o Atardecer)
            if (currentHourDecimal >= SUNRISE_START && currentHourDecimal < DAY_START) {
                 // Amanecer
                 return 'theme-sunrise';
            } else {
                 // Atardecer
                 return 'theme-sunset';
            }
        }
    }

    /**
     * Crea un número aleatorio de estrellas y las posiciona.
     */
    function createStars() {
        const numberOfStars = 50; 
        starField.innerHTML = '';
        
        for (let i = 0; i < numberOfStars; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;

            const size = Math.random() * 1.5 + 0.5;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            
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
        body.classList.remove('theme-day', 'theme-night', 'theme-sunrise', 'theme-sunset');
        
        // Aplica la nueva clase de tema
        if (newTheme !== 'theme-day') {
             body.classList.add(newTheme);
        }

        // Gestión de la animación de estrellas (Noche y Atardecer)
        if (newTheme === 'theme-night' || newTheme === 'theme-sunset') {
            if (starField.children.length === 0) {
                 createStars();
            }
        } else {
             // Eliminar las estrellas cuando no se usan (Día/Amanecer)
             if (starField.children.length > 0) {
                 starField.innerHTML = '';
             }
        }
        
        console.log(`Hora actual: ${now.getHours()}:${now.getMinutes()}. Tema aplicado: ${newTheme}`);
    }

    // Aplica el tema al cargar la página
    applyTheme();

    // Revisa y aplica el tema cada minuto
    setInterval(applyTheme, 60000); 
});
