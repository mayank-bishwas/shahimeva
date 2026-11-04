/**
 * Update a product price and its WhatsApp order link when the pack changes.
 */
function updateRowPrice(selectElement, priceCellId, buttonId, productName) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const packName = selectedOption?.dataset.pack || "पैकेट";
  const priceCell = document.getElementById(priceCellId);
  const button = document.getElementById(buttonId);

  if (priceCell) {
    priceCell.textContent = selectElement.value;
  }

  if (button) {
    const message = `नमस्ते शाही मेवा, मुझे ${productName} (${packName}) ऑर्डर करना है। कृपया आगे की प्रक्रिया बताएं।`;
    button.href = `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
  }
}
