PROJECT_ID="fire-base-project-id-01"
SERVICE_ACCOUNT_EMAIL="firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com"

# firebase functions:artifacts:setpolicy

# gcloud auth activate-service-account --key-file=/User/

# Link a Billing account, then enable the following GCP services

gcloud services enable artifactregistry.googleapis.com \
    run.googleapis.com \
    logging.googleapis.com \
    pubsub.googleapis.com \
    firebase.googleapis.com \
    firebaserules.googleapis.com \
    runtimeconfig.googleapis.com \
    cloudbuild.googleapis.com \
    cloudfunctions.googleapis.com \
    eventarc.googleapis.com \
    cloudbilling.googleapis.com

# Enable github-actions deployment by running these commands in GCP console
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/serviceusage.serviceUsageConsumer \

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/cloudfunctions.admin \

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/iam.serviceAccountUser

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/artifactregistry.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/cloudbuild.builds.editor

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SERVICE_ACCOUNT_EMAIL \
  --role=roles/logging.admin
#
