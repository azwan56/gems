#!/usr/bin/env python3
"""
Deploy Gems Stock Screener (Next.js 16) to Google Cloud Run (dailystockrpt)
and configure all 12 cron jobs in Google Cloud Scheduler using pure GCP REST APIs.
"""
import os
import sys
import time
import json
import tarfile
import tempfile
import dotenv
import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.oauth2.credentials import Credentials
from google.cloud import storage
import googleapiclient.discovery
from googleapiclient.errors import HttpError

# Load .env from Gems/stock-screener and fallback from parent daily-mkt-rpt repo
screener_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
parent_repo_dir = os.path.abspath(os.path.join(screener_dir, '..'))
dotenv.load_dotenv(os.path.join(screener_dir, '.env'))
dotenv.load_dotenv(os.path.join(parent_repo_dir, 'backend', '.env'))
dotenv.load_dotenv(os.path.join(parent_repo_dir, '.env'))
dotenv.load_dotenv('/Users/azwan/Projects/daily-mkt-rpt/.env')

def resolve_gcp_credentials():
    """Use ADC if configured; otherwise fall back to authenticated Firebase CLI user token."""
    try:
        creds, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        return creds
    except DefaultCredentialsError:
        fb_cfg = os.path.expanduser('~/.config/configstore/firebase-tools.json')
        if os.path.exists(fb_cfg):
            with open(fb_cfg, 'r') as f:
                fb_data = json.load(f)
            access_token = fb_data.get('tokens', {}).get('access_token')
            if access_token:
                print("🔑 Using authenticated Firebase CLI credentials...")
                return Credentials(token=access_token)
        raise

gcp_creds = resolve_gcp_credentials()

PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'dailystockrpt')
REGION = os.getenv('GCP_REGION', 'us-central1')
SERVICE_NAME = 'gems-screener'
IMAGE_NAME = f'gcr.io/{PROJECT_ID}/{SERVICE_NAME}:latest'
BUCKET_NAME = f'{PROJECT_ID}_cloudbuild'
CRON_SECRET = os.getenv('CRON_SECRET') or 'gems-gcp-cron-secret-2026'

print(f"🚀 Deploying {SERVICE_NAME} (Next.js 16) to GCP Cloud Run...")
print(f"Project ID : {PROJECT_ID}")
print(f"Region     : {REGION}")
print(f"Image Name : {IMAGE_NAME}")

# Step 1: Package source directory into tarball
timestamp = int(time.time())
object_name = f"source/{SERVICE_NAME}-{timestamp}.tgz"

print("\n📦 [1/5] Packaging Next.js source directory...")
with tempfile.NamedTemporaryFile(suffix='.tgz', delete=False) as tmp_file:
    tmp_tar_path = tmp_file.name

ignore_dirs = {
    '.git', 'node_modules', '.next', '.vercel', 'coverage',
    '__pycache__', '.pytest_cache', '.cache', 'dist'
}
ignore_files = {'.env', '.env.production', '.env.local'}

def filter_tar(tarinfo):
    parts = tarinfo.name.replace('\\', '/').split('/')
    if any(p in ignore_dirs for p in parts):
        return None
    base = parts[-1]
    if base in ignore_files or base.endswith('.log'):
        return None
    return tarinfo

with tarfile.open(tmp_tar_path, 'w:gz') as tar:
    tar.add(screener_dir, arcname='.', filter=filter_tar)

print(f"Created source archive: {os.path.getsize(tmp_tar_path):,} bytes.")

# Step 2: Upload to Cloud Storage
print(f"📤 [2/5] Uploading archive to gs://{BUCKET_NAME}/{object_name}...")
storage_client = storage.Client(project=PROJECT_ID, credentials=gcp_creds)
bucket = storage_client.bucket(BUCKET_NAME)
blob = bucket.blob(object_name)
blob.chunk_size = 5 * 1024 * 1024
blob.upload_from_filename(tmp_tar_path, timeout=600)
os.remove(tmp_tar_path)
print("Upload completed successfully!")

# Step 3: Trigger Cloud Build
print("⚡ [3/5] Submitting container build to Google Cloud Build API...")
cb_client = googleapiclient.discovery.build('cloudbuild', 'v1', credentials=gcp_creds, cache_discovery=False)

