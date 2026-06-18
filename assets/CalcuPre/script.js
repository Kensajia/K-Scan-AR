let fullProductos = [];
let productosData = [];
let cart = [];
let selectedProdIndex = null;
let currentCategory = 'todos';
let lastArType = 'ninguno_ar'; // Para rastrear el cambio de estado
let Nomb_Fech_Ofer = ""; // Variable global para almacenar el nombre de la oferta actual
const LIMITES = {
    'num-marcadores': 6,
    'num-simultaneos': 6,
    'm-val': 10
};

// 1. CARGA DE DATOS
fetch('assets/CalcuPre/precios.json')
    .then(res => {
        if (!res.ok) throw new Error("No se pudo cargar el archivo JSON");
        return res.json();
    })
    .then(data => {
        fullProductos = data.productos;
        productosData = [...fullProductos];
        renderCategories();
        renderCards();
    })
    .catch(err => {
        console.error("Error cargando JSON:", err);
        document.getElementById('product-cards-container').innerHTML = 
            `<p style="color:red; grid-column: 1/-1;">Error: ${err.message}. Revisa la estructura del JSON.</p>`;
    });

// 2. FILTROS (Ruta corregida a especificaciones.categoria)
function renderCategories() {
    const container = document.getElementById('category-filters');
    if (!container) return;

    // Extraemos las categorías de dentro de especificaciones
    const categories = ['todos', ...new Set(fullProductos.map(p => p.especificaciones.categoria))];
    
    container.innerHTML = categories.map(cat => {
        // Validación por si alguna categoría viene vacía
        const nombreCat = cat ? cat.toUpperCase() : "SIN CATEGORÍA";
        return `
            <button class="cat-btn ${currentCategory === cat ? 'active' : ''}" 
                    onclick="filterByCategory('${cat}')">
                ${nombreCat}
            </button>
        `;
    }).join('');
}

function filterByCategory(cat) {
    currentCategory = cat;
    productosData = (cat === 'todos') 
        ? [...fullProductos] 
        : fullProductos.filter(p => p.especificaciones.categoria === cat);
    
    renderCategories();
    renderCards();
    
    // Ocultar paneles si se cambia de categoría
    document.getElementById('config-section').classList.add('hidden');
    document.getElementById('details-section').classList.add('hidden');
}

// 3. RENDER TARJETAS
function renderCards() {
    const container = document.getElementById('product-cards-container');
    if (!container) return;

    if (productosData.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center;">No hay productos en esta categoría.</p>`;
        return;
    }

    container.innerHTML = productosData.map((prod, index) => {
        // 1. Lógica de imagen: URL o Icono de error
        const imagenUrl = (prod.URL_Imagen && prod.URL_Imagen[0]) 
                          ? prod.URL_Imagen[0] 
                          : 'https://img.icons8.com/carbon-copy/200/no-image.png';

        // 2. Lógica del color: Si está vacío, ponemos un espacio para mantener la altura
        const colorDisplay = (prod.color && prod.color.trim() !== "") 
                             ? prod.color 
                             : '&nbsp;'; 

        return `
            <div class="card" id="card-${index}" onclick="selectProduct(${index})">
                <img src="${imagenUrl}" alt="${prod.nombre}" onerror="this.src='https://img.icons8.com/carbon-copy/200/no-image.png'">
                <div class="card-info">
                    <strong>${prod.nombre}</strong><br>
                    <small>${colorDisplay}</small>
                </div>
            </div>
        `;
    }).join('');
	
	document.addEventListener('dblclick', (e) => {
		const card = e.target.closest('.card');
		if (card && card.classList.contains('active')) { // Solo si es la tarjeta seleccionada
			mostrarVideoExperiencia();
		}
	});
}

