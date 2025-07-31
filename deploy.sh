#!/bin/bash

# Cloud Runデプロイスクリプト
# 使用方法: ./deploy.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-your-project-id}
REGION=${2:-asia-northeast1}
SERVICE_NAME="pomodoro-timer"

echo "🚀 Cloud Runへのデプロイを開始します..."
echo "プロジェクトID: $PROJECT_ID"
echo "リージョン: $REGION"
echo "サービス名: $SERVICE_NAME"

# プロジェクトの設定
gcloud config set project $PROJECT_ID

# Dockerイメージのビルドとプッシュ
echo "📦 Dockerイメージをビルドしています..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .

# Cloud Runへのデプロイ
echo "☁️ Cloud Runにデプロイしています..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

# サービスURLの取得と表示
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo "✅ デプロイが完了しました!"
echo "🌐 サービスURL: $SERVICE_URL"