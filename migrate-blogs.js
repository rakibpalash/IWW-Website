const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

// Configuration
const CONFIG = {
  sources: [
    {
      name: 'Insta Web Works',
      archiveUrl: 'https://instawebworks.com.au/blog/',
      domain: 'https://instawebworks.com.au'
    },
    {
      name: 'Easy Pluginz',
      archiveUrl: 'https://easy-pluginz.com/blogs/',
      domain: 'https://easy-pluginz.com'
    }
  ],
  outputDir: {
    blogs: './blogs',
    images: './images_001/blog',
    assets: './assets/js'
  },
  templateFile: './blog-template.html',
  blogDataFile: './assets/js/blog-data.js',
  redirectMapFile: './redirect-map.json',
  reportFile: './migration-report.json'
};

// Statistics
const stats = {
  instaWebWorks: 0,
  easyPluginz: 0,
  generated: 0,
  imagesDownloaded: 0,
  failed: [],
  duplicateUrlsRemoved: 0,
  duplicateSlugsRemoved: 0,
  postsWithMissingImages: [],
  postsWithRepeatedImages: [],
  archivePagesCrawled: 0
};

const imageUsageCount = new Map();

// Utility: Make HTTP request
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }}, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Utility: Download file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }}, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode} for ${url}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Utility: Create slug from title
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Utility: Extract text from element
function extractText(root, selector) {
  const el = root.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

// Utility: Extract attribute from element
function extractAttr(root, selector, attr) {
  const el = root.querySelector(selector);
  return el ? el.getAttribute(attr) : '';
}

// Utility: Extract date from various formats
function extractDate(root) {
  const dateSelectors = [
    'time[datetime]',
    '.date',
    '.post-date',
    '.published',
    '[class*="date"]',
    '[class*="time"]'
  ];
  
  for (const selector of dateSelectors) {
    const el = root.querySelector(selector);
    if (el) {
      const datetime = el.getAttribute('datetime');
      if (datetime) return datetime.split('T')[0];
      const text = el.textContent.trim();
      if (text && text.match(/\d{4}-\d{2}-\d{2}/)) return text.match(/\d{4}-\d{2}-\d{2}/)[0];
      if (text) return text;
    }
  }
  
  // Try meta tags
  const metaDate = root.querySelector('meta[property="article:published_time"]');
  if (metaDate) {
    const content = metaDate.getAttribute('content');
    if (content) return content.split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

// Utility: Extract category
function extractCategory(root) {
  const catSelectors = [
    '.category',
    '.post-category',
    '[class*="category"] a',
    '.blog-category',
    'a[rel="category"]'
  ];
  
  for (const selector of catSelectors) {
    const el = root.querySelector(selector);
    if (el) {
      return el.textContent.trim();
    }
  }
  
  return 'Blog';
}

// Utility: Extract excerpt
function extractExcerpt(root) {
  const excerptSelectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    '.excerpt',
    '.post-excerpt',
    '[class*="excerpt"]',
    '.lead'
  ];
  
  for (const selector of excerptSelectors) {
    const el = root.querySelector(selector);
    if (el) {
      const content = el.getAttribute('content') || el.textContent.trim();
      if (content && content.length > 20) {
        return content.substring(0, 200);
      }
    }
  }
  
  return '';
}

// Utility: Extract image from element (handles lazy loading)
function extractImageFromElement(el, baseUrl) {
  if (!el) return '';
  
  // Check various image attributes in priority order
  const attrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-srcset', 'srcset'];
  
  for (const attr of attrs) {
    let src = el.getAttribute(attr);
    if (src) {
      // Handle srcset - get first URL
      if (attr.includes('srcset')) {
        src = src.split(',')[0].split(' ')[0];
      }
      
      // Make absolute URL
      if (src.startsWith('/')) {
        src = baseUrl + src;
      } else if (src.startsWith('//')) {
        src = 'https:' + src;
      }
      
      // Skip data URLs
      if (src.startsWith('data:')) continue;
      
      return src;
    }
  }
  
  return '';
}

// Check if image is a logo or placeholder
function isLogoOrPlaceholder(imageUrl) {
  if (!imageUrl) return true;
  const lower = imageUrl.toLowerCase();
  return lower.includes('logo') || 
         lower.includes('placeholder') || 
         lower.includes('blank') || 
         lower.includes('icon') ||
         lower.includes('asyplu') ||
         lower.includes('default');
}

// Utility: Extract featured image from single post
function extractFeaturedImage(root, baseUrl, archiveImageUrl = '') {
  // Priority 1: Use archive card image if provided and not a logo
  if (archiveImageUrl && !isLogoOrPlaceholder(archiveImageUrl)) {
    return archiveImageUrl;
  }
  
  // Priority 2: og:image meta tag (but not logos)
  const ogImage = root.querySelector('meta[property="og:image"]');
  if (ogImage) {
    let src = ogImage.getAttribute('content');
    if (src) {
      if (src.startsWith('/')) src = baseUrl + src;
      if (src.startsWith('//')) src = 'https:' + src;
      if (!isLogoOrPlaceholder(src)) {
        return src;
      }
    }
  }
  
  // Priority 3: Featured image selectors
  const featuredSelectors = [
    '.featured-image img',
    '.post-thumbnail img',
    '.blog-image img',
    'img[class*="featured"]',
    'img[class*="thumbnail"]',
    '.wp-post-image',
    '.elementor-post__thumbnail img',
    'article img:first-child'
  ];
  
  for (const selector of featuredSelectors) {
    const img = root.querySelector(selector);
    const src = extractImageFromElement(img, baseUrl);
    if (src && !isLogoOrPlaceholder(src)) {
      return src;
    }
  }
  
  // Priority 4: First meaningful image in article content (skip logos)
  const article = root.querySelector('article, .post-content, .entry-content, [class*="content"]');
  if (article) {
    const imgs = article.querySelectorAll('img');
    for (const img of imgs) {
      const src = extractImageFromElement(img, baseUrl);
      if (src && !isLogoOrPlaceholder(src)) {
        // Check image dimensions if possible (skip very small images)
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        if (width && height) {
          const w = parseInt(width);
          const h = parseInt(height);
          if (w >= 200 && h >= 200) {
            return src;
          }
        } else {
          // No dimensions, but not a logo - use it
          return src;
        }
      }
    }
  }
  
  // Priority 5: Any image in content that's not a logo
  const allImgs = root.querySelectorAll('img');
  for (const img of allImgs) {
    const src = extractImageFromElement(img, baseUrl);
    if (src && !isLogoOrPlaceholder(src)) {
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      if (!width || !height || (parseInt(width) >= 200 && parseInt(height) >= 200)) {
        return src;
      }
    }
  }
  
  return '';
}

// Utility: Extract blog content
function extractContent(root) {
  // Helper to clean HTML string
  function cleanHtml(htmlStr) {
    // Remove script, style, and unwanted elements using regex
    return htmlStr
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  }
  
  // Priority 1: WordPress entry content
  let entryContent = root.querySelector('.entry-content');
  if (entryContent && entryContent.innerHTML && entryContent.innerHTML.trim().length > 200) {
    let content = cleanHtml(entryContent.innerHTML);
    
    // Try to get .container div
    const containerMatch = content.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<div class="has_eae_slider/);
    if (containerMatch && containerMatch[1]) {
      return containerMatch[1];
    }
    
    return content;
  }
  
  // Priority 2: Elementor theme post content
  let elementorContent = root.querySelector('.elementor-widget-theme-post-content');
  if (elementorContent && elementorContent.innerHTML && elementorContent.innerHTML.trim().length > 200) {
    return cleanHtml(elementorContent.innerHTML);
  }
  
  // Priority 3: Article element (not archive card)
  const articles = root.querySelectorAll('article');
  for (const article of articles) {
    if (article.classList.contains('elementor-post') || 
        article.classList.contains('grid-item') ||
        article.querySelector('.elementor-post__card') ||
        article.querySelector('.elementor-posts-container')) {
      continue;
    }
    
    if (article.innerHTML && article.innerHTML.trim().length > 200) {
      return cleanHtml(article.innerHTML);
    }
  }
  
  // Priority 4: Main content
  const main = root.querySelector('main');
  if (main && main.innerHTML) {
    let content = cleanHtml(main.innerHTML);
    if (content.trim().length > 200) {
      return content;
    }
  }
  
  // Fallback: Collect content elements
  const contentParts = [];
  const elements = root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, figure, table');
  
  for (const el of elements) {
    if (el.closest('header') || el.closest('nav') || el.closest('footer') || el.closest('.elementor-post__card')) {
      continue;
    }
    
    const text = el.textContent.trim();
    if (text.length > 20) {
      contentParts.push(el.outerHTML);
    }
  }
  
  return contentParts.length > 0 ? contentParts.join('\n') : '';
}

// Extract pagination URLs from archive page
function extractPaginationUrls(html, baseUrl) {
  const root = parse(html);
  const paginationUrls = [];
  const seenUrls = new Set();
  
  // Look for next page links with various selectors
  const nextSelectors = [
    'a.next',
    'a[rel="next"]',
    '.next-page a',
    '.pagination .next a',
    'a[href*="/page/"]',
    '.nav-previous a',
    '.pagination a[href]',
    '.elementor-button-text:contains("Next")',
    '[class*="next"] a[href*="page"]',
    'a[href*="paged="]'
  ];
  
  for (const selector of nextSelectors) {
    try {
      const links = root.querySelectorAll(selector);
      links.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim().toLowerCase();
        
        if (href && (href.includes('/page/') || href.includes('paged=') || text.includes('next') || text.includes('load more'))) {
          const fullUrl = href.startsWith('http') ? href : baseUrl + href;
          if (!seenUrls.has(fullUrl) && !fullUrl.endsWith('/page/1/')) {
            seenUrls.add(fullUrl);
            paginationUrls.push(fullUrl);
          }
        }
      });
    } catch (e) {
      // Selector might be invalid, continue
    }
  }
  
  // Also check for explicit page numbers (page/2/, page/3/, etc.)
  const pageLinks = root.querySelectorAll('a[href*="/page/"]');
  pageLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/\/page\/(\d+)\//);
      if (match) {
        const pageNum = parseInt(match[1]);
        if (pageNum > 1) {
          const fullUrl = href.startsWith('http') ? href : baseUrl + href;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            paginationUrls.push(fullUrl);
          }
        }
      }
    }
  });
  
  return paginationUrls;
}

