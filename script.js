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

const homepageVariantSelects = document.querySelectorAll(
  '#price-list #pricing-table select[data-purpose="variant-select"]',
);
let openHomepageVariantDropdown = null;

const closeHomepageVariantDropdown = (restoreFocus = false) => {
  if (!openHomepageVariantDropdown) return;

  const { menu, trigger } = openHomepageVariantDropdown;
  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  trigger.removeAttribute("aria-activedescendant");
  openHomepageVariantDropdown = null;

  if (restoreFocus) trigger.focus();
};

const positionHomepageVariantMenu = ({ menu, trigger }) => {
  const triggerRect = trigger.getBoundingClientRect();
  menu.style.width = `${triggerRect.width}px`;

  const menuHeight = menu.getBoundingClientRect().height;
  const top = triggerRect.bottom + menuHeight <= window.innerHeight - 8
    ? triggerRect.bottom + 4
    : Math.max(8, triggerRect.top - menuHeight - 4);
  const left = Math.max(
    8,
    Math.min(triggerRect.left, window.innerWidth - triggerRect.width - 8),
  );

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
};

homepageVariantSelects.forEach((select, selectIndex) => {
  const row = select.closest("tr");
  const productName = row?.cells[1]?.textContent.trim() || "उत्पाद";
  const wrapper = document.createElement("div");
  wrapper.className = "homepage-variant-dropdown";
  select.before(wrapper);
  wrapper.append(select);
  select.classList.add("homepage-variant-native-select");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "homepage-variant-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", `${productName}, पैक साइज़`);
  trigger.id = `homepage-variant-trigger-${selectIndex}`;
  wrapper.append(trigger);

  const menu = document.createElement("div");
  menu.className = "homepage-variant-menu";
  menu.id = `homepage-variant-menu-${selectIndex}`;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", `${productName} पैक साइज़`);
  menu.hidden = true;
  menu.dataset.homepageVariantMenu = "";
  document.body.append(menu);
  trigger.setAttribute("aria-controls", menu.id);

  let activeIndex = select.selectedIndex;
  const options = Array.from(select.options).map((nativeOption, optionIndex) => {
    const option = document.createElement("div");
    option.className = "homepage-variant-option";
    option.id = `${menu.id}-option-${optionIndex}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(optionIndex === select.selectedIndex));
    option.textContent = nativeOption.textContent;
    option.addEventListener("mouseenter", () => {
      activeIndex = optionIndex;
      updateActiveOption();
    });
    option.addEventListener("click", () => {
      select.selectedIndex = optionIndex;
      options.forEach((entry, entryIndex) => {
        entry.setAttribute("aria-selected", String(entryIndex === optionIndex));
      });
      trigger.textContent = nativeOption.textContent;
      trigger.setAttribute("aria-label", `${productName}, पैक साइज़: ${nativeOption.textContent}`);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeHomepageVariantDropdown();
      trigger.focus();
    });
    menu.append(option);
    return option;
  });

  const updateActiveOption = () => {
    options.forEach((option, optionIndex) => {
      option.dataset.active = String(optionIndex === activeIndex);
    });
    trigger.setAttribute("aria-activedescendant", options[activeIndex].id);
  };

  const openMenu = () => {
    if (openHomepageVariantDropdown) closeHomepageVariantDropdown();
    activeIndex = select.selectedIndex;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    openHomepageVariantDropdown = { menu, trigger };
    updateActiveOption();
    positionHomepageVariantMenu({ menu, trigger });
  };

  trigger.textContent = select.options[select.selectedIndex]?.textContent || "";
  trigger.addEventListener("click", () => {
    if (openHomepageVariantDropdown?.trigger === trigger) {
      closeHomepageVariantDropdown();
    } else {
      openMenu();
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openHomepageVariantDropdown?.trigger === trigger) {
      event.preventDefault();
      closeHomepageVariantDropdown(true);
      return;
    }

    if (event.key === "Tab") {
      if (openHomepageVariantDropdown?.trigger === trigger) closeHomepageVariantDropdown();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (openHomepageVariantDropdown?.trigger !== trigger) openMenu();
      else {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + direction + options.length) % options.length;
        updateActiveOption();
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (openHomepageVariantDropdown?.trigger !== trigger) openMenu();
      activeIndex = event.key === "Home" ? 0 : options.length - 1;
      updateActiveOption();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (openHomepageVariantDropdown?.trigger !== trigger) {
        openMenu();
        return;
      }
      options[activeIndex].click();
    }
  });
});

document.addEventListener("click", (event) => {
  if (
    openHomepageVariantDropdown &&
    !openHomepageVariantDropdown.trigger.contains(event.target) &&
    !openHomepageVariantDropdown.menu.contains(event.target)
  ) {
    closeHomepageVariantDropdown();
  }
});

window.addEventListener("resize", () => closeHomepageVariantDropdown());
window.addEventListener("scroll", () => closeHomepageVariantDropdown(), true);

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

document.querySelectorAll("[data-multiselect]").forEach((multiselect) => {
  const trigger = multiselect.querySelector(".inventory-multiselect__trigger");
  const menu = multiselect.querySelector(".inventory-multiselect__menu");
  const summary = multiselect.querySelector(".inventory-multiselect__value");
  const allOption = multiselect.querySelector("[data-all-option]");
  const options = Array.from(
    multiselect.querySelectorAll('input[type="checkbox"]:not([data-all-option="true"])'),
  );
  if (!trigger || !menu || !summary || !allOption) return;

  const closeMenu = (restoreFocus = false) => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  const updateSummary = () => {
    const selected = options.filter((option) => option.checked);
    if (selected.length === options.length) {
      summary.textContent = allOption.dataset.filterLabel || allOption.value;
    } else if (selected.length === 0) {
      summary.textContent = "कोई चयन नहीं";
    } else if (selected.length === 1) {
      summary.textContent = selected[0].dataset.filterLabel || selected[0].value;
    } else {
      summary.textContent = `${selected.length} चुने हुए`;
    }

    multiselect.dispatchEvent(
      new CustomEvent("multiselectchange", {
        detail: { selected: selected.map((option) => option.value) },
      }),
    );
  };

  trigger.addEventListener("click", () => {
    const opening = menu.hidden;
    document.querySelectorAll(".inventory-multiselect__menu:not([hidden])").forEach((openMenu) => {
      openMenu.hidden = true;
      openMenu
        .closest(".inventory-multiselect")
        ?.querySelector(".inventory-multiselect__trigger")
        ?.setAttribute("aria-expanded", "false");
    });
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
  });

  multiselect.addEventListener("change", (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    if (event.target === allOption) {
      options.forEach((option) => {
        option.checked = allOption.checked;
      });
    } else {
      allOption.checked = options.every((option) => option.checked);
    }
    updateSummary();
  });

  document.addEventListener("click", (event) => {
    if (!multiselect.contains(event.target) && !menu.hidden) closeMenu();
  });

  multiselect.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      closeMenu(true);
    }
  });

  updateSummary();
});

const homepageCategoryFilter = document.querySelector("#homepage-category-filter");
if (homepageCategoryFilter) {
  const homepagePriceRows = Array.from(
    document.querySelectorAll('#pricing-table [data-purpose="pricing-row"]'),
  );
  const categoryMatchers = [
    ["makhana", /मखाना|fox nuts/i],
    ["cashew", /काजू|cashew/i],
    ["almond", /बादाम|almond/i],
    ["raisin", /किशमिश|raisin/i],
    ["walnut", /अखरोट|walnut/i],
  ];

  homepagePriceRows.forEach((row) => {
    const text = row.querySelector("td:nth-child(2)")?.textContent || "";
    row.dataset.category =
      categoryMatchers.find(([, matcher]) => matcher.test(text))?.[0] || "";
  });

  homepageCategoryFilter.addEventListener("multiselectchange", (event) => {
    homepagePriceRows.forEach((row) => {
      row.hidden = !event.detail.selected.includes(row.dataset.category);
    });
  });
}

const mainNavigation = document.querySelector(
  'header[data-purpose="site-navigation"] nav[data-purpose="main-nav-links"]',
);
const mainNavigationLinks = Array.from(mainNavigation?.querySelectorAll('a[href*="#"]') || []);
const isInventoryPage = /(?:^|\/)inventory\.html$/i.test(window.location.pathname);

if (isInventoryPage) {
  mainNavigationLinks.forEach((link) => {
    link.classList.remove("is-active");
    link.removeAttribute("aria-current");
  });
} else if (mainNavigationLinks.length) {
  const sectionLinks = mainNavigationLinks
    .map((link) => ({ link, section: document.getElementById(new URL(link.href).hash.slice(1)) }))
    .filter((entry) => entry.section);

  const markActiveSection = (sectionId) => {
    sectionLinks.forEach(({ link, section }) => {
      const active = section.id === sectionId;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const updateActiveSection = () => {
    const header = document.querySelector('header[data-purpose="site-navigation"]');
    const activationLine = (header?.getBoundingClientRect().bottom || 0) + 24;
    const activeEntries = sectionLinks.filter(
      ({ section }) => section.getBoundingClientRect().top <= activationLine,
    );
    const activeEntry = activeEntries[activeEntries.length - 1];

    markActiveSection(activeEntry?.section.id || "");
  };

  let activeSectionFrame = 0;
  const scheduleActiveSectionUpdate = () => {
    if (activeSectionFrame) return;
    activeSectionFrame = window.requestAnimationFrame(() => {
      activeSectionFrame = 0;
      updateActiveSection();
    });
  };

  updateActiveSection();
  window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
  window.addEventListener("resize", scheduleActiveSectionUpdate);
  window.addEventListener("hashchange", scheduleActiveSectionUpdate);
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
  salesBanner.addEventListener("click", (event) => {
    if (event.target === salesBanner) salesBanner.close();
  });
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