build_body = {
    'source': {
        'storageSource': {
            'bucket': BUCKET_NAME,
            'object': object_name
        }
    },
    'steps': [
        {
            'name': 'gcr.io/cloud-builders/docker',
            'args': ['build', '-t', IMAGE_NAME, '.']
        }
    ],
    'images': [IMAGE_NAME],
    'timeout': '1200s'
}

operation = cb_client.projects().builds().create(projectId=PROJECT_ID, body=build_body).execute()
build_id = operation.get('metadata', {}).get('build', {}).get('id')
print(f"Build triggered! Build ID: {build_id}")

while True:
    try:
        build_info = cb_client.projects().builds().get(projectId=PROJECT_ID, id=build_id).execute()
        status = build_info.get('status')
        print(f"  Build status: {status}")
        if status == 'SUCCESS':
            print("🎉 Cloud Build succeeded!")
            break
        elif status in ['FAILURE', 'CANCELLED', 'TIMEOUT', 'FAILED']:
            log_url = build_info.get('logUrl', '')
            raise RuntimeError(f"Cloud Build failed with status: {status}. Logs: {log_url}")
    except Exception as e:
        if isinstance(e, RuntimeError):
            raise
        print(f"  Transient poll error: {e}, retrying in 5s...")
    time.sleep(5)

# Pin exact sha256 digest from Cloud Build so Cloud Run v2 patch always rolls out a new revision
built_images = build_info.get('results', {}).get('images', [])
built_digest = built_images[0].get('digest') if built_images else None
DEPLOY_IMAGE = f"gcr.io/{PROJECT_ID}/{SERVICE_NAME}@{built_digest}" if built_digest else IMAGE_NAME

# Step 4: Deploy to Cloud Run via Cloud Run v2 API
print("\n🚀 [4/5] Deploying container image to GCP Cloud Run via v2 API...")
run_client = googleapiclient.discovery.build('run', 'v2', credentials=gcp_creds, cache_discovery=False)

parent = f"projects/{PROJECT_ID}/locations/{REGION}"
service_full_name = f"{parent}/services/{SERVICE_NAME}"

existing = None
existing_env = {}
try:
    existing = run_client.projects().locations().services().get(name=service_full_name).execute()
    containers = existing.get("template", {}).get("containers", [])
    if containers:
        existing_env = {
            e["name"]: e["value"]
            for e in containers[0].get("env", [])
            if "name" in e and "value" in e
        }
except HttpError as e:
    if e.resp.status != 404:
        raise

fmp_key = os.getenv('FMP_API_KEY') or existing_env.get('FMP_API_KEY', '')
gemini_key = os.getenv('GEMINI_API_KEY') or existing_env.get('GEMINI_API_KEY', '')
vault_secret = os.getenv('ALIYUN_VAULT_SECRET') or existing_env.get('ALIYUN_VAULT_SECRET', 'Zhangjiang2025@@@')
sa_key = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY') or existing_env.get('FIREBASE_SERVICE_ACCOUNT_KEY', '')
dailystock_api_url = existing_env.get('DAILYSTOCK_API_URL') or 'https://gems-backend-oc26gauvga-uc.a.run.app/api'
effective_cron_secret = os.getenv('CRON_SECRET') or existing_env.get('CRON_SECRET') or CRON_SECRET

