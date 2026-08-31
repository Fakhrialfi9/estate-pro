import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../prisma/generated/prisma/client.js';
import {
  BannerPlacement,
  ContentFormat,
  ContentStatus,
  ContentVisibility,
  RelationType,
} from '../../../../../prisma/generated/prisma/enums.js';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service.js';
import {
  ContentConflictError,
  ContentNotFoundError,
} from '../.../../application/content.errors.js';
import type {
  AuditContext,
  ContentResourceType,
  PaginationQuery,
  PagedResult,
} from '../../../domain/content.types.js';

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function plain(value: unknown): Record<string, unknown> {
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (key === 'id' || key === 'deletedBy') continue;
    result[key] = typeof item === 'bigint' ? item.toString() : item;
  }
  return result;
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
    const sortField =
      query.sortBy &&
      [
        'createdAt',
        'updatedAt',
        'publishedAt',
        'sortOrder',
        'priority',
        'title',
      ].includes(query.sortBy)
        ? query.sortBy
        : ['faq', 'testimonial'].includes(resource)
          ? 'sortOrder'
          : 'createdAt';
    const orderBy = [
      { [sortField]: query.sortDirection === 'asc' ? 'asc' : 'desc' },
      { id: 'desc' },
    ];
    const model = this.model(resource);
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
    const where = {
      uuid,
      ...(includeDeleted || resource === 'redirect' ? {} : { deletedAt: null }),
    };
    const item = await model.findFirst({
      where,
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
      const data = this.createData(resource, input, ctx);
      const item = await model.create({ data });
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
      const data = this.updateData(resource, input, ctx);
      await model.update({ where: { uuid }, data });
      const current = await model.findUnique?.({ where: { uuid } });
      if (resource === 'menu' && current && Array.isArray(input.items))
        await this.replaceMenuItems(
          (current as { id: bigint }).id,
          input.items,
        );
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
        originalName: String(input.originalName),
        storageKey: String(input.storageKey),
        publicUrl: typeof input.publicUrl === 'string' ? input.publicUrl : null,
        provider: typeof input.provider === 'string' ? input.provider : 'local',
        mimeType: String(input.mimeType),
        sizeBytes: BigInt(String(input.sizeBytes)),
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
      const known = new Set(items.map((i) => i.uuid));
      if (items.length !== uuids.length || uuids.some((id) => !known.has(id)))
        throw new ContentConflictError(
          'Reorder payload must contain exactly all menu items',
        );
      for (const [index, uuid] of uuids.entries())
        await tx.contentMenuItem.update({
          where: { uuid },
          data: { sortOrder: index },
        });
      return (
        await tx.contentMenuItem.findMany({
          where: { menuId: menu.id },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        })
      ).map(plain);
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
          ? { relationType: relationType as RelationType }
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
        sourceUuid: String(input.sourceUuid),
        targetUuid: String(input.targetUuid),
        sourceType: String(input.sourceType),
        targetType: String(input.targetType),
        relationType: String(
          input.relationType ?? 'RELATED',
        ) as RelationType,
        sortOrder: Number(input.sortOrder ?? 0),
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
  private model(resource: Exclude<ContentResourceType, 'article'>): {
    findMany(args: Record<string, unknown>): Promise<unknown[]>;
    findFirst(args: Record<string, unknown>): Promise<unknown | null>;
    findUnique?(args: Record<string, unknown>): Promise<unknown | null>;
    create(
      args: Record<string, unknown>,
    ): Promise<{ id: bigint; uuid: string }>;
    update(args: Record<string, unknown>): Promise<unknown>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
    count(args: Record<string, unknown>): Promise<number>;
  } {
    return (
      {
        page: this.prisma.contentPage,
        category: this.prisma.contentArticleCategory,
        tag: this.prisma.contentTag,
        faq: this.prisma.contentFaq,
        testimonial: this.prisma.contentTestimonial,
        banner: this.prisma.contentBanner,
        menu: this.prisma.contentMenu,
        redirect: this.prisma.contentRedirect,
        media: this.prisma.contentMedia,
        comment: this.prisma.contentComment,
      } as const
    )[resource] as unknown as ReturnType<
      PrismaContentResourceRepository['model']
    >;
  }

  private createData(
    resource: Exclude<ContentResourceType, 'article'>,
    input: Record<string, unknown>,
    ctx: AuditContext,
  ): Record<string, unknown> {
    if (resource === 'page')
      return {
        title: String(input.title),
        slug: String(input.slug),
        template: String(input.template ?? 'default'),
        content: jsonValue(input.content),
        contentFormat: String(
          input.contentFormat ?? 'RICH_TEXT',
        ) as ContentFormat,
        status: 'DRAFT',
        visibility: String(
          input.visibility ?? 'PUBLIC',
        ) as ContentVisibility,
        language: typeof input.language === 'string' ? input.language : 'id',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'category')
      return {
        name: String(input.name),
        slug: String(input.slug),
        description:
          typeof input.description === 'string' ? input.description : null,
        status: 'DRAFT',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'tag')
      return {
        name: String(input.name),
        slug: String(input.slug),
        description:
          typeof input.description === 'string' ? input.description : null,
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'faq')
      return {
        question: String(input.question),
        answer: jsonValue(input.answer),
        category: typeof input.category === 'string' ? input.category : null,
        sortOrder: Number(input.sortOrder ?? 0),
        status: 'DRAFT',
        language: typeof input.language === 'string' ? input.language : 'id',
        featured: Boolean(input.featured),
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'testimonial')
      return {
        quote: jsonValue(input.quote),
        name: String(input.name),
        role: typeof input.role === 'string' ? input.role : null,
        company: typeof input.company === 'string' ? input.company : null,
        avatarUrl: typeof input.avatarUrl === 'string' ? input.avatarUrl : null,
        rating: input.rating === undefined ? null : Number(input.rating),
        sortOrder: Number(input.sortOrder ?? 0),
        featured: Boolean(input.featured),
        status: 'DRAFT',
        language: typeof input.language === 'string' ? input.language : 'id',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'banner')
      return {
        name: String(input.name),
        title: typeof input.title === 'string' ? input.title : null,
        subtitle: typeof input.subtitle === 'string' ? input.subtitle : null,
        linkUrl: typeof input.linkUrl === 'string' ? input.linkUrl : null,
        placement: String(
          input.placement ?? 'HOME_HERO',
        ) as BannerPlacement,
        priority: Number(input.priority ?? 0),
        startAt: input.startAt ? new Date(String(input.startAt)) : null,
        endAt: input.endAt ? new Date(String(input.endAt)) : null,
        status: 'DRAFT',
        language: typeof input.language === 'string' ? input.language : 'id',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'menu')
      return {
        name: String(input.name),
        slug: String(input.slug),
        location: String(input.location),
        status: 'DRAFT',
        language: typeof input.language === 'string' ? input.language : 'id',
        createdBy: ctx.actorUuid,
        version: 1,
      };
    if (resource === 'redirect')
      return {
        sourcePath: String(input.sourcePath),
        destination: String(input.destination),
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
    const common = [
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
    for (const key of common)
      if (input[key] !== undefined) data[key] = input[key];
    if (input.content !== undefined) data.content = jsonValue(input.content);
    if (input.answer !== undefined) data.answer = jsonValue(input.answer);
    if (input.quote !== undefined) data.quote = jsonValue(input.quote);
    for (const key of ['sortOrder', 'priority', 'rating'])
      if (input[key] !== undefined) data[key] = Number(input[key]);
    for (const key of ['featured', 'isActive'])
      if (input[key] !== undefined) data[key] = Boolean(input[key]);
    if (input.status !== undefined)
      data.status = String(input.status) as ContentStatus;
    if (input.visibility !== undefined)
      data.visibility = String(input.visibility) as ContentVisibility;
    if (input.contentFormat !== undefined)
      data.contentFormat = String(input.contentFormat) as ContentFormat;
    if (input.placement !== undefined)
      data.placement = String(input.placement) as BannerPlacement;
    if (input.startAt !== undefined)
      data.startAt = input.startAt ? new Date(String(input.startAt)) : null;
    if (input.endAt !== undefined)
      data.endAt = input.endAt ? new Date(String(input.endAt)) : null;
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
        const label = String(item.label ?? '').trim();
        if (!label || label.length > 180)
          throw new ContentConflictError('Menu item label is invalid');
        const uuid = typeof item.uuid === 'string' ? item.uuid : label;
        if (seen.has(uuid))
          throw new ContentConflictError('Duplicate menu item');
        seen.add(uuid);
        await tx.contentMenuItem.create({
          data: {
            menuId,
            label,
            itemType: String(item.itemType ?? 'url'),
            resourceUuid:
              typeof item.resourceUuid === 'string' ? item.resourceUuid : null,
            url: typeof item.url === 'string' ? item.url : null,
            target: typeof item.target === 'string' ? item.target : null,
            icon: typeof item.icon === 'string' ? item.icon : null,
            sortOrder: Number(item.sortOrder ?? index),
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