// Parse Insta Web Works blog archive
async function parseInstaWebWorks(html, baseUrl, archiveImageUrlMap = {}) {
  const root = parse(html);
  const posts = [];
  const seenUrls = new Set();
  
  // Find all blog post cards/articles
  const articleSelectors = [
    'article',
    '.blog-post',
    '.post-card',
    '.blog-grid > div',
    '[class*="post"]',
    '[class*="blog"]'
  ];
  
  let articles = [];
  for (const selector of articleSelectors) {
    const found = root.querySelectorAll(selector);
    if (found.length > 0) {
      articles = found;
      break;
    }
  }
  
  // Extract image from each article card
  articles.forEach(article => {
    const linkEl = article.querySelector('a[href]');
    if (!linkEl) return;
    
    const href = linkEl.getAttribute('href');
    if (!href || !href.includes('/blog/') || href.includes('/page/')) return;
    
    const fullUrl = href.startsWith('http') ? href : baseUrl + href;
    if (seenUrls.has(fullUrl)) return;
    
    // Extract image from this specific card
    const imgEl = article.querySelector('img');
    let imageUrl = '';
    if (imgEl) {
      imageUrl = extractImageFromElement(imgEl, baseUrl);
    }
    
    seenUrls.add(fullUrl);
    archiveImageUrlMap[fullUrl] = imageUrl;
  });
  
  // Also try direct link extraction
  const linkSelectors = [
    'article a[href*="/blog/"]',
    '.blog-post a',
    '.post-card a',
    '.blog-grid a'
  ];
  
  for (const selector of linkSelectors) {
    const links = root.querySelectorAll(selector);
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('/blog/') && !href.includes('/page/') && !href.includes('/blog.html')) {
        const fullUrl = href.startsWith('http') ? href : baseUrl + href;
        if (!seenUrls.has(fullUrl)) {
          // Try to find image from parent
          const parent = link.closest('article') || link.closest('.blog-post') || link.closest('.post-card');
          let imageUrl = '';
          if (parent) {
            const imgEl = parent.querySelector('img');
            if (imgEl) {
              imageUrl = extractImageFromElement(imgEl, baseUrl);
            }
          }
          seenUrls.add(fullUrl);
          archiveImageUrlMap[fullUrl] = imageUrl;
        }
      }
    });
  }
  
  console.log(`  Found ${seenUrls.size} blog URLs on this page`);
  
  for (const url of seenUrls) {
    try {
      console.log(`  Fetching: ${url}`);
      const postHtml = await fetchUrl(url);
      const postRoot = parse(postHtml);
      
      const title = extractText(postRoot, 'h1') || extractText(postRoot, 'title') || 'Untitled';
      const slug = createSlug(title);
      const imageUrl = archiveImageUrlMap[url] || extractFeaturedImage(postRoot, baseUrl);
      
      posts.push({
        title,
        slug,
        url,
        source: 'Insta Web Works',
        sourceDomain: baseUrl,
        archiveImageUrl: archiveImageUrlMap[url] || ''
      });
      
      stats.instaWebWorks++;
    } catch (error) {
      console.error(`  Failed to fetch ${url}: ${error.message}`);
      stats.failed.push({ url, error: error.message, source: 'Insta Web Works' });
    }
  }
  
  return posts;
}

