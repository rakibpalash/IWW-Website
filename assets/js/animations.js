import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm";

let gsapReady = false;

function revealHero() {
  const hero = document.querySelector(".hero");
  if (!hero) {
    return;
  }

  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  const copyTargets = hero.querySelectorAll(".section-eyebrow, h1, .lead, .cluster, .badge-row");
  const media = hero.querySelector(".hero-media");

  if (media) {
    timeline.fromTo(
      media,
      { scale: 1.08, opacity: 0.2 },
      { scale: 1, opacity: 1, duration: 1.4 },
      0
    );
  }

  if (copyTargets.length) {
    timeline.fromTo(
      copyTargets,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 },
      0.18
    );
  }
}

function revealSections() {
  gsap.utils.toArray(".section-header, .intro-panel, .comparison-grid .card, .stats-grid .card, .logo-band .card, .timeline-step, .testimonial-card, .grid .card, .cta-block").forEach((element) => {
    gsap.fromTo(
      element,
      { y: 48, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 84%",
          once: true
        }
      }
    );
  });
}

function addCardHoverMotion() {
  const cards = document.querySelectorAll(".service-card, .extension-card, .product-card, .blog-card, .testimonial-card, .logo-pill, .stat-card");
  cards.forEach((card) => {
    const media = card.querySelector(".card-image img");

    card.addEventListener("mouseenter", () => {
      gsap.to(card, { y: -8, duration: 0.28, ease: "power2.out" });
      if (media) {
        gsap.to(media, { scale: 1.05, duration: 0.45, ease: "power2.out" });
      }
    });

    card.addEventListener("mouseleave", () => {
      gsap.to(card, { y: 0, duration: 0.28, ease: "power2.out" });
      if (media) {
        gsap.to(media, { scale: 1, duration: 0.45, ease: "power2.out" });
      }
    });
  });
}

export async function initGsapStyling() {
  if (gsapReady || typeof window === "undefined") {
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsapReady = true;

  revealHero();
  revealSections();
  addCardHoverMotion();
}
