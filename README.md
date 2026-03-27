# Firebase API Sample

This open-source project demonstrates how to manage a Firebase project as an API provider, with a focus on secure JWT validation using Firebase Authentication. It is intended as a reference for building secure, scalable backend APIs with Firebase Functions, protected by Firebase Auth.

## Features

- **Firebase Functions as API**: Exposes RESTful endpoints using Express and Firebase Cloud Functions.
- **JWT Validation**: Uses Firebase Authentication to validate JWTs for protected API routes.
- **Secret Management**: Demonstrates secure use of API keys and secrets via Google Cloud Secret Manager.
- **Middleware**: Includes reusable middleware for authentication and logging.
- **Local Development Support**: Easily run and test APIs locally using Firebase Emulators.

## Project Structure

- **/functions**: Source code for Cloud Functions (API endpoints, middleware, services).
- **/public**: Static assets for Firebase Hosting (optional).
- **/docs**: Documentation and setup notes.

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/firebase-api-sample.git
   cd firebase-api-sample
   ```

2. **Install dependencies**

   ```bash
   cd functions
   npm install
   ```

3. **Set up Firebase project**

   - Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
   - Update your `.env` or use Firebase CLI to set project ID.

4. **Local Development**

   - Start the Firebase emulators for local API testing:

     ```bash
     # set up .env and gcp_credentials.json in /functions
     npm run dev
     ```

5. **Deploy to Firebase via Github Actions**

   ```bash
   # configure vars/secrets in github actions
   # run commands in scripts/gcp.sh
   ```

## Basic Commands

| Command                            | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `npm run lint`                     | Lint the codebase                            |
| `npm run build`                    | Compile TypeScript to JavaScript             |
| `npm run serve`                    | Build and start local emulator for functions |
| `firebase emulators:start`         | Start all Firebase emulators                 |
| `firebase deploy --only functions` | Deploy only Cloud Functions                  |

## Authentication & JWT Validation

- Protected endpoints require a valid Firebase ID token in the `Authorization` header:  
  `Authorization: Bearer <ID_TOKEN>`
- Middleware verifies the token and attaches the decoded user info to the request.

## Secret Management

- API keys and sensitive values should be stored in Google Cloud Secret Manager.
- See `/docs/commands.md` for commands to grant secret access.

## References

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)

---

This project is intended for demonstration and educational purposes.
