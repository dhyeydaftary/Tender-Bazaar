'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Clock,
  User,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

type Category = 'All' | 'Tender Tips' | 'MSME Guide' | 'Industry News' | 'Product Updates';

const CATEGORIES: Category[] = [
  'All',
  'Tender Tips',
  'MSME Guide',
  'Industry News',
  'Product Updates',
];

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: Exclude<Category, 'All'>;
  author: string;
}

const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'complete-guide-government-tender-bidding-india-2026',
    title: 'Complete Guide to Government Tender Bidding in India 2026',
    excerpt:
      'Everything you need to know about participating in government tenders — from registration and document preparation to submission and post-bid compliance. A comprehensive resource for first-time and experienced bidders.',
    date: '2026-04-05',
    readTime: '12 min read',
    category: 'Tender Tips',
    author: 'Arjun Mehta',
  },
  {
    slug: 'msme-benefits-government-tendering',
    title: 'MSME Benefits in Government Tendering — Everything You Need to Know',
    excerpt:
      'MSMEs enjoy significant advantages in government procurement. Learn about EMD exemptions, price preferences, exclusive reservation policies, and how to leverage your MSME status to win more contracts.',
    date: '2026-03-28',
    readTime: '8 min read',
    category: 'MSME Guide',
    author: 'Sneha Iyer',
  },
  {
    slug: 'union-budget-2026-impact-government-procurement',
    title: 'Union Budget 2026: How It Impacts Government Procurement and MSMEs',
    excerpt:
      'A deep dive into the Union Budget 2026 announcements affecting government spending, infrastructure projects, and MSME policies. What it means for businesses bidding on government contracts.',
    date: '2026-03-20',
    readTime: '6 min read',
    category: 'Industry News',
    author: 'Rohan Deshmukh',
  },
  {
    slug: 'tenderbazaar-ai-eligibility-engine-v2',
    title: 'Introducing AI Eligibility Engine v2 — Smarter, Faster, More Accurate',
    excerpt:
      'Our completely rebuilt AI engine now analyzes 15+ eligibility criteria in seconds, including turnover requirements, experience thresholds, certifications, and MSME status. See how it works.',
    date: '2026-03-12',
    readTime: '5 min read',
    category: 'Product Updates',
    author: 'Sneha Iyer',
  },
  {
    slug: 'top-10-tips-win-government-contracts',
    title: 'Top 10 Tips to Win Government Contracts in 2026',
    excerpt:
      'Practical strategies from experienced bidders on how to improve your tender win rate. Covers pricing strategy, technical evaluation, past experience documentation, and common mistakes to avoid.',
    date: '2026-03-05',
    readTime: '7 min read',
    category: 'Tender Tips',
    author: 'Arjun Mehta',
  },
  {
    slug: 'gem-portal-registration-seller-guide',
    title: 'How to Register on GeM Portal as a Seller — Step by Step Guide',
    excerpt:
      'A complete walkthrough for registering as a seller on the Government e-Marketplace (GeM). Covers required documentation, verification process, catalogue listing, and getting your first order.',
    date: '2026-02-25',
    readTime: '10 min read',
    category: 'MSME Guide',
    author: 'Ananya Krishnan',
  },
];

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  'Tender Tips': 'bg-primary-500/15 text-primary-400 border-primary-500/20',
  'MSME Guide': 'bg-accent-500/15 text-accent-400 border-accent-500/20',
  'Industry News': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Product Updates': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function BlogIndexPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = useMemo(() => {
    let posts = BLOG_POSTS;

    if (activeCategory !== 'All') {
      posts = posts.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    return posts;
  }, [activeCategory, searchQuery]);

  return (
    <div className="bg-background min-h-screen">
      {/* Hero / Header */}
      <section className="pt-32 pb-12 relative">
        {/* Background accents */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-primary-500/[0.03] rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-muted border border-border rounded-full px-4 py-1.5 mb-6">
              <BookOpen className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-overline text-foreground/80 uppercase tracking-widest">
                Blog
              </span>
            </div>

            <h1 className="text-display-md md:text-display-lg lg:text-display-xl font-display text-foreground mb-4 tracking-tight">
              TenderBazaar Blog
            </h1>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Expert guides, practical tips, and the latest updates on government
              tendering in India. Level up your bidding strategy.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-xl mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full bg-muted border border-border text-foreground text-sm rounded-xl pl-11 pr-4 py-3 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all"
              />
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeCategory === cat
                    ? 'bg-primary-500 text-white shadow-glow'
                    : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-muted border border-border',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No articles found matching your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="text-primary-500 hover:text-primary-400 text-sm font-medium mt-3 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {filteredPosts.map((post) => (
                <article
                  key={post.slug}
                  className="group bg-card border border-border rounded-xl overflow-hidden hover:border-border hover:bg-muted transition-all duration-300"
                >
                  {/* Placeholder image area */}
                  <div className="h-48 bg-gradient-to-br from-muted to-card flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.06] to-accent-500/[0.04]" />
                    <span className="text-4xl text-muted-foreground/10 font-bold font-display">TB</span>
                  </div>

                  <div className="p-6">
                    {/* Category badge + read time */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
                          CATEGORY_BADGE_STYLES[post.category] ??
                            'bg-gray-500/15 text-gray-400 border-gray-500/20',
                        )}
                      >
                        {post.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-heading-sm text-foreground font-display mb-2 leading-snug group-hover:text-primary-400 transition-colors line-clamp-2">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>

                    {/* Author + date */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">{post.author}</span>
                      </div>
                      <time
                        dateTime={post.date}
                        className="text-xs text-muted-foreground"
                      >
                        {formatDate(post.date)}
                      </time>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-muted border border-border rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-accent-500" />
              <span className="text-overline text-foreground/80 uppercase tracking-widest">
                Stay Updated
              </span>
            </div>

            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
              Never miss a tender opportunity
            </h2>
            <p className="text-body-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
              Join 15,000+ businesses using TenderBazaar to discover, track, and win
              government contracts across India.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center justify-center rounded-xl bg-primary-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-primary-600 transition-all shadow-glow hover:shadow-[0_0_30px_rgba(255,107,53,0.25)] gap-2"
            >
              Get started for free
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
