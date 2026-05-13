export function initTestimonialSlider() {
  const slider = document.querySelector("[data-testimonial-slider]");
  if (!slider) {
    return;
  }

  const slides = Array.from(slider.querySelectorAll(".testimonial-card"));
  if (!slides.length) {
    return;
  }

  const prevButton = document.querySelector("[data-slide-prev]");
  const nextButton = document.querySelector("[data-slide-next]");
  let activeIndex = 0;

  const setActive = (index) => {
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
  };

  prevButton?.addEventListener("click", () => {
    activeIndex = (activeIndex - 1 + slides.length) % slides.length;
    setActive(activeIndex);
  });

  nextButton?.addEventListener("click", () => {
    activeIndex = (activeIndex + 1) % slides.length;
    setActive(activeIndex);
  });
}
