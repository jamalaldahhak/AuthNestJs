export interface JwtPayload {
  sub: number;
  sid: string;
  type: 'access' | 'refresh';
}