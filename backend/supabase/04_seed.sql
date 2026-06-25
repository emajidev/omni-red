-- =============================================================================
-- OmniRed · 04_seed.sql
-- Datos semilla FICTICIOS pero coherentes con la geografía de Venezuela
-- (Zona Norte-Central: Distrito Capital, La Guaira, Miranda, Aragua, Carabobo).
-- Estos mismos datos están replicados en frontend/src/app/core/data/mock-data.ts
-- para que la demo funcione idéntica con o sin backend.
-- =============================================================================

-- Limpieza idempotente (solo entorno de demo) --------------------------------
truncate table public.reportes_personas, public.centros_acopio,
               public.sismos, public.listas_ocr restart identity cascade;

-- -----------------------------------------------------------------------------
-- Una lista OCR de ejemplo ya procesada
-- -----------------------------------------------------------------------------
insert into public.listas_ocr (id, nombre_archivo, storage_path, estado,
  texto_extraido, registros_detectados, duplicados_unificados, subido_por)
values (
  '11111111-1111-1111-1111-111111111111',
  'lista_refugio_montalban.jpg',
  'listas_sismo/2026/06/lista_refugio_montalban.jpg',
  'completado',
  'REFUGIO MONTALBÁN - PERSONAS A SALVO: 1) María Rodríguez V-12.345.678 ...',
  3, 1, 'rescate.montalban'
);

-- -----------------------------------------------------------------------------
-- reportes_personas  (hash_dedup calculado por la función del servidor)
-- -----------------------------------------------------------------------------
insert into public.reportes_personas
  (nombre, cedula, estado, edad, ubicacion, lat, lng, fuente, detalle, reportado_por,
   veces_reportado, hash_dedup)
values
  ('María Alejandra Rodríguez', 'V-12.345.678', 'a_salvo', 34,
   'Refugio Montalbán, Caracas', 10.4225, -66.9510, 'ocr_lista',
   'Reportada a salvo en refugio. Familia notificada.', 'rescate.montalban', 2,
   public.calcular_hash_dedup('V-12.345.678','María Alejandra Rodríguez')),

  ('José Gregorio Pérez', 'V-15.678.901', 'desaparecido', 41,
   'Catia, Parroquia Sucre, Caracas', 10.5080, -66.9480, 'twitter',
   'No se le ve desde la primera réplica. Vestía camisa azul.', '@familiaperezccs', 3,
   public.calcular_hash_dedup('V-15.678.901','José Gregorio Pérez')),

  ('Carmen Teresa Hernández', 'V-9.876.543', 'desaparecido', 58,
   'Petare, Sector La Bombilla, Miranda', 10.4760, -66.8080, 'telegram',
   'Adulto mayor, requiere medicación para hipertensión.', 'brigada_petare', 1,
   public.calcular_hash_dedup('V-9.876.543','Carmen Teresa Hernández')),

  ('Luis Eduardo González', 'V-18.234.567', 'a_salvo', 27,
   'La Guaira, Maiquetía', 10.5940, -66.9870, 'web',
   'Reportó por formulario que está bien.', 'autorreporte', 1,
   public.calcular_hash_dedup('V-18.234.567','Luis Eduardo González')),

  ('Yetzabel Coromoto Marcano', 'V-20.111.222', 'desaparecido', 23,
   'El Valle, Caracas', 10.4500, -66.9200, 'twitter',
   'Estudiante UCV, sin señales desde la madrugada.', '@buscamosyetza', 2,
   public.calcular_hash_dedup('V-20.111.222','Yetzabel Coromoto Marcano')),

  ('Pedro Ramón Salazar', 'V-7.654.321', 'desaparecido', 63,
   'Los Teques, Miranda', 10.3440, -67.0410, 'whatsapp',
   'Salió a comprar agua y no regresó.', 'fam_salazar', 1,
   public.calcular_hash_dedup('V-7.654.321','Pedro Ramón Salazar')),

  ('Andreína Valentina Suárez', 'V-25.333.444', 'a_salvo', 19,
   'Chacao, Caracas', 10.4970, -66.8530, 'telegram',
   'A salvo con vecinos, edificio evacuado.', 'consejo_comunal_chacao', 1,
   public.calcular_hash_dedup('V-25.333.444','Andreína Valentina Suárez')),

  ('Wilmer Antonio Bracho', 'V-14.222.888', 'desaparecido', 47,
   'Maracay, Aragua', 10.2470, -67.5960, 'web',
   'Trabajaba en zona industrial al momento del sismo.', 'autorreporte', 1,
   public.calcular_hash_dedup('V-14.222.888','Wilmer Antonio Bracho')),

  ('Rosángela del Carmen Mora', 'V-16.789.012', 'a_salvo', 36,
   'Valencia, Carabobo', 10.1620, -68.0080, 'ocr_lista',
   'Listada como presente en albergue Naguanagua.', 'albergue_naguanagua', 1,
   public.calcular_hash_dedup('V-16.789.012','Rosángela del Carmen Mora')),

  ('Héctor Luis Ramírez', 'V-11.444.777', 'desaparecido', 52,
   'Guarenas, Miranda', 10.4710, -66.6110, 'twitter',
   'Reportado por dos vecinos distintos.', '@guarenasunida', 2,
   public.calcular_hash_dedup('V-11.444.777','Héctor Luis Ramírez')),

  ('Daniela Beatriz Linares', 'V-22.555.666', 'a_salvo', 29,
   'Baruta, Caracas', 10.4320, -66.8750, 'telegram',
   'Confirmada sana y salva por su hermana.', 'fam_linares', 1,
   public.calcular_hash_dedup('V-22.555.666','Daniela Beatriz Linares')),

  ('Francisco Javier Ovalles', 'V-8.123.456', 'desaparecido', 60,
   'Charallave, Valles del Tuy, Miranda', 10.2440, -66.8570, 'whatsapp',
   'Sin contacto, vive solo. Urgente.', 'cruz_roja_tuy', 1,
   public.calcular_hash_dedup('V-8.123.456','Francisco Javier Ovalles')),

  ('Gabriela Alexandra Fermín', 'V-19.876.000', 'a_salvo', 31,
   'La Victoria, Aragua', 10.2270, -67.3330, 'web',
   'Autorreporte: a salvo en casa de familiares.', 'autorreporte', 1,
   public.calcular_hash_dedup('V-19.876.000','Gabriela Alexandra Fermín')),

  ('Ángel David Mújica', 'V-13.999.111', 'desaparecido', 38,
   'Guatire, Miranda', 10.4760, -66.5400, 'twitter',
   'Bombero voluntario, no responde radio.', '@bomberosguatire', 2,
   public.calcular_hash_dedup('V-13.999.111','Ángel David Mújica'));

