/**
 * Proyecto: KromaFlip - Frontend y motor 3D
 * Autor: Manuel Fereira
 * Descripción: Todo el aspecto visual del Flipbook. Controla los eventos del DOM 
 * y calcula las rotaciones CSS 3D para que el paso de página se sienta natural.
 */

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

let currentSheet = 0;
let totalSheets = 5;
let totalPagesCount = 10;
let zoomLevel = 1;

const book = document.getElementById("book");
const bookWrapper = document.getElementById("book-wrapper");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageSlider = document.getElementById("page-slider");
const spreadIndicator = document.getElementById("spread-indicator");
const selectorEdiciones = document.getElementById("selector-ediciones");

document.addEventListener("DOMContentLoaded", () => {
    inicializarTema();
    cargarRevistaActiva();
    inicializarControles();
});

function inicializarTema() {
    const btnTheme = document.getElementById("btn-theme-toggle");
    if (!btnTheme) return;

    const savedTheme = localStorage.getItem("kroma_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        btnTheme.textContent = "🌙 Modo oscuro";
    } else {
        document.body.classList.remove("light-mode");
        btnTheme.textContent = "☀️ Modo claro";
    }

    btnTheme.addEventListener("click", () => {
        const isLight = document.body.classList.toggle("light-mode");
        localStorage.setItem("kroma_theme", isLight ? "light" : "dark");
        btnTheme.textContent = isLight ? "🌙 Modo oscuro" : "☀️ Modo claro";
    });
}

async function cargarRevistaActiva() {
    const res = await fetch("/api/revista");
    const data = await res.json();
    await montarEdicion(data);
}

async function montarEdicion(data) {
    const { edicion, paginas, ediciones_disponibles } = data;
    currentSheet = 0;

    document.getElementById("nav-magazine-title").textContent = edicion.titulo;
    document.getElementById("nav-magazine-meta").textContent = `Autor: ${edicion.autor}`;

    selectorEdiciones.innerHTML = "";
    ediciones_disponibles.forEach((ed) => {
        const opt = document.createElement("option");
        opt.value = ed.id;
        opt.textContent = `${ed.titulo} (${ed.tipo.toUpperCase()})`;
        if (ed.id === edicion.id) opt.selected = true;
        selectorEdiciones.appendChild(opt);
    });

    if (edicion.tipo === "pdf") {
        await construirLibroDesdePDF(edicion.archivo_url, edicion.titulo);
    } else {
        construirLibroHTML(paginas, edicion.autor);
    }

    actualizarEstadoFisicoLibro();
}

function construirLibroHTML(paginas, autor) {
    book.innerHTML = "";
    totalPagesCount = paginas.length;
    totalSheets = Math.ceil(totalPagesCount / 2);
    pageSlider.max = totalSheets;
    pageSlider.value = 0;

    for (let s = 0; s < totalSheets; s++) {
        const frontData = paginas[s * 2];
        const backData = paginas[s * 2 + 1];

        const sheet = document.createElement("section");
        sheet.className = "sheet";
        sheet.dataset.sheetIndex = s;

        const frontFace = crearCaraHTML(frontData, "page-front", autor);
        frontFace.addEventListener("click", (e) => {
            if (!e.target.closest(".ed-toc-row")) irAHoja(s + 1);
        });

        const backFace = crearCaraHTML(backData, "page-back", autor);
        backFace.addEventListener("click", (e) => {
            if (!e.target.closest(".ed-toc-row")) irAHoja(s);
        });

        sheet.appendChild(frontFace);
        sheet.appendChild(backFace);
        book.appendChild(sheet);
    }
}

function crearCaraHTML(pageObj, faceClass, autor) {
    const face = document.createElement("div");
    const isCover = pageObj && pageObj.numero_pagina === 1;
    face.className = `page ${faceClass} ${isCover ? "is-cover-page" : ""}`;

    if (!pageObj) {
        face.innerHTML = `<div class="page-body-slot"></div>`;
        return face;
    }

    const numFormatted = String(pageObj.numero_pagina).padStart(2, "0");

    face.innerHTML = `
        <div class="page-header-bar">
            <span class="cat-tag">${pageObj.categoria}</span>
            <span>Portal • Revista digital</span>
        </div>
        <hgroup class="page-hgroup">
            <h2>${pageObj.titulo}</h2>
            <p>${pageObj.subtitulo}</p>
        </hgroup>
        <div class="page-body-slot">
            ${pageObj.contenido_html}
        </div>
        <div class="page-footer-bar">
            <span>${autor}</span>
            <span class="big-folio-num">${numFormatted}</span>
        </div>
    `;
    return face;
}

async function construirLibroDesdePDF(pdfUrl, titulo) {
    book.innerHTML = "";
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    totalPagesCount = pdf.numPages;
    const evenPagesCount = totalPagesCount % 2 === 0 ? totalPagesCount : totalPagesCount + 1;
    totalSheets = evenPagesCount / 2;
    pageSlider.max = totalSheets;
    pageSlider.value = 0;

    for (let s = 0; s < totalSheets; s++) {
        const frontPageNum = s * 2 + 1;
        const backPageNum = s * 2 + 2;

        const sheet = document.createElement("section");
        sheet.className = "sheet";
        sheet.dataset.sheetIndex = s;

        const frontFace = document.createElement("div");
        frontFace.className = "page page-front pdf-page-canvas-container";
        const frontCanvas = document.createElement("canvas");
        frontCanvas.className = "pdf-canvas";
        frontFace.appendChild(frontCanvas);
        frontFace.addEventListener("click", () => irAHoja(s + 1));

        const backFace = document.createElement("div");
        backFace.className = "page page-back pdf-page-canvas-container";
        const backCanvas = document.createElement("canvas");
        backCanvas.className = "pdf-canvas";
        backFace.appendChild(backCanvas);
        backFace.addEventListener("click", () => irAHoja(s));

        sheet.appendChild(frontFace);
        sheet.appendChild(backFace);
        book.appendChild(sheet);

        if (frontPageNum <= totalPagesCount) {
            renderizarPaginaPDFEnCanvas(pdf, frontPageNum, frontCanvas);
        }
        if (backPageNum <= totalPagesCount) {
            renderizarPaginaPDFEnCanvas(pdf, backPageNum, backCanvas);
        } else {
            backFace.innerHTML = `<div class="ed-backcover"><strong>${titulo}</strong><span>Fin de la publicación</span></div>`;
        }
    }
}

