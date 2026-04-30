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
  deleteDoc,
  updateDoc,
  writeBatch
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

  const [events, setEvents] = useState([]);
  const [eventName, setEventName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeEventId, setActiveEventId] = useState(null);

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

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [id, user]);

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

  async function loadEvents() {
    if (!user) return;

    const q = query(
      collection(db, "events"),
      where("albumId", "==", id),
      where("userId", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);

    const eventData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    eventData.sort((a, b) => {
      const aDate = a.eventDate?.toMillis?.() || 0;
      const bDate = b.eventDate?.toMillis?.() || 0;
      return aDate - bDate;
    });

    setEvents(eventData);
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
          eventId: selectedEventId || null,
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

  async function handleUpdatePhotoEvent(photoId, newEventId) {
    try {
      await updateDoc(doc(db, "photos", photoId), {
        eventId: newEventId || null
      });

      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Failed to update photo event");
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();

    if (!eventName || !user) return;

    try {
      await addDoc(collection(db, "events"), {
        albumId: id,
        userId: user.uid,
        name: eventName,
        location: eventLocation,
        description: eventDescription,
        eventDate: null,
        createdAt: serverTimestamp()
      });

      setEventName("");
      setEventLocation("");
      setEventDescription("");

      loadEvents();
    } catch (err) {
      console.error(err);
      alert("Failed to create event");
    }
  }

  async function handleDeleteEvent(event) {
    const confirmDelete = confirm(
      `Delete the event "${event.name}"?\n\nPhotos in this event will not be deleted. They will be moved to Uncategorized.`
    );

    if (!confirmDelete) return;

    try {
      const batch = writeBatch(db);

      const eventRef = doc(db, "events", event.id);
      batch.delete(eventRef);

      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", id),
        where("eventId", "==", event.id)
      );

      const photosSnapshot = await getDocs(photosQuery);

      photosSnapshot.docs.forEach((photoDoc) => {
        batch.update(doc(db, "photos", photoDoc.id), {
          eventId: null
        });
      });

      await batch.commit();

      if (activeEventId === event.id) {
        setActiveEventId(null);
      }

      loadEvents();
      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Failed to delete event");
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
      (currentIndex - 1 + activeEventPhotos.length) % activeEventPhotos.length;

    setSelectedPhoto(activeEventPhotos[previousIndex]);
  }

  function getEventDate(eventId) {
    const eventPhotos = photos.filter((photo) => photo.eventId === eventId);

    const dates = eventPhotos
      .map((photo) => photo.takenAt)
      .filter(Boolean)
      .map((date) => date.toDate ? date.toDate() : new Date(date))
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

  return (
  <section className="album-page">
    <Link to="/dashboard" className="back-link">
      ← Back to Dashboard
    </Link>

    <div className="album-header">
      <h1>{album.title}</h1>
      <p>{album.description}</p>
    </div>

    <div className="album-content-layout">
      <main className="album-main-area">
        {hasTimeline ? (
          <div className="album-content-with-timeline">
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
                        <div className="timeline-event-row" key={event.id}>
                          <button
                            type="button"
                            className={`timeline-item ${
                              activeEventId === event.id ? "active" : ""
                            }`}
                            onClick={() => setActiveEventId(event.id)}
                          >
                            <span className="timeline-title">{event.name}</span>
                          </button>

                          <button
                            type="button"
                            className="timeline-delete"
                            onClick={() => handleDeleteEvent(event)}
                          >
                            delete
                          </button>
                        </div>
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

                      <span
                        className="photo-delete-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo);
                        }}
                      >
                        delete
                      </span>

                      <select
                        className="photo-event-select"
                        value={photo.eventId || ""}
                        onChange={(e) => handleUpdatePhotoEvent(photo.id, e.target.value)}
                      >
                        <option value="">No event</option>

                        {events.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                      </select>
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

                    <span
                      className="photo-delete-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo);
                      }}
                    >
                      delete
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <aside className="album-controls">
        {album.isShared && (
          <div className="share-box">
            <p>Shared Album</p>
            <a
              href={`${window.location.origin}/share/${album.shareSlug}`}
              target="_blank"
              rel="noreferrer"
            >
              View Public Link
            </a>
          </div>
        )}

        <div className="upload-section">
          <h2>Upload Photos</h2>

          <label htmlFor="event-select">Add photos to event</label>

          <select
            id="event-select"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">No event</option>

            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            disabled={uploading}
          />

          {uploading && <p>Uploading photos...</p>}
        </div>

        <div className="event-section">
          <h2>Create Event</h2>

          <form onSubmit={handleCreateEvent} className="event-form">
            <input
              type="text"
              placeholder="Event name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Location"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
            />

            <input
              type="text"
              placeholder="Description"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
            />

            <button type="submit" className="primary-button">
              Create Event
            </button>
          </form>
        </div>
      </aside>
    </div>

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

            <span
              className="meta-item meta-action"
              onClick={() => handleDeletePhoto(selectedPhoto)}
            >
              delete
            </span>
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

export default AlbumDetails;