-- -----------------------------------------------------------------------------
-- centros_acopio
-- -----------------------------------------------------------------------------
insert into public.centros_acopio
  (nombre, ubicacion, lat, lng, capacidad, insumos_solicitados, contacto, responsable)
values
  ('Acopio UCV - Plaza del Rectorado', 'Ciudad Universitaria, Caracas',
   10.4910, -66.8900, 'abierto', array['agua','medicinas','alimentos'],
   '0212-555-1010', 'Coord. Voluntariado UCV'),

  ('Refugio Montalbán', 'Montalbán, Caracas',
   10.4225, -66.9510, 'al_limite', array['colchonetas','agua','pañales'],
   '0414-555-2020', 'Parroquia San Judas Tadeo'),

  ('Polideportivo Los Teques', 'Los Teques, Miranda',
   10.3440, -67.0410, 'abierto', array['alimentos','ropa','agua'],
   '0212-555-3030', 'Alcaldía de Guaicaipuro'),

  ('Albergue Naguanagua', 'Naguanagua, Carabobo',
   10.2470, -68.0150, 'al_limite', array['medicinas','agua'],
   '0241-555-4040', 'Protección Civil Carabobo'),

  ('Centro Diana - La Guaira', 'Catia La Mar, La Guaira',
   10.5980, -67.0250, 'cerrado', array[]::text[],
   '0212-555-5050', 'Bomberos Marinos'),

  ('Acopio Maracay - Plaza Bolívar', 'Maracay, Aragua',
   10.2467, -67.5960, 'abierto', array['agua','alimentos','linternas','medicinas'],
   '0243-555-6060', 'Cruz Roja Aragua');

-- -----------------------------------------------------------------------------
-- sismos  (réplicas recientes — orden cronológico inverso en el feed)
-- -----------------------------------------------------------------------------
insert into public.sismos (magnitud, epicentro, lat, lng, profundidad_km, fuente, ocurrido_en)
values
  (6.2, 'Costa de La Guaira',        10.7200, -66.9000, 12.5, 'FUNVISIS', now() - interval '6 hours'),
  (4.8, 'Norte de Caracas',          10.6100, -66.8700, 8.0,  'FUNVISIS', now() - interval '5 hours 10 min'),
  (3.9, 'Mar Caribe, frente a Vargas',10.8500, -67.0500, 15.2, 'USGS',     now() - interval '3 hours 40 min'),
  (4.1, 'Los Teques, Miranda',       10.3500, -67.0500, 6.5,  'FUNVISIS', now() - interval '2 hours 20 min'),
  (3.2, 'Valles del Tuy',            10.2300, -66.8800, 9.1,  'FUNVISIS', now() - interval '1 hour 5 min'),
  (2.8, 'Maracay, Aragua',           10.2600, -67.6000, 7.3,  'FUNVISIS', now() - interval '25 minutes');

-- Vincular un par de reportes a la lista OCR de ejemplo
update public.reportes_personas
   set lista_origen_id = '11111111-1111-1111-1111-111111111111'
 where cedula in ('V-12.345.678','V-16.789.012');
