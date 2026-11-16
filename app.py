"""
Proyecto: KromaFlip - Backend y API
Autor: Manuel Fereira
Descripción: Archivo principal de Flask. Se encarga de levantar el servidor, manejar las rutas, 
recibir los PDFs o Words que sube el usuario y enviarle la información estructurada al frontend.
"""

import os
import html
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from docx import Document
from database import init_db, get_db_connection

app = Flask(__name__)

# Prevención: si la carpeta 'uploads' no existe al arrancar, Python la crea 
# automáticamente gracias a exist_ok=True, evitando que el servidor colapse.
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# Límite de seguridad: restringimos el peso máximo de los archivos subidos a 32 MB
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024

init_db()


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/uploads/<path:filename>")
def servir_archivo(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/api/revista", methods=["GET"])
def obtener_revista_activa():
    conn = get_db_connection()
    # Buscamos cuál es la edición que el usuario marcó para leer
    edicion = conn.execute("SELECT * FROM ediciones WHERE es_activa = 1 ORDER BY id DESC LIMIT 1").fetchone()
    
    if not edicion:
        # Si no hay ninguna activa, caemos por defecto en la primera (la revista nativa)
        edicion = conn.execute("SELECT * FROM ediciones ORDER BY id ASC LIMIT 1").fetchone()

    paginas = conn.execute(
        "SELECT * FROM paginas WHERE edicion_id = ? ORDER BY numero_pagina ASC",
        (edicion["id"],)
    ).fetchall()

    todas = conn.execute("SELECT id, titulo, tipo, archivo_url, es_activa FROM ediciones ORDER BY id DESC").fetchall()
    conn.close()

    # Convertimos las filas (Rows) a diccionarios para poder enviarlos como JSON al frontend
    return jsonify({
        "edicion": dict(edicion),
        "paginas": [dict(p) for p in paginas],
        "ediciones_disponibles": [dict(e) for e in todas]
    })


@app.route("/api/revista/<int:edicion_id>", methods=["GET"])
def cambiar_edicion(edicion_id):
    conn = get_db_connection()
    # Apagamos la bandera de activa en todas las ediciones...
    conn.execute("UPDATE ediciones SET es_activa = 0")
    # ...y la encendemos solo en la que el usuario seleccionó
    conn.execute("UPDATE ediciones SET es_activa = 1 WHERE id = ?", (edicion_id,))
    conn.commit()
    conn.close()
    return obtener_revista_activa()


@app.route("/api/upload", methods=["POST"])
def subir_documento():
    """
    Recibe y procesa los documentos que sube el usuario.
    - Si es un PDF, solo guarda la ruta para que el motor 3D lo dibuje nativamente.
    - Si es un Word (.docx), extrae todo el texto, lo divide en fragmentos (chunks) 
      y arma las páginas HTML al vuelo para guardarlas en la base de datos.
    """
    if "archivo" not in request.files:
        return jsonify({"error": "No se envió ningún archivo"}), 400

    file = request.files["archivo"]
    titulo = request.form.get("titulo", "").strip() or file.filename.rsplit(".", 1)[0]
    autor = request.form.get("autor", "").strip() or "Manuel Fereira"

    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Sube un archivo válido (.pdf o .docx)"}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE ediciones SET es_activa = 0")

    if ext == "pdf":
        file_url = f"/uploads/{filename}"
        cursor.execute("""
            INSERT INTO ediciones (titulo, autor, tipo, archivo_url, es_activa)
            VALUES (?, ?, 'pdf', ?, 1)
        """, (titulo, autor, file_url))
    else:
        # Procesamos el Word: extraemos los párrafos ignorando los que estén casi vacíos
        doc = Document(filepath)
        paras = [p.text.strip() for p in doc.paragraphs if len(p.text.strip()) > 5]
        if not paras:
            paras = ["Documento importado correctamente."]

        cursor.execute("""
            INSERT INTO ediciones (titulo, autor, tipo, archivo_url, es_activa)
            VALUES (?, ?, 'docx', ?, 1)
        """, (titulo, autor, filename))
        edicion_id = cursor.lastrowid

        secciones = [
            "Portada", "Editorial y directorio", "Índice",
            "Contenido • Introducción", "Contenido • Parte 1",
            "Contenido • Parte 2", "Contenido • Parte 3",
            "Contenido • Parte 4", "Conclusiones y créditos", "Contraportada"
        ]
        
        # Matemática de paginación: dividimos el total de párrafos entre las 8 
        # páginas de contenido real (sin contar portada y contraportada)
        chunk = max(1, len(paras) // 8)
        for i in range(10):
            num = i + 1
            cat = secciones[i]
            start = max(0, (i - 1) * chunk)
            # Tomamos una porción de los párrafos para esta página
            subset = paras[start:start + chunk] or paras[:2]
            body = "<div class='ed-top-photo-layout'>" + "".join(
                f"<p class='ed-paragraph'>{html.escape(p)}</p>" for p in subset[:4]
            ) + "</div>"

            cursor.execute("""
                INSERT INTO paginas (edicion_id, numero_pagina, categoria, titulo, subtitulo, contenido_html)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (edicion_id, num, cat, f"{titulo} • Sección {num}", f"Archivo: {filename}", body))

    conn.commit()
    conn.close()
    return obtener_revista_activa()


if __name__ == "__main__":
    app.run(debug=True, port=5000)