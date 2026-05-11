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
  writeBatch,
} from "firebase/firestore";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// This page handles the private album view. It loads the album, photos, and events,
// and lets the logged-in user upload photos, manage timeline events, delete photos,
// and create a public read-only sharing link.
function AlbumDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  // Basic album and loading state.
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);

  // Upload state used for user feedback and progress display.
  // This helps meet the grading requirement for feedback/loading messages.
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadBatchInfo, setUploadBatchInfo] = useState(null);
  const [uploadCompleteMessage, setUploadCompleteMessage] = useState("");

  // Dynamic photo state. Photos are loaded from Firebase and rendered with .map().
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Timeline event form and filtering state.
  // This supports forms, controlled inputs, filtering, and conditional rendering.
  const [events, setEvents] = useState([]);
  const [eventName, setEventName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [activeEventId, setActiveEventId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // Responsive state used to adjust the album tools and modal controls on small screens.
  const [isPhonePortrait, setIsPhonePortrait] = useState(() => {
    return window.innerWidth <= 650 && window.innerHeight > window.innerWidth;
  });

  const [albumView, setAlbumView] = useState(() => {
    if (window.innerWidth <= 650 || window.innerHeight <= 500) {
      return "mobile";
    }

    if (window.innerWidth <= 900 || window.innerHeight <= 600) {
      return "tablet";
    }

    return "desktop";
  });

  const isMobile = window.innerWidth <= 650 || window.innerHeight <= 500;

  const [showManageImages, setShowManageImages] = useState(() => {
    const isMobile = window.innerWidth <= 650 || window.innerHeight <= 500;
    const isLandscape = window.innerWidth > window.innerHeight;

    return isMobile ? isLandscape : true;
  });

  const [showTimeline, setShowTimeline] = useState(true);

  // Watch screen size so the controls work better on phones and tablets.
  useEffect(() => {
    function handleResize() {
      const phonePortrait =
        window.innerWidth <= 650 && window.innerHeight > window.innerWidth;

      setIsPhonePortrait(phonePortrait);

      if (window.innerWidth <= 650 || window.innerHeight <= 500) {
        setAlbumView("mobile");

        const isLandscape = window.innerWidth > window.innerHeight;

        if (isLandscape) {
          setShowManageImages(true);
          setShowTimeline(true);
        }
      } else if (window.innerWidth <= 900 || window.innerHeight <= 600) {
        setAlbumView("tablet");
        setShowManageImages(true);
        setShowTimeline(true);
      } else {
        setAlbumView("desktop");
        setShowManageImages(true);
        setShowTimeline(true);
      }
    }

    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Load the current album from Firestore.
  useEffect(() => {
    async function loadAlbum() {
      const docRef = doc(db, "albums", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setAlbum({
          id: docSnap.id,
          ...docSnap.data(),
        });
      }

      setLoading(false);
    }

    loadAlbum();
  }, [id]);

  // Load photos and events once the authenticated user is available.
  useEffect(() => {
    if (user) {
      loadPhotos();
    }
  }, [id, user]);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [id, user]);

  // Warn the user before leaving the page during an active upload.
  useEffect(() => {
    if (!uploading) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading]);

  async function loadPhotos() {
    if (!user) return;

    setPhotosLoading(true);

    try {
      const q = query(
        collection(db, "photos"),
        where("albumId", "==", id),
        where("userId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);

      const photoData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      photoData.sort((a, b) => {
        const aDate = a.takenAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bDate = b.takenAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;

        return aDate - bDate;
      });

      setPhotos(photoData);
    } finally {
      setPhotosLoading(false);
    }
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
      ...doc.data(),
    }));

    eventData.sort((a, b) => {
      const aDate = a.eventDate?.toMillis?.() || 0;
      const bDate = b.eventDate?.toMillis?.() || 0;

      return aDate - bDate;
    });

    setEvents(eventData);
  }

  function uploadFileWithProgress(storageRef, file, progressCallback) {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          progressCallback(progress);
        },
        reject,
        () => resolve(uploadTask.snapshot)
      );
    });
  }

  // Handles multi-photo uploads. This uses Firebase Storage for files
  // and Firestore for the photo records used by the React app.
  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);

    if (files.length === 0 || !user) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Preparing photos...");

    try {
      let uploadedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        setUploadBatchInfo({
          current: i + 1,
          total: files.length,
          fileName: file.name,
        });

        if (!file.type.startsWith("image/")) {
          skippedCount++;
          setUploadStatus(`Skipped ${file.name}`);
          continue;
        }

        const isDuplicate = photos.some(
          (photo) => photo.fileName === file.name && photo.size === file.size
        );

        if (isDuplicate) {
          skippedCount++;
          setUploadStatus(`Skipped ${file.name}`);
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

        setUploadStatus(`Uploading ${file.name}`);

        await uploadFileWithProgress(originalRef, file, (progress) => {
          setUploadProgress(Math.round(progress * 0.6));
        });

        await uploadFileWithProgress(thumbnailRef, thumbnailBlob, (progress) => {
          setUploadProgress(Math.round(60 + progress * 0.2));
        });

        await uploadFileWithProgress(mediumRef, mediumBlob, (progress) => {
          setUploadProgress(Math.round(80 + progress * 0.2));
        });

        const originalUrl = await getDownloadURL(originalRef);
        const thumbnailUrl = await getDownloadURL(thumbnailRef);
        const mediumUrl = await getDownloadURL(mediumRef);

        let takenAtValue;

        try {
          const exifData = await exifr.parse(file, ["DateTimeOriginal"]);

          if (exifData?.DateTimeOriginal) {
            takenAtValue = Timestamp.fromDate(exifData.DateTimeOriginal);
          } else {
            takenAtValue = Timestamp.fromDate(new Date(file.lastModified));
          }
        } catch (err) {
          console.log("EXIF read failed:", file.name);
          takenAtValue = Timestamp.fromDate(new Date(file.lastModified));
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
          createdAt: serverTimestamp(),
        });

        uploadedCount++;
      }

      const completeMessage =
        skippedCount > 0
          ? `Upload complete: ${uploadedCount} added, ${skippedCount} skipped`
          : `Upload complete: ${uploadedCount} photos added`;

      setUploadCompleteMessage(completeMessage);
      setUploadStatus(completeMessage);

      e.target.value = "";
      loadPhotos();

      setTimeout(() => {
        setUploadCompleteMessage("");
      }, 5000);

      if (selectedEventId) {
        setActiveEventId(selectedEventId);

        if (window.innerWidth <= 650) {
          setShowTimeline(false);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Photo upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadBatchInfo(null);
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
        eventId: newEventId || null,
      });

      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Failed to update photo event");
    }
  }

  function handleStartEditEvent(event) {
    setEditingEventId(event.id);
    setEventName(event.name || "");
    setEventLocation(event.location || "");
    setEventDescription(event.description || "");
    setShowManageImages(true);
  }

  // Event form. This can create a new timeline event or update an existing one.
  async function handleCreateEvent(e) {
    e.preventDefault();

    if (!eventName || !user) return;

    try {
      if (editingEventId) {
        await updateDoc(doc(db, "events", editingEventId), {
          name: eventName,
          location: eventLocation,
          description: eventDescription,
        });
      } else {
        const newEventRef = await addDoc(collection(db, "events"), {
          albumId: id,
          userId: user.uid,
          name: eventName,
          location: eventLocation,
          description: eventDescription,
          eventDate: null,
          createdAt: serverTimestamp(),
        });

        setSelectedEventId(newEventRef.id);
      }

      setEditingEventId(null);
      setEventName("");
      setEventLocation("");
      setEventDescription("");

      loadEvents();
    } catch (err) {
      console.error(err);
      alert("Failed to save event");
    }
  }

  async function handleDeleteEvent(event) {
    const confirmDelete = confirm(
      `Delete the event "${event.name}"?\n\nPhotos in this event will not be deleted. They will be moved to Uncategorized.`
    );

    if (!confirmDelete) return;

    try {
      const batch = writeBatch(db);

      batch.delete(doc(db, "events", event.id));

      const photosQuery = query(
        collection(db, "photos"),
        where("albumId", "==", id),
        where("eventId", "==", event.id),
        where("userId", "==", user.uid)
      );

      const photosSnapshot = await getDocs(photosQuery);

      photosSnapshot.docs.forEach((photoDoc) => {
        batch.update(doc(db, "photos", photoDoc.id), {
          eventId: null,
        });
      });

      await batch.commit();

      if (activeEventId === event.id) {
        setActiveEventId(null);
        setShowTimeline(true);
      }

      loadEvents();
      loadPhotos();
    } catch (err) {
      console.error(err);
      alert("Failed to delete event");
    }
  }

  // Creates or removes the public read-only share link for this album.
  async function handleToggleShare() {
    const slug = album.shareSlug || crypto.randomUUID();

    await updateDoc(doc(db, "albums", album.id), {
      isShared: !album.isShared,
      shareSlug: slug,
    });

    setAlbum({
      ...album,
      isShared: !album.isShared,
      shareSlug: slug,
    });
  }

  function handleTimelineSelection(value) {
    setActiveEventId(value);

    const isMobile = window.innerWidth <= 650 || window.innerHeight <= 500;
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isMobile && !isLandscape) {
      setShowTimeline(false);
    } else {
      setShowTimeline(true);
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

  const activeEventPhotos = !hasTimeline
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

  // Dates come from photo EXIF data when available.
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
      year: "numeric",
    }).format(date);
  }

  const eventsWithDates = events.map((event) => ({
    ...event,
    displayDate: getEventDate(event.id),
  }));

  const groupedEvents = eventsWithDates.reduce((groups, event) => {
    const key = event.displayDate
      ? event.displayDate.toISOString().split("T")[0]
      : "no-date";

    if (!groups[key]) {
      groups[key] = {
        date: event.displayDate,
        events: [],
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
      <Link
        to="/dashboard"
        className="back-link"
        onClick={(e) => {
          if (uploading) {
            e.preventDefault();
            alert(
              "Photos are still uploading. Please wait until the upload is complete before leaving this page."
            );
          }
        }}
      >
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
              {showTimeline && (
                <div className="timeline-column">
                  <div className="timeline-intro">
                    <h2>Select an Event</h2>
                    <p>Select an event from the timeline to view photos.</p>
                  </div>

                  <div className="timeline-list">
                    {groupedEventList.map((group) => (
                      <div
                        key={group.date ? group.date.toISOString() : "no-date"}
                        className="timeline-date-group"
                      >
                        <h3 className="timeline-date">
                          {formatDate(group.date)}
                        </h3>

                        <div className="timeline-events">
                          {group.events.map((event) => (
                            <div className="timeline-event-row" key={event.id}>
                              <button
                                type="button"
                                className={`timeline-item ${
                                  activeEventId === event.id ? "active" : ""
                                }`}
                                onClick={() => handleTimelineSelection(event.id)}
                              >
                                <span className="timeline-title">
                                  {event.name}
                                </span>
                              </button>

                              <div className="timeline-actions">
                                <button
                                  type="button"
                                  className="timeline-edit"
                                  onClick={() => handleStartEditEvent(event)}
                                >
                                  edit
                                </button>

                                <button
                                  type="button"
                                  className="timeline-delete"
                                  onClick={() => handleDeleteEvent(event)}
                                >
                                  delete
                                </button>
                              </div>
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
                        onClick={() => handleTimelineSelection("all")}
                      >
                        <span className="timeline-title">All Photos</span>
                      </button>

                      {uncategorizedPhotos.length > 0 && (
                        <button
                          type="button"
                          className={`timeline-item ${
                            activeEventId === "uncategorized" ? "active" : ""
                          }`}
                          onClick={() => handleTimelineSelection("uncategorized")}
                        >
                          <span className="timeline-title">Uncategorized</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="gallery-column">
                <div className="photo-section-header">
                  {activeEventId === "all" ? (
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
                  ) : null}
                </div>

                {hasTimeline && activeEventId === null && (
                  <div className="gallery-empty-message">
                    <h2>No event selected</h2>
                    <p>Click an event in the timeline to view images.</p>
                  </div>
                )}

                {photosLoading ? (
                  <p>Loading photos...</p>
                ) : activeEventId !== null && activeEventPhotos.length === 0 ? (
                  <p>No photos to show. Upload photos or create an event.</p>
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
                          value=""
                          onChange={(e) => {
                            handleUpdatePhotoEvent(photo.id, e.target.value);
                          }}
                        >
                          <option value="" disabled>
                            Reassign event...
                          </option>

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

              {photosLoading ? (
                <p>Loading photos...</p>
              ) : photos.length === 0 ? (
                <p>No photos to show. Upload photos or create an event.</p>
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

        <div className="album-manage-area">
          {isMobile && (
            <div className="mobile-album-links">
              <button
                type="button"
                className="manage-albums-toggle"
                onClick={() => setShowManageImages(!showManageImages)}
              >
                {showManageImages
                  ? "Hide Image and Event Manager"
                  : "Manage Images and Events"}
              </button>

              {!showTimeline && (
                <>
                  <span className="mobile-link-divider">•</span>

                  <button
                    type="button"
                    className="manage-albums-toggle timeline-toggle"
                    onClick={() => setShowTimeline(true)}
                  >
                    Timeline
                  </button>
                </>
              )}
            </div>
          )}

          {showManageImages && (
            <aside className="album-controls">
              <div className="album-control-section">
                <h2>Album Sharing</h2>

                <p className="share-help-text">
                  Enable sharing to create a read-only public link for this album.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleToggleShare}
                >
                  {album.isShared
                    ? "Disable Album Sharing"
                    : "Enable Album Sharing"}
                </button>

                {album.isShared && (
                  <div className="share-box">
                    <a
                      href={`${window.location.origin}/share/${album.shareSlug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Public Link
                    </a>

                    <button
                      type="button"
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
              </div>

              <div className="upload-section album-control-section">
                <h2>Upload Photos</h2>

                <p className="upload-help-text">
                  If you plan to use timeline events, create them before uploading
                  photos so images can be assigned automatically during upload.
                </p>

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
              </div>

              <div className="event-section album-control-section">
                <h2>
                  {editingEventId ? "Edit Timeline Event" : "Create Timeline Event"}
                </h2>

                <p className="event-help-text">
                  Events are optional. Use them when an album has several parts,
                  such as different days, locations, or activities. Creating events
                  lets you build a timeline for the album.
                </p>

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
                    {editingEventId ? "Save Event" : "Create Event"}
                  </button>
                </form>
              </div>
            </aside>
          )}
        </div>
      </div>

      {(uploading || uploadCompleteMessage) && (
        <div className="upload-floating-status">
          <div className="upload-status-card">
            <h2>{uploading ? "Uploading Photos" : "Upload Finished"}</h2>

            {uploading && uploadBatchInfo && (
              <p className="upload-batch-text">
                File {uploadBatchInfo.current} of {uploadBatchInfo.total}
              </p>
            )}

            <p>{uploadStatus}</p>

            {uploading && (
              <>
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>

                <p className="upload-progress-text">{uploadProgress}%</p>
              </>
            )}

            {uploading && (
              <p className="upload-background-note">
                You can keep working on this page while photos upload.
              </p>
            )}
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <button className="modal-close" onClick={() => setSelectedPhoto(null)}>
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

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto.mediumUrl}
              alt={selectedPhoto.fileName}
              className="modal-image"
            />

            <div className="modal-meta">
              <span className="meta-item">
                {selectedPhoto.fileName}&nbsp;&bull;&nbsp;
                <a
                  href={selectedPhoto.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="meta-item meta-link"
                >
                  Download original
                </a>
              </span>

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

          {isPhonePortrait && activeEventPhotos.length > 1 && (
            <div className="mobile-modal-nav">
              <button
                className="mobile-modal-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  showPreviousPhoto();
                }}
              >
                {"<"}
              </button>

              <button
                className="mobile-modal-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  showNextPhoto();
                }}
              >
                {">"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AlbumDetails;
