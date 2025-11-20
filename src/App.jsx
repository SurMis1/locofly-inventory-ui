import { useEffect, useState, useMemo } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Build correct API endpoint safely
function apiUrl(path) {
  const base = (API_BASE || "").replace(/\/$/, "");
  return base + path;
}

export default function App() {
  // ----- Locations -----
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [newLocationName, setNewLocationName] = useState("");

  // ----- Inventory -----
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [search, setSearch] = useState("");

  // ----- New item form -----
  const [newItemName, setNewItemName] = useState("");
  const [newItemBarcode, setNewItemBarcode] = useState("");
  const [newItemQty, setNewItemQty] = useState("");

  // ----- Global search -----
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  // ================================
  // LOAD LOCATIONS ON FIRST MOUNT
  // ================================
  useEffect(() => {
    async function loadLocations() {
      setLoadingLocations(true);
      setLocationError("");

      try {
        const res = await fetch(apiUrl("/locations"));
        if (!res.ok) throw new Error("Bad response");
        const data = await res.json();

        setLocations(data || []);

        if (data.length > 0 && !selectedLocationId) {
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
    // ====================================
  // LOAD INVENTORY WHEN LOCATION CHANGES
  // ====================================
  useEffect(() => {
    if (!selectedLocationId) return;

    async function loadItems() {
      setLoadingItems(true);
      setItemsError("");

      try {
        const params = new URLSearchParams({
          location_id: String(selectedLocationId),
        });

        if (search.trim()) {
          params.set("query", search.trim());
        }

        const res = await fetch(apiUrl(`/inventory?${params.toString()}`));
        if (!res.ok) throw new Error("Bad response");

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

  // ===========================
  // ADD NEW LOCATION
  // ===========================
  async function handleAddLocation(e) {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    try {
      const res = await fetch(apiUrl("/locations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocationName.trim() }),
      });

      if (!res.ok) throw new Error("Bad response");

      const created = await res.json();
      setLocations((p) => [...p, created]);
      setNewLocationName("");

      if (!selectedLocationId) {
        setSelectedLocationId(created.id);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add location");
    }
  }

  // ===========================
  // ADD NEW ITEM
  // ===========================
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

      if (!res.ok) throw new Error("Bad response");

      const created = await res.json();

      setItems((p) =>
        [...p, created].sort((a, b) =>
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
    // =====================================
  // ADJUST QUANTITY (/inventory/adjust)
  // =====================================
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

      if (!res.ok) throw new Error("Bad response");

      const data = await res.json();
      const updatedRows = data.updated || [];

      // Replace updated rows in existing list
      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, { ...i }]));
        for (const u of updatedRows) {
          if (map.has(u.id)) map.set(u.id, u);
        }
        return [...map.values()].sort((a, b) =>
          a.item_name.localeCompare(b.item_name)
        );
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update quantity");
    }
  }

  // ===========================================
  // SAVE/EDIT ITEM (name + barcode)
  // PUT /items/:id
  // ===========================================
  async function saveItemEdit(itemId, newName, newBarcode) {
    try {
      const res = await fetch(apiUrl(`/items/${itemId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: newName.trim() || null,
          barcode: newBarcode.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Bad response");

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

  // ===========================================
  // GLOBAL SEARCH (/search?q=)
  // ===========================================
  async function handleGlobalSearch(e) {
    e.preventDefault();
    if (!globalQuery.trim()) return;

    setGlobalLoading(true);
    setGlobalResults([]);
    setGlobalError("");

    try {
      const params = new URLSearchParams({ q: globalQuery.trim() });

      const res = await fetch(apiUrl(`/search?${params.toString()}`));
      if (!res.ok) throw new Error("Bad response");

      const results = await res.json();
      setGlobalResults(results || []);
    } catch (err) {
      console.error(err);
      setGlobalError("Search failed. Try again.");
    } finally {
      setGlobalLoading(false);
    }
  }

  // ===========================================
  // ITEM ROW COMPONENT
  // ===========================================
  function ItemRow({ item, onAdjust, onSave }) {
    const [editMode, setEditMode] = useState(false);
    const [tempName, setTempName] = useState(item.item_name);
    const [tempBarcode, setTempBarcode] = useState(item.barcode || "");

    function save() {
      onSave(item.id, tempName, tempBarcode);
      setEditMode(false);
    }

    return (
      <tr>
        <td style={styles.td}>
          {editMode ? (
            <input
              style={styles.input}
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
            />
          ) : (
            item.item_name
          )}
        </td>

        <td style={styles.td}>
          {editMode ? (
            <input
              style={styles.input}
              value={tempBarcode}
              onChange={(e) => setTempBarcode(e.target.value)}
            />
          ) : (
            item.barcode || "—"
          )}
        </td>

        <td style={styles.td}>{item.quantity}</td>

        <td style={styles.td}>
          {new Date(item.updated_at).toLocaleString()}
        </td>

        <td style={styles.td}>
          {!editMode ? (
            <>
              <button style={styles.qtyBtn} onClick={() => onAdjust(item.id, +1)}>
                +1
              </button>
              <button style={styles.qtyBtn} onClick={() => onAdjust(item.id, -1)}>
                -1
              </button>
              <button style={styles.secondaryButton} onClick={() => setEditMode(true)}>
                Edit
              </button>
            </>
          ) : (
            <>
              <button style={styles.primaryButton} onClick={save}>
                Save
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setEditMode(false);
                  setTempName(item.item_name);
                  setTempBarcode(item.barcode || "");
                }}
              >
                Cancel
              </button>
            </>
          )}
        </td>
      </tr>
    );
  }

  // ===========================================
  // FINAL RENDER
  // ===========================================
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Locofly Inventory</h1>
        <span style={styles.apiHint}>
          API: <code>{API_BASE || "⚠️ Not Set"}</code>
        </span>
      </header>

      <div style={styles.layout}>
        {/* SIDEBAR: LOCATIONS */}
        <aside style={styles.sidebar}>
          <h2 style={styles.sectionTitle}>📍 Locations</h2>

          {loadingLocations && <p>Loading...</p>}
          {locationError && <p style={styles.error}>{locationError}</p>}

          <div style={styles.locationList}>
            {locations.map((loc) => (
              <button
                key={loc.id}
                style={{
                  ...styles.locationButton,
                  ...(loc.id === selectedLocationId
                    ? styles.locationButtonActive
                    : {}),
                }}
                onClick={() => setSelectedLocationId(loc.id)}
              >
                {loc.name}
              </button>
            ))}
          </div>

          {/* Add Location */}
          <form onSubmit={handleAddLocation} style={styles.card}>
            <h3 style={styles.cardTitle}>Add Location</h3>
            <input
              style={styles.input}
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="Location name"
            />
            <button style={styles.primaryButton}>+ Add</button>
          </form>
        </aside>

        {/* MAIN PANEL */}
        <main style={styles.main}>
          {/* -------- INVENTORY -------- */}
          <section style={styles.card}>
            <div style={styles.mainHeader}>
              <h2 style={styles.sectionTitle}>
                🧺 Inventory {selectedLocation && `– ${selectedLocation.name}`}
              </h2>

              <input
                style={{ ...styles.input, width: "260px" }}
                placeholder="Search items"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loadingItems && <p>Loading...</p>}
            {itemsError && <p style={styles.error}>{itemsError}</p>}

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>Barcode</th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Updated</th>
                  <th style={styles.th}>Actions</th>
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
                    <td colSpan={5} style={styles.emptyRow}>
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* -------- ADD ITEM -------- */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Add Item</h3>

            <form
              onSubmit={handleAddItem}
              style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
            >
              <input
                style={{ ...styles.input, width: "200px" }}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name"
              />
              <input
                style={{ ...styles.input, width: "160px" }}
                value={newItemBarcode}
                onChange={(e) => setNewItemBarcode(e.target.value)}
                placeholder="Barcode"
              />
              <input
                type="number"
                style={{ ...styles.input, width: "80px" }}
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qty"
              />
              <button style={styles.primaryButton}>Add</button>
            </form>
          </section>

          {/* -------- GLOBAL SEARCH -------- */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>🔎 Global Search</h3>

            <form
              onSubmit={handleGlobalSearch}
              style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
            >
              <input
                style={{ ...styles.input, flex: "1 1 260px" }}
                placeholder="Search all items"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              <button style={styles.secondaryButton}>Search</button>
            </form>

            {globalLoading && <p>Searching...</p>}
            {globalError && <p style={styles.error}>{globalError}</p>}

            {globalResults.length > 0 && (
              <div style={{ marginTop: "10px", maxHeight: "220px", overflowY: "auto" }}>
                {globalResults.map((r) => (
                  <div key={r.id} style={styles.searchResult}>
                    <strong>{r.item_name}</strong> — qty {r.quantity} (loc {r.location_id})
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

// =========================================
// STYLES
// =========================================
const styles = {
  app: {
    fontFamily: "Arial, sans-serif",
    background: "#f5f5f5",
    minHeight: "100vh",
    padding: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  apiHint: {
    fontSize: "12px",
    opacity: 0.7,
  },
  layout: {
    display: "flex",
    gap: "20px",
  },
  sidebar: {
    width: "240px",
  },
  sectionTitle: {
    marginBottom: "10px",
  },
  locationList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  locationButton: {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  locationButtonActive: {
    background: "#0077ff",
    color: "#fff",
  },
  main: {
    flex: 1,
  },
  card: {
    background: "#fff",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardTitle: { marginBottom: "12px" },
  input: {
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "6px",
  },
  primaryButton: {
    background: "#0077ff",
    color: "#fff",
    padding: "8px 16px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#eee",
    padding: "8px 16px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  qtyBtn: {
    padding: "6px 10px",
    marginRight: "6px",
    cursor: "pointer",
    background: "#eee",
    borderRadius: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "8px",
    borderBottom: "2px solid #ccc",
    textAlign: "left",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #ddd",
  },
  emptyRow: {
    textAlign: "center",
    padding: "20px",
    opacity: 0.6,
  },
  error: { color: "red" },
  searchResult: {
    background: "#f4f4f4",
    padding: "10px",
    borderRadius: "6px",
    marginBottom: "8px",
  },
};


