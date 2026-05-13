import {
  blogData,
  caseStudiesData,
  clientLogos,
  extensionsData,
  faqData,
  productsData,
  servicesData,
  statsData,
  testimonialsData
} from "./data.js";

function serviceCardTemplate(item) {
  return `<article class="card service-card stack-md"><div class="card-icon" aria-hidden="true"><i class="${item.icon}"></i></div><h3>${item.title}</h3><p>${item.description}</p><a class="btn btn-outline" href="${item.link}">Explore service</a></article>`;
}

function extensionCardTemplate(item) {
  return `<article class="card extension-card stack-md"><div class="card-image"><img src="${item.image}" alt="${item.title} extension logo"></div><h3>${item.title}</h3><p>${item.description}</p><div class="cluster"><a class="btn btn-outline" href="${item.link}">Learn more</a><a class="btn btn-secondary" href="${item.marketplace}" target="_blank" rel="noreferrer">Marketplace</a></div></article>`;
}

function productCardTemplate(item) {
  return `<article class="card product-card stack-md"><div class="card-image"><img src="${item.image}" alt="${item.title} logo"></div><h3>${item.title}</h3><p>${item.description}</p><a class="btn btn-outline" href="${item.link}">View product support</a></article>`;
}

function blogCardTemplate(item) {
  return `<article class="card blog-card stack-md"><div class="card-image"><img src="${item.image}" alt="${item.title} article image"></div><span class="card-meta">${item.category}</span><h3>${item.title}</h3><p>${item.excerpt}</p><a class="btn btn-outline" href="${item.link}">Read insight</a></article>`;
}

function caseStudyCardTemplate(item) {
  return `<article class="card blog-card stack-md"><div class="card-image"><img src="${item.image}" alt="${item.title} case study image"></div><span class="card-meta">${item.category}</span><h3>${item.title}</h3><p>${item.excerpt}</p><a class="btn btn-outline" href="${item.link}">Read case study</a></article>`;
}

function testimonialTemplate(item, index) {
  return `<article class="card testimonial-card ${index === 0 ? "is-active" : ""}" data-slide="${index}"><div class="split"><div class="stack-md"><span class="section-eyebrow">Client Perspective</span><p class="lead">"${item.quote}"</p><div><h3>${item.name}</h3><p>${item.role}</p></div></div><div class="card-image"><img src="${item.image}" alt="${item.name} reference image"></div></div></article>`;
}

function faqTemplate(item, index) {
  return `<div class="faq-item ${index === 0 ? "is-open" : ""}"><button class="faq-question" type="button" aria-expanded="${index === 0 ? "true" : "false"}"><span>${item.question}</span><span aria-hidden="true">+</span></button><div class="faq-answer"><p>${item.answer}</p></div></div>`;
}

function statsTemplate(item) {
  return `<article class="card stat-card stack-md"><div class="stat-value">${item.value}</div><p>${item.label}</p></article>`;
}

function logoTemplate(item) {
  return `<div class="card logo-pill"><img src="${item.image}" alt="${item.name} logo"><span>${item.name}</span></div>`;
}

const registry = {
  services: { data: servicesData, template: serviceCardTemplate },
  servicesLimited: { data: servicesData.slice(0, 6), template: serviceCardTemplate },
  relatedServices: { data: servicesData.slice(6, 9), template: serviceCardTemplate },
  extensions: { data: extensionsData, template: extensionCardTemplate },
  extensionsLimited: { data: extensionsData.slice(0, 6), template: extensionCardTemplate },
  relatedExtensions: { data: extensionsData.slice(1, 4), template: extensionCardTemplate },
  products: { data: productsData, template: productCardTemplate },
  productsLimited: { data: productsData.slice(0, 6), template: productCardTemplate },
  caseStudies: { data: caseStudiesData, template: caseStudyCardTemplate },
  caseStudiesLimited: { data: caseStudiesData, template: caseStudyCardTemplate },
  blogs: { data: blogData, template: blogCardTemplate },
  blogsLimited: { data: blogData.slice(0, 3), template: blogCardTemplate },
  relatedBlogs: { data: blogData.slice(2, 5), template: blogCardTemplate },
  relatedCaseStudies: { data: caseStudiesData.slice(1, 3), template: caseStudyCardTemplate },
  testimonials: { data: testimonialsData, template: testimonialTemplate },
  faq: { data: faqData, template: faqTemplate },
  stats: { data: statsData, template: statsTemplate },
  logos: { data: clientLogos, template: logoTemplate }
};

export function initDynamicSections() {
  document.querySelectorAll("[data-render]").forEach((node) => {
    const key = node.dataset.render;
    const entry = registry[key];
    if (entry) {
      node.innerHTML = entry.data.map(entry.template).join("");
    }
  });
}
