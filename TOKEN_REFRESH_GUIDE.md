# Claude Max OAuth トークン更新ガイド

Claude Max の OAuth トークンは通常24時間で期限切れになります。このガイドでは、トークンを自動または手動で更新する方法を説明します。

## 🚨 問題の症状

GitHub Actions で以下のようなエラーが発生する場合、トークンが期限切れになっています：

```
OAuth access token has expired or will expire soon.
Please refresh your token by running the following steps:
1. Login to Claude Max: /login
2. Get new credentials from ~/.claude/.credentials.json
3. Update your GitHub secrets with the new values
```

## 🔄 解決方法

### 方法1: 自動更新スクリプトを使用（推奨）

1. **スクリプトを実行**:
   ```bash
   node scripts/refresh-oauth-token.js
   ```

2. **出力される新しい認証情報をコピー**:
   ```
   CLAUDE_ACCESS_TOKEN: sk-ant-api03-...
   CLAUDE_REFRESH_TOKEN: sk-ant-refresh-...
   CLAUDE_EXPIRES_AT: 1234567890
   ```

3. **GitHub Secrets を更新**:
   - リポジトリの Settings > Secrets and variables > Actions に移動
   - 上記の3つのシークレットを新しい値で更新

### 方法2: 手動更新

1. **Claude にログイン**:
   ```bash
   claude /login
   ```

2. **認証情報ファイルを確認**:
   ```bash
   cat ~/.claude/.credentials.json
   ```

3. **新しい値を GitHub Secrets に設定**:
   - `CLAUDE_ACCESS_TOKEN`: `claudeAiOauth.accessToken`
   - `CLAUDE_REFRESH_TOKEN`: `claudeAiOauth.refreshToken`  
   - `CLAUDE_EXPIRES_AT`: `claudeAiOauth.expiresAt`

## 🤖 自動化のためのワークフロー例

トークンの期限切れを事前に検知するワークフローを設定できます：

```yaml
name: Check Claude Token Expiry

on:
  schedule:
    # 毎日午前9時に実行
    - cron: '0 9 * * *'
  workflow_dispatch:

jobs:
  check-token:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check Token Expiry
        run: |
          expires_at="${{ secrets.CLAUDE_EXPIRES_AT }}"
          current_time=$(date +%s)
          buffer_time=86400  # 24時間のバッファ
          
          if [ $expires_at -le $((current_time + buffer_time)) ]; then
            echo "⚠️ Claude OAuth token will expire soon!"
            echo "Current time: $(date -d @$current_time)"
            echo "Token expires: $(date -d @$expires_at)"
            echo ""
            echo "Please update your token using:"
            echo "node scripts/refresh-oauth-token.js"
            exit 1
          else
            echo "✅ Token is still valid"
            echo "Token expires: $(date -d @$expires_at)"
          fi
```

## 🔧 トラブルシューティング

### エラー: "Token refresh failed"

**原因**: refresh_token も期限切れの可能性があります。

**解決策**:
1. Claude に再ログイン: `claude /login`
2. 新しい認証情報を取得
3. GitHub Secrets を更新

### エラー: "Credentials file not found"

**原因**: Claude がインストールされていないか、ログインしていません。

**解決策**:
1. Claude をインストール: `npm install -g @anthropic-ai/claude-code`
2. ログイン: `claude /login`

### GitHub Actions でのエラー継続

**確認事項**:
- [ ] 3つのシークレットすべてが更新されているか
- [ ] 値にスペースや改行が含まれていないか
- [ ] `CLAUDE_EXPIRES_AT` が数値（UNIX timestamp）であるか

## 📅 定期的なメンテナンス

トークンの期限切れを避けるため：

1. **週に1回**: トークンの有効期限を確認
2. **期限の1日前**: 新しいトークンに更新
3. **自動化**: 上記のワークフローを設定して事前通知を受け取る

## 💡 ベストプラクティス

- 🔒 **セキュリティ**: トークンをコードにハードコードしない
- 📋 **文書化**: チームメンバーと更新手順を共有
- 🤖 **自動化**: 可能な限り自動更新スクリプトを使用
- 📊 **監視**: トークン期限切れの通知を設定

---

このガイドで問題が解決しない場合は、[Issues](https://github.com/FREEDOM-co-jp/claude-code-base-action/issues) でサポートを求めてください。 