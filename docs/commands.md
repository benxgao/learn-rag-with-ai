# Notes

## Authenticate service account in local dev

```bash
gcloud config set project fire-base-project-id-01

export GOOGLE_APPLICATION_CREDENTIALS=/...

gcloud auth activate-service-account --key-file=...
```

## Grant app hosting secret access

```bash
firebase apphosting:secrets:grantaccess -b gcp GCP_CREDENTIALS_JSON

firebase apphosting:secrets:grantaccess -b gcp JOSE_JWT_SECRET
```
