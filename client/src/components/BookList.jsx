import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const fallbackCover = "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg";
const categories = [
  "Fiction", "Science fiction", "Fantasy", "Mystery & thriller", "Romance",
  "Biography", "History", "Self development", "Business", "Creativity",
  "Technology", "Other",
];

function Stars({ value = 0 }) {
  return (
    <span className={`rating ${value ? "" : "empty"}`} aria-label={`Rating ${value} out of 5`}>
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  );
}

export function BookList({ books, onRemove }) {
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openDetails(book) {
    setSelected(book);
    setForm({ ...book });
    setEditing(false);
    setError("");
  }

  async function updateBook(nextBook) {
    if (saving) return null;
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("library_token");
      const response = await fetch(`${API}/books/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nextBook),
      });
      if (response.status === 401) {
        localStorage.removeItem("library_token");
        window.location.reload();
        return null;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update this book.");
      setSelected(payload.data);
      setForm({ ...payload.data });
      return payload.data;
    } catch (err) {
      setError(err.message || "Could not update this book.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    const updated = await updateBook(form);
    if (updated) {
      setEditing(false);
      window.location.reload();
    }
  }

  async function rate(rating) {
    const updated = await updateBook({ ...selected, rating });
    if (updated) window.location.reload();
  }

  if (!books.length) {
    return (
      <div className="state empty-state">
        <h3>No books found</h3>
        <p>Start building your personal library.</p>
        <button className="primary" onClick={() => document.querySelector(".header-actions .primary")?.click()}>
          + Add a book
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="book-grid">
        {books.map((book) => (
          <article className="book-card" key={book.id}>
            <div className="cover-wrap">
              <img src={book.coverUrl || fallbackCover} alt={`Cover of ${book.title}`} onClick={() => openDetails(book)} onError={(event) => { event.currentTarget.src = fallbackCover; }} />
              <button className="delete-button" onClick={() => onRemove(book)} aria-label={`Delete ${book.title}`}>×</button>
            </div>
            <button className="book-meta book-select" onClick={() => openDetails(book)}>
              <span className={`status ${book.status.toLowerCase().replaceAll(" ", "-")}`}>{book.status}</span>
              <h3>{book.title}</h3><p>{book.author}</p><small>{book.category}</small>
              <Stars value={book.rating || 0} />
            </button>
          </article>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop">
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-label={`Details for ${selected.title}`}>
            <button className="icon-button close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            {editing ? (
              <form className="book-form" onSubmit={save}>
                <p className="eyebrow">EDIT BOOK</p><h2>Edit details</h2>
                <label>ISBN <span className="optional">(optional)</span><input value={form.isbn || ""} onChange={(event) => setForm({ ...form, isbn: event.target.value })} /></label>
                <label>Book title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label>Author<input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></label>
                <div className="form-row">
                  <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                  <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Want to read</option><option>Reading</option><option>Completed</option></select></label>
                </div>
                <label>Rating<select value={form.rating || 0} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })}>{[0,1,2,3,4,5].map((value) => <option key={value} value={value}>{value ? "★".repeat(value) : "Not rated"}</option>)}</select></label>
                <label>Cover image URL<input type="url" value={form.coverUrl || ""} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} /></label>
                {error && <p className="error">{error}</p>}
                <div className="detail-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
              </form>
            ) : (
              <div className="detail-layout">
                <img className="detail-cover" src={selected.coverUrl || fallbackCover} alt={`Cover of ${selected.title}`} onError={(event) => { event.currentTarget.src = fallbackCover; }} />
                <div className="detail-info">
                  <p className="eyebrow">{selected.category}</p>
                  <span className={`status ${selected.status.toLowerCase().replaceAll(" ", "-")}`}>{selected.status}</span>
                  <h2>{selected.title}</h2><p className="detail-author">by {selected.author}</p>
                  {selected.isbn && <p className="detail-isbn">ISBN {selected.isbn}</p>}
                  <p className="detail-updated">Last updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${selected.updatedAt || selected.createdAt}Z`))}</p>
                  <p className="rating-label">Your rating</p>
                  <div className="star-picker">{[1,2,3,4,5].map((value) => <button key={value} className="star-button" disabled={saving} onClick={() => rate(value)} aria-label={`Rate ${value} stars`}>{value <= (selected.rating || 0) ? "★" : "☆"}</button>)}</div>
                  {error && <p className="error">{error}</p>}
                  <div className="detail-actions"><button className="secondary" onClick={() => setEditing(true)}>Edit details</button><button className="danger" onClick={() => { onRemove(selected); setSelected(null); }}>Delete book</button></div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
