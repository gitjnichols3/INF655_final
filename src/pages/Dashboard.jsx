import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";
import { Link } from "react-router-dom";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

function Dashboard() {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [albums, setAlbums] = useState([]);
  const [editingId, setEditingId] = useState(null);

  async function loadAlbums() {
    const q = query(
      collection(db, "albums"),
      where("userId", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);

    const albumData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    setAlbums(albumData);
  }

async function handleSubmit(e) {
  e.preventDefault();

  if (editingId) {
    await updateDoc(doc(db, "albums", editingId), {
      title,
      description
    });

    setEditingId(null);
  } else {
    await addDoc(collection(db, "albums"), {
      title,
      description,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  }

  setTitle("");
  setDescription("");
  loadAlbums();
}

  async function handleDelete(id) {
  const confirmDelete = confirm("Are you sure you want to delete this album?");

  if (!confirmDelete) {
    return;
  }

  await deleteDoc(doc(db, "albums", id));
  loadAlbums();
}

function handleEdit(album) {
  setEditingId(album.id);
  setTitle(album.title);
  setDescription(album.description);
}

  useEffect(() => {
    if (user) {
      loadAlbums();
    }
  }, [user]);

  return (
    <section>
      <h1>Dashboard</h1>

     <form className="album-form" onSubmit={handleSubmit}>
        <h2>{editingId ? "Edit Album" : "Create Album"}</h2>

        <div>
          <label htmlFor="title">Album Title</label>
          <input
            id="title"
            type="text"
            placeholder="Album title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button type="submit">
          {editingId ? "Save Changes" : "Create Album"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setTitle("");
              setDescription("");
            }}
          >
            Cancel Edit
          </button>
        )}
      </form>

      <h2>Your Albums</h2>

      {albums.length === 0 ? (
        <p>No albums yet.</p>
      ) : (
        <div className="album-grid">
          {albums.map((album) => (
            <article key={album.id} className="album-card">
              <h3>{album.title}</h3>
              <p>{album.description}</p>
              <Link to={`/album/${album.id}`}>View Album</Link>

              <button onClick={() => handleDelete(album.id)}>
                Delete
              </button>
              <button onClick={() => handleEdit(album)}>
                Edit
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Dashboard;