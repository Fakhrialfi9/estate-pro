import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard.js';
import { AuthorizationGuard } from '../../../common/security/authorization.guard.js';
import { RequirePermissions } from '../../../common/security/authorization.decorators.js';
import { PropertyExtrasService } from '../application/property-extras.service.js';
import {
  PropertyCertificateDto,
  PropertyCertificateUpdateDto,
  PropertyEnvironmentDto,
  PropertyFeaturesDto,
  PropertyFinancialDto,
  PropertyLegalDto,
  PropertyMediaDto,
  PropertyMediaUpdateDto,
  PropertySecurityDto,
  PropertySeoDto,
  PropertyUtilityDto,
  ReorderMediaDto,
} from '../application/dto/property-extras.dto.js';

type R = Request & { user?: { sub?: string } };
const actor = (r: R, ua?: string, requestId?: string) => ({
  actorUuid: r.user?.sub,
  ipAddress: r.ip,
  userAgent: ua,
  requestId,
});
const out = (data: unknown) => ({ data });
@ApiTags('Property Extras')
@ApiBearerAuth()
@Controller({ path: 'property/properties/:propertyUuid', version: '1' })
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class PropertyExtrasController {
  constructor(private readonly s: PropertyExtrasService) {}
  @Get('utilities') @RequirePermissions('property-utilities.read') getUtilities(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getUtilities(id).then(out);
  }
  @Patch('utilities')
  @RequirePermissions('property-utilities.update')
  updateUtilities(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyUtilityDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateUtilities(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('legal') @RequirePermissions('property-legal.read') getLegal(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getLegal(id).then(out);
  }
  @Patch('legal') @RequirePermissions('property-legal.update') updateLegal(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyLegalDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateLegal(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('certificates')
  @RequirePermissions('property-certificates.read')
  listCertificates(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.listCertificates(id).then(out);
  }
  @Post('certificates')
  @RequirePermissions('property-certificates.create')
  createCertificate(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyCertificateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.createCertificate(id, b, actor(r, ua, rid)).then(out);
  }
  @Patch('certificates/:certificateUuid')
  @RequirePermissions('property-certificates.update')
  updateCertificate(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('certificateUuid', new ParseUUIDPipe({ version: '4' })) cid: string,
    @Body() b: PropertyCertificateUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateCertificate(id, cid, b, actor(r, ua, rid)).then(out);
  }
  @Delete('certificates/:certificateUuid')
  @HttpCode(204)
  @RequirePermissions('property-certificates.delete')
  async deleteCertificate(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('certificateUuid', new ParseUUIDPipe({ version: '4' })) cid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    await this.s.deleteCertificate(id, cid, actor(r, ua, rid));
  }
  @Get('financial') @RequirePermissions('property-financial.read') getFinancial(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getFinancial(id).then(out);
  }
  @Patch('financial')
  @RequirePermissions('property-financial.update')
  updateFinancial(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyFinancialDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateFinancial(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('features') @RequirePermissions('property-features.read') getFeatures(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getFeatures(id).then(out);
  }
  @Patch('features')
  @RequirePermissions('property-features.update')
  updateFeatures(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyFeaturesDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateFeatures(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('security') @RequirePermissions('property-security.read') getSecurity(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getSecurity(id).then(out);
  }
  @Patch('security')
  @RequirePermissions('property-security.update')
  updateSecurity(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertySecurityDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateSecurity(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('environment')
  @RequirePermissions('property-environment.read')
  getEnvironment(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getEnvironment(id).then(out);
  }
  @Patch('environment')
  @RequirePermissions('property-environment.update')
  updateEnvironment(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyEnvironmentDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateEnvironment(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('seo') @RequirePermissions('property-seo.read') getSeo(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.getSeo(id).then(out);
  }
  @Patch('seo') @RequirePermissions('property-seo.update') updateSeo(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertySeoDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateSeo(id, b, actor(r, ua, rid)).then(out);
  }
  @Get('media') @RequirePermissions('property-media.read') listMedia(
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.s.listMedia(id).then(out);
  }
  @Post('media') @RequirePermissions('property-media.create') addMedia(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: PropertyMediaDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.addMedia(id, b, actor(r, ua, rid)).then(out);
  }
  @Patch('media/reorder')
  @RequirePermissions('property-media.reorder')
  reorderMedia(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() b: ReorderMediaDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.reorderMedia(id, b.mediaUuids, actor(r, ua, rid)).then(out);
  }
  @Post('media/:mediaUuid/cover')
  @RequirePermissions('property-media.set-cover')
  setCover(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.setCover(id, mid, actor(r, ua, rid)).then(out);
  }
  @Patch('media/:mediaUuid')
  @RequirePermissions('property-media.update')
  updateMedia(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mid: string,
    @Body() b: PropertyMediaUpdateDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    return this.s.updateMedia(id, mid, b, actor(r, ua, rid)).then(out);
  }
  @Delete('media/:mediaUuid')
  @HttpCode(204)
  @RequirePermissions('property-media.delete')
  async deleteMedia(
    @Req() r: R,
    @Param('propertyUuid', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('mediaUuid', new ParseUUIDPipe({ version: '4' })) mid: string,
    @Headers('user-agent') ua?: string,
    @Headers('x-request-id') rid?: string,
  ) {
    await this.s.deleteMedia(id, mid, actor(r, ua, rid));
  }
}