env_list = [
    {"name": "GOOGLE_CLOUD_PROJECT", "value": PROJECT_ID},
    {"name": "GCP_PROJECT_ID", "value": PROJECT_ID},
    {"name": "FMP_API_KEY", "value": fmp_key},
    {"name": "GEMINI_API_KEY", "value": gemini_key},
    {"name": "CRON_SECRET", "value": effective_cron_secret},
    {"name": "ALIYUN_VAULT_SECRET", "value": vault_secret},
    {"name": "DAILYSTOCK_API_URL", "value": dailystock_api_url},
    {"name": "NEXT_PUBLIC_PYTHON_BACKEND_URL", "value": "https://gems-backend-oc26gauvga-uc.a.run.app"},
    {"name": "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "value": PROJECT_ID},
    {"name": "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "value": f"{PROJECT_ID}.firebaseapp.com"},
    {"name": "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "value": f"{PROJECT_ID}.firebasestorage.app"},
    {"name": "DEPLOYED_AT", "value": str(int(time.time()))},
]
if sa_key:
    env_list.append({"name": "FIREBASE_SERVICE_ACCOUNT_KEY", "value": sa_key})

service_body = {
    "ingress": "INGRESS_TRAFFIC_ALL",
    "traffic": [
        {
            "type": "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST",
            "percent": 100,
        }
    ],
    "template": {
        "scaling": {
            "minInstanceCount": 0,
            "maxInstanceCount": 10
        },
        "timeout": "900s",
        "containers": [
            {
                "image": DEPLOY_IMAGE,
                "ports": [{"containerPort": 8080}],
                "resources": {
                    "limits": {
                        "cpu": "1",
                        "memory": "1Gi"
                    }
                },
                "env": env_list
            }
        ]
    }
}

if existing is not None:
    print(f"Updating existing Cloud Run service: {service_full_name}...")
    op = run_client.projects().locations().services().patch(
        name=service_full_name,
        body=service_body
    ).execute()
else:
    print(f"Creating new Cloud Run service: {service_full_name}...")
    op = run_client.projects().locations().services().create(
        parent=parent,
        serviceId=SERVICE_NAME,
        body=service_body
    ).execute()

# Wait for Cloud Run operation to finish
op_name = op.get("name")
while True:
    op_state = run_client.projects().locations().operations().get(name=op_name).execute()
    if op_state.get("done"):
        if "error" in op_state:
            raise RuntimeError(f"Cloud Run deploy error: {op_state['error']}")
        break
    print("  Waiting for Cloud Run revision to become ready...")
    time.sleep(4)

# Ensure public unauthenticated access (allUsers -> roles/run.invoker)
run_client.projects().locations().services().setIamPolicy(
    resource=service_full_name,
    body={
        "policy": {
            "bindings": [
                {
                    "role": "roles/run.invoker",
                    "members": ["allUsers"]
                }
            ]
        }
    }
).execute()

svc_info = run_client.projects().locations().services().get(name=service_full_name).execute()
service_url = svc_info.get("uri")
print(f"✅ Successfully deployed {SERVICE_NAME} to Cloud Run!")
print(f"🌐 Cloud Run Service URL: {service_url}")

# Step 5: Configure the 12 Cron Jobs in Google Cloud Scheduler via API
print("\n⏰ [5/5] Configuring 12 Cron Jobs in Google Cloud Scheduler...")
sched_client = googleapiclient.discovery.build('cloudscheduler', 'v1', credentials=gcp_creds, cache_discovery=False)

with open(os.path.join(screener_dir, "vercel.json"), "r") as f:
    vercel_cfg = json.load(f)

crons = vercel_cfg.get("crons", [])
for idx, c in enumerate(crons, 1):
    path = c["path"]
    schedule = c["schedule"]
    slug = path.replace("/api/cron/", "").replace("?chunk=", "-chunk-").replace("/", "-").replace("?", "-")
    job_id = f"gems-cron-{slug}"
    job_full_name = f"{parent}/jobs/{job_id}"
    target_uri = f"{service_url}{path}"

    job_body = {
        "name": job_full_name,
        "description": f"Gems Stock Screener Cron ({path}) migrated from Vercel to GCP",
        "schedule": schedule,
        "timeZone": "UTC",
        "attemptDeadline": "600s",
        "httpTarget": {
            "uri": target_uri,
            "httpMethod": "GET",
            "headers": {
                "Authorization": f"Bearer {CRON_SECRET}",
                "User-Agent": "Google-Cloud-Scheduler"
            }
        }
    }

    try:
        sched_client.projects().locations().jobs().get(name=job_full_name).execute()
        sched_client.projects().locations().jobs().patch(
            name=job_full_name,
            updateMask="description,schedule,timeZone,attemptDeadline,httpTarget",
            body=job_body
        ).execute()
        print(f"  [{idx}/{len(crons)}] ✅ Updated Cloud Scheduler job: {job_id} ({schedule} UTC) -> {target_uri}")
    except HttpError as e:
        if e.resp.status == 404:
            sched_client.projects().locations().jobs().create(
                parent=parent,
                body=job_body
            ).execute()
            print(f"  [{idx}/{len(crons)}] ✅ Created Cloud Scheduler job: {job_id} ({schedule} UTC) -> {target_uri}")
        else:
            print(f"  [{idx}/{len(crons)}] ⚠️ Error configuring {job_id}: {e}")

print("\n🎉 Migration of Gems Stock Screener + 12 Cron Jobs to GCP complete!")
