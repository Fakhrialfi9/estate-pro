import type { SeedTransaction } from '../database.ts';
import { seedUuid, SEED_REFERENCE_DATE } from '../shared/ids.ts';

const ADMIN_UUID = '00000000-0000-5000-8000-000000000001';

export async function seedContent(tx: SeedTransaction): Promise<void> {
  const category = await tx.contentArticleCategory.upsert({
    where: { slug: 'property-insights' },
    update: { name: 'Property Insights', description: 'Estate Pro property market and buying guidance.', status: 'PUBLISHED', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-category', 'property-insights'), name: 'Property Insights', slug: 'property-insights', description: 'Estate Pro property market and buying guidance.', status: 'PUBLISHED', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  const tag = await tx.contentTag.upsert({
    where: { slug: 'property-investment' },
    update: { name: 'Property Investment', description: 'Investment-focused content.', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-tag', 'property-investment'), name: 'Property Investment', slug: 'property-investment', description: 'Investment-focused content.', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  const folder = await tx.contentMediaFolder.upsert({
    where: { uuid: seedUuid('content-media-folder', 'property') },
    update: { name: 'Property', slug: 'property', deletedAt: null, deletedBy: null, updatedBy: ADMIN_UUID },
    create: { uuid: seedUuid('content-media-folder', 'property'), name: 'Property', slug: 'property', createdBy: ADMIN_UUID },
  });
  const media = await tx.contentMedia.upsert({
    where: { storageKey: 'seed/content/property-insights-cover.jpg' },
    update: { originalName: 'property-insights-cover.jpg', publicUrl: 'https://images.example.test/content/property-insights-cover.jpg', provider: 'seed', mimeType: 'image/jpeg', sizeBytes: 4096n, width: 1600, height: 900, alt: 'Modern property exterior', caption: 'Estate Pro property insights cover.', folderId: folder.id, uploaderUuid: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-media', 'property-insights-cover'), originalName: 'property-insights-cover.jpg', storageKey: 'seed/content/property-insights-cover.jpg', publicUrl: 'https://images.example.test/content/property-insights-cover.jpg', provider: 'seed', mimeType: 'image/jpeg', sizeBytes: 4096n, width: 1600, height: 900, alt: 'Modern property exterior', caption: 'Estate Pro property insights cover.', folderId: folder.id, uploaderUuid: ADMIN_UUID },
  });
  const article = await tx.contentArticle.upsert({
    where: { slug: 'how-to-evaluate-a-property-investment' },
    update: { title: 'How to Evaluate a Property Investment', subtitle: 'A practical checklist for buyers.', excerpt: 'A concise fixture article for content workflows.', content: { blocks: [{ type: 'paragraph', text: 'Evaluate location, legal status, price, cash flow and long-term demand.' }] }, contentFormat: 'BLOCKS', type: 'GUIDE', status: 'PUBLISHED', visibility: 'PUBLIC', language: 'id', featured: true, allowComments: true, wordCount: 18, readingTimeMin: 1, categoryId: category.id, coverMediaId: media.id, authorUuid: ADMIN_UUID, version: 1, publishedAt: SEED_REFERENCE_DATE, publishedBy: ADMIN_UUID, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-article', 'how-to-evaluate-a-property-investment'), title: 'How to Evaluate a Property Investment', slug: 'how-to-evaluate-a-property-investment', subtitle: 'A practical checklist for buyers.', excerpt: 'A concise fixture article for content workflows.', content: { blocks: [{ type: 'paragraph', text: 'Evaluate location, legal status, price, cash flow and long-term demand.' }] }, contentFormat: 'BLOCKS', type: 'GUIDE', status: 'PUBLISHED', visibility: 'PUBLIC', language: 'id', featured: true, allowComments: true, wordCount: 18, readingTimeMin: 1, categoryId: category.id, coverMediaId: media.id, authorUuid: ADMIN_UUID, version: 1, publishedAt: SEED_REFERENCE_DATE, publishedBy: ADMIN_UUID, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  await tx.contentArticleTag.upsert({ where: { articleId_tagId: { articleId: article.id, tagId: tag.id } }, update: {}, create: { articleId: article.id, tagId: tag.id } });
  await tx.contentRevision.upsert({
    where: { entityType_entityUuid_version: { entityType: 'ARTICLE', entityUuid: article.uuid, version: 1 } },
    update: { snapshot: { title: article.title, status: article.status }, changeSummary: 'Initial seed revision.', createdBy: ADMIN_UUID, createdAt: SEED_REFERENCE_DATE },
    create: { uuid: seedUuid('content-revision', article.uuid), entityType: 'ARTICLE', entityUuid: article.uuid, version: 1, snapshot: { title: article.title, status: article.status }, changeSummary: 'Initial seed revision.', createdBy: ADMIN_UUID, createdAt: SEED_REFERENCE_DATE },
  });
  await tx.contentSeo.upsert({
    where: { entityType_entityUuid: { entityType: 'ARTICLE', entityUuid: article.uuid } },
    update: { metaTitle: article.title, metaDescription: article.excerpt, keywords: 'property, investment, estate', canonicalUrl: `https://estate-pro.example.test/articles/${article.slug}`, robots: 'index,follow', ogTitle: article.title, ogDescription: article.excerpt, ogImageUrl: media.publicUrl },
    create: { uuid: seedUuid('content-seo', article.uuid), entityType: 'ARTICLE', entityUuid: article.uuid, metaTitle: article.title, metaDescription: article.excerpt, keywords: 'property, investment, estate', canonicalUrl: `https://estate-pro.example.test/articles/${article.slug}`, robots: 'index,follow', ogTitle: article.title, ogDescription: article.excerpt, ogImageUrl: media.publicUrl },
  });
  await tx.contentPage.upsert({
    where: { slug: 'about-estate-pro' },
    update: { title: 'About Estate Pro', template: 'default', content: { blocks: [{ type: 'paragraph', text: 'Estate Pro is a property sales and management platform.' }] }, contentFormat: 'BLOCKS', status: 'PUBLISHED', visibility: 'PUBLIC', language: 'id', version: 1, publishedAt: SEED_REFERENCE_DATE, publishedBy: ADMIN_UUID, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-page', 'about-estate-pro'), title: 'About Estate Pro', slug: 'about-estate-pro', template: 'default', content: { blocks: [{ type: 'paragraph', text: 'Estate Pro is a property sales and management platform.' }] }, contentFormat: 'BLOCKS', status: 'PUBLISHED', visibility: 'PUBLIC', language: 'id', version: 1, publishedAt: SEED_REFERENCE_DATE, publishedBy: ADMIN_UUID, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  await tx.contentFaq.upsert({
    where: { uuid: seedUuid('content-faq', 'what-is-estate-pro') },
    update: { question: 'What is Estate Pro?', answer: { blocks: [{ type: 'paragraph', text: 'A platform for property inventory, CRM and sales workflows.' }] }, category: 'General', sortOrder: 10, status: 'PUBLISHED', language: 'id', featured: true, version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-faq', 'what-is-estate-pro'), question: 'What is Estate Pro?', answer: { blocks: [{ type: 'paragraph', text: 'A platform for property inventory, CRM and sales workflows.' }] }, category: 'General', sortOrder: 10, status: 'PUBLISHED', language: 'id', featured: true, version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
  await tx.contentTestimonial.upsert({
    where: { uuid: seedUuid('content-testimonial', 'client-01') },
    update: { quote: { text: 'Estate Pro gives our team a clear property-to-deal workflow.' }, name: 'Client Fixture', role: 'Property Buyer', company: 'Example Holdings', avatarUrl: null, rating: 5, sortOrder: 10, featured: true, status: 'PUBLISHED', language: 'id', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID, deletedAt: null, deletedBy: null },
    create: { uuid: seedUuid('content-testimonial', 'client-01'), quote: { text: 'Estate Pro gives our team a clear property-to-deal workflow.' }, name: 'Client Fixture', role: 'Property Buyer', company: 'Example Holdings', rating: 5, sortOrder: 10, featured: true, status: 'PUBLISHED', language: 'id', version: 1, createdBy: ADMIN_UUID, updatedBy: ADMIN_UUID },
  });
}
