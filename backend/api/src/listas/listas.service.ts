import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateListaDto } from './dto/create-lista.dto';
import { UpdateListaDto } from './dto/update-lista.dto';

export interface ListaOcrRow {
  id: string;
  nombre_archivo: string;
  storage_path: string | null;
  estado: string;
  texto_extraido: string | null;
  registros_detectados: number;
  duplicados_unificados: number;
  subido_por: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ListasService {
  constructor(private readonly db: DatabaseService) {}

  /** Bitácora del pipeline OCR, más recientes primero. */
  findAll() {
    return this.db.query<ListaOcrRow>(
      `select * from public.listas_ocr order by created_at desc`,
    );
  }

  /** Crea una entrada del pipeline (RPC `registrar_lista_ocr`, p_id = null). */
  create(dto: CreateListaDto) {
    return this.db.queryOne<ListaOcrRow>(
      `select * from public.registrar_lista_ocr($1, $2, $3::estado_ocr, $4, $5, $6, $7, null)`,
      [
        dto.nombre_archivo,
        dto.storage_path ?? null,
        dto.estado ?? 'subiendo',
        dto.texto_extraido ?? null,
        dto.registros_detectados ?? 0,
        dto.duplicados_unificados ?? 0,
        dto.subido_por ?? null,
      ],
    );
  }

  /**
   * Actualiza una entrada. La RPC sobrescribe todos los campos, así que primero
   * leemos la fila actual y aplicamos encima solo lo enviado (PATCH real).
   */
  async update(id: string, dto: UpdateListaDto) {
    const current = await this.db.queryOne<ListaOcrRow>(
      `select * from public.listas_ocr where id = $1`,
      [id],
    );
    if (!current) {
      throw new NotFoundException('Lista OCR no encontrada');
    }
    return this.db.queryOne<ListaOcrRow>(
      `select * from public.registrar_lista_ocr($1, $2, $3::estado_ocr, $4, $5, $6, $7, $8)`,
      [
        dto.nombre_archivo ?? current.nombre_archivo,
        dto.storage_path ?? current.storage_path,
        dto.estado ?? current.estado,
        dto.texto_extraido ?? current.texto_extraido,
        dto.registros_detectados ?? current.registros_detectados,
        dto.duplicados_unificados ?? current.duplicados_unificados,
        current.subido_por,
        id,
      ],
    );
  }
}
