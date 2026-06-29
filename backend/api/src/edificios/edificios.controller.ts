import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EdificiosService } from './edificios.service';
import { EdificiosSyncService } from './edificios-sync.service';
import { BatchEdificiosDto } from './dto/batch-edificios.dto';
import { CreateEdificioDto } from './dto/create-edificio.dto';

@ApiTags('Edificios Afectados')
@Controller('edificios')
export class EdificiosController {
  constructor(
    private readonly edificios: EdificiosService,
    private readonly sync: EdificiosSyncService,
  ) {}

  /** GET /api/edificios — lista de edificios caídos */
  @Get()
  @ApiOperation({ summary: 'Obtener la lista de edificios afectados o caídos' })
  @ApiResponse({
    status: 200,
    description: 'Listado de edificios afectados.',
    schema: {
      example: [
        {
          id: 'b55e81d7-2f63-4712-ba78-18e4726a45e9',
          nombre: 'Edificio Don Bosco',
          ubicacion: 'Altamira, Caracas',
          lat: 10.496,
          lng: -66.848,
          nivel_dano: 'colapsado',
          personas_atrapadas: 4,
          estado: 'en_rescate',
          contacto: '0412-1111222',
          fuente: 'llamada',
          created_at: '2026-06-29T10:00:00.000Z',
        },
      ],
    },
  })
  findAll() {
    return this.edificios.findAll();
  }

  /** POST /api/edificios — reporta (crea) un edificio afectado */
  @Post()
  @ApiOperation({ summary: 'Reportar un nuevo edificio afectado' })
  @ApiResponse({
    status: 201,
    description: 'Edificio registrado exitosamente.',
    schema: {
      example: {
        id: 'b55e81d7-2f63-4712-ba78-18e4726a45e9',
        nombre: 'Edificio Don Bosco',
        ubicacion: 'Altamira, Caracas',
        lat: 10.496,
        lng: -66.848,
        nivel_dano: 'colapsado',
        personas_atrapadas: 4,
        estado: 'reportado',
        contacto: '0412-1111222',
        fuente: 'web',
        created_at: '2026-06-29T10:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateEdificioDto) {
    return this.edificios.create(dto);
  }

  /** POST /api/edificios/batch — alta masiva desde CSV */
  @Post('batch')
  @ApiOperation({ summary: 'Registrar múltiples edificios en masa desde una carga CSV/OCR' })
  @ApiResponse({
    status: 201,
    description: 'Edificios registrados exitosamente en masa.',
    schema: {
      example: { procesados: 5, nuevos: 5, errores: 0 },
    },
  })
  createBatch(@Body() dto: BatchEdificiosDto) {
    return this.edificios.createBatch(dto.registros);
  }

  /**
   * POST /api/edificios/sync — ingesta del mapa público de
   * terremotovenezuela.com hacia `edificios_caidos` (upsert idempotente).
   */
  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar datos de edificios afectados desde la API externa de TerremotoVenezuela' })
  @ApiResponse({
    status: 200,
    description: 'Edificios sincronizados exitosamente.',
    schema: {
      example: { procesados: 15, insertados: 1, actualizados: 2, errores: 0 },
    },
  })
  syncExternal() {
    return this.sync.syncFromTerremoto();
  }
}
