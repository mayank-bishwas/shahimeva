document.addEventListener("DOMContentLoaded", () => {
  const products = window.shahiMevaInventoryData;
  const tableBody = document.querySelector("#table-rows-container");
  const searchInput = document.querySelector("#product-search");
  const categoryFilter = document.querySelector("#category-filter");
  const availabilityFilter = document.querySelector("#availability-filter");
  const quoteTab = document.querySelector("#whatsapp-cta-btn");
  const inventoryWhatsApp = document.querySelector("#inventory-whatsapp");
  const resetButton = document.querySelector("#btn-recalculate");
  const noResults = document.querySelector("#no-results");
  const printSummary = document.querySelector("#print-quotation-summary");
  const lightbox = document.querySelector("#inventory-lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const lightboxCaption = document.querySelector("#lightbox-caption");
  const previousImageButton = document.querySelector(".lightbox-previous");
  const nextImageButton = document.querySelector(".lightbox-next");
  const rowStates = new Map();
  const rows = [];
  const screenshotToast = document.querySelector("#screenshot-toast");
  let activeGallery = [];
  let activeGalleryIndex = 0;
  let activeGalleryProductName = "";
  let pointerStartX = null;
  let screenshotInProgress = false;
  let screenshotToastTimer;

  if (!Array.isArray(products) || !tableBody || !searchInput || !categoryFilter ||
      !availabilityFilter || !quoteTab || !inventoryWhatsApp || !resetButton || !noResults ||
      !printSummary || !screenshotToast || !(lightbox instanceof HTMLDialogElement) || !lightboxImage ||
      !lightboxCaption || !previousImageButton || !nextImageButton) {
    throw new Error("Inventory page is missing required data or controls.");
  }

  const formatMoney = (amount) => `₹${amount.toLocaleString("en-IN")}`;
  const formatWeight = (weight) => `${Number.isInteger(weight) ? weight : weight.toFixed(1)} kg`;
  const whatsappUrl = (message) =>
    `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  const generalEnquiryUrl = whatsappUrl(
    "नमस्ते शाही मेवा,\n\nमुझे आपके उत्पादों के बारे में जानकारी चाहिए।\n\nधन्यवाद।",
  );

  function makeCell(className, text) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    if (text !== undefined) cell.textContent = text;
    return cell;
  }

  function makeBulkMessage(product, cell) {
    const bulkMessage = document.createElement("span");
    bulkMessage.className = "bulk-enquiry";
    bulkMessage.hidden = true;
    bulkMessage.append(document.createTextNode("🤯 "));

    const enquiry = document.createElement("a");
    enquiry.textContent = "सच्ची?! मुझे अभी मेसेज करें >";
    enquiry.href = whatsappUrl([
      "नमस्ते शाही मेवा,",
      "",
      `मुझे ${product.name} (${product.pack}) की 99 से अधिक मात्रा चाहिए।`,
      "",
      "कृपया जल्द-से-जल्द मुझे संपर्क करें।",
      "",
      "धन्यवाद!",
    ].join("\n"));
    enquiry.target = "_blank";
    enquiry.rel = "noopener noreferrer";
    bulkMessage.append(enquiry);
    cell.append(bulkMessage);
    return bulkMessage;
  }

  function renderProduct(product) {
    const row = document.createElement("tr");
    row.className = product.inStock ? "product-row" : "product-row is-out-of-stock";
    row.dataset.sku = product.sku;
    row.dataset.category = product.category;
    row.dataset.inStock = String(product.inStock);
    row.dataset.search = [
      product.sku,
      product.categoryName,
      product.categoryEnglish,
      product.name,
      product.description,
      product.pack,
    ].join(" ").toLocaleLowerCase("hi-IN");

    rowStates.set(product.sku, { quantity: product.inStock ? 1 : 0, selected: false });
    row.append(makeCell("inventory-sku", product.sku));

    const imageCell = makeCell("inventory-image-cell");
    const thumbnail = document.createElement("button");
    thumbnail.type = "button";
    thumbnail.className = "inventory-image-button";
    thumbnail.setAttribute("aria-label", `${product.name} की तस्वीर बड़ी करके देखें`);
    const image = document.createElement("img");
    image.className = "inventory-product-image";
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";
    thumbnail.append(image);
    imageCell.append(thumbnail);
    row.append(imageCell);

    const productCell = makeCell("inventory-product-cell");
    const name = document.createElement("span");
    name.className = "inventory-product-name";
    name.textContent = product.name;
    productCell.append(name);

    const description = document.createElement("span");
    description.className = "inventory-product-description";
    description.textContent = product.description;
    productCell.append(description);
    row.append(productCell);

    const packCell = makeCell("inventory-pack");
    const packName = document.createElement("span");
    packName.className = "inventory-pack-name";
    packName.textContent = product.pack;
    packCell.append(packName);
    if (!product.inStock) {
      const stockStatus = document.createElement("span");
      stockStatus.className = "inventory-stock-status is-out";
      stockStatus.textContent = "स्टॉक में नहीं";
      packCell.append(stockStatus);
    }
    row.append(packCell);

    const quantityCell = makeCell("inventory-quantity");
    const quantityControl = document.createElement("div");
    quantityControl.className = "quantity-control";

    const decrement = document.createElement("button");
    decrement.type = "button";
    decrement.dataset.quantityAction = "decrement";
    decrement.setAttribute("aria-label", `${product.name}, ${product.pack} की मात्रा घटाएँ`);
    decrement.textContent = "−";
    decrement.disabled = !product.inStock;

    const input = document.createElement("input");
    input.className = "qty-input";
    input.type = "number";
    input.inputMode = "numeric";
    input.min = product.inStock ? "1" : "0";
    input.max = "99";
    input.step = "1";
    input.value = product.inStock ? "1" : "0";
    input.disabled = !product.inStock;
    input.setAttribute("aria-label", `${product.name}, ${product.pack} की मात्रा`);

    const printQuantity = document.createElement("span");
    printQuantity.className = "print-quantity";
    printQuantity.textContent = product.inStock ? "—" : "स्टॉक में नहीं";

    const increment = document.createElement("button");
    increment.type = "button";
    increment.dataset.quantityAction = "increment";
    increment.setAttribute("aria-label", `${product.name}, ${product.pack} की मात्रा बढ़ाएँ`);
    increment.textContent = "+";
    increment.disabled = !product.inStock;

    quantityControl.append(decrement, input, increment);
    quantityCell.append(quantityControl, printQuantity);
    const bulkMessage = makeBulkMessage(product, quantityCell);
    row.append(quantityCell);

    const priceCell = makeCell("inventory-price");
    const price = document.createElement("span");
    price.className = "unit-price";
    price.textContent = formatMoney(product.price);
    priceCell.append(price);
    const unitPrice = document.createElement("span");
    unitPrice.className = "inventory-unit-price";
    unitPrice.textContent = "प्रति पैक";
    priceCell.append(unitPrice);
    row.append(priceCell);

    const galleryImages = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];
    thumbnail.dataset.gallerySku = product.sku;

    tableBody.append(row);
    rows.push({ element: row, product, input, printQuantity, bulkMessage, galleryImages });
  }

  products.forEach(renderProduct);

  const dateFormatter = new Intl.DateTimeFormat("hi-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  document.querySelector("#stock-date").textContent =
    `${dateFormatter.format(new Date())} के अनुसार`;

  function filterProducts() {
    const query = searchInput.value.trim().toLocaleLowerCase("hi-IN");
    const categories = getSelectedValues(categoryFilter);
    const availability = getSelectedValues(availabilityFilter);
    let visibleCount = 0;

    rows.forEach(({ element, product }) => {
      const matchesQuery = !query || element.dataset.search.includes(query);
      const matchesCategory = categories.includes(product.category);
      const matchesAvailability =
        (availability.includes("in-stock") && product.inStock) ||
        (availability.includes("out-of-stock") && !product.inStock);
      const visible = matchesQuery && matchesCategory && matchesAvailability;

      element.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    noResults.hidden = visibleCount > 0;
  }

  function getSelectedValues(filter) {
    return Array.from(
      filter.querySelectorAll('input[type="checkbox"]:checked:not([data-all-option="true"])'),
    ).map((input) => input.value);
  }

  function renderPrintSummary(selectedProducts, amount, weight) {
    printSummary.replaceChildren();
    printSummary.hidden = selectedProducts.length === 0;
    if (selectedProducts.length === 0) return;

    const heading = document.createElement("h2");
    heading.textContent = "चयनित कोटेशन का सारांश";
    printSummary.append(heading);

    const list = document.createElement("ul");
    selectedProducts.forEach(({ product, quantity, lineTotal }) => {
      const item = document.createElement("li");
      item.textContent =
        `[${product.sku}] ${product.name} · ${product.pack} · ${quantity} × ${formatMoney(product.price)} = ${formatMoney(lineTotal)}`;
      list.append(item);
    });
    printSummary.append(list);

    const total = document.createElement("p");
    total.textContent = `कुल अनुमानित राशि: ${formatMoney(amount)} · कुल वजन: ${formatWeight(weight)}`;
    printSummary.append(total);
  }

  function updateSummary() {
    let weight = 0;
    let amount = 0;
    let selectedQuantity = 0;
    const selectedProducts = [];

    rows.forEach(({ element, product, input, printQuantity, bulkMessage }) => {
      const state = rowStates.get(product.sku);
      const quantity = state.selected ? state.quantity : 0;
      const lineTotal = quantity * product.price;

      element.classList.toggle("is-selected", state.selected);
      input.classList.toggle("is-selected", state.selected);
      printQuantity.textContent = state.selected ? String(quantity) : "—";
      element.querySelectorAll(".quantity-control button").forEach((button) => {
        button.disabled = !product.inStock || !state.selected && button.dataset.quantityAction === "decrement";
      });

      if (state.selected) {
        weight += quantity * product.weight;
        amount += lineTotal;
        selectedQuantity += quantity;
        selectedProducts.push({ product, quantity, lineTotal });
      }

      element.dataset.selected = String(state.selected);
      bulkMessage.hidden = !state.overLimit;
    });

    const hasSelection = selectedProducts.length > 0;
    const formattedWeight = formatWeight(weight);
    document.querySelector("#total-weight").textContent = formattedWeight;
    document.querySelector("#total-quantity").textContent = String(selectedQuantity);
    document.querySelector("#total-item-label").textContent = selectedQuantity === 1 ? "item" : "items";
    document.querySelector("#total-amount").textContent = formatMoney(amount);

    const quotationMessage = [
      "नमस्ते शाही मेवा,",
      "",
      "मुझे आपसे निम्नलिखित सामान के लिए कीमत और उपलब्धता की पुष्टि करनी है:",
      "",
      ...selectedProducts.map(({ product, quantity, lineTotal }) =>
        `• [${product.sku}] ${product.name}: ${product.pack} · मात्रा ${quantity} · इकाई दर ${formatMoney(product.price)} = ${formatMoney(lineTotal)}`,
      ),
      "",
      `*कुल अनुमानित राशि: ${formatMoney(amount)}*`,
      `_कुल वजन: ${formattedWeight}_`,
      "",
      "धन्यवाद।",
    ].join("\n");
    const enquiryUrl = hasSelection ? whatsappUrl(quotationMessage) : generalEnquiryUrl;
    quoteTab.href = enquiryUrl;
    inventoryWhatsApp.href = enquiryUrl;
    quoteTab.classList.toggle("is-visible", hasSelection);
    quoteTab.setAttribute("aria-hidden", String(!hasSelection));
    quoteTab.tabIndex = hasSelection ? 0 : -1;
    document.body.classList.toggle("inventory-has-selection", hasSelection);
    renderPrintSummary(selectedProducts, amount, weight);
  }

  function setProductState(product, quantity, selected, overLimit = false) {
    const state = rowStates.get(product.sku);
    state.selected = product.inStock && selected;
    state.quantity = state.selected
      ? Math.min(99, Math.max(1, Math.floor(quantity)))
      : product.inStock ? 1 : 0;
    state.overLimit = overLimit;
    const input = rows.find((row) => row.product.sku === product.sku)?.input;
    if (input) input.value = String(state.quantity);
    updateSummary();
  }

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-quantity-action]");
    if (button) {
      const row = button.closest(".product-row");
      const rowEntry = rows.find((entry) => entry.element === row);
      if (!rowEntry || !rowEntry.product.inStock) return;
      const state = rowStates.get(rowEntry.product.sku);
      const action = button.dataset.quantityAction;

      if (action === "increment") {
        if (state.quantity >= 99 && state.selected) {
          setProductState(rowEntry.product, 99, true, true);
        } else {
          setProductState(
            rowEntry.product,
            state.selected ? state.quantity + 1 : 1,
            true,
          );
        }
      } else if (state.selected && state.quantity === 1) {
        setProductState(rowEntry.product, 1, false);
      } else if (state.selected) {
        setProductState(rowEntry.product, state.quantity - 1, true);
      }
      return;
    }

    const imageButton = event.target.closest("[data-gallery-sku]");
    if (imageButton) {
      const rowEntry = rows.find((entry) => entry.product.sku === imageButton.dataset.gallerySku);
      if (rowEntry) openGallery(rowEntry);
    }
  });

  tableBody.addEventListener("input", (event) => {
    if (!event.target.matches(".qty-input")) return;
    const row = event.target.closest(".product-row");
    const rowEntry = rows.find((entry) => entry.element === row);
    if (!rowEntry || !rowEntry.product.inStock) return;

    const typed = event.target.value.trim();
    const quantity = Number(typed);
    if (!typed || quantity < 1) {
      setProductState(rowEntry.product, 1, false);
    } else if (quantity > 99) {
      setProductState(rowEntry.product, 99, true, true);
    } else {
      setProductState(rowEntry.product, quantity, true);
    }
  });

  tableBody.addEventListener("change", (event) => {
    if (!event.target.matches(".qty-input")) return;
    const rowEntry = rows.find((entry) => entry.element === event.target.closest(".product-row"));
    if (!rowEntry) return;
    const state = rowStates.get(rowEntry.product.sku);
    event.target.value = String(state.quantity);
  });

  searchInput.addEventListener("input", filterProducts);
  categoryFilter.addEventListener("multiselectchange", filterProducts);
  availabilityFilter.addEventListener("multiselectchange", filterProducts);

  resetButton.addEventListener("click", () => {
    rows.forEach(({ product, input }) => {
      rowStates.set(product.sku, {
        quantity: product.inStock ? 1 : 0,
        selected: false,
        overLimit: false,
      });
      input.value = product.inStock ? "1" : "0";
    });
    searchInput.value = "";
    [categoryFilter, availabilityFilter].forEach((filter) => {
      filter.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = true;
      });
      filter.querySelector('input[data-all-option="true"]')
        .dispatchEvent(new Event("change", { bubbles: true }));
    });
    filterProducts();
    updateSummary();
  });

  function updateGalleryImage() {
    const src = activeGallery[activeGalleryIndex];
    lightboxImage.src = src;
    lightboxImage.alt = activeGalleryProductName;
    lightboxCaption.textContent =
      `${activeGalleryProductName} · ${activeGalleryIndex + 1}/${activeGallery.length}`;
    previousImageButton.hidden = activeGallery.length < 2;
    nextImageButton.hidden = activeGallery.length < 2;
  }

  function openGallery(rowEntry) {
    activeGallery = rowEntry.galleryImages;
    activeGalleryIndex = 0;
    activeGalleryProductName = rowEntry.product.name;
    updateGalleryImage();
    lightbox.showModal();
    document.body.classList.add("inventory-lightbox-open");
  }

  function closeGallery() {
    document.body.classList.remove("inventory-lightbox-open");
    activeGallery = [];
    activeGalleryProductName = "";
    pointerStartX = null;
  }

  function stepGallery(direction) {
    if (activeGallery.length < 2) return;
    activeGalleryIndex =
      (activeGalleryIndex + direction + activeGallery.length) % activeGallery.length;
    updateGalleryImage();
  }

  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("close", closeGallery);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") stepGallery(-1);
    if (event.key === "ArrowRight") stepGallery(1);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.open) {
      lightbox.close();
      closeGallery();
    }
  });
  previousImageButton.addEventListener("click", () => stepGallery(-1));
  nextImageButton.addEventListener("click", () => stepGallery(1));
  lightboxImage.addEventListener("pointerdown", (event) => {
    pointerStartX = event.clientX;
  });
  lightboxImage.addEventListener("pointerup", (event) => {
    if (pointerStartX === null || activeGallery.length < 2) return;
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) > 40) stepGallery(distance < 0 ? 1 : -1);
    pointerStartX = null;
  });
  lightbox.addEventListener("cancel", (event) => {
    event.preventDefault();
    lightbox.close();
    closeGallery();
  });

  function showScreenshotToast(message, isError = false) {
    window.clearTimeout(screenshotToastTimer);
    screenshotToast.replaceChildren();
    screenshotToast.classList.toggle("is-error", isError);
    screenshotToast.setAttribute("role", isError ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "screenshot-toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = isError ? "!" : "✓";

    const text = document.createElement("span");
    text.textContent = message;
    screenshotToast.append(icon, text);
    screenshotToast.hidden = false;
    screenshotToastTimer = window.setTimeout(() => {
      screenshotToast.hidden = true;
    }, isError ? 5000 : 3500);
  }

  async function waitForScreenshotAssets() {
    if (document.fonts?.ready) await document.fonts.ready;

    const imageSources = Array.from(
      new Set(Array.from(document.images, (image) => image.currentSrc || image.src).filter(Boolean)),
    );
    await Promise.all(imageSources.map((source) => new Promise((resolve, reject) => {
      const image = new Image();
      const decode = () => {
        if (!image.naturalWidth) {
          reject(new Error(`Could not load screenshot image: ${source}`));
          return;
        }
        if (typeof image.decode === "function") {
          image.decode().then(resolve, reject);
        } else {
          resolve();
        }
      };

      image.onload = decode;
      image.onerror = () => reject(new Error(`Could not load screenshot image: ${source}`));
      image.src = source;
      if (image.complete) decode();
    })));
  }

  async function downloadInventoryScreenshot() {
    if (screenshotInProgress) return;
    screenshotInProgress = true;
    const originalScrollY = window.scrollY;

    try {
      if (window.innerWidth < 1024) {
        throw new Error("कृपया screenshot लेने के लिए desktop viewport का उपयोग करें।");
      }
      if (typeof window.html2canvas !== "function") {
        throw new Error("Screenshot सुविधा लोड नहीं हो सकी।");
      }

      await waitForScreenshotAssets();
      const pageWidth = document.documentElement.scrollWidth;
      const viewportHeight = window.innerHeight;
      const currentScrollY = window.scrollY;
      const hasSelection = Array.from(rowStates.values()).some((state) => state.selected);
      const canvas = await window.html2canvas(document.documentElement, {
        backgroundColor: null,
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        width: pageWidth,
        windowHeight: viewportHeight,
        windowWidth: window.innerWidth,
        onclone: (clonedDocument) => {
          const clonedHeader = clonedDocument.querySelector(
            'header[data-purpose="site-navigation"]',
          );
          if (clonedHeader) {
            clonedHeader.style.position = "absolute";
            clonedHeader.style.top = "0";
            clonedHeader.style.zIndex = "auto";

            const clonedNavigation = clonedHeader.querySelector(
              '[data-purpose="main-nav-links"]',
            );
            if (clonedNavigation) clonedNavigation.remove();

            const clonedHeaderActions = clonedHeader.querySelector(".header-actions");
            if (clonedHeaderActions) {
              clonedHeaderActions.style.flex = "1";
              clonedHeaderActions.style.minWidth = "0";

              const stockButton = clonedHeaderActions.querySelector(".header-stock-cta");
              const whatsappButton = clonedHeaderActions.querySelector(
                '[data-purpose="header-whatsapp-cta"]',
              );
              for (const button of [stockButton, whatsappButton]) {
                if (button) {
                  button.style.flex = "1 1 0";
                  button.style.minWidth = "0";
                  button.style.justifyContent = "center";
                }
              }

              const stockLabel = stockButton?.querySelector("span");
              if (stockLabel) stockLabel.textContent = "shahimeva.com";

              const whatsappLabel = whatsappButton?.querySelector("span");
              if (whatsappLabel) whatsappLabel.textContent = "87573 46644";

              clonedHeaderActions.querySelector(".mobile-menu-toggle")?.remove();
            }
          }

          const clonedTableHeader = clonedDocument.querySelector(".inventory-table thead");
          if (clonedTableHeader) clonedTableHeader.style.position = "static";

          clonedDocument.querySelectorAll(".product-row").forEach((row) => {
            const quantityCell = row.querySelector(".inventory-quantity");
            const state = rowStates.get(row.dataset.sku);
            const quantity = state?.selected ? String(state.quantity) : "";
            if (!quantityCell) return;

            row.hidden = false;
            quantityCell.querySelector(".quantity-control")?.remove();
            quantityCell.querySelector(".bulk-enquiry")?.remove();

            const selectedQuantity = clonedDocument.createElement("span");
            selectedQuantity.className = "screenshot-quantity";
            selectedQuantity.textContent = quantity;
            quantityCell.prepend(selectedQuantity);
          });
          const clonedNoResults = clonedDocument.querySelector("#no-results");
          if (clonedNoResults) clonedNoResults.hidden = true;

          const clonedInventoryWhatsApp = clonedDocument.querySelector("#inventory-whatsapp");
          const clonedInventoryWhatsAppLabel = clonedInventoryWhatsApp?.querySelector("span");
          if (clonedInventoryWhatsAppLabel) {
            clonedInventoryWhatsAppLabel.replaceChildren("87573 46644");
          }

          const clonedQuoteTab = clonedDocument.querySelector("#whatsapp-cta-btn.is-visible");
          if (clonedQuoteTab) {
            const quoteHeight = clonedQuoteTab.getBoundingClientRect().height;
            clonedQuoteTab.style.position = "absolute";
            clonedQuoteTab.style.top =
              `${Math.max(0, currentScrollY + viewportHeight - quoteHeight - 16)}px`;
            clonedQuoteTab.style.right = "auto";
            clonedQuoteTab.style.bottom = "auto";
            clonedQuoteTab.style.left = "1rem";
          }

          const clonedToast = clonedDocument.querySelector("#screenshot-toast");
          if (clonedToast) clonedToast.hidden = true;

          clonedDocument.querySelector("#inventory-lightbox")?.remove();
          clonedDocument.querySelector(".sales-banner-dialog")?.remove();
        },
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result && result.type === "image/png" && result.size > 0) {
            resolve(result);
          } else {
            reject(new Error("PNG image could not be created."));
          }
        }, "image/png");
      });
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = hasSelection
        ? "Shahi-Meva-Selected-Stock.png"
        : "Shahi-Meva-Full-Stock.png";
      downloadLink.hidden = true;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      showScreenshotToast("Screenshot सफलतापूर्वक डाउनलोड हो गया!");
    } catch (error) {
      console.error("Could not capture or download the inventory screenshot:", error);
      showScreenshotToast(
        error instanceof Error ? error.message : "Screenshot डाउनलोड नहीं हो सका।",
        true,
      );
    } finally {
      window.scrollTo({ top: originalScrollY, behavior: "instant" });
      screenshotInProgress = false;
    }
  }

  document.querySelectorAll("[data-screenshot]").forEach((button) => {
    button.addEventListener("click", downloadInventoryScreenshot);
  });

  updateSummary();
  filterProducts();
});
