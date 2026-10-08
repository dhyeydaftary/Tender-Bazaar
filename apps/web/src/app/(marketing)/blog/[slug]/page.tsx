import { Metadata } from 'next';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
  author: string;
  authorRole: string;
  sections: { heading: string; content: string }[];
}

const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'complete-guide-government-tender-bidding-india-2026',
    title: 'Complete Guide to Government Tender Bidding in India 2026',
    description:
      'Everything you need to know about participating in government tenders — from registration and document preparation to submission and post-bid compliance.',
    date: '2026-04-05',
    readTime: '12 min read',
    category: 'Guide',
    author: 'Rajesh Sharma',
    authorRole: 'Senior Procurement Analyst',
    sections: [
      {
        heading: 'What Are Government Tenders?',
        content:
          'Government tenders are formal invitations issued by central, state, or local government bodies to procure goods, services, or works from private businesses. In India, the government procurement market is estimated at over Rs 30 lakh crore annually, making it a massive opportunity for businesses of all sizes. Tenders are published on platforms such as the Central Public Procurement Portal (CPPP), Government e-Marketplace (GeM), and state-specific e-procurement portals. Understanding how these platforms work and the types of tenders available — open, limited, single-source, and two-stage — is the first step to participating in government procurement.',
      },
      {
        heading: 'Essential Documents for Bidding',
        content:
          'Before you can submit a bid, you need to have your documentation in order. Key documents include your company registration certificate, PAN card, GST registration, MSME/Udyam registration (if applicable), Class 3 Digital Signature Certificate (DSC), bank solvency certificate, income tax returns for the last three years, audited financial statements, and experience certificates from previous contracts. Many tenders also require an Earnest Money Deposit (EMD) in the form of a bank guarantee or demand draft. Missing even one document can lead to disqualification, so it is essential to maintain a ready-to-submit tender document kit.',
      },
      {
        heading: 'The Bidding Process Step by Step',
        content:
          'The typical government tender process follows these steps: first, identify relevant tenders through portals or aggregation platforms like TenderBazaar. Next, purchase the tender document (if required) and study it carefully, paying attention to eligibility criteria, technical specifications, and submission deadlines. Prepare your technical bid, which covers your qualifications, methodology, and experience, and your financial bid, which includes your pricing. Submit both bids electronically through the designated e-procurement portal using your DSC. After the submission deadline, the procuring authority opens and evaluates technical bids first, followed by financial bids for qualified bidders. The contract is typically awarded to the lowest bidder (L1) in works and supply tenders, or through quality-cum-cost-based selection (QCBS) for consultancy tenders.',
      },
      {
        heading: 'Common Mistakes to Avoid',
        content:
          'Many first-time bidders make avoidable mistakes that lead to disqualification. The most common errors include submitting after the deadline, providing incomplete documentation, not reading the tender document thoroughly, quoting unrealistically low prices (which can lead to blacklisting), and failing to comply with formatting requirements. Always double-check your submission before the deadline, ensure all pages are signed and stamped where required, and verify that your DSC is valid and not expired. Using a platform like TenderBazaar can help you stay organised with checklists and automated reminders.',
      },
    ],
  },
  {
    slug: 'msme-benefits-government-tendering',
    title: 'MSME Benefits in Government Tendering — Everything You Need to Know',
    description:
      'MSMEs enjoy significant advantages in government procurement. Learn about EMD exemptions, price preferences, exclusive reservation, and how to leverage your MSME status.',
    date: '2026-03-28',
    readTime: '8 min read',
    category: 'MSME',
    author: 'Priya Patel',
    authorRole: 'MSME Policy Expert',
    sections: [
      {
        heading: 'MSME Procurement Policy Overview',
        content:
          'The Government of India has mandated that at least 25% of total annual procurement by central government ministries and departments must come from MSMEs registered under the Udyam portal. Within this 25%, a further sub-target of 4% is reserved for MSMEs owned by SC/ST entrepreneurs, and 3% for women-owned MSMEs. This policy creates a massive opportunity for micro, small, and medium enterprises to access government contracts that were previously dominated by larger corporations. The policy applies to both goods and services procurement and covers all central government entities, PSUs, and autonomous bodies.',
      },
      {
        heading: 'EMD and Security Deposit Exemptions',
        content:
          'One of the most significant benefits for MSMEs is the exemption from Earnest Money Deposit (EMD). MSMEs registered on the Udyam portal are not required to submit EMD when bidding on government tenders up to Rs 50 lakh. This removes a major financial barrier, as EMD amounts can range from 2-5% of the tender value. Additionally, MSMEs may receive relaxation on security deposit or performance guarantee requirements. These exemptions significantly improve cash flow and allow smaller businesses to participate in more tenders simultaneously without tying up working capital.',
      },
      {
        heading: 'Price Preference and Purchase Preference',
        content:
          'MSMEs registered on the Udyam portal are eligible for a price preference of up to 15% in government tenders. This means that if an MSME quotes within 15% of the lowest bid (L1), it gets the opportunity to match the L1 price and win the contract. Furthermore, under the Public Procurement Policy, certain items are reserved for exclusive procurement from MSMEs. The list of reserved items is updated periodically by the Ministry of MSME. Government e-Marketplace (GeM) also provides additional visibility and preferential treatment to MSME sellers through dedicated seller categories and special procurement drives.',
      },
    ],
  },
  {
    slug: 'understanding-emd-earnest-money-deposit-tenders',
    title: 'Understanding EMD (Earnest Money Deposit) in Tenders',
    description:
      'Earnest Money Deposit is a critical part of tendering. This guide covers EMD amounts, exemptions for MSMEs and startups, bank guarantee options, and refund timelines.',
    date: '2026-03-20',
    readTime: '6 min read',
    category: 'Finance',
    author: 'Amit Verma',
    authorRole: 'Financial Consultant',
    sections: [
      {
        heading: 'What Is EMD and Why Is It Required?',
        content:
          'Earnest Money Deposit (EMD) is a security deposit that bidders must submit along with their tender bid. It serves as a guarantee that the bidder is serious about the bid and will honour the terms if awarded the contract. EMD typically ranges from 2% to 5% of the estimated tender value, though this varies by organisation and tender type. The deposit is usually submitted in the form of a demand draft, fixed deposit receipt, or bank guarantee drawn in favour of the procuring authority. EMD protects the government from frivolous bids and ensures that the winning bidder will enter into a contract.',
      },
      {
        heading: 'EMD Exemptions and Relaxations',
        content:
          'Several categories of bidders are exempt from submitting EMD. MSMEs registered under the Udyam portal are exempt for tenders up to Rs 50 lakh. DPIIT-recognised startups are also exempt from EMD requirements for government tenders. Central and state PSUs, government departments, and autonomous bodies are generally exempt as well. Some tenders on the Government e-Marketplace (GeM) do not require EMD at all. It is important to carry the relevant exemption certificate and mention your exemption status clearly in your bid document to avoid disqualification.',
      },
      {
        heading: 'EMD Refund Process and Timelines',
        content:
          'For unsuccessful bidders, EMD is typically refunded within 30 days of the bid validity period expiring or the contract being awarded, whichever is earlier. The winning bidder\'s EMD is usually adjusted against the performance security or security deposit. If the winning bidder fails to execute the contract, the EMD is forfeited. To ensure timely refund, maintain proper records of your EMD submission including receipt numbers, bank details, and correspondence. Some e-procurement portals now offer digital EMD through online payment gateways, which simplifies both submission and refund processes considerably.',
      },
    ],
  },
  {
    slug: 'how-to-register-gem-portal-step-by-step',
    title: 'How to Register on GeM Portal — Step by Step Guide',
    description:
      'A complete walkthrough for registering as a seller on the Government e-Marketplace (GeM). Covers documentation, verification, catalogue listing, and getting your first order.',
    date: '2026-03-12',
    readTime: '10 min read',
    category: 'Guide',
    author: 'Neha Gupta',
    authorRole: 'e-Procurement Specialist',
    sections: [
      {
        heading: 'Why Register on GeM?',
        content:
          'Government e-Marketplace (GeM) is the official online marketplace for government procurement in India. With over 60 lakh products and services listed and more than Rs 3 lakh crore worth of orders placed, GeM is the single largest procurement platform in the country. All central government ministries and departments are mandated to procure common-use goods and services through GeM. Many state governments have also adopted GeM for their procurement needs. For sellers, GeM offers direct access to government buyers without intermediaries, transparent pricing, timely payments (within 10 days on average), and no marketing costs. Registration is free and open to all Indian businesses.',
      },
      {
        heading: 'Registration Process and Documents',
        content:
          'To register on GeM as a seller, visit gem.gov.in and click on Sign Up. You will need to provide your Aadhaar number for OTP verification, PAN card, GST registration number (GSTIN), bank account details linked to PAN, email address and mobile number. The portal will auto-verify your PAN and GST details with government databases. Once your identity is verified, you can set up your seller profile with company details, manufacturing capabilities, and certifications. The entire registration process can be completed in under 30 minutes. After registration, you can immediately start listing your products and services in the GeM catalogue.',
      },
      {
        heading: 'Listing Products and Winning Orders',
        content:
          'After registration, navigate to the Seller Dashboard and click on Offer Products/Services. Search the GeM catalogue for your product category and fill in the specifications, pricing, and delivery terms. Upload product images and quality certifications. GeM uses a dynamic pricing model, so your listed price should be competitive. There are three ways to get orders on GeM: direct purchase (for orders up to Rs 25,000), comparison and selection (L1 buying for orders between Rs 25,000 and Rs 5 lakh), and bidding/reverse auction (for orders above Rs 5 lakh). Maintain a high seller rating by fulfilling orders on time and responding to buyer queries promptly.',
      },
      {
        heading: 'Tips for GeM Success',
        content:
          'To maximise your success on GeM, keep your product catalogue updated with competitive pricing. Respond to buyer queries within 24 hours. Ensure timely delivery as delays affect your seller rating. Upload all relevant certifications such as BIS, ISO, and FSSAI to stand out. Participate actively in bids and reverse auctions. Monitor the GeM Seller Analytics dashboard regularly to understand your performance. Consider getting additional certifications like ZED (Zero Defect Zero Effect) for MSMEs, which gives you higher visibility on the platform. TenderBazaar can help you track GeM opportunities alongside tenders from other portals.',
      },
    ],
  },
  {
    slug: 'top-10-tips-win-government-contracts',
    title: 'Top 10 Tips to Win Government Contracts',
    description:
      'Practical strategies from experienced bidders on how to improve your tender win rate. Covers pricing strategy, technical evaluation, past experience, and common mistakes to avoid.',
    date: '2026-03-05',
    readTime: '7 min read',
    category: 'Tips',
    author: 'Vikram Singh',
    authorRole: 'Government Contracts Advisor',
    sections: [
      {
        heading: 'Research and Qualification',
        content:
          'The foundation of winning government contracts is thorough research. Before bidding, study the procuring organisation\'s past tenders, awarded contracts, and preferred vendors. Understand the evaluation criteria — is it lowest price (L1), quality-cum-cost based (QCBS), or fixed budget? Check if you meet all eligibility criteria including minimum turnover, relevant experience, and certifications. Many bidders waste time and resources on tenders they do not qualify for. Use TenderBazaar\'s AI eligibility checker to instantly assess your fit for each tender. Build relationships by attending pre-bid meetings and industry conferences where procuring officers participate.',
      },
      {
        heading: 'Pricing Strategy and Financial Planning',
        content:
          'Pricing is often the deciding factor in government tenders. For L1 (lowest price) tenders, your pricing needs to be competitive while remaining sustainable. Avoid the trap of quoting unrealistically low prices just to win — this can lead to poor quality delivery, disputes, and even blacklisting. Research market rates, factor in all costs including taxes, transportation, and overhead, and add a reasonable margin. For QCBS tenders, focus on the quality of your technical proposal since it carries significant weight. Consider the total cost of participation including EMD, document purchase, and preparation time when deciding which tenders to pursue.',
      },
      {
        heading: 'Documentation and Submission Excellence',
        content:
          'A well-prepared bid document can be the difference between winning and losing. Organise your submission exactly as specified in the tender document — use the same serial numbering, page formatting, and section headers. Include a cover letter, table of contents, and clear section dividers. Ensure all pages are numbered, signed, and stamped. Attach self-attested copies of all required certificates and declarations. For technical bids, clearly articulate your methodology, timeline, team composition, and quality assurance plan. Proofread everything before submission. Submit at least a few hours before the deadline to avoid last-minute technical issues with the e-procurement portal.',
      },
    ],
  },
  {
    slug: 'digital-signatures-e-tendering-complete-guide',
    title: 'Digital Signatures for e-Tendering — Complete Guide',
    description:
      'Digital Signature Certificates (DSC) are mandatory for e-tendering. Learn about Class 3 DSC, how to obtain one, costs, renewal, and troubleshooting common issues.',
    date: '2026-02-25',
    readTime: '5 min read',
    category: 'Compliance',
    author: 'Kavita Reddy',
    authorRole: 'Compliance Specialist',
    sections: [
      {
        heading: 'What Is a Digital Signature Certificate?',
        content:
          'A Digital Signature Certificate (DSC) is the electronic equivalent of a physical signature. It authenticates the identity of the signer and ensures the integrity of the signed document. In India, DSCs are issued by Certifying Authorities (CAs) licensed by the Controller of Certifying Authorities (CCA) under the Information Technology Act, 2000. For e-tendering on government portals, a Class 3 DSC is mandatory. Class 3 DSC provides the highest level of assurance and is required for signing and encrypting bid documents submitted on e-procurement portals such as CPPP, GeM, and state portals.',
      },
      {
        heading: 'How to Obtain a Class 3 DSC',
        content:
          'To obtain a Class 3 DSC, you need to apply through a licensed Certifying Authority such as eMudhra, Sify, n(Code), or Capricorn. The process involves filling out an online application form, submitting identity proof (PAN card, Aadhaar), address proof, and a passport-sized photograph. For organisations, you also need the company registration certificate and authorisation letter. Video verification or in-person verification is required for Class 3 DSC. The entire process typically takes 1-3 working days. A Class 3 DSC costs between Rs 1,500 and Rs 3,500 for a two-year validity period, depending on the CA and whether you need signing-only or both signing and encryption capabilities.',
      },
      {
        heading: 'Using and Maintaining Your DSC',
        content:
          'Once you receive your DSC token (USB device), you need to install the token driver and configure it on your computer. Most e-procurement portals require specific browser settings — typically Internet Explorer or a compatible browser with Java enabled. Register your DSC on the respective e-procurement portal before the tender submission deadline. Common issues include expired certificates, incompatible browser versions, Java security settings, and token driver problems. Always keep your DSC token safely, never share the PIN with others, and renew your certificate well before it expires. Keep a backup of your DSC registration on the portals and maintain a record of the portals where your DSC is registered.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  Guide: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400',
  MSME: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400',
  Finance: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  Tips: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  Compliance: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
};

/* ------------------------------------------------------------------ */
/* Static params & metadata                                           */
/* ------------------------------------------------------------------ */

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) {
    return { title: 'Post Not Found | TenderBazaar Blog' };
  }
  return {
    title: `${post.title} | TenderBazaar Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The blog post you are looking for does not exist.
          </p>
          <Link href="/blog" className="text-primary-500 hover:text-primary-600 font-medium">
            Back to blog
          </Link>
        </div>
      </div>
    );
  }

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background pt-16 sm:pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li>
              <Link href="/blog" className="hover:text-foreground transition-colors">
                Blog
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li className="text-foreground font-medium truncate max-w-[200px]">
              {post.title}
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {/* Main article */}
          <article className="lg:col-span-3">
            {/* Article header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {post.category}
                </span>
                <span className="text-xs text-muted-foreground">{post.readTime}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight leading-tight">
                {post.title}
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground text-sm font-semibold">
                    {post.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{post.author}</p>
                    <p className="text-xs text-muted-foreground">{post.authorRole}</p>
                  </div>
                </div>
                <span className="text-muted-foreground">|</span>
                <time dateTime={post.date} className="text-sm text-muted-foreground">
                  {formatDate(post.date)}
                </time>
              </div>
            </header>

            {/* Article body */}
            <div className="prose prose-sm max-w-none">
              {post.sections.map((section, i) => (
                <section key={i} className="mb-8">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    {section.heading}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {section.content}
                  </p>
                </section>
              ))}
            </div>

            {/* CTA in article */}
            <section className="mt-10 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 rounded-xl p-8 text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Start Finding Tenders Today
              </h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
                TenderBazaar aggregates 50,000+ government tenders from across India.
                Get AI-powered eligibility checks and smart alerts.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
              >
                Sign up for free
              </Link>
            </section>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Table of contents */}
            <div className="bg-card border border-border rounded-xl p-6 sticky top-20">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Table of Contents
              </h3>
              <ol className="space-y-2 list-decimal list-inside">
                {post.sections.map((section, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {section.heading}
                  </li>
                ))}
              </ol>
            </div>

            {/* Related posts */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Related Articles
              </h3>
              <ul className="space-y-4">
                {relatedPosts.map((rp) => (
                  <li key={rp.slug}>
                    <Link
                      href={`/blog/${rp.slug}`}
                      className="group"
                    >
                      <p className="text-sm font-medium text-foreground group-hover:text-primary-500 transition-colors leading-snug">
                        {rp.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rp.readTime}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
