const WHATSAPP_PHONE = "918757346644";

/**
 * Update the displayed placeholder price and the selected pack's WhatsApp link.
 */
function updateRowPrice(selectElement, priceCellId, buttonId, productName) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const packName = selectedOption?.dataset.pack || "पैकेट";
  const priceAmount = selectedOption?.dataset.price || selectedOption?.value;
  const priceCell = document.getElementById(priceCellId);
  const button = document.getElementById(buttonId);

  if (priceCell && priceAmount) {
    priceCell.textContent = `₹${priceAmount}`;
  }

  if (button) {
    const message = `नमस्ते प्रभास, मुझे ${productName} (${packName}) ऑर्डर करना है। कृपया आगे की प्रक्रिया बताएं।`;
    button.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  }
}

document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => {
  const whatsappUrl = new URL(link.href);
  whatsappUrl.pathname = `/${WHATSAPP_PHONE}`;
  link.href = whatsappUrl.toString();
});

document.querySelectorAll('[data-purpose="pricing-row"]').forEach((row) => {
  const select = row.querySelector('[data-purpose="variant-select"]');
  const price = row.querySelector('[id^="price-"]');

  if (select && price) {
    Array.from(select.options).forEach((option) => {
      option.textContent = option.dataset.pack;
    });
    updateRowPrice(select, price.id, "", "");
  }
});

// Homepage pricing rows filter
const pricingRows = Array.from(document.querySelectorAll('[data-purpose="pricing-row"]'));
if (pricingRows.length && homepageCategoryFilter) {
  function applyHomepageCategoryFilter() {
    const selected = Array.from(
      homepageCategoryFilter.querySelectorAll('input[type="checkbox"]:checked')
    ).map((input) => input.value);
    pricingRows.forEach((row) => {
      const category = row.dataset.category || "";
      const visible =
        selected.length === 0 || selected.includes("all") || selected.includes(category);
      row.hidden = !visible;
    });
  }
  homepageCategoryFilter.addEventListener("change", applyHomepageCategoryFilter);
}

const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const mobileNavPanel = document.querySelector("#mobile-nav-panel");
const mobileMenuBackdrop = document.querySelector(".mobile-menu-backdrop");

if (mobileMenuToggle && mobileNavPanel && mobileMenuBackdrop) {
  const siteHeader = mobileMenuToggle.closest("header");
  const brandLink = siteHeader?.querySelector(":scope > div > a");
  const inertPageElements = Array.from(document.body.children).filter(
    (element) => element !== siteHeader && element !== mobileMenuBackdrop,
  );
  const originalInertState = new Map(
    inertPageElements.map((element) => [element, element.inert]),
  );

  const setMobileMenuOpen = (isOpen) => {
    mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
    mobileMenuToggle.setAttribute(
      "aria-label",
      isOpen ? "मेनू बंद करें" : "मेनू खोलें",
    );
    mobileNavPanel.setAttribute("aria-hidden", String(!isOpen));
    mobileNavPanel.toggleAttribute("inert", !isOpen);
    mobileNavPanel.classList.toggle("is-open", isOpen);
    mobileMenuBackdrop.setAttribute("aria-hidden", String(!isOpen));
    mobileMenuBackdrop.inert = !isOpen;
    mobileMenuBackdrop.classList.toggle("is-open", isOpen);
    document.documentElement.classList.toggle("mobile-menu-open", isOpen);
    document.body.classList.toggle("mobile-menu-open", isOpen);

    inertPageElements.forEach((element) => {
      element.inert = isOpen || originalInertState.get(element);
    });

    if (brandLink) brandLink.inert = isOpen;
  };

  mobileMenuToggle.addEventListener("click", () => {
    const isOpen = mobileMenuToggle.getAttribute("aria-expanded") === "true";
    setMobileMenuOpen(!isOpen);
  });

  mobileNavPanel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMobileMenuOpen(false));
  });

  mobileMenuBackdrop.addEventListener("click", () => setMobileMenuOpen(false));

  document.addEventListener("click", (event) => {
    if (
      mobileMenuToggle.getAttribute("aria-expanded") === "true" &&
      !mobileNavPanel.contains(event.target) &&
      !mobileMenuToggle.contains(event.target)
    ) {
      setMobileMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      mobileMenuToggle.getAttribute("aria-expanded") === "true"
    ) {
      setMobileMenuOpen(false);
      mobileMenuToggle.focus();
    }
  });

  window.matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
    if (event.matches) setMobileMenuOpen(false);
  });
}

