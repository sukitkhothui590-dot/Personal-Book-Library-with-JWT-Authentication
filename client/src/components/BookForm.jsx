import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const fallbackCover = "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg";
const categories = ["Fiction", "Science fiction", "Fantasy", "Mystery & thriller", "Romance", "Biography", "History", "Self development", "Business", "Creativity", "Technology", "Other"];
const emptyForm = { isbn: "", title: "", author: "", category: "Fiction", coverUrl: "", status: "Want to read", rating: 0 };

export function BookForm({ onClose, onSaved, onUnauthorized }) {
  const titleRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [coverState, setCoverState] = useState("idle");
  useEffect(() => titleRef.current?.focus(), []);

  function change(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "", form: "" }));
    if (name === "coverUrl") setCoverState(value ? "loading" : "idle");
  }

  async function lookupIsbn() {
    const isbn = form.isbn.replace(/[^0-9Xx]/g, "");
    if (![10, 13].includes(isbn.length)) return setErrors((current) => ({ ...current, isbn: "Enter a valid 10 or 13 character ISBN." }));
    setLookingUp(true); setErrors((current) => ({ ...current, isbn: "", form: "" }));
    try {
      const response = await fetch(`${API}/isbn/${isbn}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const category = categories.includes(payload.data.category) ? payload.data.category : "Other";
      setForm((current) => ({ ...current, ...payload.data, category }));
      setCoverState("loading");
      titleRef.current?.focus();
    } catch (error) {
      setErrors((current) => ({ ...current, isbn: error.message || "Could not find this ISBN." }));
    } finally { setLookingUp(false); }
  }

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = "Please enter a book title.";
    if (!form.author.trim()) next.author = "Please enter the author's name.";
    if (form.coverUrl && !/^https?:\/\//.test(form.coverUrl)) next.coverUrl = "Use a URL starting with http:// or https://.";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("library_token");
      const response = await fetch(`${API}/books`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      if (response.status === 401) return onUnauthorized();
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      onSaved(payload.data);
      setForm(emptyForm);
      setErrors({});
      setCoverState("idle");
      setTimeout(() => titleRef.current?.focus(), 0);
    } catch (error) { setErrors({ form: error.message || "Could not add this book." }); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop"><section className="modal"><button className="icon-button close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">NEW TITLE</p><h2>Add a book</h2><form onSubmit={submit} className="book-form"><label>ISBN <span className="optional">(optional)</span><div className="inline-field"><input value={form.isbn} onChange={(event) => change("isbn", event.target.value)} placeholder="9780441172719" /><button type="button" className="secondary" disabled={lookingUp} onClick={lookupIsbn}>{lookingUp ? "Looking up…" : "Auto-fill"}</button></div></label>{errors.isbn && <p className="field-error">{errors.isbn}</p>}<label>Book title<input ref={titleRef} value={form.title} onChange={(event) => change("title", event.target.value)} /></label>{errors.title && <p className="field-error">{errors.title}</p>}<label>Author<input value={form.author} onChange={(event) => change("author", event.target.value)} /></label>{errors.author && <p className="field-error">{errors.author}</p>}<div className="form-row"><label>Category<select value={form.category} onChange={(event) => change("category", event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Status<select value={form.status} onChange={(event) => change("status", event.target.value)}><option>Want to read</option><option>Reading</option><option>Completed</option></select></label></div><label>Rating<select value={form.rating} onChange={(event) => change("rating", Number(event.target.value))}>{[0,1,2,3,4,5].map((value) => <option key={value} value={value}>{value ? "★".repeat(value) : "Not rated"}</option>)}</select></label><label>Cover image URL <span className="optional">(optional)</span><input type="url" value={form.coverUrl} onChange={(event) => change("coverUrl", event.target.value)} /></label>{errors.coverUrl && <p className="field-error">{errors.coverUrl}</p>}<div className="cover-check"><img className="cover-preview" src={form.coverUrl || fallbackCover} alt="Book cover preview" onLoad={() => setCoverState(form.coverUrl ? "valid" : "fallback")} onError={(event) => { event.currentTarget.src = fallbackCover; setCoverState("invalid"); }} /><p className={`cover-message ${coverState}`}>{coverState === "invalid" ? "Cover could not be loaded. A fallback will be used." : coverState === "valid" ? "Cover image is ready." : form.coverUrl ? "Checking cover…" : "Add a cover URL or use ISBN auto-fill."}</p></div>{errors.form && <p className="error">{errors.form}</p>}<div className="detail-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Adding…" : "Add to library"}</button></div></form></section></div>;
}
