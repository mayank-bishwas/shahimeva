const INVENTORY_API_URL = window.SHAHI_MEVA_INVENTORY_API || "https://website-ai-flax.vercel.app/api/inventory/public";

const CATEGORY_SLUGS = {
  "मखाना (Makhana)": "makhana",
  "काजू (Cashew)": "cashew",
  "बादाम (Almond)": "almond",
  "किशमिश (Raisin)": "raisin",
  "अखरोट (Walnut)": "walnut",
};

function mapApiProduct(apiProduct) {
  const unit = apiProduct.unit || "";
  const variantNumber = Number(apiProduct.variant) || 0;
  const weightKg = unit === "g" ? variantNumber / 1000 : variantNumber;
  const packLabel = unit === "g"
    ? `${variantNumber} ग्राम`
    : unit === "kg"
      ? `${variantNumber} किलो`
      : apiProduct.variant;
  const categorySlug = CATEGORY_SLUGS[apiProduct.category] || apiProduct.category.toLowerCase().replace(/\s+/g, "-");
  return {
    sku: apiProduct.sku,
    category: categorySlug,
    categoryName: apiProduct.category.split(" (")[0] || apiProduct.category,
    categoryEnglish: apiProduct.category,
    name: apiProduct.name,
    description: apiProduct.description || "",
    pack: packLabel,
    weight: Number.isNaN(weightKg) ? 0 : weightKg,
    price: Number(apiProduct.price) || 0,
    image: Array.isArray(apiProduct.imageUrls) && apiProduct.imageUrls.length
      ? apiProduct.imageUrls[0]
      : "",
    images: Array.isArray(apiProduct.imageUrls) ? apiProduct.imageUrls : [],
    inStock: apiProduct.inStock === true,
  };
}

function showInventoryState(state) {
  const tableWrap = document.querySelector(".inventory-table-wrap");
  const mobileProducts = document.querySelector("#inventory-mobile-products");
  const noResults = document.querySelector("#no-results");
  const loadingNotice = document.querySelector("#inventory-loading");
  const errorNotice = document.querySelector("#inventory-error");
  const errorRetry = document.querySelector("#inventory-error-retry");
  const stockDate = document.querySelector("#stock-date");

  const elements = [tableWrap, mobileProducts, noResults, loadingNotice, errorNotice];
  for (const el of elements) {
    if (el) el.hidden = true;
  }
  if (errorRetry) errorRetry.hidden = true;

  if (state === "loading") {
    if (loadingNotice) loadingNotice.hidden = false;
    return;
  }
  if (state === "error") {
    if (errorNotice) errorNotice.hidden = false;
    if (errorRetry) errorRetry.hidden = false;
    return;
  }
  if (state === "empty") {
    if (noResults) {
      noResults.hidden = false;
      noResults.textContent = "फिलहाल कोई उत्पाद उपलब्ध नहीं है।";
    }
    return;
  }
  if (state === "ready") {
    if (tableWrap) tableWrap.hidden = false;
    if (mobileProducts) mobileProducts.hidden = false;
    if (tableWrap) tableWrap.hidden = false;
    if (mobileProducts) mobileProducts.hidden = false;
    if (stockDate) {
      const formatter = new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "long", year: "numeric" });
      stockDate.textContent = `${formatter.format(new Date())} के अनुसार`;
    }
  }
}

function populateCategoryFilter(products) {
  const categoryFilter = document.querySelector("#category-filter");
  if (!categoryFilter) return;

  const menu = categoryFilter.querySelector("#category-filter-menu");
  if (!menu) return;

  const allOption = menu.querySelector('input[data-all-option="true"]');
  if (!allOption) return;

  const seen = new Set();
  const uniqueProducts = [];
  for (const product of products) {
    if (!product || !product.category || seen.has(product.category)) continue;
    seen.add(product.category);
    uniqueProducts.push(product);
  }

  for (const product of uniqueProducts) {
    const label = document.createElement("label");
    label.className = "inventory-multiselect__option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = product.category;
    checkbox.checked = true;
    checkbox.dataset.filterLabel = product.categoryName || product.category;

    const box = document.createElement("span");
    box.className = "inventory-multiselect__box";
    box.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "inventory-multiselect__text";
    text.textContent = product.categoryName || product.category;

    label.append(checkbox, box, text);
    menu.appendChild(label);
  }

  allOption.checked = true;
}