// Dentro de la lógica que genera los radios para "Tipo de Experiencia AR"
// Asegúrate de que el evento change capture el índice
function actualizarVistaPreviaAR() {
    const prod = productosData[selectedProdIndex];
    const selectedRadio = document.querySelector('input[name="ar-type"]:checked');
    if (!selectedRadio || !prod) return;

    // Obtenemos el índice basado en la posición de la opción
    // ninguno_ar=1, imagen_ar=2, audio_ar=3, video_ar=4...
    const opciones = ['ninguno_ar', 'imagen_ar', 'audio_ar', 'video_ar', '3d_ar', '3d+audio_ar'];
    const indiceURL = opciones.indexOf(selectedRadio.value) + 1;

    // 1. Cambiar la imagen de la tarjeta activa (la grande)
    const activeCardImg = document.querySelector(`#card-${selectedProdIndex} img`);
    if (activeCardImg) {
        const nuevaImg = prod.URL_Imagen[indiceURL] || prod.URL_Imagen[0] || 'https://img.icons8.com/carbon-copy/200/no-image.png';
        activeCardImg.src = nuevaImg;
    }
}

function mostrarVideoExperiencia() {
    const prod = productosData[selectedProdIndex];
    const selectedRadio = document.querySelector('input[name="ar-type"]:checked');
    if (!prod || !selectedRadio) return;

    const opciones = ['ninguno_ar', 'imagen_ar', 'audio_ar', 'video_ar', '3d_ar', '3d+audio_ar'];
    const indiceURL = opciones.indexOf(selectedRadio.value) + 1;

    const videoUrl = prod.URL_Video[indiceURL];

    if (videoUrl) {
        // Aquí creamos un reproductor simple o abrimos el link
        // Por ahora, lo abriremos en una pestaña nueva como prueba rápida
        window.open(videoUrl, '_blank');
        
        /* Si prefieres que se vea en la web, podrías inyectar un <video> 
        en un contenedor de "Preview" que tengas en el HTML 
        */
    } else {
        console.log("No hay video asignado para esta experiencia.");
    }
}

function actualizarMultimediaCard(tipo) {
    const prod = productosData[selectedProdIndex];
    const card = document.getElementById(`card-${selectedProdIndex}`);
    if (!card || !prod) return;

    // Mapeo de índices según tu JSON
    const mapaIndices = { 'ninguno_ar':1, 'imagen_ar': 2, 'audio_ar': 3, 'video_ar': 4, '3d_ar': 5, '3d+audio_ar': 6 };
    const idx = mapaIndices[tipo] || 0;

    // Eliminar video si existe para volver a mostrar la imagen
    const videoExistente = card.querySelector('video');
    if (videoExistente) videoExistente.remove();

    const img = card.querySelector('img');
    img.style.display = 'block'; // Aseguramos que la imagen sea visible
    
    // Cambiamos a la imagen de la experiencia, si no existe usamos la 0
    img.src = prod.URL_Imagen[idx] || prod.URL_Imagen[0] || 'https://img.icons8.com/carbon-copy/200/no-image.png';
}

function toggleVideoCard(index) {
    const card = document.getElementById(`card-${index}`);
    const prod = productosData[index];
    const videoExistente = card.querySelector('video');

    // SI YA HAY VIDEO: Lo quitamos y restauramos la vista
    if (videoExistente) {
        videoExistente.remove();
        return;
    }

    // SI NO HAY VIDEO: Buscamos la URL según la experiencia AR seleccionada
    const mapaIndices = { 
		'ninguno_ar': 1,
        'imagen_ar': 2, 
        'audio_ar': 3, 
        'video_ar': 4, 
        '3d_ar': 5, 
        '3d+audio_ar': 6 
    };
    
    // Obtenemos el tipo actual del radio marcado
    const currentType = document.querySelector('input[name="ar_type"]:checked')?.value || 'ninguno_ar';
    const idx = mapaIndices[currentType];
    const videoUrl = prod.URL_Video && prod.URL_Video[idx];

    if (videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true; // El navegador bloquea videos con audio que inician solos
        video.playsInline = true; // Importante para móviles
        
        // Al hacer doble clic en el video mismo, también debe cerrarse
        video.ondblclick = (e) => {
            e.stopPropagation();
            video.remove();
        };

        card.appendChild(video);
    } else {
        console.log("No hay video disponible para esta experiencia.");
    }
}

