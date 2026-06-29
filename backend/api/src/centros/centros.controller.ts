import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CentrosService } from './centros.service';
import { UpdateCentroDto } from './dto/update-centro.dto';
import { CreateCentroDto } from './dto/create-centro.dto';
import { BatchCentrosDto } from './dto/batch-centros.dto';

@ApiTags('Centros de Acopio')
@Controller('centros')
export class CentrosController {
  constructor(private readonly centros: CentrosService) {}

  /** GET /api/centros */
  @Get()
  @ApiOperation({ summary: 'Obtener todos los centros de acopio, refugios u hospitales' })
  @ApiResponse({
    status: 200,
    description: 'Listado de centros de acopio.',
    schema: {
      example: [
        {
          id: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
          nombre: 'Centro de Acopio Gimnasio Papá Carrillo',
          ubicacion: 'Los Dos Caminos, Caracas',
          lat: 10.485,
          lng: -66.836,
          contacto: '0412-5556677',
          responsable: 'Comandante Luis Rivas',
          capacidad: 'abierto',
          insumos_solicitados: ['agua', 'medicinas'],
          tipo: 'acopio',
          created_at: '2026-06-29T10:00:00.000Z',
        },
      ],
    },
  })
  findAll() {
    return this.centros.findAll();
  }

  /** POST /api/centros — alta de un centro de acopio */
  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo centro de acopio, refugio u hospital' })
  @ApiResponse({
    status: 201,
    description: 'Centro registrado exitosamente.',
    schema: {
      example: {
        id: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
        nombre: 'Centro de Acopio Gimnasio Papá Carrillo',
        ubicacion: 'Los Dos Caminos, Caracas',
        lat: 10.485,
        lng: -66.836,
        contacto: '0412-5556677',
        responsable: 'Comandante Luis Rivas',
        capacidad: 'abierto',
        insumos_solicitados: [],
        tipo: 'acopio',
        created_at: '2026-06-29T10:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateCentroDto) {
    return this.centros.create(dto);
  }

  /** POST /api/centros/batch — alta masiva (acopio/refugio/hospital) desde CSV */
  @Post('batch')
  @ApiOperation({ summary: 'Registrar múltiples centros en masa (alta desde CSV/OCR)' })
  @ApiResponse({
    status: 201,
    description: 'Centros registrados exitosamente en masa.',
    schema: {
      example: { procesados: 4, nuevos: 4, errores: 0 },
    },
  })
  createBatch(@Body() dto: BatchCentrosDto) {
    return this.centros.createBatch(dto.registros);
  }

  /** PATCH /api/centros/:id */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar la capacidad o insumos solicitados de un centro' })
  @ApiParam({ name: 'id', description: 'ID único del centro (UUID)', example: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9' })
  @ApiResponse({
    status: 200,
    description: 'Centro actualizado exitosamente.',
    schema: {
      example: {
        id: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
        nombre: 'Centro de Acopio Gimnasio Papá Carrillo',
        capacidad: 'al_limite',
        insumos_solicitados: ['agua', 'medicinas'],
      },
    },
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCentroDto,
  ) {
    return this.centros.update(id, dto);
  }
}
