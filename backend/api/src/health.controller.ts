import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    const row = await this.db.queryOne<{ now: string }>('select now() as now');
    return { status: 'ok', db: 'up', time: row?.now };
  }
}
