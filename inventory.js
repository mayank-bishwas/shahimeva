document.addEventListener("DOMContentLoaded", () => {
  const products = window.shahiMevaInventoryData;
  const tableBody = document.querySelector("#table-rows-container");
  const searchInput = document.querySelector("#product-search");
  const categoryFilter = document.querySelector("#category-filter");
  const availabilityFilter = document.querySelector("#availability-filter");
  const categoryTrigger = document.querySelector("#category-filter-trigger");
  const categoryValue = document.querySelector("#category-filter-value");
  const categoryMenu = document.querySelector("#category-filter-menu");
  const availabilityTrigger = document.querySelector("#availability-filter-trigger");
  const availabilityValue = document.querySelector("#availability-filter-value");
  const availabilityMenu = document.querySelector("#availability-filter-menu");
  const quoteTab = document.querySelector("#whatsapp-cta-btn");
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
  let activeGallery = [];
  let activeGalleryIndex = 0;
  let activeGalleryProductName = "";
  let pointerStartX = null;

  if (!Array.isArray(products) || !tableBody || !searchInput || !categoryFilter ||
      !availabilityFilter || !quoteTab || !resetButton || !noResults ||
      !printSummary || !(lightbox instanceof HTMLDialogElement) || !lightboxImage ||
      !lightboxCaption || !previousImageButton || !nextImageButton) {
    throw new Error("Inventory page is missing required data or controls.");
  }

  const formatMoney = (amount) => `₹${amount.toLocaleString("en-IN")}`;
  const formatWeight = (weight) => `${Number.isInteger(weight) ? weight : weight.toFixed(1)} kg`;

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
    enquiry.href = `https://wa.me/918757346644?text=${encodeURIComponent(
      `नमस्ते प्रभास, मुझे ${product.name} (${product.pack}) की 99 से अधिक मात्रा चाहिए। कृपया बड़ी मात्रा के लिए संपर्क करें।`,
    )}`;
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
      const matchesCategory = categories.length === 0 || categories.includes("all") || categories.includes(product.category);
      const matchesAvailability =
        availability.length === 0 || availability.includes("all") ||
        (availability.includes("in-stock") && product.inStock) ||
        (availability.includes("out-of-stock") && !product.inStock);
      const visible = matchesQuery && matchesCategory && matchesAvailability;

      element.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    noResults.hidden = visibleCount > 0;
  }

  function getSelectedValues(filter) {
    if (!filter) return [];
    return Array.from(filter.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
  }

  function updateFilterValue(triggerValue, selected) {
    if (selected.length === 0 || selected.includes("all")) {
      triggerValue.textContent = "सभी उत्पाद";
    } else if (selected.length === 1) {
      triggerValue.textContent = selected[0];
    } else {
      triggerValue.textContent = `${selected.length} चुने हुए`;
    }
  }

  function toggleCategoryMenu() {
    const isOpen = categoryMenu.hidden === false;
    closeAllMenus();
    if (!isOpen) {
      categoryMenu.hidden = false;
      categoryTrigger.setAttribute("aria-expanded", "true");
    }
  }

  function toggleAvailabilityMenu() {
    const isOpen = availabilityMenu.hidden === false;
    closeAllMenus();
    if (!isOpen) {
      availabilityMenu.hidden = false;
      availabilityTrigger.setAttribute("aria-expanded", "true");
    }
  }

  function closeAllMenus() {
    categoryMenu.hidden = true;
    availabilityMenu.hidden = true;
    categoryTrigger.setAttribute("aria-expanded", "false");
    availabilityTrigger.setAttribute("aria-expanded", "false");
  }

  function closeMultiselectMenus(event) {
    if (event.target.closest(".inventory-multiselect__menu") ||
        event.target.closest(".inventory-multiselect__trigger")) return;
    closeAllMenus();
  }

  categoryFilter.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.allOption === "true") {
      const allChecked = target.checked;
      categoryFilter.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = allChecked;
      });
    } else {
      const allCheckbox = categoryFilter.querySelector('input[data-all-option="true"]');
      const individualCheckboxes = categoryFilter.querySelectorAll('input[type="checkbox"]:not([data-all-option="true"])');
      if (!target.checked) {
        allCheckbox.checked = false;
      } else if (Array.from(individualCheckboxes).every((cb) => cb.checked)) {
        allCheckbox.checked = true;
      }
    }
    updateFilterValue(categoryValue, getSelectedValues(categoryFilter));
    filterProducts();
  });
  availabilityFilter.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.allOption === "true") {
      const allChecked = target.checked;
      availabilityFilter.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = allChecked;
      });
    } else {
      const allCheckbox = availabilityFilter.querySelector('input[data-all-option="true"]');
      const individualCheckboxes = availabilityFilter.querySelectorAll('input[type="checkbox"]:not([data-all-option="true"])');
      if (!target.checked) {
        allCheckbox.checked = false;
      } else if (Array.from(individualCheckboxes).every((cb) => cb.checked)) {
        allCheckbox.checked = true;
      }
    }
    updateFilterValue(availabilityValue, getSelectedValues(availabilityFilter));
    filterProducts();
  });

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
        selectedProducts.push({ product, quantity, lineTotal });
      }

      element.dataset.selected = String(state.selected);
      bulkMessage.hidden = !state.overLimit;
    });

    const lineCount = selectedProducts.length;
    const formattedWeight = formatWeight(weight);
    document.querySelector("#total-weight").textContent = formattedWeight;
    document.querySelector("#total-quantity").textContent = String(lineCount);
    document.querySelector("#total-item-label").textContent = lineCount === 1 ? "item" : "items";
    document.querySelector("#total-amount").textContent = formatMoney(amount);

    const message = [
      "नमस्ते शाही मेवा,",
      "",
      "मैं आपसे निम्नलिखित सामान के लिए कीमत और उपलब्धता की पुष्टि करना चाहता/चाहती हूँ:",
      "",
      ...selectedProducts.map(({ product, quantity, lineTotal }) =>
        `• [${product.sku}] ${product.name} · ${product.pack} · मात्रा ${quantity} · इकाई दर ${formatMoney(product.price)} · कुल ${formatMoney(lineTotal)}`,
      ),
      "",
      `कुल अनुमानित राशि: ${formatMoney(amount)}`,
      `कुल वजन: ${formattedWeight}`,
      "",
      "धन्यवाद।",
    ].join("\n");
    quoteTab.href = `https://wa.me/918757346644?text=${encodeURIComponent(message)}`;
    quoteTab.classList.toggle("is-visible", lineCount > 0);
    quoteTab.setAttribute("aria-hidden", String(lineCount === 0));
    quoteTab.tabIndex = lineCount > 0 ? 0 : -1;
    document.body.classList.toggle("inventory-has-selection", lineCount > 0);
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
  categoryTrigger.addEventListener("click", toggleCategoryMenu);
  availabilityTrigger.addEventListener("click", toggleAvailabilityMenu);
  document.addEventListener("click", closeMultiselectMenus);

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
    categoryFilter.value = "all";
    availabilityFilter.value = "all";
    filterProducts();
    updateSummary();
  });

  function updateGalleryImage() {
    const src = activeGallery[activeGalleryIndex];
    lightboxImage.src = src;
    lightboxImage.alt = activeGalleryProductName;
    lightboxCaption.textContent =
      `${activeGalleryProductName} · ${activeGalleryIndex + 1} / ${activeGallery.length}`;
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

  document.querySelectorAll("[data-print]").forEach((button) => {
    button.addEventListener("click", () => window.print());
  });

  updateSummary();
  filterProducts();
});
