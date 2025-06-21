#!/usr/bin/env node

/**
 * Claude Max OAuth Token Refresh Script
 * 
 * このスクリプトは、Claude MaxのOAuthトークンを自動更新するためのものです。
 * GitHub Actions のワークフロー外で使用し、新しいトークンを取得できます。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Claude認証情報のパス
const CLAUDE_CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

/**
 * 現在の認証情報を読み込み
 */
function loadCurrentCredentials() {
  try {
    if (!fs.existsSync(CLAUDE_CREDENTIALS_PATH)) {
      throw new Error(`Credentials file not found: ${CLAUDE_CREDENTIALS_PATH}`);
    }
    
    const data = fs.readFileSync(CLAUDE_CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(data);
    
    if (!credentials.claudeAiOauth) {
      throw new Error('OAuth credentials not found in credentials file');
    }
    
    return credentials.claudeAiOauth;
  } catch (error) {
    console.error('Error loading credentials:', error.message);
    process.exit(1);
  }
}

/**
 * トークンの有効期限をチェック
 */
function checkTokenExpiry(expiresAt) {
  const now = Math.floor(Date.now() / 1000);
  const bufferTime = 300; // 5分のバッファ
  
  if (expiresAt <= now + bufferTime) {
    return false; // 期限切れまたは間もなく期限切れ
  }
  
  return true; // まだ有効
}

/**
 * refresh_tokenを使ってaccess_tokenを更新
 */
async function refreshToken(refreshToken) {
  try {
    const response = await fetch('https://claude.ai/api/auth/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-oauth-refresh/1.0.0',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * 新しい認証情報を保存
 */
function saveCredentials(newTokenData, originalCredentials) {
  const updatedCredentials = {
    claudeAiOauth: {
      ...originalCredentials,
      accessToken: newTokenData.accessToken,
      refreshToken: newTokenData.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + newTokenData.expiresIn,
    },
  };

  try {
    fs.writeFileSync(CLAUDE_CREDENTIALS_PATH, JSON.stringify(updatedCredentials, null, 2));
    console.log('✅ Credentials updated successfully');
  } catch (error) {
    throw new Error(`Failed to save credentials: ${error.message}`);
  }
}

/**
 * GitHub Secretsの更新手順を表示
 */
function showGitHubSecretsInstructions(credentials) {
  console.log('\n📋 GitHub Secrets Update Instructions:');
  console.log('Update the following secrets in your GitHub repository:');
  console.log('');
  console.log(`CLAUDE_ACCESS_TOKEN: ${credentials.accessToken}`);
  console.log(`CLAUDE_REFRESH_TOKEN: ${credentials.refreshToken}`);
  console.log(`CLAUDE_EXPIRES_AT: ${credentials.expiresAt}`);
  console.log('');
  console.log('To update secrets:');
  console.log('1. Go to your repository on GitHub');
  console.log('2. Navigate to Settings > Secrets and variables > Actions');
  console.log('3. Update each secret with the new values above');
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🔄 Claude Max OAuth Token Refresh Tool');
  console.log('=====================================\n');

  // 現在の認証情報を読み込み
  console.log('📖 Loading current credentials...');
  const credentials = loadCurrentCredentials();

  // トークンの有効期限をチェック
  const isValid = checkTokenExpiry(credentials.expiresAt);
  const expiryDate = new Date(credentials.expiresAt * 1000);
  
  console.log(`⏰ Current token expires at: ${expiryDate.toISOString()}`);
  
  if (isValid) {
    console.log('✅ Token is still valid. No refresh needed.');
    showGitHubSecretsInstructions(credentials);
    return;
  }

  console.log('⚠️  Token has expired or will expire soon. Refreshing...');

  try {
    // トークンを更新
    console.log('🔄 Refreshing access token...');
    const newTokenData = await refreshToken(credentials.refreshToken);

    // 認証情報を保存
    console.log('💾 Saving updated credentials...');
    saveCredentials(newTokenData, credentials);

    // 新しい認証情報を読み込んで表示
    const updatedCredentials = loadCurrentCredentials();
    const newExpiryDate = new Date(updatedCredentials.expiresAt * 1000);
    console.log(`✅ New token expires at: ${newExpiryDate.toISOString()}`);

    // GitHub Secretsの更新手順を表示
    showGitHubSecretsInstructions(updatedCredentials);

  } catch (error) {
    console.error('❌ Error refreshing token:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you are logged in to Claude Max');
    console.log('2. Try running: /login in Claude');
    console.log('3. Check that your refresh token is still valid');
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
} 