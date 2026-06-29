import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from './database/database.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar estado del servicio y conexión a BD' })
  @ApiResponse({
    status: 200,
    description: 'Servicio en línea y hora actual del servidor de base de datos.',
    schema: {
      example: { status: 'ok', db: 'up', time: '2026-06-29T15:00:00.000Z' },
    },
  })
  async check() {
    const row = await this.db.queryOne<{ now: string }>('select now() as now');
    return { status: 'ok', db: 'up', time: row?.now };
  }
}
