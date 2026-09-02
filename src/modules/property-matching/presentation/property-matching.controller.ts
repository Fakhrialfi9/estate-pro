import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthenticatedAccessGuard } from '../../../common/security/authenticated-access.guard.js';
import {
  PropertyMatchingService,
  type MatchingActor,
} from '../application/property-matching.service.js';
import {
  FeedbackDto,
  GenerateRecommendationDto,
  PreferenceDto,
  RecommendationQueryDto,
  SubjectParamsDto,
  UpdatePreferenceDto,
} from './property-matching.dto.js';

const actorOf = (
  request: Request & {
    user?: { sub?: string; permissions?: readonly string[] };
  },
): MatchingActor => ({
  actorUuid: request.user?.sub ?? '',
  permissions: request.user?.permissions ?? [],
  requestId: request.get('x-request-id') ?? undefined,
  ipAddress: request.ip,
  userAgent: request.get('user-agent') ?? undefined,
});

@ApiTags('Property Matching')
@ApiBearerAuth()
@Controller({ path: 'property-matching', version: '1' })
@UseGuards(AuthenticatedAccessGuard)
export class PropertyMatchingController {
  constructor(private readonly matching: PropertyMatchingService) {}

  @Post('preferences')
  @ApiOperation({
    summary: 'Create or reactivate a property matching preference',
  })
  async createPreference(@Body() dto: PreferenceDto, @Req() request: Request) {
    return this.matching.createPreference(
      dto.subjectType,
      dto.subjectUuid,
      this.preferenceInput(dto),
      actorOf(request),
    );
  }

  @Get('preferences/:subjectType/:subjectUuid')
  @ApiOperation({ summary: 'Get a property matching preference' })
  async getPreference(
    @Param() params: SubjectParamsDto,
    @Req() request: Request,
  ) {
    return this.matching.getPreference(
      params.subjectType,
      params.subjectUuid,
      actorOf(request),
    );
  }

  @Patch('preferences/:subjectType/:subjectUuid')
  @ApiOperation({
    summary: 'Update a property matching preference with optimistic versioning',
  })
  async updatePreference(
    @Param() params: SubjectParamsDto,
    @Body() dto: UpdatePreferenceDto,
    @Req() request: Request,
  ) {
    return this.matching.updatePreference(
      params.subjectType,
      params.subjectUuid,
      dto.version,
      this.preferenceInput(dto),
      actorOf(request),
    );
  }

  @Post('preferences/:subjectType/:subjectUuid/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a property matching preference' })
  async archivePreference(
    @Param() params: SubjectParamsDto,
    @Query('version') version: string,
    @Req() request: Request,
  ) {
    return this.matching.archivePreference(
      params.subjectType,
      params.subjectUuid,
      this.parseVersion(version),
      actorOf(request),
    );
  }

  @Post('preferences/:subjectType/:subjectUuid/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore an archived property matching preference' })
  async restorePreference(
    @Param() params: SubjectParamsDto,
    @Query('version') version: string,
    @Req() request: Request,
  ) {
    return this.matching.restorePreference(
      params.subjectType,
      params.subjectUuid,
      this.parseVersion(version),
      actorOf(request),
    );
  }

  @Post('matches')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Evaluate property matches from the stored preference',
  })
  async match(@Body() dto: GenerateRecommendationDto, @Req() request: Request) {
    return this.matching.match(
      dto.subjectType,
      dto.subjectUuid,
      { minScore: dto.minScore, page: dto.page, limit: dto.limit },
      actorOf(request),
    );
  }

  @Post('recommendations/generate')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a new property recommendation snapshot' })
  async generate(
    @Body() dto: GenerateRecommendationDto,
    @Req() request: Request,
  ) {
    return this.matching.generate(
      dto.subjectType,
      dto.subjectUuid,
      'GENERATED',
      { minScore: dto.minScore, limit: dto.limit },
      actorOf(request),
    );
  }

  @Post('recommendations/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh a property recommendation snapshot' })
  async refresh(
    @Body() dto: GenerateRecommendationDto,
    @Req() request: Request,
  ) {
    return this.matching.generate(
      dto.subjectType,
      dto.subjectUuid,
      'REFRESHED',
      { minScore: dto.minScore, limit: dto.limit },
      actorOf(request),
    );
  }

  @Get('recommendations/:subjectType/:subjectUuid/history')
  @ApiOperation({ summary: 'Read recommendation history' })
  async history(
    @Param() params: SubjectParamsDto,
    @Query() query: RecommendationQueryDto,
    @Req() request: Request,
  ) {
    return this.matching.getHistory(
      params.subjectType,
      params.subjectUuid,
      query.page ?? 1,
      query.limit ?? 20,
      actorOf(request),
    );
  }

  @Get('recommendations/:subjectType/:subjectUuid')
  @ApiOperation({ summary: 'Read the latest property recommendation snapshot' })
  async latest(@Param() params: SubjectParamsDto, @Req() request: Request) {
    return this.matching.getLatest(
      params.subjectType,
      params.subjectUuid,
      actorOf(request),
    );
  }

  @Get('saved-properties')
  @ApiOperation({
    summary: 'Read the current user saved active public listings',
  })
  async saved(@Req() request: Request) {
    return this.matching.savedProperties(actorOf(request));
  }

  @Post('feedback')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Record recommendation feedback' })
  async feedback(@Body() dto: FeedbackDto, @Req() request: Request) {
    return this.matching.submitFeedback(dto, actorOf(request));
  }

  private parseVersion(value: string): number {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('version must be a positive integer');
    return version;
  }

  private preferenceInput(dto: PreferenceDto | UpdatePreferenceDto) {
    return {
      transactionTypes: dto.transactionTypes ?? [],
      propertyTypeUuids: dto.propertyTypeUuids ?? [],
      propertyCategoryUuids: dto.propertyCategoryUuids ?? [],
      location: dto.location,
      budget: dto.budget,
      specification: dto.specification,
      hardCriteria: dto.hardCriteria ?? [],
    };
  }
}
