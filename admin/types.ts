export interface Env {
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  ADMIN_EMAIL: string;
  ADMIN_SESSION_SECRET: string;
  ADMIN_LOGIN_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  DEPLOY_WORKFLOW: string;
  WALINE_URL: string;
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