const mobileHeroMedia = window.matchMedia("(max-width: 767px)");
const heroCards = Array.from(
  document.querySelectorAll(".hero-gallery .reel-card"),
).slice(0, 4);
const heroStage = document.querySelector(".hero-gallery");
const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

if (heroStage && heroCards.length > 1) {
  let activeHeroCard = 0;
  let heroAutoplayTimer;
  let pointerStartX = null;
  let pointerCurrentX = null;
  let lastHeroSwipeAt = 0;

  const stopHeroAutoplay = () => {
    window.clearInterval(heroAutoplayTimer);
    heroAutoplayTimer = undefined;
  };

  const updateHeroCards = (instant = reducedMotionMedia.matches) => {
    const count = heroCards.length;

    heroCards.forEach((card, index) => {
      let distance = (index - activeHeroCard + count) % count;
      if (distance > count / 2) distance -= count;

      card.style.transition = instant
        ? "none"
        : "transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 650ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 650ms cubic-bezier(0.22, 1, 0.36, 1)";

      if (distance === 0) {
        card.style.transform = "translate(-50%, -50%) translateX(0) scale(1)";
        card.style.zIndex = "20";
        card.style.opacity = "1";
        card.style.boxShadow = "0 25px 60px rgba(0, 0, 0, 0.18)";
        card.style.pointerEvents = "auto";
      } else if (distance === 1 || distance === -1) {
        const side = distance > 0 ? 1 : -1;
        card.style.transform = `translate(-50%, -50%) translateX(${side * 15}%) scale(0.8)`;
        card.style.zIndex = "10";
        card.style.opacity = "0.5";
        card.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.04)";
        card.style.pointerEvents = "auto";
      } else {
        card.style.transform = "translate(-50%, -50%) scale(0.65)";
        card.style.zIndex = "5";
        card.style.opacity = "0";
        card.style.boxShadow = "none";
        card.style.pointerEvents = "none";
      }
    });
  };

  const goToHeroCard = (index) => {
    activeHeroCard = (index + heroCards.length) % heroCards.length;
    updateHeroCards();
  };

  const startHeroAutoplay = () => {
    stopHeroAutoplay();
    if (mobileHeroMedia.matches && !reducedMotionMedia.matches) {
      heroAutoplayTimer = window.setInterval(
        () => goToHeroCard(activeHeroCard - 1),
        4000,
      );
    }
  };

  heroCards.forEach((card, index) => {
    card.addEventListener("click", () => {
      if (!mobileHeroMedia.matches) return;
      if (Date.now() - lastHeroSwipeAt < 500) return;
      const distance = (index - activeHeroCard + heroCards.length) % heroCards.length;
      if (distance === 1 || distance === heroCards.length - 1) {
        goToHeroCard(activeHeroCard + (distance === 1 ? 1 : -1));
      }
      startHeroAutoplay();
    });
  });

  heroStage.addEventListener("pointerdown", (event) => {
    if (!mobileHeroMedia.matches) return;
    pointerStartX = event.clientX;
    pointerCurrentX = event.clientX;
    heroStage.setPointerCapture(event.pointerId);
    stopHeroAutoplay();
  });

  heroStage.addEventListener("pointermove", (event) => {
    if (pointerStartX !== null) pointerCurrentX = event.clientX;
  });

  heroStage.addEventListener("pointerup", () => {
    if (pointerStartX === null) return;
    const swipeDistance = pointerCurrentX - pointerStartX;

    if (Math.abs(swipeDistance) > 45) {
      lastHeroSwipeAt = Date.now();
      goToHeroCard(activeHeroCard + (swipeDistance < 0 ? 1 : -1));
    }

    pointerStartX = null;
    pointerCurrentX = null;
    startHeroAutoplay();
  });

  heroStage.addEventListener("pointercancel", () => {
    pointerStartX = null;
    pointerCurrentX = null;
    startHeroAutoplay();
  });

  const syncHeroDeckToViewport = () => {
    stopHeroAutoplay();

    if (mobileHeroMedia.matches) {
      updateHeroCards(true);
      startHeroAutoplay();
      return;
    }

    heroCards.forEach((card) => {
      card.style.removeProperty("transition");
      card.style.removeProperty("transform");
      card.style.removeProperty("z-index");
      card.style.removeProperty("opacity");
      card.style.removeProperty("box-shadow");
      card.style.removeProperty("pointer-events");
    });
  };

  mobileHeroMedia.addEventListener("change", syncHeroDeckToViewport);
  reducedMotionMedia.addEventListener("change", () => {
    updateHeroCards(true);
    startHeroAutoplay();
  });
  syncHeroDeckToViewport();
}