// Parse Easy Pluginz blog archive
async function parseEasyPluginz(html, baseUrl, archiveImageUrlMap = {}) {
  const root = parse(html);
  const posts = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  
  // Easy Pluginz uses Elementor archive posts
  // Structure: <article class="elementor-post"> with .elementor-post__thumbnail__link and .elementor-post__title
  const articles = root.querySelectorAll('article.elementor-post, article[class*="elementor-grid-item"]');
  
  console.log(`  Found ${articles.length} Elementor article cards on this page`);
  
  articles.forEach(article => {
    // Extract link
    const linkEl = article.querySelector('a.elementor-post__thumbnail__link, a.elementor-post__read-more, a[href]');
    if (!linkEl) return;
    
    let href = linkEl.getAttribute('href');
    if (!href) return;
    
    const fullUrl = href.startsWith('http') ? href : baseUrl + href;
    
    // Skip non-blog URLs
    if (!fullUrl.includes('/blogs/') && !fullUrl.includes('easy-pluginz.com')) return;
    if (fullUrl.includes('/blogs/page/') || fullUrl.endsWith('/blogs/') || fullUrl.endsWith('/blogs')) return;
    
    // Extract title
    const titleEl = article.querySelector('.elementor-post__title, h3 a, h2 a');
    let title = titleEl ? titleEl.textContent.trim() : '';
    
    // Skip if title is too short or generic
    if (title.length < 10) return;
    
    // Extract image from this specific card
    const imgEl = article.querySelector('.elementor-post__thumbnail img, img');
    let imageUrl = '';
    if (imgEl) {
      imageUrl = extractImageFromElement(imgEl, baseUrl);
      // Skip logo images
      if (imageUrl.includes('logo') || imageUrl.includes('icon')) {
        imageUrl = '';
      }
    }
    
    if (!seenUrls.has(fullUrl) && !seenTitles.has(title)) {
      seenUrls.add(fullUrl);
      seenTitles.add(title);
      archiveImageUrlMap[fullUrl] = imageUrl;
      
      const slug = createSlug(title);
      posts.push({
        title,
        slug,
        url: fullUrl,
        source: 'Easy Pluginz',
        sourceDomain: baseUrl,
        archiveImageUrl: imageUrl
      });
      
      stats.easyPluginz++;
      console.log(`    Found: ${title.substring(0, 60)}...`);
    }
  });
  
  console.log(`  Total Easy Pluginz posts found on this page: ${posts.length}`);
  
  return posts;
}

