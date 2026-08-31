import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import {
  BannerPlacement,
  ContentFormat,
  ContentStatus,
  ContentVisibility,
  RelationType,
} from '../../../../../prisma/generated/prisma/enums.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  ContentConflictError,
  ContentNotFoundError,
  ContentValidationError,
} from '../../application/content.errors.js';
import type {
  AuditContext,
  ContentResourceType,
  PaginationQuery,
  PagedResult,
} from '../../domain/content.types.js';

type ModelArgs = {
  where: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: unknown;
  include?: unknown;
};
type CreateArgs = { data: Record<string, unknown> };
type UpdateArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};
type ResourceModel = {
  findMany(args: ModelArgs): Promise<unknown[]>;
  findFirst(args: ModelArgs): Promise<unknown>;
  findUnique(args: ModelArgs): Promise<unknown>;
  create(args: CreateArgs): Promise<{ id: bigint; uuid: string }>;
  update(args: UpdateArgs): Promise<unknown>;
  updateMany(args: UpdateArgs): Promise<{ count: number }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
};

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ContentValidationError(`${field} is invalid`);
  return value.trim();
}
function optionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string')
    throw new ContentValidationError(`${field} is invalid`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new ContentValidationError(`${field} is invalid`);
  return date;
}
function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function plain(value: unknown): Record<string, unknown> {
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key !== 'id' && key !== 'deletedBy')
      .map(([key, item]) => [
        key,
        typeof item === 'bigint' ? item.toString() : item,
      ]),
  );
}

