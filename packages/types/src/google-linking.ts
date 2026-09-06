export interface GoogleLinkStatus {
  enabled: boolean;
  linked: boolean;
  providerEmail: string | null;
  canLink: boolean;
}

export interface GoogleLinkStartResponse {
  url: string;
}
