export class AppError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', code = 'RATE_LIMITED') {
    super(message, 429, code);
  }
}
