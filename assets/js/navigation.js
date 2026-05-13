export function initNavigation() {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navMenu = document.querySelector("[data-nav-menu]");
  const navBackdrop = document.querySelector("[data-nav-backdrop]");
  const navClose = document.querySelector("[data-nav-close]");
  const dropdowns = Array.from(document.querySelectorAll(".dropdown"));
  const heroWithVideo = document.querySelector(".hero-has-video");
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const mobileBreakpoint = window.matchMedia("(max-width: 1120px)");

  const syncActiveLinks = () => {
    document.querySelectorAll(".nav-link, .dropdown-panel a").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) {
        return;
      }

      const normalizedHref = href.replace(/^\//, "");
      if (normalizedHref === currentPath || (normalizedHref === "index.html" && currentPath === "index.html")) {
        link.classList.add("is-active");
        const parentDropdown = link.closest(".dropdown");
        if (parentDropdown) {
          const trigger = parentDropdown.querySelector(".dropdown-toggle");
          trigger?.classList.add("is-active");
        }
      }
    });
  };

  const syncHeader = () => {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 12);
    header.classList.toggle("is-overlay", Boolean(heroWithVideo) && window.scrollY <= 12);
  };

  const setDropdownState = (dropdown, isOpen) => {
    const trigger = dropdown.querySelector(".dropdown-toggle");
    dropdown.classList.toggle("is-open", isOpen);
    if (trigger) {
      trigger.setAttribute("aria-expanded", String(isOpen));
    }
  };

  const closeAllDropdowns = (exception) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown !== exception) {
        setDropdownState(dropdown, false);
      }
    });
  };

  const setNavState = (isOpen) => {
    if (!navMenu || !navToggle) {
      return;
    }

    navMenu.classList.toggle("is-open", isOpen);
    navToggle.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen && mobileBreakpoint.matches);

    if (navBackdrop) {
      navBackdrop.classList.toggle("is-open", isOpen && mobileBreakpoint.matches);
    }

    if (!isOpen || !mobileBreakpoint.matches) {
      closeAllDropdowns();
    }
  };

  const bindDropdown = (dropdown) => {
    const trigger = dropdown.querySelector(".dropdown-toggle");
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      if (!mobileBreakpoint.matches && dropdown.classList.contains("dropdown-mega")) {
        event.preventDefault();
      }

      const nextState = !dropdown.classList.contains("is-open");
      closeAllDropdowns(dropdown);
      setDropdownState(dropdown, nextState);
    });

    dropdown.addEventListener("mouseenter", () => {
      if (!mobileBreakpoint.matches) {
        closeAllDropdowns(dropdown);
        setDropdownState(dropdown, true);
      }
    });

    dropdown.addEventListener("mouseleave", () => {
      if (!mobileBreakpoint.matches) {
        setDropdownState(dropdown, false);
      }
    });

    trigger.addEventListener("focus", () => {
      if (!mobileBreakpoint.matches) {
        closeAllDropdowns(dropdown);
        setDropdownState(dropdown, true);
      }
    });
  };

  syncActiveLinks();
  syncHeader();
  window.addEventListener("scroll", syncHeader);

  dropdowns.forEach(bindDropdown);

  navToggle?.addEventListener("click", () => {
    const isOpen = !navMenu?.classList.contains("is-open");
    setNavState(Boolean(isOpen));
  });

  navClose?.addEventListener("click", () => setNavState(false));
  navBackdrop?.addEventListener("click", () => setNavState(false));

  const handleBreakpointChange = () => {
    setNavState(false);
    syncHeader();
  };

  if (typeof mobileBreakpoint.addEventListener === "function") {
    mobileBreakpoint.addEventListener("change", handleBreakpointChange);
  } else if (typeof mobileBreakpoint.addListener === "function") {
    mobileBreakpoint.addListener(handleBreakpointChange);
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!target.closest(".dropdown")) {
      closeAllDropdowns();
    }

    if (mobileBreakpoint.matches && navMenu?.classList.contains("is-open")) {
      const isInsideMenu = target.closest("[data-nav-menu]") || target.closest("[data-nav-toggle]");
      if (!isInsideMenu) {
        setNavState(false);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
      setNavState(false);
    }
  });
}
