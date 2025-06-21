#!/usr/bin/env bun

import * as core from "@actions/core";
import { preparePrompt } from "./prepare-prompt";
import { runClaude } from "./run-claude";
import { validateEnvironmentVariables } from "./validate-env";
import { setupOAuthCredentials } from "./setup-oauth";

/**
 * トークンの有効期限をチェック
 */
function checkTokenExpiry(expiresAt: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const expiry = parseInt(expiresAt);
  const bufferTime = 300; // 5分のバッファ

  if (expiry <= now + bufferTime) {
    core.error('OAuth access token has expired or will expire soon.');
    core.error('Please refresh your token by running the following steps:');
    core.error('1. Login to Claude Max: /login');
    core.error('2. Get new credentials from ~/.claude/.credentials.json');
    core.error('3. Update your GitHub secrets with the new values:');
    core.error('   - CLAUDE_ACCESS_TOKEN');
    core.error('   - CLAUDE_REFRESH_TOKEN');
    core.error('   - CLAUDE_EXPIRES_AT');
    return false;
  }

  return true;
}

async function run() {
  try {
    validateEnvironmentVariables();

    // Setup OAuth credentials if using OAuth authentication
    if (process.env.CLAUDE_CODE_USE_OAUTH === "1") {
      // トークンの有効期限をチェック
      const isTokenValid = checkTokenExpiry(process.env.CLAUDE_EXPIRES_AT!);
      if (!isTokenValid) {
        throw new Error('OAuth access token has expired. Please update your GitHub secrets with fresh credentials.');
      }

      await setupOAuthCredentials({
        accessToken: process.env.CLAUDE_ACCESS_TOKEN!,
        refreshToken: process.env.CLAUDE_REFRESH_TOKEN!,
        expiresAt: process.env.CLAUDE_EXPIRES_AT!,
      });
    }

    const promptConfig = await preparePrompt({
      prompt: process.env.INPUT_PROMPT || "",
      promptFile: process.env.INPUT_PROMPT_FILE || "",
    });

    await runClaude(promptConfig.path, {
      allowedTools: process.env.INPUT_ALLOWED_TOOLS,
      disallowedTools: process.env.INPUT_DISALLOWED_TOOLS,
      maxTurns: process.env.INPUT_MAX_TURNS,
      mcpConfig: process.env.INPUT_MCP_CONFIG,
    });
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
    core.setOutput("conclusion", "failure");
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
