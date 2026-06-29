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
import { ListasService } from './listas.service';
import { CreateListaDto } from './dto/create-lista.dto';
import { UpdateListaDto } from './dto/update-lista.dto';

@ApiTags('Listas')
@Controller('listas')
export class ListasController {
  constructor(private readonly listas: ListasService) {}

  /** GET /api/listas */
  @Get()
  @ApiOperation({ summary: 'Obtener todas las listas/censos de personas cargados por OCR' })
  @ApiResponse({
    status: 200,
    description: 'Listado de censos OCR registrados.',
    schema: {
      example: [
        {
          id: 'c1d2e3f4-0000-0000-0000-aabbccddeeff',
          nombre_archivo: 'lista_refugiados_bolivariana.pdf',
          storage_path: 'listas/lista_refugiados_bolivariana.pdf',
          estado: 'completado',
          registros_detectados: 15,
          duplicados_unificados: 2,
          subido_por: 'admin_maria',
          created_at: '2026-06-29T10:00:00.000Z',
        },
      ],
    },
  })
  findAll() {
    return this.listas.findAll();
  }

  /** POST /api/listas */
  @Post()
  @ApiOperation({ summary: 'Registrar una nueva lista/censo para procesamiento OCR' })
  @ApiResponse({
    status: 201,
    description: 'Lista registrada exitosamente. Inicia el pipeline OCR.',
    schema: {
      example: {
        id: 'c1d2e3f4-0000-0000-0000-aabbccddeeff',
        nombre_archivo: 'lista_refugiados_bolivariana.pdf',
        estado: 'subiendo',
        created_at: '2026-06-29T10:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateListaDto) {
    return this.listas.create(dto);
  }

  /** PATCH /api/listas/:id */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar el estado o datos de una lista OCR (usado por el pipeline)' })
  @ApiParam({ name: 'id', description: 'ID único de la lista (UUID)', example: 'c1d2e3f4-0000-0000-0000-aabbccddeeff' })
  @ApiResponse({
    status: 200,
    description: 'Lista actualizada exitosamente.',
    schema: {
      example: {
        id: 'c1d2e3f4-0000-0000-0000-aabbccddeeff',
        estado: 'completado',
        registros_detectados: 15,
        duplicados_unificados: 2,
      },
    },
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateListaDto,
  ) {
    return this.listas.update(id, dto);
  }
}
