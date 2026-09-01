import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrmService } from '../application/crm.service.js';
import { InquiryDto } from './crm.dto.js';
import { Public } from '../../../common/security/authorization.decorators.js';

@ApiTags('CRM Public Inquiry')
@Controller({ path: 'crm/public', version: '1' })
export class CrmPublicInquiryController {
  constructor(private readonly service: CrmService) {}

  @Post('inquiries')
  @Public()
  @ApiOperation({ summary: 'Public CRM inquiry intake' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 413 })
  @ApiResponse({ status: 429 })
  submit(@Body() dto: InquiryDto) {
    if (dto.website?.trim()) return { data: null };
    return this.service
      .inquiry({ ...dto }, undefined)
      .then((value) => ({ data: value }));
  }
}