function obtenerDatosPrecioActual(prod) {
    const hoy = new Date();
    // Normalizamos hoy para que no cuente las horas, solo día/mes/año
    hoy.setHours(0, 0, 0, 0);

    let enOferta = false;
    Nomb_Fech_Ofer = ""; // Resetear

    // Recorremos el array de fechas iniciales (asumiendo que inicial, final y nombre tienen el mismo largo)
    for (let i = 0; i < prod.fechas_oferta_inicial.length; i++) {
        // Convertimos "D/M/YYYY" a objeto Date de JS
        const [diaI, mesI, anioI] = prod.fechas_oferta_inicial[i].split('/').map(Number);
        const [diaF, mesF, anioF] = prod.fechas_oferta_final[i].split('/').map(Number);

        const fechaInicio = new Date(anioI, mesI - 1, diaI);
        const fechaFin = new Date(anioF, mesF - 1, diaF);

        // Comprobamos si hoy está entre inicio y fin (inclusive)
        if (hoy >= fechaInicio && hoy <= fechaFin) {
            enOferta = true;
            Nomb_Fech_Ofer = prod.fechas_oferta_nombre[i];
            break; // Si ya encontramos una oferta, no hace falta buscar más
        }
    }

    // Retornamos el set de precios que corresponda
    return enOferta ? prod.precios_oferta : prod.precios_base;
}

// 4. SELECCIÓN DE PRODUCTO
function selectProduct(index) {
    selectedProdIndex = index;
    const prod = productosData[index];

	// Resaltar tarjeta
    document.querySelectorAll('.card').forEach((c, i) => {
        const isActive = i === index;
        c.classList.toggle('active', isActive);
        c.classList.toggle('inactive', !isActive);
        
        // --- NUEVA LÓGICA DE RESETEO ---
        const img = c.querySelector('img');
        const video = c.querySelector('video');
        
        if (video) video.remove(); // Elimina cualquier video que haya quedado abierto
        img.style.display = 'block';

        if (!isActive) {
            // Si la tarjeta no es la seleccionada, vuelve a la imagen de portada (índice 0)
            const prodInactivo = productosData[i];
            img.src = (prodInactivo.URL_Imagen && prodInactivo.URL_Imagen[0]) 
                      ? prodInactivo.URL_Imagen[0] 
                      : 'https://img.icons8.com/carbon-copy/200/no-image.png';
            c.ondblclick = null; // Quita el evento de doble clic
        } else {
            // Activa el doble clic solo en la tarjeta actual
            c.ondblclick = () => toggleVideoCard(index);
        }
    });

	document.querySelectorAll('.card video').forEach(v => v.remove())
	
    document.getElementById('details-section').classList.remove('hidden');
    document.getElementById('config-section').classList.remove('hidden');
    
    const nameLabel = prod.color && prod.color.trim() !== "" ? `${prod.nombre} - ${prod.color}` : prod.nombre;
    document.getElementById('selected-name').textContent = nameLabel;
    document.getElementById('selected-desc').textContent = prod.especificaciones.descripcion;
	
	// Specs
    document.getElementById('specs-list').innerHTML = `
        <li>Material: ${prod.especificaciones.material}</li>
        <li>Tamaño: ${prod.especificaciones.tamaño}</li>
    `;

	// Radios AR
    const arDiv = document.getElementById('ar-options-radio');
    arDiv.innerHTML = Object.keys(prod.precios_base).map(key => `
        <label class="ar-btn-label">
            <input type="radio" name="ar_type" value="${key}" 
                   ${key === 'ninguno_ar' ? 'checked' : ''} 
                   onchange="handleArChange('${key}')">
            <div class="ar-btn-content">${key.replace('_ar','').toUpperCase()}</div>
        </label>
    `).join('');

	// Estado inicial: Imagen
    lastArType = 'ninguno_ar';
    handleArChange('ninguno_ar');
}

// Controla el cambio de tipo y el reseteo selectivo
function handleArChange(newType) {
    // Referencias a los inputs
    const inputMarcadores = document.getElementById('num-marcadores');
    const inputSimultaneos = document.getElementById('num-simultaneos');

    if (newType === 'ninguno_ar') {
        // Si seleccionamos IMAGEN: Valores a 0
        inputMarcadores.value = 0;
        inputSimultaneos.value = 0;
        generarMultimediaInputs(0);
    } 
    else if (lastArType === 'ninguno_ar' && newType !== 'ninguno_ar') {
        // Si veníamos de IMAGEN (que estaba en 0) y vamos a otro: Todo a 1
        inputMarcadores.value = 1;
        inputSimultaneos.value = 1;
        generarMultimediaInputs(1);
    }

    // Cambiar la imagen de la tarjeta
    actualizarMultimediaCard(newType);
    
    // Ocultar o mostrar los paneles en el HTML
    toggleARVisibility(newType);

    // IMPORTANTE: Guardar el tipo actual al final para la próxima comparación
    lastArType = newType;

    // Recalcular precio
    actualizarPrecioDinamico();
}



