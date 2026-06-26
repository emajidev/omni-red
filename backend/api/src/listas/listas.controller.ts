import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ListasService } from './listas.service';
import { CreateListaDto } from './dto/create-lista.dto';
import { UpdateListaDto } from './dto/update-lista.dto';

@Controller('listas')
export class ListasController {
  constructor(private readonly listas: ListasService) {}

  /** GET /api/listas */
  @Get()
  findAll() {
    return this.listas.findAll();
  }

  /** POST /api/listas */
  @Post()
  create(@Body() dto: CreateListaDto) {
    return this.listas.create(dto);
  }

  /** PATCH /api/listas/:id */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateListaDto,
  ) {
    return this.listas.update(id, dto);
  }
}
