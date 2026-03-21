export class ParseError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public context?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BridgeError extends Error {
  constructor(message: string, public stderr?: string) {
    super(message);
    this.name = 'BridgeError';
  }
}