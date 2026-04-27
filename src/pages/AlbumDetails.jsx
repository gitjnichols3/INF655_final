import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { db, storage } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import { resizeImage } from "../services/imageUtils";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

function AlbumDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    async function loadAlbum() {
      const docRef = doc(db, "albums", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setAlbum({
          id: docSnap.id,
          ...docSnap.data()
        });
      }

      setLoading(false);
    }

    loadAlbum();
  }, [id]);

  useEffect(() => {
    loadPhotos();
  }, [id]);

async function loadPhotos() {
  const q = query(
    collection(db, "photos"),
    where("albumId", "==", id)
  );

  const querySnapshot = await getDocs(q);

  const photoData = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  setPhotos(photoData);
}

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];

    if (!file || !user) return;

    setUploading(true);

    try {
      const thumbnailBlob = await resizeImage(file, 300, 0.75);
      const mediumBlob = await resizeImage(file, 1200, 0.85);

      const safeFileName = `${Date.now()}-${file.name}`;

      const originalRef = ref(
        storage,
        `users/${user.uid}/albums/${id}/originals/${safeFileName}`
      );

      const thumbnailRef = ref(
        storage,
        `users/${user.uid}/albums/${id}/thumbnails/${safeFileName}`
      );

      const mediumRef = ref(
        storage,
        `users/${user.uid}/albums/${id}/medium/${safeFileName}`
      );

      await uploadBytes(originalRef, file);
      await uploadBytes(thumbnailRef, thumbnailBlob);
      await uploadBytes(mediumRef, mediumBlob);

      const originalUrl = await getDownloadURL(originalRef);
      const thumbnailUrl = await getDownloadURL(thumbnailRef);
      const mediumUrl = await getDownloadURL(mediumRef);

      await addDoc(collection(db, "photos"), {
        albumId: id,
        userId: user.uid,
        fileName: file.name,
        originalUrl,
        thumbnailUrl,
        mediumUrl,
        createdAt: serverTimestamp()
      });

      alert("Photo uploaded");
      e.target.value = "";
      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p>Loading album...</p>;
  }

  if (!album) {
    return (
      <section>
        <h1>Album not found</h1>
        <Link to="/dashboard">Back to Dashboard</Link>
      </section>
    );
  }

  function showNextPhoto() {
    const currentIndex = photos.findIndex(
      (photo) => photo.id === selectedPhoto.id
    );

    const nextIndex = (currentIndex + 1) % photos.length;
    setSelectedPhoto(photos[nextIndex]);
  }

  function showPreviousPhoto() {
    const currentIndex = photos.findIndex(
      (photo) => photo.id === selectedPhoto.id
    );

    const previousIndex =
      (currentIndex - 1 + photos.length) % photos.length;

    setSelectedPhoto(photos[previousIndex]);
  }

  return (
    <section>
      <Link to="/dashboard">Back to Dashboard</Link>

      <h1>{album.title}</h1>
      <p>{album.description}</p>

      <div>
        <h2>Upload Photo</h2>

        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          disabled={uploading}
        />

        {uploading && <p>Uploading photo...</p>}
      </div>

      <h2>Photos</h2>

        {photos.length === 0 ? (
          <p>No photos uploaded yet.</p>
        ) : (
          <div className="photo-grid">
            {photos.map((photo) => (
              <button
                key={photo.id}
                className="photo-thumb-button"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.fileName}
                  className="photo-thumb"
                />
              </button>
            ))}
          </div>
        )}

        {selectedPhoto && (
  <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <button
        className="modal-close"
        onClick={() => setSelectedPhoto(null)}
      >
        Close
      </button>

      {photos.length > 1 && (
        <button
          className="modal-nav modal-prev"
          onClick={showPreviousPhoto}
        >
          Previous
        </button>
      )}

      <img
        src={selectedPhoto.mediumUrl}
        alt={selectedPhoto.fileName}
        className="modal-image"
      />

      {photos.length > 1 && (
        <button
          className="modal-nav modal-next"
          onClick={showNextPhoto}
        >
          Next
        </button>
      )}
    </div>
  </div>
)}


    </section>
  );
}

export default AlbumDetails;