/**
 * Dibuja la página del PDF dentro de un canvas.
 * Ojo: Usamos el devicePixelRatio para aplicar super-sampling. Esto hace que 
 * el texto y las imágenes se vean súper nítidos y no se pixelen al hacer zoom.
 */
async function renderizarPaginaPDFEnCanvas(pdf, pageNumber, canvas) {
    const page = await pdf.getPage(pageNumber);
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: 1.8 * dpr });
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    await page.render({ canvasContext: ctx, viewport }).promise;
}

/**
 * Actualiza las físicas del libro. 
 * Cada vez que pasas la página, recalcula las clases CSS y el z-index de las hojas 
 * para que siempre se vea ordenado y con la perspectiva 3D correcta.
 */
function actualizarEstadoFisicoLibro() {
    const sheets = document.querySelectorAll("section.sheet");

    book.classList.remove("open-spread", "closed-back");
    if (currentSheet > 0 && currentSheet < totalSheets) {
        book.classList.add("open-spread");
    } else if (currentSheet === totalSheets) {
        book.classList.add("closed-back");
    }

    sheets.forEach((sheet, idx) => {
        if (idx < currentSheet) {
            sheet.classList.add("flipped");
            sheet.style.zIndex = idx + 1;
        } else {
            sheet.classList.remove("flipped");
            sheet.style.zIndex = totalSheets - idx;
        }
    });

    btnPrev.disabled = currentSheet === 0;
    btnNext.disabled = currentSheet === totalSheets;
    pageSlider.value = currentSheet;

    if (currentSheet === 0) {
        spreadIndicator.textContent = `Portada (página 01 de ${totalPagesCount})`;
    } else if (currentSheet === totalSheets) {
        spreadIndicator.textContent = `Contraportada (página ${totalPagesCount} de ${totalPagesCount})`;
    } else {
        const leftPage = String(currentSheet * 2).padStart(2, "0");
        const rightPage = String(Math.min(currentSheet * 2 + 1, totalPagesCount)).padStart(2, "0");
        spreadIndicator.textContent = `Páginas ${leftPage} y ${rightPage} de ${totalPagesCount}`;
    }
}

function irAHoja(sheetIdx) {
    currentSheet = Math.max(0, Math.min(totalSheets, sheetIdx));
    actualizarEstadoFisicoLibro();
}

window.irAPagina = function (numPagina) {
    if (numPagina <= 1) {
        irAHoja(0);
    } else if (numPagina >= totalPagesCount) {
        irAHoja(totalSheets);
    } else {
        const targetSheet = Math.floor(numPagina / 2);
        irAHoja(targetSheet);
    }
};

function inicializarControles() {
    btnPrev.addEventListener("click", () => irAHoja(currentSheet - 1));
    btnNext.addEventListener("click", () => irAHoja(currentSheet + 1));

    pageSlider.addEventListener("input", (e) => {
        irAHoja(parseInt(e.target.value, 10));
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") irAHoja(currentSheet + 1);
        if (e.key === "ArrowLeft") irAHoja(currentSheet - 1);
    });

    selectorEdiciones.addEventListener("change", async (e) => {
        const res = await fetch(`/api/revista/${e.target.value}`);
        const data = await res.json();
        await montarEdicion(data);
    });

    document.getElementById("btn-zoom-in").addEventListener("click", () => {
        zoomLevel = Math.min(1.45, +(zoomLevel + 0.15).toFixed(2));
        aplicarZoom();
    });

    document.getElementById("btn-zoom-out").addEventListener("click", () => {
        zoomLevel = Math.max(0.7, +(zoomLevel - 0.15).toFixed(2));
        aplicarZoom();
    });

    document.getElementById("btn-fullscreen").addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    const modal = document.getElementById("modal-upload");
    const form = document.getElementById("form-upload");
    const msg = document.getElementById("upload-msg");

    document.getElementById("btn-open-upload").addEventListener("click", () => {
        modal.classList.remove("hidden");
    });

    document.getElementById("btn-close-upload").addEventListener("click", () => {
        modal.classList.add("hidden");
        msg.textContent = "";
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msg.textContent = "Desplegando documento en KromaFlip...";
        const formData = new FormData(form);

        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok) {
                msg.textContent = data.error || "Error al subir el archivo.";
                return;
            }
            await montarEdicion(data);
            modal.classList.add("hidden");
            form.reset();
            msg.textContent = "";
        } catch (err) {
            msg.textContent = "Error al conectar con el servidor.";
        }
    });
}

function aplicarZoom() {
    bookWrapper.style.transform = `scale(${zoomLevel})`;
    document.getElementById("zoom-label").textContent = `${Math.round(zoomLevel * 100)}%`;
}