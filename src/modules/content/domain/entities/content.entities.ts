import {
  ARTICLE_TYPES,
  CONTENT_FORMATS,
  CONTENT_STATUSES,
  VISIBILITIES,
  type ArticleType,
  type ContentFormat,
  type ContentStatus,
  type ContentVisibility,
} from '../content.types.js';

export class ArticleEntity {
  constructor(
    readonly uuid: string,
    private _title: string,
    private _slug: string,
    private _content: unknown,
    private _status: ContentStatus = 'DRAFT',
    private _visibility: ContentVisibility = 'PUBLIC',
    private _contentFormat: ContentFormat = 'RICH_TEXT',
    private _type: ArticleType = 'ARTICLE',
  ) {
    if (!uuid) throw new Error('Article uuid is required');
    if (!this._title.trim()) throw new Error('Article title is required');
    if (!this._slug.trim()) throw new Error('Article slug is required');
    if (!CONTENT_STATUSES.includes(_status))
      throw new Error('Invalid content status');
    if (!VISIBILITIES.includes(_visibility))
      throw new Error('Invalid visibility');
    if (!CONTENT_FORMATS.includes(_contentFormat))
      throw new Error('Invalid content format');
    if (!ARTICLE_TYPES.includes(_type)) throw new Error('Invalid article type');
  }

  get title(): string {
    return this._title;
  }
  get slug(): string {
    return this._slug;
  }
  get content(): unknown {
    return this._content;
  }
  get status(): ContentStatus {
    return this._status;
  }
  get visibility(): ContentVisibility {
    return this._visibility;
  }
  get contentFormat(): ContentFormat {
    return this._contentFormat;
  }
  get type(): ArticleType {
    return this._type;
  }

  transition(next: ContentStatus): void {
    const allowed: Record<ContentStatus, readonly ContentStatus[]> = {
      DRAFT: ['IN_REVIEW', 'DRAFT'],
      IN_REVIEW: ['APPROVED', 'REJECTED', 'DRAFT'],
      APPROVED: ['SCHEDULED', 'PUBLISHED', 'DRAFT'],
      SCHEDULED: ['PUBLISHED', 'DRAFT'],
      PUBLISHED: ['DRAFT', 'ARCHIVED'],
      ARCHIVED: ['DRAFT', 'PUBLISHED'],
      REJECTED: ['DRAFT', 'IN_REVIEW'],
    };
    if (!allowed[this._status].includes(next)) {
      throw new Error(`Invalid article transition: ${this._status} -> ${next}`);
    }
    this._status = next;
  }

  update(input: {
    title?: string;
    slug?: string;
    content?: unknown;
    visibility?: ContentVisibility;
  }): void {
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new Error('Article title is required');
      this._title = title;
    }
    if (input.slug !== undefined) {
      const slug = input.slug.trim();
      if (!slug) throw new Error('Article slug is required');
      this._slug = slug;
    }
    if (input.content !== undefined) this._content = input.content;
    if (input.visibility !== undefined) {
      if (!VISIBILITIES.includes(input.visibility))
        throw new Error('Invalid visibility');
      this._visibility = input.visibility;
    }
  }
}

export class RevisionEntity {
  constructor(
    readonly entityType: string,
    readonly entityUuid: string,
    readonly version: number,
    readonly snapshot: unknown,
    readonly createdAt: Date,
  ) {
    if (version < 1 || !Number.isInteger(version))
      throw new Error('Revision version must be positive');
    Object.freeze(this);
  }
}
