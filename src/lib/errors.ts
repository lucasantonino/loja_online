export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST", details?: Record<string, unknown>) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticacao obrigatoria.", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado para este recurso.", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado.", code = "NOT_FOUND") {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: Record<string, unknown>) {
    super(409, code, message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, code = "UNPROCESSABLE_ENTITY", details?: Record<string, unknown>) {
    super(422, code, message, details);
  }
}

export class TooManyRequestsError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(
    retryAfterSeconds = 60,
    message = "Muitas requisicoes. Tente novamente em instantes.",
  ) {
    super(429, "RATE_LIMIT_EXCEEDED", message, { retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
