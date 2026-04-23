-- ============================================================
-- Esquema de base de datos - Auditoria App
-- ============================================================

CREATE TABLE IF NOT EXISTS aud_version (
    id INTEGER PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT,

    estado TEXT
        CHECK (estado IN ('BORRADOR','ACTIVA','OBSOLETA'))
        DEFAULT 'BORRADOR',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    id_version_padre INTEGER,

    FOREIGN KEY (id_version_padre)
        REFERENCES aud_version(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS aud_nivel1 (
    id INTEGER PRIMARY KEY,
    id_aud_version INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    orden_ejecucion INTEGER DEFAULT 0,
    orden_informe INTEGER DEFAULT 0,
    created_at TEXT,

    FOREIGN KEY (id_aud_version) REFERENCES aud_version(id)
);

CREATE TABLE IF NOT EXISTS aud_nivel2 (
    id INTEGER PRIMARY KEY,
    id_nivel1 INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    orden_ejecucion INTEGER DEFAULT 0,
    orden_informe INTEGER DEFAULT 0,
    created_at TEXT,

    FOREIGN KEY (id_nivel1) REFERENCES aud_nivel1(id)
);

CREATE TABLE IF NOT EXISTS aud_hallazgo_def (
    id INTEGER PRIMARY KEY,
    id_nivel2 INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    orden_ejecucion INTEGER DEFAULT 0,
    orden_informe INTEGER DEFAULT 0,
    descripcion TEXT NOT NULL,
    created_at TEXT,

    FOREIGN KEY (id_nivel2) REFERENCES aud_nivel2(id)
);

CREATE TABLE IF NOT EXISTS proyecto (
    id_proyecto INTEGER PRIMARY KEY,
    nombre_proyecto TEXT NOT NULL,
    objeto TEXT,
    obra TEXT,
    no_contrato TEXT,
    fecha_inicio TEXT,
    fecha_fin_pactado TEXT,
    fecha_fin_real TEXT,
    dias_interventoria_pactados INTEGER,
    valor_inicial REAL,
    id_estado_proyecto INTEGER,
    id_tipo_proyecto INTEGER,
    id_contratante INTEGER,
    recomendaciones_pendientes TEXT,
    caracteristicas_tecnicas TEXT
);

CREATE TABLE IF NOT EXISTS aud_proyecto (
    id INTEGER PRIMARY KEY,
    id_proyecto INTEGER NOT NULL,
    id_aud_version INTEGER NOT NULL,

    estado TEXT
        CHECK (estado IN ('EN_PROCESO','CERRADO'))
        DEFAULT 'EN_PROCESO',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_proyecto) REFERENCES proyecto(id_proyecto),
    FOREIGN KEY (id_aud_version) REFERENCES aud_version(id)
);

CREATE TABLE IF NOT EXISTS aud_resultado_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,

    id_aud_proyecto INTEGER NOT NULL,
    id_nivel2 INTEGER NOT NULL,

    conforme TEXT
        CHECK (conforme IN ('SI','NO') OR conforme IS NULL),

    observaciones TEXT,

    estado TEXT
        CHECK (estado IN ('SIN_AUDITAR','AUDITADO'))
        DEFAULT 'SIN_AUDITAR',

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT,

    pending_sync INTEGER DEFAULT 1
        CHECK (pending_sync IN (0,1)),

    FOREIGN KEY (id_aud_proyecto)
        REFERENCES aud_proyecto(id)
        ON DELETE CASCADE,

    FOREIGN KEY (id_nivel2)
        REFERENCES aud_nivel2(id),

    UNIQUE (id_aud_proyecto, id_nivel2)
);

CREATE TABLE IF NOT EXISTS aud_resultado_hallazgo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,

    id_resultado_item_uuid TEXT NOT NULL,
    id_hallazgo_def INTEGER,

    hallazgo_libre TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT,

    pending_sync INTEGER DEFAULT 1
        CHECK (pending_sync IN (0,1)),

    FOREIGN KEY (id_resultado_item_uuid)
        REFERENCES aud_resultado_item(uuid)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (id_hallazgo_def)
        REFERENCES aud_hallazgo_def(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS aud_hallazgo_evidencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,

    id_resultado_hallazgo_uuid TEXT NOT NULL,

    tipo TEXT
        CHECK (tipo IN ('IMAGEN','DOCUMENTO','VIDEO','OTRO'))
        DEFAULT 'IMAGEN',

    url TEXT,
    descripcion TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    deleted_at TEXT,

    pending_sync INTEGER DEFAULT 1
        CHECK (pending_sync IN (0,1)),

    file_local_path TEXT,

    FOREIGN KEY (id_resultado_hallazgo_uuid)
        REFERENCES aud_resultado_hallazgo(uuid)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_checkpoint (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_aud_proyecto INTEGER,
    last_sync_at TEXT
);
