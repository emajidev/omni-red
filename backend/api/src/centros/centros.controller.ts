import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CentrosService } from './centros.service';
import { UpdateCentroDto } from './dto/update-centro.dto';
import { CreateCentroDto } from './dto/create-centro.dto';

@Controller('centros')
export class CentrosController {
  constructor(private readonly centros: CentrosService) {}

  /** GET /api/centros */
  @Get()
  findAll() {
    return this.centros.findAll();
  }

  /** POST /api/centros — alta de un centro de acopio */
  @Post()
  create(@Body() dto: CreateCentroDto) {
    return this.centros.create(dto);
  }

  /** PATCH /api/centros/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCentroDto,
  ) {
    return this.centros.update(id, dto);
  }
}
