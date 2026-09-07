import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissionsAny } from '../../../common/security/authorization.decorators.js';
import { CrmCommunicationHealthService } from '../application/services/crm-communication-health.service.js';

@ApiTags('CRM Communication')
@ApiBearerAuth()
@Controller({ path: 'crm/communications/health', version: '1' })
@UseGuards(AuthenticatedAccessGuard, AuthorizationGuard)
export class CrmCommunicationHealthController {
  constructor(private readonly health: CrmCommunicationHealthService) {}

  @Get()
  @RequirePermissionsAny('crm.communications.read', 'crm.activities.read', 'sales.manage')
  @ApiOperation({ summary: 'Read safe communication provider configuration health' })
  @ApiResponse({ status: 200, schema: { type: 'object', additionalProperties: true } })
  status() {
    return this.health.status();
  }
}
