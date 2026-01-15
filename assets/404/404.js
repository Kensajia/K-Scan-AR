document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN ---
    
    // Lista de rutas de tus imágenes (deben estar en /K-Scan-AR/assets/404/Img/)
    const IMAGES = [
        '/K-Scan-AR/assets/404/Img/01.webp',
        '/K-Scan-AR/assets/404/Img/02.webp'
        // Añade más rutas si tienes más imágenes
    ];

    // Horarios (en 24H) para la transición de temas.
    // Usamos horas en formato decimal (e.g., 6.58 = 6:35 AM, 19.0 = 7:00 PM).
  	const HOUR_CONFIG = {
        SUNRISE_START: (06+(35/60)),    // 06:35 (Inicio Amanecer)
        DAY_START: (07+(00/60)),         // 07:00 (Inicio Día)
        TWILIGHT_START: (18+(35/60)),  // 18:35 (Inicio Atardecer)
        NIGHT_START: (19+(00/60))       // 19:00 (Inicio Noche)
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
     * Crea un número aleatorio de estrellas y las posiciona.
     */
    function createStars() {
        if (starField.children.length > 0) return;
        const numberOfStars = 50; 
        for (let i = 0; i < numberOfStars; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            const size = Math.random() * 1.5 + 0.5;
            star.style.width = `${size}px`; star.style.height = `${size}px`;
            star.style.animationDelay = `${Math.random() * 2}s`;
            starField.appendChild(star);
        }
    }

    /**
     * Aplica el tema CSS al cuerpo del documento y gestiona la animación.
     */
    function applyTheme() {
        const now = new Date();
        const current = now.getHours() + now.getMinutes() / 60; 
        const { SUNRISE_START, DAY_START, TWILIGHT_START, NIGHT_START } = HOUR_CONFIG;

        let theme = 'theme-day';
        let progress = 0; // 0 a 1 para controlar la transición

        if (current >= SUNRISE_START && current < DAY_START) {
            theme = 'theme-sunrise';
            progress = (current - SUNRISE_START) / (DAY_START - SUNRISE_START);
        } else if (current >= DAY_START && current < TWILIGHT_START) {
            theme = 'theme-day';
        } else if (current >= TWILIGHT_START && current < NIGHT_START) {
            theme = 'theme-sunset';
            progress = (current - TWILIGHT_START) / (NIGHT_START - TWILIGHT_START);
        } else {
            theme = 'theme-night';
        }

        // Aplicar clase y variable de progreso
        body.className = theme; 
        body.style.setProperty('--transition-progress', progress);
		
		// NUEVO: Clase para cambiar el color del texto a mitad de camino
		if (progress > 0.5) {
			body.classList.add('mid-transition');
		} else {
			body.classList.remove('mid-transition');
		}

        // Lógica de estrellas (Aparecen/Desaparecen a mitad de transición)
        if (theme === 'theme-night' || (theme === 'theme-sunset' && progress > 0.5) || (theme === 'theme-sunrise' && progress < 0.5)) {
            createStars();
            starField.style.opacity = (theme === 'theme-night') ? "1" : (theme === 'theme-sunset' ? (progress - 0.5) * 2 : (0.5 - progress) * 2);
        } else {
            starField.innerHTML = '';
            starField.style.opacity = "0";
        }
    }

	// --- 4. LÓGICA DE BOTON CON RETRASO ---
    // Definimos la función globalmente dentro del scope para que el HTML la encuentre
    window.delayedNavigation = function(event, url) {
        event.preventDefault(); // Detiene la carga inmediata
		// 2. Obtenemos la URL directamente del atributo href del elemento
		const destination = url.href;
        // 3. Navegamos tras 1 segundo
    setTimeout(() => {
        if (destination) {
            window.location.href = destination;
        }
    }, 1500); // Milisegundo de retraso
    };

    applyTheme();
    setInterval(applyTheme, 30000); // Revisar cada 30 seg para suavidad
});