function setValues(val) {
    document.getElementById('num-marcadores').value = val;
    document.getElementById('num-simultaneos').value = val;
    generarMultimediaInputs(val);
}

// 5. MULTIMEDIA DINÁMICA
document.getElementById('num-marcadores').addEventListener('input', function() {
    let val = parseInt(this.value);
    if (isNaN(val) || val < 1) val = 1;
    generarMultimediaInputs(val);
});

function generarMultimediaInputs(cant) {
    const container = document.getElementById('multimedia-inputs-container');
    container.innerHTML = '';
    // Si es 0 (Imagen), no mostramos inputs pero la lógica guardará [0]
    if (cant === 0) return; 

    for (let i = 1; i <= cant; i++) {
        container.innerHTML += `
            <div class="m-item">
                <label style="font-size: 10px; margin-bottom: 2px;">Marc. ${i.toString().padStart(2, '0')}</label>
                <div class="number-control">
					<button type="button" onclick="cambiarValor(this, -1)">-</button>
					<input type="number" class="m-val" value="1" min="1" readonly>
					<button type="button" onclick="cambiarValor(this, 1)">+</button>
				</div>
            </div>`;
    }
}


// 6. AÑADIR AL CARRITO
document.getElementById('add-calculation').addEventListener('click', () => {
    if (selectedProdIndex === null) return;
    
    const prod = productosData[selectedProdIndex];
    const arType = document.querySelector('input[name="ar_type"]:checked').value;
    const nMarc = parseInt(document.getElementById('num-marcadores').value) || 0;
    const nSimul = parseInt(document.getElementById('num-simultaneos').value) || 0;
    const preciosActuales = obtenerDatosPrecioActual(prod);
	
    let mValues = [];
    let totalFinal = 0;

    if (arType === 'ninguno_ar') {
        // --- CÁLCULO SOLO IMAGEN ---
        totalFinal = preciosActuales.ninguno_ar;
        mValues = [0]; // posiblemente se elimine con la adicion del precio oferta segun el codigo dado
    } else {
        // --- CÁLCULO COMPLETO ---
        // 1. Base (Producto + Tipo AR) cobrado una sola vez
        totalFinal = preciosActuales.ninguno_ar + (preciosActuales[arType] || 0);

        // 2. Multimedia (Bloque dinámico por rangos)
        document.querySelectorAll('.m-val').forEach(input => {
            const val = parseInt(input.value) || 1;
            mValues.push(val);
            const rangos = prod.reglas_adicionales.rangos_multimedia_por_marcador;
            const rangoMatch = rangos.find(r => val >= r.min && val <= r.max);
            if(rangoMatch) totalFinal += (val * rangoMatch.precio);
        });

        // 3. Marcadores Extra (Dinámico desde JSON)
        const reglaM = prod.reglas_adicionales.marcador_extra;
        if (nMarc >= reglaM.aplica_desde) {
            totalFinal += (nMarc - (reglaM.aplica_desde - 1)) * reglaM.precio_unitario;
        }

        // 4. Simultáneos Extra (Dinámico desde JSON)
        const reglaS = prod.reglas_adicionales.simultaneo_extra;
        if (nSimul >= reglaS.aplica_desde) {
            totalFinal += (nSimul - (reglaS.aplica_desde - 1)) * reglaS.precio_unitario;
        }
    }

    // Agregar al carrito con la configuración detallada
    cart.push({
        nombre: prod.color ? `${prod.nombre} (${prod.color})` : prod.nombre,
        config: `${arType.toUpperCase()} | Marc: ${nMarc} | Simul: ${nSimul} | Mult: [${mValues.join(',')}]`,
        precio: totalFinal
    });

    renderCart();
});

