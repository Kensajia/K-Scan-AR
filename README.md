# K-Scan-AR

---

## 🎨 K-Scan AR: Realidad Aumentada para Sublimados

* **Tecnología de RA:** **MindAR** (WebAR Framework)
* **Alojamiento del Código:** GitHub Pages (Plan Gratuito)
* **Alojamiento Multimedia:** **Catbox.moe**
* **Objetivo:** Potenciar productos sublimados con contenido digital.

---

### 💡 Descripción del Proyecto

**K-Scan AR** es una solución de Realidad Aumentada (RA) basada en la web, diseñada para **agregar una capa digital y atractiva a los productos sublimados** (tazas, camisetas, llaveros, etc.).

Utilizando la tecnología **MindAR**, la imagen sublimada impresa se convierte en un **marcador digital**. Al escanear la imagen con la cámara del teléfono, se activa y reproduce el contenido multimedia asociado (videos, audios, modelos 3D) que está alojado de forma segura en un servidor externo.

**El objetivo es transformar un producto físico estático en una experiencia multimedia interactiva y personalizada para el cliente.**

---

### ✨ Puntos Clave y Beneficios

1.  **Modelo de Hosting Optimizado:** El código ligero (GitHub Pages) y los archivos pesados (Catbox.moe) están separados para optimizar el rendimiento y controlar los costos de hosting.
2.  **Gestión de Perfiles Locales:** La aplicación guarda los códigos de acceso y nombres en la memoria local del navegador del cliente, permitiendo un **acceso rápido** a productos comprados anteriormente.
3.  **Activación Exclusiva por Código:** La aplicación requiere un código único para cargar el contenido personalizado, garantizando la privacidad y el acceso controlado.
4.  **WebAR sin Apps:** Los clientes acceden a la RA directamente desde el navegador de su teléfono (Android o iOS), sin descargas adicionales.
5.  **MindAR de Alto Rendimiento:** Asegura un reconocimiento de imagen rápido y preciso para una experiencia de usuario fluida.

---

### ⚙️ Requisitos y Uso (Experiencia del Cliente)

Para disfrutar de la Realidad Aumentada de tu producto sublimado, solo necesitas:

1.  Un **smartphone** moderno.
2.  Acceder al enlace proporcionado: **[K-Scan AR Web](https://kensajia.github.io/K-Scan-AR/)**
3.  **Proceso de Acceso y Gestión de Perfiles:**
    * **Ingreso Inicial:** El cliente debe ingresar obligatoriamente un **código de acceso único**.
    * **Nombre Opcional:** Puede ingresar un nombre junto al código para identificar el producto guardado. (Si está vacío, el código se usa como nombre).
    * **Almacenamiento Local:** El perfil (Nombre/Código) se guarda en la **memoria local del navegador** del cliente.
4.  **Uso de Perfiles Guardados:** Los clientes pueden **seleccionar un código guardado** para acceder instantáneamente, o **agregar/eliminar** perfiles de su dispositivo.
5.  Permitir el acceso a la **cámara** del navegador.
6.  **Apuntar la cámara directamente a la imagen sublimada** que actúa como marcador.

> **¡Nota de Acceso!** La visualización del contenido personalizado solo es posible después de seleccionar o ingresar un código válido.

---

### 💻 Estructura del Repositorio y Hosting de Contenido

Este proyecto implementa una **arquitectura de separación de datos** para optimizar el control y rendimiento:

#### 1. Repositorio GitHub (Código y Llaves)

El repositorio público aloja la lógica frontal y los archivos necesarios para el reconocimiento:

* `/assets`: Contiene los archivos de patrones de imagen generados por MindAR (`.mind`). **Estos archivos son públicos** y actúan como la "llave" para el reconocimiento del patrón.
* `index.html` y Scripts JS: La aplicación web responsable de la interfaz, la validación del código de acceso y la gestión de la memoria local.

#### 2. Servidor de Contenido Multimedia

Todo el contenido de alto valor (videos, audios y modelos 3D) se aloja de forma externa:

* **Plataforma:** **`https://catbox.moe/`** (u otros servicios CDN).
* **Seguridad:** El contenido solo se carga mediante la URL generada por la aplicación tras la validación del código, garantizando que el contenido **no está visible** ni indexado en el repositorio de GitHub.

---

### 🔒 Uso Exclusivo

Este proyecto es una herramienta comercial de **uso y gestión personal** para el negocio de sublimados. **No se aceptan contribuciones externas.**

---
