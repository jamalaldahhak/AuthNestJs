
export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  errorCode?: string;
  errors?: any;
  timestamp: string;
  path: string;
}
