import { Body, Controller, Get, Post } from '@nestjs/common';
import { EdificiosService } from './edificios.service';
import { BatchEdificiosDto } from './dto/batch-edificios.dto';

@Controller('edificios')
export class EdificiosController {
  constructor(private readonly edificios: EdificiosService) {}

  /** GET /api/edificios — lista de edificios caídos */
  @Get()
  findAll() {
    return this.edificios.findAll();
  }

  /** POST /api/edificios/batch — alta masiva desde CSV */
  @Post('batch')
  createBatch(@Body() dto: BatchEdificiosDto) {
    return this.edificios.createBatch(dto.registros);
  }
}
