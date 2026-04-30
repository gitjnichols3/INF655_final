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
  const [events, setEvents] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activeEventId, setActiveEventId] = useState(null);
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

        const eventsQuery = query(
          collection(db, "events"),
          where("albumId", "==", albumDoc.id)
        );

        const eventsSnapshot = await getDocs(eventsQuery);

        const eventData = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setEvents(eventData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSharedAlbum();
  }, [slug]);

  const hasTimeline = events.length > 0;
  const uncategorizedPhotos = photos.filter((photo) => !photo.eventId);
  const activeEvent = events.find((event) => event.id === activeEventId);

const activeEventPhotos =
  !hasTimeline
    ? photos
    : activeEventId === null
      ? []
      : activeEventId === "all"
        ? photos
        : activeEventId === "uncategorized"
          ? uncategorizedPhotos
          : photos.filter((photo) => photo.eventId === activeEventId);

  const activeEventPhotoCount = activeEventPhotos.length;

  function getEventDate(eventId) {
    const eventPhotos = photos.filter((photo) => photo.eventId === eventId);

    const dates = eventPhotos
      .map((photo) => photo.takenAt)
      .filter(Boolean)
      .map((date) => (date.toDate ? date.toDate() : new Date(date)))
      .filter((date) => !isNaN(date));

    if (dates.length === 0) return null;

    return new Date(Math.min(...dates.map((date) => date.getTime())));
  }

  function formatDate(date) {
    if (!date) return "No date yet";

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  const eventsWithDates = events.map((event) => ({
    ...event,
    displayDate: getEventDate(event.id)
  }));

  const groupedEvents = eventsWithDates.reduce((groups, event) => {
    const key = event.displayDate
      ? event.displayDate.toISOString().split("T")[0]
      : "no-date";

    if (!groups[key]) {
      groups[key] = {
        date: event.displayDate,
        events: []
      };
    }

    groups[key].events.push(event);

    return groups;
  }, {});

  const groupedEventList = Object.values(groupedEvents).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date - b.date;
  });

  function showNextPhoto() {
    const currentIndex = activeEventPhotos.findIndex(
      (photo) => photo.id === selectedPhoto.id
    );

    const nextIndex = (currentIndex + 1) % activeEventPhotos.length;
    setSelectedPhoto(activeEventPhotos[nextIndex]);
  }

  function showPreviousPhoto() {
    const currentIndex = activeEventPhotos.findIndex(
      (photo) => photo.id === selectedPhoto.id
    );

    const previousIndex =
      (currentIndex - 1 + activeEventPhotos.length) %
      activeEventPhotos.length;

    setSelectedPhoto(activeEventPhotos[previousIndex]);
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
  <section className="album-page shared-album-page">

<div className="album-header">
  <h1>{album.title}</h1>
  <span className="shared-badge">Shared Album</span>
  <p>{album.description}</p>
</div>

    <div className="album-content-layout shared-layout">
      <main className="album-main-area">

        {hasTimeline ? (
          <div className="album-content-with-timeline">

            {/* TIMELINE */}
            <div className="timeline-column">
              <h2>Timeline</h2>

              <div className="timeline-list">
                {groupedEventList.map((group) => (
                  <div
                    key={group.date ? group.date.toISOString() : "no-date"}
                    className="timeline-date-group"
                  >
                    <h3 className="timeline-date">{formatDate(group.date)}</h3>

                    <div className="timeline-events">
                      {group.events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={`timeline-item ${
                            activeEventId === event.id ? "active" : ""
                          }`}
                          onClick={() => setActiveEventId(event.id)}
                        >
                          <span className="timeline-title">{event.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="timeline-extra-links">
                  <button
                    type="button"
                    className={`timeline-item ${
                      activeEventId === "all" ? "active" : ""
                    }`}
                    onClick={() => setActiveEventId("all")}
                  >
                    <span className="timeline-title">All Photos</span>
                  </button>

                  {uncategorizedPhotos.length > 0 && (
                    <button
                      type="button"
                      className={`timeline-item ${
                        activeEventId === "uncategorized" ? "active" : ""
                      }`}
                      onClick={() => setActiveEventId("uncategorized")}
                    >
                      <span className="timeline-title">Uncategorized</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* GALLERY */}
            <div className="gallery-column">
              <div className="photo-section-header">
                {activeEventId === null ? (
                  <h2>Select an event</h2>
                ) : activeEventId === "all" ? (
                  <h2>All Photos</h2>
                ) : activeEventId === "uncategorized" ? (
                  <h2>Uncategorized Photos</h2>
                ) : activeEvent ? (
                  <>
                    <h2 className="event-title">{activeEvent.name}</h2>

                    <p className="event-meta-line">
                      {getEventDate(activeEvent.id) &&
                        formatDate(getEventDate(activeEvent.id))}

                      {activeEvent.location && `, ${activeEvent.location}`}

                      {`, ${activeEventPhotoCount} ${
                        activeEventPhotoCount === 1 ? "photo" : "photos"
                      }`}
                    </p>

                    {activeEvent.description && (
                      <p className="event-description">
                        {activeEvent.description}
                      </p>
                    )}
                  </>
                ) : (
                  <h2>Photos</h2>
                )}
              </div>

              {activeEventPhotos.length === 0 ? (
                activeEventId === null ? (
                  <p>Select an event from the timeline to view photos.</p>
                ) : (
                  <p>No photos to show.</p>
                )
              ) : (
                <div className="photo-grid photo-grid-fade" key={activeEventId}>
                  {activeEventPhotos.map((photo) => (
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
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="album-no-timeline">
            <h2>Photos</h2>

            {photos.length === 0 ? (
              <p>No photos to show.</p>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>

    {/* MODAL unchanged */}
    {selectedPhoto && (
      <div
        className="modal-overlay"
        onClick={() => setSelectedPhoto(null)}
      >
        <button
          className="modal-close"
          onClick={() => setSelectedPhoto(null)}
        >
          X
        </button>

        {activeEventPhotos.length > 1 && (
          <button
            className="modal-nav modal-prev"
            onClick={(e) => {
              e.stopPropagation();
              showPreviousPhoto();
            }}
          >
            {"<"}
          </button>
        )}

        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={selectedPhoto.mediumUrl}
            alt={selectedPhoto.fileName}
            className="modal-image"
          />

          <div className="modal-meta">
            <span className="meta-item">{selectedPhoto.fileName}</span>

            {selectedPhoto.takenAt && (
              <span className="meta-item">
                {selectedPhoto.takenAt.toDate
                  ? selectedPhoto.takenAt.toDate().toLocaleDateString()
                  : new Date(selectedPhoto.takenAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {activeEventPhotos.length > 1 && (
          <button
            className="modal-nav modal-next"
            onClick={(e) => {
              e.stopPropagation();
              showNextPhoto();
            }}
          >
            {">"}
          </button>
        )}
      </div>
    )}
  </section>
);
}

export default SharedAlbum;