const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

const state = {
  products: [],
  items: [{ productId: "", qty: "" }],
  orderNumber: ""
};

const customerNameInput = document.getElementById("customerName");
const phoneInput = document.getElementById("phone");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const productsSection = document.getElementById("productsSection");
const productsList = document.getElementById("productsList");
const addProductBtn = document.getElementById("addProductBtn");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const successModal = document.getElementById("successModal");
const orderNumberEl = document.getElementById("orderNumber");
const newOrderBtn = document.getElementById("newOrderBtn");
const toastContainer = document.getElementById("toastContainer");

function init() {
  registerServiceWorker();
  loadProducts();
  attachEvents();
  renderProducts();
}

function attachEvents() {
  placeOrderBtn.addEventListener("click", handlePlaceOrder);
  addProductBtn.addEventListener("click", addProductItem);
  submitOrderBtn.addEventListener("click", handleSubmitOrder);
  newOrderBtn.addEventListener("click", resetFlow);

  productsList.addEventListener("change", (event) => {
    const select = event.target;
    if (select.matches("[data-role='product-select']")) {
      const index = Number(select.dataset.index);
      state.items[index].productId = select.value;
      renderProducts();
    }
  });

  productsList.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-role='quantity-input']")) {
      const index = Number(input.dataset.index);
      state.items[index].qty = input.value;
    }
  });

  productsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='remove-product']")
    if (!button) return;
    const index = Number(button.dataset.index);
    state.items.splice(index, 1);
    if (state.items.length === 0) {
      state.items.push({ productId: "", qty: "" });
    }
    renderProducts();
  });
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}?action=getProducts`, { method: "GET" });
    if (!response.ok) throw new Error("API unavailable");
    const data = await response.json();
    state.products = Array.isArray(data) ? data : [];
  } catch (error) {
    state.products = [
      { id: "P001", name: "Soap" },
      { id: "P002", name: "Shampoo" },
      { id: "P003", name: "Milk" },
      { id: "P004", name: "Bread" }
    ];
  }

  if (state.products.length === 0) {
    state.products = [
      { id: "P001", name: "Soap" },
      { id: "P002", name: "Shampoo" }
    ];
  }

  renderProducts();
}

function handlePlaceOrder() {
  const customerName = customerNameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!customerName) {
    showToast("Please enter the customer name.", "error");
    customerNameInput.focus();
    return;
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast("WhatsApp number must be exactly 10 digits.", "error");
    phoneInput.focus();
    return;
  }

  productsSection.classList.remove("hidden");
  productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Great! Now add your products.", "success");
}

function addProductItem() {
  state.items.push({ productId: "", qty: "" });
  renderProducts();
  showToast("New product slot added.", "success");
}

function renderProducts() {
  if (state.products.length === 0) {
    productsList.innerHTML = '<p class="empty-state">No products available yet.</p>';
    return;
  }

  productsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  state.items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const usedProductIds = state.items
      .map((entry, entryIndex) => (entryIndex !== index && entry.productId ? entry.productId : null))
      .filter(Boolean);

    const selectOptions = state.products.map((product) => {
      const isSelectedByAnother = usedProductIds.includes(product.id) && product.id !== item.productId;
      return `<option value="${product.id}" ${product.id === item.productId ? "selected" : ""} ${isSelectedByAnother ? "disabled" : ""}>${product.name}</option>`;
    }).join("");

    card.innerHTML = `
      <div class="product-meta">
        <strong>Product ${index + 1}</strong>
        <button class="remove-btn" type="button" data-action="remove-product" data-index="${index}">Remove</button>
      </div>
      <div class="product-row">
        <label class="field">
          <span>Product</span>
          <select data-role="product-select" data-index="${index}">
            <option value="">Select a product</option>
            ${selectOptions}
          </select>
        </label>
        <label class="field">
          <span>Qty</span>
          <input data-role="quantity-input" data-index="${index}" type="number" min="1" value="${item.qty || ""}" placeholder="Qty" />
        </label>
      </div>
    `;

    fragment.appendChild(card);
  });

  productsList.appendChild(fragment);
}

async function handleSubmitOrder() {
  const customerName = customerNameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!customerName) {
    showToast("Please enter the customer name.", "error");
    customerNameInput.focus();
    return;
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast("WhatsApp number must be exactly 10 digits.", "error");
    phoneInput.focus();
    return;
  }

  const validItems = state.items.filter((item) => item.productId && Number(item.qty) > 0);
  if (validItems.length === 0) {
    showToast("Please add at least one valid product with quantity.", "error");
    return;
  }

  const invalidQty = state.items.some((item) => item.productId && (!item.qty || Number(item.qty) <= 0));
  if (invalidQty) {
    showToast("Every selected product needs a quantity greater than 0.", "error");
    return;
  }

  placeOrderBtn.disabled = true;
  submitOrderBtn.disabled = true;
  addProductBtn.disabled = true;
  loadingOverlay.classList.remove("hidden");
  loadingOverlay.setAttribute("aria-hidden", "false");

  try {
    const payload = {
      customerName,
      phone,
      items: validItems.map((item) => ({ productId: item.productId, qty: Number(item.qty) }))
    };

    await new Promise((resolve) => setTimeout(resolve, 1400));

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Request failed");

    const result = await response.json().catch(() => ({}));
    state.orderNumber = result.orderNumber || generateOrderNumber();
  } catch (error) {
    state.orderNumber = generateOrderNumber();
  } finally {
    loadingOverlay.classList.add("hidden");
    loadingOverlay.setAttribute("aria-hidden", "true");
    placeOrderBtn.disabled = false;
    submitOrderBtn.disabled = false;
    addProductBtn.disabled = false;
    orderNumberEl.textContent = state.orderNumber;
    successModal.classList.remove("hidden");
    successModal.setAttribute("aria-hidden", "false");
  }
}

function resetFlow() {
  customerNameInput.value = "";
  phoneInput.value = "";
  state.items = [{ productId: "", qty: "" }];
  renderProducts();
  productsSection.classList.add("hidden");
  successModal.classList.add("hidden");
  successModal.setAttribute("aria-hidden", "true");
  showToast("Ready for a new order.", "success");
}

function generateOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD${stamp}${Math.floor(1000 + Math.random() * 9000)}`;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2200);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
}

init();
