import { prisma } from '../../../config/database';
import redis from '../../../config/redis';
import { AppError } from '../../../shared/middleware/error-handler';

/* ═══════════════════════════════════════════════════════════════
   BLOG POSTS
   ═══════════════════════════════════════════════════════════════ */

interface PostListFilters {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy: string;
  sortOrder: string;
}

interface CreatePostData {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  tags?: string[];
  status?: string;
}

/* ═══════════════════════════════════════════════════════════════
   ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */

interface AnnouncementListFilters {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  sortOrder: string;
}

interface CreateAnnouncementData {
  title: string;
  message: string;
  type?: string;
  targetAudience?: string;
  isPinned?: boolean;
  startDate?: string;
  endDate?: string;
}

/* ═══════════════════════════════════════════════════════════════
   BANNERS
   ═══════════════════════════════════════════════════════════════ */

interface BannerListFilters {
  page: number;
  limit: number;
  status?: string;
  position?: string;
  sortOrder: string;
}

interface CreateBannerData {
  title: string;
  imageUrl?: string;
  linkUrl?: string;
  description?: string;
  position?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
}

export const contentService = {
  // ── Blog Posts ─────────────────────────────────────────

  async getContentStats() {
    const [totalPosts, publishedPosts, draftPosts, activeAnnouncements, totalAnnouncements, activeBanners, totalBanners, publishedList] = await Promise.all([
      prisma.blogPost.count(),
      prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
      prisma.blogPost.count({ where: { status: 'DRAFT' } }),
      prisma.announcement.count({ where: { status: 'PUBLISHED' } }),
      prisma.announcement.count(),
      prisma.banner.count({ where: { status: 'PUBLISHED' } }),
      prisma.banner.count(),
      prisma.blogPost.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } }),
    ]);

    let totalViews = 0;
    let totalLikes = 0;
    for (const p of publishedList) {
      try {
        const v = await redis.get(`blog:views:${p.id}`);
        const l = await redis.get(`blog:likes:${p.id}`);
        totalViews += v ? Number(v) : 0;
        totalLikes += l ? Number(l) : 0;
      } catch {
        // no-op
      }
    }

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      activeAnnouncements,
      totalAnnouncements,
      activeBanners,
      totalBanners,
      totalViews,
      totalLikes,
    };
  },

  async getPostList(filters: PostListFilters) {
    const { page, limit, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy, skip, take: limit }),
      prisma.blogPost.count({ where }),
    ]);

    const enriched = await Promise.all(
      posts.map(async (p) => {
        let views = 0;
        let likes = 0;
        try {
          const v = await redis.get(`blog:views:${p.id}`);
          const l = await redis.get(`blog:likes:${p.id}`);
          views = v ? Number(v) : 0;
          likes = l ? Number(l) : 0;
        } catch {
          views = 0;
          likes = 0;
        }
        return {
          ...p,
          views,
          likes,
        };
      })
    );

    return { posts: enriched, total, page, limit };
  },

  async getPostDetail(postId: string) {
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Blog post not found', 404, 'POST_NOT_FOUND');
    return post;
  },

  async createPost(data: CreatePostData, authorId: string, authorName: string) {
    // Check slug uniqueness
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('Slug already exists', 409, 'SLUG_TAKEN');

    const post = await prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        content: data.content,
        coverImage: data.coverImage || null,
        authorId,
        authorName,
        tags: data.tags || [],
        status: (data.status as any) || 'DRAFT',
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      },
    });

    return post;
  },

  async updatePost(postId: string, data: Partial<CreatePostData>) {
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Blog post not found', 404, 'POST_NOT_FOUND');

    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined && data.slug !== post.slug) {
      const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== postId) throw new AppError('Slug already exists', 409, 'SLUG_TAKEN');
      updateData.slug = data.slug;
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.blogPost.update({ where: { id: postId }, data: updateData });
    return updated;
  },

  async deletePost(postId: string) {
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Blog post not found', 404, 'POST_NOT_FOUND');
    await prisma.blogPost.delete({ where: { id: postId } });
    return { message: 'Blog post deleted', id: postId };
  },

  // ── Announcements ─────────────────────────────────────

  async getAnnouncementList(filters: AnnouncementListFilters) {
    const { page, limit, status, type, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: { createdAt: sortOrder as any },
        skip,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return { announcements, total, page, limit };
  },

  async createAnnouncement(data: CreateAnnouncementData, authorId: string) {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        targetAudience: data.targetAudience || 'all',
        isPinned: data.isPinned || false,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        authorId,
        status: 'DRAFT',
      },
    });

    return announcement;
  },

  async updateAnnouncement(id: string, data: Partial<CreateAnnouncementData> & { status?: string }) {
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new AppError('Announcement not found', 404, 'ANNOUNCEMENT_NOT_FOUND');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.targetAudience !== undefined) updateData.targetAudience = data.targetAudience;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    const updated = await prisma.announcement.update({ where: { id }, data: updateData });
    return updated;
  },

  async deleteAnnouncement(id: string) {
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new AppError('Announcement not found', 404, 'ANNOUNCEMENT_NOT_FOUND');
    await prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted', id };
  },

  // ── Banners ───────────────────────────────────────────

  async getBannerList(filters: BannerListFilters) {
    const { page, limit, status, position, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (position) where.position = position;

    const [banners, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        orderBy: { createdAt: sortOrder as any },
        skip,
        take: limit,
      }),
      prisma.banner.count({ where }),
    ]);

    const enriched = await Promise.all(
      banners.map(async (b) => {
        let impressions = 0;
        let clicks = 0;
        try {
          const imp = await redis.get(`banner:impressions:${b.id}`);
          const clk = await redis.get(`banner:clicks:${b.id}`);
          impressions = imp ? Number(imp) : 0;
          clicks = clk ? Number(clk) : 0;
        } catch {
          impressions = 0;
          clicks = 0;
        }
        return {
          ...b,
          impressions,
          clicks,
        };
      })
    );

    return { banners: enriched, total, page, limit };
  },

  async createBanner(data: CreateBannerData, authorId: string) {
    const banner = await prisma.banner.create({
      data: {
        title: data.title,
        imageUrl: data.imageUrl || null,
        linkUrl: data.linkUrl || null,
        description: data.description || null,
        position: data.position || 'top',
        priority: data.priority || 0,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        authorId,
        status: 'DRAFT',
      },
    });

    return banner;
  },

  async updateBanner(id: string, data: Partial<CreateBannerData> & { status?: string }) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new AppError('Banner not found', 404, 'BANNER_NOT_FOUND');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    const updated = await prisma.banner.update({ where: { id }, data: updateData });
    return updated;
  },

  async deleteBanner(id: string) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new AppError('Banner not found', 404, 'BANNER_NOT_FOUND');
    await prisma.banner.delete({ where: { id } });
    return { message: 'Banner deleted', id };
  },
};