async function loadInventory() {
  showInventoryState("loading");
  try {
    const response = await fetch(INVENTORY_API_URL, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Inventory API responded with status ${response.status}`);
    }
    const apiProducts = await response.json();
    if (!Array.isArray(apiProducts)) {
      throw new Error("Inventory API returned an unexpected response format.");
    }
    if (apiProducts.length === 0) {
      showInventoryState("empty");
      return;
    }
    const products = apiProducts.map(mapApiProduct);
    populateCategoryFilter(products);
    renderInventory(products);
    showInventoryState("ready");
  } catch (error) {
    console.error("Could not load inventory from API:", error);
    showInventoryState("error");
  }
}

function renderInventory(products) {
  const tableBody = document.querySelector("#table-rows-container");
  const mobileProducts = document.querySelector("#inventory-mobile-products");
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
  let sortState = { field: null, direction: "asc" }; // null|"sku"|"variant"

  if (
    !Array.isArray(products) || !tableBody || !mobileProducts || !searchInput || !categoryFilter ||
    !availabilityFilter || !quoteTab || !inventoryWhatsApp || !resetButton || !noResults ||
    !printSummary || !screenshotToast || !(lightbox instanceof HTMLDialogElement) || !lightboxImage ||
    !lightboxCaption || !previousImageButton || !nextImageButton
  ) {
    throw new Error("Inventory page is missing required data or controls.");
  }

  const formatMoney = (amount) => `₹${amount.toLocaleString("en-IN")}`;
  const formatWeight = (weight) => `${Number.isInteger(weight) ? weight : weight.toFixed(1)} kg`;
  const calculateLineTotal = (product, quantity) =>
    product.inStock && Number.isInteger(quantity) && quantity > 0
      ? product.price * quantity
      : 0;
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

  function makeQuantityControl(product) {
    const control = document.createElement("div");
    control.className = "quantity-control";

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
    input.value = "";
    input.disabled = !product.inStock;
    input.setAttribute("aria-label", `${product.name}, ${product.pack} की मात्रा`);

    const increment = document.createElement("button");
    increment.type = "button";
    increment.dataset.quantityAction = "increment";
    increment.setAttribute("aria-label", `${product.name}, ${product.pack} की मात्रा बढ़ाएँ`);
    increment.textContent = "+";
    increment.disabled = !product.inStock;

    control.append(decrement, input, increment);
    return { control, input };
  }

  function makePriceCell(product, className = "") {
    const priceCell = document.createElement("div");
    priceCell.className = `inventory-price ${className}`.trim();

    const unitPrice = document.createElement("span");
    unitPrice.className = "unit-price";
    unitPrice.textContent = formatMoney(product.price);

    const perPack = document.createElement("span");
    perPack.className = "inventory-unit-price";
    perPack.textContent = "प्रति पैक";

    const lineTotal = document.createElement("strong");
    lineTotal.className = "line-total";
    lineTotal.hidden = true;

    priceCell.append(unitPrice, perPack, lineTotal);
    return { priceCell, unitPrice, perPack, lineTotal };
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

    rowStates.set(product.sku, { quantity: null, selected: false });
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
    const { control: quantityControl, input } = makeQuantityControl(product);

    const printQuantity = document.createElement("span");
    printQuantity.className = "print-quantity";
    printQuantity.textContent = product.inStock ? "—" : "स्टॉक में नहीं";

    quantityCell.append(quantityControl, printQuantity);
    const bulkMessage = makeBulkMessage(product, quantityCell);
    row.append(quantityCell);

    const { priceCell } = makePriceCell(product);
    const tablePriceCell = makeCell("inventory-price");
    tablePriceCell.append(...priceCell.childNodes);
    const tableLineTotal = tablePriceCell.querySelector(".line-total");
    row.append(tablePriceCell);

    const galleryImages = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];
    thumbnail.dataset.gallerySku = product.sku;

    tableBody.append(row);
    const card = document.createElement("article");
    card.className = `inventory-mobile-card${product.inStock ? "" : " is-out-of-stock"}`;
    card.dataset.sku = product.sku;
    card.dataset.category = product.category;
    card.dataset.inStock = String(product.inStock);
    card.dataset.search = row.dataset.search;

    const cardTop = document.createElement("div");
    cardTop.className = "inventory-mobile-card-top";
    const cardThumbnail = document.createElement("button");
    cardThumbnail.type = "button";
    cardThumbnail.className = "inventory-image-button inventory-mobile-image-button";
    cardThumbnail.dataset.gallerySku = product.sku;
    cardThumbnail.setAttribute("aria-label", `${product.name} की तस्वीर बड़ी करके देखें`);
    const cardImage = document.createElement("img");
    cardImage.className = "inventory-product-image";
    cardImage.src = product.image;
    cardImage.alt = product.name;
    cardImage.loading = "lazy";
    cardThumbnail.append(cardImage);

    const cardInfo = document.createElement("div");
    cardInfo.className = "inventory-mobile-card-info";
    const cardTitle = document.createElement("div");
    cardTitle.className = "inventory-mobile-card-title";
    const skuBadge = document.createElement("span");
    skuBadge.className = "inventory-mobile-sku";
    skuBadge.textContent = product.sku;
    const cardName = document.createElement("span");
    cardName.className = "inventory-product-name";
    cardName.textContent = product.name;
    cardTitle.append(skuBadge, cardName);

    const descriptionWrap = document.createElement("div");
    descriptionWrap.className = "inventory-mobile-description-wrap";
    const cardDescription = document.createElement("p");
    cardDescription.className = "inventory-product-description is-collapsed";
    cardDescription.textContent = product.description;
    const descriptionToggle = document.createElement("button");
    descriptionToggle.type = "button";
    descriptionToggle.className = "inventory-description-toggle";
    descriptionToggle.setAttribute("aria-label", `${product.name} का पूरा विवरण दिखाएँ`);
    descriptionToggle.setAttribute("aria-expanded", "false");
    descriptionToggle.textContent = "⌄";
    descriptionToggle.hidden = true;
    descriptionWrap.append(cardDescription, descriptionToggle);
    cardInfo.append(cardTitle, descriptionWrap);

    if (!product.inStock) {
      const cardStockStatus = document.createElement("span");
      cardStockStatus.className = "inventory-stock-status is-out";
      cardStockStatus.textContent = "स्टॉक में नहीं";
      cardInfo.append(cardStockStatus);
    }

    cardTop.append(cardThumbnail, cardInfo);
    const cardFooter = document.createElement("div");
    cardFooter.className = "inventory-mobile-card-footer";
    const cardPack = document.createElement("span");
    cardPack.className = "inventory-mobile-pack";
    cardPack.textContent = product.pack;
    const cardQuantity = document.createElement("div");
    cardQuantity.className = "inventory-mobile-quantity";
    const { control: cardQuantityControl, input: cardInput } = makeQuantityControl(product);
    cardQuantity.append(cardQuantityControl);
    const cardBulkMessage = makeBulkMessage(product, cardQuantity);
    const cardPrice = makePriceCell(product, "inventory-mobile-price");
    cardFooter.append(cardPack, cardQuantity, cardPrice.priceCell);
    card.append(cardTop, cardFooter);
    mobileProducts.append(card);

    const resizeObserver = new ResizeObserver(() => {
      const expanded = cardDescription.classList.contains("is-expanded");
      cardDescription.classList.remove("is-collapsed", "is-expanded");
      const fullHeight = cardDescription.scrollHeight;
      cardDescription.classList.add("is-collapsed");
      const collapsedHeight = cardDescription.clientHeight;
      cardDescription.classList.toggle("is-expanded", expanded);
      cardDescription.classList.toggle("is-collapsed", !expanded);
      descriptionToggle.hidden = fullHeight <= collapsedHeight + 1 && !expanded;
    });
    resizeObserver.observe(cardDescription);
    document.fonts?.ready.then(() => resizeObserver.observe(cardDescription));

    rows.push({
      element: row,
      card,
      product,
      input,
      cardInput,
      inputs: [input, cardInput],
      printQuantity,
      bulkMessage,
      cardBulkMessage,
      lineTotals: [tableLineTotal, cardPrice.lineTotal],
      unitPrices: [tablePriceCell.querySelector(".unit-price"), cardPrice.unitPrice],
      perPackLabels: [tablePriceCell.querySelector(".inventory-unit-price"), cardPrice.perPack],
      priceCells: [tablePriceCell, cardPrice.priceCell],
      quantityControls: [quantityControl, cardQuantityControl],
      galleryImages,
    });
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
    const keywords = query
      .split(/\s+/)
      .filter(Boolean);
    const categories = getSelectedValues(categoryFilter);
    const availability = getSelectedValues(availabilityFilter);
    let visibleCount = 0;

    rows.forEach(({ element, card, product }) => {
      const matchesQuery =
        keywords.length === 0 ||
        keywords.some((keyword) => element.dataset.search.includes(keyword));
      const matchesCategory = categories.includes(product.category);
      const matchesAvailability =
        (availability.includes("in-stock") && product.inStock) ||
        (availability.includes("out-of-stock") && !product.inStock);
      const visible = matchesQuery && matchesCategory && matchesAvailability;

      element.hidden = !visible;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    noResults.hidden = visibleCount > 0;
  }

  function handleSort(field) {
    if (sortState.field === field) {
      sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    } else {
      sortState.field = field;
      sortState.direction = "asc";
    }
    updateSortIndicators();
    applySort();
    filterProducts();
  }

  function updateSortIndicators() {
    const fields = ["sku", "variant", "price"];

    fields.forEach((field) => {
      const header = document.querySelector(`#${field}-header`);
      const indicator = document.querySelector(`[data-${field}-indicator]`);
      const isActive = sortState.field === field;

      if (header) header.classList.toggle("sorted", isActive);
      if (indicator) {
        indicator.textContent = isActive
          ? sortState.direction === "asc" ? "↑" : "↓"
          : "↕";
      }
    });
  }

  function applySort() {
    if (!sortState.field) return;

    const rowsArray = Array.from(rows);
    rowsArray.sort((a, b) => {
      let aVal, bVal;
      if (sortState.field === "sku") {
        aVal = a.product.sku;
        bVal = b.product.sku;
      } else if (sortState.field === "variant") {
        aVal = a.product.weight;
        bVal = b.product.weight;
      } else if (sortState.field === "price") {
        aVal = a.product.price;
        bVal = b.product.price;
      } else {
        return 0;
      }

      const cmp = naturalCompare(aVal, bVal);
      return sortState.direction === "asc" ? cmp : -cmp;
    });

    const tableBody = document.querySelector("#table-rows-container");

    rowsArray.forEach(({ element }) => {
      tableBody.appendChild(element);
    });
  }

  function naturalCompare(a, b) {
    const aStr = String(a);
    const bStr = String(b);

    const tokenize = (str) =>
      str.split(/(\d+)/).map((part) => {
        const num = Number(part);
        return Number.isNaN(num) ? part.toLocaleLowerCase("hi-IN") : num;
      });

    const aTokens = tokenize(aStr);
    const bTokens = tokenize(bStr);

    for (let i = 0; i < Math.max(aTokens.length, bTokens.length); i++) {
      const ta = aTokens[i];
      const tb = bTokens[i];
      if (ta === undefined) return -1;
      if (tb === undefined) return 1;
      if (typeof ta === "number" && typeof tb === "number") {
        if (ta !== tb) return ta < tb ? -1 : 1;
      } else if (ta !== tb) {
        return String(ta).localeCompare(String(tb), "hi-IN", { numeric: true });
      }
    }
    return 0;
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

  function getSelectionSummary(states = rowStates) {
    let weight = 0;
    let amount = 0;
    let selectedQuantity = 0;
    const selectedProducts = [];

    rows.forEach(({ product }) => {
      const state = states.get(product.sku);
      if (
        !state?.selected ||
        !product.inStock ||
        !Number.isInteger(state.quantity) ||
        state.quantity < 1
      ) return;

      const lineTotal = calculateLineTotal(product, state.quantity);
      weight += state.quantity * product.weight;
      amount += lineTotal;
      selectedQuantity += state.quantity;
      selectedProducts.push({ product, quantity: state.quantity, lineTotal });
    });

    return {
      weight,
      amount,
      selectedQuantity,
      selectedProducts,
      hasSelection: selectedProducts.length > 0,
    };
  }

  function buildQuotationMessage({ selectedProducts, amount, weight }) {
    return [
      "नमस्ते शाही मेवा,",
      "",
      "मुझे आपसे निम्नलिखित सामान के लिए कीमत और उपलब्धता की पुष्टि करनी है:",
      "",
      ...selectedProducts.map(({ product, quantity, lineTotal }) =>
        `• [${product.sku}] ${product.name}: ${product.pack} · मात्रा ${quantity} · इकाई दर ${formatMoney(product.price)} = ${formatMoney(lineTotal)}`,
      ),
      "",
      `*कुल अनुमानित राशि: ${formatMoney(amount)}*`,
      `_कुल वजन: ${formatWeight(weight)}_`,
      "",
      "धन्यवाद।",
    ].join("\n");
  }

  function updateSummary() {
    const summary = getSelectionSummary();
    const { weight, amount, selectedQuantity, selectedProducts, hasSelection } = summary;

    rows.forEach(({
      element,
      card,
      product,
      inputs,
      printQuantity,
      bulkMessage,
      cardBulkMessage,
      lineTotals,
      unitPrices,
      perPackLabels,
      priceCells,
      quantityControls,
    }) => {
      const state = rowStates.get(product.sku);
      const selected =
        state.selected && Number.isInteger(state.quantity) && state.quantity >= 1;
      const quantity = selected ? state.quantity : null;
      const lineTotal = calculateLineTotal(product, quantity);

      element.classList.toggle("is-selected", selected);
      card.classList.toggle("is-selected", selected);
      inputs.forEach((input) => {
        input.value = quantity === null ? "" : String(quantity);
        input.classList.toggle("is-selected", selected);
      });
      printQuantity.textContent = selected ? String(quantity) : "";
      quantityControls.forEach((control) => {
        control.querySelectorAll("button").forEach((button) => {
          button.disabled =
            !product.inStock ||
            (!selected && button.dataset.quantityAction === "decrement");
        });
      });
      priceCells.forEach((priceCell) => priceCell.classList.toggle("has-selection", selected));
      lineTotals.forEach((total) => {
        total.textContent = formatMoney(lineTotal);
        total.hidden = !selected;
      });
      unitPrices.forEach((price) => {
        price.hidden = selected;
      });
      perPackLabels.forEach((label) => {
        label.hidden = selected;
      });

      element.dataset.selected = String(selected);
      card.dataset.selected = String(selected);
      bulkMessage.hidden = !state.overLimit;
      cardBulkMessage.hidden = !state.overLimit;
    });

    const formattedWeight = formatWeight(weight);
    document.querySelector("#total-weight").textContent = formattedWeight;
    document.querySelector("#total-quantity").textContent = String(selectedQuantity);
    document.querySelector("#total-item-label").textContent = selectedQuantity === 1 ? "item" : "items";
    document.querySelector("#total-amount").textContent = formatMoney(amount);

    const quotationMessage = buildQuotationMessage(summary);
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
      : null;
    state.overLimit = overLimit;
    updateSummary();
  }

  [tableBody, mobileProducts].forEach((container) => {
    container.addEventListener("click", (event) => {
      const descriptionToggle = event.target.closest(".inventory-description-toggle");
      if (descriptionToggle) {
        const card = descriptionToggle.closest(".inventory-mobile-card");
        const description = card?.querySelector(".inventory-product-description");
        if (description) {
          const expanded = description.classList.toggle("is-expanded");
          description.classList.toggle("is-collapsed", !expanded);
          descriptionToggle.setAttribute("aria-expanded", String(expanded));
          descriptionToggle.setAttribute(
            "aria-label",
            expanded ? "पूरा विवरण संक्षिप्त करें" : "पूरा विवरण दिखाएँ",
          );
          descriptionToggle.textContent = expanded ? "⌃" : "⌄";
        }
        return;
      }

      const button = event.target.closest("button[data-quantity-action]");
      if (button) {
        const row = button.closest(".product-row, .inventory-mobile-card");
        const rowEntry = rows.find((entry) => entry.product.sku === row?.dataset.sku);
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

    container.addEventListener("input", (event) => {
      if (!event.target.matches(".qty-input")) return;
      const row = event.target.closest(".product-row, .inventory-mobile-card");
      const rowEntry = rows.find((entry) => entry.product.sku === row?.dataset.sku);
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

    container.addEventListener("change", (event) => {
      if (!event.target.matches(".qty-input")) return;
      const row = event.target.closest(".product-row, .inventory-mobile-card");
      const rowEntry = rows.find((entry) => entry.product.sku === row?.dataset.sku);
      if (!rowEntry) return;
      const quantity = rowStates.get(rowEntry.product.sku).quantity;
      event.target.value = quantity === null ? "" : String(quantity);
    });
  });

  searchInput.addEventListener("input", filterProducts);
  categoryFilter.addEventListener("multiselectchange", filterProducts);
  availabilityFilter.addEventListener("multiselectchange", filterProducts);

  // Sortable column headers
  const skuHeader = document.querySelector("#sku-header .sort-header-button");
  const variantHeader = document.querySelector("#variant-header .sort-header-button");
  const priceHeader = document.querySelector("#price-header .sort-header-button");
  if (skuHeader) {
    skuHeader.addEventListener("click", () => handleSort("sku"));
  }
  if (variantHeader) {
    variantHeader.addEventListener("click", () => handleSort("variant"));
  }
  if (priceHeader) {
    priceHeader.addEventListener("click", () => handleSort("price"));
  }

  resetButton.addEventListener("click", () => {
    rows.forEach(({ product, inputs }) => {
      rowStates.set(product.sku, {
        quantity: null,
        selected: false,
        overLimit: false,
      });
      inputs.forEach((input) => {
        input.value = "";
      });
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

  function waitForScreenshotAsset(promise, message) {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error(message)),
        15000,
      );
      promise.then(
        (value) => {
          window.clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }

  async function waitForScreenshotAssets() {
    if (document.fonts?.ready) {
      await waitForScreenshotAsset(
        document.fonts.ready,
        "Screenshot तैयार करने में फ़ॉन्ट लोड नहीं हो पाए।",
      );
    }

    const imageSources = Array.from(
      new Set(Array.from(document.images, (image) => image.currentSrc || image.src).filter(Boolean)),
    );
    await Promise.all(imageSources.map((source) => {
      const imageLoad = new Promise((resolve, reject) => {
        const image = new Image();
        const decode = () => {
          if (!image.naturalWidth) {
            reject(new Error(`Could not load screenshot image: ${source}`));
            return;
          }
          if (typeof image.decode === "function") {
            image.decode().then(
              resolve,
              () => reject(new Error(`Could not decode screenshot image: ${source}`)),
            );
          } else {
            resolve();
          }
        };

        image.onload = decode;
        image.onerror = () => reject(new Error(`Could not load screenshot image: ${source}`));
        image.src = source;
        if (image.complete) decode();
      });
      return waitForScreenshotAsset(
        imageLoad,
        `Timed out loading screenshot image: ${source}`,
      );
    }));
  }

  async function downloadInventoryScreenshot() {
    if (screenshotInProgress) return;
    screenshotInProgress = true;
    const originalScrollY = window.scrollY;

    try {
      if (typeof window.html2canvas !== "function") {
        throw new Error("Screenshot सुविधा लोड नहीं हो सकी।");
      }

      await waitForScreenshotAssets();
      const selectionSnapshot = new Map(
        rows.map(({ product }) => [product.sku, { ...rowStates.get(product.sku) }]),
      );
      const screenshotSummary = getSelectionSummary(selectionSnapshot);
      const pageWidth = document.documentElement.scrollWidth;
      const viewportHeight = window.innerHeight;
      const currentScrollY = window.scrollY;
      const hasSelection = screenshotSummary.hasSelection;
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

            if (window.innerWidth >= 1024) {
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
          }

          const clonedTableHeader = clonedDocument.querySelector(".inventory-table thead");
          if (clonedTableHeader) clonedTableHeader.style.position = "static";

          const clonedControls = clonedDocument.querySelector(".inventory-controls");
          if (clonedControls) {
            clonedControls.style.position = "static";
            clonedControls.style.top = "auto";
            clonedControls.style.zIndex = "auto";
          }

          clonedDocument.querySelectorAll(".product-row, .inventory-mobile-card").forEach((row) => {
            const quantityCell = row.querySelector(".inventory-quantity, .inventory-mobile-quantity");
            const state = selectionSnapshot.get(row.dataset.sku);
            const product = products.find((entry) => entry.sku === row.dataset.sku);
            const selected = Boolean(
              state?.selected &&
              product?.inStock &&
              Number.isInteger(state.quantity) &&
              state.quantity >= 1,
            );
            const quantity = selected ? state.quantity : 0;
            row.classList.toggle("is-selected", selected);
            row.dataset.selected = String(selected);
            if (!quantityCell) return;

            row.hidden = false;
            const priceCell = row.querySelector(".inventory-price");
            if (priceCell && product) {
              priceCell.classList.toggle("has-selection", selected);
              const unitPrice = priceCell.querySelector(".unit-price");
              const lineTotal = priceCell.querySelector(".line-total");
              const perPack = priceCell.querySelector(".inventory-unit-price");
              if (unitPrice) unitPrice.hidden = selected;
              if (lineTotal) {
                lineTotal.textContent = formatMoney(
                  calculateLineTotal(product, selected ? quantity : 0),
                );
                lineTotal.hidden = !selected;
              }
              if (perPack) perPack.hidden = selected && quantity > 1;
            }
            quantityCell.querySelector(".quantity-control")?.remove();
            quantityCell.querySelector(".bulk-enquiry")?.remove();

            const selectedQuantity = clonedDocument.createElement("span");
            selectedQuantity.className = "screenshot-quantity";
            selectedQuantity.textContent = selected ? String(quantity) : "";
            quantityCell.prepend(selectedQuantity);
          });
          const clonedNoResults = clonedDocument.querySelector("#no-results");
          if (clonedNoResults) clonedNoResults.hidden = true;

          const clonedInventoryWhatsApp = clonedDocument.querySelector("#inventory-whatsapp");
          const clonedInventoryWhatsAppLabel = clonedInventoryWhatsApp?.querySelector("span");
          if (clonedInventoryWhatsAppLabel) {
            clonedInventoryWhatsAppLabel.replaceChildren("87573 46644");
          }

          const clonedQuoteTab = clonedDocument.querySelector("#whatsapp-cta-btn");
          if (clonedQuoteTab) {
            clonedQuoteTab.classList.toggle("is-visible", hasSelection);
            clonedQuoteTab.setAttribute("aria-hidden", String(!hasSelection));
            clonedQuoteTab.tabIndex = hasSelection ? 0 : -1;
            clonedQuoteTab.href = hasSelection
              ? whatsappUrl(buildQuotationMessage(screenshotSummary))
              : generalEnquiryUrl;
            clonedQuoteTab.querySelector("#total-amount").textContent =
              formatMoney(screenshotSummary.amount);
            clonedQuoteTab.querySelector("#total-quantity").textContent =
              String(screenshotSummary.selectedQuantity);
            clonedQuoteTab.querySelector("#total-item-label").textContent =
              screenshotSummary.selectedQuantity === 1 ? "item" : "items";
            clonedQuoteTab.querySelector("#total-weight").textContent =
              formatWeight(screenshotSummary.weight);
            if (hasSelection) {
              const quoteRect = clonedQuoteTab.getBoundingClientRect();
              clonedQuoteTab.style.position = "absolute";
              clonedQuoteTab.style.top = `${Math.max(0, currentScrollY + quoteRect.top)}px`;
              clonedQuoteTab.style.right = "auto";
              clonedQuoteTab.style.bottom = "auto";
              clonedQuoteTab.style.left = `${quoteRect.left}px`;
              clonedQuoteTab.style.transform = "none";
            }
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
}

document.addEventListener("DOMContentLoaded", () => {
  const retryButton = document.querySelector("#inventory-error-retry");
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      loadInventory();
    });
  }
  loadInventory();
});
