import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { db, storage } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import { resizeImage } from "../services/imageUtils";

import exifr from "exifr";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
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

  photoData.sort((a, b) => {
    const aDate =
      a.takenAt?.toMillis?.() ||
      a.createdAt?.toMillis?.() ||
      0;

    const bDate =
      b.takenAt?.toMillis?.() ||
      b.createdAt?.toMillis?.() ||
      0;

    return aDate - bDate;
  });

  setPhotos(photoData);
}

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);

    if (files.length === 0 || !user) return;

    setUploading(true);

    try {
      for (const file of files) {
        const isDuplicate = photos.some(
          (photo) =>
            photo.fileName === file.name &&
            photo.size === file.size
        );

        if (isDuplicate) {
          console.log("Duplicate skipped:", file.name);
          continue;
        }

        const thumbnailBlob = await resizeImage(file, 300, 0.75);
        const mediumBlob = await resizeImage(file, 1200, 0.85);

        const safeFileName = `${Date.now()}-${file.name}`;

        const originalPath = `users/${user.uid}/albums/${id}/originals/${safeFileName}`;
        const thumbnailPath = `users/${user.uid}/albums/${id}/thumbnails/${safeFileName}`;
        const mediumPath = `users/${user.uid}/albums/${id}/medium/${safeFileName}`;

        const originalRef = ref(storage, originalPath);
        const thumbnailRef = ref(storage, thumbnailPath);
        const mediumRef = ref(storage, mediumPath);

        await uploadBytes(originalRef, file);
        await uploadBytes(thumbnailRef, thumbnailBlob);
        await uploadBytes(mediumRef, mediumBlob);

        const originalUrl = await getDownloadURL(originalRef);
        const thumbnailUrl = await getDownloadURL(thumbnailRef);
        const mediumUrl = await getDownloadURL(mediumRef);

        // --- EXIF extraction ---
        let takenAtValue;

        try {
          const exifData = await exifr.parse(file, [
            "DateTimeOriginal"
          ]);

          if (exifData?.DateTimeOriginal) {
            takenAtValue = Timestamp.fromDate(
              exifData.DateTimeOriginal
            );
          } else {
            takenAtValue = Timestamp.fromDate(
              new Date(file.lastModified)
            );
          }
        } catch (err) {
          console.log("EXIF read failed:", file.name);
          takenAtValue = Timestamp.fromDate(
            new Date(file.lastModified)
          );
        }

        await addDoc(collection(db, "photos"), {
          albumId: id,
          userId: user.uid,
          fileName: file.name,
          size: file.size,
          originalUrl,
          thumbnailUrl,
          mediumUrl,
          originalPath,
          thumbnailPath,
          mediumPath,
          takenAt: takenAtValue,
          createdAt: serverTimestamp()
        });
      }

      alert("Photos uploaded");
      e.target.value = "";
      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Photo upload failed");
    } finally {
      setUploading(false);
    }
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

  async function handleDeletePhoto(photo) {
    const confirmDelete = confirm("Delete this photo?");

    if (!confirmDelete) return;

    try {
      await deleteObject(ref(storage, photo.originalPath));
      await deleteObject(ref(storage, photo.thumbnailPath));
      await deleteObject(ref(storage, photo.mediumPath));

      await deleteDoc(doc(db, "photos", photo.id));

      setSelectedPhoto(null);
      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Photo delete failed");
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

  return (
    <section>
      <Link to="/dashboard">Back to Dashboard</Link>

      <h1>{album.title}</h1>
      <p>{album.description}</p>
      {album.isShared && (
        <p>
          Share URL: {window.location.origin}/share/{album.shareSlug}
        </p>
      )}

      <div className="upload_section">
        <h2>Upload Photos</h2>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          disabled={uploading}
        />

        {uploading && <p>Uploading photos...</p>}
      </div>

      <h2>Photos</h2>

      {photos.length === 0 ? (
        <p>No photos uploaded yet.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-card">
              <button
                className="photo-thumb-button"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.fileName}
                  className="photo-thumb"
                />
              </button>

              <button
                className="photo-delete-button"
                onClick={() => handleDeletePhoto(photo)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedPhoto(null)}
            >
              Close
            </button>

            <button
              className="modal-delete"
              onClick={() => handleDeletePhoto(selectedPhoto)}
            >
              Delete Photo
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