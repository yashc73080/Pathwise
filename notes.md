# Pathwise Development & Testing Notes

This document contains technical details regarding development workflows, testing procedures, and deployment.

## 📱 Testing a Website vs. App

Testing Pathwise across different platforms requires different approaches.

### 1. Website Testing (Desktop)
- **Standard**: Run `npm run dev` in `frontend/` and visit `localhost:3000`.
- **Responsive Design**: Use Chrome DevTools (F12) and toggle "Device Toolbar" (Ctrl+Shift+M) to simulate mobile screen sizes.

### 2. Mobile Browser Testing (No App Install)
To test exactly how the web version feels on a real mobile device without installing an app:
1. **Start Backend**: `python app.py` (runs on `0.0.0.0:5000`).
2. **Start Frontend on Network**: `npm run dev -- -H 0.0.0.0` (in `frontend/`).
3. **Connect**: Ensure your phone and computer are on the same WiFi.
4. **Access**: Visit `http://YOUR_COMPUTER_IP:3000` on your phone's browser.
   - *Note*: You must update `.env.local` (or `.env.development`) to use your computer's IP for `NEXT_PUBLIC_BACKEND_URL`.

### 3. Native App Testing (Capacitor)
Capacitor allows us to turn our Next.js web application into a native Android/iOS app.

#### How Capacitor Works:
- **WebView**: Capacitor hosts our web app inside a native "WebView" component.
- **Bridge**: It provides a JavaScript-to-Native bridge, allowing web code to access native features like Camera, Geolocation (high accuracy), and Push Notifications.
- **Project Sync**: `npx cap sync` copies your built web files into the `android/` and `ios/` folders.

#### Capacitor Live Reload (Fast Development):
This is the preferred way to test native behavior while coding:
1. **Start Dev Server**: `npm run dev -- -H 0.0.0.0`
2. **Sync**: `npx cap sync`
3. **Run**: `npx cap open android` and click **Run** in Android Studio.
4. **Live Updates**: Saving code in VS Code will instantly update the app running on the physical phone or emulator.
   - *Requirement*: The `capacitor.config.ts` must have a `server` block pointing to your computer's IP.

---

## 🚀 Deployment

We support both **Manual Deployment** (for initial setup/debugging) and **CI/CD** (automated via GitHub Actions).

### 1. Prerequisites (Google Cloud & Firebase)
Before deploying, ensure these settings are correct in the Google Cloud Console:
* **APIs Enabled**: Enable "Vertex AI API" and "Google Cloud Firestore API".
* **Firestore**: Create the database in "Native Mode" (usually in `us-central1`).
* **IAM Permissions**: The Cloud Run Service Account (usually `###-compute@developer.gserviceaccount.com`) needs these roles:
    * `Vertex AI User` (To use Gemini)
    * `Firebase Authentication Admin` (To verify user tokens)
    * `Cloud Datastore User` (To read/write Firestore)
    * `Cloud Run Admin` (To deploy the backend) 
    * `Firebase Hosting Admin` (To deploy the frontend)

### 2. Manual Deployment

#### Backend (Google Cloud Run)
We use a `.gcloudignore` file to prevent uploading local secrets (JSON keys, .env.local).
1.  **Configure Env**: Ensure `backend/.env.local` or secrets in Cloud Run console are set.
    * *Critical*: Do NOT set `GOOGLE_APPLICATION_CREDENTIALS` in Cloud Run env vars. It automatically uses the attached Service Account.
    * Set `GOOGLE_CLOUD_LOCATION` = `us-central1` (for Vertex AI stability).
2.  **Deploy**:
    ```bash
    cd backend
    gcloud run deploy pathwise-backend --source .
    ```
    * Select `[35] us-central1` for location.
    * Allow "unauthenticated invocations".

#### Frontend (Firebase Hosting)
We use different environment files for local vs. prod to manage URLs automatically.
* `.env.development`: `NEXT_PUBLIC_BACKEND_URL=http://localhost:5000`
* `.env.production`: `NEXT_PUBLIC_BACKEND_URL=https://YOUR-CLOUD-RUN-URL.run.app` (No trailing slash)

**To Deploy:**
```bash
cd frontend
npm run build   # Bakes the production URL into static files
```

```bash
# For the first time only:
firebase init hosting
```
* Public directory: `out`
* Single-page app? `No`
* Automatic builds and deploys with GitHub? `No`

```bash
firebase deploy # Uploads the 'out' folder
```

**Can choose a custom domain**
1. Go to Firebase Console > Hosting > Add another site. 
2. Tell CLI to use the custom domain.
    ```bash
    firebase target:apply hosting prod pathwise
    ```
3. Update `firebase.json` with the line `"target": "prod",`.
4. Deploy.

### 3. CI/CD (GitHub Actions)
Pushing to the `main` branch automatically deploys updates.

#### GitHub Secrets Setup
Go to Settings > Secrets and variables > Actions > Repository Secrets and add all of the following:

1. `GCP_CREDENTIALS`: The full JSON key content of a Service Account (the compute developer one) with Cloud Run Admin and Firebase Hosting Admin roles.
2. Frontend Variables:
    * `NEXT_PUBLIC_BACKEND_URL`
    * `NEXT_PUBLIC_FIREBASE_API_KEY`
    * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
    * ... (and all other Firebase config values)

#### Workflows
* Backend: Triggers on changes to `backend/**`. Deploys source to Cloud Run.
* Frontend: Triggers on changes to `frontend/**`. Installs deps, creates `.env.production` dynamically using Secrets, runs `npm run build`, and deploys to Firebase.

--- 

#### 🛠️ Environment Configurations
* Local Development: `localhost:5000`
* Mobile Browser/Capacitor: `YOUR_COMPUTER_IP:5000`
* Android Emulator: `10.0.2.2:5000` (special IP for emulator to see host machine)