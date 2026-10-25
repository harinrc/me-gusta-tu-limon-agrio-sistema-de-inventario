(() => {
  "use strict";

  const STORAGE_KEY = "coopasa-inventario-v1";
  const form = document.getElementById("product-form");
  const dialog = document.getElementById("product-dialog");
  const tableBody = document.getElementById("product-table-body");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const stockFilter = document.getElementById("stock-filter");
  const toast = document.getElementById("toast");
  let products = loadProducts();
  let toastTimer;

  function loadProducts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("El formato guardado no es una lista.");
      return parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string");
    } catch (error) {
      console.error("No se pudo leer el inventario local:", error);
      window.setTimeout(() => showToast("No se pudieron cargar los datos guardados. Revisa el almacenamiento del navegador."), 0);
      return [];
    }
  }

  function saveProducts(nextProducts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
      products = nextProducts;
      return true;
    } catch (error) {
      console.error("No se pudo guardar el inventario local:", error);
      showToast("No se pudieron guardar los cambios. Comprueba el espacio disponible del navegador.");
      return false;
    }
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function getStatus(product) {
    const stock = Number(product.stock) || 0;
    if (stock === 0) return { label: "Agotado", className: "status-out" };
    if (stock <= (Number(product.minStock) || 0)) return { label: "Stock bajo", className: "status-low" };
    return { label: "Disponible", className: "status-ok" };
  }

  function visibleProducts() {
    const search = searchInput.value.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const searchable = [product.name, product.sku, product.brand, product.model, product.category]
        .join(" ").toLocaleLowerCase("es");
      if (search && !searchable.includes(search)) return false;
      if (categoryFilter.value && product.category !== categoryFilter.value) return false;
      const stock = Number(product.stock) || 0;
      if (stockFilter.value === "out" && stock !== 0) return false;
      if (stockFilter.value === "available" && stock === 0) return false;
      if (stockFilter.value === "low" && (stock === 0 || stock > (Number(product.minStock) || 0))) return false;
      return true;
    });
  }

  function render() {
    tableBody.replaceChildren();
    const filtered = visibleProducts();
    filtered.forEach((product) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.append(createElement("span", "product-name", product.name));
      const meta = [product.brand, product.model].filter(Boolean).join(" · ");
      if (meta) nameCell.append(createElement("span", "product-meta", meta));
      const categoryCell = document.createElement("td");
      categoryCell.append(createElement("span", "category-tag", product.category || "Otros"));
      const skuCell = document.createElement("td");
      skuCell.append(createElement("span", "sku-text", product.sku || "—"));
      const priceCell = createElement("td", "", formatCurrency(product.price));
      const stockCell = document.createElement("td");
      stockCell.append(createElement("span", "stock-number", String(Number(product.stock) || 0)));
      stockCell.append(createElement("span", "stock-min", `Mínimo: ${Number(product.minStock) || 0}`));
      const status = getStatus(product);
      const statusCell = document.createElement("td");
      statusCell.append(createElement("span", `status-pill ${status.className}`, status.label));
      const actionsCell = document.createElement("td");
      const actions = createElement("div", "row-actions");
      const editButton = createElement("button", "icon-button", "✎");
      editButton.type = "button";
      editButton.setAttribute("aria-label", `Editar ${product.name}`);
      editButton.title = "Editar producto";
      editButton.addEventListener("click", () => openDialog(product));
      const deleteButton = createElement("button", "icon-button delete", "×");
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
      deleteButton.title = "Eliminar producto";
      deleteButton.addEventListener("click", () => deleteProduct(product));
      actions.append(editButton, deleteButton);
      actionsCell.append(actions);
      row.append(nameCell, categoryCell, skuCell, priceCell, stockCell, statusCell, actionsCell);
      tableBody.append(row);
    });

    const totalUnits = products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0);
    const lowStockCount = products.filter((product) => (Number(product.stock) || 0) <= (Number(product.minStock) || 0)).length;
    const inventoryValue = products.reduce((sum, product) => sum + (Number(product.cost) || 0) * (Number(product.stock) || 0), 0);
    document.getElementById("stat-products").textContent = products.length.toLocaleString("es-CR");
    document.getElementById("stat-units").textContent = totalUnits.toLocaleString("es-CR");
    document.getElementById("stat-low-stock").textContent = lowStockCount.toLocaleString("es-CR");
    document.getElementById("stat-value").textContent = formatCurrency(inventoryValue);
    document.getElementById("product-count").textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
    document.getElementById("results-label").textContent = `Mostrando ${filtered.length} de ${products.length} ${products.length === 1 ? "producto" : "productos"}`;
    emptyState.hidden = filtered.length > 0;
    tableBody.closest("table").hidden = filtered.length === 0;
    if (products.length > 0 && filtered.length === 0) {
      document.getElementById("empty-title").textContent = "No se encontraron productos";
      document.getElementById("empty-description").textContent = "Prueba con otra búsqueda o cambia los filtros seleccionados.";
      document.getElementById("empty-add-button").hidden = true;
    } else {
      document.getElementById("empty-title").textContent = "Tu inventario está listo";
      document.getElementById("empty-description").textContent = "Agrega tu primer producto para comenzar a controlar las existencias.";
      document.getElementById("empty-add-button").hidden = false;
    }
  }

  function openDialog(product) {
    form.reset();
    document.getElementById("form-error").hidden = true;
    document.getElementById("dialog-title").textContent = product ? "Editar producto" : "Agregar producto";
    document.getElementById("save-button").textContent = product ? "Guardar cambios" : "Guardar producto";
    document.getElementById("product-id").value = product ? product.id : "";
    if (product) {
      for (const [key, value] of Object.entries(product)) {
        const field = form.elements.namedItem(key);
        if (field && key !== "id") field.value = value ?? "";
      }
    } else {
      form.elements.namedItem("stock").value = "0";
      form.elements.namedItem("minStock").value = "2";
    }
    dialog.showModal();
    form.elements.namedItem("name").focus();
  }

  function deleteProduct(product) {
    if (!window.confirm(`¿Eliminar "${product.name}" del inventario? Esta acción no se puede deshacer.`)) return;
    const nextProducts = products.filter((item) => item.id !== product.id);
    if (saveProducts(nextProducts)) {
      render();
      showToast("Producto eliminado.");
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3500);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    if (products.length === 0) {
      showToast("Agrega productos antes de exportar el inventario.");
      return;
    }
    const headers = ["Código", "Producto", "Categoría", "Marca", "Modelo", "Existencias", "Stock mínimo", "Precio de venta (CRC)", "Costo unitario (CRC)", "Ubicación", "Notas"];
    const rows = products.map((product) => [
      product.sku, product.name, product.category, product.brand, product.model, product.stock,
      product.minStock, product.price, product.cost, product.location, product.notes,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventario-coopasa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Inventario exportado a CSV.");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const id = String(data.get("id") || "");
    const sku = String(data.get("sku") || "").trim();
    const duplicateSku = sku && products.some((product) => product.sku.toLocaleLowerCase("es") === sku.toLocaleLowerCase("es") && product.id !== id);
    const errorElement = document.getElementById("form-error");
    if (duplicateSku) {
      errorElement.textContent = "Ese código ya está asignado a otro producto.";
      errorElement.hidden = false;
      form.elements.namedItem("sku").focus();
      return;
    }
    const product = {
      id: id || (window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name: String(data.get("name") || "").trim(),
      category: String(data.get("category") || ""),
      sku,
      brand: String(data.get("brand") || "").trim(),
      model: String(data.get("model") || "").trim(),
      stock: Number(data.get("stock")),
      minStock: Number(data.get("minStock") || 0),
      price: Number(data.get("price")),
      cost: Number(data.get("cost") || 0),
      location: String(data.get("location") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
    };
    const nextProducts = id
      ? products.map((item) => item.id === id ? product : item)
      : [...products, product];
    if (saveProducts(nextProducts)) {
      dialog.close();
      render();
      showToast(id ? "Cambios guardados." : "Producto agregado al inventario.");
    }
  });

  document.getElementById("add-product-button").addEventListener("click", () => openDialog());
  document.getElementById("empty-add-button").addEventListener("click", () => openDialog());
  document.getElementById("close-dialog-button").addEventListener("click", () => dialog.close());
  document.getElementById("cancel-button").addEventListener("click", () => dialog.close());
  document.getElementById("export-button").addEventListener("click", exportCsv);
  searchInput.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  stockFilter.addEventListener("change", render);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  render();
})();