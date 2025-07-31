# Cloud Run デプロイガイド

このポモドーロタイマーアプリをGoogle Cloud Runにデプロイする手順です。

## 前提条件

1. Google Cloud SDKがインストールされていること
2. gcloudコマンドでログインしていること
3. Google Cloud プロジェクトが作成されていること
4. Cloud Build APIとCloud Run APIが有効になっていること

## 手動デプロイ

### 1. Google Cloud プロジェクトの設定

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# 必要なAPIを有効化
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

### 2. デプロイの実行

```bash
# デプロイスクリプトを実行
./deploy.sh your-project-id asia-northeast1
```

### 3. 個別コマンドでのデプロイ

```bash
# Dockerイメージのビルドとプッシュ
gcloud builds submit --tag gcr.io/$PROJECT_ID/pomodoro-timer .

# Cloud Runへのデプロイ
gcloud run deploy pomodoro-timer \
  --image gcr.io/$PROJECT_ID/pomodoro-timer \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1
```

## Cloud Build を使用した自動デプロイ

### GitHub連携の設定

1. Google Cloud コンソールでCloud Buildに移動
2. トリガーを作成
3. GitHubリポジトリと連携
4. `cloudbuild.yaml`を使用してビルド設定

### 手動でCloud Buildを実行

```bash
gcloud builds submit --config cloudbuild.yaml .
```

## 設定詳細

### Dockerfile
- nginx:alpineベースイメージを使用
- ポート8080でリッスン（Cloud Run要件）
- 静的ファイルの配信最適化

### nginx.conf
- Cloud Run用にポート8080を設定
- セキュリティヘッダーを追加
- キャッシュ設定を最適化

### cloudbuild.yaml
- 自動ビルド、プッシュ、デプロイの設定
- asia-northeast1リージョンを使用
- 認証不要のパブリックアクセス設定

## リソース設定

- **メモリ**: 512Mi
- **CPU**: 1コア
- **最小インスタンス**: 0（コールドスタート有り）
- **最大インスタンス**: 10

## 料金について

- アイドル時は課金されません（最小インスタンス0のため）
- 使用時のみCPU、メモリ、リクエスト数に応じて課金
- 軽量なPWAアプリのため、コストは最小限

## トラブルシューティング

### デプロイエラーの確認
```bash
gcloud run services describe pomodoro-timer --region asia-northeast1
```

### ログの確認
```bash
gcloud logs read --service pomodoro-timer --region asia-northeast1
```

### サービスの削除
```bash
gcloud run services delete pomodoro-timer --region asia-northeast1
```