const salesBanner = document.querySelector(".sales-banner-dialog");
const salesBannerClose = salesBanner?.querySelector(".sales-banner-close");
const storySection = document.querySelector("#our-story");
const salesBannerDismissedKey = "shahiMevaSalesBannerDismissed";

if (salesBanner instanceof HTMLDialogElement && salesBannerClose) {
  let bannerShown = sessionStorage.getItem(salesBannerDismissedKey) === "true";
  let bannerTimer;

  const showSalesBanner = () => {
    if (bannerShown || salesBanner.open) return;

    bannerShown = true;
    window.clearTimeout(bannerTimer);
    salesBanner.showModal();
  };

  salesBannerClose.addEventListener("click", () => salesBanner.close());
  salesBanner.addEventListener("close", () => {
    sessionStorage.setItem(salesBannerDismissedKey, "true");
  });

  if (!bannerShown) {
    bannerTimer = window.setTimeout(showSalesBanner, 10_000);

    if (storySection && "IntersectionObserver" in window) {
      const storyObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            showSalesBanner();
            storyObserver.disconnect();
          }
        },
        { threshold: 0.15 },
      );

      storyObserver.observe(storySection);
    }
  }
}

// Homepage multi-select category filter
const homepageCategoryFilter = document.getElementById("homepage-category-filter-menu");
const homepageCategoryTrigger = document.getElementById("homepage-category-filter-trigger");
const homepageCategoryValue = document.getElementById("homepage-category-filter-value");

if (homepageCategoryFilter && homepageCategoryTrigger && homepageCategoryValue) {
  function toggleHomepageCategoryMenu() {
    const isOpen = homepageCategoryFilter.hidden === false;
    homepageCategoryFilter.hidden = !isOpen;
    homepageCategoryTrigger.setAttribute("aria-expanded", String(!isOpen));
  }

  function closeHomepageCategoryMenu(event) {
    if (
      event.target.closest(".inventory-multiselect__menu") ||
      event.target.closest(".inventory-multiselect__trigger")
    )
      return;
    homepageCategoryFilter.hidden = true;
    homepageCategoryTrigger.setAttribute("aria-expanded", "false");
  }

  homepageCategoryTrigger.addEventListener("click", toggleHomepageCategoryMenu);
  document.addEventListener("click", closeHomepageCategoryMenu);

  homepageCategoryFilter.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.allOption === "true") {
      const allChecked = target.checked;
      homepageCategoryFilter.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = allChecked;
      });
    } else {
      const allCheckbox = homepageCategoryFilter.querySelector('input[data-all-option="true"]');
      const individualCheckboxes = homepageCategoryFilter.querySelectorAll(
        'input[type="checkbox"]:not([data-all-option="true"])'
      );
      if (!target.checked) {
        allCheckbox.checked = false;
      } else if (Array.from(individualCheckboxes).every((cb) => cb.checked)) {
        allCheckbox.checked = true;
      }
    }
    const selected = Array.from(
      homepageCategoryFilter.querySelectorAll('input[type="checkbox"]:checked')
    ).map((input) => input.value);
    if (selected.length === 0 || selected.includes("all")) {
      homepageCategoryValue.textContent = "सभी उत्पाद";
    } else if (selected.length === 1) {
      homepageCategoryValue.textContent = selected[0];
    } else {
      homepageCategoryValue.textContent = `${selected.length} चुने हुए`;
    }
  });
}
