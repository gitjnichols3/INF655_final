import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { db } from "../firebase/firebase";

import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";

function SharedAlbum() {
  const { slug } = useParams();

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSharedAlbum() {
      try {
        const albumQuery = query(
          collection(db, "albums"),
          where("shareSlug", "==", slug),
          where("isShared", "==", true)
        );

        const albumSnapshot = await getDocs(albumQuery);

        if (albumSnapshot.empty) {
          setLoading(false);
          return;
        }

        const albumDoc = albumSnapshot.docs[0];

        const albumData = {
          id: albumDoc.id,
          ...albumDoc.data()
        };

        setAlbum(albumData);

        const photosQuery = query(
          collection(db, "photos"),
          where("albumId", "==", albumDoc.id)
        );

        const photosSnapshot = await getDocs(photosQuery);

        const photoData = photosSnapshot.docs.map((doc) => ({
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSharedAlbum();
  }, [slug]);

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

  if (loading) {
    return <p>Loading shared album...</p>;
  }

  if (!album) {
    return (
      <section>
        <h1>Shared album not found</h1>
        <p>This album may not exist or sharing may have been disabled.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>{album.title}</h1>
      <p>{album.description}</p>

      <h2>Photos</h2>

      {photos.length === 0 ? (
        <p>No photos are available in this shared album.</p>
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

export default SharedAlbum;