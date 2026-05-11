Final Project for Front End II class.

Photo Album App in React



# Project Name - Share the Moment

## Student Name - Jim Nichols

## Project Description

Share the Moment is a React and Firebase photo-sharing application designed to help users organize and share memories from vacations, family gatherings, birthdays, holidays, and other events. Users can create albums, upload photos, organize them into timeline events, and generate public share links for friends and family.

The goal of the project was to build a larger-scale React application that combines authentication, database storage, image uploads, responsive design, routing, and dynamic user interaction into a single project. I wanted the app to feel more like a real-world web application instead of just a small classroom demo.

This project uses Firebase Authentication, Firestore, and Firebase Storage (Option B from the project instructions). Instead of using only local JavaScript data, the application stores user information, albums, events, and image data in Firebase and dynamically loads the content into React components.

## Main Features

- User registration and login using Firebase Authentication
- Protected routes for authenticated users
- Create, edit, and delete photo albums
- Upload single or multiple images
- Automatic image resizing for thumbnails and medium images
- Duplicate image checking during uploads
- Event and timeline organization inside albums
- Add event names, dates, locations, and descriptions
- Dynamic photo filtering by timeline event
- Public shareable album links
- Responsive layouts for desktop, tablet, and mobile devices
- Modal image viewer with next/previous navigation
- Download original image option
- Upload progress indicators and status messages
- Firebase Firestore database integration
- Firebase Storage integration for uploaded images

## Technologies Used

- React
- Vite
- JavaScript
- HTML
- CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- React Router

## React Concepts Used

This project uses many of the React concepts covered during the course. The application is built using reusable components and React Router for navigation between pages. State management was handled primarily with useState and useEffect, while Context API was used for authentication and protected routes.

The project also makes extensive use of controlled forms, event handling, conditional rendering, and dynamic rendering with .map(). As the project grew larger, organizing component structure and application state became much more important. Working on a project of this size helped me better understand how React applications are structured and how components interact with each other.

Because the project uses Firebase, React is also used to dynamically load and update cloud-based data in real time instead of relying only on local arrays or hardcoded content.

## Challenges Faced

One of the biggest challenges was managing responsive layouts across desktop, tablet, and mobile devices. The album details page became especially complicated once timeline events, controls, and image galleries were all competing for screen space. A lot of time was spent adjusting layouts and improving usability across different screen sizes and orientations.

Another challenge was managing Firebase data correctly between Firestore and Firebase Storage. For example, when deleting albums or images, both the database records and storage files needed to be handled properly to avoid leaving unused data behind.

Image uploads and modal behavior also became more complicated as additional features were added. I spent a significant amount of time improving upload progress feedback, mobile modal navigation, event filtering, and dynamic timeline behavior. As the project grew, keeping the code organized and readable also became an important part of the process.

## What I Learned

This project helped me gain a much better understanding of how larger React applications are structured. I learned more about organizing components, managing application state, working with Firebase services, and designing responsive layouts that work across different devices.

I also learned how much planning and testing is involved in building user-friendly interfaces. Small design decisions can have a big impact on usability, especially on phones and tablets. Throughout the project, I found myself constantly revisiting layouts and workflows to make the application easier to use.

Another major lesson was learning how frontend applications interact with cloud databases and storage systems in real time. This project gave me practical experience working with authentication, databases, image uploads, dynamic rendering, and responsive UI design in a modern web application.

## Future Improvements

There are still many ways this project could continue to grow. One improvement would be adding photo captions and searchable tags for individual images. This would make it easier to organize and search large collections of photos over time.

Album and photo search tools could also be expanded further by allowing users to search by event name, tags, or date ranges. Additional filtering and sorting options would help improve usability as albums become larger and more complex.

Another possible improvement would be adding drag-and-drop uploads and additional upload validation with more detailed user feedback. While the current version already restricts uploads to image files and includes upload progress indicators, the upload experience could still be improved further.

Additional long-term ideas include video upload support, collaborative albums shared between multiple users, AI-generated image tagging, map and location integration, improved accessibility features, and additional gallery layout options.

Because the project was developed over a limited course timeline, there are also opportunities to continue refining the responsive layouts and overall user experience in future versions.