import { initNavigation } from "./navigation.js";
import { initDynamicSections } from "./render.js";
import { initTestimonialSlider } from "./slider.js";
import { initGsapStyling } from "./animations.js";

async function loadComponents() {
  const componentNodes = document.querySelectorAll("[data-component]");
  const basePath = "./components";

  await Promise.all(
    Array.from(componentNodes).map(async (node) => {
      const name = node.dataset.component;
      try {
        const response = await fetch(`${basePath}/${name}.html`);
        if (response.ok) {
          node.innerHTML = await response.text();
        }
      } catch (error) {
        console.error(`Unable to load component: ${name}`, error);
      }
    })
  );
}

function initFaq() {
  document.addEventListener("click", (event) => {
    const question = event.target.closest(".faq-question");
    if (!question) {
      return;
    }
    const item = question.closest(".faq-item");
    const isOpen = item.classList.toggle("is-open");
    question.setAttribute("aria-expanded", String(isOpen));
  });
}

function updateYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
}

function initHeroVideoFallback() {
  const video = document.querySelector(".hero-video");
  if (!video) {
    return;
  }

  const handleFailure = () => {
    video.style.display = "none";
  };

  video.addEventListener("error", handleFailure);

  const playPromise = video.play?.();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(handleFailure);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponents();
  initDynamicSections();
  initNavigation();
  initTestimonialSlider();
  initFaq();
  updateYear();
  initHeroVideoFallback();
  try {
    await initGsapStyling();
  } catch (error) {
    console.warn("GSAP animations could not be initialized.", error);
  }
});
