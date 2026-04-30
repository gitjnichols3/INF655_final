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
  const albumsQuery = query(
    collection(db, "albums"),
    where("userId", "==", user.uid)
  );

  const albumsSnapshot = await getDocs(albumsQuery);

  const albumData = albumsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const photosQuery = query(
    collection(db, "photos"),
    where("userId", "==", user.uid)
  );

  const photosSnapshot = await getDocs(photosQuery);

  const photos = photosSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const albumsWithPhotoData = albumData.map((album) => {
    const albumPhotos = photos.filter((photo) => photo.albumId === album.id);

    const photoDates = albumPhotos
      .map((photo) => photo.takenAt || photo.uploadedAt || photo.createdAt)
      .filter(Boolean)
      .map((date) => date.toDate ? date.toDate() : new Date(date))
      .filter((date) => !isNaN(date));

    const earliestDate =
      photoDates.length > 0
        ? new Date(Math.min(...photoDates.map((date) => date.getTime())))
        : null;

    return {
      ...album,
      photoCount: albumPhotos.length,
      albumDate: earliestDate
    };
  });

  albumsWithPhotoData.sort((a, b) => {
    if (!a.albumDate && !b.albumDate) return 0;
    if (!a.albumDate) return 1;
    if (!b.albumDate) return -1;
    return b.albumDate - a.albumDate;
  });

  setAlbums(albumsWithPhotoData);
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

  const formatDate = (d) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);

 return (
  <section className="dashboard-page">
    <h1>Dashboard</h1>

    <div className="dashboard-layout">
      
      {/* LEFT: Albums */}
      <div className="dashboard-main">
        <h2>Your Albums</h2>

        {albums.length === 0 ? (
            <div className="empty-state">
              <p>No albums yet.</p>
              <p>Create your first album to get started.</p>
            </div>
        ) : (
          <div className="album-grid">
            {albums.map((album) => (
              <article key={album.id} className="album-card">
                <h3>
                  {album.title} {album.isShared && <span>🔗</span>}
                </h3>

                <p>{album.description}</p>

                <div className="album-meta">
                  <span>
                    📸 {album.photoCount} {album.photoCount === 1 ? "photo" : "photos"}
                  </span>

                  

                  {album.albumDate && (
                    <span>📅 {formatDate(album.albumDate)}</span>
                  )}
                </div>

                <Link to={`/album/${album.id}`}>
                  View Album
                </Link>

                <div className="album-actions">
                  <button onClick={() => handleEdit(album)}>Edit</button>
                  <button onClick={() => handleDelete(album.id)}>Delete</button>
                  <button onClick={() => handleToggleShare(album)}>
                    {album.isShared ? "Disable Sharing" : "Enable Sharing"}
                  </button>
                </div>

                {album.isShared && (
                  <div className="share-box">
                    <a
                      href={`${window.location.origin}/share/${album.shareSlug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Shared Album
                    </a>

                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/share/${album.shareSlug}`
                        )
                      }
                    >
                      Copy Link
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Form */}
      <aside className="dashboard-aside">
        <form className="album-form" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit Album" : "Create Album"}</h2>

          <input
            type="text"
            placeholder="Album title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <button type="submit" className="primary-button">
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
              Cancel
            </button>
          )}
        </form>
      </aside>

    </div>
  </section>
);
}

export default Dashboard;