export interface LoginPayload {
  usernameOrEmail: string;
  password: string;
}

export interface AuthTokensResponse {
  token: string;
  expiration: string;
  refreshToken: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiration: string;
  idUsuario?: number;
  usuarioLogin?: string;
  correo?: string;
  roles: string[];
  permisos: string[];
}

export interface AccessRule {
  anyRole?: string[];
  anyPermission?: string[];
}
