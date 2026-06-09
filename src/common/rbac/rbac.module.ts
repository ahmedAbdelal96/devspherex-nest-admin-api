import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EffectivePermissionsService } from './services/effective-permissions.service';

@Global()
@Module({
  providers: [
    PrismaService,
    EffectivePermissionsService,
  ],
  exports: [EffectivePermissionsService],
})
export class RbacModule {}