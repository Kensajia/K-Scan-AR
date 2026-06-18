let fullProductos = [];
let productosData = [];
let cart = [];
let selectedProdIndex = null;
let currentCategory = 'todos';
let lastArType = 'imagen_ar'; 
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

// 2. FILTROS
function renderCategories() {
    const container = document.getElementById('category-filters');
    if (!container) return;

    const categories = ['todos', ...new Set(fullProductos.map(p => p.especificaciones.categoria))];
    
    container.innerHTML = categories.map(cat => {
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
        const imagenUrl = (prod.URL_Imagen && prod.URL_Imagen[0]) 
                          ? prod.URL_Imagen[0] 
                          : 'https://img.icons8.com/carbon-copy/200/no-image.png';

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
}

function actualizarMultimediaCard(tipo) {
    const prod = productosData[selectedProdIndex];
    const card = document.getElementById(`card-${selectedProdIndex}`);
    if (!card || !prod) return;

    const mapaIndices = { 'imagen_ar': 1, 'audio_ar': 2, 'video_ar': 3, '3d_ar': 4, '3d+audio_ar': 5 };
    const idx = mapaIndices[tipo] || 0;

    const videoExistente = card.querySelector('video');
    if (videoExistente) videoExistente.remove();

    const img = card.querySelector('img');
    img.style.display = 'block'; 
    img.src = prod.URL_Imagen[idx] || prod.URL_Imagen[0] || 'https://img.icons8.com/carbon-copy/200/no-image.png';
}

function toggleVideoCard(index) {
    const card = document.getElementById(`card-${index}`);
    const prod = productosData[index];
    const videoExistente = card.querySelector('video');

    if (videoExistente) {
        videoExistente.remove();
        return;
    }

    const mapaIndices = { 'imagen_ar': 1, 'audio_ar': 2, 'video_ar': 3, '3d_ar': 4, '3d+audio_ar': 5 };
    const currentType = document.querySelector('input[name="ar_type"]:checked')?.value || 'imagen_ar';
    const idx = mapaIndices[currentType];
    const videoUrl = prod.URL_Video && prod.URL_Video[idx];

    if (videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.ondblclick = (e) => { e.stopPropagation(); video.remove(); };
        card.appendChild(video);
    }
}

// 4. SELECCIÓN DE PRODUCTO
function selectProduct(index) {
    selectedProdIndex = index;
    const prod = productosData[index];

    document.querySelectorAll('.card').forEach((c, i) => {
        const isActive = i === index;
        c.classList.toggle('active', isActive);
        c.classList.toggle('inactive', !isActive);
        
        const img = c.querySelector('img');
        const video = c.querySelector('video');
        
        if (video) video.remove();
        img.style.display = 'block';

        if (!isActive) {
            const prodInactivo = productosData[i];
            img.src = (prodInactivo.URL_Imagen && prodInactivo.URL_Imagen[0]) 
                      ? prodInactivo.URL_Imagen[0] 
                      : 'https://img.icons8.com/carbon-copy/200/no-image.png';
            c.ondblclick = null;
        } else {
            c.ondblclick = () => toggleVideoCard(index);
        }
    });

    document.getElementById('details-section').classList.remove('hidden');
    document.getElementById('config-section').classList.remove('hidden');
    
    document.getElementById('selected-name').textContent = prod.color ? `${prod.nombre} - ${prod.color}` : prod.nombre;
    document.getElementById('selected-desc').textContent = prod.especificaciones.descripcion;
	
    document.getElementById('specs-list').innerHTML = `
        <li>Material: ${prod.especificaciones.material}</li>
        <li>Tamaño: ${prod.especificaciones.tamaño}</li>
    `;

    const arDiv = document.getElementById('ar-options-radio');
    arDiv.innerHTML = Object.keys(prod.precios_docena).map(key => `
        <label class="ar-btn-label">
            <input type="radio" name="ar_type" value="${key}" 
                   ${key === 'imagen_ar' ? 'checked' : ''} 
                   onchange="handleArChange('${key}')">
            <div class="ar-btn-content">${key.replace('_ar','').toUpperCase()}</div>
        </label>
    `).join('');

    lastArType = 'imagen_ar';
    handleArChange('imagen_ar');
}

function handleArChange(newType) {
    const inputMarcadores = document.getElementById('num-marcadores');
    const inputSimultaneos = document.getElementById('num-simultaneos');

    if (newType === 'imagen_ar') {
        inputMarcadores.value = 0;
        inputSimultaneos.value = 0;
        generarMultimediaInputs(0);
    } 
    else if (lastArType === 'imagen_ar' && newType !== 'imagen_ar') {
        inputMarcadores.value = 1;
        inputSimultaneos.value = 1;
        generarMultimediaInputs(1);
    }

    actualizarMultimediaCard(newType);
    toggleARVisibility(newType);
    lastArType = newType;
    actualizarPrecioDinamico();
}

function generarMultimediaInputs(cant) {
    const container = document.getElementById('multimedia-inputs-container');
    container.innerHTML = '';
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

// 5. PRECIO DINÁMICO (MODIFICADO PARA DOCENA)
function actualizarPrecioDinamico() {
    if (selectedProdIndex === null) return;
    const prod = productosData[selectedProdIndex];
    
    // USAR PRECIOS DE DOCENA DIRECTAMENTE
    const preciosDocena = prod.precios_docena; 
    const arType = document.querySelector('input[name="ar_type"]:checked')?.value || 'imagen_ar';
    const nMarc = parseInt(document.getElementById('num-marcadores').value) || 0;
    const nSimul = parseInt(document.getElementById('num-simultaneos').value) || 0;
    
    let totalCalculado = 0;

    if (arType === 'imagen_ar') {
        totalCalculado = preciosDocena.imagen_ar;
    } else {
        totalCalculado = preciosDocena.imagen_ar + (preciosDocena[arType] || 0);

        const mInputs = document.querySelectorAll('.m-val');
        mInputs.forEach(input => {
            let val = parseInt(input.value) || 1;
            const rangos = prod.reglas_adicionales.rangos_multimedia_por_marcador;
            const rangoMatch = rangos.find(r => val >= r.min && val <= r.max);
            if (rangoMatch) totalCalculado += (val * rangoMatch.precio);
        });

        const reglaMarc = prod.reglas_adicionales.marcador_extra;
        if (nMarc >= reglaMarc.aplica_desde) {
            totalCalculado += (nMarc - (reglaMarc.aplica_desde - 1)) * reglaMarc.precio_unitario;
        }

        const reglaSimul = prod.reglas_adicionales.simultaneo_extra;
        if (nSimul >= reglaSimul.aplica_desde) {
            totalCalculado += (nSimul - (reglaSimul.aplica_desde - 1)) * reglaSimul.precio_unitario;
        }
    }

    const displaySpan = document.querySelector('#dynamic-price-display span');
    if (displaySpan) {
        displaySpan.textContent = totalCalculado.toFixed(2);
    }

    const summaryTitle = document.getElementById('summary-title');
	if (summaryTitle) {
		summaryTitle.textContent = "Resumen por Docena (Unitario)";
	}
}

// 6. AÑADIR AL CARRITO
document.getElementById('add-calculation').addEventListener('click', () => {
    if (selectedProdIndex === null) return;
    
    const prod = productosData[selectedProdIndex];
    const arType = document.querySelector('input[name="ar_type"]:checked').value;
    const nMarc = parseInt(document.getElementById('num-marcadores').value) || 0;
    const nSimul = parseInt(document.getElementById('num-simultaneos').value) || 0;
    const preciosDocena = prod.precios_docena;
	
    let mValues = [];
    let totalFinal = 0;

    if (arType === 'imagen_ar') {
        totalFinal = preciosDocena.imagen_ar;
        mValues = [0];
    } else {
        totalFinal = preciosDocena.imagen_ar + (preciosDocena[arType] || 0);

        document.querySelectorAll('.m-val').forEach(input => {
            const val = parseInt(input.value) || 1;
            mValues.push(val);
            const rangos = prod.reglas_adicionales.rangos_multimedia_por_marcador;
            const rangoMatch = rangos.find(r => val >= r.min && val <= r.max);
            if(rangoMatch) totalFinal += (val * rangoMatch.precio);
        });

        const reglaM = prod.reglas_adicionales.marcador_extra;
        if (nMarc >= reglaM.aplica_desde) {
            totalFinal += (nMarc - (reglaM.aplica_desde - 1)) * reglaM.precio_unitario;
        }

        const reglaS = prod.reglas_adicionales.simultaneo_extra;
        if (nSimul >= reglaS.aplica_desde) {
            totalFinal += (nSimul - (reglaS.aplica_desde - 1)) * reglaS.precio_unitario;
        }
    }

    cart.push({
        nombre: prod.color ? `${prod.nombre} (${prod.color})` : prod.nombre,
        config: `${arType.toUpperCase()} | Marc: ${nMarc} | Simul: ${nSimul} | Mult: [${mValues.join(',')}]`,
        precio: totalFinal
    });

    renderCart();
});

// 7. RENDER TABLA Y WHATSAPP
function renderCart() {
    const tbody = document.querySelector('#cart-table tbody');
    
    // Calculamos los totales mientras recorremos el carrito
    let totalUnitario = 0;
    let totalDocena = 0;

    tbody.innerHTML = cart.map((item, i) => {
        const precioDocenaItem = item.precio * 12;
        totalUnitario += item.precio;
        totalDocena += precioDocenaItem;

        return `
            <tr>
                <td>${item.nombre}</td>
                <td><small>${item.config}</small></td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${precioDocenaItem.toFixed(2)}</td>
                <td style="text-align:right">
                    <button onclick="removeItem(${i})" class="btn-del">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m9 9 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 9-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12C3 4.59 4.59 3 12 3c7.412 0 9 1.589 9 9 0 7.412-1.588 9-9 9-7.411 0-9-1.588-9-9z" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Actualizamos los dos spans del total en el footer
    document.getElementById('grand-total').textContent = totalUnitario.toFixed(2);
    document.getElementById('grand-total-doc').textContent = totalDocena.toFixed(2);
}

function removeItem(index) {
    cart.splice(index, 1);
    renderCart();
}

function changeValue(id, delta) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (LIMITES[id] && val > LIMITES[id]) val = LIMITES[id];
    input.value = val;
    if (id === 'num-marcadores') generarMultimediaInputs(val);
    actualizarPrecioDinamico();
}

function cambiarValor(boton, cantidad) {
    const contenedor = boton.parentElement;
    const input = contenedor.querySelector('input[type="number"]');
    if (!input) return;
    let nuevoValor = (parseInt(input.value) || 0) + cantidad;
    if (nuevoValor < 1) nuevoValor = 1;
    if (nuevoValor > LIMITES['m-val']) nuevoValor = LIMITES['m-val'];
    input.value = nuevoValor;
    actualizarPrecioDinamico();
}

function toggleARVisibility(type) {
    const settings = document.getElementById('ar-settings-container');
    const multimedia = document.getElementById('multimedia-section-container');
    if (type === 'imagen_ar') {
        settings.classList.add('hidden');
        multimedia.classList.add('hidden');
    } else {
        settings.classList.remove('hidden');
        multimedia.classList.remove('hidden');
    }
}

document.getElementById('send-whatsapp').addEventListener('click', () => {
    if (cart.length === 0) {
        alert("El resumen está vacío.");
        return;
    }

    // Definimos el texto con emojis normales
    let mensaje = "*COTIZACIÓN DE PERSONALIZACIÓN AR*\n";
    mensaje += "*COTIZACIÓN MAYORISTA (POR DOCENA)*\n";
    mensaje += "-----------------------------------\n";
    
    cart.forEach((item, i) => {
        const pDocena = item.precio * 12;
        mensaje += `*${i+1}. ${item.nombre}*\n`;
        mensaje += `   Config: ${item.config}\n`;
        mensaje += `   Precio Unit: $${item.precio.toFixed(2)} | Precio Doc: $${pDocena.toFixed(2)}\n\n`;
    });

    const totalU = document.getElementById('grand-total').textContent;
    const totalD = document.getElementById('grand-total-doc').textContent;

    mensaje += "-----------------------------------\n";
    mensaje += `*TOTAL ESTIMADO UNITARIO: $${totalU}*\n`;
    mensaje += `*TOTAL ESTIMADO POR DOCENA: $${totalD}*\n\n`;
    
    // Aquí el emoji de advertencia funcionará bien
    mensaje += "*Nota: Precios válidos para pedidos mínimos de 12 unidades del mismo producto y con la misma configuración.*\n\n";
    mensaje += "_Referencia técnica para revisión mayorista._";

    const miTelefono = "593984272258"; 

    // IMPORTANTE: Usamos encodeURIComponent para que los emojis y saltos de línea no se rompan
    const textoFinal = encodeURIComponent(mensaje);
    
    window.open(`https://wa.me/${miTelefono}?text=${textoFinal}`, '_blank');
});
