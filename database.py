"""
Proyecto: KromaFlip - Base de Datos
Autor: Manuel Fereira
Descripción: Módulo para crear y gestionar la base de datos en SQLite. 
También incluye la lógica para "raspar" (scrapear) nuestra plantilla HTML original 
y meter sus datos en la BD de forma automática.
"""

import os
import re
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "revista.db")
REVISTA_HTML_PATH = os.path.join(BASE_DIR, "templates", "revista_portal.html")


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    # Permite acceder a las columnas por nombre en lugar de por índice (ej. fila["titulo"])
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ediciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            autor TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'nativa',
            archivo_url TEXT DEFAULT '',
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            es_activa INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paginas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            edicion_id INTEGER NOT NULL,
            numero_pagina INTEGER NOT NULL,
            categoria TEXT NOT NULL,
            titulo TEXT NOT NULL,
            subtitulo TEXT NOT NULL,
            contenido_html TEXT NOT NULL,
            FOREIGN KEY (edicion_id) REFERENCES ediciones (id) ON DELETE CASCADE
        )
    """)

    # Verificamos si la revista original ('nativa') ya existe en la base de datos
    edicion_nativa = cursor.execute(
        "SELECT id FROM ediciones WHERE tipo = 'nativa' ORDER BY id ASC LIMIT 1"
    ).fetchone()

    if edicion_nativa:
        # Si existe, actualizamos sus datos y refrescamos las páginas
        edicion_id = edicion_nativa["id"]
        cursor.execute("""
            UPDATE ediciones
            SET titulo = ?, autor = ?
            WHERE id = ?
        """, ("Portal • El futuro en tus manos", "Manuel Fereira", edicion_id))
        cursor.execute("DELETE FROM paginas WHERE edicion_id = ?", (edicion_id,))
        cargar_paginas_desde_html(cursor, edicion_id)
    else:
        # Si no existe, la creamos desde cero como la primera edición
        cursor.execute("""
            INSERT INTO ediciones (titulo, autor, tipo, archivo_url, es_activa)
            VALUES (?, ?, 'nativa', 'revista_portal.html', 1)
        """, ("Portal • El futuro en tus manos", "Manuel Fereira"))
        cargar_paginas_desde_html(cursor, cursor.lastrowid)

    conn.commit()
    conn.close()


def cargar_paginas_desde_html(cursor, edicion_id):
    if not os.path.exists(REVISTA_HTML_PATH):
        return

    with open(REVISTA_HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Usamos expresiones regulares (regex) para pescar los metadatos y el contenido 
    # de cada etiqueta <article>. Así poblamos la BD sin tener que transcribir el HTML a mano.
    patron = re.compile(
        r'<article\s+class="pagina-revista"\s+'
        r'data-numero="(\d+)"\s+'
        r'data-categoria="([^"]*)"\s+'
        r'data-titulo="([^"]*)"\s+'
        r'data-subtitulo="([^"]*)"\s*>'
        r'(.*?)</article>',
        re.DOTALL
    )

    for match in patron.finditer(html_content):
        num = int(match.group(1))
        categoria = match.group(2)
        titulo = match.group(3)
        subtitulo = match.group(4)
        cuerpo_html = match.group(5).strip()

        cursor.execute("""
            INSERT INTO paginas (edicion_id, numero_pagina, categoria, titulo, subtitulo, contenido_html)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (edicion_id, num, categoria, titulo, subtitulo, cuerpo_html))