// 7. RENDER TABLA
function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    tbody.innerHTML = cart.map((item, i) => `
        <tr>
            <td>${item.nombre}</td>
            <td><small>${item.config}</small></td>
            <td>$${item.precio.toFixed(2)}</td>
            <td style="text-align:right">
                <button onclick="removeItem(${i})" class="btn-del">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m9 9 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 9-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12C3 4.59 4.59 3 12 3c7.412 0 9 1.589 9 9 0 7.412-1.588 9-9 9-7.411 0-9-1.588-9-9z" stroke="currentColor" stroke-width="2"/></svg>
                </button>
            </td>
        </tr>
    `).join('');
    document.getElementById('grand-total').textContent = cart.reduce((s, i) => s + i.precio, 0).toFixed(2);
}

function removeItem(index) {
    cart.splice(index, 1);
    renderCart();
}

// Manejo de tooltips en móviles (evita que el title nativo moleste)
document.querySelectorAll('.help-icon').forEach(icon => {
    icon.addEventListener('click', function(e) {
        // En móviles, el primer clic muestra, el segundo oculta
        this.classList.toggle('show-help');
    });
});

// Asegurarse de que el scroll vertical de las tarjetas sea fluido
const cardContainer = document.getElementById('product-cards-container');
cardContainer.addEventListener('wheel', (evt) => {
    // Si queremos que el scroll del ratón funcione normal, 
    // al ser vertical ya no necesitamos prevenir el default.
});

// Función para los botones +/-
function changeValue(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) + delta;
    
    // Aplicar límites
    if (val < 1) val = 1;
    if (LIMITES[id] && val > LIMITES[id]) val = LIMITES[id];
    
    input.value = val;
    
	// Si es el de marcadores, actualizar multimedia
    if (id === 'num-marcadores') {
        generarMultimediaInputs(val);
    }
    actualizarPrecioDinamico(); // Calcular precio al cambiar
}

function cambiarValor(boton, cantidad) {
    // 1. Buscamos el contenedor inmediato (el div que envuelve al botón y al input)
    const contenedor = boton.parentElement;
    
    // 2. Buscamos el input que esté dentro de ese contenedor (sirve para cualquier clase)
    const input = contenedor.querySelector('input[type="number"]');
	
    if (!input) return; // Seguridad por si no encuentra el input

    let nuevoValor = (parseInt(input.value) || 0) + cantidad;
    
    // Validar límites
    if (nuevoValor < 1) nuevoValor = 1;
    if (nuevoValor > LIMITES['m-val']) nuevoValor = LIMITES['m-val'];
    
    input.value = nuevoValor;
    actualizarPrecioDinamico(); // Calcular precio al cambiar
}


// Lógica de visibilidad AR
function toggleARVisibility(type) {
    const settings = document.getElementById('ar-settings-container');// Marcadores y Simultáneos
    const multimedia = document.getElementById('multimedia-section-container');
    
    if (type === 'ninguno_ar') {
        settings.classList.add('hidden');
        multimedia.classList.add('hidden');
    } else {
        settings.classList.remove('hidden');
        multimedia.classList.remove('hidden');
    }
    // Forzamos la actualización del precio al cambiar de tipo
    actualizarPrecioDinamico();
}

