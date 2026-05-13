# Insta Web Works Static Frontend Architecture

This project recreates and redesigns the Insta Web Works website as a scalable, component-oriented static frontend system using pure HTML, CSS, and vanilla JavaScript.

## Highlights

- Multi-page architecture with archive and single templates
- Shared CSS design system split by concern
- Shared JavaScript data and rendering layer
- Reusable HTML partials in `/components`
- Placeholder image paths ready for future asset replacement

## Included Pages

- `index.html`
- `about.html`
- `contact.html`
- `services.html`
- `service-single.html`
- `case-studies.html`
- `case-study-single.html`
- `extensions.html`
- `extension-single.html`
- `zoho-products.html`
- `zoho-product-single.html`
- `blog.html`
- `blog-single.html`

## Notes

- Repeated grids are rendered from `assets/js/data.js` through `assets/js/render.js`
- Shared header and footer are loaded from `/components` by `assets/js/main.js`
- The structure is designed to be easy to port later into a CMS, templating layer, or Next.js app