// Crawl all archive pages with pagination
async function crawlAllArchivePages(source) {
  console.log(`\nCrawling ${source.name} archive pages...`);
  console.log(`  Base URL: ${source.archiveUrl}`);
  
  const allPosts = [];
  const archiveImageUrlMap = {};
  const pagesToCrawl = new Set([source.archiveUrl]);
  const crawledPages = new Set();
  
  // For WordPress sites, also try common pagination patterns
  if (source.name === 'Easy Pluginz') {
    // WordPress typically uses /page/2/, /page/3/, etc.
    // Try up to 10 pages
    for (let i = 2; i <= 10; i++) {
      const pageUrl = `${source.archiveUrl}page/${i}/`;
      if (pageUrl.endsWith('/page/1/')) continue;
      pagesToCrawl.add(pageUrl);
    }
  }
  
  while (pagesToCrawl.size > 0) {
    const pageUrl = Array.from(pagesToCrawl)[0];
    pagesToCrawl.delete(pageUrl);
    
    if (crawledPages.has(pageUrl)) continue;
    crawledPages.add(pageUrl);
    
    const pageNum = crawledPages.size;
    console.log(`\nCrawling ${source.name} archive page ${pageNum}`);
    console.log(`  URL: ${pageUrl}`);
    
    try {
      const html = await fetchUrl(pageUrl);
      stats.archivePagesCrawled++;
      
      let posts;
      if (source.name === 'Insta Web Works') {
        posts = await parseInstaWebWorks(html, source.domain, archiveImageUrlMap);
      } else {
        posts = await parseEasyPluginz(html, source.domain, archiveImageUrlMap);
      }
      
      allPosts.push(...posts);
      
      // Find pagination URLs
      const paginationUrls = extractPaginationUrls(html, source.domain);
      paginationUrls.forEach(url => {
        if (!crawledPages.has(url)) {
          pagesToCrawl.add(url);
        }
      });
      
      if (paginationUrls.length > 0) {
        console.log(`  Found ${paginationUrls.length} pagination links`);
      }
      
      // Stop if no posts found on this page (end of pagination)
      if (posts.length === 0 && pageNum > 1) {
        console.log(`  No more posts found - stopping pagination`);
        break;
      }
    } catch (error) {
      console.error(`  Failed to crawl ${pageUrl}: ${error.message}`);
      stats.failed.push({ url: pageUrl, error: error.message, source: source.name });
      // Stop on error for WordPress pagination
      if (pageUrl.includes('/page/')) {
        break;
      }
    }
  }
  
  console.log(`\n${source.name} crawling complete:`);
  console.log(`  Pages crawled: ${stats.archivePagesCrawled}`);
  console.log(`  Posts found: ${allPosts.length}`);
  
  return { posts: allPosts, archiveImageUrlMap };
}

