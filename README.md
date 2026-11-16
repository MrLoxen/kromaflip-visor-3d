# KromaFlip - Motor interactivo 3D para publicaciones digitales

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

KromaFlip es una aplicación web Full-stack diseñada para transformar documentos planos (PDF y DOCX) en experiencias de lectura inmersivas. Utilizando un motor de físicas 3D construido completamente desde cero, el sistema emula el comportamiento de un libro real directamente en el navegador.

Este proyecto destaca por su arquitectura sin dependencias pesadas en el frontend, el manejo avanzado del DOM y un backend robusto capaz de procesar, fragmentar e inyectar documentos en una base de datos relacional.

## Características técnicas destacadas

* **Motor 3D nativo:** desarrollo de físicas de rotación de páginas utilizando exclusivamente Vanilla JavaScript y CSS 3D (`rotateY`, `translateZ`, `perspective`), logrando transiciones fluidas a 60 FPS sin depender de librerías externas de animación.

* **Renderizado PDF con super-muestreo:** integración de la API de `PDF.js` para dibujar páginas sobre elementos `<canvas>`. Se implementó una técnica de cálculo de densidad de píxeles (`devicePixelRatio`) para garantizar que los vectores y textos mantengan una nitidez absoluta al aplicar zoom, evitando el pixelado tradicional.

* **Procesamiento y fragmentación de texto (Chunking):** el backend en Flask utiliza `python-docx` para leer archivos Word, limpiar la data (ignorando saltos de línea vacíos) y dividir los párrafos matemáticamente para inyectarlos como páginas HTML individuales en la base de datos.

* **Población automática de BD (Scraping interno):** uso de expresiones regulares (Regex) para analizar la plantilla HTML original y extraer metadatos estructurados, poblando la base de datos de manera automatizada.

## Instalación y uso en entorno local

1. **Clona este repositorio:**

   ```bash
   git clone https://github.com/MrLoxen/kromaflip-visor-3d.git
   cd kromaflip-visor-3d
   ```

2. **Crea y activa un entorno virtual:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows usa: venv\Scripts\activate
   ```

3. **Instala las dependencias del servidor:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Inicia el servidor backend:**

   ```bash
   python app.py
   ```

   El sistema creará automáticamente la base de datos `revista.db` y el directorio seguro de cargas `/uploads` al iniciar por primera vez.

5. **Accede a la plataforma:**
   Abre tu navegador web e ingresa a `http://127.0.0.1:5000/`.

## Arquitectura del sistema

* `app.py`: controlador principal (backend). Gestiona las rutas de la API REST, la lógica de subida de archivos pesados y la comunicación estructurada mediante JSON.
* `database.py`: capa de acceso a datos. Inicializa el esquema relacional en SQLite y gestiona el raspado de la plantilla base.
* `templates/index.html`: estructura principal de la plataforma KromaFlip, donde se monta el visor 3D, la barra de herramientas y la interfaz de carga de documentos.
* `templates/revista_portal.html`: maquetación editorial pura con sistema de grillas y vectores SVG incrustados, utilizada por el backend como plantilla semántica para poblar la base de datos en el primer inicio.
* `static/js/main.js`: motor lógico del frontend. Controla la paginación dinámica, el cálculo del índice de apilamiento (z-index) y el renderizado asíncrono de documentos PDF.
* `static/css/styles.css`: sistema de diseño adaptativo y variables en alta definición, con soporte nativo para alternar entre temas claros y oscuros (Dark Mode).

## Autor

**Manuel Enrique Fereira Colmenares**
Desarrollador Full-stack y estudiante de ingeniería en sistemas.