import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateCentroDto } from './dto/update-centro.dto';
import { CreateCentroDto } from './dto/create-centro.dto';

@Injectable()
export class CentrosService {
  constructor(private readonly db: DatabaseService) {}

  /** Lista de centros de acopio. */
  findAll() {
    return this.db.query(`select * from public.centros_acopio order by nombre`);
  }

  /** Alta de un centro de acopio vía RPC `crear_acopio` (escritura segura). */
  async create(dto: CreateCentroDto) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.crear_acopio($1, $2, $3, $4, $5, $6) as r`,
      [
        dto.nombre,
        dto.ubicacion,
        dto.lat,
        dto.lng,
        dto.contacto ?? null,
        dto.responsable ?? null,
      ],
    );
    return row?.r;
  }

  /** Actualiza capacidad/insumos vía RPC `actualizar_acopio`. */
  async update(id: string, dto: UpdateCentroDto) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.actualizar_acopio($1, $2::capacidad_acopio, $3) as r`,
      [id, dto.capacidad, dto.insumos_solicitados],
    );
    return row?.r;
  }
}