// Download and process images from content
async function processImages(content, slug, sourceDomain, featuredImageUrl) {
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images = [];
  let match;
  
  while ((match = imgPattern.exec(content)) !== null) {
    images.push(match[1]);
  }
  
  const imageDir = path.join(CONFIG.outputDir.images, slug);
  const processedContent = content;
  const downloadedImages = [];
  
  for (let i = 0; i < images.length; i++) {
    let imgSrc = images[i];
    
    // Make absolute URL
    if (imgSrc.startsWith('/')) {
      imgSrc = sourceDomain + imgSrc;
    } else if (imgSrc.startsWith('//')) {
      imgSrc = 'https:' + imgSrc;
    }
    
    // Skip data URLs and logos
    if (imgSrc.startsWith('data:')) continue;
    if (isLogoOrPlaceholder(imgSrc)) continue;
    
    try {
      const ext = path.extname(imgSrc.split('?')[0]) || '.jpg';
      const imgName = i === 0 ? `featured-image${ext}` : `image-${i}${ext}`;
      const imgPath = path.join(imageDir, imgName);
      
      console.log(`    Downloading image: ${imgSrc}`);
      await downloadFile(imgSrc, imgPath);
      
      const localPath = `/images_001/blog/${slug}/${imgName}`;
      downloadedImages.push(localPath);
      
      // Replace in content
      content = content.replace(imgSrc, localPath);
      content = content.replace(imgSrc.replace(/'/g, '"'), localPath);
      
      stats.imagesDownloaded++;
    } catch (error) {
      console.error(`    Failed to download image ${imgSrc}: ${error.message}`);
    }
  }
  
  // Download featured image if not already in content and not a logo
  if (featuredImageUrl && !isLogoOrPlaceholder(featuredImageUrl)) {
    try {
      let imgSrc = featuredImageUrl;
      if (imgSrc.startsWith('/')) {
        imgSrc = sourceDomain + imgSrc;
      } else if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      
      if (!imgSrc.startsWith('data:')) {
        const ext = path.extname(imgSrc.split('?')[0]) || '.jpg';
        const imgName = `featured-image${ext}`;
        const imgPath = path.join(imageDir, imgName);
        
        if (!fs.existsSync(imgPath)) {
          console.log(`    Downloading featured image: ${imgSrc}`);
          await downloadFile(imgSrc, imgPath);
          stats.imagesDownloaded++;
        }
        
        const localPath = `/images_001/blog/${slug}/${imgName}`;
        downloadedImages.unshift(localPath);
      }
    } catch (error) {
      console.error(`    Failed to download featured image: ${error.message}`);
    }
  }
  
  // If no images downloaded, log warning
  if (downloadedImages.length === 0) {
    console.warn(`    ⚠️  No images downloaded for ${slug}`);
  }
  
  return { content, downloadedImages };
}

// Track image usage for duplicate detection
function trackImageUsage(imageUrl, postTitle) {
  if (!imageUrl || isLogoOrPlaceholder(imageUrl)) return;
  
  const count = imageUsageCount.get(imageUrl) || [];
  count.push(postTitle);
  imageUsageCount.set(imageUrl, count);
  
  if (count.length > 1) {
    console.warn(`  ⚠️  Possible repeated image detected: ${imageUrl}`);
    console.warn(`     Used by: ${count.join(', ')}`);
    
    if (!stats.postsWithRepeatedImages.includes(imageUrl)) {
      stats.postsWithRepeatedImages.push(imageUrl);
    }
  }
}

// Generate blog HTML file
async function generateBlogHtml(post, template) {
  const { title, slug, content, image, date, category, excerpt, source, sourceDomain } = post;
  
  let html = template;
  
  // Replace placeholders
  html = html.replace(/{{BLOG_TITLE}}/g, title);
  html = html.replace(/{{BLOG_EXCERPT}}/g, excerpt || title);
  html = html.replace(/{{BLOG_DATE}}/g, date);
  html = html.replace(/{{BLOG_CATEGORY}}/g, category || 'Blog');
  html = html.replace(/{{BLOG_SOURCE}}/g, source);
  html = html.replace(/{{BLOG_SLUG}}/g, slug);
  html = html.replace(/{{BLOG_URL}}/g, `https://instawebworks.com.au/blog/${slug}/`);
  
  // Handle image - use local path if available, otherwise original URL
  const ogImage = image || '/assets/images/blogs/default-blog.webp';
  html = html.replace(/{{BLOG_IMAGE}}/g, ogImage);
  
  // Update SEO tags
  html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${excerpt || title}">`);
  html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${title}">`);
  html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${excerpt || title}">`);
  html = html.replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${ogImage}">`);
  
  // Insert content
  html = html.replace(/{{BLOG_CONTENT}}/, content);
  
  return html;
}

// Clean old generated files
function cleanOldFiles() {
  console.log('\nCleaning old generated files...');
  
  const filesToDelete = [
    CONFIG.blogDataFile,
    CONFIG.redirectMapFile,
    CONFIG.reportFile
  ];
  
  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`  Deleted: ${file}`);
    }
  });
  
  // Delete blogs folder
  if (fs.existsSync(CONFIG.outputDir.blogs)) {
    fs.rmSync(CONFIG.outputDir.blogs, { recursive: true, force: true });
    console.log(`  Deleted: ${CONFIG.outputDir.blogs}/`);
  }
  
  // Delete blog images folder
  const blogImagesDir = CONFIG.outputDir.images;
  if (fs.existsSync(blogImagesDir)) {
    fs.rmSync(blogImagesDir, { recursive: true, force: true });
    console.log(`  Deleted: ${blogImagesDir}/`);
  }
  
  // Recreate directories
  if (!fs.existsSync(CONFIG.outputDir.blogs)) {
    fs.mkdirSync(CONFIG.outputDir.blogs, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.outputDir.images)) {
    fs.mkdirSync(CONFIG.outputDir.images, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.outputDir.assets)) {
    fs.mkdirSync(CONFIG.outputDir.assets, { recursive: true });
  }
}

