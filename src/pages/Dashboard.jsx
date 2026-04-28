import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db, storage } from "../firebase/firebase";
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

import { ref, deleteObject } from "firebase/storage";

function Dashboard() {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [albums, setAlbums] = useState([]);
  const [editingId, setEditingId] = useState(null);

async function handleToggleShare(album) {
  const slug = album.shareSlug || crypto.randomUUID();

  await updateDoc(doc(db, "albums", album.id), {
    isShared: !album.isShared,
    shareSlug: slug
  });

  loadAlbums();
}

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
  isShared: false,
  shareSlug: crypto.randomUUID(),
  createdAt: serverTimestamp()
});
    }

    setTitle("");
    setDescription("");
    loadAlbums();
  }

  async function handleDelete(id) {
    const confirmDelete = confirm(
      "Are you sure you want to delete this album and all of its photos?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", id)
      );

      const photosSnapshot = await getDocs(photosQuery);

      const deletePhotoPromises = photosSnapshot.docs.map(async (photoDoc) => {
        const photo = photoDoc.data();

        await Promise.all([
          photo.originalPath
            ? deleteObject(ref(storage, photo.originalPath)).catch(() => {})
            : Promise.resolve(),

          photo.thumbnailPath
            ? deleteObject(ref(storage, photo.thumbnailPath)).catch(() => {})
            : Promise.resolve(),

          photo.mediumPath
            ? deleteObject(ref(storage, photo.mediumPath)).catch(() => {})
            : Promise.resolve()
        ]);

        await deleteDoc(doc(db, "photos", photoDoc.id));
      });

      await Promise.all(deletePhotoPromises);

      await deleteDoc(doc(db, "albums", id));

      loadAlbums();
    } catch (err) {
      console.error(err);
      alert("Album delete failed");
    }
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
              <h3>
                {album.title} {album.isShared && <span>🔗</span>}
              </h3>
              <p>{album.description}</p>

              <Link to={`/album/${album.id}`}>View Album</Link>

              <button onClick={() => handleDelete(album.id)}>
                Delete
              </button>

              <button onClick={() => handleEdit(album)}>
                Edit
              </button>

              <button onClick={() => handleToggleShare(album)}>
  {album.isShared ? "Disable Sharing" : "Enable Sharing"}
</button>

{album.isShared && (
  <div>
    <p>
      Share URL:{" "}
      <a
        href={`${window.location.origin}/share/${album.shareSlug}`}
        target="_blank"
        rel="noreferrer"
      >
        {window.location.origin}/share/{album.shareSlug}
      </a>
    </p>

    <button
      onClick={() => {
        navigator.clipboard.writeText(
          `${window.location.origin}/share/${album.shareSlug}`
        );
      }}
    >
      Copy Link
    </button>
  </div>
)}


            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Dashboard;