@Injectable()
export class PrismaContentResourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    resource: Exclude<ContentResourceType, 'article'>,
    query: PaginationQuery,
  ): Promise<PagedResult<Record<string, unknown>>> {
    const page = Math.min(Math.max(query.page ?? 1, 1), 10000);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> =
      resource === 'redirect' ? {} : { deletedAt: null };
    if (query.language && !['media', 'comment', 'redirect'].includes(resource))
      where.language = query.language;
    if (query.status && !['media', 'comment', 'redirect'].includes(resource))
      where.status = query.status;
    if (query.search?.trim()) {
      const search = query.search.trim().slice(0, 120);
      where.OR = [
        { name: { contains: search } },
        { title: { contains: search } },
        { slug: { contains: search } },
      ];
    }
    const sortField = [
      'createdAt',
      'updatedAt',
      'publishedAt',
      'sortOrder',
      'priority',
      'title',
    ].includes(query.sortBy ?? '')
      ? query.sortBy!
      : ['faq', 'testimonial'].includes(resource)
        ? 'sortOrder'
        : 'createdAt';
    const model = this.model(resource);
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { [sortField]: query.sortDirection === 'asc' ? 'asc' : 'desc' },
          { id: 'desc' },
        ],
        ...(resource === 'menu'
          ? {
              include: {
                items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            }
          : {}),
      }),
      model.count({ where }),
    ]);
    return {
      items: items.map(plain),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async get(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    includeDeleted = false,
  ): Promise<Record<string, unknown> | null> {
    const model = this.model(resource);
    const item = await model.findFirst({
      where: {
        uuid,
        ...(includeDeleted || resource === 'redirect'
          ? {}
          : { deletedAt: null }),
      },
      ...(resource === 'menu'
        ? {
            include: {
              items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            },
          }
        : {}),
    });
    return item ? plain(item) : null;
  }

  async create(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>> {
    try {
      const model = this.model(resource);
      const item = await model.create({
        data: this.createData(resource, input, ctx),
      });
      if (resource === 'menu' && Array.isArray(input.items))
        await this.replaceMenuItems(item.id, input.items);
      const fresh = await this.get(resource, item.uuid, true);
      if (!fresh)
        throw new ContentNotFoundError(`${resource} not found after create`);
      return fresh;
    } catch (error) {
      this.mapError(error);
    }
  }

  async update(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>> {
    try {
      const model = this.model(resource);
      await model.update({
        where: { uuid },
        data: this.updateData(resource, input, ctx),
      });
      if (resource === 'menu' && Array.isArray(input.items)) {
        const current = await model.findUnique({ where: { uuid } });
        const id = this.objectBigInt(current, 'id');
        await this.replaceMenuItems(id, input.items);
      }
      const fresh = await this.get(resource, uuid, true);
      if (!fresh)
        throw new ContentNotFoundError(`${resource} not found after update`);
      return fresh;
    } catch (error) {
      this.mapError(error);
    }
  }

  async softDelete(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ): Promise<void> {
    const model = this.model(resource);
    const data =
      resource === 'redirect'
        ? { isActive: false, updatedBy: ctx.actorUuid }
        : {
            deletedAt: new Date(),
            deletedBy: ctx.actorUuid,
            ...(this.versioned(resource) ? { version: { increment: 1 } } : {}),
          };
    const result = await model.updateMany({
      where: { uuid, ...(resource === 'redirect' ? {} : { deletedAt: null }) },
      data,
    });
    if (result.count !== 1)
      throw new ContentNotFoundError(`${resource} not found`);
  }

  async restore(
    resource: Exclude<ContentResourceType, 'article'>,
    uuid: string,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>> {
    if (resource === 'redirect')
      return this.update(resource, uuid, { isActive: true }, ctx);
    const model = this.model(resource);
    await model.update({
      where: { uuid },
      data: {
        deletedAt: null,
        deletedBy: null,
        ...(this.versioned(resource) ? { version: { increment: 1 } } : {}),
        updatedBy: ctx.actorUuid,
      },
    });
    const fresh = await this.get(resource, uuid, false);
    if (!fresh) throw new ContentNotFoundError(`${resource} not found`);
    return fresh;
  }

  async publicItem(
    resource: 'page' | 'article',
    slug: string,
    language: string,
  ): Promise<Record<string, unknown> | null> {
    if (resource === 'page') {
      const page = await this.prisma.contentPage.findFirst({
        where: {
          slug,
          language,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          deletedAt: null,
        },
      });
      return page ? plain(page) : null;
    }
    return null;
  }

  async createMedia(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const folder =
      typeof input.folderUuid === 'string'
        ? await this.prisma.contentMediaFolder.findFirst({
            where: { uuid: input.folderUuid, deletedAt: null },
            select: { id: true },
          })
        : null;
    const media = await this.prisma.contentMedia.create({
      data: {
        originalName: requiredString(input.originalName, 'originalName'),
        storageKey: requiredString(input.storageKey, 'storageKey'),
        publicUrl: typeof input.publicUrl === 'string' ? input.publicUrl : null,
        provider: stringOrDefault(input.provider, 'local'),
        mimeType: requiredString(input.mimeType, 'mimeType'),
        sizeBytes: BigInt(requiredString(input.sizeBytes, 'sizeBytes')),
        width: typeof input.width === 'number' ? input.width : null,
        height: typeof input.height === 'number' ? input.height : null,
        alt: typeof input.alt === 'string' ? input.alt : null,
        caption: typeof input.caption === 'string' ? input.caption : null,
        folderId: folder?.id ?? null,
        uploaderUuid:
          typeof input.uploaderUuid === 'string' ? input.uploaderUuid : null,
      },
    });
    return plain(media);
  }

  async deleteMedia(uuid: string, ctx: AuditContext): Promise<void> {
    const result = await this.prisma.contentMedia.updateMany({
      where: { uuid, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.actorUuid },
    });
    if (result.count !== 1) throw new ContentNotFoundError('Media not found');
  }

  async reorderMenu(
    menuUuid: string,
    uuids: string[],
  ): Promise<Record<string, unknown>[]> {
    return this.prisma.$transaction(async (tx) => {
      const menu = await tx.contentMenu.findUnique({
        where: { uuid: menuUuid },
        select: { id: true },
      });
      if (!menu) throw new ContentNotFoundError('Menu not found');
      const items = await tx.contentMenuItem.findMany({
        where: { menuId: menu.id },
        select: { uuid: true },
      });
      const known = new Set(items.map((item) => item.uuid));
      if (items.length !== uuids.length || uuids.some((id) => !known.has(id)))
        throw new ContentConflictError(
          'Reorder payload must contain exactly all menu items',
        );
      for (const [index, uuid] of uuids.entries())
        await tx.contentMenuItem.update({
          where: { uuid },
          data: { sortOrder: index },
        });
      const rows = await tx.contentMenuItem.findMany({
        where: { menuId: menu.id },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      return rows.map(plain);
    });
  }

  async relations(
    sourceUuid: string,
    relationType?: string,
  ): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.contentRelation.findMany({
      where: {
        sourceUuid,
        ...(relationType
          ? {
              relationType: requiredString(
                relationType,
                'relationType',
              ) as RelationType,
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map(plain);
  }

  async addRelation(
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<Record<string, unknown>> {
    const row = await this.prisma.contentRelation.create({
      data: {
        sourceUuid: requiredString(input.sourceUuid, 'sourceUuid'),
        targetUuid: requiredString(input.targetUuid, 'targetUuid'),
        sourceType: requiredString(input.sourceType, 'sourceType'),
        targetType: requiredString(input.targetType, 'targetType'),
        relationType: requiredString(
          input.relationType ?? 'RELATED',
          'relationType',
        ) as RelationType,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        createdBy: ctx.actorUuid,
      },
    });
    return plain(row);
  }

  async deleteRelation(uuid: string): Promise<void> {
    await this.prisma.contentRelation.delete({ where: { uuid } });
  }

  async ensureRedirect(
    resourceType: string,
    oldSlug: string,
    newSlug: string,
  ): Promise<void> {
    const prefix = resourceType === 'page' ? 'pages' : 'articles';
    const sourcePath = `/${prefix}/${oldSlug}`;
    const destination = `/${prefix}/${newSlug}`;
    await this.prisma.contentRedirect.upsert({
      where: { sourcePath },
      update: { destination, isActive: true, type: 'MOVED_PERMANENTLY' },
      create: {
        sourcePath,
        destination,
        isActive: true,
        type: 'MOVED_PERMANENTLY',
      },
    });
  }

  private objectBigInt(value: unknown, field: string): bigint {
    if (!value || typeof value !== 'object')
      throw new ContentNotFoundError('Menu not found');
    const raw = (value as Record<string, unknown>)[field];
    if (typeof raw !== 'bigint')
      throw new ContentNotFoundError(`${field} not found`);
    return raw;
  }

  private versioned(resource: string): boolean {
    return [
      'page',
      'category',
      'tag',
      'faq',
      'testimonial',
      'banner',
      'menu',
    ].includes(resource);
  }

  private model(
    resource: Exclude<ContentResourceType, 'article'>,
  ): ResourceModel {
    const delegates: Record<
      Exclude<ContentResourceType, 'article'>,
      unknown
    > = {
      page: this.prisma.contentPage,
      category: this.prisma.contentArticleCategory,
      tag: this.prisma.contentTag,
      faq: this.prisma.contentFaq,
      testimonial: this.prisma.contentTestimonial,
      banner: this.prisma.contentBanner,
      menu: this.prisma.contentMenu,
      redirect: this.prisma.contentRedirect,
      media: this.prisma.contentMedia,
    };
    return delegates[resource] as ResourceModel;
  }

  private createData(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Record<string, unknown> {
    if (resource === 'page')
      return {
        title: requiredString(input.title, 'title'),
        slug: requiredString(input.slug, 'slug'),
        template: stringOrDefault(input.template, 'default'),
        content: jsonValue(input.content),
        contentFormat: stringOrDefault(
          input.contentFormat,
          'RICH_TEXT',
        ) as ContentFormat,
        status: 'DRAFT',
        visibility: stringOrDefault(
          input.visibility,
          'PUBLIC',
        ) as ContentVisibility,
        language: stringOrDefault(input.language, 'id'),
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'category')
      return {
        name: requiredString(input.name, 'name'),
        slug: requiredString(input.slug, 'slug'),
        description:
          typeof input.description === 'string' ? input.description : null,
        status: 'DRAFT',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'tag')
      return {
        name: requiredString(input.name, 'name'),
        slug: requiredString(input.slug, 'slug'),
        description:
          typeof input.description === 'string' ? input.description : null,
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'faq')
      return {
        question: requiredString(input.question, 'question'),
        answer: jsonValue(input.answer),
        category: typeof input.category === 'string' ? input.category : null,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        status: 'DRAFT',
        language: stringOrDefault(input.language, 'id'),
        featured: input.featured === true,
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'testimonial')
      return {
        quote: jsonValue(input.quote),
        name: requiredString(input.name, 'name'),
        role: typeof input.role === 'string' ? input.role : null,
        company: typeof input.company === 'string' ? input.company : null,
        avatarUrl: typeof input.avatarUrl === 'string' ? input.avatarUrl : null,
        rating: typeof input.rating === 'number' ? input.rating : null,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        featured: input.featured === true,
        status: 'DRAFT',
        language: stringOrDefault(input.language, 'id'),
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'banner')
      return {
        name: requiredString(input.name, 'name'),
        title: typeof input.title === 'string' ? input.title : null,
        subtitle: typeof input.subtitle === 'string' ? input.subtitle : null,
        linkUrl: typeof input.linkUrl === 'string' ? input.linkUrl : null,
        placement: stringOrDefault(
          input.placement,
          'HOME_HERO',
        ) as BannerPlacement,
        priority: typeof input.priority === 'number' ? input.priority : 0,
        startAt: optionalDate(input.startAt, 'startAt'),
        endAt: optionalDate(input.endAt, 'endAt'),
        status: 'DRAFT',
        language: stringOrDefault(input.language, 'id'),
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'menu')
      return {
        name: requiredString(input.name, 'name'),
        slug: requiredString(input.slug, 'slug'),
        location: requiredString(input.location, 'location'),
        status: 'DRAFT',
        language: stringOrDefault(input.language, 'id'),
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'redirect')
      return {
        sourcePath: requiredString(input.sourcePath, 'sourcePath'),
        destination: requiredString(input.destination, 'destination'),
        type: 'MOVED_PERMANENTLY',
        isActive: true,
        createdBy: ctx.actorUuid,
      };
    throw new ContentConflictError(`Unsupported create resource: ${resource}`);
  }

  private updateData(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = { updatedBy: ctx.actorUuid };
    const stringFields = [
      'name',
      'title',
      'subtitle',
      'description',
      'question',
      'category',
      'role',
      'company',
      'avatarUrl',
      'slug',
      'template',
      'language',
      'location',
      'sourcePath',
      'destination',
    ];
    for (const field of stringFields) {
      const value = input[field];
      if (value !== undefined) data[field] = requiredString(value, field);
    }
    if (input.content !== undefined) data.content = jsonValue(input.content);
    if (input.answer !== undefined) data.answer = jsonValue(input.answer);
    if (input.quote !== undefined) data.quote = jsonValue(input.quote);
    for (const field of ['sortOrder', 'priority', 'rating']) {
      const value = input[field];
      if (value !== undefined) {
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new ContentValidationError(`${field} is invalid`);
        data[field] = value;
      }
    }
    for (const field of ['featured', 'isActive']) {
      const value = input[field];
      if (value !== undefined) {
        if (typeof value !== 'boolean')
          throw new ContentValidationError(`${field} is invalid`);
        data[field] = value;
      }
    }
    if (input.status !== undefined)
      data.status = requiredString(input.status, 'status') as ContentStatus;
    if (input.visibility !== undefined)
      data.visibility = requiredString(
        input.visibility,
        'visibility',
      ) as ContentVisibility;
    if (input.contentFormat !== undefined)
      data.contentFormat = requiredString(
        input.contentFormat,
        'contentFormat',
      ) as ContentFormat;
    if (input.placement !== undefined)
      data.placement = requiredString(
        input.placement,
        'placement',
      ) as BannerPlacement;
    if (input.startAt !== undefined)
      data.startAt = optionalDate(input.startAt, 'startAt');
    if (input.endAt !== undefined)
      data.endAt = optionalDate(input.endAt, 'endAt');
    if (this.versioned(resource)) data.version = { increment: 1 };
    return data;
  }

  private async replaceMenuItems(
    menuId: bigint,
    values: unknown[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.contentMenuItem.deleteMany({ where: { menuId } });
      const seen = new Set<string>();
      for (const [index, raw] of values.entries()) {
        if (!raw || typeof raw !== 'object')
          throw new ContentConflictError('Invalid menu item');
        const item = raw as Record<string, unknown>;
        const label = stringOrDefault(item.label, '').trim();
        if (!label || label.length > 180)
          throw new ContentConflictError('Menu item label is invalid');
        const identity =
          typeof item.uuid === 'string' && item.uuid.trim() ? item.uuid : label;
        if (seen.has(identity))
          throw new ContentConflictError('Duplicate menu item');
        seen.add(identity);
        const sortOrder =
          typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)
            ? item.sortOrder
            : index;
        await tx.contentMenuItem.create({
          data: {
            menuId,
            label,
            itemType: stringOrDefault(item.itemType, 'url'),
            resourceUuid:
              typeof item.resourceUuid === 'string' ? item.resourceUuid : null,
            url: typeof item.url === 'string' ? item.url : null,
            target: typeof item.target === 'string' ? item.target : null,
            icon: typeof item.icon === 'string' ? item.icon : null,
            sortOrder,
          },
        });
      }
    });
  }

  private mapError(error: unknown): never {
    if (
      error instanceof ContentConflictError ||
      error instanceof ContentNotFoundError
    )
      throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ContentConflictError('A unique content value already exists');
      if (error.code === 'P2003')
        throw new ContentConflictError(
          'Content is referenced by another record',
        );
      if (error.code === 'P2025')
        throw new ContentNotFoundError('Content not found');
    }
    throw error;
  }
}