// Main migration function
async function migrate() {
  console.log('='.repeat(60));
  console.log('Starting Blog Migration Script');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  
  // Clean old files
  cleanOldFiles();
  
  // Load template
  console.log('\nLoading blog template...');
  const template = fs.readFileSync(CONFIG.templateFile, 'utf-8');
  
  // Crawl all archive pages
  const allPosts = [];
  const archiveImageUrlMaps = {};
  
  for (const source of CONFIG.sources) {
    const result = await crawlAllArchivePages(source);
    allPosts.push(...result.posts);
    archiveImageUrlMaps[source.name] = result.archiveImageUrlMap;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Crawling Complete');
  console.log('='.repeat(60));
  console.log(`Total archive pages crawled: ${stats.archivePagesCrawled}`);
  console.log(`Total unique posts found: ${allPosts.length}`);
  console.log(`  - Insta Web Works: ${stats.instaWebWorks}`);
  console.log(`  - Easy Pluginz: ${stats.easyPluginz}`);
  
  // Deduplicate by URL and slug
  const seenUrls = new Set();
  const seenSlugs = new Set();
  const deduplicatedPosts = [];
  
  for (const post of allPosts) {
    if (seenUrls.has(post.url)) {
      stats.duplicateUrlsRemoved++;
      continue;
    }
    
    let slug = post.slug;
    let slugCounter = 1;
    while (seenSlugs.has(slug)) {
      slug = `${post.slug}-${slugCounter}`;
      slugCounter++;
      stats.duplicateSlugsRemoved++;
    }
    post.slug = slug;
    
    seenUrls.add(post.url);
    seenSlugs.add(slug);
    deduplicatedPosts.push(post);
  }
  
  console.log(`\nAfter deduplication: ${deduplicatedPosts.length} posts`);
  console.log(`  Duplicate URLs removed: ${stats.duplicateUrlsRemoved}`);
  console.log(`  Duplicate slugs adjusted: ${stats.duplicateSlugsRemoved}`);
  
  // Process each post
  const blogData = [];
  const redirectMap = [];
  
  console.log('\nGenerating blog pages...');
  for (const post of deduplicatedPosts) {
    try {
      console.log(`\nProcessing: ${post.title}`);
      
      // Fetch full post content
      const postHtml = await fetchUrl(post.url);
      const postRoot = parse(postHtml);
      
      // Extract all data
      const date = extractDate(postRoot);
      const category = extractCategory(postRoot);
      const excerpt = extractExcerpt(postRoot);
      
      // Get featured image with proper priority
      const archiveImage = post.archiveImageUrl || '';
      const featuredImage = extractFeaturedImage(postRoot, post.sourceDomain, archiveImage);
      
      // Track image usage
      trackImageUsage(featuredImage, post.title);
      
      if (!featuredImage) {
        console.warn(`  ⚠️  No image found for: ${post.title}`);
        stats.postsWithMissingImages.push(post.title);
      }
      
      // Process content images
      const content = extractContent(postRoot);
      const { downloadedImages } = await processImages(content, post.slug, post.sourceDomain, featuredImage);
      
      // Generate HTML
      const html = await generateBlogHtml({
        ...post,
        date,
        category,
        excerpt,
        image: featuredImage,
        content: downloadedImages.length > 0 ? content : content
      }, template);
      
      // Save HTML file
      const outputPath = path.join(CONFIG.outputDir.blogs, `${post.slug}.html`);
      fs.writeFileSync(outputPath, html);
      console.log(`  Saved: ${outputPath}`);
      
      // Use local image path if available
      const localImagePath = downloadedImages.length > 0 
        ? downloadedImages[0] 
        : (featuredImage || '/assets/images/blogs/default.webp');
      
      stats.generated++;
      
      // Use local image path if available, otherwise use original URL or fallback
      let finalImagePath;
      if (downloadedImages.length > 0) {
        finalImagePath = downloadedImages[0];
      } else if (featuredImage && !isLogoOrPlaceholder(featuredImage)) {
        finalImagePath = featuredImage;
      } else {
        // Use a default fallback for posts without images
        finalImagePath = '/assets/images/blogs/default-blog.webp';
        console.warn(`    Using fallback image for: ${post.title}`);
      }
      
      // Add to blog data
      blogData.push({
        title: post.title,
        slug: post.slug,
        source: post.source,
        oldUrl: post.url,
        newUrl: `https://instawebworks.com.au/blog/${post.slug}/`,
        image: finalImagePath,
        date: date,
        category: category,
        excerpt: excerpt
      });
      
      // Add to redirect map (only for Easy Pluginz)
      if (post.source === 'Easy Pluginz') {
        redirectMap.push({
          source: post.source,
          title: post.title,
          oldUrl: post.url,
          newUrl: `https://instawebworks.com.au/blog/${post.slug}/`
        });
      }
    } catch (error) {
      console.error(`Failed to process ${post.title}: ${error.message}`);
      stats.failed.push({ url: post.url, title: post.title, error: error.message });
    }
  }
  
  // Save blog-data.js
  console.log('\nSaving blog-data.js...');
  const blogDataContent = `// Auto-generated blog data - DO NOT EDIT MANUALLY
// Generated by migrate-blogs.js on ${new Date().toISOString()}

export const blogData = ${JSON.stringify(blogData, null, 2)};

// Default export for compatibility
export default blogData;
`;
  fs.writeFileSync(CONFIG.blogDataFile, blogDataContent);
  
  // Save redirect-map.json
  console.log('Saving redirect-map.json...');
  fs.writeFileSync(CONFIG.redirectMapFile, JSON.stringify(redirectMap, null, 2));
  
  // Generate migration report
  const report = {
    generatedAt: new Date().toISOString(),
    totalInstaWebWorksPostsFound: stats.instaWebWorks,
    totalEasyPluginzPostsFound: stats.easyPluginz,
    totalPostsGenerated: stats.generated,
    totalImagesDownloaded: stats.imagesDownloaded,
    archivePagesCrawled: stats.archivePagesCrawled,
    duplicateUrlsRemoved: stats.duplicateUrlsRemoved,
    duplicateSlugsRemoved: stats.duplicateSlugsRemoved,
    postsWithMissingImages: stats.postsWithMissingImages,
    postsWithRepeatedImages: stats.postsWithRepeatedImages,
    failedUrls: stats.failed
  };
  
  console.log('Saving migration-report.json...');
  fs.writeFileSync(CONFIG.reportFile, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Complete!');
  console.log('='.repeat(60));
  console.log(`Blog posts found from Insta Web Works: ${stats.instaWebWorks}`);
  console.log(`Blog posts found from Easy Pluginz: ${stats.easyPluginz}`);
  console.log(`Total archive pages crawled: ${stats.archivePagesCrawled}`);
  console.log(`Blog posts generated: ${stats.generated}`);
  console.log(`Images downloaded: ${stats.imagesDownloaded}`);
  console.log(`Duplicate URLs removed: ${stats.duplicateUrlsRemoved}`);
  console.log(`Duplicate slugs adjusted: ${stats.duplicateSlugsRemoved}`);
  console.log(`Posts with missing images: ${stats.postsWithMissingImages.length}`);
  console.log(`Posts with repeated images: ${stats.postsWithRepeatedImages.length}`);
  
  if (stats.failed.length > 0) {
    console.log(`\nFailed URLs (${stats.failed.length}):`);
    stats.failed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.url} - ${item.error}`);
    });
  }
  
  if (stats.postsWithRepeatedImages.length > 0) {
    console.log(`\nRepeated images detected (${stats.postsWithRepeatedImages.length}):`);
    stats.postsWithRepeatedImages.forEach((img, i) => {
      console.log(`  ${i + 1}. ${img}`);
    });
  }
  
  console.log('\nOutput files:');
  console.log(`  - ${CONFIG.blogDataFile}`);
  console.log(`  - ${CONFIG.redirectMapFile}`);
  console.log(`  - ${CONFIG.reportFile}`);
  console.log(`  - ${CONFIG.outputDir.blogs}/ (${stats.generated} files)`);
  console.log(`  - ${CONFIG.outputDir.images}/ (images organized by slug)`);
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run migration
migrate().catch(console.error);
