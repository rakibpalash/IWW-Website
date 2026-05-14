# Blog Migration Script

Automatically migrates blog posts from Insta Web Works and Easy Pluginz into a combined blog section.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the migration:
```bash
npm run migrate
```

## What the script does

1. **Crawls both blog archives:**
   - https://instawebworks.com.au/blog/
   - https://easy-pluginz.com/blogs/

2. **Extracts blog data:**
   - Title
   - Slug (auto-generated from title)
   - Featured image
   - Publish date
   - Category
   - Excerpt/meta description
   - Full body content

3. **Downloads all images** from each blog post to:
   ```
   images_001/blog/{slug}/
   ```

4. **Generates static HTML files** for each blog post:
   ```
   blogs/{slug}.html
   ```

5. **Creates combined blog data** file:
   ```
   assets/js/blog-data.js
   ```

6. **Creates redirect map** for Easy Pluginz URLs:
   ```
   redirect-map.json
   ```

## Output Structure

```
assets/
  js/
    blog-data.js

images_001/
  blog/
    {slug}/
      image files

blogs/
  {slug}.html

blog.html (updated to display all posts)
redirect-map.json
vercel.json (updated with blog routes)
```

## URL Structure

After migration:
- `/blog/` → Shows all blog posts combined
- `/blog/{slug}/` → Individual blog post page

## SEO Features

- Canonical URLs point to `https://instawebworks.com.au/blog/{slug}/`
- All pages are set to `index, follow`
- Proper meta tags (title, description, og:image)
- Redirect map for Easy Pluginz old URLs (use for 301 redirects)

## Local Testing

### Important: VS Code Live Server Limitation

**VS Code Live Server does not support Vercel rewrites.**

Clean URLs like `/blog/{slug}/` will NOT work on `http://127.0.0.1:5500` using the standard Live Server extension.

You will see errors like:
```
Cannot GET /blog/onedrive-for-zoho-crm-complete-microsoft-365-integration-guide/
```

### Option 1: Use Vercel CLI for Local Testing (Recommended)

To test clean URLs locally with proper routing:

```bash
# Install Vercel CLI globally
npm install -g vercel

# Run local development server
vercel dev

# Then test at:
# http://localhost:3000/blog/
# http://localhost:3000/blog/{slug}/
```

This will properly handle the rewrite rules defined in `vercel.json`.

### Option 2: Direct File Access (Quick Testing)

If you just want to preview individual blog pages without clean URLs:

```
http://127.0.0.1:5500/blogs/{slug}.html
```

This bypasses the rewrite system and opens the file directly.

### Option 3: Deploy to Vercel (Production Testing)

For final testing, deploy to Vercel:

```bash
vercel --prod
```

Then test the live URLs:
```
https://your-domain.com/blog/
https://your-domain.com/blog/{slug}/
```

## Production Deployment

1. Push to Git (GitHub/GitLab/Bitbucket)
2. Connect repository to Vercel
3. Vercel automatically applies `vercel.json` rewrites
4. Clean URLs work immediately after deployment

## Notes

- Blog content is preserved exactly as-is (no rewriting)
- Image paths are rewritten to use local downloaded images
- Source is tracked for each post ("Insta Web Works" or "Easy Pluginz")
- Failed URLs are logged in the terminal output
- **Blog card links use `/blog/{slug}/` format for SEO**
- **Vercel rewrites map clean URLs to actual file locations**
