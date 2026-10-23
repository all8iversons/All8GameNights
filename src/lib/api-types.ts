export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface CreatedGameNightResponse {
  gameNight: {
    id: string;
    status: 'setup';
    createdAt: string;
  };
  hostCapability: string;
  spectatorCode: string;
}