function actualizarPrecioDinamico() {
    // 1. Verificación de seguridad: si no hay producto seleccionado, no calcular
    if (selectedProdIndex === null) return;
    const prod = productosData[selectedProdIndex];
    
    // 2. Capturar valores e identificar precios (Base u Oferta)
    const preciosActuales = obtenerDatosPrecioActual(prod); 
    const arType = document.querySelector('input[name="ar_type"]:checked')?.value || 'ninguno_ar';
    const nMarc = parseInt(document.getElementById('num-marcadores').value) || 0;
    const nSimul = parseInt(document.getElementById('num-simultaneos').value) || 0;
    
    let totalCalculado = 0;

    // 3. Lógica de Cálculo por tipo de Experiencia
    if (arType === 'ninguno_ar') {
        // --- BLOQUE: SOLO IMAGEN ---
        // Usamos preciosActuales en lugar de precios_base
        totalCalculado = preciosActuales.ninguno_ar;
    } else {
        // --- BLOQUE A: PRECIO BASE ---
        // Se suma el base de imagen + el base del tipo de AR desde la lista activa
        totalCalculado = preciosActuales.ninguno_ar + (preciosActuales[arType] || 0);

        // --- BLOQUE B: MULTIMEDIA EXTRA ---
        const mInputs = document.querySelectorAll('.m-val');
        // Obtenemos los valores de todos los inputs generados en la rejilla
        mInputs.forEach(input => {
            let val = parseInt(input.value) || 1;
            // Buscamos el rango de precio correspondiente en el JSON
            const rangos = prod.reglas_adicionales.rangos_multimedia_por_marcador;
            const rangoMatch = rangos.find(r => val >= r.min && val <= r.max);
            
            if (rangoMatch) {
                // Si el valor entra en un rango, sumamos el precio correspondiente
                totalCalculado += (val * rangoMatch.precio);
            }
        });

        // --- BLOQUE C: MARCADORES EXTRA (DINÁMICO) ---
        // Se activa según el valor "aplica_desde" del JSON.
        const reglaMarc = prod.reglas_adicionales.marcador_extra;
        if (nMarc >= reglaMarc.aplica_desde) {
            // Calculamos cuántos hay por encima del límite permitido.
            const extraCount = nMarc - (reglaMarc.aplica_desde - 1);
            totalCalculado += (extraCount * reglaMarc.precio_unitario);
        }

        // --- BLOQUE D: SIMULTÁNEOS EXTRA (DINÁMICO) ---
        // Se activa según el valor "aplica_desde" del JSON.
        const reglaSimul = prod.reglas_adicionales.simultaneo_extra;
        if (nSimul >= reglaSimul.aplica_desde) {
            const extraCount = nSimul - (reglaSimul.aplica_desde - 1);
            totalCalculado += (extraCount * reglaSimul.precio_unitario);
        }
    }

    // 4. Actualización del DOM (Blindada)
    const displaySpan = document.querySelector('#dynamic-price-display span');
    if (displaySpan) {
        // Animación simple de actualización (opcional)
        displaySpan.style.opacity = '0.5';
        
        setTimeout(() => {
            displaySpan.textContent = totalCalculado.toFixed(2);
            displaySpan.style.opacity = '1';
        }, 50);
    }

    // Gestión de la etiqueta de oferta
    const ofertaBadge = document.getElementById('oferta-badge-container');
    const ofertaLabel = document.getElementById('oferta-nombre-display');

    if (ofertaBadge && ofertaLabel) {
        if (Nomb_Fech_Ofer && Nomb_Fech_Ofer !== "") {
            ofertaLabel.textContent = `🎁 Ofertas por ${Nomb_Fech_Ofer}`;
            ofertaBadge.classList.remove('hidden');
        } else {
            ofertaBadge.classList.add('hidden');
        }
    }
	
	const summaryTitle = document.getElementById('summary-title');
	if (summaryTitle) {
		summaryTitle.textContent = Nomb_Fech_Ofer 
			? `Resumen Actual con oferta de ${Nomb_Fech_Ofer}` 
			: "Resumen Actual";
	}
	
}

// 7. ENVÍO DE DATOS A WHATSAPP
document.getElementById('send-whatsapp').addEventListener('click', () => {
    if (cart.length === 0) {
        alert("El resumen está vacío. Añade una configuración primero.");
        return;
    }

    // Definimos el encabezado dinámico
    let encabezado = "*COTIZACIÓN DE PERSONALIZACIÓN AR*";
    if (Nomb_Fech_Ofer) {
        encabezado += `%0A*OFERTA APLICADA POR ${Nomb_Fech_Ofer.toUpperCase()}*`;
    }

    let texto = encabezado + "%0A";
    texto += "-----------------------------------%0A";
    
    cart.forEach((item, i) => {
        texto += `*${i+1}. ${item.nombre}*%0A`;
        texto += `   Config: ${item.config}%0A`;
        texto += `   Subtotal: $${item.precio.toFixed(2)}%0A%0A`;
    });

    texto += "-----------------------------------%0A";
    texto += `*TOTAL ESTIMADO: $${document.getElementById('grand-total').textContent}*%0A%0A`;
    texto += "_Nota: Los precios son una referencia técnica para revisión._";

    const miTelefono = "593984272258"; // Reemplaza con tu número en formato internacional
    window.open(`https://wa.me/${miTelefono}?text=${texto}`, '_blank');
});
