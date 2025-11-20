import { useEffect, useState, useMemo } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, "");
  return base + path;
}

export default function App() {
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [newLocationName, setNewLocationName] = useState("");

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [search, setSearch] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newItemBarcode, setNewItemBarcode] = useState("");
  const [newItemQty, setNewItemQty] = useState("");

  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  // LOAD LOCATIONS
  useEffect(() => {
    async function loadLocations() {
      setLoadingLocations(true);
      setLocationError("");

      try {
        const res = await fetch(apiUrl("/locations"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setLocations(data || []);

        if (data && data.length > 0 && !selectedLocationId) {
          setSelectedLocationId(data[0].id);
        }
      } catch (err) {
        console.error(err);
        setLocationError("Failed to load locations");
      } finally {
        setLoadingLocations(false);
      }
    }

    if (!API_BASE) {
      setLocationError("⚠️ VITE_API_BASE_URL missing");
      setLoadingLocations(false);
      return;
    }

    loadLocations();
  }, []);

  // LOAD ITEMS
  useEffect(() => {
    if (!selectedLocationId) return;

    async function loadItems() {
      setLoadingItems(true);
      setItemsError("");

      try {
        const params = new URLSearchParams({
          location_id: String(selectedLocationId),
        });
        if (search.trim()) params.set("query", search.trim());

        const res = await fetch(apiUrl(`/inventory?${params.toString()}`));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setItems(data || []);
      } catch (err) {
        console.error(err);
        setItemsError("Failed to load inventory");
      } finally {
        setLoadingItems(false);
      }
    }

    loadItems();
  }, [selectedLocationId, search]);

  // ADD LOCATION
  async function handleAddLocation(e) {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    try {
      const res = await fetch(apiUrl("/locations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const created = await res.json();

      setLocations((prev) => [...prev, created]);
      setNewLocationName("");
    } catch (err) {
      console.error(err);
      alert("Failed to add location");
    }
  }

  // ADD ITEM
  async function handleAddItem(e) {
    e.preventDefault();
    if (!selectedLocationId) return;
    if (!newItemName.trim()) return;

    const qty =
      newItemQty === ""
        ? 0
        : Number.isNaN(Number(newItemQty))
        ? 0
        : Number(newItemQty);

    try {
      const res = await fetch(apiUrl("/items"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: newItemName.trim(),
          quantity: qty,
          barcode: newItemBarcode.trim() || null,
          location_id: selectedLocationId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const created = await res.json();

      setItems((prev) =>
        [...prev, created].sort((a, b) =>
          a.item_name.localeCompare(b.item_name)
        )
      );

      setNewItemName("");
      setNewItemBarcode("");
      setNewItemQty("");
    } catch (err) {
      console.error(err);
      alert("Failed to add item");
    }
  }

  // ADJUST QUANTITY
  async function adjustItemQuantity(itemId, delta) {
    if (!selectedLocationId || !delta) return;

    try {
      const res = await fetch(apiUrl("/inventory/adjust"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: selectedLocationId,
          items: [{ id: itemId, delta }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const updatedRows = data.updated || [];

      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, { ...i }]));
        updatedRows.forEach((u) => {
          if (map.has(u.id)) map.set(u.id, u);
        });
        return [...map.values()].sort((a, b) =>
          a.item_name.localeCompare(b.item_name)
        );
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update quantity");
    }
  }

  // SAVE EDIT (FIX 2 — includes quantity)
  async function saveItemEdit(itemId, newName, newBarcode, newQty) {
    try {
      const res = await fetch(apiUrl(`/items/${itemId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: newName.trim(),
          barcode: newBarcode.trim() || null,
          quantity:
            newQty === "" || Number.isNaN(Number(newQty))
              ? null
              : Number(newQty),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const updated = await res.json();

      setItems((prev) =>
        prev
          .map((i) => (i.id === updated.id ? updated : i))
          .sort((a, b) => a.item_name.localeCompare(b.item_name))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to save item");
    }
  }

  // GLOBAL SEARCH (FIX 1 — show location_name)
  async function handleGlobalSearch(e) {
    e.preventDefault();
    if (!globalQuery.trim()) return;

    setGlobalLoading(true);
    setGlobalResults([]);
    setGlobalError("");

    try {
      const params = new URLSearchParams({ q: globalQuery.trim() });
      const res = await fetch(apiUrl(`/search?${params.toString()}`));

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const results = await res.json();

      const map = Object.fromEntries(
        locations.map((l) => [l.id, l.name])
      );

      const enhanced = results.map((r) => ({
        ...r,
        location_name: map[r.location_id] || `Unknown (${r.location_id})`,
      }));

      setGlobalResults(enhanced);
    } catch (err) {
      console.error(err);
      setGlobalError("Search failed.");
    } finally {
      setGlobalLoading(false);
    }
  }
    return (
    <>
      <style>{`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          background: #f5f5f5;
        }
        .app-root {
          min-height: 100vh;
          padding: 16px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 16px;
          gap: 8px;
        }
        .header-title {
          margin: 0;
          font-size: 22px;
        }
        .api-hint {
          font-size: 11px;
          opacity: 0.7;
          word-break: break-all;
        }
        .layout {
          display: flex;
          gap: 16px;
        }
        .sidebar {
          width: 230px;
          flex-shrink: 0;
        }
        .main {
          flex: 1;
        }
        .card {
          background: #fff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .section-title {
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .location-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        .location-btn {
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid #d0d0d0;
          background: #fff;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
        }
        .location-btn.active {
          background: #0077ff;
          color: #fff;
          border-color: #0077ff;
        }
        .input {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #ccc;
          font-size: 14px;
        }
        .btn-primary {
          background: #0077ff;
          color: #fff;
          padding: 8px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-secondary {
          background: #eee;
          padding: 8px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-qty {
          padding: 5px 9px;
          border-radius: 4px;
          border: none;
          background: #eee;
          margin-right: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        table.inventory-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        table.inventory-table th,
        table.inventory-table td {
          padding: 8px;
          border-bottom: 1px solid #e5e5e5;
          text-align: left;
        }
        table.inventory-table th {
          border-bottom-width: 2px;
        }
        .empty-row {
          text-align: center;
          padding: 18px 0;
          color: #777;
        }
        .main-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .flex-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .w-100 {
          width: 100%;
        }

        /* Mobile card layout */
        .item-card-list {
          display: none;
        }
        .item-card {
          border-radius: 8px;
          border: 1px solid #e1e1e1;
          padding: 10px;
          margin-bottom: 8px;
          background: #fafafa;
        }
        .item-card-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .item-name {
          font-weight: 600;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .layout {
            flex-direction: column;
          }
          .sidebar {
            display: none;
          }
          .header {
            flex-direction: column;
            align-items: flex-start;
          }
          .desktop-table {
            display: none;
          }
          .item-card-list {
            display: block;
          }
        }
      `}</style>

      <div className="app-root">
        <header className="header">
          <h1 className="header-title">Locofly Inventory</h1>
          <span className="api-hint">
            API: <code>{API_BASE || "⚠️ Not Set"}</code>
          </span>
        </header>

        <div className="layout">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="card">
              <h2 className="section-title">📍 Locations</h2>

              {loadingLocations && <p>Loading…</p>}
              {locationError && <p style={{ color: "#d11" }}>{locationError}</p>}

              <div className="location-list">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    className={
                      "location-btn" +
                      (loc.id === selectedLocationId ? " active" : "")
                    }
                    onClick={() => setSelectedLocationId(loc.id)}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddLocation}>
                <input
                  className="input w-100"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Location name"
                  style={{ marginBottom: 8 }}
                />
                <button className="btn-primary w-100" type="submit">
                  + Add Location
                </button>
              </form>
            </div>
          </aside>

          {/* MAIN PANEL */}
          <main className="main">
            {/* Mobile location picker */}
            <div className="card mobile-location-picker">
              <label style={{ fontSize: 13, marginBottom: 4, display: "block" }}>
                📍 Location
              </label>

              <select
                className="input w-100"
                value={selectedLocationId || ""}
                onChange={(e) => setSelectedLocationId(Number(e.target.value))}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* INVENTORY */}
            <section className="card">
              <div className="main-header">
                <h2 className="section-title">
                  🧺 Inventory {selectedLocation ? `– ${selectedLocation.name}` : ""}
                </h2>

                <input
                  className="input"
                  placeholder="Search items"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minWidth: 220 }}
                />
              </div>

              {itemsError && <p className="error-text">{itemsError}</p>}
              {loadingItems && <p>Loading items...</p>}

              {/* Desktop table */}
              <div className="desktop-table">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Barcode</th>
                      <th>Qty</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onAdjust={adjustItemQuantity}
                        onSave={saveItemEdit}
                      />
                    ))}

                    {items.length === 0 && !loadingItems && (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          No items for this location.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="item-card-list">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onAdjust={adjustItemQuantity}
                    onSave={saveItemEdit}
                  />
                ))}
              </div>
            </section>

            {/* ADD ITEM */}
            <section className="card">
              <h3 className="section-title">Add Item</h3>

              <form onSubmit={handleAddItem} className="flex-wrap">
                <input
                  className="input"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Barcode (optional)"
                  value={newItemBarcode}
                  onChange={(e) => setNewItemBarcode(e.target.value)}
                />

                <input
                  className="input"
                  type="number"
                  placeholder="Qty"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  style={{ maxWidth: 100 }}
                />

                <button className="btn-primary" type="submit">
                  Add
                </button>
              </form>
            </section>

            {/* GLOBAL SEARCH */}
            <section className="card">
              <h3 className="section-title">🔎 Global Search</h3>

              <form onSubmit={handleGlobalSearch} className="flex-wrap">
                <input
                  className="input"
                  placeholder="Search full 20k SKU catalogue"
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                />
                <button className="btn-secondary" type="submit">
                  Search
                </button>
              </form>

              {globalLoading && <p>Searching...</p>}
              {globalError && <p className="error-text">{globalError}</p>}

              {globalResults.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    maxHeight: 240,
                    overflowY: "auto",
                    fontSize: 13,
                  }}
                >
                  {globalResults.map((r) => (
                    <div key={r.id} className="item-card">
                      <div className="item-card-header">
                        <span className="item-name">{r.item_name}</span>
                        <span className="item-meta">
                          {r.location_name} • qty {r.quantity}
                        </span>
                      </div>

                      <div className="item-meta">
                        Barcode: {r.barcode || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
/* -------------------------------------------
   ITEM ROW — Desktop table
--------------------------------------------*/
function ItemRow({ item, onAdjust, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [tempName, setTempName] = useState(item.item_name);
  const [tempBarcode, setTempBarcode] = useState(item.barcode || "");
  const [tempQty, setTempQty] = useState(String(item.quantity));

  function save() {
    onSave(item.id, tempName, tempBarcode, tempQty);
    setEditMode(false);
  }

  function cancel() {
    setEditMode(false);
    setTempName(item.item_name);
    setTempBarcode(item.barcode || "");
    setTempQty(String(item.quantity));
  }

  return (
    <tr>
      <td>
        {editMode ? (
          <input
            className="input w-100"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
          />
        ) : (
          item.item_name
        )}
      </td>

      <td>
        {editMode ? (
          <input
            className="input w-100"
            value={tempBarcode}
            onChange={(e) => setTempBarcode(e.target.value)}
          />
        ) : (
          item.barcode || "—"
        )}
      </td>

      <td>
        {editMode ? (
          <input
            className="input"
            type="number"
            style={{ maxWidth: 80 }}
            value={tempQty}
            onChange={(e) => setTempQty(e.target.value)}
          />
        ) : (
          item.quantity
        )}
      </td>

      <td>{new Date(item.updated_at).toLocaleString()}</td>

      <td>
        {!editMode ? (
          <>
            <button className="btn-qty" onClick={() => onAdjust(item.id, +1)}>
              +1
            </button>
            <button className="btn-qty" onClick={() => onAdjust(item.id, -1)}>
              -1
            </button>
            <button className="btn-secondary" onClick={() => setEditMode(true)}>
              Edit
            </button>
          </>
        ) : (
          <>
            <button className="btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

/* -------------------------------------------
   ITEM CARD — Mobile view
--------------------------------------------*/
function ItemCard({ item, onAdjust, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [tempName, setTempName] = useState(item.item_name);
  const [tempBarcode, setTempBarcode] = useState(item.barcode || "");
  const [tempQty, setTempQty] = useState(String(item.quantity));

  function save() {
    onSave(item.id, tempName, tempBarcode, tempQty);
    setEditMode(false);
  }

  function cancel() {
    setEditMode(false);
    setTempName(item.item_name);
    setTempBarcode(item.barcode || "");
    setTempQty(String(item.quantity));
  }

  return (
    <div className="item-card">
      {!editMode ? (
        <>
          <div className="item-card-header">
            <span className="item-name">{item.item_name}</span>
            <span className="item-meta">Qty {item.quantity}</span>
          </div>

          <div className="item-meta">Barcode: {item.barcode || "—"}</div>
          <div className="item-meta">
            Updated: {new Date(item.updated_at).toLocaleString()}
          </div>

          <div className="item-card-footer">
            <button className="btn-qty" onClick={() => onAdjust(item.id, +1)}>
              +1
            </button>
            <button className="btn-qty" onClick={() => onAdjust(item.id, -1)}>
              -1
            </button>
            <button className="btn-secondary" onClick={() => setEditMode(true)}>
              Edit
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="input w-100"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            style={{ marginBottom: 6 }}
          />

          <input
            className="input w-100"
            value={tempBarcode}
            onChange={(e) => setTempBarcode(e.target.value)}
            placeholder="Barcode"
            style={{ marginBottom: 6 }}
          />

          <input
            className="input w-100"
            type="number"
            value={tempQty}
            onChange={(e) => setTempQty(e.target.value)}
            placeholder="Qty"
            style={{ marginBottom: 6 }}
          />

          <button className="btn-primary" onClick={save} style={{ marginRight: 6 }}>
            Save
          </button>
          <button className="btn-secondary" onClick={cancel}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
