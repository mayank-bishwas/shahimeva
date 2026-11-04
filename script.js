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
